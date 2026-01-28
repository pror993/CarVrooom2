# 📊 Analytics Service

> **Port:** 8007  
> **Database:** `analytics_db`  
> **Role:** Fleet Analytics, Dashboards & RBAC

---

## 🎯 Purpose

The Analytics Service is the **business intelligence hub** that aggregates data from all services to provide fleet-level insights, cost tracking, compliance reporting, and role-based dashboards for different stakeholders.

Think of it as the **control tower** with a bird's-eye view of the entire fleet.

---

## 📋 Key Responsibilities

1. **Aggregate** data from all microservices via REST API calls
2. **Calculate** fleet-wide metrics (health score, cost avoidance, uptime)
3. **Generate** dashboards for different user roles
4. **Enforce** Role-Based Access Control (RBAC)
5. **Track** audit logs for compliance
6. **Export** reports (CSV, PDF, Excel)
7. **Provide** real-time metrics for monitoring
8. **Support** custom queries and filters

---

## 🔄 Event Interactions

### **Consumes**
- **All events** (for audit logging and metrics):
  - `vehicle.telemetry.received`
  - `vehicle.health.changed`
  - `alert.created`
  - `appointment.scheduled`
  - `warranty.claim.submitted`
  - And more...

### **Publishes**
- `analytics.report.generated` - When scheduled reports are created
- `analytics.threshold.exceeded` - When KPI thresholds are breached

---

## 📡 API Endpoints

### Dashboard Endpoints
```
GET    /api/v1/dashboards/fleet             # Fleet manager view
GET    /api/v1/dashboards/owner/{user_id}   # Vehicle owner view
GET    /api/v1/dashboards/technician/{id}   # Technician workload
GET    /api/v1/dashboards/executive         # C-level metrics
```

### Metrics & KPIs
```
GET    /api/v1/metrics/fleet-health         # Overall fleet health
GET    /api/v1/metrics/cost-avoidance       # Prevented breakdown costs
GET    /api/v1/metrics/uptime               # Fleet availability %
GET    /api/v1/metrics/alert-stats          # Alert volume, response time
GET    /api/v1/metrics/warranty-stats       # Claim approval rate
```

### Audit & Compliance
```
GET    /api/v1/audit/logs                   # Audit trail
GET    /api/v1/audit/user-activity/{id}     # User actions
POST   /api/v1/reports/generate             # Generate custom report
GET    /api/v1/reports/{id}/download        #Download report (CSV/PDF)
```

### User Management (RBAC)
```
POST   /api/v1/auth/login                   # User authentication
GET    /api/v1/users/me                     # Current user info
GET    /api/v1/users/{id}/permissions       # User permissions
```

### Example Response
```json
GET /api/v1/dashboards/fleet
{
  "fleet_summary": {
    "total_vehicles": 1000,
    "active_vehicles": 950,
    "in_maintenance": 30,
    "critical_alerts": 12,
    "average_health_score": 0.76
  },
  "health_distribution": {
    "excellent": 450,
    "good": 380,
    "fair": 100,
    "poor": 50,
    "critical": 20
  },
  "cost_metrics": {
    "total_cost_avoidance_this_month": 125000,
    "preventive_maintenance_savings": 85000,
    "warranty_covered_repairs": 40000
  },
  "top_issues": [
    {
      "component": "brakes",
      "affected_vehicles": 45,
      "average_rul_km": 3200,
      "estimated_total_cost": 22500
    },
    {
      "component": "engine",
      "affected_vehicles": 28,
      "average_rul_km": 1500,
      "estimated_total_cost": 42000
    }
  ],
  "recent_alerts": [...]
}
```

---

## 🏗️ Folder Structure

