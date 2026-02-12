/**
 * Pipeline API Routes
 * 
 * Endpoints for the fleet dashboard:
 *   GET  /api/pipeline/status           — Scheduler state
 *   POST /api/pipeline/start            — Start virtual clock
 *   POST /api/pipeline/stop             — Stop virtual clock
 *   POST /api/pipeline/reset            — Reset to beginning
 *   GET  /api/pipeline/vehicles         — All fleet vehicles + latest prediction
 *   GET  /api/pipeline/vehicles/:id     — Single vehicle detail + prediction history
 *   GET  /api/pipeline/predictions      — Recent predictions across fleet
 *   GET  /api/pipeline/cases            — Active cases (alerts)
 */

const express = require('express');
const router = express.Router();
const Vehicle = require('../models/Vehicle');
const VehicleTelemetry = require('../models/VehicleTelemetry');
const PredictionEvent = require('../models/PredictionEvent');
const Case = require('../models/Case');
const scheduler = require('../pipelineScheduler');

// ── Scheduler control ────────────────────────────────────────────

// GET /api/pipeline/status
router.get('/status', (req, res) => {
  res.json({ success: true, data: scheduler.getState() });
});

// POST /api/pipeline/start
router.post('/start', (req, res) => {
  const { startDay } = req.body || {};
  scheduler.start({ startDay: startDay || 0 });
  res.json({ success: true, message: 'Scheduler started', data: scheduler.getState() });
});

// POST /api/pipeline/stop
router.post('/stop', async (req, res) => {
  try {
    await scheduler.stop();
    res.json({ success: true, message: 'Scheduler stopped', data: scheduler.getState() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/pipeline/reset
router.post('/reset', async (req, res) => {
  try {
    const { clearData } = req.body;
    await scheduler.reset();

    if (clearData) {
      // Optionally clear prediction events and cases from pipeline runs
      const vehicleIds = scheduler.FLEET_VEHICLE_IDS;
      await PredictionEvent.deleteMany({ vehicleId: { $in: vehicleIds }, source: 'unified_ml' });
      await Case.deleteMany({ vehicleId: { $in: vehicleIds } });
    }

    res.json({ success: true, message: 'Scheduler reset', data: scheduler.getState() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Fleet vehicles ───────────────────────────────────────────────

// GET /api/pipeline/vehicles
router.get('/vehicles', async (req, res) => {
  try {
    const vehicleIds = scheduler.FLEET_VEHICLE_IDS;
    const vehicles = await Vehicle.find({ vehicleId: { $in: vehicleIds } }).lean();

    // Get latest prediction for each vehicle
    const vehiclesWithPredictions = await Promise.all(
      vehicles.map(async (v) => {
        const latestPrediction = await PredictionEvent.findOne({ vehicleId: v.vehicleId })
          .sort({ createdAt: -1 })
          .lean();

        const activeCase = await Case.findOne({
          vehicleId: v.vehicleId,
          currentState: { $nin: ['COMPLETED', 'FAILED'] }
        })
          .sort({ createdAt: -1 })
          .lean();

        const predictionCount = await PredictionEvent.countDocuments({ vehicleId: v.vehicleId });
        const telemetryCount = await VehicleTelemetry.countDocuments({ vehicleId: v.vehicleId });

        // Determine vehicle health status
        let healthStatus = 'unknown';
        if (latestPrediction) {
          if (latestPrediction.etaDays >= 60) healthStatus = 'healthy';
          else if (latestPrediction.etaDays >= 21) healthStatus = 'warning';
          else healthStatus = 'critical';
        }

        return {
          ...v,
          healthStatus,
          telemetryRows: telemetryCount,
          predictionCount,
          latestPrediction: latestPrediction ? {
            predictionType: latestPrediction.predictionType,
            etaDays: latestPrediction.etaDays,
            confidence: latestPrediction.confidence,
            modelOutputs: latestPrediction.modelOutputs,
            createdAt: latestPrediction.createdAt,
          } : null,
          activeCase: activeCase ? {
            caseId: activeCase.caseId,
            severity: activeCase.severity,
            currentState: activeCase.currentState,
            createdAt: activeCase.createdAt,
          } : null,
        };
      })
    );

    res.json({ success: true, data: vehiclesWithPredictions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/pipeline/vehicles/:vehicleId
router.get('/vehicles/:vehicleId', async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const vehicle = await Vehicle.findOne({ vehicleId: vehicleId.toUpperCase() }).lean();

    if (!vehicle) {
      return res.status(404).json({ success: false, error: 'Vehicle not found' });
    }

    // Get prediction history (last 20)
    const predictions = await PredictionEvent.find({ vehicleId: vehicle.vehicleId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // Get cases
    const cases = await Case.find({ vehicleId: vehicle.vehicleId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Get latest telemetry summary
    const latestTelemetry = await VehicleTelemetry.findOne({ vehicleId: vehicle.vehicleId })
      .sort({ rowIndex: -1 })
      .lean();

    const telemetryCount = await VehicleTelemetry.countDocuments({ vehicleId: vehicle.vehicleId });

    res.json({
      success: true,
      data: {
        vehicle,
        telemetryRows: telemetryCount,
        latestTelemetry: latestTelemetry?.sensors || null,
        predictions,
        cases: cases.map(c => ({
          caseId: c.caseId,
          severity: c.severity,
          currentState: c.currentState,
          predictionType: c.metadata?.predictionType,
          agentsExecuted: c.metadata?.agentsExecuted,
          agentResults: c.agentResults || {},
          metadata: c.metadata || {},
          createdAt: c.createdAt,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Predictions ──────────────────────────────────────────────────

// GET /api/pipeline/predictions?limit=50
router.get('/predictions', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50'), 200);
    const vehicleId = req.query.vehicleId;

    const query = {};
    if (vehicleId) query.vehicleId = vehicleId.toUpperCase();

    const predictions = await PredictionEvent.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ success: true, data: predictions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Cases (alerts) ───────────────────────────────────────────────

// GET /api/pipeline/cases?status=active
router.get('/cases', async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};

    if (status === 'active') {
      query.currentState = { $nin: ['COMPLETED', 'FAILED'] };
    }

    // Only fleet vehicles
    query.vehicleId = { $in: scheduler.FLEET_VEHICLE_IDS };

    const cases = await Case.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ success: true, data: cases });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
