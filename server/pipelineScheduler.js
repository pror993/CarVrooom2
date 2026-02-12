/**
 * Virtual Clock Scheduler + ML Pipeline Worker
 * ═══════════════════════════════════════════════
 *
 * Simulates real-time vehicle monitoring by advancing a virtual clock
 * through the stored telemetry data. Every tick (configurable interval):
 *
 *   1. Advances the virtual clock by TICK_ROWS rows (simulated 5-min readings)
 *   2. For each vehicle, fetches the rolling window up to current row index
 *   3. If enough data accumulated, calls the Unified ML API (/predict/all)
 *   4. Stores PredictionEvent in MongoDB
 *   5. If unhealthy (RUL < threshold), runs agentic orchestration → Case
 *   6. Emits WebSocket events for real-time dashboard updates
 *
 * Architecture:
 *   - In-process scheduler (setInterval) — no Redis needed for demo
 *   - Parallel vehicle processing with concurrency limit
 *   - WebSocket server on same port as Express (upgrade)
 *
 * Run:  node pipelineScheduler.js
 *       or import and attach to existing Express server
 *
 * Environment:
 *   ML_API_URL          (default: http://localhost:8000)
 *   TICK_INTERVAL_MS    (default: 10000 — 10 seconds real time = 5 min sim)
 *   TICK_ROWS           (default: 288 — advance 1 day per tick)
 *   PREDICTION_INTERVAL (default: 288 — run ML every N rows = every sim day)
 *   HEALTHY_RUL_THRESHOLD (default: 60)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { WebSocketServer } = require('ws');
const connectDB = require('./config/db');
const Vehicle = require('./models/Vehicle');
const VehicleTelemetry = require('./models/VehicleTelemetry');
const PredictionEvent = require('./models/PredictionEvent');
const Case = require('./models/Case');
const { orchestrateAgents } = require('./agents/orchestrator');

// ── Configuration ────────────────────────────────────────────────
const ML_API_URL = process.env.ML_API_URL || 'http://localhost:8000';
const TICK_INTERVAL_MS = parseInt(process.env.TICK_INTERVAL_MS || '10000');     // real-time ms between ticks
const TICK_ROWS = parseInt(process.env.TICK_ROWS || '288');                     // rows to advance per tick (288 = 1 day)
const PREDICTION_INTERVAL = parseInt(process.env.PREDICTION_INTERVAL || '288'); // run ML every N rows
const HEALTHY_RUL_THRESHOLD = parseInt(process.env.HEALTHY_RUL_THRESHOLD || '60');
const MAX_ROWS = 17280; // total rows per vehicle (60 days)
const MIN_ROWS_FOR_PREDICTION = 2016; // SCR model needs at least 2016 rows

// Fleet vehicle IDs (must match seeded vehicles)
const FLEET_VEHICLE_IDS = [
  'VH_HEALTHY',
  'VH_DPF_FAIL',
  'VH_SCR_FAIL',
  'VH_OIL_FAIL',
  'VH_ANOMALY',
  'VH_CASCADE',
];

// ── State ────────────────────────────────────────────────────────
let currentRowIndex = 0;
let tickCount = 0;
let isRunning = false;
let wss = null; // WebSocket server

// Per-vehicle state
const vehicleState = {};
FLEET_VEHICLE_IDS.forEach(id => {
  vehicleState[id] = {
    lastPredictionRow: 0,
    lastPrediction: null,
    lastCase: null,
    status: 'monitoring', // monitoring | alert | healthy
  };
});

// ── WebSocket ────────────────────────────────────────────────────
function broadcastEvent(event, data) {
  if (!wss) return;
  const message = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  });
}

// ── ML API call ──────────────────────────────────────────────────
async function callMLAPI(vehicleId, telemetryDocs) {
  const mlData = VehicleTelemetry.toMLFormat(telemetryDocs);

  const response = await fetch(`${ML_API_URL}/predict/all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: mlData }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ML API ${response.status}: ${errorText}`);
  }

  return response.json();
}

// ── Process one vehicle ──────────────────────────────────────────
async function processVehicle(vehicleId) {
  const state = vehicleState[vehicleId];

  // Check if we have enough data and it's time for a prediction
  const rowsSinceLastPrediction = currentRowIndex - state.lastPredictionRow;
  if (currentRowIndex < MIN_ROWS_FOR_PREDICTION) {
    return { vehicleId, action: 'waiting', reason: `Need ${MIN_ROWS_FOR_PREDICTION} rows, have ${currentRowIndex}` };
  }
  if (rowsSinceLastPrediction < PREDICTION_INTERVAL && state.lastPrediction) {
    return { vehicleId, action: 'skip', reason: 'Not yet time for next prediction' };
  }

  // Fetch rolling window from MongoDB
  const telemetryDocs = await VehicleTelemetry.getRowsUpTo(vehicleId, currentRowIndex);
  if (telemetryDocs.length < MIN_ROWS_FOR_PREDICTION) {
    return { vehicleId, action: 'insufficient_data', rows: telemetryDocs.length };
  }

  // Call ML API
  console.log(`   🔮 ${vehicleId}: Calling ML API with ${telemetryDocs.length} rows...`);
  const mlResult = await callMLAPI(vehicleId, telemetryDocs);

  // Store PredictionEvent
  const prediction = await PredictionEvent.create({
    vehicleId: mlResult.vehicleId,
    predictionType: mlResult.predictionType,
    confidence: mlResult.confidence,
    etaDays: mlResult.etaDays,
    signals: mlResult.signals,
    modelOutputs: mlResult.modelOutputs,
    source: mlResult.source,
  });

  state.lastPredictionRow = currentRowIndex;
  state.lastPrediction = {
    predictionId: prediction._id.toString(),
    predictionType: mlResult.predictionType,
    etaDays: mlResult.etaDays,
    confidence: mlResult.confidence,
    modelOutputs: mlResult.modelOutputs,
  };

  // Broadcast prediction update
  broadcastEvent('prediction', {
    vehicleId,
    predictionType: mlResult.predictionType,
    etaDays: mlResult.etaDays,
    confidence: mlResult.confidence,
    rowIndex: currentRowIndex,
    simDay: Math.floor(currentRowIndex / 288),
  });

  // Check if vehicle needs attention
  if (mlResult.etaDays < HEALTHY_RUL_THRESHOLD) {
    // ── ALERT PATH: Run agentic orchestration ──
    state.status = 'alert';

    console.log(`   ⚠️  ${vehicleId}: RUL ${mlResult.etaDays} days < ${HEALTHY_RUL_THRESHOLD} → running orchestration`);

    const orchResult = await orchestrateAgents(prediction._id);

    state.lastCase = orchResult.caseId;

    // Broadcast alert
    broadcastEvent('alert', {
      vehicleId,
      caseId: orchResult.caseId,
      severity: orchResult.severity,
      predictionType: mlResult.predictionType,
      etaDays: mlResult.etaDays,
      confidence: mlResult.confidence,
      state: orchResult.state,
    });

    return {
      vehicleId,
      action: 'alert',
      predictionType: mlResult.predictionType,
      etaDays: mlResult.etaDays,
      caseId: orchResult.caseId,
      severity: orchResult.severity,
    };
  } else {
    // ── HEALTHY PATH: No case needed ──
    state.status = 'healthy';

    broadcastEvent('healthy', {
      vehicleId,
      etaDays: mlResult.etaDays,
      predictionType: mlResult.predictionType,
    });

    return {
      vehicleId,
      action: 'healthy',
      etaDays: mlResult.etaDays,
    };
  }
}

// ── Tick: advance virtual clock and process all vehicles ─────────
async function tick() {
  tickCount++;
  currentRowIndex = Math.min(currentRowIndex + TICK_ROWS, MAX_ROWS);
  const simDay = Math.floor(currentRowIndex / 288);

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`⏰ TICK #${tickCount} | Row ${currentRowIndex}/${MAX_ROWS} | Simulated Day ${simDay}/60`);
  console.log(`${'═'.repeat(70)}`);

  broadcastEvent('tick', {
    tickCount,
    currentRowIndex,
    maxRows: MAX_ROWS,
    simDay,
    simDayTotal: 60,
  });

  // Process each vehicle
  const results = [];
  for (const vehicleId of FLEET_VEHICLE_IDS) {
    try {
      const result = await processVehicle(vehicleId);
      results.push(result);

      if (result.action === 'alert') {
        console.log(`   🚨 ${vehicleId}: ALERT — ${result.predictionType}, RUL=${result.etaDays}d, Case=${result.caseId}`);
      } else if (result.action === 'healthy') {
        console.log(`   🟢 ${vehicleId}: HEALTHY — RUL=${result.etaDays}d`);
      } else if (result.action === 'skip') {
        console.log(`   ⏭️  ${vehicleId}: ${result.reason}`);
      } else {
        console.log(`   ⏳ ${vehicleId}: ${result.action} — ${result.reason || ''}`);
      }
    } catch (error) {
      console.error(`   ❌ ${vehicleId}: Error — ${error.message}`);
      results.push({ vehicleId, action: 'error', error: error.message });
    }
  }

  // Broadcast summary
  broadcastEvent('tick_summary', {
    tickCount,
    simDay,
    results: results.map(r => ({
      vehicleId: r.vehicleId,
      action: r.action,
      etaDays: r.etaDays,
      severity: r.severity,
    })),
  });

  // Stop if we've reached the end of data
  if (currentRowIndex >= MAX_ROWS) {
    console.log(`\n🏁 Reached end of telemetry data (${MAX_ROWS} rows = 60 days)`);
    stop();
  }
}

// ── Start/Stop ───────────────────────────────────────────────────
let intervalHandle = null;

function start() {
  if (isRunning) {
    console.log('⚠️  Scheduler already running');
    return;
  }
  isRunning = true;
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   🚀 VIRTUAL CLOCK SCHEDULER STARTED                       ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║   Tick interval:  ${TICK_INTERVAL_MS}ms (real time)              ║`);
  console.log(`║   Rows per tick:  ${TICK_ROWS} (= ${Math.round(TICK_ROWS/288)} sim day(s))                    ║`);
  console.log(`║   Predict every:  ${PREDICTION_INTERVAL} rows                            ║`);
  console.log(`║   Total data:     ${MAX_ROWS} rows (60 days)                    ║`);
  console.log(`║   Vehicles:       ${FLEET_VEHICLE_IDS.length}                                        ║`);
  console.log(`║   ML API:         ${ML_API_URL}                   ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Run first tick immediately
  tick().then(() => {
    if (isRunning) {
      intervalHandle = setInterval(() => tick(), TICK_INTERVAL_MS);
    }
  });
}

function stop() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  isRunning = false;
  console.log('\n🛑 Virtual Clock Scheduler stopped');
}

function getState() {
  return {
    isRunning,
    tickCount,
    currentRowIndex,
    maxRows: MAX_ROWS,
    simDay: Math.floor(currentRowIndex / 288),
    vehicles: { ...vehicleState },
  };
}

function reset() {
  stop();
  currentRowIndex = 0;
  tickCount = 0;
  FLEET_VEHICLE_IDS.forEach(id => {
    vehicleState[id] = {
      lastPredictionRow: 0,
      lastPrediction: null,
      lastCase: null,
      status: 'monitoring',
    };
  });
  console.log('🔄 Scheduler state reset');
}

// ── Attach to Express + WebSocket ────────────────────────────────
function attachToServer(server) {
  wss = new WebSocketServer({ server, path: '/ws/pipeline' });

  wss.on('connection', (ws) => {
    console.log('🔌 WebSocket client connected');

    // Send current state on connect
    ws.send(JSON.stringify({
      event: 'state',
      data: getState(),
      timestamp: new Date().toISOString(),
    }));

    ws.on('close', () => {
      console.log('🔌 WebSocket client disconnected');
    });

    ws.on('message', (message) => {
      try {
        const msg = JSON.parse(message);
        if (msg.action === 'start') start();
        if (msg.action === 'stop') stop();
        if (msg.action === 'reset') reset();
        if (msg.action === 'state') {
          ws.send(JSON.stringify({
            event: 'state',
            data: getState(),
            timestamp: new Date().toISOString(),
          }));
        }
      } catch (e) {
        console.error('WS message parse error:', e.message);
      }
    });
  });

  console.log('🔌 WebSocket server attached at /ws/pipeline');
}

// ── Standalone mode ──────────────────────────────────────────────
if (require.main === module) {
  (async () => {
    await connectDB();
    console.log('✅ MongoDB connected\n');

    // Check ML API health
    try {
      const healthRes = await fetch(`${ML_API_URL}/health`);
      const health = await healthRes.json();
      console.log('✅ ML API healthy:', health);
    } catch (e) {
      console.error('❌ ML API not available at', ML_API_URL);
      console.error('   Start it: cd models && uvicorn unified_api:app --port 8000');
      process.exit(1);
    }

    // Check telemetry data exists
    const telCount = await VehicleTelemetry.countDocuments();
    if (telCount === 0) {
      console.error('❌ No telemetry data. Run: node seedFleetVehicles.js');
      process.exit(1);
    }
    console.log(`✅ Telemetry data: ${telCount.toLocaleString()} rows\n`);

    // Start scheduler (no WebSocket in standalone mode)
    start();
  })();
}

module.exports = {
  start,
  stop,
  reset,
  getState,
  attachToServer,
  FLEET_VEHICLE_IDS,
};
