/**
 * Agent Orchestrator
 * 
 * Manages the complete agentic workflow:
 * 1. Ingests prediction event
 * 2. Fetches vehicle data
 * 3. Creates Case
 * 4. Runs MasterAgent for orchestration decision
 * 5. Executes worker agents sequentially based on MasterAgent decision
 * 6. Stores all results in Case
 * 7. Updates Case state
 * 
 * This is the central controller that coordinates all AI agents.
 */

const { masterAgent } = require('./masterAgent');
const { diagnosticAgent } = require('./diagnosticAgent');
const { communicationAgent } = require('./communicationAgent');
const { schedulingAgent } = require('./schedulingAgent');
const { uebaMonitor } = require('./uebaMonitor');
const Vehicle = require('../models/Vehicle');
const PredictionEvent = require('../models/PredictionEvent');
const Case = require('../models/Case');
const UserProfile = require('../models/UserProfile');

/**
 * Main orchestration function
 * Coordinates all agents in sequence
 * 
 * If the prediction shows the vehicle is healthy (RUL above threshold),
 * no case is registered — the vehicle is fine.
 * 
 * @param {string} predictionId - MongoDB ObjectId of the prediction event
 * @returns {Object} Complete orchestration result with all agent outputs
 */

const HEALTHY_RUL_THRESHOLD = 60; // days — above this, vehicle is considered healthy

