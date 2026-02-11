/**
 * Scheduling Agent v2 — Algorithmic Weighted Multi-Factor Scoring
 * 
 * Replaces the LLM-based scheduling agent with a deterministic algorithm.
 * 
 * Scores every (center, slot) pair using 6 weighted factors:
 *   1. Distance      (30%) — Haversine distance from user → center
 *   2. Specialization (20%) — Does center match vehicle make/powertrain?
 *   3. Urgency Fit   (25%) — Is slot date within the ideal urgency window?
 *   4. Rating        (10%) — Center's average rating
 *   5. Load Balance  (10%) — How full is the center on that date?
 *   6. Preference     (5%) — Is this the user's preferred center?
 * 
 * Outputs 3 diverse suggestions:
 *   • Suggestion 1 — Best overall score
 *   • Suggestion 2 — Best from a DIFFERENT center (geographic choice)
 *   • Suggestion 3 — Earliest available (speed pick)
 * 
 * ~5ms execution vs ~8s for LLM-based approach.
 */

const ServiceCenter = require('../models/ServiceCenter');
const UserProfile = require('../models/UserProfile');
const Case = require('../models/Case');

// ─────────────────────────────────────────────────────────────
// HAVERSINE DISTANCE (km)
// ─────────────────────────────────────────────────────────────

/**
 * Calculate the Haversine distance between two [lon, lat] points
 * @param {number} lon1 
 * @param {number} lat1 
 * @param {number} lon2 
 * @param {number} lat2 
 * @returns {number} Distance in kilometers
 */
