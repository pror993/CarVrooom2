# ============================================================
# SCR FAILURE PREDICTION API
# ============================================================

import os
import pickle
import torch
import torch.nn as nn
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List

# ── Config ───────────────────────────────────────────────────────────────
SEQ_LEN = 288 * 7  # 2016 timesteps
FAIL_THRESHOLD = 75.0

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(MODEL_DIR, "scr_rul_prediction_model.pth")
SCALER_PATH = os.path.join(MODEL_DIR, "scr_feature_scaler.pkl")

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ── Model Architecture ───────────────────────────────────────────────────
class MultiHeadSCRLSTM(nn.Module):
    """Dual-output LSTM for SCR failure prediction"""
    def __init__(self, input_dim, hidden_dim=128, num_layers=2, dropout=0.3):
        super().__init__()
        self.lstm = nn.LSTM(
            input_dim, hidden_dim, num_layers,
            batch_first=True, dropout=dropout
        )
        self.rul_head = nn.Linear(hidden_dim, 1)
        self.prob_head = nn.Linear(hidden_dim, 1)
    
    def forward(self, x):
        lstm_out, _ = self.lstm(x)
        last_hidden = lstm_out[:, -1, :]
        rul = self.rul_head(last_hidden)
        prob = self.prob_head(last_hidden)
        return rul, prob

# ── Load model + scaler ──────────────────────────────────────────────────
checkpoint = torch.load(MODEL_PATH, map_location=device)
FEATURES = checkpoint["features"]

model = MultiHeadSCRLSTM(len(FEATURES))
model.load_state_dict(checkpoint["model_state_dict"])
model.to(device)
model.eval()

with open(SCALER_PATH, "rb") as f:
    scaler = pickle.load(f)

# ── FastAPI app ──────────────────────────────────────────────────────────
app = FastAPI(title="SCR Failure Prediction API")


# ── Input/Output Schemas ─────────────────────────────────────────────────
class TelemetryRecord(BaseModel):
    """
    Single telemetry record with 10 required sensor fields.
    Expects one row per 5 minutes, time-sorted.
    """
    vehicle_id: str
    scr__nox_up_ppm: float = Field(alias="scr.nox_up_ppm")
    scr__nox_down_ppm: float = Field(alias="scr.nox_down_ppm")
    scr__scr_inlet_temp_c: float = Field(alias="scr.scr_inlet_temp_c")
    scr__scr_outlet_temp_c: float = Field(alias="scr.scr_outlet_temp_c")
    scr__nox_conversion_pct: float = Field(alias="scr.nox_conversion_pct")
    def__def_quality_index: float = Field(alias="def.def_quality_index")
    def__injector_duty_cycle_pct: float = Field(alias="def.injector_duty_cycle_pct")
    engine_powertrain__engine_load_pct: float = Field(alias="engine_powertrain.engine_load_pct")
    vehicle_dynamics__speed_kmh: float = Field(alias="vehicle_dynamics.speed_kmh")

    class Config:
        populate_by_name = True


class SCRRequest(BaseModel):
    """Expects minimum 2016 time-ordered telemetry records for a single vehicle."""
    data: List[TelemetryRecord]


class SCRResponse(BaseModel):
    vehicle_id: str
    failure_type: str = "SCR"
    RUL_hours: float
    predicted_time_to_intervention_days: float
    probability_of_failure_within_21d: float


# ── Feature Engineering ──────────────────────────────────────────────────
def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Adds 7 engineered features from 10 raw columns.
    Output: (N_clean, 15 columns)
    """
    df = df.copy()

    # Physics features
    df["nox_sensor_divergence"] = df["scr.nox_up_ppm"] - df["scr.nox_down_ppm"]
    df["scr_temp_delta"] = df["scr.scr_inlet_temp_c"] - df["scr.scr_outlet_temp_c"]
    df["t_idx"] = df.groupby("vehicle_id").cumcount()

    W_7D = 288 * 7
    W_30D = 288 * 30

    def rolling_slope(x):
        idx = np.arange(len(x))
        if len(x) < 10:
            return 0.0
        return np.polyfit(idx, x, 1)[0]

    # Rolling features
    df["nox_conv_slope_7d"] = (
        df.groupby("vehicle_id")["scr.nox_conversion_pct"]
        .rolling(W_7D)
        .apply(rolling_slope, raw=False)
        .reset_index(level=0, drop=True)
    )

    df["nox_conv_slope_30d"] = (
        df.groupby("vehicle_id")["scr.nox_conversion_pct"]
        .rolling(W_30D)
        .apply(rolling_slope, raw=False)
        .reset_index(level=0, drop=True)
    )

    df["avg_load_7d"] = (
        df.groupby("vehicle_id")["engine_powertrain.engine_load_pct"]
        .rolling(W_7D).mean()
        .reset_index(level=0, drop=True)
    )

    df["avg_speed_7d"] = (
        df.groupby("vehicle_id")["vehicle_dynamics.speed_kmh"]
        .rolling(W_7D).mean()
        .reset_index(level=0, drop=True)
    )

    df = df.dropna().reset_index(drop=True)
    return df


# ── API Endpoint ─────────────────────────────────────────────────────────
@app.post("/predict", response_model=SCRResponse)
def predict(req: SCRRequest):
    """
    Predicts SCR failure from time-series telemetry.
    
    Pipeline:
    Raw (N,10) → Engineered (N_clean,15) → Scaled (N_clean,11) 
    → Window (2016,11) → Tensor (1,2016,11) → Model → {RUL, Prob}
    """
    if len(req.data) < SEQ_LEN:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum {SEQ_LEN} records required, got {len(req.data)}"
        )

    # Step 1: Build DataFrame (N, 10)
    df_raw = pd.DataFrame([r.dict(by_alias=True) for r in req.data])

    # Step 2: Engineer features (N_clean, 15)
    df_feat = engineer_features(df_raw)

    if len(df_feat) < SEQ_LEN:
        raise HTTPException(
            status_code=400,
            detail=f"After feature engineering, only {len(df_feat)} rows remain. Need {SEQ_LEN}."
        )

    # Step 3: Scale features (N_clean, 11)
    df_feat[FEATURES] = scaler.transform(df_feat[FEATURES])

    # Step 4: Extract last window (2016, 11)
    X = df_feat[FEATURES].values[-SEQ_LEN:].astype("float32")

    # Step 5: Convert to tensor (1, 2016, 11)
    X_tensor = torch.from_numpy(X).unsqueeze(0).to(device)

    # Step 6: Model prediction
    with torch.no_grad():
        pred_rul, pred_prob = model(X_tensor)

    rul_hours = float(pred_rul.squeeze().cpu().item())
    prob = float(torch.sigmoid(pred_prob.squeeze()).cpu().item())

    # Step 7: Build response
    return SCRResponse(
        vehicle_id=df_raw["vehicle_id"].iloc[-1],
        failure_type="SCR",
        RUL_hours=max(rul_hours, 0.0),
        predicted_time_to_intervention_days=max(rul_hours, 0.0) / 24,
        probability_of_failure_within_21d=prob
    )


# ── Run with: uvicorn scr_prediction_api:app --host 0.0.0.0 --port 8003
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
