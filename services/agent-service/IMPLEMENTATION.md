# 🤖 Agent Service

> **Port:** 8003  
> **Database:** `agent_db`  
> **Role:** AI-Powered Decision Orchestration

---

## 🎯 Purpose

The Agent Service is the **intelligent decision-maker** of the platform. It uses LangGraph-based AI agents to analyze health data, perform root cause analysis, and generate actionable recommendations.

Think of it as the **expert system** with a Master Orchestrator directing specialized Worker Agents.

---

## 📋 Key Responsibilities

1. **Orchestrate** multi-agent workflows using LangGraph
2. **Route** health events to appropriate specialist agents
3. **Analyze** complex failure patterns using LLM reasoning
4. **Generate** detailed recommendations with explanations
5. **Maintain** decision history and agent memory
6. **Escalate** complex cases requiring human intervention
7. **Provide** REST API for manual decision requests

---

## 🔄 Event Interactions

### **Consumes**
- `vehicle.health.changed` - When component health degrades
- `component.degraded` - When threshold is crossed
- `component.critical` - Emergency situations

### **Publishes**
- `agent.decision.made` - After agent analysis complete
- `agent.escalation` - When human review needed
- `agent.recommendation` - Actionable suggestions

---

## 🧠 Agent Architecture

### **Master Orchestrator Agent**
```
LangGraph State Machine:
┌─────────────────┐
│  Receive Event  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Classify Issue │ (Which component? Severity?)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Route to Agent │ → Engine Agent
└────────┬────────┘ → Brake Agent
         │          → Transmission Agent
         │          → Generic Agent
         ▼
┌─────────────────┐
│  Aggregate      │
│  Responses      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Make Decision   │
└─────────────────┘
```

### **Worker Agents**

**1. Engine Agent**
- Specializes in: Engine overheating, oil pressure, coolant issues
- Uses: Gemini 1.5 Pro for complex diagnostics
- Knowledge: Engine repair manuals, fault codes

**2. Brake Safety Agent**
- Specializes in: Brake wear, ABS failures, brake fluid
- Uses: Rule-based + LLM hybrid
- Knowledge: Brake safety standards, stopping distance calculations

**3. Transmission Agent**
- Specializes in: Shift issues, clutch wear, transmission fluid
- Uses: Pattern matching + LLM reasoning
- Knowledge: Transmission failure patterns

**4. Generic Multi-Component Agent**
- Fallback for undefined issues
- Performs cross-system analysis

---

## 📡 API Endpoints

```
POST   /api/v1/agents/orchestrate          # Manual decision trigger
GET    /api/v1/agents/decisions/{vehicle_id} # Decision history
GET    /api/v1/agents/decision/{id}        # Specific decision details
GET    /api/v1/agents/status                # Agent health & performance
```

### Example Request/Response
```json
POST /api/v1/agents/orchestrate
{
  "vehicle_id": "V001",
  "component": "engine",
  "health_score": 0.35,
  "context": {
    "recent_telemetry": [...],
    "dtc_codes": ["P0128", "P0300"]
  }
}

Response:
{
  "decision_id": "dec_abc123",
  "vehicle_id": "V001",
  "agent_used": "Engine Agent",
  "decision": "Immediate service required",
  "severity": "HIGH",
  "confidence": 0.92,
  "reasoning": "Coolant thermostat stuck open (P0128) combined with random misfires (P0300) indicates cooling system failure affecting combustion. Temperature consistently below 75°C under normal operating conditions.",
  "recommended_actions": [
    "Replace thermostat immediately",
    "Inspect coolant levels and check for leaks",
    "Run compression test to verify cylinder health",
    "Clear fault codes after repair"
  ],
  "estimated_cost": "$150-300",
  "urgency": "Within 48 hours",
  "llm_model_used": "gemini-1.5-pro"
}
```

---

## 🏗️ Folder Structure