```
analytics-service/
├── config.py
├── main.py
├── requirements.txt
│
├── api/v1/
│   ├── dashboards.py           # Dashboard endpoints
│   ├── metrics.py              # KPI endpoints
│   ├── audit.py                # Audit log endpoints
│   └── auth.py                 # Authentication
│
├── services/
│   ├── aggregation_service.py  # Data aggregation from other services
│   ├── metrics_calculator.py   # KPI calculations
│   └── report_generator.py     # PDF/CSV export
│
├── dashboards/                 # Dashboard logic
│   ├── fleet_dashboard.py
│   ├── owner_dashboard.py
│   ├── technician_dashboard.py
│   └── executive_dashboard.py
│
├── models/
│   ├── domain.py               # User, Role, Permission
│   ├── schemas.py
│   └── events.py
│
├── events/
│   ├── consumers.py            # Log all events for audit
│   └── publishers.py
│
├── db/
│   ├── models.py               # Users, audit_logs, reports
│   └── repositories.py
│
├── utils/
│   ├── logging.py
│   ├── rbac.py                 # Role-based access control
│   ├── jwt_handler.py          # JWT token generation/validation
│   ├── chart_generator.py      # Plotly/Chart.js
│   └── http_client.py
│
└── tests/
    ├── test_dashboards.py
    └── test_rbac.py
```

---

## 🔧 Special Components

### **User Roles & Permissions**

| Role | Permissions | Dashboard Access |
|------|-------------|------------------|
| **Vehicle Owner** | View own vehicle(s), book appointments | Owner Dashboard |
| **Fleet Manager** | View all fleet vehicles, analytics | Fleet Dashboard |
| **Technician** | View assigned jobs, update status | Technician Dashboard |
| **Admin** | Full system access, user management | All Dashboards |
| **Executive** | High-level metrics, cost reports | Executive Dashboard |
| **Support** | Read-only, assist customers | Limited Access |

### **Key Performance Indicators (KPIs)**

**Fleet Health Metrics:**
- Average fleet health score (0-1)
- % of vehicles in each health category
- Vehicles requiring immediate attention
- Health trend over time (improving/degrading)

**Cost Metrics:**
- **Cost Avoidance** = (Breakdown repair cost) - (Preventive maintenance cost)
- Total maintenance budget spent
- Avg cost per vehicle
- Warranty savings

**Operational Metrics:**
- Fleet uptime % (vehicles operational / total)
- Average vehicle age
- Mileage per vehicle
- Service frequency

**Alert Metrics:**
- Total alerts generated
- Average acknowledgment time
- Resolution time
- Alert fatigue score (too many alerts = bad)

**Warranty Metrics:**
- Claim approval rate
- Average claim processing time
- Fraud detection rate
- Total warranty payouts

### **Data Aggregation Strategy**

Instead of duplicating data, makes REST calls to other services:

```python
# Example: Fleet health calculation
async def calculate_fleet_health():
    vehicles = await get_all_vehicles()
    health_data = []
    
    for vehicle in vehicles:
        # Call health-service
        response = await http_client.get(
            f"{HEALTH_SERVICE_URL}/api/v1/health/{vehicle.id}"
        )
        health_data.append(response.json())
    
    # Aggregate
    avg_health = sum(h["health_score"] for h in health_data) / len(health_data)
    return avg_health
```

**Caching:** Results cached for 5 minutes to reduce load

### **Report Generation**

Supports multiple formats:

**CSV Export**
- Raw data export for Excel analysis
- Filtered by date range, vehicle, component

**PDF Report**
- Executive summary with charts
- Uses WeasyPrint or ReportLab
- Professional formatting

**Scheduled Reports**
- Weekly fleet health report (emailed to fleet manager)
- Monthly cost analysis
- Quarterly compliance report

---

## 🔗 Dependencies

### External Services Called (via REST)
- **Ingestion Service** - Vehicle data, telemetry stats
- **Health Service** - Health scores, RUL data
- **Agent Service** - Decision history
- **Alert Service** - Alert statistics
- **Scheduling Service** - Appointment data
- **Warranty Service** - Claim statistics

