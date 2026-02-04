const mongoose = require('mongoose');

const userProfileSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    role: {
        type: String,
        enum: ['vehicle_owner', 'fleet_owner', 'service_center', 'technician'],
        required: true
    },

    // Common fields
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    phone: {
        type: String,
        trim: true
    },
    address: {
        street: String,
        city: String,
        state: String,
        zip: String
    },

    // For vehicle_owner
    vehicleIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vehicle'
    }],
    preferredServiceCenter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceCenter'
    },

    // For fleet_owner
    fleetId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Fleet'
    },
    companyName: String,
    gstNumber: String,

    // For service_center
    centerName: String,
    centerLocation: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            default: [0, 0]
        }
    },
    certifications: [String],
    technicianIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],

    // For technician
    employerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    skills: [String],
    certificationLevel: String

}, {
    timestamps: true
});

// Index for geospatial queries
userProfileSchema.index({ centerLocation: '2dsphere' });

module.exports = mongoose.model('UserProfile', userProfileSchema);
