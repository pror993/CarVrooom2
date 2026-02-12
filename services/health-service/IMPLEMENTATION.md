# 🏥 Health Service

> **Port:** 8002  
> **Database:** `health_db`  
> **Role:** Component Health Analysis & RUL Prediction

---

## 🎯 Purpose

The Health Service is the **diagnostic brain** of the platform. It continuously monitors vehicle component health by analyzing telemetry data, calculates degradation trends, and predicts when components will fail (Remaining Useful Life - RUL).

Think of it as a **digital mechanic** that watches every component 24/7.

---

## 📋 Key Responsibilities

1. **Monitor** incoming telemetry events from the ingestion service
2. **Analyze** component health using ML models or rule-based algorithms
3. **Calculate** health scores (0.0 - 1.0) for critical components
4. **Predict** Remaining Useful Life (in kilometers and days)
5. **Detect** significant health degradation and trigger alerts
6. **Store** health history for trend analysis
7. **Provide** REST API for querying vehicle/component health

---

## 🔄 Event Interactions

### **Consumes**
- `vehicle.telemetry.received` - Triggered by new telemetry data

### **Publishes**
- `vehicle.health.computed` - After each health calculation
- `vehicle.health.changed` - When health score changes significantly
- `component.degraded` - When component crosses safety threshold
- `component.critical` - When component requires immediate attention

---

## 📡 API Endpoints

```
GET    /api/v1/health/{vehicle_id}              # Current health status
GET    /api/v1/health/{vehicle_id}/component/{type}  # Specific component
GET    /api/v1/health/{vehicle_id}/history      # Health timeline
POST   /api/v1/health/compute                   # Manual trigger (admin)
GET    /health                                   # Service health
```

### Example Response
```json
GET /api/v1/health/V001
{
  "vehicle_id": "V001",
  "overall_health_score": 0.72,
  "components": [
    {
      "type": "engine",
      "health_score": 0.65,
      "status": "GOOD",
      "rul_km": 8500,
      "rul_days": 180,
      "confidence": 0.85,
      "risk_factors": ["High temperature operating conditions"],
      "recommended_actions": ["Schedule oil change within 1000km"]
    },
    {
      "type": "brakes",
      "health_score": 0.89,
      "status": "EXCELLENT",
      "rul_km": 15000,
      "rul_days": 320
    }
  ],
  "last_computed_at": "2026-01-28T22:15:00Z"
}
```

---

## 🏗️ Folder Structure

```
health-service/
├── config.py
├── main.py
├── requirements.txt
├── Dockerfile
│
├── api/v1/
│   └── endpoints.py
│
├── services/
│   ├── health_calculator.py    # Core health computation
│   └── rul_predictor.py        # RUL prediction logic
│
├── models/
│   ├── domain.py               # ComponentHealth, HealthScore
│   ├── schemas.py              # API schemas
│   └── events.py               # Event definitions
│
├── ml/                         # ML/AI models
│   ├── models/
│   │   ├── engine_rul.pkl      # Trained models (or rule-based)
│   │   ├── brake_health.pkl
│   │   └── transmission.pkl
│   └── inference.py            # Model loading & prediction
│
├── events/
│   ├── consumers.py            # Listen to telemetry events
│   └── publishers.py           # Publish health events
│
├── db/
│   ├── models.py               # Health records, history
│   └── repositories.py
│
├── utils/
│   ├── logging.py
│   ├── redis_client.py
│   └── database.py
│
└── tests/
    ├── test_health_calculator.py
    └── test_rul_predictor.py
```

---

## 🔧 Special Components

### **Component Analyzers**
Each component has specialized health logic:

- **Engine Health** - Monitor temp, RPM, oil pressure, coolant
- **Brake Health** - Track brake pressure, pad wear, ABS activations
- **Transmission Health** - Analyze shift patterns, temperature
- **Battery Health** - Voltage trends, charging cycles
- **Suspension Health** - Vibration patterns, ride quality metrics

### **Health Calculation Methods**

**Option 1: Rule-Based (Prototype)**
```
if engine_temp > 110°C for 30 mins:
    health_score -= 0.1
    
if oil_pressure < 20 psi:
    health_score -= 0.2
```

**Option 2: ML-Based (Production)**
```
Use LSTM neural networks trained on historical failure data
Input: Last 100 telemetry records
Output: Health score + RUL prediction
```

---

## 🔗 Dependencies

### External Services Called
- None (operates independently)

### Infrastructure Dependencies
- **PostgreSQL** - `health_db` 
- **Redis Streams** - Event consumption/publishing
- **ML Models** - Stored in `ml/models/` folder

---

## ⚙️ Configuration

```env
SERVICE_NAME=health-service
PORT=8002
DATABASE_URL=postgresql+asyncpg://user:pass@postgres:5432/health_db
REDIS_URL=redis://redis:6379
HEALTH_CHECK_INTERVAL_SECONDS=60
DEGRADATION_THRESHOLD=0.3       # Trigger alert below this
CRITICAL_THRESHOLD=0.2          # Critical alert
```

---

## 🎯 Success Metrics

- **Accuracy** - 90%+ RUL prediction accuracy (within ±500km)
- **Latency** - Health computed within 5 seconds of telemetry
- **Coverage** - All critical components monitored
- **False Positives** - <5% (avoid alert fatigue)

---

## 🧠 Health Score Calculation

### Scale
- **0.8 - 1.0** = EXCELLENT (green)
- **0.6 - 0.8** = GOOD (green)
- **0.4 - 0.6** = FAIR (yellow)
- **0.2 - 0.4** = POOR (orange)
- **0.0 - 0.2** = CRITICAL (red)

### Factors
- Recent telemetry trends
- Operating conditions (harsh/normal)
- Component age/mileage
- Historical failure patterns
- Manufacturer specifications

---

## 🚀 Quick Start

```bash
cd services/health-service
pip install -r requirements.txt
cp .env.example .env

# Run service
uvicorn main:app --reload --port 8002

# Test health computation
curl http://localhost:8002/api/v1/health/V001
```

---

## 📝 Notes

- Health scores are **computed asynchronously** (don't block ingestion)
- Stores **30 days of health history** per vehicle
- Can trigger **re-computation** if model is updated
- Supports **batch processing** for fleet-wide health reports
- Health degradation events are **rate-limited** (max 1 per hour per vehicle)
