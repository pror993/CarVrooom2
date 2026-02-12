/**
 * Seed Fleet Vehicles + Telemetry Data
 * ═════════════════════════════════════
 *
 * Creates 6 vehicles under the existing Haryana fleet owner and
 * loads their time-series telemetry data from the CSV files into MongoDB.
 *
 * Vehicles:
 *   VH_HEALTHY   – Healthy baseline vehicle
 *   VH_DPF_FAIL  – DPF failure scenario
 *   VH_SCR_FAIL  – SCR failure scenario
 *   VH_OIL_FAIL  – Oil failure scenario
 *   VH_ANOMALY   – Anomaly detection scenario
 *   VH_CASCADE   – Cascade (multi-system) failure
 *
 * Each CSV has 17,280 rows (60 days × 288 readings/day at 5-min intervals).
 *
 * Prerequisites:
 *   - MongoDB accessible (MONGODB_URI in .env)
 *   - seedData.js already run (fleet owner exists)
 *
 * Run:  node seedFleetVehicles.js [--force]
 *       --force  drops existing telemetry & vehicles and re-seeds
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const connectDB = require('./config/db');
const Vehicle = require('./models/Vehicle');
const VehicleTelemetry = require('./models/VehicleTelemetry');
const UserProfile = require('./models/UserProfile');

// ── Vehicle definitions ──────────────────────────────────────────
const FLEET_VEHICLES = [
  {
    vehicleId: 'VH_HEALTHY',
    csv: 'VH_HEALTHYdem.csv',
    vehicleInfo: { make: 'Tata', model: 'Prima 4928.S', year: 2023, powertrain: 'diesel' },
    usageProfile: { avgDailyKm: 380, loadPattern: 'heavy' },
    description: 'Healthy baseline — all systems nominal',
  },
  {
    vehicleId: 'VH_DPF_FAIL',
    csv: 'VH_DPF_FAILdem.csv',
    vehicleInfo: { make: 'Tata', model: 'Prima 4928.S', year: 2022, powertrain: 'diesel' },
    usageProfile: { avgDailyKm: 420, loadPattern: 'heavy' },
    description: 'DPF degradation — soot buildup, failed regens',
  },
  {
    vehicleId: 'VH_SCR_FAIL',
    csv: 'VH_SCR_FAILdem.csv',
    vehicleInfo: { make: 'Tata', model: 'Signa 4825.TK', year: 2023, powertrain: 'diesel' },
    usageProfile: { avgDailyKm: 350, loadPattern: 'heavy' },
    description: 'SCR degradation — NOx conversion dropping',
  },
  {
    vehicleId: 'VH_OIL_FAIL',
    csv: 'VH_OIL_FAILdem.csv',
    vehicleInfo: { make: 'Tata', model: 'Prima 4028.S', year: 2021, powertrain: 'diesel' },
    usageProfile: { avgDailyKm: 300, loadPattern: 'normal' },
    description: 'Oil degradation — fuel dilution, pressure drop',
  },
  {
    vehicleId: 'VH_ANOMALY',
    csv: 'VH_ANOMALYdem.csv',
    vehicleInfo: { make: 'Ashok Leyland', model: 'Captain 2523', year: 2023, powertrain: 'diesel' },
    usageProfile: { avgDailyKm: 280, loadPattern: 'normal' },
    description: 'Anomalous sensor patterns',
  },
  {
    vehicleId: 'VH_CASCADE',
    csv: 'VH_CASCADEdem.csv',
    vehicleInfo: { make: 'Tata', model: 'Prima 5530.S', year: 2022, powertrain: 'diesel' },
    usageProfile: { avgDailyKm: 450, loadPattern: 'heavy' },
    description: 'Cascade failure — DPF + SCR degrading together',
  },
];

// ── CSV column → sensor field mapping ────────────────────────────
const COL_MAP = {
  'engine_powertrain.engine_load_pct':          'engine_load_pct',
  'engine_powertrain.engine_rpm':               'engine_rpm',
  'vehicle_dynamics.speed_kmh':                 'speed_kmh',
  'engine_powertrain.oil_level_l':              'oil_level_l',
  'engine_powertrain.oil_pressure_bar':         'oil_pressure_bar',
  'engine_powertrain.oil_temp_c':               'oil_temp_c',
  'vehicle_dynamics.idle_seconds_since_start':  'idle_seconds',
  'dpf.diff_pressure_kpa_downstream':           'dpf_diff_pressure_downstream',
  'dpf.diff_pressure_kpa_upstream':             'dpf_diff_pressure_upstream',
  'dpf.soot_load_pct_est':                      'dpf_soot_load_pct',
  'dpf.failed_regen_count':                     'dpf_failed_regen_count',
  'dpf.pre_dpf_temp_c':                         'dpf_pre_temp_c',
  'dpf.post_dpf_temp_c':                        'dpf_post_temp_c',
  'dpf.regen_event_flag':                       'dpf_regen_event_flag',
  'scr.nox_up_ppm':                             'scr_nox_up_ppm',
  'scr.nox_conversion_pct':                     'scr_nox_conversion_pct',
  'scr.nox_down_ppm':                           'scr_nox_down_ppm',
  'scr.scr_inlet_temp_c':                       'scr_inlet_temp_c',
  'scr.scr_outlet_temp_c':                      'scr_outlet_temp_c',
  'def.def_quality_index':                      'def_quality_index',
  'def.injector_duty_cycle_pct':                'def_injector_duty_pct',
  'def.def_pump_pressure_bar':                  'def_pump_pressure_bar',
  'def.def_pump_current_a':                     'def_pump_current_a',
  'can_bus.message_drop_rate':                  'can_message_drop_rate',
};

// ── CSV parser ───────────────────────────────────────────────────
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row = {};
    headers.forEach((h, idx) => {
      const val = values[idx]?.trim();
      row[h] = isNaN(Number(val)) ? val : Number(val);
    });
    rows.push(row);
  }
  return rows;
}

// ── Main seed function ───────────────────────────────────────────
async function seedFleetVehicles() {
  const forceMode = process.argv.includes('--force');

  try {
    await connectDB();
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║   SEED: Fleet Vehicles + Telemetry Data                     ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    // Find fleet owner
    const fleetOwner = await UserProfile.findOne({ role: 'fleet_owner' }).lean();
    if (!fleetOwner) {
      console.error('❌ Fleet owner not found. Run seedData.js first.');
      process.exit(1);
    }
    console.log(`👤 Fleet Owner: ${fleetOwner.name}`);
    console.log(`   📍 Location: ${fleetOwner.address?.city || 'N/A'}\n`);

    if (forceMode) {
      console.log('⚠️  --force mode: Dropping existing fleet vehicles & telemetry...\n');
      const vehicleIds = FLEET_VEHICLES.map(v => v.vehicleId);
      await Vehicle.deleteMany({ vehicleId: { $in: vehicleIds } });
      await VehicleTelemetry.deleteMany({ vehicleId: { $in: vehicleIds } });
    }

    let vehiclesCreated = 0;
    let vehiclesSkipped = 0;
    let totalRowsInserted = 0;

    for (const vdef of FLEET_VEHICLES) {
      console.log(`─── ${vdef.vehicleId} ──────────────────────────────────────────`);

      // 1. Create Vehicle document
      const existing = await Vehicle.findOne({ vehicleId: vdef.vehicleId });
      if (existing && !forceMode) {
        console.log(`   ⏭️  Vehicle already exists — skipping`);
        vehiclesSkipped++;

        // Check if telemetry exists
        const telCount = await VehicleTelemetry.countDocuments({ vehicleId: vdef.vehicleId });
        if (telCount > 0) {
          console.log(`   📊 Telemetry: ${telCount} rows already in DB\n`);
          continue;
        }
        console.log(`   📊 Telemetry: 0 rows — will load CSV data`);
      }

      if (!existing) {
        await Vehicle.create({
          vehicleId: vdef.vehicleId,
          owner: {
            name: fleetOwner.name,
            contact: fleetOwner.phone,
            preferredChannel: 'app',
          },
          vehicleInfo: vdef.vehicleInfo,
          usageProfile: vdef.usageProfile,
          serviceHistory: [],
        });
        console.log(`   🚚 Vehicle created: ${vdef.vehicleInfo.make} ${vdef.vehicleInfo.model} (${vdef.vehicleInfo.year})`);
        vehiclesCreated++;
      }

      // 2. Load CSV & insert telemetry
      const csvPath = path.join(__dirname, '..', 'data', vdef.csv);
      if (!fs.existsSync(csvPath)) {
        console.log(`   ⚠️  CSV not found: ${vdef.csv} — skipping telemetry\n`);
        continue;
      }

      console.log(`   📂 Loading ${vdef.csv}...`);
      const csvRows = parseCSV(csvPath);
      console.log(`   📊 Parsed ${csvRows.length} rows`);

      // Convert to telemetry documents in batches
      const BATCH_SIZE = 2000;
      const startTime = new Date('2024-01-01T00:00:00Z');
      let inserted = 0;

      for (let batchStart = 0; batchStart < csvRows.length; batchStart += BATCH_SIZE) {
        const batch = csvRows.slice(batchStart, batchStart + BATCH_SIZE);
        const docs = batch.map((row, idx) => {
          const rowIndex = batchStart + idx;
          const timestamp = new Date(startTime.getTime() + rowIndex * 5 * 60 * 1000); // 5-min intervals

          const sensors = {};
          for (const [csvCol, sensorField] of Object.entries(COL_MAP)) {
            if (row[csvCol] !== undefined) {
              sensors[sensorField] = row[csvCol];
            }
          }

          return {
            vehicleId: vdef.vehicleId,
            timestamp,
            rowIndex,
            sensors,
          };
        });

        await VehicleTelemetry.insertMany(docs, { ordered: false });
        inserted += docs.length;
        const pct = Math.round((inserted / csvRows.length) * 100);
        process.stdout.write(`\r   💾 Inserted: ${inserted}/${csvRows.length} (${pct}%)`);
      }

      console.log(`\n   ✅ ${inserted} telemetry rows inserted`);
      console.log(`   📝 ${vdef.description}\n`);
      totalRowsInserted += inserted;
    }

    // ── Summary ────────────────────────────────────────────────
    console.log('═'.repeat(60));
    console.log('📊 FLEET SEED SUMMARY');
    console.log('═'.repeat(60));
    console.log(`   🚚 Vehicles created:  ${vehiclesCreated}`);
    console.log(`   ⏭️  Vehicles skipped:  ${vehiclesSkipped}`);
    console.log(`   📊 Telemetry rows:    ${totalRowsInserted.toLocaleString()}`);
    console.log(`   📅 Time range:        2024-01-01 → 2024-03-01 (60 days)`);
    console.log(`   ⏱️  Interval:          5 minutes`);
    console.log('═'.repeat(60));
    console.log('✅ Fleet seed complete!\n');

  } catch (error) {
    console.error('\n❌ Seed failed:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
    process.exit(0);
  }
}

seedFleetVehicles();
