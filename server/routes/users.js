const express = require('express');
const router = express.Router();
const {
    getProfile,
    updateProfile,
    getAllUsers,
    getUserById,
    deleteUser
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// Profile routes
router.route('/profile')
    .get(getProfile)
    .put(updateProfile);

// User management routes
router.route('/')
    .get(authorize('service_center', 'fleet_owner'), getAllUsers);

router.route('/:id')
    .get(getUserById)
    .delete(deleteUser);

module.exports = router;
