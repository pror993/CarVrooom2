/**
 * Agentic AI Routes
 * 
 * API endpoints for triggering and managing the agentic workflow
 */

const express = require('express');
const router = express.Router();
const { orchestrateAgents, orchestrateByVehicle } = require('../agents/orchestrator');
const Case = require('../models/Case');
const PredictionEvent = require('../models/PredictionEvent');

/**
 * POST /api/agentic/run
 * 
 * Trigger the complete agentic workflow
 * 
 * Body options:
 * 1. { predictionId: "mongoId" } - Run for specific prediction
 * 2. { vehicleId: "VEHICLE-123", predictionType: "cascade_failure" } - Run for vehicle's latest prediction
 * 3. { vehicleId: "VEHICLE-123" } - Run for vehicle's most recent prediction
 * 
 * Response:
 * {
 *   success: true,
 *   caseId: "CASE-123",
 *   severity: "high",
 *   state: "AWAITING_USER_APPROVAL",
 *   executionTimeMs: 1250,
 *   agentsExecuted: ["MasterAgent", "DiagnosticAgent", "SchedulingAgent", "CommunicationAgent"],
 *   results: { master: {...}, diagnostic: {...}, scheduling: {...}, communication: {...} }
 * }
 */
router.post('/run', async (req, res) => {
  try {
    const { predictionId, vehicleId, predictionType } = req.body;

    // Validate input
    if (!predictionId && !vehicleId) {
      return res.status(400).json({
        success: false,
        error: 'Either predictionId or vehicleId is required'
      });
    }

    let result;

    if (predictionId) {
      // Run by prediction ID
      console.log(`\n🚀 API Request: Orchestrate by Prediction ID: ${predictionId}`);
      result = await orchestrateAgents(predictionId);
    } else {
      // Run by vehicle ID
      console.log(`\n🚀 API Request: Orchestrate by Vehicle ID: ${vehicleId}`);
      if (predictionType) {
        console.log(`   Prediction Type: ${predictionType}`);
      }
      result = await orchestrateByVehicle(vehicleId, predictionType);
    }

    // Return orchestration result
    res.status(200).json(result);

  } catch (error) {
    console.error('❌ Orchestration API Error:', error.message);
    
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/agentic/cases/:caseId
 * 
 * Get Case details with all agent results
 * 
 * Response:
 * {
 *   success: true,
 *   case: { caseId, state, severity, agentResults, metadata, ... }
 * }
 */
router.get('/cases/:caseId', async (req, res) => {
  try {
    const { caseId } = req.params;
    
    const caseRecord = await Case.findOne({ caseId });
    
    if (!caseRecord) {
      return res.status(404).json({
        success: false,
        error: `Case not found: ${caseId}`
      });
    }

    res.status(200).json({
      success: true,
      case: caseRecord
    });

  } catch (error) {
    console.error('❌ Get Case Error:', error.message);
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/agentic/cases
 * 
 * Get all Cases (with optional filters)
 * 
 * Query params:
 * - state: Filter by state (RECEIVED, ORCHESTRATING, PROCESSED, etc.)
 * - severity: Filter by severity (low, medium, high, critical)
 * - vehicleId: Filter by vehicle ID
 * - limit: Number of results (default: 50)
 * 
 * Response:
 * {
 *   success: true,
 *   count: 10,
 *   cases: [...]
 * }
 */
router.get('/cases', async (req, res) => {
  try {
    const { state, severity, vehicleId, limit = 50 } = req.query;
    
    const query = {};
    if (state) query.state = state;
    if (severity) query.severity = severity;
    if (vehicleId) query.vehicleId = vehicleId;

    const cases = await Case.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: cases.length,
      cases: cases
    });

  } catch (error) {
    console.error('❌ Get Cases Error:', error.message);
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/agentic/cases/:caseId/approve-appointment
 * 
 * User approves a scheduling suggestion
 * 
 * Body:
 * {
 *   selectedDate: "2026-02-14",
 *   selectedServiceCenter: "North Auto Care",
 *   serviceCenterId: "SC-002"
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   message: "Appointment confirmed",
 *   case: {...}
 * }
 */
router.post('/cases/:caseId/approve-appointment', async (req, res) => {
  try {
    const { caseId } = req.params;
    const { selectedDate, selectedServiceCenter, serviceCenterId } = req.body;

    if (!selectedDate || !selectedServiceCenter) {
      return res.status(400).json({
        success: false,
        error: 'selectedDate and selectedServiceCenter are required'
      });
    }

    const caseRecord = await Case.findOne({ caseId });
    
    if (!caseRecord) {
      return res.status(404).json({
        success: false,
        error: `Case not found: ${caseId}`
      });
    }

    // Update Case with user-approved appointment
    const updatedCase = await Case.findOneAndUpdate(
      { caseId },
      {
        'agentResults.schedulingAgent.status': 'confirmed',
        'agentResults.schedulingAgent.confirmedAppointment': {
          date: new Date(selectedDate),
          serviceCenter: selectedServiceCenter,
          serviceCenterId: serviceCenterId,
          confirmedAt: new Date(),
          confirmedBy: 'user'
        },
        'metadata.awaitingUserApproval': false,
        'metadata.appointmentConfirmed': true,
        currentState: 'APPOINTMENT_CONFIRMED'
      },
      { new: true }
    );

    console.log(`✅ Appointment approved for Case: ${caseId}`);
    console.log(`   Date: ${selectedDate}`);
    console.log(`   Service Center: ${selectedServiceCenter}`);

    res.status(200).json({
      success: true,
      message: 'Appointment confirmed',
      case: updatedCase
    });

  } catch (error) {
    console.error('❌ Approve Appointment Error:', error.message);
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