### Infrastructure Dependencies
- **PostgreSQL** - `analytics_db` (users, audit logs, cached metrics)
- **Redis Streams** - Event audit logging
- **Redis Cache** - Metrics caching (performance)

---

## ⚙️ Configuration

```env
SERVICE_NAME=analytics-service
PORT=8007
DATABASE_URL=postgresql+asyncpg://user:pass@postgres:5432/analytics_db
REDIS_URL=redis://redis:6379

# Service URLs (for aggregation)
INGESTION_SERVICE_URL=http://ingestion-service:8001
HEALTH_SERVICE_URL=http://health-service:8002
AGENT_SERVICE_URL=http://agent-service:8003
ALERT_SERVICE_URL=http://alert-service:8004
SCHEDULING_SERVICE_URL=http://scheduling-service:8005
WARRANTY_SERVICE_URL=http://warranty-service:8006

# JWT Auth
JWT_SECRET_KEY=your_secret_key_change_in_production
JWT_ALGORITHM=HS256
JWT_EXPIRY_HOURS=24

# Caching
METRICS_CACHE_TTL_SECONDS=300      # 5 minutes
FORCE_REFRESH_PARAM=?refresh=true  # Allow cache bypass

# Reporting
MAX_EXPORT_ROWS=10000              # Limit for CSV exports
REPORT_STORAGE_BUCKET=carvrooom-reports
```

---

## 🎯 Success Metrics

- **Dashboard Load Time** - <2 seconds (even for large fleets)
- **Data Freshness** - Metrics updated every 5 minutes
- **Accuracy** - 100% (match source data from services)
- **Uptime** - 99.9% (critical for monitoring)
- **Concurrent Users** - Support 100+ simultaneous users

---

## 🔐 Authentication Flow

```
1. User submits credentials → POST /api/v1/auth/login
2. Validate against database (hashed passwords)
3. Generate JWT with claims: { user_id, role, permissions, vehicle_ids[] }
4. Return JWT to frontend
5. Frontend includes JWT in all requests:
   Authorization: Bearer <JWT>
6. Analytics service validates JWT
7. Check permissions (RBAC) for requested resource
8. Return data based on user role
```

**Example JWT Payload:**
```json
{
  "user_id": "user_123",
  "role": "FLEET_MANAGER",
  "permissions": ["view_fleet", "manage_appointments"],
  "vehicle_ids": ["*"],  // * means all vehicles
  "exp": 1738108800
}
```

---

## 📈 Dashboard Examples

### **Fleet Manager Dashboard**
- Fleet health heatmap (geographic view)
- Component health breakdown
- Cost avoidance tracking
- Upcoming maintenance schedule
- Alert summary (by severity)
- Technician utilization chart

### **Vehicle Owner Dashboard**
- My vehicle health score
- Upcoming maintenance reminders
- Service history timeline
- Active alerts
- Warranty status
- Book appointment button

### **Technician Dashboard**
- Today's schedule
- Assigned vehicles & issues
- Parts needed for today
- Completed vs. pending jobs
- Performance metrics (avg repair time)

---

## 🚀 Quick Start

```bash
cd services/analytics-service
pip install -r requirements.txt
cp .env.example .env

# Add service URLs to .env
uvicorn main:app --reload --port 8007

# Login
curl -X POST http://localhost:8007/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"fleet_manager","password":"password"}'

# Get fleet dashboard (use JWT from login)
curl http://localhost:8007/api/v1/dashboards/fleet \
  -H "Authorization: Bearer <JWT>"
```

---

## 📝 Notes

- All **user actions are logged** (audit trail)
- Supports **custom date ranges** for all metrics
- Can **drill down** from fleet → vehicle → component
- **Real-time updates** via WebSockets (optional enhancement)
- **Multi-fleet support** (for enterprises with multiple fleets)
- **White-label ready** (customizable branding per tenant)
- **Compliance-ready**: GDPR, SOC 2, ISO 27001 audit logs
- Can integrate with **BI tools** (Tableau, PowerBI) via REST API
