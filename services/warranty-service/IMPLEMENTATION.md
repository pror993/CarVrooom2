# 🛡️ Warranty Service

> **Port:** 8006  
> **Database:** `warranty_db`  
> **Role:** Warranty Intelligence & Fraud Detection

---

## 🎯 Purpose

The Warranty Service **automates warranty claim validation** by analyzing telemetry data to verify failure authenticity, assess coverage eligibility, and detect fraudulent claims. It uses AI to correlate telemetry patterns with claimed failures.

Think of it as the **warranty detective** backed by data and AI.

---

## 📋 Key Responsibilities

1. **Assess** warranty eligibility (coverage period, mileage, terms)
2. **Validate** failure authenticity using telemetry correlation
3. **Detect** fraudulent claims using vector similarity (ChromaDB)
4. **Generate** evidence packs (PDF reports with telemetry charts)
5. **Calculate** coverage amount and deductibles
6. **Provide** instant preliminary decisions (AI-powered)
7. **Integrate** with OEM Dealer Management Systems (DMS)
8. **Track** claim lifecycle from submission to resolution

---

## 🔄 Event Interactions

### **Consumes**
- `component.degraded` - Pre-claim analysis (predictive)
- `agent.decision.made` - For correlation with failures

### **Publishes**
- `warranty.claim.submitted` - New claim received
- `warranty.claim.validated` - Claim approved
- `warranty.claim.rejected` - Claim denied
- `warranty.fraud.detected` - Suspicious claim flagged

---

## 📡 API Endpoints

```
POST   /api/v1/claims                      # Submit warranty claim
GET    /api/v1/claims/{id}                 # Claim status
GET    /api/v1/claims/vehicle/{vehicle_id} # Vehicle claim history
POST   /api/v1/claims/{id}/evidence        # Generate evidence pack
GET    /api/v1/warranty/{vehicle_id}/check # Check eligibility
GET    /api/v1/fraud/analyze/{claim_id}    # Fraud analysis
```

### Example Claim Submission
```json
POST /api/v1/claims
{
  "vehicle_id": "V001",
  "vin": "1HGBH41JXMN109186",
  "component": "engine",
  "failure_description": "Engine seized due to oil pump failure",
  "failure_date": "2026-01-28",
  "mileage_at_failure": 45000,
  "repair_cost_estimate": 3500,
  "supporting_documents": [
    "mechanic_report.pdf",
    "photos.zip"
  ]
}

Response:
{
  "claim_id": "claim_abc123",
  "status": "UNDER_REVIEW",
  "preliminary_decision": "LIKELY_APPROVED",
  "confidence": 0.87,
  "eligibility": {
    "is_eligible": true,
    "coverage_type": "Powertrain",
    "expiry_date": "2028-01-15",
    "mileage_limit": 100000,
    "current_mileage": 45000,
    "days_remaining": 730
  },
  "telemetry_correlation": {
    "oil_pressure_drops_detected": true,
    "warnings_issued": 3,
    "last_warning_date": "2026-01-20",
    "pattern_matches_failure": true
  },
  "fraud_score": 0.12,  // Low = legitimate
  "estimated_coverage": 3200,
  "estimated_deductible": 300,
  "evidence_pack_url": "https://storage.carvrooom.ai/evidence/claim_abc123.pdf",
  "next_steps": "Human adjuster will review within 24 hours"
}
```

---

## 🏗️ Folder Structure

```
warranty-service/
├── config.py
├── main.py
├── requirements.txt
│
├── api/v1/
│   └── endpoints.py
│
├── services/
│   ├── claim_processor.py      # Core claim validation
│   ├── eligibility_checker.py  # Check warranty coverage
│   └── evidence_generator.py   # PDF report generation
│
├── fraud/                      # Fraud detection
│   ├── detector.py             # Main fraud analysis
│   ├── vector_store.py         # ChromaDB integration
│   └── patterns.py             # Known fraud patterns
│
├── models/
│   ├── domain.py               # Claim, Warranty, Evidence
│   ├── schemas.py
│   └── events.py
│
├── events/
│   ├── consumers.py            # Health event listeners
│   └── publishers.py
│
├── db/
│   ├── models.py               # Claims, warranties
│   └── repositories.py
│
├── utils/
│   ├── logging.py
│   ├── llm_client.py           # Gemini Pro for analysis
│   ├── pdf_generator.py        # ReportLab
│   └── http_client.py
│
└── tests/
    ├── test_fraud_detector.py
    └── test_eligibility.py
```

