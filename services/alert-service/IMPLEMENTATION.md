# 🔔 Alert Service

> **Port:** 8004  
> **Database:** `alert_db`  
> **Role:** Multi-Channel Alert Generation & Delivery

---

## 🎯 Purpose

The Alert Service is the **notification hub** that ensures stakeholders are informed about vehicle issues through their preferred channels (Email, SMS, Push notifications). It manages alert lifecycle, tracks acknowledgments, and handles escalation workflows.

Think of it as the **communication center** keeping everyone informed.

---

## 📋 Key Responsibilities

1. **Generate** alerts from agent decisions and health events
2. **Classify** alert severity (INFO, WARNING, CRITICAL, EMERGENCY)
3. **Route** alerts to appropriate recipients (owner, fleet manager, technician)
4. **Deliver** via multiple channels (Email, SMS, Push, In-App)
5. **Track** acknowledgment status and response time
6. **Escalate** unacknowledged critical alerts
7. **Provide** REST API for alert management

---

## 🔄 Event Interactions

### **Consumes**
- `agent.decision.made` - Agent recommendations
- `component.degraded` - Component health issues
- `component.critical` - Emergency situations
- `warranty.claim.validated` - Warranty updates

### **Publishes**
- `alert.created` - New alert generated
- `alert.acknowledged` - User acknowledged
- `alert.resolved` - Issue resolved
- `alert.escalated` - Escalation triggered

---

## 📡 API Endpoints

```
GET    /api/v1/alerts                       # List all alerts (filterable)
GET    /api/v1/alerts/{id}                  # Alert details
POST   /api/v1/alerts/{id}/acknowledge      # Acknowledge alert
POST   /api/v1/alerts/{id}/resolve          # Mark as resolved
GET    /api/v1/alerts/vehicle/{vehicle_id}  # Vehicle-specific alerts
GET    /api/v1/alerts/stats                 # Alert statistics
```

### Example Alert
```json
{
  "alert_id": "alert_xyz789",
  "vehicle_id": "V001",
  "severity": "CRITICAL",
  "title": "Engine Overheating Detected",
  "message": "Your vehicle's engine temperature has exceeded safe limits. Immediate service required to prevent engine damage.",
  "created_at": "2026-01-28T22:00:00Z",
  "acknowledged_at": null,
  "resolved_at": null,
  "recipients": [
    {
      "user_id": "owner_123",
      "channels": ["email", "sms", "push"],
      "delivery_status": {
        "email": "sent",
        "sms": "delivered",
        "push": "failed"
      }
    }
  ],
  "metadata": {
    "component": "engine",
    "health_score": 0.18,
    "decision_id": "dec_abc123",
    "recommended_action": "Stop driving immediately"
  }
}
```

---

## 🏗️ Folder Structure

```
alert-service/
├── config.py
├── main.py
├── requirements.txt
│
├── api/v1/
│   └── endpoints.py
│
├── services/
│   ├── alert_generator.py      # Alert creation logic
│   ├── escalation_manager.py   # Escalation workflows
│   └── recipient_resolver.py   # Determine who gets alerts
│
├── channels/                   # Delivery channels
│   ├── base_channel.py         # Abstract base class
│   ├── email_channel.py        # SendGrid integration
│   ├── sms_channel.py          # Twilio integration
│   ├── push_channel.py         # FCM/APNs integration
│   └── webhook_channel.py      # Custom webhooks
│
├── models/
│   ├── domain.py               # Alert, Recipient
│   ├── schemas.py
│   └── events.py
│
├── events/
│   ├── consumers.py            # Listen to decision/health events
│   └── publishers.py
│
├── db/
│   ├── models.py               # Alerts, delivery logs
│   └── repositories.py
│
├── utils/
│   ├── logging.py
│   ├── redis_client.py
│   └── template_engine.py      # Alert message templates
│
└── tests/
    ├── test_channels.py
    └── test_escalation.py
```

---

## 🔧 Special Components

### **Alert Severity Levels**

