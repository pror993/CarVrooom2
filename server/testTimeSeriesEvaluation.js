/**
 * Time Series Evaluation for all 6 vehicles
 * - Iterates through simulated time (rowIndex) and calls Unified ML API
 * - Compares predicted failure type against expected dataset assignment
 * - Prints detailed per-tick logs and a final summary per vehicle
 */

require('dotenv').config();
const connectDB = require('./config/db');
const VehicleTelemetry = require('./models/VehicleTelemetry');
const { FLEET_VEHICLE_IDS } = require('./pipelineScheduler');

let __fetch = null;
async function getFetch() {
  if (!__fetch) {
    const mod = await import('node-fetch');
    __fetch = mod.default;
  }
  return __fetch;
}

const ML_API_URL = process.env.ML_API_URL || 'http://localhost:8000';
const HEALTHY_RUL_THRESHOLD = parseInt(process.env.HEALTHY_RUL_THRESHOLD || '60');
const MAX_ROWS = 17280; // 60 days total
const MIN_ROWS_FOR_PREDICTION = 2016;
const STEP = 288; // 1 day per step
const TEST_DAYS = 5; // QUICK TEST: Only test 5 days
const START_DAY = 52; // Start from day 52 where failures are critical
const START_ROW = START_DAY * 288; // Row index to start testing from

const EXPECTED = {
  VH_HEALTHY: 'healthy',
  VH_DPF_FAIL: 'dpf_failure',
  VH_SCR_FAIL: 'scr_failure',
  VH_OIL_FAIL: 'oil_failure',
  VH_ANOMALY: 'anomaly',
  VH_CASCADE: 'cascade_failure',
};

async function callMLAPI(mlData, attempt = 1) {
  try {
    const fetch = await getFetch();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(`${ML_API_URL}/predict/all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: mlData }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ML API ${res.status}: ${text}`);
    }
    return res.json();
  } catch (e) {
    if (attempt < 3) {
      console.warn(`⚠️  ML API fetch failed (attempt ${attempt}): ${e.message}. Retrying...`);
      await new Promise(r => setTimeout(r, 1000 * attempt));
      return callMLAPI(mlData, attempt + 1);
    }
    throw e;
  }
}

function summarizeModelOutputs(modelOutputs) {
  const fmt = (n) => (typeof n === 'number' ? Number(n).toFixed(2) : n);
  const dpf = modelOutputs?.dpf || {};
  const scr = modelOutputs?.scr || {};
  const oil = modelOutputs?.oil || {};
  const anom = modelOutputs?.anomaly || {};
  return {
    dpf: { rul_days: fmt(dpf.rul_days), prob: fmt(dpf.failure_probability) },
    scr: { rul_days: fmt(scr.rul_days), prob: fmt(scr.failure_probability) },
    oil: { rul_days: fmt(oil.rul_days), prob: fmt(oil.failure_probability) },
    anomaly: { score: fmt(anom.anomaly_score), is_anomaly: anom.is_anomaly },
  };
}

