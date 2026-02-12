/**
 * Agent Orchestrator Test
 * 
 * Tests the complete agentic workflow orchestration
 * 
 * Run: node testOrchestrator.js
 */

const mongoose = require('mongoose');
require('dotenv').config();
const { orchestrateAgents, orchestrateByVehicle } = require('./agents/orchestrator');
const Vehicle = require('./models/Vehicle');
const PredictionEvent = require('./models/PredictionEvent');
const Case = require('./models/Case');

async function testOrchestrator() {
  try {
    console.log('\n');
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║       AGENT ORCHESTRATOR TEST                             ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('\n');
    
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // ═══════════════════════════════════════════════════════════════
    // SETUP: Get or Create Test Data
    // ═══════════════════════════════════════════════════════════════
    console.log('📋 Setting up test data...\n');
    
    let vehicle = await Vehicle.findOne().sort({ createdAt: -1 });
    
    if (!vehicle) {
      vehicle = await Vehicle.create({
        vehicleId: `VEHICLE-${Date.now()}`,
        owner: {
          name: 'Jane Smith',
          contact: '+1234567890',
          preferredChannel: 'sms'
        },
        vehicleInfo: {
          make: 'Tesla',
          model: 'Model 3',
          year: 2024,
          powertrain: 'Electric'
        },
        usageProfile: {
          avgDailyKm: 85,
          loadPattern: 'normal'
        },
        serviceHistory: []
      });
    }

    let prediction = await PredictionEvent.findOne({ 
      vehicleId: vehicle.vehicleId 
    }).sort({ createdAt: -1 });
    
    if (!prediction) {
      prediction = await PredictionEvent.create({
        vehicleId: vehicle.vehicleId,
        predictionType: 'cascade_failure',
        confidence: 0.87,
        etaDays: 12,
        signals: {
          engineVibration: { value: 8.5, unit: 'hz', threshold: 5.0 },
          oilPressure: { value: 28, unit: 'psi', threshold: 40 },
          coolantTemp: { value: 210, unit: 'F', threshold: 195 }
        }
      });
    }

    console.log('✅ Test data ready:');
    console.log(`   Vehicle: ${vehicle.vehicleInfo.make} ${vehicle.vehicleInfo.model} ${vehicle.vehicleInfo.year}`);
    console.log(`   Vehicle ID: ${vehicle.vehicleId}`);
    console.log(`   Prediction: ${prediction.predictionType} (${(prediction.confidence * 100).toFixed(1)}%)`);
    console.log(`   Prediction ID: ${prediction._id}`);
    console.log(`   ETA: ${prediction.etaDays} days\n`);

    // ═══════════════════════════════════════════════════════════════
    // TEST: Run Orchestrator
    // ═══════════════════════════════════════════════════════════════
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║       RUNNING ORCHESTRATOR                                ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('\n');

    const result = await orchestrateAgents(prediction._id);

    // ═══════════════════════════════════════════════════════════════
    // VERIFY: Check Results
    // ═══════════════════════════════════════════════════════════════
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║       ORCHESTRATION RESULTS                               ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('\n');

    console.log('✅ Orchestration Status:');
    console.log(`   Success: ${result.success}`);
    console.log(`   Case ID: ${result.caseId}`);
    console.log(`   Severity: ${result.severity}`);
    console.log(`   Final State: ${result.state}`);
    console.log(`   Execution Time: ${result.executionTimeMs}ms`);
    console.log(`   Agents Executed: ${result.agentsExecuted.join(', ')}`);
    console.log('\n');

    console.log('📊 Agent Results Summary:\n');

    // Master Agent
    if (result.results.master) {
      console.log('   🎯 Master Agent:');
      console.log(`      Severity: ${result.results.master.severity}`);
      console.log(`      Contact Customer: ${result.results.master.customerContact}`);
      console.log(`      Workflow: ${result.results.master.workflowType}\n`);
    }

    // Diagnostic Agent
    if (result.results.diagnostic) {
      console.log('   🔍 Diagnostic Agent:');
      console.log(`      Risk: ${result.results.diagnostic.risk}`);
      console.log(`      Urgency: ${result.results.diagnostic.urgency}`);
      console.log(`      Summary: ${result.results.diagnostic.summary.substring(0, 70)}...\n`);
    }

    // Scheduling Agent
    if (result.results.scheduling) {
      console.log('   📅 Scheduling Agent:');
      console.log(`      Urgency: ${result.results.scheduling.schedulingUrgency}`);
      console.log(`      Primary Date: ${result.results.scheduling.primaryRecommendation.date}`);
      console.log(`      Primary Center: ${result.results.scheduling.primaryRecommendation.serviceCenter}`);
      console.log(`      Alternatives: ${result.results.scheduling.alternativeRecommendations.length}`);
      console.log(`      User Approval Required: ${result.results.scheduling.userApprovalRequired}\n`);
    }

    // Communication Agent
    if (result.results.communication) {
      console.log('   📧 Communication Agent:');
      console.log(`      Channel: ${result.results.communication.channel}`);
      console.log(`      Tone: ${result.results.communication.tone}`);
      console.log(`      Message: ${result.results.communication.messageText.substring(0, 70)}...\n`);
    }

    // ═══════════════════════════════════════════════════════════════
    // VERIFY: Check Case in Database
    // ═══════════════════════════════════════════════════════════════
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║       DATABASE VERIFICATION                               ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('\n');

    const caseRecord = await Case.findOne({ caseId: result.caseId });
    
    console.log('✅ Case stored in database:');
    console.log(`   Case ID: ${caseRecord.caseId}`);
    console.log(`   State: ${caseRecord.currentState}`);
    console.log(`   Severity: ${caseRecord.severity}`);
    console.log(`   Vehicle ID: ${caseRecord.vehicleId}`);
    console.log(`   Created: ${caseRecord.createdAt}`);
    console.log(`   Updated: ${caseRecord.updatedAt}`);
    console.log('\n');

    console.log('📦 Agent Results Stored:');
    console.log(`   Master Agent: ${caseRecord.agentResults.masterAgent ? '✅' : '❌'}`);
    console.log(`   Diagnostic Agent: ${caseRecord.agentResults.diagnosticAgent ? '✅' : '❌'}`);
    console.log(`   Scheduling Agent: ${caseRecord.agentResults.schedulingAgent ? '✅' : '❌'}`);
    console.log(`   Communication Agent: ${caseRecord.agentResults.communicationAgent ? '✅' : '❌'}`);
    console.log('\n');

    console.log('🔧 Metadata:');
    console.log(`   Orchestration Started: ${caseRecord.metadata?.orchestrationStarted || 'N/A'}`);
    console.log(`   Orchestration Completed: ${caseRecord.metadata?.orchestrationCompleted || 'N/A'}`);
    console.log(`   Execution Time: ${caseRecord.metadata?.executionTimeMs || 'N/A'}ms`);
    console.log(`   All Agents Completed: ${caseRecord.metadata?.allAgentsCompleted || 'N/A'}`);
    console.log(`   Agents Executed: ${caseRecord.metadata?.agentsExecuted?.join(', ') || 'N/A'}`);
    console.log('\n');

    // ═══════════════════════════════════════════════════════════════
    // CLEANUP
    // ═══════════════════════════════════════════════════════════════
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║       CLEANUP                                             ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('\n');
    
    console.log('🧹 Cleaning up test case...');
    await Case.deleteOne({ caseId: result.caseId });
    console.log('✅ Test case deleted\n');

    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║       TEST COMPLETED SUCCESSFULLY ✅                      ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('\n');

    console.log('Test Summary:');
    console.log(`   ✅ Orchestration completed in ${result.executionTimeMs}ms`);
    console.log(`   ✅ ${result.agentsExecuted.length} agents executed successfully`);
    console.log(`   ✅ Case created and stored: ${result.caseId}`);
    console.log(`   ✅ Final state: ${result.state}`);
    console.log(`   ✅ All agent results stored in database`);
    console.log('\n');

  } catch (error) {
    console.error('\n╔═══════════════════════════════════════════════════════════╗');
    console.error('║       TEST FAILED ❌                                      ║');
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
  testOrchestrator()
    .then(() => {
      console.log('🎉 All operations completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

module.exports = testOrchestrator;