| Severity | Description | Delivery | Escalation |
|----------|-------------|----------|------------|
| **INFO** | Informational (e.g., "Service due soon") | Email only | None |
| **WARNING** | Attention needed (e.g., "Brake pads at 30%") | Email + In-App | After 24h |
| **CRITICAL** | Immediate action (e.g., "Engine overheating") | Email + SMS + Push | After 2h |
| **EMERGENCY** | Safety risk (e.g., "Brake failure") | All channels + Call | After 15min |

### **Delivery Channels**

**Email Channel** (via SendGrid)
- Rich HTML templates
- Includes charts, recommendations
- Tracking links

**SMS Channel** (via Twilio)
- Short, actionable messages
- Only for WARNING+ severities
- Cost-optimized (rate limiting)

**Push Notifications** (via Firebase Cloud Messaging)
- Mobile app notifications
- Deep linking to alerts page
- Supports iOS & Android

**Webhook Channel**
- For 3rd-party integrations
- Supports custom endpoints
- Retry logic with exponential backoff

### **Escalation Workflow**
```
1. Alert created → Send to owner
2. If not acknowledged within X time → Send to fleet manager
3. If still not acknowledged → Send to emergency contact
4. If EMERGENCY severity → Call technician directly
```

---

## 🔗 Dependencies

### External Services Called
- **SendGrid** - Email delivery (https://api.sendgrid.com)
- **Twilio** - SMS delivery (https://api.twilio.com)
- **Firebase** - Push notifications
- **Analytics Service** (optional) - Log alert for dashboard

### Infrastructure Dependencies
- **PostgreSQL** - `alert_db`
- **Redis Streams** - Event processing
- **Redis Cache** - Rate limiting, deduplication

---

## ⚙️ Configuration

```env
SERVICE_NAME=alert-service
PORT=8004
DATABASE_URL=postgresql+asyncpg://user:pass@postgres:5432/alert_db
REDIS_URL=redis://redis:6379

# Email
SENDGRID_API_KEY=your_sendgrid_key
EMAIL_FROM=noreply@carvrooom.ai

# SMS
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
SMS_FROM=+1234567890

# Push Notifications
FCM_SERVER_KEY=your_fcm_key

# Escalation
ESCALATION_WARNING_HOURS=24
ESCALATION_CRITICAL_HOURS=2
ESCALATION_EMERGENCY_MINUTES=15

# Rate Limiting
MAX_SMS_PER_VEHICLE_PER_DAY=5
MAX_ALERTS_PER_VEHICLE_PER_HOUR=3
```

---

## 🎯 Success Metrics

- **Delivery Rate** - 99%+ successful delivery
- **Delivery Speed** - <30 seconds from alert creation to delivery
- **Acknowledgment Rate** - 80%+ of alerts acknowledged within 2 hours
- **False Alert Rate** - <5% (avoid alert fatigue)
- **Cost Per Alert** - <$0.05 (optimize SMS usage)

---

## 🚨 Alert Deduplication

Prevents spam:
```
- Same vehicle + same component + within 1 hour = Suppress
- Max 3 alerts per vehicle per hour (any severity)
- EMERGENCY severity bypasses deduplication
```

---

## 📧 Message Templates

Alerts use dynamic templates:

**Email Template** (Jinja2)
```html
Subject: [{{ severity }}] {{ title }}

Hi {{ owner_name }},

Your {{ vehicle_make }} {{ vehicle_model }} ({{ vin }}) requires attention:

{{ message }}

Recommended Action: {{ recommended_action }}
Estimated Cost: {{ estimated_cost }}
Urgency: {{ urgency }}

[Book Service Appointment]
```

**SMS Template**
```
CARVROOOM ALERT: {{ vehicle_model }} - {{ title }}. {{ action }}. Details: carvrooom.ai/a/{{ short_id }}
```

---

## 🚀 Quick Start

```bash
cd services/alert-service
pip install -r requirements.txt
cp .env.example .env

# Add API keys to .env
uvicorn main:app --reload --port 8004
```

---

## 📝 Notes

- Alerts are **idempotent** (retry-safe)
- **Rate limited** to prevent spam
- Delivery failures are **retried** with exponential backoff
- All delivery attempts are **logged** for audit
- Supports **quiet hours** (no non-critical alerts 11PM-7AM)
- **Multi-language support** ready (templates per locale)
- Can **batch** multiple minor alerts into daily digest
