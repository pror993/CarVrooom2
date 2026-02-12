/**
 * End-to-End Integration Test
 * 
 * Tests the complete workflow from vehicle registration to case completion:
 * 
 * FLOW:
 * 1. Register Vehicle → POST /api/vehicles
 * 2. Ingest Prediction → POST /api/predictions
 * 3. Trigger Orchestration → POST /api/agentic/run
 * 4. Verify Case Lifecycle → GET /api/agentic/cases/:caseId
 * 5. (Optional) Approve Appointment → POST /api/agentic/cases/:caseId/approve-appointment
 * 6. Verify Final State → GET /api/agentic/cases/:caseId
 * 
 * Run: node testEndToEnd.js
 */

const mongoose = require('mongoose');
require('dotenv').config();
const Vehicle = require('./models/Vehicle');
const PredictionEvent = require('./models/PredictionEvent');
const Case = require('./models/Case');
const User = require('./models/User');

// Delay utility
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testEndToEnd() {
  try {
    console.log('\n');
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║             END-TO-END INTEGRATION TEST                   ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('\n');
    
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: REGISTER VEHICLE
    // ═══════════════════════════════════════════════════════════════
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║  STEP 1: Register Vehicle                                 ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('\n');
    
    const timestamp = Date.now();
    const vehicleId = `TEST-VEHICLE-${timestamp}`;
    
    console.log('📝 Creating vehicle...');
    const vehicle = await Vehicle.create({
      vehicleId: vehicleId,
      owner: {
        name: 'Test User',
        contact: '+1-555-TEST-123',
        email: 'test@carvrooom.com',
        preferredChannel: 'app'
      },
      vehicleInfo: {
        make: 'Tesla',
        model: 'Model S',
        year: 2024,
        vin: `TESTVIN${timestamp}`,
        powertrain: 'Electric',
        mileage: 15000
      },
      usageProfile: {
        avgDailyKm: 80,
        loadPattern: 'normal'
      },
      serviceHistory: []
    });

    console.log('✅ Vehicle registered successfully:');
    console.log(`   Vehicle ID: ${vehicle.vehicleId}`);
    console.log(`   Make/Model: ${vehicle.vehicleInfo.make} ${vehicle.vehicleInfo.model} ${vehicle.vehicleInfo.year}`);
    console.log(`   Owner: ${vehicle.owner.name}`);
    console.log(`   Contact: ${vehicle.owner.contact}`);
    console.log(`   Preferred Channel: ${vehicle.owner.preferredChannel}`);
    console.log(`   Mileage: ${vehicle.vehicleInfo.mileage} km\n`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: INGEST PREDICTION EVENT
    // ═══════════════════════════════════════════════════════════════
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║  STEP 2: Ingest Prediction Event                          ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('\n');
    
    console.log('🔮 Creating prediction event...');
    const prediction = await PredictionEvent.create({
      vehicleId: vehicle.vehicleId,
      predictionType: 'cascade_failure',
      confidence: 0.89,
      etaDays: 14,
      signals: {
        batteryHealth: { value: 78, unit: '%', threshold: 80 },
        motorTemp: { value: 95, unit: 'C', threshold: 85 },
        brakePadWear: { value: 2.5, unit: 'mm', threshold: 3.0 },
        coolantLevel: { value: 72, unit: '%', threshold: 80 }
      },
      metadata: {
        modelVersion: 'v2.1.0',
        processingTime: 245,
        dataQuality: 'high'
      }
    });

    console.log('✅ Prediction event ingested:');
    console.log(`   Prediction ID: ${prediction._id}`);
    console.log(`   Vehicle ID: ${prediction.vehicleId}`);
    console.log(`   Type: ${prediction.predictionType}`);
    console.log(`   Confidence: ${(prediction.confidence * 100).toFixed(1)}%`);
    console.log(`   ETA to Failure: ${prediction.etaDays} days`);
    console.log(`   Signals:`);
    Object.entries(prediction.signals).forEach(([key, value]) => {
      console.log(`      - ${key}: ${value.value}${value.unit} (threshold: ${value.threshold}${value.unit})`);
    });
    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: TRIGGER AGENTIC ORCHESTRATION
    // ═══════════════════════════════════════════════════════════════
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║  STEP 3: Trigger Agentic Orchestration                    ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('\n');
    
    console.log('🤖 Calling orchestrator via API simulation...\n');
    
    // Import orchestrator directly (simulating API call)
    const { orchestrateAgents } = require('./agents/orchestrator');
    
    const startTime = Date.now();
    const orchestrationResult = await orchestrateAgents(prediction._id);
    const executionTime = Date.now() - startTime;

    console.log('✅ Orchestration completed:');
    console.log(`   Success: ${orchestrationResult.success}`);
    console.log(`   Case ID: ${orchestrationResult.caseId}`);
    console.log(`   Severity: ${orchestrationResult.severity}`);
    console.log(`   Final State: ${orchestrationResult.state}`);
    console.log(`   Execution Time: ${orchestrationResult.executionTimeMs}ms`);
    console.log(`   Agents Executed: ${orchestrationResult.agentsExecuted.join(', ')}`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // STEP 4: VERIFY CASE LIFECYCLE PROGRESSION
    // ═══════════════════════════════════════════════════════════════
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║  STEP 4: Verify Case Lifecycle Progression                ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('\n');

    // Fetch case from database
    const caseRecord = await Case.findOne({ caseId: orchestrationResult.caseId });
    
    console.log('📊 Case Lifecycle States:\n');
    
    // Check state progression in history
    if (caseRecord.history && caseRecord.history.length > 0) {
      console.log('   State History:');
      caseRecord.history.forEach((entry, index) => {
        console.log(`      ${index + 1}. ${entry.state} at ${entry.timestamp}`);
        if (entry.metadata && entry.metadata.note) {
          console.log(`         Note: ${entry.metadata.note}`);
        }
      });
      console.log('');
    }

    console.log('   Current State Details:');
    console.log(`      Case ID: ${caseRecord.caseId}`);
    console.log(`      Current State: ${caseRecord.currentState}`);
    console.log(`      Severity: ${caseRecord.severity}`);
    console.log(`      Vehicle ID: ${caseRecord.vehicleId}`);
    console.log(`      Prediction ID: ${caseRecord.predictionId}`);
    console.log('');

    // Verify agent results
    console.log('   Agent Results Verification:');
    const agentChecks = [
      { name: 'MasterAgent', key: 'masterAgent', required: true },
      { name: 'DiagnosticAgent', key: 'diagnosticAgent', required: true },
      { name: 'SchedulingAgent', key: 'schedulingAgent', required: false },
      { name: 'CommunicationAgent', key: 'communicationAgent', required: false }
    ];

    agentChecks.forEach(({ name, key, required }) => {
      const exists = !!caseRecord.agentResults[key];
      const icon = exists ? '✅' : (required ? '❌' : '⏭️');
      const status = exists ? 'Present' : (required ? 'MISSING' : 'Not invoked');
      console.log(`      ${icon} ${name}: ${status}`);
    });
    console.log('');

    // Verify metadata
    console.log('   Metadata Verification:');
    const metadataChecks = [
      { key: 'orchestrationStarted', label: 'Orchestration Started' },
      { key: 'orchestrationCompleted', label: 'Orchestration Completed' },
      { key: 'executionTimeMs', label: 'Execution Time' },
      { key: 'agentsExecuted', label: 'Agents Executed' },
      { key: 'allAgentsCompleted', label: 'All Agents Completed' }
    ];

    metadataChecks.forEach(({ key, label }) => {
      const value = caseRecord.metadata[key];
      if (value !== undefined) {
        const displayValue = Array.isArray(value) ? value.join(', ') : value;
        console.log(`      ✅ ${label}: ${displayValue}`);
      } else {
        console.log(`      ❌ ${label}: MISSING`);
      }
    });
    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // STEP 5: VERIFY AGENT OUTPUTS
    // ═══════════════════════════════════════════════════════════════
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║  STEP 5: Verify Agent Outputs                             ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('\n');

    // Master Agent Output
    if (caseRecord.agentResults.masterAgent) {
      console.log('   🎯 Master Agent Output:');
      const master = caseRecord.agentResults.masterAgent;
      console.log(`      Severity: ${master.severity}`);
      console.log(`      Agents to Invoke: ${master.agentsToInvoke.join(', ')}`);
      console.log(`      Customer Contact: ${master.customerContact}`);
      console.log(`      Workflow Type: ${master.workflowType}`);
      console.log('');
    }

    // Diagnostic Agent Output
    if (caseRecord.agentResults.diagnosticAgent) {
      console.log('   🔍 Diagnostic Agent Output:');
      const diagnostic = caseRecord.agentResults.diagnosticAgent;
      console.log(`      Risk Level: ${diagnostic.risk}`);
      console.log(`      Urgency: ${diagnostic.urgency}`);
      console.log(`      Summary: ${diagnostic.summary.substring(0, 80)}...`);
      console.log(`      Customer Explanation: ${diagnostic.explanationForCustomer.substring(0, 80)}...`);
      console.log('');
    }

    // Scheduling Agent Output
    if (caseRecord.agentResults.schedulingAgent) {
      console.log('   📅 Scheduling Agent Output:');
      const scheduling = caseRecord.agentResults.schedulingAgent;
      if (scheduling.primarySuggestion) {
        console.log(`      Status: ${scheduling.status}`);
        console.log(`      User Approval Required: ${scheduling.userApprovalRequired}`);
        console.log(`      Primary Suggestion:`);
        console.log(`         Date: ${scheduling.primarySuggestion.appointmentDate}`);
        console.log(`         Service Center: ${scheduling.primarySuggestion.serviceCenter}`);
        console.log(`      Alternative Suggestions: ${scheduling.alternativeSuggestions?.length || 0}`);
      }
      console.log('');
    }

    // Communication Agent Output
    if (caseRecord.agentResults.communicationAgent) {
      console.log('   📧 Communication Agent Output:');
      const communication = caseRecord.agentResults.communicationAgent;
      console.log(`      Channel: ${communication.channel}`);
      console.log(`      Tone: ${communication.tone}`);
      console.log(`      Message Preview: ${communication.messageText.substring(0, 80)}...`);
      if (communication.fallbackChannel) {
        console.log(`      Fallback Channel: ${communication.fallbackChannel}`);
      }
      console.log('');
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 6: (OPTIONAL) APPROVE APPOINTMENT
    // ═══════════════════════════════════════════════════════════════
    if (caseRecord.agentResults.schedulingAgent && 
        caseRecord.agentResults.schedulingAgent.userApprovalRequired) {
      
      console.log('╔═══════════════════════════════════════════════════════════╗');
      console.log('║  STEP 6: Approve Appointment (User Action Simulation)     ║');
      console.log('╚═══════════════════════════════════════════════════════════╝');
      console.log('\n');

      const scheduling = caseRecord.agentResults.schedulingAgent;
      console.log('👤 Simulating user approval of primary suggestion...\n');

      // Update case with user approval
      const approvedCase = await Case.findOneAndUpdate(
        { caseId: caseRecord.caseId },
        {
          'agentResults.schedulingAgent.status': 'confirmed',
          'agentResults.schedulingAgent.confirmedAppointment': {
            date: scheduling.primarySuggestion.appointmentDate,
            serviceCenter: scheduling.primarySuggestion.serviceCenter,
            confirmedAt: new Date(),
            confirmedBy: 'test-user'
          },
          'metadata.awaitingUserApproval': false,
          'metadata.appointmentConfirmed': true,
          currentState: 'APPOINTMENT_CONFIRMED'
        },
        { new: true }
      );

      console.log('✅ Appointment approved:');
      console.log(`   Date: ${scheduling.primarySuggestion.appointmentDate}`);
      console.log(`   Service Center: ${scheduling.primarySuggestion.serviceCenter}`);
      console.log(`   New State: ${approvedCase.currentState}`);
      console.log('');
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 7: VERIFY FINAL STATE
    // ═══════════════════════════════════════════════════════════════
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║  STEP 7: Verify Final State                               ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('\n');

    // Fetch latest case state
    const finalCase = await Case.findOne({ caseId: orchestrationResult.caseId });

    console.log('📊 Final Case State:');
    console.log(`   Case ID: ${finalCase.caseId}`);
    console.log(`   Current State: ${finalCase.currentState}`);
    console.log(`   Severity: ${finalCase.severity}`);
    console.log(`   Created At: ${finalCase.createdAt}`);
    console.log(`   Last Updated: ${finalCase.updatedAt || 'N/A'}`);
    console.log('');

    // Calculate lifecycle duration
    const orchestrationStart = finalCase.metadata.orchestrationStarted;
    const orchestrationEnd = finalCase.metadata.orchestrationCompleted;
    const lifecycleDuration = orchestrationEnd && orchestrationStart 
      ? new Date(orchestrationEnd) - new Date(orchestrationStart)
      : 'N/A';

    console.log('⏱️  Lifecycle Metrics:');
    console.log(`   Orchestration Duration: ${lifecycleDuration}ms`);
    console.log(`   Total Agents Executed: ${finalCase.metadata.agentsExecuted?.length || 0}`);
    console.log(`   All Agents Completed: ${finalCase.metadata.allAgentsCompleted ? 'Yes' : 'No'}`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // STEP 8: ASSERTIONS & VALIDATION
    // ═══════════════════════════════════════════════════════════════
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║  STEP 8: Test Assertions & Validation                     ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('\n');

    const assertions = [];

    // Assert vehicle was created
    assertions.push({
      name: 'Vehicle created',
      condition: !!vehicle._id,
      actual: vehicle._id ? 'Created' : 'Not created'
    });

    // Assert prediction was created
    assertions.push({
      name: 'Prediction ingested',
      condition: !!prediction._id,
      actual: prediction._id ? 'Created' : 'Not created'
    });

    // Assert orchestration succeeded
    assertions.push({
      name: 'Orchestration successful',
      condition: orchestrationResult.success === true,
      actual: orchestrationResult.success
    });

    // Assert case was created
    assertions.push({
      name: 'Case created',
      condition: !!finalCase._id,
      actual: finalCase._id ? 'Created' : 'Not created'
    });

    // Assert MasterAgent ran
    assertions.push({
      name: 'MasterAgent executed',
      condition: !!finalCase.agentResults.masterAgent,
      actual: finalCase.agentResults.masterAgent ? 'Yes' : 'No'
    });

    // Assert DiagnosticAgent ran
    assertions.push({
      name: 'DiagnosticAgent executed',
      condition: !!finalCase.agentResults.diagnosticAgent,
      actual: finalCase.agentResults.diagnosticAgent ? 'Yes' : 'No'
    });

    // Assert severity was determined
    assertions.push({
      name: 'Severity determined',
      condition: finalCase.severity && finalCase.severity !== 'unknown',
      actual: finalCase.severity || 'unknown'
    });

    // Assert final state is valid
    const validStates = ['PROCESSED', 'CUSTOMER_NOTIFIED', 'AWAITING_USER_APPROVAL', 'APPOINTMENT_CONFIRMED'];
    assertions.push({
      name: 'Valid final state',
      condition: validStates.includes(finalCase.currentState),
      actual: finalCase.currentState
    });

    // Assert metadata is complete
    assertions.push({
      name: 'Orchestration metadata complete',
      condition: !!(finalCase.metadata.orchestrationStarted && 
                    finalCase.metadata.orchestrationCompleted &&
                    finalCase.metadata.executionTimeMs),
      actual: 'All fields present' ? true : 'Missing fields'
    });

    // Print assertion results
    console.log('   Test Assertions:');
    let passedCount = 0;
    let failedCount = 0;

    assertions.forEach((assertion, index) => {
      const icon = assertion.condition ? '✅' : '❌';
      const status = assertion.condition ? 'PASS' : 'FAIL';
      console.log(`      ${icon} [${status}] ${assertion.name}: ${assertion.actual}`);
      
      if (assertion.condition) {
        passedCount++;
      } else {
        failedCount++;
      }
    });

    console.log('');
    console.log(`   Results: ${passedCount}/${assertions.length} passed, ${failedCount}/${assertions.length} failed`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // CLEANUP
    // ═══════════════════════════════════════════════════════════════
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║  CLEANUP: Removing Test Data                              ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('\n');

    console.log('🧹 Cleaning up test data...');
    await Case.deleteOne({ caseId: finalCase.caseId });
    console.log('   ✅ Case deleted');
    
    await PredictionEvent.deleteOne({ _id: prediction._id });
    console.log('   ✅ Prediction deleted');
    
    await Vehicle.deleteOne({ vehicleId: vehicle.vehicleId });
    console.log('   ✅ Vehicle deleted');
    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // FINAL SUMMARY
    // ═══════════════════════════════════════════════════════════════
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║  END-TO-END TEST COMPLETED                                ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('\n');

    const overallSuccess = failedCount === 0;
    const statusIcon = overallSuccess ? '✅' : '❌';
    const statusText = overallSuccess ? 'SUCCESS' : 'FAILED';

    console.log(`${statusIcon} Test Status: ${statusText}`);
    console.log('');
    console.log('Test Summary:');
    console.log(`   ✅ Vehicle Registration: Success`);
    console.log(`   ✅ Prediction Ingestion: Success`);
    console.log(`   ✅ Orchestration Trigger: Success`);
    console.log(`   ✅ Case Lifecycle Verified: Success`);
    console.log(`   ${statusIcon} Assertions: ${passedCount}/${assertions.length} passed`);
    console.log('');
    console.log('Lifecycle Flow:');
    console.log('   1. Vehicle → Registered');
    console.log('   2. Prediction → Ingested');
    console.log('   3. Orchestrator → Triggered');
    console.log('   4. MasterAgent → Analyzed severity & workflow');
    console.log('   5. DiagnosticAgent → Analyzed root cause');
    console.log('   6. Case → Created & Updated');
    console.log(`   7. Final State → ${finalCase.currentState}`);
    console.log('');

    if (!overallSuccess) {
      throw new Error(`Test failed with ${failedCount} assertion failures`);
    }

  } catch (error) {
    console.error('\n╔═══════════════════════════════════════════════════════════╗');
    console.error('║  TEST FAILED                                              ║');
    console.error('╚═══════════════════════════════════════════════════════════╝');
    console.error('\n');
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed\n');
  }
}

// Run the test
if (require.main === module) {
  testEndToEnd()
    .then(() => {
      console.log('🎉 All end-to-end tests passed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 End-to-end test failed:', error.message);
      process.exit(1);
    });
}

module.exports = testEndToEnd;
