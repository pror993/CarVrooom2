# 📅 Scheduling Service

> **Port:** 8005  
> **Database:** `scheduling_db`  
> **Role:** Service Appointment Optimization & Management

---

## 🎯 Purpose

The Scheduling Service intelligently **books service appointments** by considering technician availability, parts inventory, service bay capacity, and optimal routing. It uses constraint optimization to suggest the best appointment slots.

Think of it as the **smart scheduler** that balances urgency with resource availability.

---

## 📋 Key Responsibilities

1. **Manage** technician schedules and availability
2. **Track** service bay capacity and utilization
3. **Check** parts inventory before booking
4. **Optimize** appointment slots using OR-Tools
5. **Auto-book** appointments for critical alerts
6. **Send** calendar invites (Google Calendar, Outlook)
7. **Handle** cancellations and rescheduling
8. **Provide** REST API for appointment management

---

## 🔄 Event Interactions

### **Consumes**
- `alert.created` - Critical alerts trigger auto-booking
- `agent.decision.made` - Recommendations needing service

### **Publishes**
- `appointment.scheduled` - New appointment created
- `appointment.cancelled` - Appointment cancelled
- `appointment.reminder` - Reminder sent (1 day before)
- `technician.assigned` - Technician assigned to job

---

## 📡 API Endpoints

```
POST   /api/v1/appointments                # Book appointment
GET    /api/v1/appointments/{id}           # Appointment details
PUT    /api/v1/appointments/{id}           # Update/reschedule
DELETE /api/v1/appointments/{id}           # Cancel appointment
GET    /api/v1/appointments/vehicle/{id}   # Vehicle appointments
GET    /api/v1/slots/available              # Get available slots
GET    /api/v1/technicians                  # List technicians
GET    /api/v1/technicians/{id}/schedule   # Technician calendar
```

### Example Request/Response
```json
POST /api/v1/slots/available
{
  "vehicle_id": "V001",
  "service_type": "engine_repair",
  "urgency": "HIGH",
  "preferred_date": "2026-02-01",
  "estimated_duration_hours": 3
}

Response:
{
  "recommended_slots": [
    {
      "datetime": "2026-02-01T09:00:00Z",
      "technician": {
        "id": "tech_001",
        "name": "Mike Johnson",
        "specialization": "Engine Specialist",
        "rating": 4.8
      },
      "service_bay": "Bay 3",
      "parts_available": true,
      "estimated_completion": "2026-02-01T12:00:00Z",
      "confidence_score": 0.95  // Optimization quality
    },
    {
      "datetime": "2026-02-01T14:00:00Z",
      "technician": {...},
      "confidence_score": 0.87
    }
  ]
}
```

---

## 🏗️ Folder Structure

```
scheduling-service/
├── config.py
├── main.py
├── requirements.txt
│
├── api/v1/
│   └── endpoints.py
│
├── services/
│   ├── scheduling_engine.py    # Core booking logic
│   ├── availability_manager.py # Track tech availability
│   └── notification_service.py # Send calendar invites
│
├── optimization/               # Constraint solving
│   ├── slot_optimizer.py       # OR-Tools optimization
│   └── constraints.py          # Business rules
│
├── models/
│   ├── domain.py               # Appointment, Technician, ServiceBay
│   ├── schemas.py
│   └── events.py
│
├── events/
│   ├── consumers.py            # Alert event listeners
│   └── publishers.py
│
├── db/
│   ├── models.py               # Appointments, schedules
│   └── repositories.py
│
├── utils/
│   ├── logging.py
│   ├── calendar_client.py      # Google Calendar API
│   └── redis_client.py
│
└── tests/
    ├── test_optimizer.py
    └── test_scheduling.py
```

---

## 🔧 Special Components

### **Appointment Types**

| Type | Duration | Priority | Auto-Book |
|------|----------|----------|-----------|
| **Routine Maintenance** | 1-2h | Low | No |
| **Diagnostic** | 2-3h | Medium | No |
| **Component Repair** | 3-5h | High | Yes (for CRITICAL alerts) |
| **Emergency** | 1-2h | Urgent | Yes (immediate next slot) |

### **Optimization Engine**

Uses Google OR-Tools for constraint satisfaction:

