/**
 * VehicleTelemetry Model
 * 
 * Stores time-series sensor data for each vehicle.
 * Each document = one 5-minute reading (one row from the CSV).
 * The virtual clock scheduler reads rolling windows from this collection.
 */

const mongoose = require('mongoose');

const vehicleTelemetrySchema = new mongoose.Schema({
  vehicleId: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    index: true
  },
  timestamp: {
    type: Date,
    required: true,
    index: true
  },
  // Simulated row index (0-17279) — maps to CSV row position
  rowIndex: {
    type: Number,
    required: true
  },
  // All sensor readings for this timestep
  sensors: {
    // Engine / Powertrain
    engine_load_pct:        { type: Number },
    engine_rpm:             { type: Number },
    oil_level_l:            { type: Number },
    oil_pressure_bar:       { type: Number },
    oil_temp_c:             { type: Number },
    // Vehicle dynamics
    speed_kmh:              { type: Number },
    idle_seconds:           { type: Number },
    // DPF
    dpf_diff_pressure_downstream: { type: Number },
    dpf_diff_pressure_upstream:   { type: Number },
    dpf_soot_load_pct:            { type: Number },
    dpf_failed_regen_count:       { type: Number },
    dpf_pre_temp_c:               { type: Number },
    dpf_post_temp_c:              { type: Number },
    dpf_regen_event_flag:         { type: Number },
    // SCR
    scr_nox_up_ppm:          { type: Number },
    scr_nox_conversion_pct:  { type: Number },
    scr_nox_down_ppm:        { type: Number },
    scr_inlet_temp_c:        { type: Number },
    scr_outlet_temp_c:       { type: Number },
    // DEF
    def_quality_index:       { type: Number },
    def_injector_duty_pct:   { type: Number },
    def_pump_pressure_bar:   { type: Number },
    def_pump_current_a:      { type: Number },
    // CAN
    can_message_drop_rate:   { type: Number }
  }
}, {
  timestamps: false,
  // Optimise for time-series queries
  timeseries: undefined // MongoDB Atlas time-series not used — using standard collection with indexes
});

// Compound index for rolling-window queries: fetch last N rows for a vehicle ordered by time
vehicleTelemetrySchema.index({ vehicleId: 1, rowIndex: 1 });
vehicleTelemetrySchema.index({ vehicleId: 1, timestamp: 1 });

// Static: get rolling window (last N rows) for a vehicle
vehicleTelemetrySchema.statics.getRollingWindow = async function(vehicleId, windowSize = 17280) {
  return this.find({ vehicleId })
    .sort({ rowIndex: 1 })
    .limit(windowSize)
    .lean();
};

// Static: get rows up to a certain simulated timestamp (for virtual clock)
vehicleTelemetrySchema.statics.getRowsUpTo = async function(vehicleId, maxRowIndex) {
  return this.find({ vehicleId, rowIndex: { $lte: maxRowIndex } })
    .sort({ rowIndex: 1 })
    .lean();
};

// Static: convert a telemetry document to the CSV-column format the ML API expects
vehicleTelemetrySchema.statics.toMLFormat = function(docs) {
  return docs.map(doc => ({
    vehicle_id:                              doc.vehicleId,
    timestamp_utc:                           doc.timestamp.toISOString(),
    'engine_powertrain.engine_load_pct':     doc.sensors.engine_load_pct,
    'engine_powertrain.engine_rpm':          doc.sensors.engine_rpm,
    'vehicle_dynamics.speed_kmh':            doc.sensors.speed_kmh,
    'engine_powertrain.oil_level_l':         doc.sensors.oil_level_l,
    'engine_powertrain.oil_pressure_bar':    doc.sensors.oil_pressure_bar,
    'engine_powertrain.oil_temp_c':          doc.sensors.oil_temp_c,
    'vehicle_dynamics.idle_seconds_since_start': doc.sensors.idle_seconds,
    'dpf.diff_pressure_kpa_downstream':      doc.sensors.dpf_diff_pressure_downstream,
    'dpf.diff_pressure_kpa_upstream':        doc.sensors.dpf_diff_pressure_upstream,
    'dpf.soot_load_pct_est':                 doc.sensors.dpf_soot_load_pct,
    'dpf.failed_regen_count':                doc.sensors.dpf_failed_regen_count,
    'dpf.pre_dpf_temp_c':                    doc.sensors.dpf_pre_temp_c,
    'dpf.post_dpf_temp_c':                   doc.sensors.dpf_post_temp_c,
    'dpf.regen_event_flag':                  doc.sensors.dpf_regen_event_flag,
    'scr.nox_up_ppm':                        doc.sensors.scr_nox_up_ppm,
    'scr.nox_conversion_pct':                doc.sensors.scr_nox_conversion_pct,
    'scr.nox_down_ppm':                      doc.sensors.scr_nox_down_ppm,
    'scr.scr_inlet_temp_c':                  doc.sensors.scr_inlet_temp_c,
    'scr.scr_outlet_temp_c':                 doc.sensors.scr_outlet_temp_c,
    'def.def_quality_index':                 doc.sensors.def_quality_index,
    'def.injector_duty_cycle_pct':           doc.sensors.def_injector_duty_pct,
    'def.def_pump_pressure_bar':             doc.sensors.def_pump_pressure_bar,
    'def.def_pump_current_a':                doc.sensors.def_pump_current_a,
    'can_bus.message_drop_rate':             doc.sensors.can_message_drop_rate
  }));
};

module.exports = mongoose.model('VehicleTelemetry', vehicleTelemetrySchema);
