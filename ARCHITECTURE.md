# 🏗️ CarVrooom2 - Architecture Blueprint

> **Production-Grade Microservices Architecture**
> This document serves as the master blueprint for the entire system.

---

## 🎯 Core Principles

### 1️⃣ **True Microservices Independence**
- ✅ Each service is **100% independently deployable**
- ✅ Zero code-level dependencies between services
- ✅ Each service has its own database
- ✅ Communication ONLY via HTTP REST or Message Broker (Redis Streams)

### 2️⃣ **Accept Code Duplication Over Coupling**
- Event schemas (Pydantic models) are **duplicated** in each service
- Logging utilities are **copied** to each service
- Database utilities are **per-service**
- **Independence > DRY principle**

### 3️⃣ **Event-Driven + REST Hybrid**
- **Async workflows** → Redis Streams (fire-and-forget, decoupling)
- **Sync queries** → Direct HTTP REST calls (immediate response needed)

---

## 📊 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React)                            │
│                    http://localhost:3000                             │
└────────────────┬─────────────────────────────────────────────────────┘
                 │ (HTTP REST calls)
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    NGINX REVERSE PROXY (Optional)                    │
│                    http://localhost:80                               │
└─────┬───────────────────────────────────────────────────────────────┘
      │
      ├──────────────────────────────────────────────────────────────┐
      │                                                              │
      ▼                                                              ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Ingestion   │  │   Health     │  │    Agent     │  │    Alert     │
│  Service     │  │   Service    │  │   Service    │  │   Service    │
│  :8001       │  │   :8002      │  │   :8003      │  │   :8004      │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │                 │
       │                 │                 │                 │
       └─────────────────┴─────────────────┴─────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  REDIS STREAMS   │
                    │  Message Broker  │
                    │  :6379           │
                    └──────────────────┘

┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Scheduling   │  │  Warranty    │  │  Analytics   │
│  Service     │  │   Service    │  │   Service    │
│  :8005       │  │   :8006      │  │   :8007      │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       └─────────────────┴─────────────────┘
                        │
                        ▼
              ┌──────────────────────┐
              │   POSTGRESQL         │
              │   Multiple Databases │
              │   :5432              │
              └──────────────────────┘
              
              ┌──────────────────────┐
              │  GOOGLE GEMINI API   │
              │  (External)          │
              └──────────────────────┘
