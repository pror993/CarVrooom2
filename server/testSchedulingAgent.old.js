/**
 * Scheduling Agent Test Controller
 * 
 * This controller:
 * 1. Creates a test Case
 * 2. Runs DiagnosticAgent
 * 3. Runs SchedulingAgent with suggestion tool
 * 4. Verifies scheduling suggestions were saved in Case (NOT auto-booked)
 * 5. Shows that user approval is required before appointment is confirmed
 * 
 * Run: node testSchedulingAgent.js
 */

const mongoose = require('mongoose');
require('dotenv').config();
const { diagnosticAgent } = require('./agents/diagnosticAgent');
const { schedulingAgent, getAvailableServiceCenters } = require('./agents/schedulingAgent');
const Vehicle = require('./models/Vehicle');
const PredictionEvent = require('./models/PredictionEvent');
const Case = require('./models/Case');

async function testSchedulingAgentController() {
  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📅 SCHEDULING AGENT TEST CONTROLLER');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: SETUP TEST DATA
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 STEP 1: Setting Up Test Data');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    let vehicle = await Vehicle.findOne().sort({ createdAt: -1 });
    
    if (!vehicle) {
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
        etaDays: 10,
        signals: {
          engineVibration: { value: 8.5, unit: 'hz', threshold: 5.0 },
          oilPressure: { value: 28, unit: 'psi', threshold: 40 },
          coolantTemp: { value: 210, unit: 'F', threshold: 195 }
        }
      });
    }

    // Create a Case
    const testCase = await Case.create({
      caseId: `CASE-TEST-${Date.now()}`,
      vehicleId: vehicle.vehicleId,
      predictionId: prediction._id,
      severity: 'medium',
      state: 'RECEIVED'
    });

    console.log('✅ Test data created:');
    console.log(`   Vehicle: ${vehicle.vehicleInfo.make} ${vehicle.vehicleInfo.model} ${vehicle.vehicleInfo.year}`);
    console.log(`   Prediction: ${prediction.predictionType} (${(prediction.confidence * 100).toFixed(1)}%, ETA: ${prediction.etaDays} days)`);
    console.log(`   Case ID: ${testCase.caseId}\n`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: RUN DIAGNOSTIC AGENT
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 STEP 2: Running Diagnostic Agent');
    console.log('═══════════════════════════════════════════════════════════\n');

    const diagnosis = await diagnosticAgent(prediction, vehicle);
    
    console.log('✅ Diagnostic complete:');
    console.log(`   Risk: ${diagnosis.risk.toUpperCase()}`);
    console.log(`   Urgency: ${diagnosis.urgency.toUpperCase()}`);
    console.log(`   Summary: ${diagnosis.summary.substring(0, 80)}...\n`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: DISPLAY AVAILABLE SERVICE CENTERS
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🏢 STEP 3: Available Service Centers');
    console.log('═══════════════════════════════════════════════════════════\n');

    const serviceCenters = getAvailableServiceCenters();
    serviceCenters.forEach((sc, index) => {
      console.log(`   ${index + 1}. ${sc.name}`);
      console.log(`      Location: ${sc.location}`);
      console.log(`      Specialties: ${sc.specialties.join(', ')}`);
      console.log('');
    });

    // ═══════════════════════════════════════════════════════════════
    // STEP 4: RUN SCHEDULING AGENT
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📅 STEP 4: Running Scheduling Agent');
    console.log('═══════════════════════════════════════════════════════════\n');

    const startTime = Date.now();
    const schedule = await schedulingAgent(
      diagnosis,
      vehicle,
      prediction,
      testCase.caseId
    );
    const duration = Date.now() - startTime;

    // ═══════════════════════════════════════════════════════════════
    // STEP 5: DISPLAY SCHEDULING RESULT
    // ═══════════════════════════════════════════════════════════════
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 STEP 5: Scheduling Decision (Structured Output)');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Summary Box
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│             SCHEDULING SUGGESTIONS GENERATED             │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log(`│  Urgency Level:        ${schedule.schedulingUrgency.padEnd(29)} │`);
    console.log(`│  Primary Date:         ${schedule.primaryRecommendation.date.padEnd(29)} │`);
    console.log(`│  Days Until Appt:      ${String(schedule.daysUntilPrimaryAppointment).padEnd(29)} │`);
    console.log(`│  Primary Center:       ${schedule.primaryRecommendation.serviceCenter.substring(0, 29).padEnd(29)} │`);
    console.log(`│  Alternatives:         ${String(schedule.alternativeRecommendations.length).padEnd(29)} │`);
    console.log(`│  Tool Called:          ${(schedule.toolCalled ? 'Yes' : 'No').padEnd(29)} │`);
    console.log(`│  User Approval Req:    ${(schedule.userApprovalRequired ? 'Yes ⚠️' : 'No').padEnd(29)} │`);
    console.log(`│  Suggestions Saved:    ${(schedule.suggestionsSaved ? 'Yes' : 'No').padEnd(29)} │`);
    console.log(`│  Processing Time:      ${(duration + 'ms').padEnd(29)} │`);
    console.log('└─────────────────────────────────────────────────────────┘\n');

    // Urgency Analysis
    const urgencyEmoji = {
      low: '📅',
      medium: '⏰',
      high: '⚡',
      critical: '🚨'
    };
    console.log(`${urgencyEmoji[schedule.schedulingUrgency]} SCHEDULING URGENCY: ${schedule.schedulingUrgency.toUpperCase()}`);
    
    if (schedule.schedulingUrgency === 'critical') {
      console.log('   → Emergency appointment within 24-48 hours');
    } else if (schedule.schedulingUrgency === 'high') {
      console.log('   → Priority appointment within 3-7 days');
    } else if (schedule.schedulingUrgency === 'medium') {
      console.log('   → Standard appointment within 2-4 weeks');
    } else {
      console.log('   → Routine appointment within 4-8 weeks');
    }
    console.log('');

    // Appointment Details
    console.log('📅 PRIMARY RECOMMENDATION:\n');
    console.log(`   Date:            ${schedule.primaryRecommendation.date}`);
    console.log(`   Service Center:  ${schedule.primaryRecommendation.serviceCenter}`);
    console.log(`   Center ID:       ${schedule.primaryRecommendation.serviceCenterId}`);
    console.log(`   Location:        ${schedule.primaryRecommendation.location}`);
    console.log(`   Days from now:   ${schedule.daysUntilPrimaryAppointment} days`);
    console.log(`   ETA to failure:  ${prediction.etaDays} days`);
    console.log(`   Safety margin:   ${schedule.safetyMargin} days\n`);

    // Reasoning
    console.log('💡 PRIMARY REASONING:\n');
    const reasoningLines = schedule.primaryRecommendation.reasoning.match(/.{1,70}(\s|$)/g) || [schedule.primaryRecommendation.reasoning];
    reasoningLines.forEach(line => {
      console.log(`   ${line.trim()}`);
    });
    console.log('');

    // Alternative Options
    console.log('🔄 ALTERNATIVE OPTIONS:\n');
    schedule.alternativeRecommendations.forEach((alt, index) => {
      console.log(`   ${index + 1}. ${alt.date} at ${alt.serviceCenter}`);
      console.log(`      Location: ${alt.location}`);
      console.log(`      Reasoning: ${alt.reasoning}`);
      console.log('');
    });

    // Additional Notes
    console.log('📝 USER GUIDANCE:\n');
    console.log(`   ${schedule.additionalNotes}\n`);

    // Next Steps
    console.log('🔄 NEXT STEPS:\n');
    schedule.nextSteps.forEach((step, index) => {
      console.log(`   ${index + 1}. ${step}`);
    });
    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // STEP 6: VERIFY CASE STORAGE
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 STEP 6: Verifying Case Storage');
    console.log('═══════════════════════════════════════════════════════════\n');

    const updatedCase = await Case.findOne({ caseId: testCase.caseId });
    
    if (updatedCase.agentResults?.schedulingAgent) {
      console.log('✅ Scheduling suggestions stored in Case:\n');
      console.log('   Case ID:', updatedCase.caseId);
      console.log('   Status:', updatedCase.agentResults.schedulingAgent.status);
      console.log('   User Approval Required:', updatedCase.agentResults.schedulingAgent.userApprovalRequired);
      console.log('');
      console.log('   Primary Suggestion:');
      console.log('      Date:', updatedCase.agentResults.schedulingAgent.primarySuggestion.appointmentDate);
      console.log('      Service Center:', updatedCase.agentResults.schedulingAgent.primarySuggestion.serviceCenter);
      console.log('      Reason:', updatedCase.agentResults.schedulingAgent.primarySuggestion.reason.substring(0, 60) + '...');
      console.log('');
      console.log(`   Alternative Suggestions: ${updatedCase.agentResults.schedulingAgent.alternativeSuggestions.length}`);
      updatedCase.agentResults.schedulingAgent.alternativeSuggestions.forEach((alt, i) => {
        console.log(`      ${i + 1}. ${alt.appointmentDate} at ${alt.serviceCenter}`);
      });
      console.log('');
      console.log('   Metadata Flags:');
      console.log('      Suggestions Ready:', updatedCase.metadata?.schedulingSuggestionsReady || false);
      console.log('      Awaiting User Approval:', updatedCase.metadata?.awaitingUserApproval || false);
      console.log('');
    } else {
      console.log('❌ ERROR: Scheduling data NOT found in Case!\n');
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 7: RAW JSON OUTPUT
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📄 RAW JSON OUTPUT');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(JSON.stringify(schedule, null, 2));
    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // STEP 8: INTEGRATION EXAMPLE
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('💻 INTEGRATION EXAMPLE');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('// Complete workflow integration:');
    console.log('const orchestration = await masterAgent(prediction, vehicle);');
    console.log('');
    console.log('if (orchestration.agentsToInvoke.includes("DiagnosticAgent")) {');
    console.log('  const diagnosis = await diagnosticAgent(prediction, vehicle);');
    console.log('  ');
    console.log('  if (orchestration.agentsToInvoke.includes("SchedulerAgent")) {');
    console.log('    const schedule = await schedulingAgent(');
    console.log('      diagnosis,');
    console.log('      vehicle,');
    console.log('      prediction,');
    console.log('      caseId  // Tool will store suggestions in Case');
    console.log('    );');
    console.log('    ');
    console.log('    // Frontend displays suggestions to user');
    console.log('    // User selects preferred option');
    console.log('    // User approval endpoint called:');
    console.log('    await approveAppointment({');
    console.log('      caseId,');
    console.log('      selectedDate: schedule.primaryRecommendation.date,');
    console.log('      selectedCenter: schedule.primaryRecommendation.serviceCenter');
    console.log('    });');
    console.log('    ');
    console.log('    // THEN appointment is confirmed');
    console.log('    await sendAppointmentConfirmation({');
    console.log(`      customerContact: vehicle.owner.contact,`);
    console.log(`      appointmentDate: selectedDate,`);
    console.log(`      serviceCenter: selectedCenter`);
    console.log('    });');
    console.log('  }');
    console.log('}');
    console.log('');

    // Cleanup
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🧹 CLEANUP');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('Cleaning up test data...');
    await Case.deleteOne({ caseId: testCase.caseId });
    console.log('✅ Test case deleted\n');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ TEST COMPLETED SUCCESSFULLY');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('Test Summary:');
    console.log(`   ✅ Scheduling Agent determined urgency: ${schedule.schedulingUrgency}`);
    console.log(`   ✅ Tool called successfully: ${schedule.toolCalled}`);
    console.log(`   ✅ User approval required: ${schedule.userApprovalRequired}`);
    console.log(`   ✅ Suggestions saved in Case: ${schedule.suggestionsSaved}`);
    console.log(`   ✅ Primary date: ${schedule.primaryRecommendation.date}`);
    console.log(`   ✅ Primary center: ${schedule.primaryRecommendation.serviceCenter}`);
    console.log(`   ✅ Alternative options: ${schedule.alternativeRecommendations.length}`);
    console.log(`   ⚠️  Status: pending_user_approval (NOT auto-booked)`);
    console.log('');

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
  testSchedulingAgentController()
    .then(() => {
      console.log('🎉 All operations completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

module.exports = testSchedulingAgentController;