function haversineKm(lon1, lat1, lon2, lat2) {
  const R = 6371; // Earth's radius in km
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ─────────────────────────────────────────────────────────────
// WEIGHT CONFIGURATION
// ─────────────────────────────────────────────────────────────

const DEFAULT_WEIGHTS = {
  distance:       0.30,
  specialization: 0.20,
  urgencyFit:     0.25,
  rating:         0.10,
  loadBalance:    0.10,
  preference:     0.05
};

// For critical/high severity, urgency matters more than distance
const CRITICAL_WEIGHTS = {
  distance:       0.20,
  specialization: 0.15,
  urgencyFit:     0.40,
  rating:         0.05,
  loadBalance:    0.10,
  preference:     0.10
};

// ─────────────────────────────────────────────────────────────
// URGENCY WINDOW CALCULATION
// ─────────────────────────────────────────────────────────────

/**
 * Get the ideal scheduling window [minDays, maxDays] based on severity + ETA
 * @param {string} severity - critical | high | medium | low
 * @param {number} etaDays - Days until predicted failure
 * @returns {{ minDays: number, maxDays: number }}
 */
function getUrgencyWindow(severity, etaDays) {
  switch (severity) {
    case 'critical':
      return { minDays: 0, maxDays: 2 };
    case 'high':
      return { minDays: 1, maxDays: Math.min(7, Math.max(2, etaDays - 1)) };
    case 'medium':
      return { minDays: 3, maxDays: Math.min(Math.floor(etaDays * 0.5), 28) };
    case 'low':
      return { minDays: 7, maxDays: Math.min(Math.floor(etaDays * 0.8), 56) };
    default:
      return { minDays: 3, maxDays: Math.min(Math.floor(etaDays * 0.5), 28) };
  }
}

// ─────────────────────────────────────────────────────────────
// INDIVIDUAL SCORING FUNCTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Distance score: closer is better
 * @param {number} distanceKm
 * @param {number} maxRadiusKm - Maximum search radius
 * @returns {number} Score 0–1
 */
function scoreDistance(distanceKm, maxRadiusKm = 150) {
  if (distanceKm <= 0) return 1.0;
  return Math.max(0, 1 - distanceKm / maxRadiusKm);
}

/**
 * Specialization match score
 * @param {string[]} centerSpecs - Center's specializations array
 * @param {string} vehicleMake - e.g. "Tata"
 * @param {string} powertrain - e.g. "electric"
 * @returns {number} Score 0–1
 */
function scoreSpecialization(centerSpecs, vehicleMake, powertrain) {
  const specsLower = centerSpecs.map(s => s.toLowerCase());
  const makeLower = (vehicleMake || '').toLowerCase();
  const ptLower = (powertrain || '').toLowerCase();

  // Exact make match → 1.0
  if (makeLower && specsLower.some(s => s.includes(makeLower) || makeLower.includes(s))) {
    return 1.0;
  }

  // Powertrain match (e.g., "ev diagnostics" for "electric")
  const evKeywords = ['electric', 'ev', 'hybrid'];
  const isEV = evKeywords.some(k => ptLower.includes(k));
  if (isEV && specsLower.some(s => s.includes('ev') || s.includes('electric') || s.includes('battery'))) {
    return 1.0;
  }

  // General maintenance → 0.5
  if (specsLower.some(s => s.includes('general'))) {
    return 0.5;
  }

  // No match → 0.2
  return 0.2;
}

/**
 * Urgency fit score: is the slot date within the ideal window?
 * @param {number} daysFromNow
 * @param {{ minDays: number, maxDays: number }} window
 * @param {number} etaDays
 * @returns {number} Score 0–1
 */
function scoreUrgencyFit(daysFromNow, window, etaDays) {
  // Perfect: within the ideal window
  if (daysFromNow >= window.minDays && daysFromNow <= window.maxDays) {
    return 1.0;
  }

  // Earlier than window (proactive) — still decent
  if (daysFromNow < window.minDays) {
    return 0.7;
  }

  // Later than window but before ETA — linear decay
  if (daysFromNow > window.maxDays && daysFromNow < etaDays) {
    const overshoot = daysFromNow - window.maxDays;
    const remaining = Math.max(1, etaDays - window.maxDays);
    return Math.max(0.2, 1 - (overshoot / remaining) * 0.8);
  }

  // After ETA — dangerous
  return 0.1;
}

/**
 * Rating score: higher is better
 * @param {number} avgRating - 0–5
 * @returns {number} Score 0–1
 */
function scoreRating(avgRating) {
  return (avgRating || 0) / 5.0;
}

/**
 * Load balance score: prefer less-loaded centers
 * @param {number} availableSlots - Available slots on that date
 * @param {number} totalSlots - Total possible slots (typically 5)
 * @returns {number} Score 0–1
 */
function scoreLoadBalance(availableSlots, totalSlots = 5) {
  if (totalSlots === 0) return 0;
  return availableSlots / totalSlots;
}

/**
 * Preference score: bonus for user's preferred center
 * @param {string} centerId
 * @param {string|null} preferredCenterId
 * @returns {number} Score 0 or 1
 */
function scorePreference(centerId, preferredCenterId) {
  if (!preferredCenterId) return 0;
  return centerId === preferredCenterId ? 1.0 : 0.0;
}

// ─────────────────────────────────────────────────────────────
// COMPOSITE SCORING
// ─────────────────────────────────────────────────────────────

/**
 * Calculate composite score for a (center, slot) pair
 */
function calculateCompositeScore({
  distanceKm,
  centerSpecs,
  vehicleMake,
  powertrain,
  daysFromNow,
  urgencyWindow,
  etaDays,
  avgRating,
  availableSlotsOnDate,
  centerId,
  preferredCenterId,
  isEmergency,
  severity,
  weights,
  maxRadiusKm
}) {
  const d = scoreDistance(distanceKm, maxRadiusKm);
  const s = scoreSpecialization(centerSpecs, vehicleMake, powertrain);
  const u = scoreUrgencyFit(daysFromNow, urgencyWindow, etaDays);
  const r = scoreRating(avgRating);
  const l = scoreLoadBalance(availableSlotsOnDate);
  const p = scorePreference(centerId, preferredCenterId);

  let totalScore =
    weights.distance * d +
    weights.specialization * s +
    weights.urgencyFit * u +
    weights.rating * r +
    weights.loadBalance * l +
    weights.preference * p;

  // Emergency center bonus for critical/high severity
  const emergencyBonus = (isEmergency && (severity === 'critical' || severity === 'high')) ? 0.15 : 0;
  totalScore += emergencyBonus;

  // Cap at 1.0
  totalScore = Math.min(1.0, totalScore);

  return {
    totalScore: Math.round(totalScore * 1000) / 1000,
    breakdown: {
      distance:       { raw: Math.round(d * 100) / 100, weighted: Math.round(weights.distance * d * 100) / 100 },
      specialization: { raw: Math.round(s * 100) / 100, weighted: Math.round(weights.specialization * s * 100) / 100 },
      urgencyFit:     { raw: Math.round(u * 100) / 100, weighted: Math.round(weights.urgencyFit * u * 100) / 100 },
      rating:         { raw: Math.round(r * 100) / 100, weighted: Math.round(weights.rating * r * 100) / 100 },
      loadBalance:    { raw: Math.round(l * 100) / 100, weighted: Math.round(weights.loadBalance * l * 100) / 100 },
      preference:     { raw: Math.round(p * 100) / 100, weighted: Math.round(weights.preference * p * 100) / 100 },
      emergencyBonus
    }
  };
}

// ─────────────────────────────────────────────────────────────
// REASON GENERATOR
// ─────────────────────────────────────────────────────────────

/**
 * Generate a human-readable reason string for a suggestion
 */
function generateReason(scored, index) {
  const { center, slot, distanceKm, daysFromNow, scoring } = scored;
  const parts = [];

  // Lead with suggestion type
  if (index === 0) parts.push('Best overall match.');
  else if (scored.label === 'alternative_center') parts.push('Alternative center for geographic choice.');
  else if (scored.label === 'earliest_available') parts.push('Earliest available slot for fastest service.');
  else parts.push('Additional option.');

  // Distance
  if (distanceKm < 10) parts.push(`Very close (${distanceKm.toFixed(1)} km).`);
  else if (distanceKm < 30) parts.push(`Nearby (${distanceKm.toFixed(1)} km).`);
  else parts.push(`${distanceKm.toFixed(1)} km away.`);

  // Specialization
  if (scoring.breakdown.specialization.raw >= 1.0) {
    parts.push('Specializes in your vehicle type.');
  }

  // Rating
  if (center.rating.average >= 4.5) parts.push(`Highly rated (${center.rating.average}★).`);
  else if (center.rating.average >= 4.0) parts.push(`Well rated (${center.rating.average}★).`);

  // Emergency
  if (center.isEmergency) parts.push('Emergency service available.');

  // Timing
  if (daysFromNow === 0) parts.push('Available today!');
  else if (daysFromNow === 1) parts.push('Available tomorrow.');
  else if (daysFromNow <= 3) parts.push(`Available in ${daysFromNow} days.`);

  return parts.join(' ');
}

// ─────────────────────────────────────────────────────────────
// MAIN SCHEDULING FUNCTION
// ─────────────────────────────────────────────────────────────

/**
 * Algorithmic Scheduling Agent v2
 * 
 * Scores all (center, slot) pairs and returns top 3 diverse suggestions.
 * 
 * @param {Object} params
 * @param {Object} params.diagnosticResult - { risk, urgency, summary }
 * @param {Object} params.vehicle - Vehicle mongoose document
 * @param {Object} params.prediction - PredictionEvent mongoose document
 * @param {string|null} params.caseId - Case ID string for saving results
 * @param {string|null} params.userId - User's _id (to fetch UserProfile)
 * @param {Object|null} params.userProfile - Pre-fetched UserProfile (optional)
 * @returns {Promise<Object>} Scheduling result with 3 diverse suggestions
 */
async function schedulingAgent({
  diagnosticResult,
  vehicle,
  prediction,
  caseId = null,
  userId = null,
  userProfile = null
}) {
  const startTime = Date.now();
  console.log('📅 Scheduling Agent v2: Algorithmic scoring started...');

  try {
    // ─── 1. LOAD USER PROFILE ────────────────────────────────────
    let profile = userProfile;
    if (!profile && userId) {
      profile = await UserProfile.findOne({ userId }).lean();
    }

    const userCoords = profile?.location?.coordinates || [0, 0]; // [lon, lat]
    const userLon = userCoords[0];
    const userLat = userCoords[1];
    const preferredCenterId = profile?.preferredServiceCenter
      ? profile.preferredServiceCenter.toString()
      : null;

    const hasUserLocation = userLon !== 0 || userLat !== 0;

    console.log(`   📍 User location: [${userLon}, ${userLat}] ${hasUserLocation ? '✓' : '(no coords — distance scoring disabled)'}`);
    console.log(`   🚗 Vehicle: ${vehicle.vehicleInfo.make} ${vehicle.vehicleInfo.model} (${vehicle.vehicleInfo.powertrain})`);

    // ─── 2. DETERMINE SEVERITY & URGENCY WINDOW ─────────────────
    const severity = diagnosticResult?.urgency || diagnosticResult?.risk || 'medium';
    const etaDays = prediction.etaDays || 30;
    const urgencyWindow = getUrgencyWindow(severity, etaDays);
    const weights = (severity === 'critical' || severity === 'high') ? CRITICAL_WEIGHTS : DEFAULT_WEIGHTS;

    console.log(`   ⚡ Severity: ${severity} | ETA: ${etaDays} days | Window: [${urgencyWindow.minDays}d, ${urgencyWindow.maxDays}d]`);

    // ─── 3. FETCH CANDIDATE CENTERS ──────────────────────────────
    const maxRadiusKm = severity === 'critical' ? 200 : severity === 'high' ? 150 : 100;

    let centers;
    if (hasUserLocation) {
      // GeoJSON $nearSphere — returns sorted by distance
      centers = await ServiceCenter.find({
        isActive: true,
        geoLocation: {
          $nearSphere: {
            $geometry: { type: 'Point', coordinates: [userLon, userLat] },
            $maxDistance: maxRadiusKm * 1000
          }
        }
      }).limit(20);
    } else {
      // No user location — fallback to all active centers
      centers = await ServiceCenter.find({ isActive: true }).limit(20);
    }

    if (centers.length === 0) {
      throw new Error('No active service centers found within search radius');
    }

    console.log(`   🔧 Found ${centers.length} candidate centers (radius: ${maxRadiusKm}km)`);

    // ─── 4. SCORE EVERY (CENTER, SLOT) PAIR ──────────────────────
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const maxDaysAhead = Math.max(urgencyWindow.maxDays * 2, 30);
    const cutoffDate = new Date(today);
    cutoffDate.setDate(cutoffDate.getDate() + maxDaysAhead);

    const scoredPairs = [];

    for (const center of centers) {
      // Calculate distance
      const centerCoords = center.geoLocation?.coordinates || [0, 0];
      const distanceKm = hasUserLocation
        ? haversineKm(userLon, userLat, centerCoords[0], centerCoords[1])
        : 0;

      // Get available slots in window
      const availableSlots = center.slots.filter(slot => {
        if (slot.status !== 'available') return false;
        const slotDate = new Date(slot.date);
        return slotDate >= today && slotDate <= cutoffDate;
      });

      if (availableSlots.length === 0) continue;

      // Group slots by date for load balance
      const slotsByDate = {};
      for (const slot of center.slots) {
        const dateKey = new Date(slot.date).toISOString().split('T')[0];
        if (!slotsByDate[dateKey]) slotsByDate[dateKey] = { total: 0, available: 0 };
        slotsByDate[dateKey].total++;
        if (slot.status === 'available') slotsByDate[dateKey].available++;
      }

      // Score each available slot
      for (const slot of availableSlots) {
        const slotDate = new Date(slot.date);
        const daysFromNow = Math.round((slotDate - today) / (1000 * 60 * 60 * 24));
        const dateKey = slotDate.toISOString().split('T')[0];
        const dateStats = slotsByDate[dateKey] || { total: 5, available: 1 };

        const scoring = calculateCompositeScore({
          distanceKm,
          centerSpecs: center.specializations,
          vehicleMake: vehicle.vehicleInfo.make,
          powertrain: vehicle.vehicleInfo.powertrain,
          daysFromNow,
          urgencyWindow,
          etaDays,
          avgRating: center.rating.average,
          availableSlotsOnDate: dateStats.available,
          centerId: center._id.toString(),
          preferredCenterId,
          isEmergency: center.isEmergency,
          severity,
          weights,
          maxRadiusKm
        });

        scoredPairs.push({
          center,
          slot,
          distanceKm,
          daysFromNow,
          scoring,
          label: null // set during selection
        });
      }
    }

    if (scoredPairs.length === 0) {
      throw new Error('No available slots found in any center within the scheduling window');
    }

    console.log(`   📊 Scored ${scoredPairs.length} (center, slot) pairs`);

    // ─── 5. SELECT TOP 3 DIVERSE SUGGESTIONS ─────────────────────

    // Sort by score descending
    scoredPairs.sort((a, b) => b.scoring.totalScore - a.scoring.totalScore);

    const suggestions = [];

    // #1: Best overall score
    const best = { ...scoredPairs[0], label: 'best_overall' };
    suggestions.push(best);

    // #2: Best from a DIFFERENT center
    const diffCenter = scoredPairs.find(
      p => p.center.serviceCenterId !== best.center.serviceCenterId
    );
    if (diffCenter) {
      suggestions.push({ ...diffCenter, label: 'alternative_center' });
    }

    // #3: Earliest available (not already picked)
    const earliestSorted = [...scoredPairs].sort(
      (a, b) => a.daysFromNow - b.daysFromNow || b.scoring.totalScore - a.scoring.totalScore
    );
    const earliest = earliestSorted.find(p =>
      !suggestions.some(
        s => s.center.serviceCenterId === p.center.serviceCenterId &&
             s.slot.timeSlot === p.slot.timeSlot &&
             s.daysFromNow === p.daysFromNow
      )
    );
    if (earliest) {
      suggestions.push({ ...earliest, label: 'earliest_available' });
    }

    // Fill to 3 if needed
    if (suggestions.length < 3) {
      for (const pair of scoredPairs) {
        if (suggestions.length >= 3) break;
        const isDup = suggestions.some(
          s => s.center.serviceCenterId === pair.center.serviceCenterId &&
               s.slot.timeSlot === pair.slot.timeSlot &&
               s.daysFromNow === pair.daysFromNow
        );
        if (!isDup) {
          suggestions.push({ ...pair, label: 'additional_option' });
        }
      }
    }

    const executionMs = Date.now() - startTime;
    console.log(`   ⚡ Scoring complete in ${executionMs}ms`);

    // ─── 6. FORMAT OUTPUT ────────────────────────────────────────

    const formatSuggestion = (scored, index) => ({
      rank: index + 1,
      label: scored.label,
      serviceCenter: {
        id: scored.center.serviceCenterId,
        name: scored.center.name,
        city: scored.center.location.city,
        address: scored.center.location.address,
        rating: scored.center.rating.average,
        ratingCount: scored.center.rating.count,
        isEmergency: scored.center.isEmergency,
        specializations: scored.center.specializations
      },
      slot: {
        date: new Date(scored.slot.date).toISOString().split('T')[0],
        timeSlot: scored.slot.timeSlot,
        daysFromNow: scored.daysFromNow
      },
      distanceKm: Math.round(scored.distanceKm * 10) / 10,
      score: scored.scoring.totalScore,
      scoreBreakdown: scored.scoring.breakdown,
      reason: generateReason(scored, index)
    });

    const result = {
      schedulingUrgency: severity,
      algorithm: 'weighted_multi_factor_v2',
      executionTimeMs: executionMs,
      searchParams: {
        userLocation: hasUserLocation ? [userLon, userLat] : null,
        maxRadiusKm,
        urgencyWindow,
        etaDays,
        weightsUsed: weights,
        candidateCenters: centers.length,
        totalScoredPairs: scoredPairs.length
      },
      suggestions: suggestions.map(formatSuggestion),
      // Backward-compatible fields for orchestrator
      primaryRecommendation: {
        date: new Date(suggestions[0].slot.date).toISOString().split('T')[0],
        timeSlot: suggestions[0].slot.timeSlot,
        serviceCenter: suggestions[0].center.name,
        serviceCenterId: suggestions[0].center.serviceCenterId,
        location: `${suggestions[0].center.location.address}, ${suggestions[0].center.location.city}`,
        distanceKm: Math.round(suggestions[0].distanceKm * 10) / 10,
        score: suggestions[0].scoring.totalScore,
        reasoning: generateReason(suggestions[0], 0)
      },
      alternativeRecommendations: suggestions.slice(1).map((s, i) => ({
        date: new Date(s.slot.date).toISOString().split('T')[0],
        timeSlot: s.slot.timeSlot,
        serviceCenter: s.center.name,
        serviceCenterId: s.center.serviceCenterId,
        location: `${s.center.location.address}, ${s.center.location.city}`,
        distanceKm: Math.round(s.distanceKm * 10) / 10,
        score: s.scoring.totalScore,
        reasoning: generateReason(s, i + 1)
      })),
      userApprovalRequired: true,
      status: 'pending_user_approval',
      additionalNotes: severity === 'critical'
        ? 'URGENT: Your vehicle needs immediate attention. Please confirm an appointment ASAP.'
        : severity === 'high'
        ? 'IMPORTANT: Please review and select an appointment within 24 hours.'
        : severity === 'medium'
        ? 'Please review these options and select the most convenient appointment.'
        : 'Routine maintenance suggested. Select a time that works for your schedule.'
    };

    // ─── 7. SAVE TO CASE ─────────────────────────────────────────

    if (caseId) {
      await Case.findOneAndUpdate(
        { caseId },
        {
          'agentResults.schedulingAgent': {
            status: 'pending_user_approval',
            algorithm: 'weighted_multi_factor_v2',
            executionTimeMs: executionMs,
            suggestions: result.suggestions,
            primarySuggestion: {
              appointmentDate: new Date(suggestions[0].slot.date),
              timeSlot: suggestions[0].slot.timeSlot,
              serviceCenter: suggestions[0].center.name,
              serviceCenterId: suggestions[0].center.serviceCenterId,
              distanceKm: Math.round(suggestions[0].distanceKm * 10) / 10,
              score: suggestions[0].scoring.totalScore,
              reason: generateReason(suggestions[0], 0)
            },
            alternativeSuggestions: suggestions.slice(1).map((s, i) => ({
              appointmentDate: new Date(s.slot.date),
              timeSlot: s.slot.timeSlot,
              serviceCenter: s.center.name,
              serviceCenterId: s.center.serviceCenterId,
              distanceKm: Math.round(s.distanceKm * 10) / 10,
              score: s.scoring.totalScore,
              reason: generateReason(s, i + 1)
            })),
            suggestedAt: new Date(),
            userApprovalRequired: true
          },
          'metadata.schedulingSuggestionsReady': true,
          'metadata.awaitingUserApproval': true
        },
        { new: true }
      );
      console.log('   💾 Suggestions saved to Case');
    }

    // ─── 8. LOG SUMMARY ──────────────────────────────────────────

    console.log('');
    console.log('   ┌──────────────────────────────────────────────────────┐');
    console.log('   │  📅 SCHEDULING SUGGESTIONS                          │');
    console.log('   ├──────────────────────────────────────────────────────┤');
    for (const s of result.suggestions) {
      console.log(`   │  #${s.rank} [${s.label}] Score: ${s.score}`);
      console.log(`   │     📍 ${s.serviceCenter.name} (${s.distanceKm}km)`);
      console.log(`   │     📅 ${s.slot.date} @ ${s.slot.timeSlot} (in ${s.slot.daysFromNow}d)`);
      console.log(`   │     ⭐ ${s.serviceCenter.rating}/5 (${s.serviceCenter.ratingCount} reviews)`);
    }
    console.log('   └──────────────────────────────────────────────────────┘');
    console.log('');
    console.log(`✅ Scheduling Agent v2 complete (${executionMs}ms)`);

    return result;

  } catch (error) {
    console.error('❌ Scheduling Agent v2 Error:', error.message);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────

module.exports = {
  schedulingAgent,
  // Export internals for unit testing
  haversineKm,
  scoreDistance,
  scoreSpecialization,
  scoreUrgencyFit,
  scoreRating,
  scoreLoadBalance,
  scorePreference,
  calculateCompositeScore,
  getUrgencyWindow,
  DEFAULT_WEIGHTS,
  CRITICAL_WEIGHTS
};
