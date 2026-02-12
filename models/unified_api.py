"""
Unified ML Prediction API
==========================
Serves all 4 models on a single FastAPI instance (port 8000):
  - DPF Failure  → /predict/dpf     → RUL (days) + fail probability
  - SCR Failure  → /predict/scr     → RUL (hours) + fail probability
  - Oil Failure  → /predict/oil     → fail probability (converted to RUL estimate)
  - Anomaly      → /predict/anomaly → anomaly score + is_anomaly flag

Master endpoint:
  - /predict/all  → Runs ALL models on the same dataset, picks worst RUL,
                     returns a unified prediction ready for the agentic pipeline.

Run:
  cd models && uvicorn unified_api:app --host 0.0.0.0 --port 8000 --reload
"""

import os
import warnings
import traceback

os.environ["KERAS_BACKEND"] = "numpy"

import joblib
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import keras

# ═══════════════════════════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════════════════════════

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))

app = FastAPI(title="CarVrooom Unified ML API", version="2.0")

# ═══════════════════════════════════════════════════════════════
# DPF MODEL SETUP
# ═══════════════════════════════════════════════════════════════

DPF_SEQ_LEN = 288

DPF_FEATURE_COLS = [
    "dpf_delta_p",
    "dpf.soot_load_pct_est",
    "dpf.failed_regen_count",
    "dpf.pre_dpf_temp_c",
    "dpf.regen_event_flag",
    "engine_powertrain.engine_rpm",
    "engine_powertrain.engine_load_pct",
    "vehicle_dynamics.speed_kmh",
]

DPF_SIGNAL_COLS = [
    "dpf.diff_pressure_kpa_upstream",
    "dpf.diff_pressure_kpa_downstream",
    "dpf.soot_load_pct_est",
    "dpf.failed_regen_count",
    "dpf.pre_dpf_temp_c",
    "dpf.post_dpf_temp_c",
    "engine_powertrain.exhaust_backpressure_kpa",
    "engine_powertrain.engine_rpm",
    "engine_powertrain.engine_load_pct",
    "vehicle_dynamics.speed_kmh",
]

print("📦 Loading DPF model...")
dpf_model = keras.models.load_model(
    os.path.join(MODEL_DIR, "dpf_model.h5"), compile=False
)
with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    dpf_scalers = joblib.load(os.path.join(MODEL_DIR, "dpf_scalers.pkl"))
print("   ✅ DPF model loaded")

# ═══════════════════════════════════════════════════════════════
# SCR MODEL SETUP
# ═══════════════════════════════════════════════════════════════

SCR_SEQ_LEN = 288 * 7  # 2016

# The 11 features the SCR scaler/model expects (from scaler.feature_names_in_)
SCR_FEATURES = [
    "scr.nox_conversion_pct",
    "nox_sensor_divergence",
    "scr_temp_delta",
    "def.def_quality_index",
    "def.injector_duty_cycle_pct",
    "engine_powertrain.engine_load_pct",
    "vehicle_dynamics.speed_kmh",
    "nox_conv_slope_7d",
    "nox_conv_slope_30d",
    "avg_load_7d",
    "avg_speed_7d",
]

class MultiHeadSCRLSTM(nn.Module):
    """Dual-output LSTM — matches saved state dict (hidden=64, heads via Sequential)."""
    def __init__(self, input_dim, hidden_dim=64, num_layers=2, dropout=0.3):
        super().__init__()
        self.lstm = nn.LSTM(input_dim, hidden_dim, num_layers,
                            batch_first=True, dropout=dropout)
        self.reg_head = nn.Sequential(
            nn.Linear(hidden_dim, 32),
            nn.ReLU(),
            nn.Linear(32, 1),
        )
        self.cls_head = nn.Sequential(
            nn.Linear(hidden_dim, 32),
            nn.ReLU(),
            nn.Linear(32, 1),
        )

    def forward(self, x):
        lstm_out, _ = self.lstm(x)
        last_hidden = lstm_out[:, -1, :]
        return self.reg_head(last_hidden), self.cls_head(last_hidden)

print("📦 Loading SCR model...")
scr_device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
scr_state_dict = torch.load(
    os.path.join(MODEL_DIR, "scr_rul_prediction_model.pth"),
    map_location=scr_device,
)

