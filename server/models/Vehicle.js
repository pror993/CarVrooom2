const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  vehicleId: {
    type: String,
    required: [true, 'Vehicle ID is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  owner: {
    name: {
      type: String,
      required: [true, 'Owner name is required'],
      trim: true
    },
    contact: {
      type: String,
      required: [true, 'Owner contact is required'],
      trim: true
    },
    preferredChannel: {
      type: String,
      enum: {
        values: ['voice', 'app'],
        message: 'Preferred channel must be either voice or app'
      },
      default: 'app'
    }
  },
  vehicleInfo: {
    make: {
      type: String,
      required: [true, 'Vehicle make is required'],
      trim: true
    },
    model: {
      type: String,
      required: [true, 'Vehicle model is required'],
      trim: true
    },
    year: {
      type: Number,
      required: [true, 'Vehicle year is required'],
      min: [1900, 'Year must be 1900 or later'],
      max: [new Date().getFullYear() + 1, 'Year cannot be in the future']
    },
    powertrain: {
      type: String,
      required: [true, 'Vehicle powertrain is required'],
      trim: true
    }
  },
  usageProfile: {
    avgDailyKm: {
      type: Number,
      required: [true, 'Average daily kilometers is required'],
      min: [0, 'Average daily km must be positive']
    },
    loadPattern: {
      type: String,
      enum: {
        values: ['light', 'normal', 'heavy'],
        message: 'Load pattern must be light, normal, or heavy'
      },
      default: 'normal'
    }
  },
  serviceHistory: [
    {
      date: {
        type: Date,
        required: true
      },
      type: {
        type: String,
        required: true,
        trim: true
      },
      notes: {
        type: String,
        trim: true,
        default: ''
      }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient queries by vehicleId
vehicleSchema.index({ vehicleId: 1 });

// Index for querying by creation date
vehicleSchema.index({ createdAt: -1 });

// Virtual to get the most recent service
vehicleSchema.virtual('lastService').get(function() {
  if (this.serviceHistory && this.serviceHistory.length > 0) {
    return this.serviceHistory[this.serviceHistory.length - 1];
  }
  return null;
});

// Instance method to get agent-friendly summary
vehicleSchema.methods.getAgentSummary = function() {
  return {
    vehicleId: this.vehicleId,
    vehicle: `${this.vehicleInfo.year} ${this.vehicleInfo.make} ${this.vehicleInfo.model}`,
    powertrain: this.vehicleInfo.powertrain,
    usage: {
      dailyKm: this.usageProfile.avgDailyKm,
      loadPattern: this.usageProfile.loadPattern
    },
    owner: {
      name: this.owner.name,
      preferredChannel: this.owner.preferredChannel
    },
    serviceCount: this.serviceHistory.length,
    lastService: this.lastService
  };
};

// Instance method to check if service is overdue (based on km or time)
vehicleSchema.methods.isServiceOverdue = function(standardServiceKm = 10000, standardServiceDays = 180) {
  if (!this.lastService) return true;
  
  const daysSinceService = Math.floor((Date.now() - this.lastService.date.getTime()) / (1000 * 60 * 60 * 24));
  const estimatedKmSinceService = this.usageProfile.avgDailyKm * daysSinceService;
  
  return daysSinceService >= standardServiceDays || estimatedKmSinceService >= standardServiceKm;
};

// Sort service history by date when saving
vehicleSchema.pre('save', function() {
  if (this.serviceHistory && this.serviceHistory.length > 0) {
    this.serviceHistory.sort((a, b) => a.date - b.date);
  }
});

module.exports = mongoose.model('Vehicle', vehicleSchema);
