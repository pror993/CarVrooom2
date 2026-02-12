/**
 * Test: Scheduling Agent v2 — Algorithmic Scoring
 * 
 * Tests the new scheduling algorithm against the seeded Haryana data:
 *  - Fleet owner in Gurugram [77.0890, 28.4947]
 *  - 5 Service centers across Haryana
 *  - 130 slots each (30 days)
 * 
 * Run: node testSchedulingAgent.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const { 
  schedulingAgent, 
  haversineKm, 
  scoreDistance, 
  scoreSpecialization, 
  scoreUrgencyFit, 
  getUrgencyWindow,
  DEFAULT_WEIGHTS,
  CRITICAL_WEIGHTS
} = require('./agents/schedulingAgent');
const ServiceCenter = require('./models/ServiceCenter');
const UserProfile = require('./models/UserProfile');
const Vehicle = require('./models/Vehicle');
const PredictionEvent = require('./models/PredictionEvent');

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

async function runTests() {
  try {
    await connectDB();
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🧪 SCHEDULING AGENT v2 — TEST SUITE');
    console.log('═══════════════════════════════════════════════════════════\n');

    // ─────────────────────────────────────────────────────────────
    // TEST 1: Haversine Distance
    // ─────────────────────────────────────────────────────────────
    console.log('📐 TEST 1: Haversine Distance Calculations');
    console.log('─────────────────────────────────────────────────────────');

    // Gurugram → Faridabad (~30km)
    const gurgaonToFaridabad = haversineKm(77.0890, 28.4947, 77.3178, 28.4089);
    console.log(`   Gurugram → Faridabad: ${gurgaonToFaridabad.toFixed(1)} km`);
    assert(gurgaonToFaridabad > 20 && gurgaonToFaridabad < 40, `Distance realistic (${gurgaonToFaridabad.toFixed(1)}km, expected 20-40km)`);

    // Gurugram → Rohtak (~70km)
    const gurgaonToRohtak = haversineKm(77.0890, 28.4947, 76.6066, 28.8955);
    console.log(`   Gurugram → Rohtak: ${gurgaonToRohtak.toFixed(1)} km`);
    assert(gurgaonToRohtak > 50 && gurgaonToRohtak < 90, `Distance realistic (${gurgaonToRohtak.toFixed(1)}km, expected 50-90km)`);

    // Gurugram → Hisar (~165km)
    const gurgaonToHisar = haversineKm(77.0890, 28.4947, 75.7217, 29.1492);
    console.log(`   Gurugram → Hisar: ${gurgaonToHisar.toFixed(1)} km`);
    assert(gurgaonToHisar > 130 && gurgaonToHisar < 180, `Distance realistic (${gurgaonToHisar.toFixed(1)}km, expected 130-180km)`);

    // Gurugram HQ → Gurugram SC (~7km)
    const gurgaonToLocal = haversineKm(77.0890, 28.4947, 77.0266, 28.4595);
    console.log(`   Gurugram HQ → Gurugram SC: ${gurgaonToLocal.toFixed(1)} km`);
    assert(gurgaonToLocal > 3 && gurgaonToLocal < 15, `Distance realistic (${gurgaonToLocal.toFixed(1)}km, expected 3-15km)`);

    console.log('');

    // ─────────────────────────────────────────────────────────────
    // TEST 2: Scoring Functions
    // ─────────────────────────────────────────────────────────────
    console.log('📊 TEST 2: Individual Scoring Functions');
    console.log('─────────────────────────────────────────────────────────');

    assert(scoreDistance(0) === 1.0, 'Distance 0km = 1.0');
    assert(scoreDistance(75, 150) === 0.5, 'Distance 75km (max 150) = 0.5');
    assert(scoreDistance(150, 150) === 0, 'Distance 150km (max 150) = 0.0');
    assert(scoreDistance(200, 150) === 0, 'Distance 200km (max 150) = 0.0');

    assert(scoreSpecialization(['Tata Motors', 'General maintenance'], 'Tata', 'diesel') === 1.0, 'Make "Tata" matches "Tata Motors"');
    assert(scoreSpecialization(['EV Diagnostics', 'Battery Systems'], 'Tesla', 'electric') === 1.0, 'EV powertrain matches EV specs');
    assert(scoreSpecialization(['General maintenance', 'Oil Change'], 'BMW', 'petrol') === 0.5, 'General maintenance = 0.5');
    assert(scoreSpecialization(['Toyota', 'Honda'], 'BMW', 'petrol') === 0.2, 'No match = 0.2');

    const medWindow = getUrgencyWindow('medium', 30);
    assert(scoreUrgencyFit(10, medWindow, 30) === 1.0, 'Day 10 within medium window = 1.0');
    assert(scoreUrgencyFit(1, medWindow, 30) === 0.7, 'Day 1 (before window) = 0.7');
    assert(scoreUrgencyFit(35, medWindow, 30) === 0.1, 'Day 35 (after ETA 30) = 0.1');

    console.log('');

    // ─────────────────────────────────────────────────────────────
    // TEST 3: Urgency Windows
    // ─────────────────────────────────────────────────────────────
    console.log('⚡ TEST 3: Urgency Window Calculations');
    console.log('─────────────────────────────────────────────────────────');

    const critWindow = getUrgencyWindow('critical', 10);
    assert(critWindow.minDays === 0 && critWindow.maxDays === 2, `Critical: [${critWindow.minDays}, ${critWindow.maxDays}]`);

    const highWindow = getUrgencyWindow('high', 15);
    assert(highWindow.minDays === 1 && highWindow.maxDays <= 7, `High (ETA 15): [${highWindow.minDays}, ${highWindow.maxDays}]`);

    const medWindow2 = getUrgencyWindow('medium', 30);
    assert(medWindow2.minDays === 3, `Medium (ETA 30) minDays: ${medWindow2.minDays}`);
    assert(medWindow2.maxDays === 15, `Medium (ETA 30) maxDays: ${medWindow2.maxDays}`);

    const lowWindow = getUrgencyWindow('low', 60);
    assert(lowWindow.minDays === 7, `Low (ETA 60) minDays: ${lowWindow.minDays}`);
    assert(lowWindow.maxDays === 48, `Low (ETA 60) maxDays: ${lowWindow.maxDays}`);

    console.log('');

    // ─────────────────────────────────────────────────────────────
    // TEST 4: Weight Configurations
    // ─────────────────────────────────────────────────────────────
    console.log('⚖️  TEST 4: Weight Configurations');
    console.log('─────────────────────────────────────────────────────────');

    const defaultSum = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0);
    assert(Math.abs(defaultSum - 1.0) < 0.001, `Default weights sum to ${defaultSum.toFixed(2)} (expected 1.0)`);

    const critSum = Object.values(CRITICAL_WEIGHTS).reduce((a, b) => a + b, 0);
    assert(Math.abs(critSum - 1.0) < 0.001, `Critical weights sum to ${critSum.toFixed(2)} (expected 1.0)`);

    assert(CRITICAL_WEIGHTS.urgencyFit > DEFAULT_WEIGHTS.urgencyFit, 'Critical: urgency weight > default');
    assert(CRITICAL_WEIGHTS.distance < DEFAULT_WEIGHTS.distance, 'Critical: distance weight < default');

    console.log('');

    // ─────────────────────────────────────────────────────────────
    // TEST 5: Full Algorithm — Medium Severity (Tata Nexon EV)
    // ─────────────────────────────────────────────────────────────
    console.log('🔧 TEST 5: Full Algorithm — Medium Severity (Tata Nexon EV, ETA 18d)');
    console.log('─────────────────────────────────────────────────────────');

    const centerCount = await ServiceCenter.countDocuments({ isActive: true });
    assert(centerCount >= 5, `Found ${centerCount} active service centers`);

    const fleetProfile = await UserProfile.findOne({ role: 'fleet_owner' }).lean();
    assert(fleetProfile !== null, 'Fleet owner profile found');
    if (fleetProfile) {
      assert(fleetProfile.location.coordinates[0] !== 0, `User lon: ${fleetProfile.location.coordinates[0]}`);
    }

    // Create test vehicle
    let testVehicle = await Vehicle.findOne({ vehicleId: 'TEST-SCHED-V1' });
    if (!testVehicle) {
      testVehicle = await Vehicle.create({
        vehicleId: 'TEST-SCHED-V1',
        owner: { name: 'Scheduling Test', contact: '+91-9999900000', preferredChannel: 'app' },
        vehicleInfo: { make: 'Tata', model: 'Nexon EV', year: 2024, powertrain: 'electric' },
        usageProfile: { avgDailyKm: 55, loadPattern: 'normal' },
        serviceHistory: []
      });
    }

    // Create test prediction
    const testPrediction = await PredictionEvent.create({
      vehicleId: 'TEST-SCHED-V1',
      predictionType: 'single_failure',
      confidence: 0.82,
      etaDays: 18,
      signals: { battery_voltage: 11.2, coolant_temp: 102 }
    });

    const mediumResult = await schedulingAgent({
      diagnosticResult: {
        urgency: 'medium',
        risk: 'medium',
        summary: 'Battery voltage declining. Coolant temperature elevated.'
      },
      vehicle: testVehicle,
      prediction: testPrediction,
      caseId: null,
      userId: null,
      userProfile: fleetProfile
    });

    assert(mediumResult.suggestions.length >= 2, `Got ${mediumResult.suggestions.length} suggestions (need >= 2)`);
    assert(mediumResult.schedulingUrgency === 'medium', `Urgency: ${mediumResult.schedulingUrgency}`);
    assert(mediumResult.algorithm === 'weighted_multi_factor_v2', `Algorithm: ${mediumResult.algorithm}`);
    assert(mediumResult.executionTimeMs < 1000, `Execution: ${mediumResult.executionTimeMs}ms (< 1s)`);
    assert(mediumResult.userApprovalRequired === true, 'User approval required');

    // Check suggestion structure
    const s1 = mediumResult.suggestions[0];
    assert(s1.rank === 1, 'First suggestion rank = 1');
    assert(s1.label === 'best_overall', `First label: ${s1.label}`);
    assert(s1.score > 0 && s1.score <= 1, `Score in range: ${s1.score}`);
    assert(s1.serviceCenter.id !== undefined, 'Has center ID');
    assert(s1.slot.date !== undefined, `Has date: ${s1.slot.date}`);
    assert(s1.slot.timeSlot !== undefined, `Has timeSlot: ${s1.slot.timeSlot}`);
    assert(s1.distanceKm !== undefined, `Has distance: ${s1.distanceKm}km`);
    assert(s1.scoreBreakdown !== undefined, 'Has score breakdown');
    assert(s1.reason.length > 0, 'Has reason text');

    // For Tata EV from Gurugram, Gurugram EV center should appear
    const hasGurugram = mediumResult.suggestions.some(s => s.serviceCenter.city === 'Gurugram');
    assert(hasGurugram, 'Gurugram center in suggestions (closest + EV match)');

    // Diversity: at least 2 different centers
    const uniqueCenters = new Set(mediumResult.suggestions.map(s => s.serviceCenter.id));
    assert(uniqueCenters.size >= 2, `${uniqueCenters.size} unique centers (diversity ✓)`);

    // Backward-compat fields
    assert(mediumResult.primaryRecommendation.date !== undefined, 'primaryRecommendation.date exists');
    assert(mediumResult.primaryRecommendation.serviceCenter !== undefined, 'primaryRecommendation.serviceCenter exists');
    assert(mediumResult.alternativeRecommendations.length >= 1, `${mediumResult.alternativeRecommendations.length} alternatives`);

    console.log('');

    // ─────────────────────────────────────────────────────────────
    // TEST 6: Full Algorithm — Critical Severity
    // ─────────────────────────────────────────────────────────────
    console.log('🚨 TEST 6: Full Algorithm — Critical Severity (ETA 5d)');
    console.log('─────────────────────────────────────────────────────────');

    const critPrediction = await PredictionEvent.create({
      vehicleId: 'TEST-SCHED-V1',
      predictionType: 'cascade_failure',
      confidence: 0.95,
      etaDays: 5,
      signals: { battery_voltage: 9.8, coolant_temp: 120, oil_pressure: 15 }
    });

    const critResult = await schedulingAgent({
      diagnosticResult: {
        urgency: 'critical',
        risk: 'critical',
        summary: 'Imminent cascade failure. Battery critically low.'
      },
      vehicle: testVehicle,
      prediction: critPrediction,
      caseId: null,
      userId: null,
      userProfile: fleetProfile
    });

    assert(critResult.schedulingUrgency === 'critical', `Urgency: ${critResult.schedulingUrgency}`);
    assert(critResult.suggestions.length >= 2, `Got ${critResult.suggestions.length} suggestions`);

    const critPrimary = critResult.suggestions[0];
    assert(critPrimary.slot.daysFromNow <= 5, `Critical primary in ${critPrimary.slot.daysFromNow} days (≤ 5)`);

    // Emergency bonus check
    const emergencySuggestion = critResult.suggestions.find(s => s.serviceCenter.isEmergency);
    if (emergencySuggestion) {
      assert(emergencySuggestion.scoreBreakdown.emergencyBonus === 0.15, 'Emergency +0.15 bonus applied');
    }

    assert(critResult.searchParams.weightsUsed.urgencyFit === 0.40, 'Critical weights used (urgencyFit=0.40)');

    console.log('');

    // ─────────────────────────────────────────────────────────────
    // TEST 7: Score Breakdown Verification
    // ─────────────────────────────────────────────────────────────
    console.log('🔍 TEST 7: Score Breakdown Verification');
    console.log('─────────────────────────────────────────────────────────');

    const breakdown = mediumResult.suggestions[0].scoreBreakdown;
    assert(breakdown.distance !== undefined, 'Has distance breakdown');
    assert(breakdown.specialization !== undefined, 'Has specialization breakdown');
    assert(breakdown.urgencyFit !== undefined, 'Has urgencyFit breakdown');
    assert(breakdown.rating !== undefined, 'Has rating breakdown');
    assert(breakdown.loadBalance !== undefined, 'Has loadBalance breakdown');
    assert(breakdown.preference !== undefined, 'Has preference breakdown');

    const weightedSum = breakdown.distance.weighted + breakdown.specialization.weighted +
      breakdown.urgencyFit.weighted + breakdown.rating.weighted +
      breakdown.loadBalance.weighted + breakdown.preference.weighted + breakdown.emergencyBonus;
    const totalScore = mediumResult.suggestions[0].score;
    const scoreDiff = Math.abs(weightedSum - totalScore);
    assert(scoreDiff < 0.05, `Weighted sum (${weightedSum.toFixed(3)}) ≈ total (${totalScore}) diff=${scoreDiff.toFixed(4)}`);

    console.log('');

    // ─────────────────────────────────────────────────────────────
    // TEST 8: No User Location Fallback
    // ─────────────────────────────────────────────────────────────
    console.log('📍 TEST 8: No User Location Fallback');
    console.log('─────────────────────────────────────────────────────────');

    const noLocResult = await schedulingAgent({
      diagnosticResult: { urgency: 'low', risk: 'low', summary: 'Minor issue.' },
      vehicle: testVehicle,
      prediction: testPrediction,
      caseId: null,
      userId: null,
      userProfile: null
    });

    assert(noLocResult.suggestions.length >= 2, `Got ${noLocResult.suggestions.length} suggestions without location`);
    assert(noLocResult.searchParams.userLocation === null, 'userLocation = null');
    assert(noLocResult.suggestions[0].distanceKm === 0, 'Distance = 0 when no location');

    console.log('');

    // ─────────────────────────────────────────────────────────────
    // CLEANUP
    // ─────────────────────────────────────────────────────────────
    await Vehicle.deleteOne({ vehicleId: 'TEST-SCHED-V1' });
    await PredictionEvent.deleteMany({ vehicleId: 'TEST-SCHED-V1' });
    console.log('🧹 Test data cleaned up');

    // ─────────────────────────────────────────────────────────────
    // SUMMARY
    // ─────────────────────────────────────────────────────────────
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📊 RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    if (failed > 0) {
      process.exitCode = 1;
    }

  } catch (error) {
    console.error('❌ Test suite error:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
  }
}

runTests();
