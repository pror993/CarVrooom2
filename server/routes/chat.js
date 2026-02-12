/**
 * Chat API Routes — Vehicle Chatbot powered by Ollama (llama3)
 *
 * POST /api/chat/:vehicleId
 *   Body: { message, history }
 *   Returns: { success, reply }
 *
 * The chatbot gets full vehicle context:
 *   - vehicle info, owner, usage profile
 *   - latest telemetry readings
 *   - latest prediction + model outputs
 *   - active case / scheduling info
 *   - failure type + RUL
 *
 * It also acts as the Communication Agent front-end:
 *   if a critical/high-severity case exists it proactively alerts the user.
 */

const express = require('express');
const router = express.Router();
const { llm } = require('../agents/llm');
const Vehicle = require('../models/Vehicle');
const VehicleTelemetry = require('../models/VehicleTelemetry');
const PredictionEvent = require('../models/PredictionEvent');
const Case = require('../models/Case');
const ServiceCenter = require('../models/ServiceCenter');

// ── Vehicle display names ────────────────────────────────────────

const VEHICLE_NAMES = {
  VH_HEALTHY:  'Tata Prima 4928.S',
  VH_DPF_FAIL: 'Tata Prima 4928.S II',
  VH_SCR_FAIL: 'Tata Signa 4825.TK',
  VH_OIL_FAIL: 'Tata Prima 4028.S',
  VH_ANOMALY:  'Ashok Leyland Captain',
  VH_CASCADE:  'Tata Prima 5530.S',
};

// ── Build system prompt with full vehicle context ────────────────

