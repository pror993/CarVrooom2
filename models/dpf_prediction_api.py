import os
# Set Keras backend before importing keras
os.environ["KERAS_BACKEND"] = "numpy"  # Use numpy backend (no TF/JAX required)

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import keras
from typing import Optional
from pydantic import BaseModel, Field
from typing import List
from tensorflow import keras

# ── Config ───────────────────────────────────────────────────────────────
SEQ_LEN = 288

FEATURE_COLS = [
    "dpf_delta_p",
    "dpf.soot_load_pct_est",
    "dpf.failed_regen_count",
    "dpf.pre_dpf_temp_c",
    "dpf.regen_event_flag",
    "engine_powertrain.engine_rpm",
    "engine_powertrain.engine_load_pct",
    "vehicle_dynamics.speed_kmh",
]

# Columns to extract for signals in the output
SIGNAL_COLS = [
    "dpf.diff_pressure_kpa_upstream",
    "dpf.diff_pressure_kpa_downstream",
    "dpf.soot_load_pct_est",
    "dpf.failed_regen_count",
    "dpf.pre_dpf_temp_c",
    "dpf.post_dpf_temp_c",
    "dpf.regen_status",
    "engine_powertrain.exhaust_backpressure_kpa",
    "engine_powertrain.engine_rpm",
    "engine_powertrain.engine_load_pct",
    "vehicle_dynamics.speed_kmh",
]

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(MODEL_DIR, "dpf_model.h5")
SCALERS_PATH = os.path.join(MODEL_DIR, "dpf_scalers.pkl")

# ── Load model & scalers at startup ──────────────────────────────────────
# Use compile=False to avoid Keras version compatibility issues with saved loss/metrics
model = keras.models.load_model(MODEL_PATH, compile=False)

# Use joblib to load sklearn scalers (saved with joblib, not pickle)
import warnings
with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    scalers = joblib.load(SCALERS_PATH)  # list of fitted StandardScaler objects


def rul_hours_to_days(rul_log: float) -> float:
    """
    Convert log-transformed RUL in hours to days.
    RUL was log-transformed during training: log(rul_hours + 1)
    So we reverse: exp(rul_log) - 1 = rul_hours, then divide by 24.
    """
    rul_hours = np.exp(rul_log) - 1
    return max(0, rul_hours / 24.0)


# ── Preprocessing ────────────────────────────────────────────────────────
def preprocess_inference_data(
    input_df_window: pd.DataFrame,
    feature_cols: list,
    scalers: list,
) -> np.ndarray:
    """
    Applies feature engineering (dpf_delta_p) and scaling to a DataFrame
    window for inference.

    Returns:
        np.ndarray of shape (1, SEQ_LEN, num_features)
    """
    df_processed = input_df_window.copy()

    # Feature engineering
    if "dpf_delta_p" not in df_processed.columns:
        df_processed["dpf_delta_p"] = (
            df_processed["dpf.diff_pressure_kpa_upstream"]
            - df_processed["dpf.diff_pressure_kpa_downstream"]
        )

    features_array = df_processed[feature_cols].values
    scaled_features_temp = np.zeros_like(features_array, dtype=float)

    for i, scaler in enumerate(scalers):
        feature_series = features_array[:, i].reshape(1, -1)
        scaled_features_temp[:, i] = scaler.transform(feature_series).flatten()

    return scaled_features_temp.reshape(1, SEQ_LEN, len(feature_cols))


def extract_signals_summary(df: pd.DataFrame) -> dict:
    """
    Extract signal summary from the input data for the agentic pipeline.
    Returns the latest values and some statistics.
    """
    signals = {}
    
    for col in SIGNAL_COLS:
        if col in df.columns:
            values = df[col].values
            
            # For numeric columns, add stats
            if pd.api.types.is_numeric_dtype(df[col]):
                latest = float(values[-1]) if len(values) > 0 else None
                signals[col] = {
                    "value": round(latest, 3) if latest is not None else None,
                    "mean": round(float(df[col].mean()), 3),
                    "max": round(float(df[col].max()), 3),
                    "min": round(float(df[col].min()), 3),
                }
            else:
                # For non-numeric columns (like regen_status), store as string
                latest = str(values[-1]) if len(values) > 0 else None
                signals[col] = {"value": latest}
    
    # Add computed delta_p
    if "dpf.diff_pressure_kpa_upstream" in df.columns and "dpf.diff_pressure_kpa_downstream" in df.columns:
        delta_p = df["dpf.diff_pressure_kpa_upstream"] - df["dpf.diff_pressure_kpa_downstream"]
        signals["dpf_delta_p"] = {
            "value": round(float(delta_p.iloc[-1]), 3),
            "mean": round(float(delta_p.mean()), 3),
            "max": round(float(delta_p.max()), 3),
            "min": round(float(delta_p.min()), 3),
        }
    
    return signals


# ── FastAPI app ──────────────────────────────────────────────────────────
app = FastAPI(title="DPF Prediction API")