```

---

## 🔧 Microservices Overview

### **1. ingestion-service** (Port 8001)
**Purpose:** Ingest vehicle telemetry from multiple protocols (CAN bus, OBD-II, IoT)

**Responsibilities:**
- Receive raw telemetry data via REST API
- Validate and normalize data using protocol-specific adapters
- Publish `vehicle.telemetry.received` event to Redis Streams
- Store raw telemetry in `ingestion_db` for audit trail

**Database:** `ingestion_db`
**Key Events Published:** `vehicle.telemetry.received`
**Key Events Consumed:** None

---

### **2. health-service** (Port 8002)
**Purpose:** Compute component-level health scores and Remaining Useful Life (RUL)

**Responsibilities:**
- Consume `vehicle.telemetry.received` events
- Calculate health scores using ML models or rule-based algorithms
- Compute RUL (kilometers and days) for critical components
- Detect significant health changes
- Publish `vehicle.health.changed`, `component.degraded` events
- Expose REST API for querying vehicle health

**Database:** `health_db`
**Key Events Published:** `vehicle.health.computed`, `vehicle.health.changed`, `component.degraded`
**Key Events Consumed:** `vehicle.telemetry.received`

**Special Folders:**
- `ml/models/` - Trained ML models (.pkl files) or rule-based algorithms

---

### **3. agent-service** (Port 8003)
**Purpose:** AI-powered decision orchestration using LangGraph agents

**Responsibilities:**
- Consume `vehicle.health.changed`, `component.degraded` events
- Master Orchestrator Agent routes to appropriate Worker Agent
- Worker Agents (Engine, Brake, Transmission) analyze using LLM
- Generate recommendations and reasoning
- Publish `agent.decision.made` events
- Expose REST API for manual decision requests

**Database:** `agent_db` (stores decision history, agent state)
**Key Events Published:** `agent.decision.made`, `agent.escalation`
**Key Events Consumed:** `vehicle.health.changed`, `component.degraded`

**Special Folders:**
- `agents/master_agent.py` - LangGraph orchestrator
- `agents/workers/` - Specialized worker agents

---

### **4. alert-service** (Port 8004)
**Purpose:** Multi-channel alert generation and delivery

**Responsibilities:**
- Consume `agent.decision.made`, `component.critical` events
- Generate alerts with appropriate severity levels
- Deliver via multiple channels (Email, SMS, Push notifications)
- Track alert acknowledgment status
- Handle escalation workflows
- Expose REST API for alert management

**Database:** `alert_db`
**Key Events Published:** `alert.created`, `alert.acknowledged`, `alert.escalated`
**Key Events Consumed:** `agent.decision.made`, `component.degraded`, `component.critical`

**Special Folders:**
- `channels/email.py` - Email delivery (SendGrid)
- `channels/sms.py` - SMS delivery (Twilio)
- `channels/push.py` - Push notifications (FCM)

---

### **5. scheduling-service** (Port 8005)
**Purpose:** Service appointment scheduling and optimization

**Responsibilities:**
- Consume `alert.created` events for critical issues
- Manage technician availability and calendars
- Check parts inventory availability
- Optimize appointment scheduling using OR-Tools
- Expose REST API for booking management
- Send calendar invites

**Database:** `scheduling_db`
**Key Events Published:** `appointment.scheduled`, `appointment.cancelled`
**Key Events Consumed:** `alert.created`, `agent.decision.made`

**Special Folders:**
- `optimization/` - Scheduling algorithms (OR-Tools, constraint solving)

---

### **6. warranty-service** (Port 8006)
**Purpose:** Warranty claim validation and fraud detection

**Responsibilities:**
- Assess warranty eligibility (coverage period, mileage limits)
- Validate failure authenticity using telemetry correlation
- Detect fraudulent claims using vector similarity (ChromaDB)
- Generate evidence packs (PDF reports with charts)
- Use Gemini Pro for complex fraud analysis
- Expose REST API for claim submission and status

**Database:** `warranty_db`
**Key Events Published:** `warranty.claim.validated`, `warranty.claim.rejected`
**Key Events Consumed:** `component.degraded` (for pre-claim analysis)

**Special Folders:**
- `fraud/detector.py` - Fraud detection using ChromaDB + Gemini
- `fraud/vector_store/` - ChromaDB embeddings

---

### **7. analytics-service** (Port 8007)
**Purpose:** Fleet-wide analytics, dashboards, and RBAC

**Responsibilities:**
- Aggregate data from all services via REST API calls
- Calculate fleet-level metrics (health score, cost avoidance)
- Enforce Role-Based Access Control (Fleet Manager, Technician, Owner)
- Generate exportable reports (CSV, PDF)
- Audit logging for compliance
- Expose REST API for dashboard data

**Database:** `analytics_db`
**Key Events Published:** None
**Key Events Consumed:** All events (for audit logging)

**Special Folders:**
- `dashboards/fleet.py` - Fleet-level aggregations
- `dashboards/owner.py` - Per-vehicle owner views

---

## 📡 Event Flow Examples

### **Flow 1: Telemetry → Health → Agent → Alert**

```
1. Vehicle sends telemetry → ingestion-service (REST API)
2. ingestion-service validates & publishes event:
   Event: vehicle.telemetry.received
   
3. health-service consumes event, computes health, publishes:
   Event: vehicle.health.changed (if significant change)
   
4. agent-service consumes event, LangGraph evaluates, publishes:
   Event: agent.decision.made
   
5. alert-service consumes event, generates alert, publishes:
   Event: alert.created
   
6. scheduling-service consumes critical alerts, auto-books appointment
```

### **Flow 2: Warranty Claim Submission**

```
1. Owner submits claim → warranty-service (REST API)
2. warranty-service calls health-service REST API:
   GET http://health-service:8002/api/v1/health/{vehicle_id}/history
