# ============================================================
# OIL FAILURE RAW TELEMETRY INFERENCE API
# ============================================================

import os
import pickle
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, field_validator
from typing import List
from tensorflow import keras

# ============================================================
# CONFIGURATION
# ============================================================

SEQUENCE_DAYS = 7
STEPS_PER_DAY = 24 * 12  # 5-min resolution
SEQ_LEN = SEQUENCE_DAYS * STEPS_PER_DAY  # 2016 rows

WINDOW_7D = SEQ_LEN
WINDOW_30D = 30 * 24 * 12  # used for slope proxy (if enough data)

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(MODEL_DIR, "oil_lstm_model.h5")
SCALER_PATH = os.path.join(MODEL_DIR, "oil_lstm_scaler.pkl")

# Model expects 14 engineered features
FEATURE_COLUMNS = [
    'engine_oil_level_l',
    'engine_rpm',
    'engine_load_pct',
    'fuel_consumption_lph',
    'exhaust_backpressure_kpa',
    'boost_pressure_kpa',
    'oil_level_change_30d',
    'oil_slope_7d',
    'regen_freq_30d',
    'failed_regen_30d',
    'boost_std_7d',
    'fuel_trend_7d',
    'idle_ratio_7d',
    'backpressure_mean_7d'
]

NUM_FEATURES = len(FEATURE_COLUMNS)

# ============================================================
# LOAD MODEL + SCALER
# ============================================================

model = keras.models.load_model(MODEL_PATH)

with open(SCALER_PATH, "rb") as f:
    scaler = pickle.load(f)

# ============================================================
# FASTAPI INIT
# ============================================================

app = FastAPI(
    title="Oil Failure Prediction API",
    version="1.0"
)

# ============================================================
# RAW INPUT SCHEMA
# ============================================================

class RawTelemetryInput(BaseModel):
    """
    Raw telemetry schema.
    Expected length: 2016 timesteps (7 days of 5-min data)
    """

    engine_oil_level_l: List[float]
    engine_rpm: List[float]
    engine_load_pct: List[float]
    fuel_consumption_lph: List[float]
    exhaust_backpressure_kpa: List[float]
    boost_pressure_kpa: List[float]
    dpf_regen_event_flag: List[int]
    dpf_failed_regen_count: List[int]
    idle_seconds_since_start: List[float]

    @field_validator("*")
    @classmethod
    def validate_length(cls, v):
        if len(v) != SEQ_LEN:
            raise ValueError(f"Each field must contain {SEQ_LEN} values")
        return v


class PredictionOutput(BaseModel):
    probability_of_failure: float


# ============================================================
# FEATURE ENGINEERING FUNCTION
# ============================================================

def compute_features(df: pd.DataFrame) -> pd.DataFrame:

    # Oil 30d change proxy (if less data, use diff from first)
    df["oil_level_change_30d"] = df["engine_oil_level_l"] - df["engine_oil_level_l"].iloc[0]

    # Oil slope (linear regression over full window)
    x = np.arange(len(df))
    coef = np.polyfit(x, df["engine_oil_level_l"], 1)[0]
    df["oil_slope_7d"] = coef

    # Regen frequency
    df["regen_freq_30d"] = df["dpf_regen_event_flag"].sum()

    # Failed regen delta
    df["failed_regen_30d"] = (
        df["dpf_failed_regen_count"].iloc[-1]
        - df["dpf_failed_regen_count"].iloc[0]
    )

    # Boost instability
    df["boost_std_7d"] = df["boost_pressure_kpa"].std()

    # Fuel trend
    coef_fuel = np.polyfit(x, df["fuel_consumption_lph"], 1)[0]
    df["fuel_trend_7d"] = coef_fuel

    # Idle ratio
    df["idle_ratio_7d"] = np.mean(np.array(df["idle_seconds_since_start"]) > 0)

    # Backpressure mean
    df["backpressure_mean_7d"] = df["exhaust_backpressure_kpa"].mean()

    # Broadcast scalar features across sequence
    for col in [
        "oil_slope_7d",
        "regen_freq_30d",
        "failed_regen_30d",
        "boost_std_7d",
        "fuel_trend_7d",
        "idle_ratio_7d",
        "backpressure_mean_7d"
    ]:
        df[col] = df[col]

    return df


# ============================================================
# PREDICTION ENDPOINT
# ============================================================

@app.post("/predict", response_model=PredictionOutput)
def predict(raw_input: RawTelemetryInput):
    """
    Predicts oil failure probability from 2016 timesteps (7 days) of raw telemetry.
    """

    try:
        # --------------------------------------------------------
        # 1. Build dataframe
        # Shape: (2016, raw_features)
        # --------------------------------------------------------
        df = pd.DataFrame({
            "engine_oil_level_l": raw_input.engine_oil_level_l,
            "engine_rpm": raw_input.engine_rpm,
            "engine_load_pct": raw_input.engine_load_pct,
            "fuel_consumption_lph": raw_input.fuel_consumption_lph,
            "exhaust_backpressure_kpa": raw_input.exhaust_backpressure_kpa,
            "boost_pressure_kpa": raw_input.boost_pressure_kpa,
            "dpf_regen_event_flag": raw_input.dpf_regen_event_flag,
            "dpf_failed_regen_count": raw_input.dpf_failed_regen_count,
            "idle_seconds_since_start": raw_input.idle_seconds_since_start
        })

        # --------------------------------------------------------
        # 2. Feature engineering
        # Output shape: (2016, 14)
        # --------------------------------------------------------
        df = compute_features(df)

        df_model = df[FEATURE_COLUMNS]

        # --------------------------------------------------------
        # 3. Scaling
        # Shape remains (2016, 14)
        # --------------------------------------------------------
        scaled = scaler.transform(df_model.values)

        # --------------------------------------------------------
        # 4. Reshape for model
        # Final shape: (1, 2016, 14)
        # --------------------------------------------------------
        model_input = np.expand_dims(scaled, axis=0)

        # --------------------------------------------------------
        # 5. Predict
        # Output shape: (1,1)
        # --------------------------------------------------------
        prediction = model.predict(model_input)

        probability = float(prediction[0][0])

        return PredictionOutput(
            probability_of_failure=probability
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


# ── Run with: uvicorn oil_prediction_api:app --host 0.0.0.0 --port 8002
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
