/**
 * UEBA API Routes
 * 
 * Endpoints for querying User and Entity Behavior Analytics data
 */

const express = require('express');
const router = express.Router();
const { uebaMonitor, UEBAEvent } = require('../agents/uebaMonitor');
const { protect } = require('../middleware/auth');

/**
 * GET /api/ueba/case/:caseId
 * Get risk summary for a specific case
 */
router.get('/case/:caseId', protect, async (req, res) => {
  try {
    const { caseId } = req.params;
    
    const summary = await uebaMonitor.getCaseRiskSummary(caseId);
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error getting case risk summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get case risk summary',
      error: error.message
    });
  }
});

/**
 * GET /api/ueba/high-risk
 * Get high-risk events across all cases
 */
router.get('/high-risk', protect, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const minRiskScore = parseInt(req.query.minRiskScore) || 50;
    
    const events = await uebaMonitor.getHighRiskEvents(limit, minRiskScore);
    
    res.json({
      success: true,
      count: events.length,
      data: events
    });
  } catch (error) {
    console.error('Error getting high-risk events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get high-risk events',
      error: error.message
    });
  }
});

/**
 * GET /api/ueba/events
 * Query UEBA events with filters
 */
router.get('/events', protect, async (req, res) => {
  try {
    const {
      agentName,
      caseId,
      vehicleId,
      minRiskScore,
      status,
      startDate,
      endDate,
      limit = 50,
      skip = 0
    } = req.query;
    
    // Build query
    const query = {};
    
    if (agentName) query.agentName = agentName;
    if (caseId) query.caseId = caseId;
    if (vehicleId) query.vehicleId = vehicleId;
    if (status) query.status = status;
    if (minRiskScore) query.riskScore = { $gte: parseInt(minRiskScore) };
    
    if (startDate || endDate) {
      query.executionTimestamp = {};
      if (startDate) query.executionTimestamp.$gte = new Date(startDate);
      if (endDate) query.executionTimestamp.$lte = new Date(endDate);
    }
    
    // Execute query
    const events = await UEBAEvent.find(query)
      .sort({ executionTimestamp: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));
    
    const total = await UEBAEvent.countDocuments(query);
    
    res.json({
      success: true,
      count: events.length,
      total,
      data: events
    });
  } catch (error) {
    console.error('Error querying UEBA events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to query UEBA events',
      error: error.message
    });
  }
});

/**
 * GET /api/ueba/stats
 * Get overall UEBA statistics
 */
router.get('/stats', protect, async (req, res) => {
  try {
    const now = Date.now();
    const last24h = new Date(now - 24 * 60 * 60 * 1000);
    const last7d = new Date(now - 7 * 24 * 60 * 60 * 1000);
    
    // Get stats for different time windows
    const stats24h = await UEBAEvent.aggregate([
      { $match: { executionTimestamp: { $gte: last24h } } },
      {
        $group: {
          _id: '$agentName',
          totalExecutions: { $sum: 1 },
          failures: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          },
          avgRiskScore: { $avg: '$riskScore' },
          maxRiskScore: { $max: '$riskScore' },
          avgDuration: { $avg: '$executionDuration' }
        }
      }
    ]);
    
    const stats7d = await UEBAEvent.aggregate([
      { $match: { executionTimestamp: { $gte: last7d } } },
      {
        $group: {
          _id: '$agentName',
          totalExecutions: { $sum: 1 },
          failures: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          },
          avgRiskScore: { $avg: '$riskScore' },
          maxRiskScore: { $max: '$riskScore' }
        }
      }
    ]);
    
    // Get high-risk count
    const highRiskCount = await UEBAEvent.countDocuments({
      riskScore: { $gte: 70 },
      executionTimestamp: { $gte: last24h }
    });
    
    // Get anomaly distribution
    const anomalyStats = await UEBAEvent.aggregate([
      { $match: { executionTimestamp: { $gte: last24h } } },
      { $unwind: '$anomalyFlags' },
      {
        $group: {
          _id: '$anomalyFlags.type',
          count: { $sum: 1 },
          avgSeverity: { $avg: 1 } // Would need to convert severity to number
        }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        last24Hours: {
          agentStats: stats24h,
          highRiskEvents: highRiskCount,
          anomalies: anomalyStats
        },
        last7Days: {
          agentStats: stats7d
        }
      }
    });
  } catch (error) {
    console.error('Error getting UEBA stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get UEBA statistics',
      error: error.message
    });
  }
});

/**
 * POST /api/ueba/cleanup
 * Clean up old UEBA events (admin only)
 */
router.post('/cleanup', protect, async (req, res) => {
  try {
    // TODO: Add admin check here
    const { retentionDays = 30 } = req.body;
    
    const deletedCount = await uebaMonitor.cleanupOldEvents(retentionDays);
    
    res.json({
      success: true,
      message: `Cleaned up ${deletedCount} old UEBA events`,
      deletedCount
    });
  } catch (error) {
    console.error('Error cleaning up UEBA events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clean up UEBA events',
      error: error.message
    });
  }
});

module.exports = router;
