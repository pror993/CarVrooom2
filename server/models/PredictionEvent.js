const mongoose = require('mongoose');

const predictionEventSchema = new mongoose.Schema({
  vehicleId: {
    type: String,
    required: [true, 'Vehicle ID is required'],
    trim: true
  },
  predictionType: {
    type: String,
    required: [true, 'Prediction type is required'],
    enum: {
      values: ['healthy', 'cascade_failure', 'single_failure', 'dpf_failure', 'scr_failure', 'oil_failure', 'anomaly_detection', 'anomaly'],
      message: 'Prediction type must be one of: healthy, cascade_failure, single_failure, dpf_failure, scr_failure, oil_failure, anomaly_detection, anomaly'
    }
  },
  confidence: {
    type: Number,
    required: [true, 'Confidence score is required'],
    min: [0, 'Confidence must be between 0 and 1'],
    max: [1, 'Confidence must be between 0 and 1']
  },
  etaDays: {
    type: Number,
    required: [true, 'ETA days is required'],
    min: [0, 'ETA days must be a positive number']
  },
  // Raw model outputs for reference
  modelOutputs: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  signals: {
    type: mongoose.Schema.Types.Mixed,
    required: [true, 'Signals data is required'],
    default: {}
  },
  // Source of the prediction (model vs manual)
  source: {
    type: String,
    enum: ['dpf_model', 'scr_model', 'oil_model', 'anomaly_model', 'unified_ml', 'manual', 'simulation'],
    default: 'manual'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false // We're using custom createdAt
});

// Index for efficient queries
predictionEventSchema.index({ vehicleId: 1, createdAt: -1 });
predictionEventSchema.index({ predictionType: 1 });

// Virtual for checking if prediction is recent (within 7 days)
predictionEventSchema.virtual('isRecent').get(function() {
  const now = new Date();
  const diff = now - this.createdAt;
  const daysDiff = diff / (1000 * 60 * 60 * 24);
  return daysDiff <= 7;
});

// Method to get formatted prediction summary
predictionEventSchema.methods.getSummary = function() {
  return {
    vehicleId: this.vehicleId,
    type: this.predictionType,
    confidence: `${(this.confidence * 100).toFixed(1)}%`,
    etaDays: this.etaDays,
    timestamp: this.createdAt.toISOString()
  };
};

// Ensure virtuals are included in JSON output
predictionEventSchema.set('toJSON', { virtuals: true });
predictionEventSchema.set('toObject', { virtuals: true });

const PredictionEvent = mongoose.model('PredictionEvent', predictionEventSchema);

module.exports = PredictionEvent;
