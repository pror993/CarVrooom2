/**
 * Diagnostic Agent Test Controller
 * 
 * This controller:
 * 1. Fetches a real vehicle from the database
 * 2. Fetches a real prediction from the database
 * 3. Passes both to the DiagnosticAgent
 * 4. Logs structured output
 * 
 * Run: node testDiagnosticAgent.js
 */

const mongoose = require('mongoose');
require('dotenv').config();
const { diagnosticAgent } = require('./agents/diagnosticAgent');
const Vehicle = require('./models/Vehicle');
const PredictionEvent = require('./models/PredictionEvent');

async function testDiagnosticAgentController() {
  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 DIAGNOSTIC AGENT TEST CONTROLLER');
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
    console.log(`   Type:              ${prediction.predictionType}`);
    console.log(`   Confidence:        ${(prediction.confidence * 100).toFixed(1)}%`);
    console.log(`   ETA to Failure:    ${prediction.etaDays} days\n`);
    
    console.log('   Sensor Signals:');
    Object.entries(prediction.signals).forEach(([name, data]) => {
      const status = data.value > data.threshold ? '⚠️ ABOVE' : '✅ BELOW';
      console.log(`      • ${name}: ${data.value} ${data.unit} (threshold: ${data.threshold}) ${status}`);
    });
    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: RUN DIAGNOSTIC AGENT
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 STEP 3: Running Diagnostic Agent');
    console.log('═══════════════════════════════════════════════════════════\n');

    const startTime = Date.now();
    const diagnosis = await diagnosticAgent(prediction, vehicle);
    const duration = Date.now() - startTime;

    // ═══════════════════════════════════════════════════════════════
    // STEP 4: LOG STRUCTURED OUTPUT
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 STEP 4: Diagnostic Analysis (Structured Output)');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Summary Box
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│                  DIAGNOSTIC SUMMARY                      │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log(`│  Risk Level:           ${diagnosis.risk.toUpperCase().padEnd(29)} │`);
    console.log(`│  Urgency Level:        ${diagnosis.urgency.toUpperCase().padEnd(29)} │`);
    console.log(`│  Processing Time:      ${(duration + 'ms').padEnd(29)} │`);
    console.log('└─────────────────────────────────────────────────────────┘\n');

    // Risk Assessment
    const riskEmoji = {
      low: '✅',
      medium: 'ℹ️',
      high: '⚠️',
      critical: '🚨'
    };
    console.log(`${riskEmoji[diagnosis.risk]} RISK LEVEL: ${diagnosis.risk.toUpperCase()}`);
    
    if (diagnosis.risk === 'critical') {
      console.log('   → Imminent safety risk or catastrophic failure');
    } else if (diagnosis.risk === 'high') {
      console.log('   → Could cause breakdown or significant damage');
    } else if (diagnosis.risk === 'medium') {
      console.log('   → Could lead to reduced performance or efficiency');
    } else {
      console.log('   → Minor issue, no immediate risk');
    }
    console.log('');

    // Urgency Assessment
    const urgencyEmoji = {
      low: '📅',
      medium: '⏰',
      high: '⚡',
      critical: '🚨'
    };
    console.log(`${urgencyEmoji[diagnosis.urgency]} URGENCY: ${diagnosis.urgency.toUpperCase()}`);
    
    if (diagnosis.urgency === 'critical') {
      console.log('   → Requires immediate action (within 24-48 hours)');
    } else if (diagnosis.urgency === 'high') {
      console.log('   → Needs attention within 1 week');
    } else if (diagnosis.urgency === 'medium') {
      console.log('   → Should be addressed within 2-4 weeks');
    } else {
      console.log('   → Can wait for next scheduled service');
    }
    console.log('');

    // Technical Summary
    console.log('🔧 TECHNICAL SUMMARY:\n');
    console.log(`   ${diagnosis.summary}\n`);

    // Customer Explanation
    console.log('💬 CUSTOMER EXPLANATION:\n');
    const explanationLines = diagnosis.explanationForCustomer.match(/.{1,55}(\s|$)/g) || [diagnosis.explanationForCustomer];
    explanationLines.forEach(line => {
      console.log(`   ${line.trim()}`);
    });
    console.log('');

    // Raw JSON Output
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📄 RAW JSON OUTPUT');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(JSON.stringify(diagnosis, null, 2));
    console.log('');

    // Recommended Actions
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📌 RECOMMENDED ACTIONS');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (diagnosis.urgency === 'critical' || diagnosis.urgency === 'high') {
      console.log('1. 📞 Contact customer immediately');
      console.log(`   → Method: ${vehicle.owner.preferredChannel}`);
      console.log(`   → Contact: ${vehicle.owner.contact}`);
      console.log('');
      console.log('2. 🏥 Schedule emergency service appointment');
      console.log('   → Priority: URGENT');
      console.log('   → Timeline: Within 24-48 hours');
      console.log('');
      console.log('3. 🔍 Invoke additional agents:');
      console.log('   → RecommendationAgent (suggest repair actions)');
      console.log('   → SchedulerAgent (find nearest service center)');
    } else if (diagnosis.urgency === 'medium') {
      console.log('1. 📧 Schedule customer notification');
      console.log('   → Timeline: Within 24 hours');
      console.log(`   → Method: ${vehicle.owner.preferredChannel}`);
      console.log('');
      console.log('2. 📅 Plan service appointment');
      console.log('   → Timeline: Within 2-4 weeks');
      console.log('');
      console.log('3. 🔍 Invoke RecommendationAgent');
      console.log('   → Get maintenance recommendations');
      console.log('   → Estimate costs and duration');
    } else {
      console.log('1. 📋 Add to maintenance backlog');
      console.log('   → Can wait for next scheduled service');
      console.log('');
      console.log('2. 🔍 Continue monitoring');
      console.log('   → Watch sensor trends');
      console.log('   → Re-evaluate if condition changes');
    }
    console.log('');

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
  testDiagnosticAgentController()
    .then(() => {
      console.log('🎉 All operations completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

module.exports = testDiagnosticAgentController;
