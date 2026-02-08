/**
 * Communication Agent - Critical Scenario Test
 * 
 * Tests CommunicationAgent with:
 * - preferredChannel = voice
 * - severity = critical
 * 
 * Run: node testCommunicationAgentCritical.js
 */

const mongoose = require('mongoose');
require('dotenv').config();
const { masterAgent } = require('./agents/masterAgent');
const { diagnosticAgent } = require('./agents/diagnosticAgent');
const { communicationAgent } = require('./agents/communicationAgent');
const Vehicle = require('./models/Vehicle');
const PredictionEvent = require('./models/PredictionEvent');

async function testCriticalScenario() {
  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('💬 COMMUNICATION AGENT - CRITICAL SCENARIO TEST');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // ═══════════════════════════════════════════════════════════════
    // CREATE TEST SCENARIO: CRITICAL + VOICE PREFERENCE
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🎬 TEST SCENARIO SETUP');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Create vehicle with VOICE preference
    const testVehicle = await Vehicle.create({
      vehicleId: `TEST-CRITICAL-${Date.now()}`,
      owner: {
        name: 'Sarah Johnson',
        contact: '+1-555-CRITICAL',
        preferredChannel: 'voice'  // 👈 VOICE preference
      },
      vehicleInfo: {
        make: 'Ford',
        model: 'F-150',
        year: 2023,
        powertrain: 'V8 Gasoline'
      },
      usageProfile: {
        avgDailyKm: 120,  // High usage
        loadPattern: 'heavy'  // Heavy load
      },
      serviceHistory: [
        {
          date: new Date('2023-03-15'),
          type: 'routine_maintenance',
          notes: 'Last service 11 months ago'
        }
      ]
    });

    // Create CRITICAL prediction
    const criticalPrediction = await PredictionEvent.create({
      vehicleId: testVehicle.vehicleId,
      predictionType: 'cascade_failure',  // Multiple systems failing
      confidence: 0.96,  // Very high confidence
      etaDays: 2,  // 👈 CRITICAL: Only 2 days!
      signals: {
        engineVibration: { value: 15.0, unit: 'hz', threshold: 5.0 },  // 3x threshold!
        oilPressure: { value: 10, unit: 'psi', threshold: 40 },  // Critically low
        coolantTemp: { value: 250, unit: 'F', threshold: 195 },  // Dangerously high
        exhaustTemp: { value: 1400, unit: 'F', threshold: 800 }  // Extreme
      }
    });

    console.log('✅ Test Scenario Created:\n');
    console.log('   Vehicle:');
    console.log(`      • Owner: ${testVehicle.owner.name}`);
    console.log(`      • Preferred Channel: ${testVehicle.owner.preferredChannel} ☎️`);
    console.log(`      • Vehicle: ${testVehicle.vehicleInfo.make} ${testVehicle.vehicleInfo.model} ${testVehicle.vehicleInfo.year}`);
    console.log(`      • Usage: ${testVehicle.usageProfile.avgDailyKm} km/day (${testVehicle.usageProfile.loadPattern} load)`);
    console.log('');
    console.log('   Prediction:');
    console.log(`      • Type: ${criticalPrediction.predictionType}`);
    console.log(`      • Confidence: ${(criticalPrediction.confidence * 100).toFixed(1)}%`);
    console.log(`      • ETA: ${criticalPrediction.etaDays} days ⚠️`);
    console.log(`      • Signals: ${Object.keys(criticalPrediction.signals).length} critical signals`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // RUN MASTER AGENT
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🤖 STEP 1: Master Agent Analysis');
    console.log('═══════════════════════════════════════════════════════════\n');

    const orchestration = await masterAgent(criticalPrediction, testVehicle);
    
    console.log('✅ Master Agent Decision:\n');
    console.log(`   Severity:           ${orchestration.severity.toUpperCase()} 🚨`);
    console.log(`   Customer Contact:   ${orchestration.customerContact}`);
    console.log(`   Workflow Type:      ${orchestration.workflowType}`);
    console.log(`   Agents to Invoke:   ${orchestration.agentsToInvoke.join(', ')}`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // RUN DIAGNOSTIC AGENT
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 STEP 2: Diagnostic Agent Analysis');
    console.log('═══════════════════════════════════════════════════════════\n');

    const diagnosis = await diagnosticAgent(criticalPrediction, testVehicle);
    
    console.log('✅ Diagnostic Assessment:\n');
    console.log(`   Risk:     ${diagnosis.risk.toUpperCase()}`);
    console.log(`   Urgency:  ${diagnosis.urgency.toUpperCase()}`);
    console.log(`   Summary:  ${diagnosis.summary.substring(0, 80)}...`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // RUN COMMUNICATION AGENT
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('💬 STEP 3: Communication Agent Strategy');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (orchestration.customerContact === 'none') {
      console.log('❌ TEST FAILED: Master Agent said no customer contact needed!');
      console.log('   Expected "immediate" for critical scenario\n');
      return;
    }

    const ownerPreferences = {
      name: testVehicle.owner.name,
      contact: testVehicle.owner.contact,
      preferredChannel: testVehicle.owner.preferredChannel
    };

    const communication = await communicationAgent(
      diagnosis,
      ownerPreferences,
      orchestration.severity,
      testVehicle
    );

    // ═══════════════════════════════════════════════════════════════
    // VERIFY OUTPUT LOGIC
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ COMMUNICATION STRATEGY GENERATED');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('📊 DECISION ANALYSIS:\n');
    console.log('   Input Factors:');
    console.log(`      • Severity:          ${orchestration.severity}`);
    console.log(`      • Risk:              ${diagnosis.risk}`);
    console.log(`      • Urgency:           ${diagnosis.urgency}`);
    console.log(`      • Owner Preference:  ${testVehicle.owner.preferredChannel}`);
    console.log('');
    console.log('   Output Decision:');
    console.log(`      • Channel:           ${communication.channel.toUpperCase()} ${communication.channel === 'voice' ? '☎️' : '📱'}`);
    console.log(`      • Fallback:          ${communication.fallbackChannel}`);
    console.log(`      • Tone:              ${communication.tone}`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // LOGIC VERIFICATION
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 LOGIC VERIFICATION');
    console.log('═══════════════════════════════════════════════════════════\n');

    let passed = true;
    const issues = [];

    // Test 1: Critical severity should use voice regardless of preference
    console.log('Test 1: Critical Severity → Voice Channel');
    if (orchestration.severity === 'critical') {
      if (communication.channel === 'voice') {
        console.log('   ✅ PASS: Voice channel selected for critical severity');
      } else {
        console.log(`   ❌ FAIL: Expected "voice" but got "${communication.channel}"`);
        issues.push('Critical severity should always use voice channel');
        passed = false;
      }
    } else {
      console.log(`   ⚠️  SKIP: Severity is "${orchestration.severity}" not "critical"`);
    }
    console.log('');

    // Test 2: Tone should be urgent for critical
    console.log('Test 2: Critical Severity → Urgent Tone');
    if (orchestration.severity === 'critical') {
      if (communication.tone === 'urgent') {
        console.log('   ✅ PASS: Urgent tone selected for critical severity');
      } else {
        console.log(`   ❌ FAIL: Expected "urgent" but got "${communication.tone}"`);
        issues.push('Critical severity should use urgent tone');
        passed = false;
      }
    } else {
      console.log(`   ⚠️  SKIP: Severity is "${orchestration.severity}" not "critical"`);
    }
    console.log('');

    // Test 3: Fallback channel should be opposite of primary
    console.log('Test 3: Fallback Channel Validation');
    if (communication.channel !== communication.fallbackChannel) {
      console.log(`   ✅ PASS: Fallback (${communication.fallbackChannel}) differs from primary (${communication.channel})`);
    } else {
      console.log(`   ❌ FAIL: Fallback and primary are both "${communication.channel}"`);
      issues.push('Fallback channel must differ from primary');
      passed = false;
    }
    console.log('');

    // Test 4: Voice preference should be respected (unless overridden by severity)
    console.log('Test 4: Owner Preference Handling');
    if (orchestration.severity === 'critical') {
      console.log('   ℹ️  Owner preference overridden by critical severity (expected)');
    } else {
      if (communication.channel === testVehicle.owner.preferredChannel) {
        console.log(`   ✅ PASS: Owner preference "${testVehicle.owner.preferredChannel}" respected`);
      } else {
        console.log(`   ⚠️  INFO: Preference "${testVehicle.owner.preferredChannel}" not used (got "${communication.channel}")`);
      }
    }
    console.log('');

    // Test 5: Message should mention urgency for critical
    console.log('Test 5: Message Content Analysis');
    const messageText = communication.messageText.toLowerCase();
    const urgencyKeywords = ['urgent', 'immediate', 'critical', 'asap', 'right away'];
    const hasUrgency = urgencyKeywords.some(keyword => messageText.includes(keyword));
    
    if (orchestration.severity === 'critical' || diagnosis.urgency === 'critical') {
      if (hasUrgency) {
        console.log('   ✅ PASS: Message contains urgency indicators');
      } else {
        console.log('   ⚠️  WARNING: Message lacks urgency keywords');
        console.log(`      Keywords checked: ${urgencyKeywords.join(', ')}`);
      }
    } else {
      console.log('   ℹ️  Not a critical scenario, urgency keywords optional');
    }
    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // DISPLAY CUSTOMER MESSAGE
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📧 CUSTOMER MESSAGE');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log(`Channel: ${communication.channel.toUpperCase()} (${communication.tone} tone)\n`);
    
    const words = communication.messageText.split(' ');
    let line = '';
    words.forEach((word, index) => {
      if ((line + word).length > 65) {
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

    // ═══════════════════════════════════════════════════════════════
    // RAW JSON
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📄 RAW JSON OUTPUT');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(JSON.stringify(communication, null, 2));
    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // FINAL RESULT
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    if (passed) {
      console.log('✅ ALL TESTS PASSED');
    } else {
      console.log('❌ SOME TESTS FAILED');
    }
    console.log('═══════════════════════════════════════════════════════════\n');

    if (issues.length > 0) {
      console.log('Issues Found:');
      issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
      console.log('');
    }

    // Cleanup
    console.log('🧹 Cleaning up test data...');
    await Vehicle.deleteOne({ vehicleId: testVehicle.vehicleId });
    await PredictionEvent.deleteOne({ vehicleId: testVehicle.vehicleId });
    console.log('✅ Test data cleaned up\n');

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

// Run the test
if (require.main === module) {
  testCriticalScenario()
    .then(() => {
      console.log('🎉 Critical scenario test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

module.exports = testCriticalScenario;
