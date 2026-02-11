import os
import pickle
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
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

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(MODEL_DIR, "dpf_model.h5")
SCALERS_PATH = os.path.join(MODEL_DIR, "dpf_scalers.pkl")

# ── Load model & scalers at startup ──────────────────────────────────────
model = keras.models.load_model(MODEL_PATH)

with open(SCALERS_PATH, "rb") as f:
    scalers = pickle.load(f)  # list of fitted StandardScaler objects

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


class PredictionResponse(BaseModel):
    rul_pred_log: float  # Log-transformed RUL in hours
    fail21_prob: float   # Probability of failure within 21 days (0-1)


@app.post("/predict", response_model=PredictionResponse)
def predict(req: PredictionRequest):
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
    
    return PredictionResponse(
        rul_pred_log=rul_log,
        fail21_prob=fail_prob
    )


# ── Run with:  uvicorn dpf_prediction_api:app --host 0.0.0.0 --port 8000
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
