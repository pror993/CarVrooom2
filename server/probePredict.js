const dotenv = require('dotenv');
dotenv.config();

const VehicleTelemetry = require('./models/VehicleTelemetry');
const connectDB = require('./config/db');


const ML_API_URL = process.env.ML_API_URL || 'http://localhost:8000';
const VEHICLE_ID = process.env.VEHICLE_ID || 'VH_HEALTHY';
const ROW_INDEX = parseInt(process.env.ROW_INDEX || '3168', 10); // ~day 11 by default

if (!process.env.MONGODB_URI) {
  console.error('❌ Missing MONGODB_URI. Set it in your environment or .env before running this probe.');
  console.error('   Example: MONGODB_URI="mongodb+srv://..." VEHICLE_ID=VH_HEALTHY ROW_INDEX=3168 node probePredict.js');
  process.exit(1);
}

(async () => {
  await connectDB();

  // Change VEHICLE_ID via env to test: VH_HEALTHY, VH_DPF_FAIL, VH_SCR_FAIL, VH_OIL_FAIL, VH_ANOMALY, VH_CASCADE
  const vehicleId = VEHICLE_ID;

  // Use ROW_INDEX to control how many rows to include (default ~day 11)
  const rows = await VehicleTelemetry.getRowsUpTo(vehicleId, ROW_INDEX);
  if (!rows || rows.length === 0) {
    console.error('No telemetry rows returned. Seed data may be missing — try: node seedFleetVehicles.js');
    process.exit(1);
  }

  const mlData = VehicleTelemetry.toMLFormat(rows);

  // Node 22 has global fetch; no need for node-fetch
  const res = await fetch(`${ML_API_URL}/predict/all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: mlData }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`ML API ${res.status}: ${txt}`);
  }

  const json = await res.json();
  const summary = {
    vehicleId: json.vehicleId,
    predictionType: json.predictionType,
    confidence: json.confidence,
    etaDays: json.etaDays,
    oilGate: json.modelOutputs?.oil?.details?.oil_gate_metrics || null,
    gateInfo: {
      confidenceGate: 0.65,
      oilLevelChangeHealthy: 0.15,
      oilPressureSlopeHealthy: -0.00001,
    },
    models: Object.fromEntries(
      Object.entries(json.modelOutputs || {}).map(([k, v]) => [
        k,
        { rul_days: v.rul_days, failure_probability: v.failure_probability },
      ])
    ),
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
