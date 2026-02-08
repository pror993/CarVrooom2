const Vehicle = require('../models/Vehicle');

// @desc    Register a new vehicle
// @route   POST /api/vehicles
// @access  Protected
exports.registerVehicle = async (req, res) => {
  try {
    const {
      vehicleId,
      owner,
      vehicleInfo,
      usageProfile,
      serviceHistory
    } = req.body;

    // Validate required fields
    if (!vehicleId || !owner || !vehicleInfo || !usageProfile) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: vehicleId, owner, vehicleInfo, usageProfile'
      });
    }

    // Validate owner fields
    if (!owner.name || !owner.contact) {
      return res.status(400).json({
        success: false,
        error: 'Owner must include name and contact'
      });
    }

    // Validate preferredChannel if provided
    if (owner.preferredChannel && !['voice', 'app'].includes(owner.preferredChannel)) {
      return res.status(400).json({
        success: false,
        error: 'Preferred channel must be either voice or app'
      });
    }

    // Validate vehicleInfo fields
    if (!vehicleInfo.make || !vehicleInfo.model || !vehicleInfo.year || !vehicleInfo.powertrain) {
      return res.status(400).json({
        success: false,
        error: 'Vehicle info must include make, model, year, and powertrain'
      });
    }

    // Validate usageProfile fields
    if (usageProfile.avgDailyKm === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Usage profile must include avgDailyKm'
      });
    }

    // Validate loadPattern if provided
    if (usageProfile.loadPattern && !['light', 'normal', 'heavy'].includes(usageProfile.loadPattern)) {
      return res.status(400).json({
        success: false,
        error: 'Load pattern must be light, normal, or heavy'
      });
    }

    // Check if vehicle already exists
    const existingVehicle = await Vehicle.findOne({ vehicleId: vehicleId.toUpperCase() });
    if (existingVehicle) {
      return res.status(400).json({
        success: false,
        error: 'Vehicle with this ID already exists'
      });
    }

    // Create vehicle
    const vehicle = await Vehicle.create({
      vehicleId: vehicleId.toUpperCase(),
      owner,
      vehicleInfo,
      usageProfile,
      serviceHistory: serviceHistory || []
    });

    res.status(201).json({
      success: true,
      data: vehicle
    });
  } catch (error) {
    console.error('Error registering vehicle:', error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: messages.join(', ')
      });
    }

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Vehicle with this ID already exists'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Server error while registering vehicle'
    });
  }
};

// @desc    Get vehicle by vehicleId
// @route   GET /api/vehicles/:vehicleId
// @access  Protected
exports.getVehicle = async (req, res) => {
  try {
    const { vehicleId } = req.params;

    const vehicle = await Vehicle.findOne({ vehicleId: vehicleId.toUpperCase() });

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found'
      });
    }

    // Include agent-friendly summary
    const agentSummary = vehicle.getAgentSummary();
    const isOverdue = vehicle.isServiceOverdue();

    res.status(200).json({
      success: true,
      data: vehicle,
      agentContext: {
        summary: agentSummary,
        serviceOverdue: isOverdue
      }
    });
  } catch (error) {
    console.error('Error fetching vehicle:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching vehicle'
    });
  }
};
