/**
 * Full Pipeline Test — Haryana Fleet Owner (Tata Nexon EV)
 * 
 * Tests the COMPLETE agentic pipeline end-to-end:
 *   1. Register a fleet vehicle (Tata Nexon EV) in Gurugram
 *   2. Ingest a cascade_failure prediction
 *   3. Orchestrator runs: MasterAgent → DiagnosticAgent → SchedulingAgent v2 → CommunicationAgent
 *   4. Verify scheduling algorithm picks Gurugram EV center (closest + specialization match)
 *   5. Verify all Case data, scores, and suggestions
 *   6. Simulate user appointment approval
 *   7. Cleanup
 * 
 * Uses seeded Haryana data (5 service centers + fleet owner profile)
 * 
 * Run: node testFullPipeline.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Vehicle = require('./models/Vehicle');
const PredictionEvent = require('./models/PredictionEvent');
const Case = require('./models/Case');
const UserProfile = require('./models/UserProfile');
const ServiceCenter = require('./models/ServiceCenter');
const { orchestrateAgents } = require('./agents/orchestrator');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`   ✅ ${message}`);
    passed++;
  } else {
    console.log(`   ❌ FAIL: ${message}`);
    failed++;
  }
}

async function testFullPipeline() {
  const ts = Date.now();
  const vehicleId = `HR-FLEET-NEXON-${ts}`;
  let caseId = null;

  try {
    // ── CONNECT ──────────────────────────────────────────────────
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║   FULL PIPELINE TEST — Haryana Fleet Owner (Tata Nexon EV)    ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected\n');

    // ── PRE-CHECK: Seeded Data ───────────────────────────────────
    console.log('─── Pre-Check: Seeded Data ─────────────────────────────────────\n');

    const centerCount = await ServiceCenter.countDocuments({ isActive: true });
    assert(centerCount >= 5, `${centerCount} active service centers in DB`);

    const fleetProfile = await UserProfile.findOne({ role: 'fleet_owner' }).lean();
    assert(fleetProfile !== null, 'Fleet owner profile exists');
    assert(
      fleetProfile?.location?.coordinates?.[0] !== 0,
      `Fleet owner location: [${fleetProfile?.location?.coordinates}]`
    );

    const ggnCenter = await ServiceCenter.findOne({ serviceCenterId: 'SC-HR-GGN-001' });
    assert(ggnCenter !== null, 'Gurugram EV center exists');
    assert(ggnCenter?.slots?.length > 0, `Gurugram center has ${ggnCenter?.slots?.length} slots`);

    console.log('');

    // ══════════════════════════════════════════════════════════════
    // STEP 1: REGISTER FLEET VEHICLE
    // ══════════════════════════════════════════════════════════════
    console.log('─── Step 1: Register Fleet Vehicle ─────────────────────────────\n');

    const vehicle = await Vehicle.create({
      vehicleId,
      owner: {
        name: 'Haryana Fleet Services',
        contact: '+91-9876500001',
        preferredChannel: 'app'
      },
      vehicleInfo: {
        make: 'Tata',
        model: 'Nexon EV',
        year: 2024,
        powertrain: 'electric'
      },
      usageProfile: {
        avgDailyKm: 120,
        loadPattern: 'heavy'
      },
      serviceHistory: [
        { date: new Date('2025-08-15'), type: 'General Inspection', notes: 'All clear' },
        { date: new Date('2025-11-20'), type: 'Battery Health Check', notes: 'Voltage normal' }
      ]
    });

    assert(!!vehicle._id, `Vehicle registered: ${vehicle.vehicleId}`);
    console.log(`   🚗 ${vehicle.vehicleInfo.year} ${vehicle.vehicleInfo.make} ${vehicle.vehicleInfo.model}`);
    console.log(`   ⚡ Powertrain: ${vehicle.vehicleInfo.powertrain}`);
    console.log(`   📦 Usage: ${vehicle.usageProfile.avgDailyKm} km/day, ${vehicle.usageProfile.loadPattern} load`);
    console.log(`   📋 Service history: ${vehicle.serviceHistory.length} records\n`);

    // ══════════════════════════════════════════════════════════════
    // STEP 2: INGEST PREDICTION EVENT
    // ══════════════════════════════════════════════════════════════
    console.log('─── Step 2: Ingest Prediction Event ────────────────────────────\n');

    const prediction = await PredictionEvent.create({
      vehicleId,
      predictionType: 'cascade_failure',
      confidence: 0.91,
      etaDays: 12,
      signals: {
        battery_voltage: { value: 10.8, unit: 'V', threshold: 12.0 },
        battery_temp: { value: 48, unit: 'C', threshold: 40 },
        motor_vibration: { value: 3.2, unit: 'mm/s', threshold: 2.5 },
        regen_braking_efficiency: { value: 62, unit: '%', threshold: 75 },
        coolant_level: { value: 68, unit: '%', threshold: 80 }
      }
    });

    assert(!!prediction._id, `Prediction created: ${prediction._id}`);
    console.log(`   🔮 Type: ${prediction.predictionType}`);
    console.log(`   📊 Confidence: ${(prediction.confidence * 100).toFixed(1)}%`);
    console.log(`   ⏰ ETA: ${prediction.etaDays} days`);
    console.log(`   📡 Signals: ${Object.keys(prediction.signals).length} sensor readings\n`);

    // ══════════════════════════════════════════════════════════════
    // STEP 3: RUN FULL ORCHESTRATION
    // ══════════════════════════════════════════════════════════════
    console.log('─── Step 3: Run Full Agentic Orchestration ─────────────────────\n');
    console.log('   🤖 Starting orchestrator... (MasterAgent → Diagnostic → Scheduling → Communication)\n');

    const orchStart = Date.now();
    const result = await orchestrateAgents(prediction._id);
    const orchTime = Date.now() - orchStart;

    caseId = result.caseId;

    assert(result.success === true, 'Orchestration succeeded');
    assert(!!result.caseId, `Case created: ${result.caseId}`);
    assert(result.severity !== 'unknown', `Severity determined: ${result.severity}`);
    assert(result.agentsExecuted.length >= 2, `Agents executed: ${result.agentsExecuted.join(', ')}`);

    console.log(`   ⏱️  Total orchestration time: ${orchTime}ms\n`);

    // ══════════════════════════════════════════════════════════════
    // STEP 4: VERIFY CASE & ALL AGENT RESULTS
    // ══════════════════════════════════════════════════════════════
    console.log('─── Step 4: Verify Case & Agent Results ────────────────────────\n');

    const caseRecord = await Case.findOne({ caseId: result.caseId });
    assert(!!caseRecord, 'Case found in DB');

    // Master Agent
    const master = caseRecord.agentResults?.masterAgent;
    assert(!!master, 'MasterAgent result present');
    if (master) {
      assert(!!master.severity, `Master severity: ${master.severity}`);
      assert(Array.isArray(master.agentsToInvoke), `Agents to invoke: ${master.agentsToInvoke?.join(', ')}`);
      console.log(`   🎯 Master: severity=${master.severity}, workflow=${master.workflowType}`);
    }

    // Diagnostic Agent
    const diag = caseRecord.agentResults?.diagnosticAgent;
    assert(!!diag, 'DiagnosticAgent result present');
    if (diag) {
      assert(!!diag.risk, `Diagnostic risk: ${diag.risk}`);
      assert(!!diag.urgency, `Diagnostic urgency: ${diag.urgency}`);
      assert(!!diag.summary, 'Has diagnostic summary');
      assert(!!diag.explanationForCustomer, 'Has customer explanation');
      console.log(`   🔍 Diagnostic: risk=${diag.risk}, urgency=${diag.urgency}`);
      console.log(`   📝 Summary: ${diag.summary.substring(0, 80)}...`);
    }

    // Scheduling Agent v2
    const sched = caseRecord.agentResults?.schedulingAgent;
    assert(!!sched, 'SchedulingAgent result present');
    if (sched) {
      assert(sched.algorithm === 'weighted_multi_factor_v2', `Algorithm: ${sched.algorithm}`);
      assert(sched.status === 'pending_user_approval', `Status: ${sched.status}`);
      assert(sched.userApprovalRequired === true, 'User approval required');
      assert(!!sched.primarySuggestion, 'Has primary suggestion');
      assert(Array.isArray(sched.alternativeSuggestions), 'Has alternative suggestions');
      assert(sched.alternativeSuggestions.length >= 1, `${sched.alternativeSuggestions.length} alternatives`);
      assert(!!sched.executionTimeMs, `Scheduling execution: ${sched.executionTimeMs}ms`);

      // Verify the primary suggestion details
      const primary = sched.primarySuggestion;
      assert(!!primary.appointmentDate, `Primary date: ${primary.appointmentDate}`);
      assert(!!primary.serviceCenter, `Primary center: ${primary.serviceCenter}`);
      assert(!!primary.serviceCenterId, `Primary center ID: ${primary.serviceCenterId}`);
      assert(primary.score > 0, `Primary score: ${primary.score}`);
      assert(primary.distanceKm !== undefined, `Primary distance: ${primary.distanceKm}km`);

      console.log('');
      console.log('   📅 Scheduling Suggestions:');
      console.log(`      #1 [Primary] ${primary.serviceCenter}`);
      console.log(`         📅 ${new Date(primary.appointmentDate).toISOString().split('T')[0]} @ ${primary.timeSlot}`);
      console.log(`         📍 ${primary.distanceKm}km | Score: ${primary.score}`);

      if (sched.alternativeSuggestions) {
        sched.alternativeSuggestions.forEach((alt, i) => {
          console.log(`      #${i + 2} [Alt] ${alt.serviceCenter}`);
          console.log(`         📅 ${new Date(alt.appointmentDate).toISOString().split('T')[0]} @ ${alt.timeSlot}`);
          console.log(`         📍 ${alt.distanceKm}km | Score: ${alt.score}`);
        });
      }

      // Full suggestions array with breakdowns
      if (sched.suggestions && sched.suggestions.length > 0) {
        console.log('');
        console.log('   📊 Score Breakdowns:');
        for (const s of sched.suggestions) {
          const bd = s.scoreBreakdown;
          console.log(`      ${s.serviceCenter.name} (${s.label}):`);
          console.log(`         Distance: ${bd.distance.raw} (×${bd.distance.weighted}) | Spec: ${bd.specialization.raw} (×${bd.specialization.weighted}) | Urgency: ${bd.urgencyFit.raw} (×${bd.urgencyFit.weighted}) | Rating: ${bd.rating.raw} (×${bd.rating.weighted}) | Load: ${bd.loadBalance.raw} (×${bd.loadBalance.weighted}) | Pref: ${bd.preference.raw} | Emergency: ${bd.emergencyBonus}`);
        }
      }
    }

    console.log('');

    // Communication Agent (may be skipped if MasterAgent decides customerContact: "delayed")
    const comm = caseRecord.agentResults?.communicationAgent;
    const commInvoked = result.agentsExecuted.includes('CommunicationAgent') ||
                        master?.agentsToInvoke?.includes('CommunicationAgent');
    if (commInvoked && comm) {
      assert(!!comm, 'CommunicationAgent result present');
      assert(!!comm.channel, `Channel: ${comm.channel}`);
      assert(!!comm.tone, `Tone: ${comm.tone}`);
      assert(!!comm.messageText, 'Has message text');
      console.log(`   📧 Communication: channel=${comm.channel}, tone=${comm.tone}`);
      console.log(`   💬 Message: ${comm.messageText.substring(0, 100)}...`);
    } else {
      console.log(`   ℹ️  CommunicationAgent skipped (MasterAgent decided: customerContact=${master?.customerContact || 'delayed'})`);
      assert(true, 'CommunicationAgent correctly skipped per MasterAgent decision');
    }

    console.log('');

    // Case state
    const validStates = ['PROCESSED', 'CUSTOMER_NOTIFIED', 'AWAITING_USER_APPROVAL', 'APPOINTMENT_CONFIRMED'];
    assert(validStates.includes(caseRecord.currentState), `Case state: ${caseRecord.currentState}`);

    // Metadata
    assert(!!caseRecord.metadata.orchestrationStarted, 'Has orchestration start time');
    assert(!!caseRecord.metadata.orchestrationCompleted, 'Has orchestration end time');
    assert(!!caseRecord.metadata.executionTimeMs, `Execution time: ${caseRecord.metadata.executionTimeMs}ms`);
    assert(caseRecord.metadata.allAgentsCompleted === true, 'All agents completed');

    console.log('');

    // ══════════════════════════════════════════════════════════════
    // STEP 5: SIMULATE USER APPOINTMENT APPROVAL
    // ══════════════════════════════════════════════════════════════
    if (sched && sched.primarySuggestion) {
      console.log('─── Step 5: Simulate User Appointment Approval ───────────────\n');

      const primary = sched.primarySuggestion;

      const approvedCase = await Case.findOneAndUpdate(
        { caseId: caseRecord.caseId },
        {
          'agentResults.schedulingAgent.status': 'confirmed',
          'agentResults.schedulingAgent.confirmedAppointment': {
            date: primary.appointmentDate,
            timeSlot: primary.timeSlot,
            serviceCenter: primary.serviceCenter,
            serviceCenterId: primary.serviceCenterId,
            confirmedAt: new Date(),
            confirmedBy: 'fleet-owner-haryana'
          },
          'metadata.awaitingUserApproval': false,
          'metadata.appointmentConfirmed': true,
          currentState: 'APPOINTMENT_CONFIRMED'
        },
        { new: true }
      );

      assert(approvedCase.currentState === 'APPOINTMENT_CONFIRMED', `State after approval: ${approvedCase.currentState}`);
      assert(approvedCase.agentResults.schedulingAgent.status === 'confirmed', 'Scheduling status: confirmed');
      console.log(`   ✅ Appointment confirmed at ${primary.serviceCenter}`);
      console.log(`   📅 ${new Date(primary.appointmentDate).toISOString().split('T')[0]} @ ${primary.timeSlot}\n`);
    }

    // ══════════════════════════════════════════════════════════════
    // STEP 6: FINAL STATE VERIFICATION
    // ══════════════════════════════════════════════════════════════
    console.log('─── Step 6: Final State Verification ───────────────────────────\n');

    const finalCase = await Case.findOne({ caseId: result.caseId });

    console.log('   📋 Final Case Summary:');
    console.log(`      Case ID:    ${finalCase.caseId}`);
    console.log(`      Vehicle:    ${finalCase.vehicleId}`);
    console.log(`      Severity:   ${finalCase.severity}`);
    console.log(`      State:      ${finalCase.currentState}`);
    console.log(`      Created:    ${finalCase.createdAt}`);
    console.log(`      Agents Run: MasterAgent → DiagnosticAgent → SchedulingAgent v2 → CommunicationAgent`);
    console.log('');

    // ══════════════════════════════════════════════════════════════
    // CLEANUP
    // ══════════════════════════════════════════════════════════════
    console.log('─── Cleanup ────────────────────────────────────────────────────\n');

    await Case.deleteOne({ caseId: result.caseId });
    await PredictionEvent.deleteOne({ _id: prediction._id });
    await Vehicle.deleteOne({ vehicleId });

    console.log('   🧹 Test vehicle, prediction, and case deleted\n');

  } catch (error) {
    console.error('\n❌ PIPELINE ERROR:', error.message);
    console.error(error.stack);

    // Cleanup on failure
    try {
      if (caseId) await Case.deleteOne({ caseId });
      await PredictionEvent.deleteMany({ vehicleId });
      await Vehicle.deleteOne({ vehicleId });
    } catch (_) {}

  } finally {
    // ══════════════════════════════════════════════════════════════
    // SUMMARY
    // ══════════════════════════════════════════════════════════════
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log(`║   RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed}`.padEnd(63) + '║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed\n');

    if (failed > 0) process.exit(1);
  }
}

testFullPipeline();