```python
# Constraints to optimize:
1. Technician has required skill for the job
2. Service bay is available
3. Required parts are in stock
4. Minimizes customer wait time
5. Balances technician workload
6. Respects technician work hours
7. Accounts for travel time between jobs

# Objective function:
Maximize: (urgency_weight * urgency_score) 
        + (customer_preference_score)
        - (waiting_time_penalty)
```

### **Parts Inventory Check**

Before booking, verifies:
- Check inventory database (could be external service)
- If parts unavailable → Add lead time to estimate
- If critical parts missing → Suggest alternative date
- Can trigger parts order event

### **Calendar Integration**

Sends calendar invites via:
- **Google Calendar API** - For technicians
- **Microsoft Graph API** - For Outlook users
- **iCal format** - Generic email attachment

---

## 🔗 Dependencies

### External Services Called
- **Alert Service** - Get alert details
- **Health Service** - Get vehicle health for context
- **Inventory Service** (future) - Check parts availability
- **Google Calendar API** - Calendar integration
- **Microsoft Graph API** - Outlook integration

### Infrastructure Dependencies
- **PostgreSQL** - `scheduling_db`
- **Redis Streams** - Event processing
- **Redis Cache** - Availability lookups (performance)

---

## ⚙️ Configuration

```env
SERVICE_NAME=scheduling-service
PORT=8005
DATABASE_URL=postgresql+asyncpg://user:pass@postgres:5432/scheduling_db
REDIS_URL=redis://redis:6379

# Scheduling Parameters
MAX_BOOKINGS_PER_TECHNICIAN_PER_DAY=6
SERVICE_BAY_COUNT=8
BUFFER_TIME_MINUTES=30              # Between appointments

# Auto-booking
AUTO_BOOK_CRITICAL_ALERTS=true
AUTO_BOOK_WITHIN_DAYS=7             # Book within next week

# Calendar Integration
GOOGLE_CALENDAR_API_KEY=your_key
MICROSOFT_GRAPH_CLIENT_ID=your_client_id

# Notifications
SEND_REMINDER_HOURS_BEFORE=24
SEND_CONFIRMATION_EMAIL=true
```

---

## 🎯 Success Metrics

- **Booking Success Rate** - 95%+ appointments successfully scheduled
- **Optimization Quality** - 90%+ of bookings use recommended slot
- **Technician Utilization** - 70-80% (balanced workload)
- **Customer Wait Time** - Average <3 days for routine, <24h for critical
- **No-Show Rate** - <5% (good reminders reduce this)

---

## 🧮 Optimization Example

**Scenario:** Engine repair needed for V001

**Inputs:**
- Service type: Engine repair (3 hours)
- Urgency: HIGH
- Preferred date: Feb 1, 2026

**Constraints:**
- Tech must have "Engine Specialist" skill
- Service bay must be available for 3h block
- Parts: Thermostat (in stock ✅), Coolant (in stock ✅)

**Solution:**
```
Recommended Slot: Feb 1, 9:00 AM - 12:00 PM
Technician: Mike Johnson (Engine Specialist, 15 years exp)
Service Bay: Bay 3 (equipped for engine work)
Confidence: 95% (high quality match)
```

---

## 📆 Workflow

```
1. User/System requests appointment
2. Scheduling engine fetches:
   - Available technicians
   - Available bays
   - Parts inventory status
3. Optimizer runs constraint solver
4. Returns top 3 recommended slots
5. User selects slot (or auto-booked if critical)
6. Calendar invites sent
7. Event published: appointment.scheduled
8. Reminder scheduled for 24h before
```

---

## 🚀 Quick Start

```bash
cd services/scheduling-service
pip install -r requirements.txt
cp .env.example .env

uvicorn main:app --reload --port 8005

# Test slot availability
curl -X POST http://localhost:8005/api/v1/slots/available \
  -H "Content-Type: application/json" \
  -d '{"vehicle_id":"V001", "service_type":"routine", "urgency":"LOW"}'
```

---

## 📝 Notes

- Appointments are **soft-locked** for 15 minutes during booking
- **Overbooking protection**: Max capacity enforced
- Supports **recurring appointments** (e.g., monthly maintenance)
- **Cancellation policy**: Free cancellation >24h before
- Late cancellations charged (configurable)
- **Waitlist feature**: Notify when earlier slots open up
- Can **prioritize** fleet customers or premium members
- **Multi-location support** ready (if chain of service centers)