async function orchestrateAgents(predictionId) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🤖 AGENT ORCHESTRATOR STARTED');
  console.log('═══════════════════════════════════════════════════════════\n');

  const startTime = Date.now();
  let caseRecord = null;

  try {
    // ═══════════════════════════════════════════════════════════════
    // STEP 1: INGEST PREDICTION EVENT
    // ═══════════════════════════════════════════════════════════════
    console.log('📥 STEP 1: Ingesting Prediction Event');
    console.log('─────────────────────────────────────────────────────────\n');

    const prediction = await PredictionEvent.findById(predictionId);
    if (!prediction) {
      throw new Error(`Prediction not found: ${predictionId}`);
    }

    console.log('✅ Prediction loaded:');
    console.log(`   ID: ${prediction._id}`);
    console.log(`   Vehicle ID: ${prediction.vehicleId}`);
    console.log(`   Type: ${prediction.predictionType}`);
    console.log(`   Confidence: ${(prediction.confidence * 100).toFixed(1)}%`);
    console.log(`   ETA: ${prediction.etaDays} days\n`);

    // ═══════════════════════════════════════════════════════════════
    // HEALTH CHECK — Skip case creation if vehicle is healthy
    // ═══════════════════════════════════════════════════════════════
    if (prediction.etaDays >= HEALTHY_RUL_THRESHOLD) {
      const executionTime = Date.now() - startTime;

      console.log('═══════════════════════════════════════════════════════════');
      console.log('✅ VEHICLE IS HEALTHY — No case registered');
      console.log('═══════════════════════════════════════════════════════════\n');
      console.log(`   RUL: ${prediction.etaDays} days (threshold: ${HEALTHY_RUL_THRESHOLD} days)`);
      console.log(`   Confidence: ${(prediction.confidence * 100).toFixed(1)}%`);
      console.log(`   All systems nominal — no maintenance action needed.\n`);

      return {
        success: true,
        healthy: true,
        caseId: null,
        severity: 'none',
        state: 'HEALTHY',
        executionTimeMs: executionTime,
        agentsExecuted: [],
        message: `Vehicle is healthy. RUL ${prediction.etaDays} days exceeds threshold of ${HEALTHY_RUL_THRESHOLD} days. No case registered.`,
        prediction: {
          vehicleId: prediction.vehicleId,
          predictionType: prediction.predictionType,
          etaDays: prediction.etaDays,
          confidence: prediction.confidence,
        },
        results: {
          master: null,
          diagnostic: null,
          scheduling: null,
          communication: null,
        },
      };
    }

    console.log(`   ⚠️  RUL ${prediction.etaDays} days < ${HEALTHY_RUL_THRESHOLD} day threshold — proceeding with case creation\n`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: FETCH VEHICLE DATA
    // ═══════════════════════════════════════════════════════════════
    console.log('🚗 STEP 2: Fetching Vehicle Data');
    console.log('─────────────────────────────────────────────────────────\n');

    const vehicle = await Vehicle.findOne({ vehicleId: prediction.vehicleId });
    if (!vehicle) {
      throw new Error(`Vehicle not found: ${prediction.vehicleId}`);
    }

    console.log('✅ Vehicle loaded:');
    console.log(`   ID: ${vehicle.vehicleId}`);
    console.log(`   Make/Model: ${vehicle.vehicleInfo.make} ${vehicle.vehicleInfo.model} ${vehicle.vehicleInfo.year}`);
    console.log(`   Owner: ${vehicle.owner.name}`);
    console.log(`   Contact: ${vehicle.owner.contact}`);
    console.log(`   Preferred Channel: ${vehicle.owner.preferredChannel}\n`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: CREATE CASE
    // ═══════════════════════════════════════════════════════════════
    console.log('📋 STEP 3: Creating Case');
    console.log('─────────────────────────────────────────────────────────\n');

    const caseId = `CASE-${Date.now()}`;
    caseRecord = await Case.create({
      caseId: caseId,
      vehicleId: vehicle.vehicleId,
      predictionId: prediction._id,
      currentState: 'RECEIVED',
      severity: 'unknown', // Will be determined by MasterAgent
      agentResults: {},
      metadata: {
        orchestrationStarted: new Date(),
        predictionType: prediction.predictionType,
        confidence: prediction.confidence,
        etaDays: prediction.etaDays
      }
    });

    console.log('✅ Case created:');
    console.log(`   Case ID: ${caseRecord.caseId}`);
    console.log(`   State: ${caseRecord.currentState}`);
    console.log(`   Created: ${caseRecord.createdAt}\n`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 4: RUN MASTER AGENT
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🎯 STEP 4: Running Master Agent (Orchestration Decision)');
    console.log('═══════════════════════════════════════════════════════════\n');

    // UEBA: Track MasterAgent execution
    const masterEventId = await uebaMonitor.logAgentStart('MasterAgent', {
      caseId: caseRecord.caseId,
      vehicleId: vehicle.vehicleId,
      predictionId: prediction._id.toString()
    });
    const masterStartTime = Date.now();

    let masterResult;
    try {
      masterResult = await masterAgent(prediction, vehicle);

      // UEBA: Log successful completion
      await uebaMonitor.logAgentComplete(
        masterEventId,
        'MasterAgent',
        Date.now() - masterStartTime,
        {
          caseId: caseRecord.caseId,
          vehicleId: vehicle.vehicleId,
          predictionId: prediction._id.toString(),
          metadata: { severity: masterResult.severity, agentsToInvoke: masterResult.agentsToInvoke }
        }
      );
    } catch (error) {
      // UEBA: Log failure
      await uebaMonitor.logAgentFailure(
        masterEventId,
        'MasterAgent',
        Date.now() - masterStartTime,
        error.message,
        {
          caseId: caseRecord.caseId,
          vehicleId: vehicle.vehicleId,
          predictionId: prediction._id.toString()
        }
      );
      throw error;
    }

    console.log('✅ Master Agent Decision:');
    console.log(`   Severity: ${masterResult.severity.toUpperCase()}`);
    console.log(`   Contact Customer: ${masterResult.customerContact ? 'YES' : 'NO'}`);
    console.log(`   Workflow: ${masterResult.workflowType}`);
    console.log(`   Agents to Invoke: ${masterResult.agentsToInvoke.join(', ')}\n`);

    // Update Case with MasterAgent results
    await Case.findOneAndUpdate(
      { caseId: caseRecord.caseId },
      {
        severity: masterResult.severity,
        currentState: 'ORCHESTRATING',
        'agentResults.masterAgent': masterResult,
        'metadata.agentsToInvoke': masterResult.agentsToInvoke
      }
    );

    // ═══════════════════════════════════════════════════════════════
    // STEP 5: RUN WORKER AGENTS SEQUENTIALLY
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔄 STEP 5: Running Worker Agents');
    console.log('═══════════════════════════════════════════════════════════\n');

    const workerResults = {
      diagnosticAgent: null,
      communicationAgent: null,
      schedulingAgent: null
    };

    // Run Diagnostic Agent (usually first)
    if (masterResult.agentsToInvoke.includes('DiagnosticAgent')) {
      console.log('🔍 Running Diagnostic Agent...\n');

      // UEBA: Track DiagnosticAgent execution
      const diagEventId = await uebaMonitor.logAgentStart('DiagnosticAgent', {
        caseId: caseRecord.caseId,
        vehicleId: vehicle.vehicleId,
        predictionId: prediction._id.toString()
      });
      const diagStartTime = Date.now();

      let diagnosticResult;
      try {
        diagnosticResult = await diagnosticAgent(prediction, vehicle);

        // UEBA: Log successful completion
        await uebaMonitor.logAgentComplete(
          diagEventId,
          'DiagnosticAgent',
          Date.now() - diagStartTime,
          {
            caseId: caseRecord.caseId,
            vehicleId: vehicle.vehicleId,
            predictionId: prediction._id.toString(),
            metadata: { risk: diagnosticResult.risk, urgency: diagnosticResult.urgency }
          }
        );
      } catch (error) {
        // UEBA: Log failure
        await uebaMonitor.logAgentFailure(
          diagEventId,
          'DiagnosticAgent',
          Date.now() - diagStartTime,
          error.message,
          {
            caseId: caseRecord.caseId,
            vehicleId: vehicle.vehicleId,
            predictionId: prediction._id.toString()
          }
        );
        throw error;
      }

      workerResults.diagnosticAgent = diagnosticResult;

      await Case.findOneAndUpdate(
        { caseId: caseRecord.caseId },
        { 'agentResults.diagnosticAgent': diagnosticResult }
      );

      console.log('✅ Diagnostic Agent complete:');
      console.log(`   Risk: ${diagnosticResult.risk}`);
      console.log(`   Urgency: ${diagnosticResult.urgency}`);
      console.log(`   Summary: ${diagnosticResult.summary.substring(0, 60)}...\n`);
    }

    // Run Scheduling Agent (uses diagnostic results)
    if (masterResult.agentsToInvoke.includes('SchedulerAgent')) {
      console.log('📅 Running Scheduling Agent...\n');

      // UEBA: Track SchedulingAgent execution
      const schedEventId = await uebaMonitor.logAgentStart('SchedulingAgent', {
        caseId: caseRecord.caseId,
        vehicleId: vehicle.vehicleId,
        predictionId: prediction._id.toString()
      });
      const schedStartTime = Date.now();

      let schedulingResult;
      try {
        // Look up owner's UserProfile for geo-location scoring
        let ownerProfile = null;
        if (vehicle.owner?.contact) {
          ownerProfile = await UserProfile.findOne({ phone: vehicle.owner.contact }).lean();
          if (ownerProfile) {
            console.log(`   📍 Found owner profile: ${ownerProfile.name} (${ownerProfile.role})`);
          }
        }

        schedulingResult = await schedulingAgent({
          diagnosticResult: workerResults.diagnosticAgent || { urgency: 'medium', risk: 'medium', summary: 'No diagnostic data' },
          vehicle,
          prediction,
          caseId: caseRecord.caseId,
          userId: ownerProfile?.userId || null,
          userProfile: ownerProfile
        });

        // UEBA: Log successful completion
        await uebaMonitor.logAgentComplete(
          schedEventId,
          'SchedulingAgent',
          Date.now() - schedStartTime,
          {
            caseId: caseRecord.caseId,
            vehicleId: vehicle.vehicleId,
            predictionId: prediction._id.toString(),
            metadata: {
              status: schedulingResult.status,
              suggestionsCount: schedulingResult.suggestions?.length || 0
            }
          }
        );
      } catch (error) {
        // UEBA: Log failure
        await uebaMonitor.logAgentFailure(
          schedEventId,
          'SchedulingAgent',
          Date.now() - schedStartTime,
          error.message,
          {
            caseId: caseRecord.caseId,
            vehicleId: vehicle.vehicleId,
            predictionId: prediction._id.toString()
          }
        );
        throw error;
      }

      workerResults.schedulingAgent = schedulingResult;

      // Note: schedulingAgent v2 saves to Case internally, but we update
      // the scheduling result reference in workerResults for the orchestrator

      console.log('✅ Scheduling Agent complete:');
      console.log(`   Urgency: ${schedulingResult.schedulingUrgency}`);
      console.log(`   Algorithm: ${schedulingResult.algorithm}`);
      console.log(`   Execution: ${schedulingResult.executionTimeMs}ms`);
      console.log(`   Primary Date: ${schedulingResult.primaryRecommendation.date}`);
      console.log(`   Primary Center: ${schedulingResult.primaryRecommendation.serviceCenter}`);
      console.log(`   Suggestions: ${schedulingResult.suggestions?.length || 0}`);
      console.log(`   Alternatives: ${schedulingResult.alternativeRecommendations.length}\n`);
    }

    // Run Communication Agent (usually last, uses all prior results)
    if (masterResult.agentsToInvoke.includes('CommunicationAgent')) {
      console.log('📧 Running Communication Agent...\n');

      // UEBA: Track CommunicationAgent execution
      const commEventId = await uebaMonitor.logAgentStart('CommunicationAgent', {
        caseId: caseRecord.caseId,
        vehicleId: vehicle.vehicleId,
        predictionId: prediction._id.toString()
      });
      const commStartTime = Date.now();

      if (!workerResults.diagnosticAgent) {
        console.log('⚠️  Communication Agent requires Diagnostic Agent output');
        console.log('   Running Diagnostic Agent first...\n');
        workerResults.diagnosticAgent = await diagnosticAgent(prediction, vehicle);
        await Case.findOneAndUpdate(
          { caseId: caseRecord.caseId },
          { 'agentResults.diagnosticAgent': workerResults.diagnosticAgent }
        );
      }

      let communicationResult;
      try {
        communicationResult = await communicationAgent(
          masterResult.severity,
          workerResults.diagnosticAgent,
          vehicle
        );

        // UEBA: Log successful completion
        await uebaMonitor.logAgentComplete(
          commEventId,
          'CommunicationAgent',
          Date.now() - commStartTime,
          {
            caseId: caseRecord.caseId,
            vehicleId: vehicle.vehicleId,
            predictionId: prediction._id.toString(),
            metadata: {
              channel: communicationResult.channel,
              tone: communicationResult.tone
            }
          }
        );
      } catch (error) {
        // UEBA: Log failure
        await uebaMonitor.logAgentFailure(
          commEventId,
          'CommunicationAgent',
          Date.now() - commStartTime,
          error.message,
          {
            caseId: caseRecord.caseId,
            vehicleId: vehicle.vehicleId,
            predictionId: prediction._id.toString()
          }
        );
        throw error;
      }

      workerResults.communicationAgent = communicationResult;

      await Case.findOneAndUpdate(
        { caseId: caseRecord.caseId },
        { 'agentResults.communicationAgent': communicationResult }
      );

      console.log('✅ Communication Agent complete:');
      console.log(`   Channel: ${communicationResult.channel}`);
      console.log(`   Tone: ${communicationResult.tone}`);
      console.log(`   Message Preview: ${communicationResult.messageText.substring(0, 60)}...\n`);
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 6: STORE FINAL RESULTS
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('💾 STEP 6: Storing Final Results');
    console.log('═══════════════════════════════════════════════════════════\n');

    const executionTime = Date.now() - startTime;

    await Case.findOneAndUpdate(
      { caseId: caseRecord.caseId },
      {
        'metadata.orchestrationCompleted': new Date(),
        'metadata.executionTimeMs': executionTime,
        'metadata.agentsExecuted': masterResult.agentsToInvoke,
        'metadata.allAgentsCompleted': true
      }
    );

    console.log('✅ Results stored in Case');
    console.log(`   Execution Time: ${executionTime}ms\n`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 7: UPDATE CASE STATE
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔄 STEP 7: Updating Case State');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Determine final state based on workflow
    let finalState = 'PROCESSED';

    if (workerResults.schedulingAgent && workerResults.schedulingAgent.userApprovalRequired) {
      finalState = 'AWAITING_USER_APPROVAL';
    } else if (masterResult.customerContact) {
      finalState = 'CUSTOMER_NOTIFIED';
    }

    await Case.findOneAndUpdate(
      { caseId: caseRecord.caseId },
      { currentState: finalState }
    );

    console.log('✅ Case state updated:');
    console.log(`   Final State: ${finalState}\n`);

    // ═══════════════════════════════════════════════════════════════
    // ORCHESTRATION COMPLETE
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ ORCHESTRATION COMPLETE');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Get final Case state from database
    const finalCase = await Case.findOne({ caseId: caseRecord.caseId });

    console.log('📊 Summary:');
    console.log(`   Case ID: ${finalCase.caseId}`);
    console.log(`   Severity: ${finalCase.severity}`);
    console.log(`   State: ${finalCase.currentState}`);
    console.log(`   Execution Time: ${executionTime}ms`);
    console.log(`   Agents Executed: ${masterResult.agentsToInvoke.length}`);
    console.log('');

    // Return complete orchestration result
    return {
      success: true,
      caseId: finalCase.caseId,
      severity: finalCase.severity,
      state: finalCase.currentState,
      executionTimeMs: executionTime,
      agentsExecuted: masterResult.agentsToInvoke,
      results: {
        master: masterResult,
        diagnostic: workerResults.diagnosticAgent,
        scheduling: workerResults.schedulingAgent,
        communication: workerResults.communicationAgent
      },
      case: finalCase
    };

  } catch (error) {
    console.error('\n═══════════════════════════════════════════════════════════');
    console.error('❌ ORCHESTRATION FAILED');
    console.error('═══════════════════════════════════════════════════════════\n');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);

    // Update Case with error state if Case was created
    if (caseRecord) {
      await Case.findOneAndUpdate(
        { caseId: caseRecord.caseId },
        {
          currentState: 'FAILED',
          'metadata.error': error.message,
          'metadata.errorStack': error.stack,
          'metadata.orchestrationCompleted': new Date()
        }
      );
    }

    throw error;
  }
}

/**
 * Orchestrate agents for a prediction event by vehicleId and predictionType
 * Useful when you don't have the prediction ObjectId
 * 
 * @param {string} vehicleId - The vehicle ID
 * @param {string} predictionType - Type of prediction (optional, uses most recent if not specified)
 * @returns {Object} Complete orchestration result
 */
async function orchestrateByVehicle(vehicleId, predictionType = null) {
  console.log(`🔍 Finding prediction for vehicle: ${vehicleId}`);

  const query = { vehicleId: vehicleId };
  if (predictionType) {
    query.predictionType = predictionType;
  }

  const prediction = await PredictionEvent.findOne(query).sort({ createdAt: -1 });

  if (!prediction) {
    throw new Error(`No prediction found for vehicle ${vehicleId}`);
  }

  console.log(`✅ Found prediction: ${prediction._id}\n`);

  return orchestrateAgents(prediction._id);
}

module.exports = {
  orchestrateAgents,
  orchestrateByVehicle
};
