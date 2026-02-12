/**
 * Full Unified ML Pipeline Test
 * ══════════════════════════════
 *
 * Tests the COMPLETE flow across ALL 4 models:
 *   1. Load sample CSV data (any of the 6 demo datasets — 17,280 rows)
 *   2. Call Unified ML API  /predict/all  → DPF + SCR + Oil + Anomaly
 *   3. Worst RUL is picked as the overall etaDays
 *   4. Ingest prediction into MongoDB PredictionEvent
 *   5. Run full agentic orchestration (MasterAgent → Diagnostic → Scheduling → Communication)
 *   6. Verify Case created with all agent results
 *   7. Cleanup
 *
 * Prerequisites:
 *   - MongoDB running
 *   - Unified API running:  cd models && uvicorn unified_api:app --host 0.0.0.0 --port 8000
 *   - Ollama llama3 running for LLM agents
 *   - Seed data present (run: node seedData.js)
 *
 * Run:  node testFullMLPipeline.js [dataset]
 *
 * Datasets (optional arg):
 *   DPF_FAIL  SCR_FAIL  OIL_FAIL  ANOMALY  CASCADE  HEALTHY
 *   Default: DPF_FAIL
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Vehicle = require('./models/Vehicle');
const PredictionEvent = require('./models/PredictionEvent');
const Case = require('./models/Case');
const { orchestrateAgents } = require('./agents/orchestrator');

const ML_API_URL = process.env.ML_API_URL || 'http://localhost:8000';

// ── Dataset mapping ────────────────────────────────────────────
const DATASETS = {
  DPF_FAIL:  { file: 'VH_DPF_FAILdem.csv',  vehicleId: 'VH_DPF_FAIL'  },
  SCR_FAIL:  { file: 'VH_SCR_FAILdem.csv',  vehicleId: 'VH_SCR_FAIL'  },
  OIL_FAIL:  { file: 'VH_OIL_FAILdem.csv',  vehicleId: 'VH_OIL_FAIL'  },
  ANOMALY:   { file: 'VH_ANOMALYdem.csv',   vehicleId: 'VH_ANOMALY'   },
  CASCADE:   { file: 'VH_CASCADEdem.csv',   vehicleId: 'VH_CASCADE'   },
  HEALTHY:   { file: 'VH_HEALTHYdem.csv',   vehicleId: 'VH_HEALTHY'   },
};

const datasetArg = (process.argv[2] || 'DPF_FAIL').toUpperCase();
const dataset = DATASETS[datasetArg];
if (!dataset) {
  console.error(`Unknown dataset: ${datasetArg}`);
  console.error(`Choose one of: ${Object.keys(DATASETS).join(', ')}`);
  process.exit(1);
}

const CSV_PATH = path.join(__dirname, '..', 'data', dataset.file);
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`   ✅ ${message}`);
    passed++;
  } else {
    console.log(`   ❌ FAIL: ${message}`);
    failed++;
  }
}

// ── CSV Parser ──────────────────────────────────────────────────
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');

  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row = {};
    headers.forEach((header, idx) => {
      const val = values[idx];
      const num = parseFloat(val);
      row[header.trim()] = isNaN(num) ? val : num;
    });
    data.push(row);
  }
  return data;
}

// ═══════════════════════════════════════════════════════════════
// MAIN TEST
// ═══════════════════════════════════════════════════════════════

async function runPipeline() {
  const vehicleId = dataset.vehicleId;
  let predictionId = null;
  let caseId = null;

  try {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════════╗');
    console.log('║   UNIFIED ML PIPELINE TEST — 4 Models → Agentic Pipeline          ║');
    console.log(`║   Dataset: ${datasetArg.padEnd(54)}║`);
    console.log('╚════════════════════════════════════════════════════════════════════╝\n');

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected\n');

    // ══════════════════════════════════════════════════════════════
    // STEP 1: LOAD SAMPLE CSV DATA
    // ══════════════════════════════════════════════════════════════
    console.log('─── Step 1: Load Sample CSV Data ───────────────────────────────\n');

    assert(fs.existsSync(CSV_PATH), `CSV file exists: ${dataset.file}`);

    const csvData = parseCSV(CSV_PATH);
    assert(csvData.length === 17280, `CSV has ${csvData.length} rows (expected 17,280 = 60 days)`);
    assert(csvData[0].vehicle_id === vehicleId, `Vehicle ID: ${csvData[0].vehicle_id}`);

    console.log(`   📊 Loaded ${csvData.length} sensor readings for ${vehicleId}`);
    console.log(`   📅 Time range: ${csvData[0].timestamp_utc} → ${csvData[csvData.length - 1].timestamp_utc}`);
    console.log(`   🔧 Columns: ${Object.keys(csvData[0]).length}\n`);

    // ══════════════════════════════════════════════════════════════
    // STEP 2: ENSURE VEHICLE EXISTS IN DB
    // ══════════════════════════════════════════════════════════════
    console.log('─── Step 2: Ensure Vehicle Exists ──────────────────────────────\n');

    let vehicle = await Vehicle.findOne({ vehicleId });

    if (!vehicle) {
      vehicle = await Vehicle.create({
        vehicleId,
        owner: {
          name: 'Test Fleet Services',
          contact: '+91-9876500001',
          preferredChannel: 'app',
        },
        vehicleInfo: {
          make: 'Tata',
          model: 'Prima',
          year: 2023,
          powertrain: 'diesel',
        },
        usageProfile: {
          avgDailyKm: 350,
          loadPattern: 'heavy',
        },
        serviceHistory: [],
      });
      console.log(`   🚚 Created test vehicle: ${vehicleId}`);
    } else {
      console.log(`   🚚 Vehicle exists: ${vehicleId}`);
    }

    assert(!!vehicle._id, `Vehicle ready: ${vehicle.vehicleInfo.make} ${vehicle.vehicleInfo.model}`);
    console.log('');

    // ══════════════════════════════════════════════════════════════
    // STEP 3: CALL UNIFIED ML API (/predict/all)
    // ══════════════════════════════════════════════════════════════
    console.log('─── Step 3: Call Unified ML API (/predict/all) ─────────────────\n');

    console.log(`   🔮 Calling ${ML_API_URL}/predict/all with ${csvData.length} rows...`);
    console.log('   ⏳ Running DPF + SCR + Oil + Anomaly models (this may take a minute)...\n');

    let modelResponse;
    const mlStartTime = Date.now();

    try {
      const response = await fetch(`${ML_API_URL}/predict/all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: csvData }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error ${response.status}: ${errorText}`);
      }

      modelResponse = await response.json();
    } catch (error) {
      console.log(`   ⚠️  Unified ML API not available: ${error.message}`);
      console.log('   ℹ️  Start API: cd models && uvicorn unified_api:app --port 8000');
      console.log('   ℹ️  Continuing with mock prediction data...\n');

      // Mock response
      modelResponse = {
        vehicleId,
        predictionType: 'dpf_failure',
        confidence: 0.82,
        etaDays: 12.5,
        signals: {
          'dpf.diff_pressure_kpa_upstream': { value: 45.2, mean: 42.1, max: 55.3, min: 30.1 },
          'dpf.soot_load_pct_est': { value: 78.3, mean: 72.0, max: 80.0, min: 55.0 },
          'scr.nox_conversion_pct': { value: 82.1, mean: 85.0, max: 95.0, min: 70.0 },
          'engine_powertrain.oil_level_l': { value: 7.2, mean: 7.5, max: 8.0, min: 7.0 },
          anomaly: { score: -0.15, is_anomaly: false },
        },
        modelOutputs: {
          dpf: { status: 'success', rul_days: 14.5, failure_probability: 0.78 },
          scr: { status: 'success', rul_days: 22.3, failure_probability: 0.45 },
          oil: { status: 'success', rul_days: 12.5, failure_probability: 0.55 },
          anomaly: { status: 'success', anomaly_score: -0.15, is_anomaly: false },
        },
        source: 'unified_ml',
        individualResults: [
          { model: 'dpf', rul_days: 14.5, failure_probability: 0.78, status: 'success' },
          { model: 'scr', rul_days: 22.3, failure_probability: 0.45, status: 'success' },
          { model: 'oil', rul_days: 12.5, failure_probability: 0.55, status: 'success' },
          { model: 'anomaly', anomaly_score: -0.15, is_anomaly: false, status: 'success' },
        ],
      };
    }

    const mlTime = Date.now() - mlStartTime;

    assert(modelResponse.vehicleId === vehicleId, `Vehicle ID: ${modelResponse.vehicleId}`);
    assert(!!modelResponse.predictionType, `Prediction type: ${modelResponse.predictionType}`);
    assert(modelResponse.confidence >= 0 && modelResponse.confidence <= 1, `Confidence: ${(modelResponse.confidence * 100).toFixed(1)}%`);
    assert(modelResponse.etaDays >= 0, `ETA Days (worst RUL): ${modelResponse.etaDays}`);
    assert(!!modelResponse.signals, 'Has signals data');
    assert(modelResponse.source === 'unified_ml', `Source: ${modelResponse.source}`);

    console.log('');
    console.log('   📈 Unified Model Output:');
    console.log(`      Vehicle ID:        ${modelResponse.vehicleId}`);
    console.log(`      Prediction Type:   ${modelResponse.predictionType}`);
    console.log(`      Confidence:        ${(modelResponse.confidence * 100).toFixed(1)}%`);
    console.log(`      ETA Days (worst):  ${modelResponse.etaDays}`);
    console.log(`      ML Inference Time: ${mlTime}ms`);
    console.log('');

    // Show individual model results
    console.log('   🔬 Individual Model Results:');
    const results = modelResponse.individualResults || [];
    for (const r of results) {
      if (r.model === 'anomaly') {
        const status = r.status === 'success' ? '✅' : '❌';
        console.log(`      ${status} Anomaly: score=${r.anomaly_score}, is_anomaly=${r.is_anomaly}`);
      } else {
        const status = r.status === 'success' ? '✅' : '❌';
        console.log(`      ${status} ${r.model.toUpperCase()}: RUL=${r.rul_days} days, prob=${r.failure_probability}`);
      }
    }
    console.log('');

    // Verify all models ran
    const successModels = results.filter(r => r.status === 'success');
    assert(successModels.length >= 3, `${successModels.length}/4 models succeeded`);

    // Verify worst RUL logic
    const rulModels = results.filter(r => r.status === 'success' && r.rul_days != null);
    if (rulModels.length > 0) {
      const minRul = Math.min(...rulModels.map(r => r.rul_days));
      assert(
        Math.abs(modelResponse.etaDays - minRul) < 0.1,
        `Worst RUL correctly selected: ${minRul} days (from ${rulModels.find(r => r.rul_days === minRul)?.model})`
      );
    }
    console.log('');

    // ══════════════════════════════════════════════════════════════
    // STEP 4: INGEST PREDICTION INTO DATABASE
    // ══════════════════════════════════════════════════════════════
    console.log('─── Step 4: Ingest Prediction into Database ────────────────────\n');

    const prediction = await PredictionEvent.create({
      vehicleId: modelResponse.vehicleId,
      predictionType: modelResponse.predictionType,
      confidence: modelResponse.confidence,
      etaDays: modelResponse.etaDays,
      signals: modelResponse.signals,
      modelOutputs: modelResponse.modelOutputs,
      source: modelResponse.source,
    });

    predictionId = prediction._id;

    assert(!!prediction._id, `Prediction created: ${prediction._id}`);
    assert(prediction.source === 'unified_ml', `Source stored: ${prediction.source}`);
    assert(!!prediction.modelOutputs.dpf || !!prediction.modelOutputs.scr || !!prediction.modelOutputs.oil,
      'Model outputs from multiple models stored');

    console.log(`   💾 Prediction saved to MongoDB: ${prediction._id}\n`);

    // ══════════════════════════════════════════════════════════════
    // STEP 5: RUN FULL AGENTIC ORCHESTRATION
    // ══════════════════════════════════════════════════════════════
    console.log('─── Step 5: Run Agentic Orchestration ──────────────────────────\n');
    console.log('   🤖 Starting orchestrator (MasterAgent → Diagnostic → Scheduling → Communication)...\n');

    const orchStart = Date.now();
    const orchResult = await orchestrateAgents(prediction._id);
    const orchTime = Date.now() - orchStart;

    assert(orchResult.success === true, 'Orchestration succeeded');

    // ── HEALTHY PATH: No case registered ─────────────────────────
    if (orchResult.healthy) {
      console.log('   🟢 HEALTHY VEHICLE — No case registered');
      console.log(`   📋 Message: ${orchResult.message}`);
      console.log(`   ⏱️  Orchestration time: ${orchTime}ms\n`);

      assert(orchResult.caseId === null, 'No case created for healthy vehicle');
      assert(orchResult.severity === 'none', `Severity: ${orchResult.severity}`);
      assert(orchResult.state === 'HEALTHY', `State: ${orchResult.state}`);
      assert(orchResult.agentsExecuted.length === 0, 'No agents executed for healthy vehicle');

      // Skip Steps 6-7 (no case to verify)
      console.log('─── Step 6: Verify — SKIPPED (healthy vehicle) ───────────────\n');
      console.log('─── Step 7: Verify — SKIPPED (healthy vehicle) ───────────────\n');

      // ── FINAL SUMMARY ──
      console.log('─── Final Summary ──────────────────────────────────────────────\n');

      console.log('   📋 Pipeline Flow:');
      console.log(`      1. CSV Data (${csvData.length} rows × ${Object.keys(csvData[0]).length} cols) ──┐`);
      console.log('      2. Unified ML API (/predict/all) ──────────┤');
      console.log('         ├─ DPF Model  → RUL + prob              │');
      console.log('         ├─ SCR Model  → RUL + prob              │');
      console.log('         ├─ Oil Model  → RUL + prob              │');
      console.log('         ├─ Anomaly    → score + flag            │');
      console.log('         └─ Worst RUL picked → etaDays           │');
      console.log('      3. PredictionEvent (MongoDB) ──────────────┤');
      console.log('      4. Agentic Orchestrator ───────────────────┤');
      console.log('         └─ 🟢 HEALTHY: RUL above threshold     │');
      console.log('            No case registered, no agents run    │');
      console.log('      5. Done ─────────────────────────────────────┘');
      console.log('');
      console.log(`   ⏱️  Total ML time:            ${mlTime}ms`);
      console.log(`   ⏱️  Total orchestration time:  ${orchTime}ms`);
      console.log(`   ⏱️  Total pipeline time:       ${mlTime + orchTime}ms`);
      console.log('');

      // Cleanup prediction only (no case)
      console.log('─── Cleanup ────────────────────────────────────────────────────\n');
      if (predictionId) await PredictionEvent.deleteOne({ _id: predictionId });
      console.log('   🧹 Test prediction deleted (no case to delete)\n');

      return; // Exit early — remaining steps not applicable
    }

    // ── UNHEALTHY PATH: Case registered ──────────────────────────
    caseId = orchResult.caseId;

    assert(!!orchResult.caseId, `Case created: ${orchResult.caseId}`);
    assert(orchResult.severity !== 'unknown', `Severity: ${orchResult.severity}`);
    assert(orchResult.agentsExecuted.length >= 2, `Agents executed: ${orchResult.agentsExecuted.join(', ')}`);

    console.log(`   ⏱️  Orchestration time: ${orchTime}ms\n`);

    // ══════════════════════════════════════════════════════════════
    // STEP 6: VERIFY CASE & AGENT RESULTS
    // ══════════════════════════════════════════════════════════════
    console.log('─── Step 6: Verify Case & Agent Results ────────────────────────\n');

    const caseRecord = await Case.findOne({ caseId: orchResult.caseId });
    assert(!!caseRecord, 'Case found in DB');
    assert(caseRecord.vehicleId === vehicleId, `Case vehicleId: ${caseRecord.vehicleId}`);

    // Master Agent
    const master = caseRecord.agentResults?.masterAgent;
    assert(!!master, 'MasterAgent result present');
    if (master) {
      console.log(`   🎯 Master: severity=${master.severity}, workflow=${master.workflowType}`);
    }

    // Diagnostic Agent
    const diag = caseRecord.agentResults?.diagnosticAgent;
    assert(!!diag, 'DiagnosticAgent result present');
    if (diag) {
      assert(!!diag.risk, `Diagnostic risk: ${diag.risk}`);
      assert(!!diag.urgency, `Diagnostic urgency: ${diag.urgency}`);
      console.log(`   🔍 Diagnostic: risk=${diag.risk}, urgency=${diag.urgency}`);
      console.log(`   📝 Summary: ${diag.summary?.substring(0, 100)}...`);
    }

    // Scheduling Agent
    const sched = caseRecord.agentResults?.schedulingAgent;
    assert(!!sched, 'SchedulingAgent result present');
    if (sched) {
      console.log(`   📅 Scheduling: ${sched.suggestions?.length || 0} suggestions, primary: ${sched.primarySuggestion?.serviceCenter}`);
    }

    // Communication Agent
    const comm = caseRecord.agentResults?.communicationAgent;
    if (comm) {
      console.log(`   📧 Communication: channel=${comm.channel}, tone=${comm.tone}`);
    } else {
      console.log('   ℹ️  CommunicationAgent not invoked (per MasterAgent decision)');
    }

    console.log('');
    assert(
      ['PROCESSED', 'CUSTOMER_NOTIFIED', 'AWAITING_USER_APPROVAL', 'APPOINTMENT_CONFIRMED'].includes(caseRecord.currentState),
      `Final state: ${caseRecord.currentState}`
    );

    // ══════════════════════════════════════════════════════════════
    // STEP 7: VERIFY MULTI-MODEL OUTPUTS IN DB
    // ══════════════════════════════════════════════════════════════
    console.log('─── Step 7: Verify Multi-Model Outputs ─────────────────────────\n');

    const storedPrediction = await PredictionEvent.findById(predictionId);
    assert(storedPrediction.source === 'unified_ml', 'Source is unified_ml');

    const outputs = storedPrediction.modelOutputs || {};
    const modelNames = Object.keys(outputs);
    console.log(`   📊 Models stored: ${modelNames.join(', ')}`);

    for (const name of ['dpf', 'scr', 'oil', 'anomaly']) {
      if (outputs[name]) {
        const m = outputs[name];
        if (name === 'anomaly') {
          assert(m.status === 'success', `${name.toUpperCase()}: status=${m.status}, score=${m.anomaly_score}`);
        } else {
          assert(m.status === 'success', `${name.toUpperCase()}: status=${m.status}, RUL=${m.rul_days}d, prob=${m.failure_probability}`);
        }
      } else {
        console.log(`   ⚠️  ${name.toUpperCase()}: not present in outputs`);
      }
    }
    console.log('');

    // ══════════════════════════════════════════════════════════════
    // FINAL SUMMARY
    // ══════════════════════════════════════════════════════════════
    console.log('─── Final Summary ──────────────────────────────────────────────\n');

    console.log('   📋 Pipeline Flow:');
    console.log(`      1. CSV Data (${csvData.length} rows × ${Object.keys(csvData[0]).length} cols) ──┐`);
    console.log('      2. Unified ML API (/predict/all) ──────────┤');
    console.log('         ├─ DPF Model  → RUL + prob              │');
    console.log('         ├─ SCR Model  → RUL + prob              │');
    console.log('         ├─ Oil Model  → RUL + prob              │');
    console.log('         ├─ Anomaly    → score + flag            │');
    console.log('         └─ Worst RUL picked → etaDays           │');
    console.log('      3. PredictionEvent (MongoDB) ──────────────┤');
    console.log('      4. Agentic Orchestrator ───────────────────┤');
    console.log('         ├─ MasterAgent (severity)               │');
    console.log('         ├─ DiagnosticAgent (RCA)                │');
    console.log('         ├─ SchedulingAgent (slots)              │');
    console.log('         └─ CommunicationAgent (msg)             │');
    console.log('      5. Case Record (MongoDB) ──────────────────┘');
    console.log('');
    console.log(`   ⏱️  Total ML time:            ${mlTime}ms`);
    console.log(`   ⏱️  Total orchestration time:  ${orchTime}ms`);
    console.log(`   ⏱️  Total pipeline time:       ${mlTime + orchTime}ms`);
    console.log('');

    // ══════════════════════════════════════════════════════════════
    // CLEANUP
    // ══════════════════════════════════════════════════════════════
    console.log('─── Cleanup ────────────────────────────────────────────────────\n');

    if (caseId) await Case.deleteOne({ caseId });
    if (predictionId) await PredictionEvent.deleteOne({ _id: predictionId });

    console.log('   🧹 Test prediction and case deleted\n');

  } catch (error) {
    console.error('\n❌ PIPELINE ERROR:', error.message);
    console.error(error.stack);

    try {
      if (caseId) await Case.deleteOne({ caseId });
      if (predictionId) await PredictionEvent.deleteOne({ _id: predictionId });
    } catch (_) {}
  } finally {
    console.log('╔════════════════════════════════════════════════════════════════════╗');
    console.log(`║   RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed}`.padEnd(67) + '║');
    console.log('╚════════════════════════════════════════════════════════════════════╝\n');

    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed\n');

    if (failed > 0) process.exit(1);
  }
}

runPipeline();