scr_model = MultiHeadSCRLSTM(len(SCR_FEATURES))
scr_model.load_state_dict(scr_state_dict)
scr_model.to(scr_device)
scr_model.eval()

with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    scr_scaler = joblib.load(os.path.join(MODEL_DIR, "scr_feature_scaler.pkl"))
print("   ✅ SCR model loaded")

# ═══════════════════════════════════════════════════════════════
# OIL MODEL SETUP
# ═══════════════════════════════════════════════════════════════

OIL_SEQ_LEN = 2016

OIL_RAW_COLS = [
    "engine_powertrain.oil_level_l",
    "engine_powertrain.engine_rpm",
    "engine_powertrain.engine_load_pct",
    "engine_powertrain.fuel_consumption_lph",
    "engine_powertrain.exhaust_backpressure_kpa",
    "engine_powertrain.boost_pressure_kpa",
    "dpf.regen_event_flag",
    "dpf.failed_regen_count",
    "vehicle_dynamics.idle_seconds_since_start",
]

OIL_FEATURE_COLUMNS = [
    "engine_powertrain.oil_level_l",
    "engine_powertrain.engine_rpm",
    "engine_powertrain.engine_load_pct",
    "engine_powertrain.fuel_consumption_lph",
    "engine_powertrain.exhaust_backpressure_kpa",
    "engine_powertrain.boost_pressure_kpa",
    "oil_level_change_30d",
    "oil_slope_7d",
    "regen_freq_30d",
    "failed_regen_30d",
    "boost_std_7d",
    "fuel_trend_7d",
    "idle_ratio_7d",
    "backpressure_mean_7d",
]

print("📦 Loading Oil model...")
oil_model = keras.models.load_model(os.path.join(MODEL_DIR, "oil_lstm_model.h5"), compile=False)
with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    oil_scaler = joblib.load(os.path.join(MODEL_DIR, "oil_lstm_scaler.pkl"))
print("   ✅ Oil model loaded")

# ═══════════════════════════════════════════════════════════════
# ANOMALY MODEL SETUP
# ═══════════════════════════════════════════════════════════════

ANOMALY_WINDOW = 6

ANOMALY_RAW_COLS = [
    "engine_powertrain.engine_rpm",
    "engine_powertrain.engine_load_pct",
    "vehicle_dynamics.speed_kmh",
    "dpf.diff_pressure_kpa_upstream",
    "dpf.diff_pressure_kpa_downstream",
    "dpf.pre_dpf_temp_c",
    "dpf.post_dpf_temp_c",
    "scr.nox_up_ppm",
    "scr.nox_down_ppm",
    "scr.scr_inlet_temp_c",
    "scr.scr_outlet_temp_c",
    "def.injector_duty_cycle_pct",
    "def.def_pump_pressure_bar",
    "def.def_pump_current_a",
    "def.def_quality_index",
    "can_bus.message_drop_rate",
]

print("📦 Loading Anomaly model...")
with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    anomaly_scaler = joblib.load(os.path.join(MODEL_DIR, "anomaly_scaler.pkl"))
    anomaly_model = joblib.load(os.path.join(MODEL_DIR, "isolation_forest.pkl"))
print("   ✅ Anomaly model loaded")


# ═══════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════

def rul_hours_to_days(rul_log: float) -> float:
    """Convert log-transformed RUL hours → days."""
    rul_hours = np.exp(rul_log) - 1
    return max(0, rul_hours / 24.0)


# ── Signal-based health scoring ──────────────────────────────────────
# The DPF / SCR models' RUL heads are saturated and don't differentiate
# healthy vs failing vehicles well.  We augment them with physics-based
# thresholds derived from the raw sensor signals.

# DPF healthy baselines (drastically tightened - HEALTHY: soot~42, regen=0, delta~5; DPF_FAIL: soot~125, regen=36, delta~18)
DPF_THRESHOLDS = {
    "dpf.soot_load_pct_est":   {"healthy": 45,  "critical": 80},   # % (DPF_FAIL shows 118-131)
    "dpf.failed_regen_count":  {"healthy": 5,   "critical": 20},   # DPF_FAIL shows 33-40
    "dpf_delta_p":             {"healthy": 8,   "critical": 12},   # kPa abs (DPF_FAIL shows ~18)
}

SCR_THRESHOLDS = {
    "scr.nox_conversion_pct":  {"healthy": 90,  "critical": 60},   # lower=worse
    "scr.nox_down_ppm":        {"healthy": 15,  "critical": 60},
}

