const express = require('express');
const router = express.Router();
const { registerVehicle, getVehicle } = require('../controllers/vehicleController');
const { protect } = require('../middleware/auth');

// All routes are protected
router.post('/', protect, registerVehicle);
router.get('/:vehicleId', protect, getVehicle);

module.exports = router;
