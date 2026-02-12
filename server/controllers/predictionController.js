const PredictionEvent = require('../models/PredictionEvent');

// Valid prediction types
const VALID_PREDICTION_TYPES = ['cascade_failure', 'single_failure', 'dpf_failure', 'scr_failure', 'oil_failure'];

// @desc    Ingest prediction data
// @route   POST /api/predictions/ingest
// @access  Private
exports.ingestPrediction = async (req, res) => {
  try {
    const { vehicleId, predictionType, confidence, etaDays, signals, modelOutputs, source } = req.body;

    // Validate required fields
    if (!vehicleId || !predictionType || confidence === undefined || etaDays === undefined || !signals) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: vehicleId, predictionType, confidence, etaDays, signals'
      });
    }

    // Validate predictionType enum
    if (!VALID_PREDICTION_TYPES.includes(predictionType)) {
      return res.status(400).json({
        success: false,
        error: `predictionType must be one of: ${VALID_PREDICTION_TYPES.join(', ')}`
      });
    }

    // Validate confidence range
    if (confidence < 0 || confidence > 1) {
      return res.status(400).json({
        success: false,
        error: 'confidence must be between 0 and 1'
      });
    }

    // Validate etaDays
    if (etaDays < 0) {
      return res.status(400).json({
        success: false,
        error: 'etaDays must be a positive number'
      });
    }

    // Create prediction event
    const predictionEvent = await PredictionEvent.create({
      vehicleId,
      predictionType,
      confidence,
      etaDays,
      signals,
      modelOutputs: modelOutputs || null,
      source: source || 'manual'
    });

    res.status(201).json({
      success: true,
      message: 'Prediction ingested successfully',
      data: predictionEvent
    });
  } catch (error) {
    console.error('Error ingesting prediction:', error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: messages.join(', ')
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Duplicate prediction entry'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Server error while ingesting prediction'
    });
  }
};

// @desc    Get predictions for a vehicle
// @route   GET /api/predictions/vehicle/:vehicleId
// @access  Private
exports.getVehiclePredictions = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { limit = 10, type } = req.query;

    const query = { vehicleId };
    
    // Filter by prediction type if provided
    if (type && VALID_PREDICTION_TYPES.includes(type)) {
      query.predictionType = type;
    }

    const predictions = await PredictionEvent.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      count: predictions.length,
      data: predictions
    });
  } catch (error) {
    console.error('Error fetching predictions:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching predictions'
    });
  }
};

// @desc    Get all predictions (with pagination)
// @route   GET /api/predictions
// @access  Private
exports.getAllPredictions = async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    
    // Filter by prediction type if provided
    if (type && ['cascade_failure', 'single_failure'].includes(type)) {
      query.predictionType = type;
    }

    const predictions = await PredictionEvent.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await PredictionEvent.countDocuments(query);

    res.json({
      success: true,
      count: predictions.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: predictions
    });
  } catch (error) {
    console.error('Error fetching predictions:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching predictions'
    });
  }
};

// @desc    Get prediction statistics
// @route   GET /api/predictions/stats
// @access  Private
exports.getPredictionStats = async (req, res) => {
  try {
    const { vehicleId } = req.query;
    const query = vehicleId ? { vehicleId } : {};

    const total = await PredictionEvent.countDocuments(query);
    const cascadeFailures = await PredictionEvent.countDocuments({ 
      ...query, 
      predictionType: 'cascade_failure' 
    });
    const singleFailures = await PredictionEvent.countDocuments({ 
      ...query, 
      predictionType: 'single_failure' 
    });

    // Get average confidence
    const avgConfidenceResult = await PredictionEvent.aggregate([
      { $match: query },
      { $group: { _id: null, avgConfidence: { $avg: '$confidence' } } }
    ]);

    // Get average ETA
    const avgEtaResult = await PredictionEvent.aggregate([
      { $match: query },
      { $group: { _id: null, avgEtaDays: { $avg: '$etaDays' } } }
    ]);

    const stats = {
      total,
      byType: {
        cascade_failure: cascadeFailures,
        single_failure: singleFailures
      },
      avgConfidence: avgConfidenceResult.length > 0 
        ? avgConfidenceResult[0].avgConfidence.toFixed(3) 
        : 0,
      avgEtaDays: avgEtaResult.length > 0 
        ? Math.round(avgEtaResult[0].avgEtaDays) 
        : 0
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching prediction stats:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching prediction statistics'
    });
  }
};