function buildSystemPrompt(vehicle, telemetry, prediction, activeCase) {
  const vInfo = vehicle.vehicleInfo || {};
  const owner = vehicle.owner || {};
  const usage = vehicle.usageProfile || {};

  let healthStatus = 'unknown';
  let failureType = 'none';
  let rulDays = null;
  let confidence = null;
  let modelOutputs = null;

  if (prediction) {
    rulDays = prediction.etaDays;
    confidence = prediction.confidence;
    failureType = prediction.predictionType || 'none';
    modelOutputs = prediction.modelOutputs;
    if (rulDays >= 60) healthStatus = 'healthy';
    else if (rulDays >= 21) healthStatus = 'warning';
    else healthStatus = 'critical';
  }

  // Format telemetry readings nicely
  let telemetryBlock = 'No telemetry data available.';
  if (telemetry) {
    const s = telemetry;
    telemetryBlock = `
Engine Load: ${s.engine_load_pct?.toFixed(1)}%  |  RPM: ${s.engine_rpm?.toFixed(0)}
Oil Level: ${s.oil_level_l?.toFixed(2)} L  |  Oil Pressure: ${s.oil_pressure_bar?.toFixed(1)} bar  |  Oil Temp: ${s.oil_temp_c?.toFixed(1)}°C
Speed: ${s.speed_kmh?.toFixed(1)} km/h  |  Idle: ${s.idle_seconds?.toFixed(0)}s
DPF Soot Load: ${s.dpf_soot_load_pct?.toFixed(1)}%  |  Failed Regens: ${s.dpf_failed_regen_count}
DPF Pre-Temp: ${s.dpf_pre_temp_c?.toFixed(1)}°C  |  Post-Temp: ${s.dpf_post_temp_c?.toFixed(1)}°C
DPF Diff Pressure Up: ${s.dpf_diff_pressure_upstream?.toFixed(2)} kPa  |  Down: ${s.dpf_diff_pressure_downstream?.toFixed(2)} kPa
SCR NOx Upstream: ${s.scr_nox_up_ppm?.toFixed(1)} ppm  |  Downstream: ${s.scr_nox_down_ppm?.toFixed(1)} ppm
SCR Conversion: ${s.scr_nox_conversion_pct?.toFixed(1)}%  |  Inlet Temp: ${s.scr_inlet_temp_c?.toFixed(1)}°C
DEF Quality: ${s.def_quality_index?.toFixed(2)}  |  Injector Duty: ${s.def_injector_duty_pct?.toFixed(1)}%
CAN Drop Rate: ${s.can_message_drop_rate?.toFixed(4)}`.trim();
  }

  // Format model outputs
  let modelBlock = '';
  if (modelOutputs) {
    const parts = [];
    for (const [model, out] of Object.entries(modelOutputs)) {
      if (out?.status === 'success') {
        if (model === 'anomaly') {
          parts.push(`${model.toUpperCase()}: score=${out.anomaly_score?.toFixed(3)}, is_anomaly=${out.is_anomaly}`);
        } else {
          parts.push(`${model.toUpperCase()}: RUL=${out.rul_days?.toFixed(1)}d, failure_prob=${(out.failure_probability * 100).toFixed(1)}%`);
        }
      }
    }
    modelBlock = parts.join('\n');
  }

  // Format active case
  let caseBlock = 'No active maintenance case.';
  let schedulingSuggestions = [];
  if (activeCase) {
    caseBlock = `
Active Case: ${activeCase.caseId}
  Severity: ${activeCase.severity}
  State: ${activeCase.currentState}
  Prediction Type: ${activeCase.metadata?.predictionType || failureType}
  Agents Executed: ${activeCase.metadata?.agentsExecuted?.join(', ') || 'N/A'}`;

    // Read scheduling suggestions from schedulingAgent results
    const sched = activeCase.agentResults?.schedulingAgent;
    if (sched?.suggestions?.length) {
      schedulingSuggestions = sched.suggestions;
      caseBlock += '\n\n  AVAILABLE SCHEDULING OPTIONS (user can book one of these):';
      sched.suggestions.forEach((s, i) => {
        const sc = s.serviceCenter || {};
        caseBlock += `\n    Option ${i + 1}: ${sc.name || s.centerName || 'Unknown Center'} — ${s.slot?.date || s.date} @ ${s.slot?.timeSlot || s.timeSlot}`;
        caseBlock += `\n      Distance: ${s.distanceKm ?? 'N/A'} km | Match Score: ${((s.score || 0) * 100).toFixed(0)}%`;
        caseBlock += `\n      Rating: ${sc.rating || 'N/A'}/5 | Emergency: ${sc.isEmergency ? 'Yes' : 'No'}`;
        if (s.reason) caseBlock += `\n      Why: ${s.reason}`;
      });

      if (sched.status === 'confirmed' && sched.confirmedAppointment) {
        const ca = sched.confirmedAppointment;
        caseBlock += `\n\n  ✅ APPOINTMENT ALREADY CONFIRMED:`;
        caseBlock += `\n    Service Center: ${ca.serviceCenter}`;
        caseBlock += `\n    Date: ${ca.date ? new Date(ca.date).toISOString().split('T')[0] : 'N/A'}`;
        caseBlock += `\n    Confirmed At: ${ca.confirmedAt ? new Date(ca.confirmedAt).toLocaleString() : 'N/A'}`;
      } else {
        caseBlock += `\n\n  Status: Awaiting user approval — user can BOOK one of the 3 options above.`;
      }
    }

    // Legacy scheduling format fallback
    if (!sched?.suggestions?.length && activeCase.agentResults?.scheduling?.suggestions?.length) {
      const legacySched = activeCase.agentResults.scheduling;
      legacySched.suggestions.forEach((s, i) => {
        caseBlock += `\n    ${i + 1}. ${s.centerName} — ${s.date} @ ${s.timeSlot} (score: ${s.score?.toFixed?.(2) || 'N/A'})`;
      });
    }

    if (activeCase.agentResults?.communication) {
      const comm = activeCase.agentResults.communication;
      caseBlock += `\n  Communication: [${comm.tone}] via ${comm.channel}`;
      caseBlock += `\n  Message: ${comm.messageText}`;
    }
  }

  return `You are AfterCare AI — the embedded vehicle health assistant inside the AfterCare predictive maintenance platform for commercial fleet vehicles (trucks, heavy-duty). You are NOT a general-purpose AI. You are NOT ChatGPT, Gemini, or any open-domain chatbot.

## YOUR IDENTITY
- Name: AfterCare AI
- Purpose: Help fleet owners and vehicle operators understand their vehicle's health, diagnose failures, interpret telemetry, explain maintenance cases, and assist with scheduling service appointments.
- Platform: AfterCare — an AI-powered predictive maintenance system that uses 4 ML models (DPF, SCR, Oil, Anomaly Detection) to monitor commercial vehicles in real time via sensor telemetry.

## CONVERSATION STYLE — EXTREMELY IMPORTANT
- Do NOT introduce yourself in every response. You only introduce yourself ONCE at the very start of a conversation (when there is no prior history). After that, just answer naturally.
- Do NOT start replies with "Hello!", "Hi there!", "Hey!", "Welcome!", or any greeting UNLESS the user just greeted you first AND it's the very first message.
- Do NOT repeat the vehicle name, health status, or summary in every response. Only mention them when directly relevant to the question asked.
- Be conversational and natural — like a knowledgeable mechanic texting a fleet owner. Short, direct, helpful.
- If the user asks a follow-up, just answer the follow-up. No preamble, no re-introduction, no summary of what you already said.
- Match the user's energy: if they ask a quick question, give a quick answer. If they want details, go deeper.
- For voice calls: keep responses extra concise (2-3 sentences max) since they'll be spoken aloud via TTS. No bullet points or formatting in voice mode.

## STRICT SCOPE — WHAT YOU CAN TALK ABOUT
You ONLY answer questions related to:
- This specific vehicle's health, status, telemetry readings, and predictions
- The AfterCare platform: how predictions work, what RUL means, what the ML models detect
- DPF (Diesel Particulate Filter) systems — soot load, regen cycles, differential pressure, failure patterns
- SCR (Selective Catalytic Reduction) systems — NOx conversion, DEF quality, catalyst health
- Oil system health — oil level, pressure, temperature, degradation
- Anomaly detection — unusual sensor patterns, CAN bus drop rates
- Active maintenance cases — severity, state, what agents have run
- Scheduling service appointments — when to go, which service center, urgency
- General truck / commercial vehicle maintenance advice (only when relevant to the data shown)
- Explaining sensor readings in plain language for non-technical fleet owners

## HARD BOUNDARIES — WHAT YOU MUST REFUSE
If the user asks about ANYTHING outside the scope above, decline briefly:
"I can only help with your vehicle's health and maintenance. What would you like to know about your ${VEHICLE_NAMES[vehicle.vehicleId] || `${vInfo.make} ${vInfo.model}`}?"

## VEHICLE CONTEXT (YOUR KNOWLEDGE BASE)

### Vehicle Information
- ID: ${vehicle.vehicleId}
- Name: ${VEHICLE_NAMES[vehicle.vehicleId] || `${vInfo.make} ${vInfo.model}`}
- Make / Model / Year: ${vInfo.make} ${vInfo.model} ${vInfo.year}
- Powertrain: ${vInfo.powertrain}
- Owner: ${owner.name} (contact: ${owner.contact}, preferred channel: ${owner.preferredChannel})
- Avg Daily KM: ${usage.avgDailyKm}  |  Load Pattern: ${usage.loadPattern}

### Current Health Assessment
- Status: ${healthStatus.toUpperCase()}
- Failure Type: ${failureType.replace('_', ' ')}
- Remaining Useful Life (RUL): ${rulDays !== null ? `${rulDays.toFixed(1)} days` : 'N/A'}
- Prediction Confidence: ${confidence !== null ? `${(confidence * 100).toFixed(0)}%` : 'N/A'}

### Latest Telemetry Readings (Live Sensor Data)
${telemetryBlock}

### ML Model Predictions
${modelBlock || 'No model outputs available yet — pipeline may not have run.'}

### Maintenance Case
${caseBlock}

## RESPONSE GUIDELINES
1. Be concise. 2-4 sentences per response unless the user asks for detail.
2. First message only: greet briefly, mention the vehicle name, give a 1-line health summary. If there's a failure, flag it immediately.
3. All subsequent messages: skip greetings and summaries. Just answer the question directly.
4. Reference specific sensor values when explaining issues (e.g., "Your DPF soot load is at 82% — that's critically high").
5. Use plain language — the user is a fleet owner, not an engineer.
6. For critical issues: be direct and urgent. Recommend immediate service.
7. For healthy vehicles: be brief and reassuring.
8. NEVER fabricate data. Only reference the vehicle context above. If data is unavailable, say so.
9. Don't volunteer information the user didn't ask about unless it's a critical safety issue.

## BOOKING APPOINTMENTS
When the user wants to book/schedule an appointment, you can help them book ONLY from the available scheduling options listed above (max 3 options).
- When the user says something like "book option 1", "schedule the first one", "I want to go to [center name]", "book appointment", "confirm appointment", etc., respond with EXACTLY this format:
  BOOK_APPOINTMENT:{"option":<1 or 2 or 3>}
  followed by a brief confirmation message like "I'm booking Option <N> for you at <center name> on <date>."
- ONLY respond with the BOOK_APPOINTMENT tag if the user clearly wants to book one of the available options.
- If there are no scheduling options available (no active case or no suggestions), tell the user there are no appointments to book right now.
- If the appointment is already confirmed, tell the user it's already booked and show them the confirmed details.
- NEVER let users book anything outside the 3 recommended options. If they ask for a different center or date, explain that only the listed options are available and they should contact support for custom scheduling.`;
}