```
agent-service/
├── config.py
├── main.py
├── requirements.txt
│
├── api/v1/
│   └── endpoints.py
│
├── services/
│   ├── orchestrator.py         # Master orchestrator logic
│   └── decision_engine.py      # Decision aggregation
│
├── agents/
│   ├── master_agent.py         # LangGraph orchestrator
│   ├── base_agent.py           # Base class for all agents
│   └── workers/
│       ├── engine_agent.py
│       ├── brake_agent.py
│       ├── transmission_agent.py
│       └── generic_agent.py
│
├── models/
│   ├── domain.py               # Decision, Recommendation
│   ├── schemas.py
│   └── events.py
│
├── events/
│   ├── consumers.py            # Health event listeners
│   └── publishers.py
│
├── db/
│   ├── models.py               # Decision history
│   └── repositories.py
│
├── utils/
│   ├── logging.py
│   ├── llm_client.py           # Gemini API wrapper
│   └── redis_client.py
│
└── tests/
    ├── test_orchestrator.py
    └── test_agents.py
```

---

## 🔧 Special Components

### **LangGraph Integration**
```python
# Simplified agent workflow
from langgraph.graph import StateGraph

workflow = StateGraph(AgentState)
workflow.add_node("classify", classify_issue)
workflow.add_node("route", route_to_agent)
workflow.add_node("analyze", worker_agent_analyze)
workflow.add_node("decide", make_final_decision)

# Edges define flow
workflow.add_edge("classify", "route")
workflow.add_edge("route", "analyze")
workflow.add_edge("analyze", "decide")
```

### **LLM Usage Strategy**
- **Simple decisions** → Gemini 1.5 Flash (fast, cheap)
- **Complex RCA** → Gemini 1.5 Pro (deep reasoning)
- **Fallback** → OpenAI GPT-4o-mini (if Gemini unavailable)

### **Agent Memory**
- Uses `agent_db` to store conversation history
- Maintains context across multiple health events
- Tracks which recommendations were followed

---

## 🔗 Dependencies

### External Services Called
- **Health Service** - `GET http://health-service:8002/api/v1/health/{id}/history`
- **Warranty Service** (optional) - Check coverage before recommendations

### Infrastructure Dependencies
- **PostgreSQL** - `agent_db`
- **Redis Streams** - Event processing
- **Google Gemini API** - LLM reasoning
- **ChromaDB** (optional) - Vector similarity for past decisions

---

## ⚙️ Configuration

```env
SERVICE_NAME=agent-service
PORT=8003
DATABASE_URL=postgresql+asyncpg://user:pass@postgres:5432/agent_db
REDIS_URL=redis://redis:6379
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL_DEFAULT=gemini-1.5-flash
GEMINI_MODEL_COMPLEX=gemini-1.5-pro
HEALTH_SERVICE_URL=http://health-service:8002
DECISION_CONFIDENCE_THRESHOLD=0.7
```

---

## 🎯 Success Metrics

- **Decision Quality** - 85%+ accuracy (validated by technician feedback)
- **Response Time** - <10 seconds for agent decision (including LLM call)
- **Cost Efficiency** - Average <$0.01 per decision (LLM costs)
- **Recommendation Adoption** - 70%+ recommendations followed by users

---

## 🧪 Agent Performance Tracking

Each agent tracks:
- **Invocation count** - How often it's called
- **Average confidence** - Quality of decisions
- **LLM token usage** - Cost tracking
- **Decision adoption rate** - Were recommendations followed?

---

## 🚀 Quick Start

```bash
cd services/agent-service
pip install -r requirements.txt
cp .env.example .env

# Add your Gemini API key to .env
# GEMINI_API_KEY=your_key_here

uvicorn main:app --reload --port 8003
```

---

## 📝 Notes

- Agents maintain **stateful memory** during a session
- Decisions are **cached** for 1 hour (avoid redundant LLM calls)
- Supports **hybrid mode**: Rules handle simple cases, LLM for complex
- **Escalation rules**: If confidence <70%, escalate to human
- All LLM calls are **logged** for audit and fine-tuning
- Agents can **learn** from technician feedback (future ML training)