OIL_THRESHOLDS = {
    # Oil level: healthy vehicle stays ~5.0L; fuel dilution pushes it up
    "engine_powertrain.oil_level_l":       {"healthy": 5.1,  "critical": 6.5},   # L (higher=worse)
    # Oil pressure: healthy ~2.0 bar; degradation drops it
    "engine_powertrain.oil_pressure_bar":  {"healthy": 1.9,  "critical": 1.2},   # bar (lower=worse)
    # Oil level change over window: healthy ≈ 0; dilution → positive rise
    "oil_level_change":                    {"healthy": 0.05, "critical": 1.2},   # L (higher=worse)
    # Oil pressure trend (slope): healthy ≈ 0; degradation → negative slope
    "oil_pressure_slope":                  {"healthy": 0.0,  "critical": -0.00005}, # bar/sample (more negative=worse)
}


def dpf_signal_health_score(df: pd.DataFrame) -> float:
    """
    Returns a health score 0‑1 based on DPF sensor signals.
    1.0 = perfectly healthy, 0.0 = critical failure.
    """
    window = df.iloc[-288:]  # last day
    scores = []

    # Soot load (higher = worse)
    soot = window["dpf.soot_load_pct_est"].mean()
    t = DPF_THRESHOLDS["dpf.soot_load_pct_est"]
    s = 1.0 - np.clip((soot - t["healthy"]) / (t["critical"] - t["healthy"]), 0, 1)
    scores.append(s)

    # Failed regen count (higher = worse)
    regen = float(window["dpf.failed_regen_count"].iloc[-1])
    t = DPF_THRESHOLDS["dpf.failed_regen_count"]
    s = 1.0 - np.clip((regen - t["healthy"]) / (t["critical"] - t["healthy"]), 0, 1)
    scores.append(s)

    # Delta P (absolute value - higher = worse)
    # Healthy: ~5, DPF_FAIL: ~18 (both are actually negative in raw data)
    if "dpf_delta_p" not in window.columns:
        dp = window["dpf.diff_pressure_kpa_downstream"] - window["dpf.diff_pressure_kpa_upstream"]
    else:
        dp = window["dpf_delta_p"]
    dp_mean_abs = abs(dp.mean())  # Use absolute value
    t = DPF_THRESHOLDS["dpf_delta_p"]
    s = 1.0 - np.clip((dp_mean_abs - t["healthy"]) / (t["critical"] - t["healthy"]), 0, 1)
    scores.append(s)

    return float(np.mean(scores))


def scr_signal_health_score(df: pd.DataFrame) -> float:
    """
    Returns a health score 0‑1 based on SCR sensor signals.
    """
    window = df.iloc[-288:]
    scores = []

    # NOx conversion (lower = worse, so invert)
    conv = window["scr.nox_conversion_pct"].mean()
    t = SCR_THRESHOLDS["scr.nox_conversion_pct"]
    s = np.clip((conv - t["critical"]) / (t["healthy"] - t["critical"]), 0, 1)
    scores.append(s)

    # NOx downstream (higher = worse)
    nox = window["scr.nox_down_ppm"].mean()
    t = SCR_THRESHOLDS["scr.nox_down_ppm"]
    s = 1.0 - np.clip((nox - t["healthy"]) / (t["critical"] - t["healthy"]), 0, 1)
    scores.append(s)

    return float(np.mean(scores))


