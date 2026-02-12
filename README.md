# CarVrooom

AI-powered predictive maintenance platform for commercial vehicle fleets. Predicts component failures, diagnoses root causes, schedules service, and communicates with fleet owners all orchestrated by an intelligent agentic layer.

---

## Quick Start

### Prerequisites

- Node.js v18+
- Python 3.9+
- MongoDB


---

### 1. ML Models API

```bash
cd models
pip install -r requirements.txt
uvicorn unified_api:app --host 0.0.0.0 --port 8000
```

---

### 2. Backend Server

```bash
cd server
npm install
npm run dev
```

---

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Project Structure

```
CarVrooom2/
├── models/                     # ML Prediction Layer (FastAPI)
│   ├── unified_api.py          # Unified prediction gateway
│   ├── dpf_prediction_api.py   # DPF failure prediction
│   ├── scr_prediction_api.py   # SCR failure prediction
│   ├── oil_prediction_api.py   # Oil degradation prediction
│   └── anomaly_detector_api.py # System anomaly detection
│
├── server/                     # Backend + Agentic Layer (Node.js)
│   ├── server.js               # Express entry point
│   ├── pipelineScheduler.js    # Simulation scheduler
│   ├── agents/                 # Agentic orchestration
│   ├── models/                 # Database schemas
│   └── routes/                 # API endpoints
│
└── frontend/                   # Dashboard (React + Vite)
    └── src/
        ├── pages/              # Dashboard views
        ├── components/         # UI components
        └── services/           # API + WebSocket
```

---

## Architecture

**Predictive Layer** — DPF, SCR, Oil, and Anomaly models run in parallel, followed by rule-based cascade detection.

**Agentic Layer** — Master Agent classifies severity and invokes Diagnostic, Scheduling, and Communication agents. UEBA Monitor logs all executions.

**Case Lifecycle** — RECEIVED → ORCHESTRATING → PROCESSED → AWAITING_APPROVAL → CONFIRMED

---

