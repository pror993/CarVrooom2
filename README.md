# 🚗 CarVrooom2 - Agentic AI Predictive Maintenance Platform

> **Production-Grade Microservices Architecture** for Vehicle Fleet Management

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-009688.svg)](https://fastapi.tiangolo.com)
[![LangGraph](https://img.shields.io/badge/LangGraph-Latest-FF6B6B.svg)](https://github.com/langchain-ai/langgraph)

---

## 🎯 What Is This?

**CarVrooom2** is an enterprise-grade predictive maintenance platform that uses **AI agents**, **real-time telemetry analysis**, and **event-driven microservices** to predict vehicle failures before they happen, optimize service schedules, and automate warranty claims.

### Key Capabilities

✅ **Predictive Maintenance** - ML-powered RUL (Remaining Useful Life) calculations  
✅ **AI Agents** - LangGraph orchestrator with specialized worker agents  
✅ **Multi-Channel Alerts** - Email, SMS, Push notifications  
✅ **Smart Scheduling** - OR-Tools optimization for appointments  
✅ **Warranty Intelligence** - Fraud detection using telemetry + LLM  
✅ **Fleet Analytics** - Real-time dashboards with RBAC  
✅ **True Microservices** - Each service is independently deployable  

---

## 🏗️ Architecture Overview

### System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     REACT FRONTEND                                │
│                  (Owner + Fleet Manager Views)                    │
└────────────────────────┬─────────────────────────────────────────┘
                         │ HTTP REST
                         ▼
        ┌────────────────────────────────────────┐
        │        NGINX (Optional Proxy)          │
        └────────────────┬───────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
┌─────────────────┐            ┌─────────────────┐
│  Microservices  │            │  Message Broker │
│                 │            │   (Redis        │
│ 7 Independent   │◄──────────►│   Streams)      │
│ Services        │            │                 │
└─────────────────┘            └─────────────────┘
```

### 7 Microservices

| Service | Port | Purpose | Database |
|---------|------|---------|----------|
| **ingestion-service** | 8001 | Telemetry intake & normalization | `ingestion_db` |
| **health-service** | 8002 | Component health & RUL prediction | `health_db` |
| **agent-service** | 8003 | AI-powered decision orchestration | `agent_db` |
| **alert-service** | 8004 | Multi-channel alerts & escalation | `alert_db` |
| **scheduling-service** | 8005 | Appointment optimization | `scheduling_db` |
| **warranty-service** | 8006 | Warranty validation & fraud detection | `warranty_db` |
| **analytics-service** | 8007 | Fleet dashboards & RBAC | `analytics_db` |

---

## 📂 Project Structure

```
CarVrooom2/
├── services/                        # 7 microservices (all independent)
│   ├── ingestion-service/
│   ├── health-service/
│   ├── agent-service/
│   ├── alert-service/
│   ├── scheduling-service/
│   ├── warranty-service/
│   └── analytics-service/
│
├── frontend/                        # React dashboard
│   └── src/
│
├── infrastructure/                  # Docker, monitoring
│   ├── docker/
│   └── monitoring/
│
├── scripts/                         # Utilities
│   └── seed/
│
├── docs/                            # Documentation
│   ├── architecture/
│   └── api/
│
├── ARCHITECTURE.md                  # System design document
├── README.md                        # This file
└── docker-compose.yml               # Local dev orchestration (future)
```

---

## 🚀 Quick Start

### Prerequisites

- **Docker** & **Docker Compose** (v2.0+)
- **Python** 3.11+ (for local development)
- **Node.js** 18+ (for frontend)
- **Google Gemini API Key** ([Get one here](https://makersuite.google.com/app/apikey))

### Option 1: Run Everything with Docker (Recommended)

```bash
# Clone the repository
git clone <repo-url>
cd CarVrooom2

# Create environment file
cp infrastructure/.env.example infrastructure/.env
# Edit .env and add your GEMINI_API_KEY

# Start all services
docker-compose up --build

# Services will be available at:
# Frontend:     http://localhost:3000
# Ingestion:    http://localhost:8001
# Health:       http://localhost:8002
# Agent:        http://localhost:8003
# Alert:        http://localhost:8004
# Scheduling:   http://localhost:8005
# Warranty:     http://localhost:8006
# Analytics:    http://localhost:8007
```

### Option 2: Run Individual Service (Development)

```bash
# Example: Run health-service locally
cd services/health-service

# Install dependencies
pip install -r requirements.txt

# Set up environment
cp .env.example .env
# Edit .env with your config

# Run service
uvicorn main:app --reload --port 8002

# View API docs
open http://localhost:8002/docs
```

---

## 📚 Documentation

### Service Documentation

Each service has its own `IMPLEMENTATION.md` file:

- 📄 [Ingestion Service](services/ingestion-service/IMPLEMENTATION.md) - Telemetry intake
- 📄 [Health Service](services/health-service/IMPLEMENTATION.md) - RUL prediction
- 📄 [Agent Service](services/agent-service/IMPLEMENTATION.md) - AI decision-making
- 📄 [Alert Service](services/alert-service/IMPLEMENTATION.md) - Notifications
- 📄 [Scheduling Service](services/scheduling-service/IMPLEMENTATION.md) - Appointments
- 📄 [Warranty Service](services/warranty-service/IMPLEMENTATION.md) - Claims processing
- 📄 [Analytics Service](services/analytics-service/IMPLEMENTATION.md) - Dashboards

### System Documentation

- 🏗️ [Architecture Guide](ARCHITECTURE.md) - System design, event flows
- 📡 API Contracts - (TODO: docs/api/)
- 🚀 Deployment Guide - (TODO: docs/deployment/)

---

## 🛠️ Technology Stack

### Backend
- **Framework**: FastAPI 0.109+
- **Language**: Python 3.11+
- **Database**: PostgreSQL 15+ (separate DB per service)
- **Message Broker**: Redis Streams
- **Cache**: Redis
- **ORM**: SQLAlchemy 2.0 (async)

### AI/LLM
- **Primary LLM**: Google Gemini 1.5 Flash (cost-effective)
- **Complex Tasks**: Gemini 1.5 Pro (deep reasoning)
- **Agents**: LangGraph + LangChain
- **Vector DB**: ChromaDB (fraud detection)

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite 5
- **Styling**: CSS Modules / Tailwind CSS
- **Charts**: Recharts / Chart.js

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Reverse Proxy**: Nginx
- **Monitoring**: Prometheus + Grafana (planned)
- **Logging**: Structured JSON logs

---

## 🔑 Key Architectural Principles

### 1️⃣ **True Microservices Independence**

Each service:
- ✅ Has its own database (data ownership)
- ✅ Can be built and deployed independently
- ✅ Has zero code-level dependencies on other services
- ✅ Communicates only via REST or message broker

**Test**: You can delete any 6 services, and the remaining 1 will still build successfully.

### 2️⃣ **Accept Code Duplication Over Coupling**

Event schemas, logging utils, and database helpers are **duplicated** in each service. This is intentional:
- ✅ Services can evolve independently
- ✅ No deployment coupling
- ✅ No shared library versioning issues

**Principle**: **Independence > DRY**

### 3️⃣ **Hybrid Communication**

- **Async** (Redis Streams) for workflows: Telemetry → Health → Agent → Alert
- **Sync** (HTTP REST) for queries: Get vehicle health, check warranty

### 4️⃣ **Event-Driven by Default**

All state changes emit events:
```
vehicle.telemetry.received
vehicle.health.changed
agent.decision.made
alert.created
appointment.scheduled
warranty.claim.validated
```

---

## 🔄 Event Flow Example

### Typical Flow: Telemetry → Predictive Alert

```
1. Vehicle sends telemetry  
   → POST http://ingestion-service:8001/api/v1/ingest

2. Ingestion Service publishes event  
   → vehicle.telemetry.received (Redis Streams)

3. Health Service consumes event  
   → Calculates health score (0.35 - WARNING)  
   → Publishes: vehicle.health.changed

4. Agent Service consumes event  
   → Master Orchestrator routes to Engine Agent  
   → LLM analyzes: "Coolant leak likely"  
   → Publishes: agent.decision.made

5. Alert Service consumes event  
   → Generates CRITICAL alert  
   → Sends Email + SMS + Push  
   → Publishes: alert.created

6. Scheduling Service consumes event  
   → Auto-books appointment  
   → Publishes: appointment.scheduled

7. Analytics Service logs all events  
   → Updates dashboard metrics
```

**Total Latency**: ~10-15 seconds from telemetry to alert delivered

---

## 🧪 Testing Strategy

### Per-Service Testing
```bash
cd services/health-service
pytest tests/ -v

# With coverage
pytest --cov=services --cov-report=html
```

### Integration Testing
```bash
cd tests/integration
pytest test_end_to_end_flow.py
```

### Load Testing
```bash
# Test ingestion throughput
locust -f tests/load/test_ingestion.py --users 100 --spawn-rate 10
```

---

## 📊 Monitoring & Observability

### Structured Logging

All services log in JSON format:
```json
{
  "timestamp": "2026-01-28T22:00:00Z",
  "service": "health-service",
  "level": "INFO",
  "correlation_id": "req_abc123",
  "message": "RUL computed for vehicle V001",
  "vehicle_id": "V001",
  "component": "engine",
  "rul_km": 5000
}
```

### Metrics (Prometheus)

Each service exposes `/metrics`:
```
http_requests_total{service="health-service",endpoint="/api/v1/health"}
event_processing_duration_seconds{service="agent-service"}
llm_api_calls_total{model="gemini-1.5-pro",status="success"}
```

### Health Checks

Every service has:
- `/health` - Service is running
- `/ready` - Service + dependencies are healthy

---

## 🔐 Security

### Authentication
- **Users** → JWT tokens (validated by each service independently)
- **Services** → API keys (X-API-Key header)

### Authorization
- **RBAC** enforced by analytics-service
- **Roles**: Owner, Fleet Manager, Technician, Admin, Executive

### Data Protection
- Passwords hashed with bcrypt
- JWTs signed with HS256
- API keys rotated regularly
- TLS in production (terminated at load balancer)

---

## 🚀 Deployment

### Local Development
```bash
docker-compose up
```

### Production (Kubernetes - Future)
```bash
cd infrastructure/k8s
kubectl apply -f base/
kubectl apply -f overlays/production/
```

---

## 📈 Success Metrics

### Technical KPIs
- **Throughput**: 1000+ telemetry records/sec
- **Latency**: <100ms per API call
- **Availability**: 99.9% uptime per service
- **Accuracy**: 90%+ RUL prediction accuracy

### Business KPIs
- **Cost Avoidance**: Track prevented breakdown costs
- **Fleet Uptime**: % of vehicles operational
- **Alert Response Time**: Avg time to acknowledge
- **Warranty Fraud Prevention**: Fraud detection rate

---

## 🗺️ Roadmap

### Phase 1: Core Platform ✅ (Current)
- [x] Architecture design
- [x] Service blueprints
- [ ] Core implementations
- [ ] Basic frontend
- [ ] docker-compose setup

### Phase 2: ML & AI Enhancements
- [ ] Train LSTM models for RUL prediction
- [ ] Fine-tune LLM on automotive data
- [ ] Advanced fraud detection (anomaly detection)

### Phase 3: Production Ready
- [ ] Kubernetes deployments
- [ ] CI/CD pipelines
- [ ] Monitoring dashboards (Grafana)
- [ ] Load testing & optimization

### Phase 4: Advanced Features
- [ ] Mobile apps (React Native)
- [ ] Edge deployment (on-vehicle processing)
- [ ] Multi-tenancy (B2B SaaS)
- [ ] Blockchain warranty records

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow service-specific guidelines (see each service's README)
4. Write tests
5. Commit changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file

---

## 📞 Support

- 🐛 **Issues**: [GitHub Issues](https://github.com/yourorg/carvrooom2/issues)
- 📧 **Email**: support@carvrooom.ai
- 📖 **Docs**: [Documentation Site](https://docs.carvrooom.ai)

---

## 🙏 Acknowledgments

- **FastAPI** - For the amazing web framework
- **LangChain/LangGraph** - For agent orchestration
- **Google Gemini** - For powerful LLM capabilities
- **Redis** - For reliable message streaming

---

**Built with ❤️ by the CarVrooom Team**

**Status**: 🏗️ Architecture Complete | 🚧 Implementation In Progress
