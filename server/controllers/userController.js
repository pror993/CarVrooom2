const UserProfile = require('../models/UserProfile');
const User = require('../models/User');

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
exports.getProfile = async (req, res) => {
    try {
        const profile = await UserProfile.findOne({ userId: req.user._id })
            .populate('userId', 'email role isVerified');

        if (!profile) {
            return res.status(404).json({
                success: false,
                error: 'Profile not found'
            });
        }

        res.json({
            success: true,
            profile
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateProfile = async (req, res) => {
    try {
        const allowedFields = ['name', 'phone', 'address', 'location', 'companyName', 'gstNumber',
            'serviceCenterId', 'skills', 'certificationLevel', 'notificationPreferences',
            'preferredServiceCenter', 'assignedServiceCenter'];

        const updates = {};
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        const profile = await UserProfile.findOneAndUpdate(
            { userId: req.user._id },
            updates,
            { new: true, runValidators: true }
        );

        if (!profile) {
            return res.status(404).json({
                success: false,
                error: 'Profile not found'
            });
        }

        res.json({
            success: true,
            profile
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Server error'
        });
    }
};

// @desc    Get all users (admin/service_center only)
// @route   GET /api/users
// @access  Private (service_center, fleet_owner)
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find({ isActive: true })
            .select('-password')
            .sort('-createdAt');

        res.json({
            success: true,
            count: users.length,
            users
        });
    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private
exports.getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const profile = await UserProfile.findOne({ userId: user._id });

        res.json({
            success: true,
            user: {
                ...user.toObject(),
                profile
            }
        });
    } catch (error) {
        console.error('Get user by ID error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// @desc    Delete user account
// @route   DELETE /api/users/:id
// @access  Private (self or admin)
exports.deleteUser = async (req, res) => {
    try {
        // Users can only delete their own account
        if (req.user._id.toString() !== req.params.id) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to delete this account'
            });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Soft delete - set isActive to false
        user.isActive = false;
        await user.save();

        res.json({
            success: true,
            message: 'Account deactivated successfully'
        });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};
