# 🚗 Ingestion Service

> **Port:** 8001  
> **Database:** `ingestion_db`  
> **Role:** Vehicle Telemetry Intake & Normalization

---

## 🎯 Purpose

The Ingestion Service is the **entry point** for all vehicle telemetry data. It receives raw data from multiple protocols (CAN bus, OBD-II, IoT sensors), validates it, normalizes it into a common format, and broadcasts it to the rest of the system.

Think of it as the **data gateway** - ensuring only clean, validated data enters the platform.

---

## 📋 Key Responsibilities

1. **Receive** telemetry data via REST API from vehicles/IoT devices
2. **Validate** incoming data (schema validation, VIN checks, timestamp verification)
3. **Normalize** data from different protocols into a unified format
4. **Store** raw and normalized telemetry in database for audit trail
5. **Publish** events to message broker for other services to consume
6. **Provide** REST API for querying historical telemetry

---

## 🔄 Event Interactions

### **Consumes**
- None (this is the entry point)

### **Publishes**
- `vehicle.telemetry.received` - Emitted after successful ingestion
- `vehicle.telemetry.validation_failed` - Emitted when data is invalid

---

## 📡 API Endpoints

### Core Endpoints
```
POST   /api/v1/ingest                    # Ingest telemetry data
GET    /api/v1/vehicles/{id}/latest      # Get latest telemetry
GET    /api/v1/vehicles/{id}/history     # Get telemetry history
GET    /health                            # Health check
GET    /ready                             # Readiness check
```

### Example Request
```json
POST /api/v1/ingest
{
  "vehicle_id": "V001",
  "vin": "1HGBH41JXMN109186",
  "timestamp": "2026-01-28T22:00:00Z",
  "protocol": "OBD2",
  "data": {
    "PID_0C": "3200",    // RPM
    "PID_05": "95",      // Engine temp
    "PID_0D": "80"       // Speed
  }
}
```

---

## 🏗️ Folder Structure

```
ingestion-service/
├── config.py              # Environment configuration
├── main.py                # FastAPI app entry point
├── requirements.txt       # Dependencies
├── Dockerfile            # Container definition
├── .env.example          # Environment template
│
├── api/
│   └── v1/
│       └── endpoints.py  # REST API routes
│
├── services/
│   └── ingestion_logic.py  # Business logic
│
├── models/
│   ├── domain.py         # Domain models
│   ├── schemas.py        # API schemas
│   └── events.py         # Event definitions
│
├── adapters/             # Protocol parsers
│   ├── obd2_adapter.py
│   ├── canbus_adapter.py
│   └── iot_adapter.py
│
├── events/
│   └── publishers.py     # Publish to Redis Streams
│
├── db/
│   ├── models.py         # Database models
│   └── repositories.py   # Data access
│
├── utils/
│   ├── logging.py
│   ├── redis_client.py
│   └── database.py
│
└── tests/
    └── test_api.py
```

---

## 🔧 Special Components

### **Adapters (Protocol Normalizers)**
Each adapter converts protocol-specific data into a unified format:

- **OBD2 Adapter** - Parses OBD-II PIDs (e.g., `0x0C` → `rpm`)
- **CAN Bus Adapter** - Decodes CAN message frames
- **IoT Adapter** - Handles generic JSON sensor data

### **Database Tables**
- `telemetry_records` - Stores all normalized telemetry
- `vehicles` - Vehicle metadata cache

---

## 🔗 Dependencies

### External Services Called
- None (this service doesn't call other microservices)

### Infrastructure Dependencies
- **PostgreSQL** - `ingestion_db` database
- **Redis Streams** - For event publishing

---

## ⚙️ Configuration

### Required Environment Variables
```env
SERVICE_NAME=ingestion-service
PORT=8001
DATABASE_URL=postgresql+asyncpg://user:pass@postgres:5432/ingestion_db
REDIS_URL=redis://redis:6379
LOG_LEVEL=INFO
```

---

## 🎯 Success Metrics

- **Throughput** - Should handle 1000+ telemetry records/second
- **Latency** - <100ms from ingestion to event published
- **Accuracy** - 100% data validation (no invalid data in DB)
- **Availability** - 99.9% uptime (critical entry point)

---

## 🚀 Quick Start

```bash
# Navigate to service
cd services/ingestion-service

# Install dependencies
pip install -r requirements.txt

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Run service
uvicorn main:app --reload --port 8001
```

---

## 🧪 Testing Strategy

- **Unit Tests** - Adapter logic, validation rules
- **Integration Tests** - Database operations, Redis publishing
- **API Tests** - Endpoint contracts
- **Load Tests** - 1000 req/sec sustained

---

## 📝 Notes

- This service is **stateless** - can be horizontally scaled
- Telemetry data is **immutable** (insert-only, no updates)
- Failed ingestions are logged but don't block the API response
- Supports **batch ingestion** for high-throughput scenarios (future)
