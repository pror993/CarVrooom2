/**
 * Communication Agent Test Controller
 * 
 * This controller:
 * 1. Fetches a vehicle and prediction
 * 2. Runs DiagnosticAgent to get diagnostic results
 * 3. Runs MasterAgent to get severity
 * 4. Passes results to CommunicationAgent
 * 5. Logs structured communication output
 * 
 * Run: node testCommunicationAgent.js
 */

const mongoose = require('mongoose');
require('dotenv').config();
const { masterAgent } = require('./agents/masterAgent');
const { diagnosticAgent } = require('./agents/diagnosticAgent');
const { communicationAgent } = require('./agents/communicationAgent');
const Vehicle = require('./models/Vehicle');
const PredictionEvent = require('./models/PredictionEvent');

async function testCommunicationAgentController() {
  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('💬 COMMUNICATION AGENT TEST CONTROLLER');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: FETCH DATA
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 STEP 1: Fetching Vehicle and Prediction');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    let vehicle = await Vehicle.findOne().sort({ createdAt: -1 });
    
    if (!vehicle) {
      console.log('⚠️  No vehicles found. Creating test vehicle...\n');
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
    }

    let prediction = await PredictionEvent.findOne({ 
      vehicleId: vehicle.vehicleId 
    }).sort({ createdAt: -1 });
    
    if (!prediction) {
      prediction = await PredictionEvent.create({
        vehicleId: vehicle.vehicleId,
        predictionType: 'cascade_failure',
        confidence: 0.87,
        etaDays: 10,
        signals: {
          engineVibration: { value: 8.5, unit: 'hz', threshold: 5.0 },
          oilPressure: { value: 28, unit: 'psi', threshold: 40 },
          coolantTemp: { value: 210, unit: 'F', threshold: 195 }
        }
      });
    }

    console.log('✅ Data loaded');
    console.log(`   Vehicle: ${vehicle.vehicleInfo.make} ${vehicle.vehicleInfo.model} ${vehicle.vehicleInfo.year}`);
    console.log(`   Owner: ${vehicle.owner.name} (${vehicle.owner.preferredChannel})`);
    console.log(`   Prediction: ${prediction.predictionType} (${(prediction.confidence * 100).toFixed(1)}%)\n`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: RUN MASTER AGENT
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🤖 STEP 2: Running Master Agent');
    console.log('═══════════════════════════════════════════════════════════\n');

    const orchestration = await masterAgent(prediction, vehicle);
    console.log('✅ Master Agent complete');
    console.log(`   Severity: ${orchestration.severity.toUpperCase()}`);
    console.log(`   Customer Contact: ${orchestration.customerContact}`);
    console.log(`   Agents to Invoke: ${orchestration.agentsToInvoke.join(', ')}\n`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: RUN DIAGNOSTIC AGENT (if in agentsToInvoke)
    // ═══════════════════════════════════════════════════════════════
    let diagnosis = null;
    
    if (orchestration.agentsToInvoke.includes('DiagnosticAgent')) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🔍 STEP 3: Running Diagnostic Agent');
      console.log('═══════════════════════════════════════════════════════════\n');

      diagnosis = await diagnosticAgent(prediction, vehicle);
      console.log('✅ Diagnostic Agent complete');
      console.log(`   Risk: ${diagnosis.risk.toUpperCase()}`);
      console.log(`   Urgency: ${diagnosis.urgency.toUpperCase()}\n`);
    } else {
      console.log('⏭️  STEP 3: Skipping Diagnostic Agent (not in agentsToInvoke)\n');
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 4: RUN COMMUNICATION AGENT (if customer contact needed)
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('💬 STEP 4: Communication Agent Decision');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (orchestration.customerContact === 'none') {
      console.log('⏭️  Skipping Communication Agent');
      console.log('   Reason: Master Agent determined no customer contact needed');
      console.log(`   Customer Contact Strategy: ${orchestration.customerContact}\n`);
      
      console.log('═══════════════════════════════════════════════════════════');
      console.log('✅ TEST COMPLETED - NO COMMUNICATION NEEDED');
      console.log('═══════════════════════════════════════════════════════════\n');
      return;
    }

    console.log('✅ Running Communication Agent');
    console.log(`   Reason: Customer contact required (${orchestration.customerContact})\n`);

    // Need diagnostic result for communication
    if (!diagnosis) {
      console.log('⚠️  Warning: Running DiagnosticAgent first (needed for communication)\n');
      diagnosis = await diagnosticAgent(prediction, vehicle);
    }

    const ownerPreferences = {
      name: vehicle.owner.name,
      contact: vehicle.owner.contact,
      preferredChannel: vehicle.owner.preferredChannel
    };

    const startTime = Date.now();
    const communication = await communicationAgent(
      diagnosis,
      ownerPreferences,
      orchestration.severity,
      vehicle
    );
    const duration = Date.now() - startTime;

    // ═══════════════════════════════════════════════════════════════
    // STEP 5: LOG STRUCTURED OUTPUT
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 STEP 5: Communication Strategy (Structured Output)');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Summary Box
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│               COMMUNICATION STRATEGY                     │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log(`│  Primary Channel:      ${communication.channel.toUpperCase().padEnd(29)} │`);
    console.log(`│  Fallback Channel:     ${communication.fallbackChannel.toUpperCase().padEnd(29)} │`);
    console.log(`│  Tone:                 ${communication.tone.padEnd(29)} │`);
    console.log(`│  Processing Time:      ${(duration + 'ms').padEnd(29)} │`);
    console.log('└─────────────────────────────────────────────────────────┘\n');

    // Channel Strategy
    const channelEmoji = {
      voice: '☎️',
      app: '📱'
    };
    console.log(`${channelEmoji[communication.channel]} PRIMARY CHANNEL: ${communication.channel.toUpperCase()}`);
    
    if (communication.channel === 'voice') {
      console.log('   → Phone call recommended');
      console.log(`   → Contact: ${vehicle.owner.contact}`);
      console.log('   → Requires personal touch and immediate response');
    } else {
      console.log('   → In-app notification/push notification');
      console.log('   → Allows customer to review at convenience');
      console.log('   → Can include action buttons and rich media');
    }
    console.log('');

    console.log(`${channelEmoji[communication.fallbackChannel]} FALLBACK CHANNEL: ${communication.fallbackChannel.toUpperCase()}`);
    console.log('   → Used if primary channel fails');
    console.log('   → Ensures customer receives notification\n');

    // Tone Analysis
    const toneEmoji = {
      urgent: '🚨',
      concerned: '⚠️',
      informative: 'ℹ️',
      routine: '✅'
    };
    console.log(`${toneEmoji[communication.tone]} TONE: ${communication.tone.toUpperCase()}`);
    
    if (communication.tone === 'urgent') {
      console.log('   → Critical issue requiring immediate action');
      console.log('   → Message emphasizes urgency and safety');
    } else if (communication.tone === 'concerned') {
      console.log('   → Serious issue needing prompt attention');
      console.log('   → Message balances concern with actionability');
    } else if (communication.tone === 'informative') {
      console.log('   → Important update requiring planning');
      console.log('   → Message is educational and proactive');
    } else {
      console.log('   → Standard maintenance notification');
      console.log('   → Message is friendly and low-pressure');
    }
    console.log('');

    // Customer Message
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📧 CUSTOMER MESSAGE');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Format message with word wrapping
    const words = communication.messageText.split(' ');
    let line = '';
    const maxLineLength = 65;
    
    words.forEach((word, index) => {
      if ((line + word).length > maxLineLength) {
        console.log(`   ${line.trim()}`);
        line = word + ' ';
      } else {
        line += word + ' ';
      }
      
      if (index === words.length - 1) {
        console.log(`   ${line.trim()}`);
      }
    });
    console.log('');

    // Context Summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 CONTEXT SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('Decision Factors:\n');
    console.log(`   Severity:           ${orchestration.severity}`);
    console.log(`   Risk Level:         ${diagnosis.risk}`);
    console.log(`   Urgency:            ${diagnosis.urgency}`);
    console.log(`   Owner Preference:   ${vehicle.owner.preferredChannel}`);
    console.log(`   Selected Channel:   ${communication.channel}`);
    console.log('');

    console.log('Communication Logic:\n');
    if (orchestration.severity === 'critical') {
      console.log('   → Critical severity → Voice channel forced');
    } else if (orchestration.severity === 'high' && diagnosis.urgency === 'critical') {
      console.log('   → High severity + critical urgency → Voice recommended');
    } else {
      console.log(`   → Respecting owner preference: ${vehicle.owner.preferredChannel}`);
    }
    console.log('');

    // Raw JSON Output
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📄 RAW JSON OUTPUT');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(JSON.stringify(communication, null, 2));
    console.log('');

    // Implementation Example
    console.log('═══════════════════════════════════════════════════════════');
    console.log('💻 IMPLEMENTATION EXAMPLE');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('// Send notification via primary channel');
    console.log(`if (communication.channel === "voice") {`);
    console.log(`  await makePhoneCall({`);
    console.log(`    to: "${vehicle.owner.contact}",`);
    console.log(`    message: communication.messageText,`);
    console.log(`    priority: "${communication.tone}"`);
    console.log(`  });`);
    console.log(`} else {`);
    console.log(`  await sendPushNotification({`);
    console.log(`    userId: vehicle.owner.userId,`);
    console.log(`    title: "Vehicle Maintenance Alert",`);
    console.log(`    body: communication.messageText,`);
    console.log(`    priority: "${communication.tone}"`);
    console.log(`  });`);
    console.log(`}`);
    console.log('');
    console.log('// Setup fallback if primary fails');
    console.log(`if (primaryFailed) {`);
    console.log(`  await sendVia(communication.fallbackChannel);`);
    console.log(`}`);
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
  testCommunicationAgentController()
    .then(() => {
      console.log('🎉 All operations completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

module.exports = testCommunicationAgentController;
