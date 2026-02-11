import os
import pickle
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List

# ── Config ───────────────────────────────────────────────────────────────
WINDOW_SIZE = 6

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
SCALER_PATH = os.path.join(MODEL_DIR, "anomaly_scaler.pkl")
MODEL_PATH = os.path.join(MODEL_DIR, "isolation_forest.pkl")

# ── Load model & scaler at startup ──────────────────────────────────────
with open(SCALER_PATH, "rb") as f:
    scaler = pickle.load(f)

with open(MODEL_PATH, "rb") as f:
    model = pickle.load(f)

# ── FastAPI app ──────────────────────────────────────────────────────────
app = FastAPI(title="Anomaly Detection API")


# ── Input Schema ─────────────────────────────────────────────────────────
class TelemetryRecord(BaseModel):
    """
    Single telemetry record with exact field names as they appear in raw data.
    Field names use dot notation (e.g., 'dpf.pre_dpf_temp_c').
    """
    timestamp_utc: str
    engine_powertrain__engine_rpm: float = Field(alias="engine_powertrain.engine_rpm")
    engine_powertrain__engine_load_pct: float = Field(alias="engine_powertrain.engine_load_pct")
    vehicle_dynamics__speed_kmh: float = Field(alias="vehicle_dynamics.speed_kmh")
    dpf__diff_pressure_kpa_upstream: float = Field(alias="dpf.diff_pressure_kpa_upstream")
    dpf__diff_pressure_kpa_downstream: float = Field(alias="dpf.diff_pressure_kpa_downstream")
    dpf__pre_dpf_temp_c: float = Field(alias="dpf.pre_dpf_temp_c")
    dpf__post_dpf_temp_c: float = Field(alias="dpf.post_dpf_temp_c")
    scr__nox_up_ppm: float = Field(alias="scr.nox_up_ppm")
    scr__nox_down_ppm: float = Field(alias="scr.nox_down_ppm")
    scr__scr_inlet_temp_c: float = Field(alias="scr.scr_inlet_temp_c")
    scr__scr_outlet_temp_c: float = Field(alias="scr.scr_outlet_temp_c")
    def__injector_duty_cycle_pct: float = Field(alias="def.injector_duty_cycle_pct")
    def__def_pump_pressure_bar: float = Field(alias="def.def_pump_pressure_bar")
    def__def_pump_current_a: float = Field(alias="def.def_pump_current_a")
    def__def_quality_index: float = Field(alias="def.def_quality_index")
    can_bus__message_drop_rate: float = Field(alias="can_bus.message_drop_rate")

    class Config:
        populate_by_name = True


class AnomalyRequest(BaseModel):
    """Expects minimum 6 time-ordered telemetry records."""
    data: List[TelemetryRecord]


class AnomalyResponse(BaseModel):
    anomaly_score: float
    is_anomaly: bool


# ── Feature Engineering ──────────────────────────────────────────────────
def add_physics_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Adds 5 engineered features from raw sensor data.
    Total features after: 16 + 5 = 21
    """
    eps = 1e-6
    df_copy = df.copy()
    
    df_copy["feat_dpf_delta"] = (
        df_copy["dpf.diff_pressure_kpa_upstream"] -
        df_copy["dpf.diff_pressure_kpa_downstream"]
    )
    
    df_copy["feat_nox_ratio"] = (
        df_copy["scr.nox_down_ppm"] /
        (df_copy["scr.nox_up_ppm"] + eps)
    )
    
    df_copy["feat_pressure_per_duty"] = (
        df_copy["def.def_pump_pressure_bar"] /
        (df_copy["def.injector_duty_cycle_pct"] + eps)
    )
    
    df_copy["feat_current_per_pressure"] = (
        df_copy["def.def_pump_current_a"] /
        (df_copy["def.def_pump_pressure_bar"] + eps)
    )
    
    df_copy["feat_scr_temp_delta"] = (
        df_copy["scr.scr_inlet_temp_c"] -
        df_copy["scr.scr_outlet_temp_c"]
    )
    
    return df_copy


def create_window_features(df: pd.DataFrame) -> np.ndarray:
    """
    Creates sliding windows of size WINDOW_SIZE (6).
    For each window, computes mean and std of all 21 features.
    Output shape: (N_windows, 42)
    """
    feature_matrix = []
    
    for i in range(len(df) - WINDOW_SIZE + 1):
        window = df.iloc[i:i + WINDOW_SIZE]
        mean_vals = window.mean().values
        std_vals = window.std().values
        feature_matrix.append(np.concatenate([mean_vals, std_vals]))
    
    return np.array(feature_matrix)


# ── API Endpoint ─────────────────────────────────────────────────────────
@app.post("/predict", response_model=AnomalyResponse)
def predict(req: AnomalyRequest):
    """
    Detects anomalies in telemetry data using IsolationForest.
    
    Returns the anomaly score and anomaly flag for the latest window.
    """
    if len(req.data) < WINDOW_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum {WINDOW_SIZE} records required, got {len(req.data)}"
        )

    # Convert to DataFrame using dict with by_alias=True to preserve dot notation
    df = pd.DataFrame([r.dict(by_alias=True) for r in req.data])

    # Add physics features (21 total features)
    df = add_physics_features(df)

    # Drop timestamp (20 numeric features remain + 5 engineered = 21)
    df = df.drop(columns=["timestamp_utc"])

    # Create sliding windows (output: N_windows × 42)
    X_windowed = create_window_features(df)

    # Scale features
    X_scaled = scaler.transform(X_windowed)

    # Get anomaly scores
    scores = model.decision_function(X_scaled)
    latest_score = float(scores[-1])

    # Threshold at 1st percentile
    threshold = np.percentile(scores, 1)

    return AnomalyResponse(
        anomaly_score=latest_score,
        is_anomaly=bool(latest_score < threshold)
    )


# ── Run with: uvicorn anomaly_detector_api:app --host 0.0.0.0 --port 8001
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
