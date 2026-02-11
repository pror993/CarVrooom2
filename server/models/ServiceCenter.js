const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  timeSlot: {
    type: String,
    required: true,
    enum: ['09:00-11:00', '11:00-13:00', '13:00-15:00', '15:00-17:00', '17:00-19:00']
  },
  status: {
    type: String,
    enum: ['available', 'booked', 'blocked'],
    default: 'available'
  },
  caseId: {
    type: String,
    default: null
  },
  vehicleId: {
    type: String,
    default: null
  }
}, { _id: true });

const serviceCenterSchema = new mongoose.Schema({
  serviceCenterId: {
    type: String,
    required: [true, 'Service Center ID is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  name: {
    type: String,
    required: [true, 'Service Center name is required'],
    trim: true
  },
  contact: {
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true
    }
  },
  location: {
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    state: {
      type: String,
      required: true,
      trim: true
    },
    zipCode: {
      type: String,
      required: true,
      trim: true
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  // GeoJSON point for $nearSphere distance queries in scheduling agent
  geoLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude] — GeoJSON standard
      default: [0, 0]
    }
  },
  specializations: {
    type: [String],
    required: true,
    default: []
  },
  services: {
    type: [String],
    required: true,
    default: ['Oil Change', 'Battery Replacement', 'Brake Service', 'Tire Rotation', 'General Inspection']
  },
  operatingHours: {
    monday: { 
      open: { type: String, default: '09:00' }, 
      close: { type: String, default: '18:00' }, 
      closed: { type: Boolean, default: false } 
    },
    tuesday: { 
      open: { type: String, default: '09:00' }, 
      close: { type: String, default: '18:00' }, 
      closed: { type: Boolean, default: false } 
    },
    wednesday: { 
      open: { type: String, default: '09:00' }, 
      close: { type: String, default: '18:00' }, 
      closed: { type: Boolean, default: false } 
    },
    thursday: { 
      open: { type: String, default: '09:00' }, 
      close: { type: String, default: '18:00' }, 
      closed: { type: Boolean, default: false } 
    },
    friday: { 
      open: { type: String, default: '09:00' }, 
      close: { type: String, default: '18:00' }, 
      closed: { type: Boolean, default: false } 
    },
    saturday: { 
      open: { type: String, default: '09:00' }, 
      close: { type: String, default: '15:00' }, 
      closed: { type: Boolean, default: false } 
    },
    sunday: { 
      open: { type: String, default: '00:00' }, 
      close: { type: String, default: '00:00' }, 
      closed: { type: Boolean, default: true } 
    }
  },
  capacity: {
    maxAppointmentsPerDay: {
      type: Number,
      default: 20
    },
    maxAppointmentsPerSlot: {
      type: Number,
      default: 4
    }
  },
  slots: [slotSchema],
  rating: {
    average: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    count: {
      type: Number,
      default: 0
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isEmergency: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
// Note: serviceCenterId index is auto-created by unique:true in schema
serviceCenterSchema.index({ 'location.city': 1, 'location.state': 1 });
serviceCenterSchema.index({ specializations: 1 });
serviceCenterSchema.index({ isActive: 1 });
serviceCenterSchema.index({ 'slots.date': 1, 'slots.status': 1 });
// GeoJSON index for distance-based scheduling queries ($nearSphere)
serviceCenterSchema.index({ geoLocation: '2dsphere' });

// Pre-save hook: sync geoLocation from location.coordinates if geoLocation not set
serviceCenterSchema.pre('save', function() {
  if (this.location && this.location.coordinates) {
    const { latitude, longitude } = this.location.coordinates;
    if (latitude && longitude) {
      // Only sync if geoLocation is at default [0,0]
      if (!this.geoLocation || 
          (this.geoLocation.coordinates[0] === 0 && this.geoLocation.coordinates[1] === 0)) {
        this.geoLocation = {
          type: 'Point',
          coordinates: [longitude, latitude] // GeoJSON is [lon, lat]
        };
      }
    }
  }
});

// Instance method to get available slots for a specific date
serviceCenterSchema.methods.getAvailableSlots = function(date) {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  
  return this.slots.filter(slot => {
    const slotDate = new Date(slot.date);
    slotDate.setHours(0, 0, 0, 0);
    return slotDate.getTime() === targetDate.getTime() && slot.status === 'available';
  });
};

// Instance method to book a slot
serviceCenterSchema.methods.bookSlot = async function(date, timeSlot, caseId, vehicleId) {
  const targetDate = new Date(date);
  const dateStr = targetDate.toISOString().split('T')[0];
  
  const slot = this.slots.find(s => {
    const slotDateStr = new Date(s.date).toISOString().split('T')[0];
    return slotDateStr === dateStr &&
      s.timeSlot === timeSlot &&
      s.status === 'available';
  });
  
  if (!slot) {
    throw new Error('Slot not available');
  }
  
  slot.status = 'booked';
  slot.caseId = caseId;
  slot.vehicleId = vehicleId;
  
  await this.save();
  return slot;
};

// Instance method to cancel a booking
serviceCenterSchema.methods.cancelSlot = async function(date, timeSlot) {
  const targetDate = new Date(date);
  const dateStr = targetDate.toISOString().split('T')[0];
  
  const slot = this.slots.find(s => {
    const slotDateStr = new Date(s.date).toISOString().split('T')[0];
    return slotDateStr === dateStr &&
      s.timeSlot === timeSlot &&
      s.status === 'booked';
  });
  
  if (!slot) {
    throw new Error('No booking found for this slot');
  }
  
  slot.status = 'available';
  slot.caseId = null;
  slot.vehicleId = null;
  
  await this.save();
  return slot;
};

// Instance method to generate slots for next N days
serviceCenterSchema.methods.generateSlots = async function(daysAhead = 30) {
  const timeSlots = ['09:00-11:00', '11:00-13:00', '13:00-15:00', '15:00-17:00', '17:00-19:00'];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  for (let i = 0; i < daysAhead; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    
    const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
    
    // Skip if center is closed on this day
    if (this.operatingHours[dayName].closed) {
      continue;
    }
    
    // Generate slots for this day
    for (const timeSlot of timeSlots) {
      const dateStr = date.toISOString().split('T')[0];
      
      // Check if slot already exists
      const existingSlot = this.slots.find(s => {
        const slotDateStr = new Date(s.date).toISOString().split('T')[0];
        return slotDateStr === dateStr && s.timeSlot === timeSlot;
      });
      
      if (!existingSlot) {
        this.slots.push({
          date: date,
          timeSlot: timeSlot,
          status: 'available'
        });
      }
    }
  }
  
  await this.save();
  return this.slots;
};

// Static method to find available centers for a specific date and vehicle type
serviceCenterSchema.statics.findAvailableCenters = async function(date, vehicleMake = null, limit = 5) {
  const query = { isActive: true };
  
  if (vehicleMake) {
    query.specializations = { $in: [vehicleMake, 'General maintenance'] };
  }
  
  const centers = await this.find(query).limit(limit);
  
  // Filter centers that have available slots on the target date
  return centers.filter(center => {
    const availableSlots = center.getAvailableSlots(date);
    return availableSlots.length > 0;
  });
};

// Static method to find nearest centers with available slots
// Used by scheduling agent for distance-based slot selection
// userLon, userLat: user's coordinates
// maxDistanceKm: max radius in km (default 50km)
serviceCenterSchema.statics.findNearestAvailable = async function(userLon, userLat, date, options = {}) {
  const {
    maxDistanceKm = 50,
    vehicleMake = null,
    specialization = null,
    limit = 10
  } = options;

  const query = {
    isActive: true,
    geoLocation: {
      $nearSphere: {
        $geometry: {
          type: 'Point',
          coordinates: [userLon, userLat]
        },
        $maxDistance: maxDistanceKm * 1000 // convert km to meters
      }
    }
  };

  if (vehicleMake) {
    query.specializations = { $in: [vehicleMake, 'General maintenance'] };
  }
  if (specialization) {
    query.specializations = specialization;
  }

  const centers = await this.find(query).limit(limit);

  // If date provided, filter to only those with available slots
  if (date) {
    return centers.filter(center => {
      const availableSlots = center.getAvailableSlots(date);
      return availableSlots.length > 0;
    });
  }

  return centers;
};

// Instance method to get agent-friendly summary
serviceCenterSchema.methods.getAgentSummary = function() {
  return {
    serviceCenterId: this.serviceCenterId,
    name: this.name,
    location: `${this.location.address}, ${this.location.city}`,
    specializations: this.specializations.join(', '),
    rating: this.rating.average,
    isEmergency: this.isEmergency
  };
};

// Instance method to get next available slot
serviceCenterSchema.methods.getNextAvailableSlot = function(fromDate = new Date()) {
  const startDate = new Date(fromDate);
  startDate.setHours(0, 0, 0, 0);
  
  const availableSlots = this.slots
    .filter(slot => slot.status === 'available' && new Date(slot.date) >= startDate)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  
  return availableSlots.length > 0 ? availableSlots[0] : null;
};

// Instance method to count available slots for a date range
serviceCenterSchema.methods.countAvailableSlots = function(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  
  return this.slots.filter(slot => {
    const slotDate = new Date(slot.date);
    return slot.status === 'available' && 
           slotDate >= start && 
           slotDate <= end;
  }).length;
};

module.exports = mongoose.model('ServiceCenter', serviceCenterSchema);