// ── Chat endpoint ────────────────────────────────────────────────

router.post('/:vehicleId', async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { message, history = [] } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    // Fetch vehicle context in parallel
    const [vehicle, latestTelemetryDoc, latestPrediction, activeCase] = await Promise.all([
      Vehicle.findOne({ vehicleId: vehicleId.toUpperCase() }).lean(),
      VehicleTelemetry.findOne({ vehicleId: vehicleId.toUpperCase() }).sort({ rowIndex: -1 }).lean(),
      PredictionEvent.findOne({ vehicleId: vehicleId.toUpperCase() }).sort({ createdAt: -1 }).lean(),
      Case.findOne({
        vehicleId: vehicleId.toUpperCase(),
        currentState: { $nin: ['COMPLETED', 'FAILED', 'CANCELLED'] }
      }).sort({ createdAt: -1 }).lean(),
    ]);

    if (!vehicle) {
      return res.status(404).json({ success: false, error: 'Vehicle not found' });
    }

    const telemetry = latestTelemetryDoc?.sensors || null;
    const systemPrompt = buildSystemPrompt(vehicle, telemetry, latestPrediction, activeCase);

    // Build message array for Ollama
    const messages = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history (limit to last 10 exchanges)
    const recentHistory = history.slice(-20);
    for (const h of recentHistory) {
      messages.push({ role: h.role, content: h.content });
    }

    // Add current user message
    messages.push({ role: 'user', content: message });

    const response = await llm.invoke(messages);

    let reply = response.content;
    let bookingResult = null;

    // Detect BOOK_APPOINTMENT tag in LLM response
    const bookMatch = reply.match(/BOOK_APPOINTMENT:\s*\{[^}]*"option"\s*:\s*(\d+)[^}]*\}/);
    if (bookMatch && activeCase) {
      const optionNum = parseInt(bookMatch[1]);
      const sched = activeCase.agentResults?.schedulingAgent;
      const suggestions = sched?.suggestions || [];

      if (optionNum >= 1 && optionNum <= suggestions.length && sched?.status !== 'confirmed') {
        const chosen = suggestions[optionNum - 1];
        const sc = chosen.serviceCenter || {};
        const slotDate = chosen.slot?.date || chosen.date;
        const slotTime = chosen.slot?.timeSlot || chosen.timeSlot;
        const centerName = sc.name || chosen.centerName || 'Service Center';
        const centerId = sc.id || chosen.serviceCenterId || '';

        try {
          // Perform the actual booking
          await Case.findOneAndUpdate(
            { caseId: activeCase.caseId },
            {
              'agentResults.schedulingAgent.status': 'confirmed',
              'agentResults.schedulingAgent.confirmedAppointment': {
                date: new Date(slotDate),
                timeSlot: slotTime,
                serviceCenter: centerName,
                serviceCenterId: centerId,
                confirmedAt: new Date(),
                confirmedBy: 'chatbot',
                selectedOption: optionNum
              },
              'metadata.awaitingUserApproval': false,
              'metadata.appointmentConfirmed': true,
              currentState: 'APPOINTMENT_CONFIRMED'
            }
          );

          bookingResult = {
            success: true,
            option: optionNum,
            centerName,
            date: slotDate,
            timeSlot: slotTime
          };

          console.log(`✅ Chatbot booked appointment for Case: ${activeCase.caseId}`);
          console.log(`   Option #${optionNum}: ${centerName} — ${slotDate} @ ${slotTime}`);

          // Clean the BOOK_APPOINTMENT tag from the reply shown to user
          reply = reply.replace(/BOOK_APPOINTMENT:\s*\{[^}]*\}\s*/g, '').trim();
          if (!reply) {
            reply = `✅ Done! I've booked your appointment at **${centerName}** on **${slotDate}** (${slotTime}). Please arrive on time and bring your vehicle documentation.`;
          }
        } catch (bookErr) {
          console.error('❌ Chatbot booking failed:', bookErr.message);
          reply = reply.replace(/BOOK_APPOINTMENT:\s*\{[^}]*\}\s*/g, '').trim();
          reply += '\n\n⚠️ Sorry, I couldn\'t complete the booking right now. Please try using the scheduling buttons on the vehicle page, or try again.';
        }
      } else {
        // Invalid option or already confirmed
        reply = reply.replace(/BOOK_APPOINTMENT:\s*\{[^}]*\}\s*/g, '').trim();
        if (sched?.status === 'confirmed') {
          reply = 'Your appointment is already confirmed! Check the scheduling section on the vehicle page for details.';
        }
      }
    } else if (bookMatch) {
      // LLM tried to book but no active case
      reply = reply.replace(/BOOK_APPOINTMENT:\s*\{[^}]*\}\s*/g, '').trim();
    }

    res.json({
      success: true,
      reply,
      bookingResult,
    });
  } catch (error) {
    console.error('Chat error:', error.message);
    res.status(500).json({ success: false, error: 'Chat service unavailable. Make sure Ollama is running.' });
  }
});