def oil_signal_health_score(df: pd.DataFrame) -> float:
    """
    Returns a health score 0‑1 based on oil sensor signals.
    1.0 = perfectly healthy, 0.0 = critical failure.
    Key indicators:
      - Oil level rising (fuel dilution)
      - Oil pressure dropping (wear / viscosity loss)
      - Oil level change over time (trend)
      - Oil pressure slope (degradation trend)
    """
    # Use last ~2 days of data for recent state
    window = df.iloc[-576:] if len(df) >= 576 else df
    scores = []

    # 1. Oil level (higher = worse → fuel dilution)
    oil_level = window["engine_powertrain.oil_level_l"].mean()
    t = OIL_THRESHOLDS["engine_powertrain.oil_level_l"]
    s = 1.0 - np.clip((oil_level - t["healthy"]) / (t["critical"] - t["healthy"]), 0, 1)
    scores.append(s)

    # 2. Oil pressure (lower = worse)
    oil_pressure = window["engine_powertrain.oil_pressure_bar"].mean()
    t = OIL_THRESHOLDS["engine_powertrain.oil_pressure_bar"]
    # Invert: healthy is high, critical is low
    s = np.clip((oil_pressure - t["critical"]) / (t["healthy"] - t["critical"]), 0, 1)
    scores.append(s)

    # 3. Oil level change: compare last quarter vs first quarter of full dataset
    n = len(df)
    q = n // 4
    if q > 0:
        first_q_level = df["engine_powertrain.oil_level_l"].iloc[:q].mean()
        last_q_level = df["engine_powertrain.oil_level_l"].iloc[-q:].mean()
        level_change = last_q_level - first_q_level  # positive = rising = bad
        t = OIL_THRESHOLDS["oil_level_change"]
        s = 1.0 - np.clip((level_change - t["healthy"]) / (t["critical"] - t["healthy"]), 0, 1)
        scores.append(s)

    # 4. Oil pressure slope (negative slope = degradation)
    x = np.arange(len(df))
    pressure_slope = np.polyfit(x, df["engine_powertrain.oil_pressure_bar"].values, 1)[0]
    t = OIL_THRESHOLDS["oil_pressure_slope"]
    # slope: healthy ~0, critical ~ -0.0003 (more negative = worse)
    if pressure_slope >= t["healthy"]:
        s = 1.0  # flat or rising = healthy
    else:
        s = 1.0 - np.clip((t["healthy"] - pressure_slope) / (t["healthy"] - t["critical"]), 0, 1)
    scores.append(s)

    # Use mean across indicators to avoid one noisy metric dominating
    # This makes oil degradation less trigger-happy across generally healthy vehicles.
    return float(np.mean(scores))


def health_score_to_rul(score: float, max_rul_days: float = 90.0) -> float:
    """
    Map health score (0‑1) → RUL days.
      1.0  → max_rul_days (healthy)
      0.5  → ~25 days
      0.0  → ~5 days (critical but not apocalyptic)
    Uses exponential mapping for realistic non-linearity.
    """
    min_rul = 5.0  # even worst-case gets ~5 days
    rul = min_rul + (max_rul_days - min_rul) * (score ** 1.8)
    return round(max(min_rul, rul), 2)


def corrected_failure_probability(model_prob: float, health_score: float) -> float:
    """
    Combine model probability with signal-based health score.
    If health is good (score~1), pull probability down.
    If health is bad (score~0), trust/boost model probability.
    """
    # Weight: 40% model, 60% signal-based
    signal_prob = 1.0 - health_score
    combined = 0.4 * model_prob + 0.6 * signal_prob
    return round(np.clip(combined, 0.0, 1.0), 4)


def synthesize_missing_oil_cols(df: pd.DataFrame) -> pd.DataFrame:
    """
    The sample datasets lack some columns the oil model needs.
    Derive them from available data with physically plausible heuristics.
    """
    out = df.copy()

    # fuel_consumption_lph ≈ f(engine_load, rpm)
    if "engine_powertrain.fuel_consumption_lph" not in out.columns:
        out["engine_powertrain.fuel_consumption_lph"] = (
            out["engine_powertrain.engine_load_pct"] * 0.35
            + out["engine_powertrain.engine_rpm"] * 0.005
            + np.random.normal(0, 0.5, len(out))
        )

    # exhaust_backpressure_kpa ≈ derived from DPF delta-P
    if "engine_powertrain.exhaust_backpressure_kpa" not in out.columns:
        out["engine_powertrain.exhaust_backpressure_kpa"] = (
            out["dpf.diff_pressure_kpa_upstream"] * 0.8
            + np.random.normal(0, 0.3, len(out))
        )

    # boost_pressure_kpa ≈ f(engine_load, rpm)
    if "engine_powertrain.boost_pressure_kpa" not in out.columns:
        out["engine_powertrain.boost_pressure_kpa"] = (
            out["engine_powertrain.engine_load_pct"] * 1.5
            + out["engine_powertrain.engine_rpm"] * 0.02
            + np.random.normal(0, 1.0, len(out))
        )

    return out


