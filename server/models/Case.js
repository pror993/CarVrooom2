const mongoose = require('mongoose');

const caseSchema = new mongoose.Schema({
  caseId: {
    type: String,
    required: [true, 'Case ID is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  vehicleId: {
    type: String,
    required: [true, 'Vehicle ID is required'],
    trim: true,
    uppercase: true
  },
  predictionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PredictionEvent',
    required: [true, 'Prediction ID is required']
  },
  currentState: {
    type: String,
    enum: {
      values: ['RECEIVED', 'ORCHESTRATING', 'PLANNED', 'CONTACTED', 'SCHEDULED', 'IN_SERVICE', 'COMPLETED', 'PROCESSED', 'AWAITING_USER_APPROVAL', 'APPOINTMENT_CONFIRMED', 'CUSTOMER_NOTIFIED', 'FAILED'],
      message: 'State must be a valid case state'
    },
    default: 'RECEIVED',
    required: true
  },
  severity: {
    type: String,
    enum: {
      values: ['unknown', 'low', 'medium', 'high', 'critical'],
      message: 'Severity must be one of: unknown, low, medium, high, critical'
    },
    default: 'unknown'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  agentResults: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  history: [
    {
      state: {
        type: String,
        required: true,
        enum: ['RECEIVED', 'PLANNED', 'CONTACTED', 'SCHEDULED', 'IN_SERVICE', 'COMPLETED']
      },
      timestamp: {
        type: Date,
        required: true,
        default: Date.now
      },
      metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
      }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for efficient queries
caseSchema.index({ caseId: 1 });
caseSchema.index({ vehicleId: 1 });
caseSchema.index({ predictionId: 1 });
caseSchema.index({ currentState: 1 });
caseSchema.index({ createdAt: -1 });

// Compound index for vehicle + state queries
caseSchema.index({ vehicleId: 1, currentState: 1 });

// Virtual to check if case is active (not completed)
caseSchema.virtual('isActive').get(function() {
  return this.currentState !== 'COMPLETED';
});

// Virtual to get the time spent in current state
caseSchema.virtual('timeInCurrentState').get(function() {
  if (this.history.length === 0) return 0;
  
  const lastTransition = this.history[this.history.length - 1];
  const milliseconds = Date.now() - lastTransition.timestamp.getTime();
  return Math.floor(milliseconds / 1000 / 60); // Return minutes
});

// Instance method to advance state with validation
caseSchema.methods.advanceState = async function(newState, metadata = {}) {
  const validStates = ['RECEIVED', 'PLANNED', 'CONTACTED', 'SCHEDULED', 'IN_SERVICE', 'COMPLETED'];
  const stateOrder = {
    'RECEIVED': 0,
    'PLANNED': 1,
    'CONTACTED': 2,
    'SCHEDULED': 3,
    'IN_SERVICE': 4,
    'COMPLETED': 5
  };

  // Validate new state
  if (!validStates.includes(newState)) {
    throw new Error(`Invalid state: ${newState}. Must be one of: ${validStates.join(', ')}`);
  }

  // Check if already in this state
  if (this.currentState === newState) {
    throw new Error(`Case is already in state: ${newState}`);
  }

  // Check if case is completed
  if (this.currentState === 'COMPLETED') {
    throw new Error('Cannot advance state of a completed case');
  }

  // Validate state progression (optional - can be disabled for flexibility)
  const currentOrder = stateOrder[this.currentState];
  const newOrder = stateOrder[newState];
  
  if (newOrder < currentOrder) {
    throw new Error(`Cannot move backwards from ${this.currentState} to ${newState}`);
  }

  // Record state transition
  this.history.push({
    state: newState,
    timestamp: new Date(),
    metadata: metadata
  });

  // Update current state
  this.currentState = newState;

  // Save and return
  await this.save();
  
  return this;
};

// Instance method to get agent-friendly summary
caseSchema.methods.getAgentSummary = function() {
  return {
    caseId: this.caseId,
    vehicleId: this.vehicleId,
    currentState: this.currentState,
    isActive: this.isActive,
    timeInCurrentState: this.timeInCurrentState,
    stateTransitions: this.history.length,
    createdAt: this.createdAt,
    agentResults: this.agentResults
  };
};

// Instance method to get state history timeline
caseSchema.methods.getStateTimeline = function() {
  return this.history.map(entry => ({
    state: entry.state,
    timestamp: entry.timestamp,
    metadata: entry.metadata
  }));
};

// Static method to get cases by state
caseSchema.statics.findByState = function(state) {
  return this.find({ currentState: state }).sort({ createdAt: -1 });
};

// Static method to get active cases for a vehicle
caseSchema.statics.findActiveByVehicle = function(vehicleId) {
  return this.find({ 
    vehicleId: vehicleId.toUpperCase(),
    currentState: { $ne: 'COMPLETED' }
  }).sort({ createdAt: -1 });
};

// Static method to get case statistics
caseSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$currentState',
        count: { $sum: 1 },
        avgTimeInState: { $avg: '$timeInCurrentState' }
      }
    }
  ]);

  const total = await this.countDocuments();
  const active = await this.countDocuments({ currentState: { $ne: 'COMPLETED' } });
  const completed = await this.countDocuments({ currentState: 'COMPLETED' });

  return {
    total,
    active,
    completed,
    byState: stats.reduce((acc, stat) => {
      acc[stat._id] = {
        count: stat.count,
        avgTimeInState: Math.round(stat.avgTimeInState || 0)
      };
      return acc;
    }, {})
  };
};

// Automatically add initial state to history on creation
caseSchema.pre('save', function() {
  // Only add initial history entry if this is a new document and history is empty
  if (this.isNew && this.history.length === 0) {
    this.history.push({
      state: this.currentState,
      timestamp: this.createdAt || new Date(),
      metadata: { note: 'Case created' }
    });
  }
});

module.exports = mongoose.model('Case', caseSchema);
