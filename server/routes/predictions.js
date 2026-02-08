const express = require('express');
const router = express.Router();
const {
  ingestPrediction,
  getVehiclePredictions,
  getAllPredictions,
  getPredictionStats
} = require('../controllers/predictionController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Stats route (must come before other routes to avoid conflicts)
router.get('/stats', getPredictionStats);

// Ingest prediction
router.post('/ingest', ingestPrediction);

// Get all predictions (with pagination)
router.get('/', getAllPredictions);

// Get predictions for a specific vehicle
router.get('/vehicle/:vehicleId', getVehiclePredictions);

module.exports = router;