---

## 🔧 Special Components

### **Warranty Types**

| Coverage Type | Duration | Mileage Limit | Components Covered |
|---------------|----------|---------------|-------------------|
| **Basic** | 3 years | 36,000 km | Everything except wear items |
| **Powertrain** | 5 years | 100,000 km | Engine, transmission, drivetrain |
| **Corrosion** | 7 years | Unlimited | Rust-through warranty |
| **Extended** | Custom | Custom | Varies by contract |

### **Telemetry Correlation Engine**

Verifies failure authenticity:

```python
# Example: Engine failure claim
Claim: "Engine failed due to oil pump malfunction"

Telemetry Analysis:
✅ Oil pressure dropped from 40 psi → 5 psi over 2 weeks
✅ Engine temp increased from 90°C → 115°C
✅ Multiple warnings logged in system
✅ Owner acknowledged alerts (didn't ignore maintenance)
✅ RPM pattern shows normal usage (not abusive driving)

Verdict: LEGITIMATE FAILURE
Confidence: 92%
```

vs.

```python
Claim: "Transmission failed suddenly"

Telemetry Analysis:
❌ No gradual degradation detected
❌ No prior warnings or alerts
❌ Telemetry shows aggressive shifting patterns
❌ Similar claim pattern in fraud database

Verdict: SUSPICIOUS - FRAUD RISK
Fraud Score: 0.78 (78% likelihood of fraud)
```

### **Fraud Detection using ChromaDB**

**Vector Similarity Search:**
1. Embed claim description using LLM
2. Search ChromaDB for similar past claims
3. Find claims with similar:
   - Failure description
   - Component type
   - Mileage range
   - Time since purchase
4. If match found with known fraud case → Flag for review

**Known Fraud Patterns:**
- Multiple claims for same component within short time
- Claim immediately after warranty expires (purchased extended just before)
- Telemetry shows no degradation before "sudden" failure
- Repair shop has history of inflated estimates
- Similar claims from same geographic region (fraud ring)

### **Evidence Pack Generation**

Auto-generated PDF includes:
- Claim summary
- Warranty coverage details
- **Telemetry charts** (24 hours before failure)
- Health score timeline (last 6 months)
- Decision rationale (AI reasoning)
- Recommended actions

Uses **ReportLab** or **WeasyPrint** for PDF generation.

---

## 🔗 Dependencies

### External Services Called
- **Health Service** - `GET /api/v1/health/{vehicle_id}/history`
- **Ingestion Service** - `GET /api/v1/vehicles/{id}/history` (telemetry)
- **Google Gemini API** - For fraud analysis (LLM reasoning)

### Infrastructure Dependencies
- **PostgreSQL** - `warranty_db`
- **Redis Streams** - Event processing
- **ChromaDB** - Vector store (embedded or server mode)
- **Cloud Storage** - For evidence pack PDFs (S3/GCS)

---

## ⚙️ Configuration

```env
SERVICE_NAME=warranty-service
PORT=8006
DATABASE_URL=postgresql+asyncpg://user:pass@postgres:5432/warranty_db
REDIS_URL=redis://redis:6379

# AI/LLM
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-1.5-pro        # Use Pro for complex analysis

# ChromaDB
CHROMADB_PATH=./data/chromadb      # Embedded mode
# CHROMADB_HOST=chromadb:8000      # Server mode (production)

# Storage
EVIDENCE_STORAGE_BUCKET=carvrooom-evidence-packs
EVIDENCE_STORAGE_REGION=us-east-1

# Fraud Detection
FRAUD_THRESHOLD=0.70               # Flag if score > 0.70
AUTO_APPROVE_CONFIDENCE=0.90       # Auto-approve if confidence > 0.90

# Service URLs
HEALTH_SERVICE_URL=http://health-service:8002
INGESTION_SERVICE_URL=http://ingestion-service:8001
```