class TelemetryRecord(BaseModel):
    """
    Single telemetry record with exact field names as they appear in raw data.
    Field names use dot notation (e.g., 'dpf.soot_load_pct_est').
    """
    dpf__diff_pressure_kpa_upstream: float = Field(alias="dpf.diff_pressure_kpa_upstream")
    dpf__diff_pressure_kpa_downstream: float = Field(alias="dpf.diff_pressure_kpa_downstream")
    dpf__soot_load_pct_est: float = Field(alias="dpf.soot_load_pct_est")
    dpf__failed_regen_count: int = Field(alias="dpf.failed_regen_count")
    dpf__pre_dpf_temp_c: float = Field(alias="dpf.pre_dpf_temp_c")
    dpf__regen_event_flag: int = Field(alias="dpf.regen_event_flag")
    engine_powertrain__engine_rpm: float = Field(alias="engine_powertrain.engine_rpm")
    engine_powertrain__engine_load_pct: float = Field(alias="engine_powertrain.engine_load_pct")
    vehicle_dynamics__speed_kmh: float = Field(alias="vehicle_dynamics.speed_kmh")

    class Config:
        populate_by_name = True


class PredictionRequest(BaseModel):
    """Expects exactly 288 time-ordered telemetry records."""
    data: List[TelemetryRecord]


class RawModelOutput(BaseModel):
    """Raw model outputs for reference (camelCase to match MongoDB schema)"""
    rulPredLog: float   # Log-transformed RUL in hours
    fail21Prob: float   # Probability of failure within 21 days (0-1)


class AgenticPipelineResponse(BaseModel):
    """
    Output format compatible with the agentic pipeline's PredictionEvent schema.
    This can be directly ingested into POST /api/predictions/ingest
    """
    vehicleId: str
    predictionType: str  # Always "dpf_failure" for this model
    confidence: float    # fail21_prob mapped to confidence (0-1)
    etaDays: float       # RUL converted from hours to days
    signals: dict        # Input sensor data summary
    modelOutputs: RawModelOutput  # Raw model outputs for reference
    source: str          # Always "dpf_model"


class LegacyPredictionResponse(BaseModel):
    """Legacy response format (for backward compatibility)"""
    rul_pred_log: float  # Log-transformed RUL in hours
    fail21_prob: float   # Probability of failure within 21 days (0-1)


@app.post("/predict", response_model=AgenticPipelineResponse)
def predict(req: PredictionRequest):
    """
    Main prediction endpoint.
    Returns output in agentic pipeline compatible format.
    """
    # Build DataFrame from incoming rows
    df = pd.DataFrame(req.data)

    if len(df) != SEQ_LEN:
        raise HTTPException(
            status_code=400,
            detail=f"Expected {SEQ_LEN} rows, got {len(df)}",
        )

    # Extract vehicle_id from data
    vehicle_id = df["vehicle_id"].iloc[0] if "vehicle_id" in df.columns else "UNKNOWN"

    try:
        preprocessed = preprocess_inference_data(df, FEATURE_COLS, scalers)
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Missing column: {e}")

    # Model outputs: [rul_pred_log, fail21_prob]
    outputs = model.predict(preprocessed)
    
    # Extract predictions (shape: (1, 1) for each)
    rul_log = float(outputs[0][0][0])
    fail_prob = float(outputs[1][0][0])
    
    # Convert to agentic pipeline format
    eta_days = rul_hours_to_days(rul_log)
    confidence = fail_prob  # Direct mapping: fail21_prob → confidence
    
    # Extract signals from input data
    signals = extract_signals_summary(df)
    
    return AgenticPipelineResponse(
        vehicleId=str(vehicle_id),
        predictionType="dpf_failure",
        confidence=round(confidence, 4),
        etaDays=round(eta_days, 2),
        signals=signals,
        modelOutputs=RawModelOutput(
            rulPredLog=round(rul_log, 6),
            fail21Prob=round(fail_prob, 6)
        ),
        source="dpf_model"
    )


@app.post("/predict/legacy", response_model=LegacyPredictionResponse)
def predict_legacy(req: PredictionRequest):
    """
    Legacy prediction endpoint.
    Returns raw model outputs (for backward compatibility).
    """
    # Build DataFrame from incoming rows
    df = pd.DataFrame([r.dict(by_alias=True) for r in req.data])

    if len(df) != SEQ_LEN:
        raise HTTPException(
            status_code=400,
            detail=f"Expected {SEQ_LEN} rows, got {len(df)}",
        )

    try:
        preprocessed = preprocess_inference_data(df, FEATURE_COLS, scalers)
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Missing column: {e}")

    # Model outputs: [rul_pred_log, fail21_prob]
    outputs = model.predict(preprocessed)
    
    # Extract predictions (shape: (1, 1) for each)
    rul_log = float(outputs[0][0][0])
    fail_prob = float(outputs[1][0][0])
    
    return LegacyPredictionResponse(
        rul_pred_log=rul_log,
        fail21_prob=fail_prob
    )


@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "seq_len": SEQ_LEN,
        "feature_cols": FEATURE_COLS
    }


# ── Run with:  uvicorn dpf_prediction_api:app --host 0.0.0.0 --port 8000
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