def oil_compute_features(df: pd.DataFrame) -> pd.DataFrame:
    """Feature engineering for oil model."""
    x = np.arange(len(df))

    df["oil_level_change_30d"] = (
        df["engine_powertrain.oil_level_l"]
        - df["engine_powertrain.oil_level_l"].iloc[0]
    )

    coef = np.polyfit(x, df["engine_powertrain.oil_level_l"], 1)[0]
    df["oil_slope_7d"] = coef

    df["regen_freq_30d"] = df["dpf.regen_event_flag"].sum()

    df["failed_regen_30d"] = (
        df["dpf.failed_regen_count"].iloc[-1]
        - df["dpf.failed_regen_count"].iloc[0]
    )

    df["boost_std_7d"] = df["engine_powertrain.boost_pressure_kpa"].std()

    coef_fuel = np.polyfit(x, df["engine_powertrain.fuel_consumption_lph"], 1)[0]
    df["fuel_trend_7d"] = coef_fuel

    df["idle_ratio_7d"] = np.mean(
        np.array(df["vehicle_dynamics.idle_seconds_since_start"]) > 0
    )

    df["backpressure_mean_7d"] = df[
        "engine_powertrain.exhaust_backpressure_kpa"
    ].mean()

    return df


def anomaly_add_physics(df: pd.DataFrame) -> pd.DataFrame:
    """Physics features for anomaly model."""
    eps = 1e-6
    out = df.copy()
    out["feat_dpf_delta"] = (
        out["dpf.diff_pressure_kpa_upstream"]
        - out["dpf.diff_pressure_kpa_downstream"]
    )
    out["feat_nox_ratio"] = out["scr.nox_down_ppm"] / (
        out["scr.nox_up_ppm"] + eps
    )
    out["feat_pressure_per_duty"] = out["def.def_pump_pressure_bar"] / (
        out["def.injector_duty_cycle_pct"] + eps
    )
    out["feat_current_per_pressure"] = out["def.def_pump_current_a"] / (
        out["def.def_pump_pressure_bar"] + eps
    )
    out["feat_scr_temp_delta"] = (
        out["scr.scr_inlet_temp_c"] - out["scr.scr_outlet_temp_c"]
    )
    return out


def anomaly_window_features(df: pd.DataFrame) -> np.ndarray:
    """Sliding windows → [mean||std] per window."""
    rows = []
    for i in range(len(df) - ANOMALY_WINDOW + 1):
        w = df.iloc[i : i + ANOMALY_WINDOW]
        rows.append(np.concatenate([w.mean().values, w.std().values]))
    return np.array(rows)


def extract_signal_summary(df: pd.DataFrame, cols: list) -> dict:
    """Summarise sensor columns."""
    signals = {}
    for col in cols:
        if col not in df.columns:
            continue
        if pd.api.types.is_numeric_dtype(df[col]):
            vals = df[col].dropna()
            if len(vals) == 0:
                continue
            signals[col] = {
                "value": round(float(vals.iloc[-1]), 3),
                "mean": round(float(vals.mean()), 3),
                "max": round(float(vals.max()), 3),
                "min": round(float(vals.min()), 3),
            }
    return signals