---

## 🎯 Success Metrics

- **Accuracy** - 95%+ correct approvals/denials (validated by human adjusters)
- **Fraud Detection** - Catch 80%+ of fraudulent claims
- **False Positive Rate** - <2% (don't wrongly deny legitimate claims)
- **Processing Time** - <5 minutes for preliminary decision
- **Cost Savings** - Track prevented fraudulent payouts

---

## 🕵️ Fraud Detection Flow

```
1. Claim submitted → Basic eligibility check
2. If eligible → Telemetry correlation analysis
3. Generate claim embedding (LLM)
4. Search ChromaDB for similar claims
5. Check fraud patterns:
   - Claim timing (suspicious if just before expiry)
   - Repair shop reputation
   - Customer claim history
   - Telemetry consistency
6. Calculate fraud score (0.0 - 1.0)
7. If score > 0.70 → Flag for human review
8. If score < 0.30 AND confidence > 0.90 → Auto-approve
9. Otherwise → Standard review process
```

---

## 🧠 LLM Integration

Uses Gemini 1.5 Pro for:

**Claim Description Analysis**
```
Prompt: "Analyze this warranty claim for authenticity. 
Claim: {description}
Telemetry: {telemetry_summary}
Question: Does the telemetry support the claimed failure?"

Response: Structured analysis with confidence score
```

**Fraud Pattern Detection**
```
Prompt: "Compare this claim to known fraud patterns:
{similar_claims_from_vector_db}
Identify red flags."
```

---

## 📄 Evidence Pack Example

```
CARVROOOM WARRANTY CLAIM EVIDENCE PACK
Claim ID: claim_abc123
Generated: 2026-01-28

VEHICLE INFORMATION
VIN: 1HGBH41JXMN109186
Make/Model: Honda Accord 2022
Current Mileage: 45,000 km

WARRANTY COVERAGE
Type: Powertrain Warranty
Expiry: 2028-01-15 (730 days remaining)
Mileage Limit: 100,000 km

CLAIM DETAILS
Component: Engine
Failure Description: Oil pump failure leading to engine seizure
Estimated Repair Cost: $3,500

TELEMETRY ANALYSIS
[Chart: Oil Pressure Over Time - Shows gradual decline]
[Chart: Engine Temperature - Shows increase correlated with oil pressure drop]

HEALTH SCORE TIMELINE
[Chart: 6-month engine health score - Shows degradation from 0.8 to 0.2]

ALERT HISTORY
- 2026-01-10: WARNING - Low oil pressure detected
- 2026-01-20: CRITICAL - Engine health degraded
- 2026-01-25: EMERGENCY - Immediate service required

DECISION
Status: APPROVED
Coverage Amount: $3,200
Deductible: $300
Confidence: 92%

REASONING
Telemetry data strongly supports the claimed failure. Oil pressure degradation was 
gradual and well-documented. Multiple warnings were issued. Customer acknowledged alerts 
but failure occurred before scheduled service. No fraud indicators detected.
```

---

## 🚀 Quick Start

```bash
cd services/warranty-service
pip install -r requirements.txt
cp .env.example .env

# Add Gemini API key
uvicorn main:app --reload --port 8006

# Submit test claim
curl -X POST http://localhost:8006/api/v1/claims \
  -H "Content-Type: application/json" \
  -d @test_claim.json
```

---

## 📝 Notes

- Claims are **immutable** once submitted (audit trail)
- All LLM calls are **logged** for compliance
- Evidence packs are **stored permanently** (regulatory requirement)
- Integrates with **OEM warranty databases** (future)
- Supports **goodwill claims** (out-of-warranty assistance)
- **Multi-language support** for international deployments
- Can handle **class action** warranty extensions automatically
- **Blockchain integration** ready (immutable claim records - future)
