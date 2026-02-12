/**
 * Master Agent Test Controller
 * 
 * This controller:
 * 1. Fetches a real vehicle from the database
 * 2. Fetches a real prediction from the database
 * 3. Passes both to the MasterAgent
 * 4. Logs structured output
 * 
 * Run: node testMasterAgent.js
 */

const mongoose = require('mongoose');
require('dotenv').config();
const { masterAgent } = require('./agents/masterAgent');
const Vehicle = require('./models/Vehicle');
const PredictionEvent = require('./models/PredictionEvent');

async function testMasterAgentController() {
  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🤖 MASTER AGENT TEST CONTROLLER');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: FETCH VEHICLE
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 STEP 1: Fetching Vehicle from Database');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    let vehicle = await Vehicle.findOne().sort({ createdAt: -1 });
    
    if (!vehicle) {
      console.log('⚠️  No vehicles found in database. Creating test vehicle...\n');
      vehicle = await Vehicle.create({
        vehicleId: `VEHICLE-${Date.now()}`,
        owner: {
          name: 'John Doe',
          contact: '+1234567890',
          preferredChannel: 'app'
        },
        vehicleInfo: {
          make: 'Toyota',
          model: 'Camry',
          year: 2022,
          powertrain: 'Gasoline'
        },
        usageProfile: {
          avgDailyKm: 75,
          loadPattern: 'normal'
        },
        serviceHistory: [
          {
            date: new Date('2024-06-15'),
            type: 'routine_maintenance',
            notes: 'Oil change and filter replacement'
          }
        ]
      });
      console.log('✅ Test vehicle created\n');
    } else {
      console.log('✅ Found existing vehicle\n');
    }

    // Display vehicle details
    console.log('📊 VEHICLE DETAILS:\n');
    console.log(`   Vehicle ID:        ${vehicle.vehicleId}`);
    console.log(`   Make/Model/Year:   ${vehicle.vehicleInfo.make} ${vehicle.vehicleInfo.model} ${vehicle.vehicleInfo.year}`);
    console.log(`   Powertrain:        ${vehicle.vehicleInfo.powertrain}`);
    console.log(`   Owner:             ${vehicle.owner.name}`);
    console.log(`   Contact:           ${vehicle.owner.contact}`);
    console.log(`   Preferred Channel: ${vehicle.owner.preferredChannel}`);
    console.log(`   Avg Daily km:      ${vehicle.usageProfile.avgDailyKm} km`);
    console.log(`   Load Pattern:      ${vehicle.usageProfile.loadPattern}`);
    console.log(`   Service Records:   ${vehicle.serviceHistory.length} records\n`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: FETCH PREDICTION
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔮 STEP 2: Fetching Prediction from Database');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    let prediction = await PredictionEvent.findOne({ 
      vehicleId: vehicle.vehicleId 
    }).sort({ createdAt: -1 });
    
    if (!prediction) {
      console.log('⚠️  No predictions found for this vehicle. Creating test prediction...\n');
      prediction = await PredictionEvent.create({
        vehicleId: vehicle.vehicleId,
        predictionType: 'cascade_failure',
        confidence: 0.87,
        etaDays: 10,
        signals: {
          engineVibration: { value: 8.5, unit: 'hz', threshold: 5.0 },
          oilPressure: { value: 28, unit: 'psi', threshold: 40 },
          coolantTemp: { value: 210, unit: 'F', threshold: 195 }
        },
        modelVersion: 'v1.0.0',
        metadata: {
          dataQuality: 0.95,
          samplesUsed: 1500
        }
      });
      console.log('✅ Test prediction created\n');
    } else {
      console.log('✅ Found existing prediction\n');
    }

    // Display prediction details
    console.log('📊 PREDICTION DETAILS:\n');
    console.log(`   Prediction ID:     ${prediction._id}`);
    console.log(`   Vehicle ID:        ${prediction.vehicleId}`);
    console.log(`   Type:              ${prediction.predictionType}`);
    console.log(`   Confidence:        ${(prediction.confidence * 100).toFixed(1)}%`);
    console.log(`   ETA to Failure:    ${prediction.etaDays} days`);
    console.log(`   Model Version:     ${prediction.modelVersion || 'N/A'}`);
    console.log(`   Created:           ${prediction.createdAt?.toLocaleString() || 'N/A'}`);
    console.log(`\n   Sensor Signals (${Object.keys(prediction.signals).length} signals):`);
    
    Object.entries(prediction.signals).forEach(([name, data]) => {
      const status = data.value > data.threshold ? '⚠️ ABOVE' : '✅ BELOW';
      console.log(`      • ${name}:`);
      console.log(`        Value:     ${data.value} ${data.unit}`);
      console.log(`        Threshold: ${data.threshold} ${data.unit}`);
      console.log(`        Status:    ${status} threshold`);
    });
    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: RUN MASTER AGENT
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🤖 STEP 3: Running Master Agent');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('⏳ Processing prediction and vehicle data...');
    const startTime = Date.now();
    
    const orchestration = await masterAgent(prediction, vehicle);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Master Agent completed in ${duration}ms\n`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 4: LOG STRUCTURED OUTPUT
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 STEP 4: Orchestration Decision (Structured Output)');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Summary Box
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│                 ORCHESTRATION SUMMARY                    │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log(`│  Severity Level:       ${orchestration.severity.toUpperCase().padEnd(29)} │`);
    console.log(`│  Customer Contact:     ${orchestration.customerContact.padEnd(29)} │`);
    console.log(`│  Workflow Type:        ${orchestration.workflowType.padEnd(29)} │`);
    console.log(`│  Agents to Invoke:     ${String(orchestration.agentsToInvoke.length).padEnd(29)} │`);
    console.log(`│  Processing Time:      ${(duration + 'ms').padEnd(29)} │`);
    console.log('└─────────────────────────────────────────────────────────┘\n');

    // Severity Indicator
    const severityEmoji = {
      low: '✅',
      medium: 'ℹ️',
      high: '⚠️',
      critical: '🚨'
    };
    console.log(`${severityEmoji[orchestration.severity]} SEVERITY: ${orchestration.severity.toUpperCase()}`);
    
    if (orchestration.severity === 'critical') {
      console.log('   → Immediate action required');
      console.log('   → Emergency protocols activated');
    } else if (orchestration.severity === 'high') {
      console.log('   → Urgent attention needed');
      console.log('   → Schedule service within 48 hours');
    } else if (orchestration.severity === 'medium') {
      console.log('   → Proactive maintenance recommended');
      console.log('   → Schedule service within 1-2 weeks');
    } else {
      console.log('   → Monitor and plan routine maintenance');
      console.log('   → No immediate action required');
    }
    console.log('');

    // Customer Contact Strategy
    const contactEmoji = {
      none: '📱',
      delayed: '📧',
      immediate: '☎️'
    };
    console.log(`${contactEmoji[orchestration.customerContact]} CUSTOMER CONTACT: ${orchestration.customerContact.toUpperCase()}`);
    
    if (orchestration.customerContact === 'immediate') {
      console.log(`   → Contact customer via ${vehicle.owner.preferredChannel} immediately`);
      console.log(`   → Contact: ${vehicle.owner.contact}`);
    } else if (orchestration.customerContact === 'delayed') {
      console.log(`   → Contact customer within 24-48 hours`);
      console.log(`   → Preferred channel: ${vehicle.owner.preferredChannel}`);
    } else {
      console.log('   → No customer contact needed at this time');
      console.log('   → Continue monitoring');
    }
    console.log('');

    // Workflow Type
    console.log(`🔄 WORKFLOW TYPE: ${orchestration.workflowType}`);
    console.log(`   → ${orchestration.workflowType.replace(/_/g, ' ').toUpperCase()}\n`);

    // Agents to Invoke
    console.log('🤖 AGENTS TO INVOKE:\n');
    if (orchestration.agentsToInvoke.length === 0) {
      console.log('   No agents to invoke (monitoring only)\n');
    } else {
      orchestration.agentsToInvoke.forEach((agent, index) => {
        const agentEmoji = {
          DiagnosticAgent: '🔍',
          PredictionAgent: '🔮',
          RecommendationAgent: '💡',
          SchedulerAgent: '📅'
        };
        console.log(`   ${index + 1}. ${agentEmoji[agent] || '🤖'} ${agent}`);
      });
      console.log('');
    }

    // Raw JSON Output
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📄 RAW JSON OUTPUT');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(JSON.stringify(orchestration, null, 2));
    console.log('');

    // Next Steps
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📌 RECOMMENDED NEXT STEPS');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('1. Create Case Record:');
    console.log(`   await Case.create({`);
    console.log(`     caseId: 'CASE-${Date.now()}',`);
    console.log(`     vehicleId: '${vehicle.vehicleId}',`);
    console.log(`     predictionId: '${prediction._id}',`);
    console.log(`     severity: '${orchestration.severity}',`);
    console.log(`     workflowType: '${orchestration.workflowType}'`);
    console.log(`   });\n`);

    console.log('2. Invoke Worker Agents:');
    orchestration.agentsToInvoke.forEach((agent, index) => {
      console.log(`   ${index + 1}. Execute ${agent}`);
    });
    console.log('');

    console.log('3. Customer Contact:');
    if (orchestration.customerContact === 'immediate') {
      console.log(`   → Send immediate notification to ${vehicle.owner.name}`);
    } else if (orchestration.customerContact === 'delayed') {
      console.log(`   → Schedule notification for later today`);
    } else {
      console.log('   → No action needed');
    }
    console.log('');

    console.log('4. Update Case State:');
    console.log(`   await case.advanceState('PLANNED', { orchestration });\n`);

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ TEST COMPLETED SUCCESSFULLY');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n═══════════════════════════════════════════════════════════');
    console.error('❌ TEST FAILED');
    console.error('═══════════════════════════════════════════════════════════\n');
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

// Run the test controller
if (require.main === module) {
  testMasterAgentController()
    .then(() => {
      console.log('🎉 All operations completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

module.exports = testMasterAgentController;
