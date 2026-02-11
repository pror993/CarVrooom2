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
    'engine_powertrain.oil_level_l',
    'engine_powertrain.engine_rpm',
    'engine_powertrain.engine_load_pct',
    'engine_powertrain.fuel_consumption_lph',
    'engine_powertrain.exhaust_backpressure_kpa',
    'engine_powertrain.boost_pressure_kpa',
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

class TelemetryRecord(BaseModel):
    """
    Single telemetry record with exact field names as they appear in raw data.
    Field names use dot notation.
    """
    engine_powertrain__oil_level_l: float = Field(alias="engine_powertrain.oil_level_l")
    engine_powertrain__engine_rpm: float = Field(alias="engine_powertrain.engine_rpm")
    engine_powertrain__engine_load_pct: float = Field(alias="engine_powertrain.engine_load_pct")
    engine_powertrain__fuel_consumption_lph: float = Field(alias="engine_powertrain.fuel_consumption_lph")
    engine_powertrain__exhaust_backpressure_kpa: float = Field(alias="engine_powertrain.exhaust_backpressure_kpa")
    engine_powertrain__boost_pressure_kpa: float = Field(alias="engine_powertrain.boost_pressure_kpa")
    dpf__regen_event_flag: int = Field(alias="dpf.regen_event_flag")
    dpf__failed_regen_count: int = Field(alias="dpf.failed_regen_count")
    vehicle_dynamics__idle_seconds_since_start: float = Field(alias="vehicle_dynamics.idle_seconds_since_start")

    class Config:
        populate_by_name = True


class OilRequest(BaseModel):
    """Expects exactly 2016 time-ordered telemetry records (7 days)."""
    data: List[TelemetryRecord]


class OilResponse(BaseModel):
    probability_of_failure: float


# ============================================================
# FEATURE ENGINEERING FUNCTION
# ============================================================

def compute_features(df: pd.DataFrame) -> pd.DataFrame:

    # Oil 30d change proxy (if less data, use diff from first)
    df["oil_level_change_30d"] = df["engine_powertrain.oil_level_l"] - df["engine_powertrain.oil_level_l"].iloc[0]

    # Oil slope (linear regression over full window)
    x = np.arange(len(df))
    coef = np.polyfit(x, df["engine_powertrain.oil_level_l"], 1)[0]
    df["oil_slope_7d"] = coef

    # Regen frequency
    df["regen_freq_30d"] = df["dpf.regen_event_flag"].sum()

    # Failed regen delta
    df["failed_regen_30d"] = (
        df["dpf.failed_regen_count"].iloc[-1]
        - df["dpf.failed_regen_count"].iloc[0]
    )

    # Boost instability
    df["boost_std_7d"] = df["engine_powertrain.boost_pressure_kpa"].std()

    # Fuel trend
    coef_fuel = np.polyfit(x, df["engine_powertrain.fuel_consumption_lph"], 1)[0]
    df["fuel_trend_7d"] = coef_fuel

    # Idle ratio
    df["idle_ratio_7d"] = np.mean(np.array(df["vehicle_dynamics.idle_seconds_since_start"]) > 0)

    # Backpressure mean
    df["backpressure_mean_7d"] = df["engine_powertrain.exhaust_backpressure_kpa"].mean()

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

@app.post("/predict", response_model=OilResponse)
def predict(req: OilRequest):
    """
    Predicts oil failure probability from 2016 timesteps (7 days) of raw telemetry.
    """

    if len(req.data) != SEQ_LEN:
        raise HTTPException(
            status_code=400,
            detail=f"Expected {SEQ_LEN} records, got {len(req.data)}"
        )

    try:
        # --------------------------------------------------------
        # 1. Build dataframe
        # Shape: (2016, raw_features)
        # --------------------------------------------------------
        df = pd.DataFrame([r.dict(by_alias=True) for r in req.data])

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

        return OilResponse(
            probability_of_failure=probability
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


# ── Run with: uvicorn oil_prediction_api:app --host 0.0.0.0 --port 8002
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
