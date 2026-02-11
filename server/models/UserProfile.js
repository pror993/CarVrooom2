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
    // GeoJSON location for distance-based scheduling
    // Used by scheduling agent to calculate distance to service centers
    location: {
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

    // For vehicle_owner
    vehicleIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vehicle'
    }],
    preferredServiceCenter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceCenter'
    },
    notificationPreferences: {
        channel: {
            type: String,
            enum: ['sms', 'email', 'push', 'whatsapp'],
            default: 'sms'
        },
        urgentChannel: {
            type: String,
            enum: ['sms', 'email', 'push', 'whatsapp'],
            default: 'sms'
        }
    },

    // For fleet_owner
    fleetId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Fleet'
    },
    companyName: String,
    gstNumber: String,

    // For service_center — links to the ServiceCenter document
    // The actual center details (slots, hours, capacity) live in ServiceCenter model
    // This just connects the user account to the center they manage
    serviceCenterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceCenter'
    },

    // For technician
    employerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    assignedServiceCenter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceCenter'
    },
    skills: [String],
    certificationLevel: String

}, {
    timestamps: true
});

// Index for geospatial queries (find nearby service centers for users)
userProfileSchema.index({ location: '2dsphere' });
// Index for role-based queries
userProfileSchema.index({ role: 1 });
// Index for service center link
userProfileSchema.index({ serviceCenterId: 1 });

module.exports = mongoose.model('UserProfile', userProfileSchema);