async function evaluateVehicle(vehicleId) {
  const expected = EXPECTED[vehicleId];
  const summary = {
    vehicleId,
    expected,
    ticks: 0,
    healthyTicks: 0,
    failureTicks: 0,
    mismatchTicks: 0,
    details: [],
  };

  const totalTicks = TEST_DAYS; // Only test TEST_DAYS days
  let currentTick = 0;

  for (let rowIndex = START_ROW; rowIndex <= MAX_ROWS && currentTick < TEST_DAYS; rowIndex += STEP) {
    currentTick++;
    console.log(`\n[${vehicleId}] Processing day ${Math.floor(rowIndex / 288)} (tick ${currentTick}/${totalTicks})...`);
    const docs = await VehicleTelemetry.getRowsUpTo(vehicleId, rowIndex);
    if (docs.length < MIN_ROWS_FOR_PREDICTION) continue;

    const mlData = VehicleTelemetry.toMLFormat(docs);
    const res = await callMLAPI(mlData);

    const { predictionType, etaDays, confidence, modelOutputs } = res;
    const models = summarizeModelOutputs(modelOutputs);

    summary.ticks++;
    const simDay = Math.floor(rowIndex / 288);

    // Decide expected vs actual
    let mismatch = false;
    let reason = '';

    if (expected === 'healthy') {
      // Expect consistently healthy (RUL >= threshold)
      if (etaDays < HEALTHY_RUL_THRESHOLD) {
        mismatch = true;
        reason = `Expected healthy (RUL>=${HEALTHY_RUL_THRESHOLD}) but got ${predictionType} with RUL=${etaDays}`;
      } else {
        summary.healthyTicks++;
      }
    } else if (expected === 'anomaly') {
      // Expect anomaly flag, and non-specific failure type shouldn't dominate
      const isAnom = !!(modelOutputs?.anomaly?.is_anomaly);
      if (!isAnom) {
        mismatch = true;
        reason = `Expected anomaly=true but got anomaly=${isAnom}`;
      } else {
        summary.failureTicks++;
        // Allow any failure type while anomaly is present, but log if type seems off
        if (predictionType && !['dpf_failure','scr_failure','oil_failure','cascade_failure'].includes(predictionType)) {
          mismatch = true;
          reason = `Unknown prediction type: ${predictionType}`;
        }
      }
    } else {
      // Expect the assigned failure type when etaDays indicates attention
      if (etaDays < HEALTHY_RUL_THRESHOLD) {
        summary.failureTicks++;
        if (predictionType !== expected) {
          mismatch = true;
          reason = `Expected ${expected} but got ${predictionType}`;
        }
      } else {
        summary.healthyTicks++;
        // If model reports a different type while healthy, warn but don't count mismatch
        if (predictionType !== expected) {
          reason = `Note: While healthy (RUL=${etaDays}), type reported as ${predictionType}, expected ${expected}`;
        }
      }
    }

    if (mismatch) summary.mismatchTicks++;

    // Detailed log per tick
    console.log(`  ✓ Day ${simDay} | RUL=${etaDays} | type=${predictionType} | conf=${confidence}`);
    console.log(`    DPF: RUL=${models.dpf.rul_days} prob=${models.dpf.prob} | SCR: RUL=${models.scr.rul_days} prob=${models.scr.prob} | OIL: RUL=${models.oil.rul_days} prob=${models.oil.prob}`);
    console.log(`    ANOMALY: score=${models.anomaly.score} is_anomaly=${models.anomaly.is_anomaly}`);
    if (reason) console.log(`    👉 ${reason}`);

    summary.details.push({ day: simDay, rowIndex, etaDays, predictionType, confidence, models, mismatch, reason });
  }

  return summary;
}

(async () => {
  try {
    await connectDB();
    console.log('✅ Connected to MongoDB');

    const results = [];
    for (const vid of FLEET_VEHICLE_IDS) {
      console.log(`\n═══════════════════════════════════════════════════════\nEvaluating ${vid} (expected=${EXPECTED[vid]})\n═══════════════════════════════════════════════════════`);
      const r = await evaluateVehicle(vid);
      results.push(r);
    }

    console.log('\n\n=================== SUMMARY ===================');
    for (const r of results) {
      console.log(`\n${r.vehicleId} expected=${r.expected} | ticks=${r.ticks} | healthy=${r.healthyTicks} | failure=${r.failureTicks} | mismatches=${r.mismatchTicks}`);
      if (r.mismatchTicks > 0) {
        const examples = r.details.filter(d => d.mismatch).slice(0, 3);
        examples.forEach(ex => {
          console.log(`  - Day ${ex.day}: type=${ex.predictionType} RUL=${ex.etaDays} — ${ex.reason}`);
        });
      }
    }

    console.log('\n✅ Evaluation complete');
    process.exit(0);
  } catch (e) {
    console.error('❌ Evaluation error:', e.message);
    process.exit(1);
  }
})();
