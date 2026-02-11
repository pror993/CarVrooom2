import os
import pickle
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
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


class PredictionRequest(BaseModel):
    """
    Expects a list of `SEQ_LEN` (288) rows of raw sensor data.
    
    Each row should contain columns like:
    - vehicle_id, timestamp_utc, odometer_km
    - dpf.diff_pressure_kpa_upstream, dpf.diff_pressure_kpa_downstream
    - dpf.soot_load_pct_est, dpf.failed_regen_count, dpf.pre_dpf_temp_c
    - dpf.regen_event_flag, engine_powertrain.engine_rpm, etc.
    
    The preprocessing will:
    1. Create dpf_delta_p feature
    2. Select only FEATURE_COLS
    3. Scale them
    """
    data: list[dict]


class PredictionResponse(BaseModel):
    rul_pred_log: float  # Log-transformed RUL in hours
    fail21_prob: float   # Probability of failure within 21 days (0-1)


@app.post("/predict", response_model=PredictionResponse)
def predict(req: PredictionRequest):
    # Build DataFrame from incoming rows
    df = pd.DataFrame(req.data)

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