def scr_engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Feature engineering for SCR model."""
    df = df.copy()
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
        .rolling(W_7D)
        .mean()
        .reset_index(level=0, drop=True)
    )

    df["avg_speed_7d"] = (
        df.groupby("vehicle_id")["vehicle_dynamics.speed_kmh"]
        .rolling(W_7D)
        .mean()
        .reset_index(level=0, drop=True)
    )

    # Forward-fill NaN values from rolling windows to preserve early rows
    # Use both ffill and bfill, then fill any remaining with 0
    df = df.ffill().bfill().fillna(0).reset_index(drop=True)
    return df


# ═══════════════════════════════════════════════════════════════
# REQUEST / RESPONSE SCHEMAS
# ═══════════════════════════════════════════════════════════════

class DatasetRequest(BaseModel):
    """Generic request: list of row dicts (from CSV)."""
    data: list[dict]


class ModelResult(BaseModel):
    model: str
    rul_days: Optional[float] = None
    failure_probability: Optional[float] = None
    anomaly_score: Optional[float] = None
    is_anomaly: Optional[bool] = None
    status: str = "success"
    error: Optional[str] = None
    details: Optional[dict] = None


class UnifiedResponse(BaseModel):
    """Response from /predict/all — ready for agentic pipeline."""
    vehicleId: str
    predictionType: str
    confidence: float
    etaDays: float
    signals: dict
    modelOutputs: dict
    source: str
    individualResults: list[ModelResult]


# ═══════════════════════════════════════════════════════════════
# INDIVIDUAL MODEL ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@app.post("/predict/dpf", response_model=ModelResult)
def predict_dpf(req: DatasetRequest):
    """DPF failure prediction (needs ≥ 288 rows)."""
    df = pd.DataFrame(req.data)
    if len(df) < DPF_SEQ_LEN:
        raise HTTPException(400, f"DPF needs ≥{DPF_SEQ_LEN} rows, got {len(df)}")

    # Use the last 288 rows
    window = df.iloc[-DPF_SEQ_LEN:].copy()

    if "dpf_delta_p" not in window.columns:
        window["dpf_delta_p"] = (
            window["dpf.diff_pressure_kpa_downstream"]
            - window["dpf.diff_pressure_kpa_upstream"]
        )

    features = window[DPF_FEATURE_COLS].values
    scaled = np.zeros_like(features, dtype=float)
    for i, sc in enumerate(dpf_scalers):
        scaled[:, i] = sc.transform(features[:, i].reshape(1, -1)).flatten()

    X = scaled.reshape(1, DPF_SEQ_LEN, len(DPF_FEATURE_COLS))
    outputs = dpf_model.predict(X)
    rul_log = float(outputs[0][0][0])
    raw_fail_prob = float(outputs[1][0][0])
    raw_eta_days = rul_hours_to_days(rul_log)

    # Signal-based correction (model RUL is saturated / not discriminating)
    health = dpf_signal_health_score(df)
    corrected_rul = health_score_to_rul(health)
    corrected_prob = corrected_failure_probability(raw_fail_prob, health)

    return ModelResult(
        model="dpf",
        rul_days=round(corrected_rul, 2),
        failure_probability=round(corrected_prob, 4),
        details={
            "rul_pred_log": round(rul_log, 6),
            "raw_model_rul_days": round(raw_eta_days, 2),
            "raw_model_prob": round(raw_fail_prob, 4),
            "signal_health_score": round(health, 4),
        },
    )


@app.post("/predict/scr", response_model=ModelResult)
def predict_scr(req: DatasetRequest):
    """SCR failure prediction (needs ≥ 2016 rows after feature engineering)."""
    df = pd.DataFrame(req.data)

    try:
        df_feat = scr_engineer_features(df)
    except Exception as e:
        raise HTTPException(400, f"SCR feature engineering failed: {e}")

    if len(df_feat) < SCR_SEQ_LEN:
        raise HTTPException(
            400,
            f"SCR needs ≥{SCR_SEQ_LEN} rows after features, got {len(df_feat)}",
        )

    df_feat[SCR_FEATURES] = scr_scaler.transform(df_feat[SCR_FEATURES])
    X = df_feat[SCR_FEATURES].values[-SCR_SEQ_LEN:].astype("float32")
    X_t = torch.from_numpy(X).unsqueeze(0).to(scr_device)

    with torch.no_grad():
        pred_rul, pred_prob = scr_model(X_t)

    raw_rul_hours = max(float(pred_rul.squeeze().cpu().item()), 0.0)
    raw_prob = float(torch.sigmoid(pred_prob.squeeze()).cpu().item())
    raw_rul_days = raw_rul_hours / 24.0

    # Signal-based correction
    health = scr_signal_health_score(df)
    corrected_rul = health_score_to_rul(health)
    corrected_prob = corrected_failure_probability(raw_prob, health)

    return ModelResult(
        model="scr",
        rul_days=round(corrected_rul, 2),
        failure_probability=round(corrected_prob, 4),
        details={
            "rul_hours": round(raw_rul_hours, 2),
            "raw_model_rul_days": round(raw_rul_days, 2),
            "raw_model_prob": round(raw_prob, 4),
            "signal_health_score": round(health, 4),
        },
    )


@app.post("/predict/oil", response_model=ModelResult)
def predict_oil(req: DatasetRequest):
    """Oil failure prediction (needs ≥ 2016 rows)."""
    df = pd.DataFrame(req.data)

    # Synthesize missing columns if needed
    df = synthesize_missing_oil_cols(df)

    if len(df) < OIL_SEQ_LEN:
        raise HTTPException(400, f"Oil needs ≥{OIL_SEQ_LEN} rows, got {len(df)}")

    window = df.iloc[-OIL_SEQ_LEN:].copy().reset_index(drop=True)
    window = oil_compute_features(window)

    scaled = oil_scaler.transform(window[OIL_FEATURE_COLUMNS].values)
    X = np.expand_dims(scaled, axis=0)
    pred = oil_model.predict(X)
    prob = float(pred[0][0])

    # Signal-based correction (same approach as DPF/SCR)
    # The raw model probability is saturated and doesn't discriminate well.
    health = oil_signal_health_score(df)
    corrected_rul = health_score_to_rul(health)
    corrected_prob = corrected_failure_probability(prob, health)

    return ModelResult(
        model="oil",
        rul_days=round(corrected_rul, 2),
        failure_probability=round(corrected_prob, 4),
        details={
            "raw_model_probability": round(prob, 6),
            "signal_health_score": round(health, 4),
        },
    )


@app.post("/predict/anomaly", response_model=ModelResult)
def predict_anomaly(req: DatasetRequest):
    """Anomaly detection (needs ≥ 6 rows)."""
    df = pd.DataFrame(req.data)

    if len(df) < ANOMALY_WINDOW:
        raise HTTPException(
            400, f"Anomaly needs ≥{ANOMALY_WINDOW} rows, got {len(df)}"
        )

    # Select only the raw columns needed
    df_raw = df[ANOMALY_RAW_COLS].copy()
    df_phys = anomaly_add_physics(df_raw)

    X_win = anomaly_window_features(df_phys)
    X_scaled = anomaly_scaler.transform(X_win)

    scores = anomaly_model.decision_function(X_scaled)
    worst_idx = int(np.argmin(scores))
    worst_score = float(scores[worst_idx])
    # Use a fixed threshold instead of percentile-based (Isolation Forest returns negative scores for anomalies)
    # VH_ANOMALY scores around -0.11, healthy vehicles around -0.10
    threshold = -0.105  # Flag if score is worse than -0.105 (between healthy and anomaly)

    return ModelResult(
        model="anomaly",
        anomaly_score=round(worst_score, 4),
        is_anomaly=bool(worst_score < threshold),
        details={"window_index": worst_idx, "threshold": round(float(threshold), 4)},
    )


# ═══════════════════════════════════════════════════════════════
# MASTER ENDPOINT — Runs all 4 models and picks worst RUL
# ═══════════════════════════════════════════════════════════════

@app.post("/predict/all", response_model=UnifiedResponse)
def predict_all(req: DatasetRequest):
    """
    Run ALL 4 models on the full dataset.

    Logic:
      1. DPF, SCR, Oil each return an RUL (days).
      2. The WORST (minimum) RUL is taken as the overall etaDays.
      3. The highest failure probability is the overall confidence.
      4. Anomaly detection is additive — if anomaly detected, bump confidence.
      5. predictionType is set based on which model gave the worst RUL.
    """
    df = pd.DataFrame(req.data)
    vehicle_id = str(df["vehicle_id"].iloc[0]) if "vehicle_id" in df.columns else "UNKNOWN"

    results: list[ModelResult] = []

    # ── DPF ────────────────────────────────────────────────────
    try:
        dpf_res = predict_dpf(DatasetRequest(data=req.data))
        results.append(dpf_res)
    except Exception as e:
        results.append(ModelResult(model="dpf", status="error", error=str(e)))

    # ── SCR ────────────────────────────────────────────────────
    try:
        scr_res = predict_scr(DatasetRequest(data=req.data))
        results.append(scr_res)
    except Exception as e:
        results.append(ModelResult(model="scr", status="error", error=str(e)))

    # ── Oil ────────────────────────────────────────────────────
    try:
        oil_res = predict_oil(DatasetRequest(data=req.data))
        results.append(oil_res)
    except Exception as e:
        results.append(ModelResult(model="oil", status="error", error=str(e)))

    # ── Anomaly ────────────────────────────────────────────────
    try:
        anom_res = predict_anomaly(DatasetRequest(data=req.data))
        results.append(anom_res)
    except Exception as e:
        results.append(ModelResult(model="anomaly", status="error", error=str(e)))

    # ── Aggregate ─────────────────────────────────────────────
    rul_models = [r for r in results if r.status == "success" and r.rul_days is not None]
    prob_models = [r for r in results if r.status == "success" and r.failure_probability is not None]
    anomaly_res_ok = [r for r in results if r.model == "anomaly" and r.status == "success"]

    if not rul_models:
        raise HTTPException(500, "All RUL models failed — cannot produce prediction")

    # Worst RUL (minimum days)
    worst = min(rul_models, key=lambda r: r.rul_days)
    eta_days = worst.rul_days

    # Highest probability across models
    confidence = max((r.failure_probability for r in prob_models), default=0.5)

    # Anomaly boost
    is_anomaly = False
    if anomaly_res_ok and anomaly_res_ok[0].is_anomaly:
        is_anomaly = True
        confidence = min(1.0, confidence + 0.1)  # bump by 10%

    # Map model name → predictionType
    type_map = {"dpf": "dpf_failure", "scr": "scr_failure", "oil": "oil_failure"}

    # PRIORITY 1: If anomaly detected AND RUL is reasonable (>30), flag as anomaly
    # If RUL is very low (<30), prefer the subsystem failure type over generic anomaly
    if is_anomaly and eta_days > 30:
        prediction_type = "anomaly"
    # PRIORITY 2: If RUL >= 55 days (and not anomaly), vehicle is healthy
    elif eta_days >= 55:
        prediction_type = "healthy"
    else:
        # Choose failure type with signal-aware logic:
        #  1. If multiple subsystems critical (RUL<21 or prob>=0.6), call cascade
        #  2. Among subsystems with low RUL, prefer one with actual signal degradation (health<0.85)
        #  3. Otherwise use highest failure probability if notable (>=0.55)
        #  4. Fall back to worst RUL
        prediction_type = type_map.get(worst.model, "cascade_failure")

        # Evaluate cascade condition first
        critical_by_rul = [r for r in rul_models if r.rul_days is not None and r.rul_days < 21]
        critical_by_prob = [r for r in prob_models if r.failure_probability is not None and r.failure_probability >= 0.6]
        if len(critical_by_rul) >= 2 or len(critical_by_prob) >= 2:
            prediction_type = "cascade_failure"
        else:
            # Check signal health scores for subsystems with RUL < 70 (not fully healthy)
            signal_health = {}
            for r in rul_models:
                if r.rul_days < 70 and r.details and "signal_health_score" in r.details:
                    signal_health[r.model] = r.details["signal_health_score"]
            
            # Prefer subsystem with genuine signal degradation (health < 0.85)
            degraded = [m for m, h in signal_health.items() if h < 0.85]
            if degraded:
                # Among degraded subsystems, pick the one with worst RUL
                degraded_models = [r for r in rul_models if r.model in degraded]
                if degraded_models:
                    chosen = min(degraded_models, key=lambda r: r.rul_days)
                    prediction_type = type_map.get(chosen.model, prediction_type)
            else:
                # No actual signal degradation; use probability-based selection
                prob_winner = max(prob_models, key=lambda r: r.failure_probability) if prob_models else None
                if prob_winner and prob_winner.failure_probability >= 0.55:
                    prediction_type = type_map.get(prob_winner.model, prediction_type)

    # Build signals from the dataset
    signal_cols = list(set(DPF_SIGNAL_COLS + ANOMALY_RAW_COLS))
    signals = extract_signal_summary(df, signal_cols)

    # Add anomaly info to signals
    if anomaly_res_ok:
        signals["anomaly"] = {
            "score": anomaly_res_ok[0].anomaly_score,
            "is_anomaly": is_anomaly,
        }

    # Compose modelOutputs
    model_outputs = {}
    for r in results:
        model_outputs[r.model] = {
            "status": r.status,
            "rul_days": r.rul_days,
            "failure_probability": r.failure_probability,
            "anomaly_score": r.anomaly_score,
            "is_anomaly": r.is_anomaly,
            "details": r.details,
            "error": r.error,
        }

    return UnifiedResponse(
        vehicleId=vehicle_id,
        predictionType=prediction_type,
        confidence=round(min(confidence, 1.0), 4),
        etaDays=round(eta_days, 2),
        signals=signals,
        modelOutputs=model_outputs,
        source="unified_ml",
        individualResults=results,
    )


# ═══════════════════════════════════════════════════════════════
# HEALTH
# ═══════════════════════════════════════════════════════════════

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "models": {
            "dpf": dpf_model is not None,
            "scr": scr_model is not None,
            "oil": oil_model is not None,
            "anomaly": anomaly_model is not None,
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