3. warranty-service analyzes telemetry correlation
4. Uses Gemini Pro for fraud detection
5. Returns validation result synchronously
```

---

## 🗄️ Database Strategy

### **Per-Service Databases**
Each service has its own PostgreSQL database for complete independence:

```
PostgreSQL Instance (Port 5432)
├── ingestion_db       (telemetry records)
├── health_db          (health scores, RUL predictions)
├── agent_db           (decision history, agent state)
├── alert_db           (alerts, acknowledgments)
├── scheduling_db      (appointments, technician schedules)
├── warranty_db        (claims, evidence packs)
└── analytics_db       (aggregated metrics, audit logs)
```

**Why separate databases?**
- ✅ Data ownership per service
- ✅ Independent scaling
- ✅ No accidental cross-service queries
- ✅ Schema migrations are per-service

---

## 🔐 Authentication & Authorization

### **JWT for Users (Frontend → Services)**
```
Frontend login → analytics-service /auth/login
  ↓
Returns JWT with claims: { user_id, role, vehicle_ids[] }
  ↓
Frontend includes JWT in all requests:
  Authorization: Bearer <JWT>
  ↓
Each service validates JWT independently (shared secret in .env)
```

### **API Keys for Service-to-Service**
```
alert-service → scheduling-service
  ↓
X-API-Key: alert_service_api_key_xyz123
  ↓
scheduling-service validates API key in middleware
```

---

## 📦 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Backend Framework** | FastAPI | 0.109+ |
| **Language** | Python | 3.11+ |
| **Message Broker** | Redis Streams | 7.0+ |
| **Database** | PostgreSQL | 15+ |
| **Cache** | Redis | 7.0+ |
| **ORM** | SQLAlchemy | 2.0+ (async) |
| **LLM** | Google Gemini API | 1.5 Flash/Pro |
| **Agent Framework** | LangGraph + LangChain | Latest |
| **Vector DB** | ChromaDB | Latest (embedded) |
| **Frontend** | React + Vite | 18+ / 5+ |
| **Containerization** | Docker + Compose | Latest |
| **Monitoring** | Prometheus + Grafana | Latest |

---

## 🚀 Deployment Architecture

### **Local Development (docker-compose)**
```
docker-compose up
  ↓
All 7 services + PostgreSQL + Redis + Nginx + Grafana
```

### **Production (Kubernetes - Future)**
```
Each service as a Deployment
  ├── Horizontal Pod Autoscaler (HPA)
  ├── Service (ClusterIP)
  ├── Ingress (NGINX)
  └── ConfigMaps + Secrets
```

---

## 📂 Folder Structure (Root Level)

```
CarVrooom2/
├── services/
│   ├── ingestion-service/      # Complete, independently deployable
│   ├── health-service/         # Complete, independently deployable
│   ├── agent-service/          # Complete, independently deployable
│   ├── alert-service/          # Complete, independently deployable
│   ├── scheduling-service/     # Complete, independently deployable
│   ├── warranty-service/       # Complete, independently deployable
│   └── analytics-service/      # Complete, independently deployable
│
├── frontend/                   # React dashboard
├── infrastructure/             # Docker, monitoring configs
├── scripts/                    # Seed data, utilities
├── docs/                       # Documentation
├── .gitignore
├── README.md                   # Quick start guide
├── ARCHITECTURE.md             # This file
└── docker-compose.yml          # Local orchestration
```

---

## ✅ Success Criteria

A service is **truly independent** if:
1. ✅ You can `cd` into its folder
2. ✅ Run `docker build .` successfully
3. ✅ Deploy it without any other service code
4. ✅ It can run (even in degraded mode) without other services

**Test:** Delete all other service folders. Can `ingestion-service` still build? YES ✅

---

## 🔄 Next Steps

1. Implement each service following the blueprint in `services/{service}/IMPLEMENTATION.md`
2. Create docker-compose.yml with all dependencies
3. Set up monitoring (Prometheus + Grafana)
4. Build frontend dashboard
5. Write integration tests
6. Deploy to staging environment