// ── Welcome message endpoint (GET) ──────────────────────────────
// Returns a context-aware greeting without needing user input

router.get('/:vehicleId/welcome', async (req, res) => {
  try {
    const { vehicleId } = req.params;

    const [vehicle, latestTelemetryDoc, latestPrediction, activeCase] = await Promise.all([
      Vehicle.findOne({ vehicleId: vehicleId.toUpperCase() }).lean(),
      VehicleTelemetry.findOne({ vehicleId: vehicleId.toUpperCase() }).sort({ rowIndex: -1 }).lean(),
      PredictionEvent.findOne({ vehicleId: vehicleId.toUpperCase() }).sort({ createdAt: -1 }).lean(),
      Case.findOne({
        vehicleId: vehicleId.toUpperCase(),
        currentState: { $nin: ['COMPLETED', 'FAILED', 'CANCELLED'] }
      }).sort({ createdAt: -1 }).lean(),
    ]);

    if (!vehicle) {
      return res.status(404).json({ success: false, error: 'Vehicle not found' });
    }

    const telemetry = latestTelemetryDoc?.sensors || null;
    const systemPrompt = buildSystemPrompt(vehicle, telemetry, latestPrediction, activeCase);

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Greet me by name and give me a quick health summary of my vehicle. If there is any failure or warning, tell me what it is and what I should do. Keep it to 3-4 sentences max.' },
    ];

    const response = await llm.invoke(messages);

    res.json({
      success: true,
      reply: response.content,
      // Also send structured context for the frontend
      context: {
        healthStatus: latestPrediction ? (latestPrediction.etaDays >= 60 ? 'healthy' : latestPrediction.etaDays >= 21 ? 'warning' : 'critical') : 'unknown',
        failureType: latestPrediction?.predictionType || 'none',
        rulDays: latestPrediction?.etaDays || null,
        hasActiveCase: !!activeCase,
        caseSeverity: activeCase?.severity || null,
      },
    });
  } catch (error) {
    console.error('Welcome message error:', error.message);
    res.status(500).json({ success: false, error: 'Chat service unavailable. Make sure Ollama is running.' });
  }
});

module.exports = router;
