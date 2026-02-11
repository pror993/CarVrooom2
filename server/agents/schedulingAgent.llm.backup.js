/**
 * Scheduling Agent - Service Appointment Scheduler
 * 
 * The Scheduling Agent determines optimal service timing and books appointments.
 * Uses LangChain tools to interact with the scheduling system.
 * 
 * Features:
 * - Decides urgency and optimal timing
 * - Uses schedule_service tool to book appointments
 * - Stores scheduling info in Case.agentResults
 */

const { PromptTemplate } = require('@langchain/core/prompts');
const { JsonOutputParser } = require('@langchain/core/output_parsers');
const { DynamicStructuredTool } = require('@langchain/core/tools');
const { z } = require('zod');
const { llm } = require('./llm');
const Case = require('../models/Case');

/**
 * Tool: save_scheduling_suggestion
 * Saves scheduling suggestions to the Case for user review
 * Does NOT book appointments - only provides recommendations
 */
const createSaveSchedulingSuggestionTool = (caseId) => {
  return new DynamicStructuredTool({
    name: "save_scheduling_suggestion",
    description: "Saves scheduling recommendations for the user to review and approve. This does NOT book an appointment, only stores suggestions.",
    schema: z.object({
      primaryOption: z.object({
        date: z.string().describe("Suggested appointment date (YYYY-MM-DD)"),
        serviceCenter: z.string().describe("Recommended service center"),
        reason: z.string().describe("Why this option is recommended")
      }),
      alternativeOptions: z.array(z.object({
        date: z.string().describe("Alternative appointment date (YYYY-MM-DD)"),
        serviceCenter: z.string().describe("Alternative service center"),
        reason: z.string().describe("Why this is an alternative option")
      })).describe("2-3 alternative options for the user")
    }),
    func: async ({ primaryOption, alternativeOptions }) => {
      try {
        console.log('   � Scheduling Tool: Saving suggestions for user review...');
        console.log(`      Primary: ${primaryOption.date} at ${primaryOption.serviceCenter}`);
        console.log(`      Alternatives: ${alternativeOptions.length} options`);

        // Store scheduling SUGGESTIONS (not confirmed appointments) in Case
        if (caseId) {
          const suggestionData = {
            status: 'pending_user_approval',
            primarySuggestion: {
              appointmentDate: new Date(primaryOption.date),
              serviceCenter: primaryOption.serviceCenter,
              reason: primaryOption.reason
            },
            alternativeSuggestions: alternativeOptions.map(opt => ({
              appointmentDate: new Date(opt.date),
              serviceCenter: opt.serviceCenter,
              reason: opt.reason
            })),
            suggestedAt: new Date(),
            userApprovalRequired: true
          };

          await Case.findOneAndUpdate(
            { caseId: caseId },
            { 
              'agentResults.schedulingAgent': suggestionData,
              'metadata.schedulingSuggestionsReady': true,
              'metadata.awaitingUserApproval': true
            },
            { new: true }
          );

          console.log('   ✅ Suggestions stored in Case (awaiting user approval)');
        }

        return JSON.stringify({
          success: true,
          message: 'Scheduling suggestions saved for user review',
          primaryOption: primaryOption,
          alternativeCount: alternativeOptions.length,
          nextStep: 'User will review and approve via frontend'
        });
      } catch (error) {
        console.error('   ❌ Scheduling Tool Error:', error.message);
        return JSON.stringify({
          success: false,
          error: error.message
        });
      }
    }
  });
};

// Define the output schema
const outputParser = new JsonOutputParser();

// Create the prompt template
const schedulingAgentPrompt = PromptTemplate.fromTemplate(`You are a Scheduling Agent for a vehicle predictive maintenance system.

Your role is to analyze diagnostic data and provide scheduling recommendations for the user to review and approve.

**IMPORTANT**: You do NOT book appointments automatically. You provide suggestions that the user will review in the frontend.

## Input Data

### Diagnostic Result:
- Summary: {diagnosticSummary}
- Risk Level: {riskLevel}
- Urgency Level: {urgencyLevel}

### Vehicle Information:
- Vehicle ID: {vehicleId}
- Make/Model/Year: {vehicleMakeModel} {vehicleYear}
- Current Location: {location}
- Average Daily KM: {avgDailyKm}
- Load Pattern: {loadPattern}

### Prediction Data:
- ETA Days: {etaDays}
- Prediction Type: {predictionType}
- Confidence: {confidence}

### Available Service Centers:
{serviceCenters}

## Your Task

Analyze the diagnostic data and provide scheduling recommendations for the user to review.

### Step 1: Determine Scheduling Urgency

Based on the urgency level and risk:
- **critical urgency**: Recommend options within 24-48 hours (emergency slots)
- **high urgency**: Recommend options within 3-7 days (priority slots)
- **medium urgency**: Recommend options within 2-4 weeks (standard slots)
- **low urgency**: Recommend options within 4-8 weeks or next routine service

### Step 2: Select Service Centers

Identify 2-4 suitable service centers considering:
- Proximity to vehicle location
- Specialization (if needed for specific powertrain/make)
- Different urgency levels (emergency vs standard)

### Step 3: Calculate Suggested Dates

For PRIMARY option:
- Start from today's date: {currentDate}
- Add appropriate buffer based on urgency
- Consider that the prediction ETA is {etaDays} days
- Suggest BEFORE the predicted failure if possible

For ALTERNATIVE options (provide 2-3):
- Earlier date at emergency center (if critical/high urgency)
- Later date at convenient center (if medium/low urgency)
- Different service center with similar timing
- Weekend/evening slots if available

### Step 4: Use the save_scheduling_suggestion Tool

You have access to the **save_scheduling_suggestion** tool. You MUST call this tool to save recommendations.

The tool accepts:
- primaryOption: { date, serviceCenter, reason }
- alternativeOptions: [{ date, serviceCenter, reason }, ...]

### Decision Guidelines

**For Critical Urgency:**
- Primary: Next available slot (1-2 days)
- Alternatives: Emergency centers, different times same day

**For High Urgency:**
- Primary: Within 3-5 days at specialized center
- Alternatives: Earlier emergency slot, different specialized center

**For Medium Urgency:**
- Primary: ~50% of ETA days at convenient location
- Alternatives: Earlier date, different locations, weekend slots

**For Low Urgency:**
- Primary: Next routine service window (4-8 weeks)
- Alternatives: Different convenient times/locations

## Output Format

After calling the save_scheduling_suggestion tool, respond with a JSON object:

{{
  "schedulingUrgency": "critical|high|medium|low",
  "primaryRecommendation": {{
    "date": "YYYY-MM-DD",
    "serviceCenter": "Center name",
    "serviceCenterId": "SC-XXX",
    "reasoning": "Why this is the best option"
  }},
  "alternativeRecommendations": [
    {{
      "date": "YYYY-MM-DD",
      "serviceCenter": "Center name",
      "serviceCenterId": "SC-XXX",
      "reasoning": "Why this is an alternative"
    }}
  ],
  "toolCalled": true,
  "userApprovalRequired": true,
  "additionalNotes": "Any special considerations for the user"
}}

{format_instructions}

**IMPORTANT**: 
1. You MUST call the save_scheduling_suggestion tool to store recommendations
2. Do NOT book appointments - only provide suggestions
3. Provide 1 primary + 2-3 alternative options
4. User will review and approve via frontend
5. Use exact date format YYYY-MM-DD
6. Base decisions on urgency and ETA days

Think through the scheduling options, then call the tool, then provide your final JSON response.`);

/**
 * Scheduling Agent - Provides scheduling suggestions for user approval
 * 
 * @param {Object} diagnosticResult - Result from DiagnosticAgent
 * @param {Object} vehicle - Vehicle information
 * @param {Object} prediction - Prediction data
 * @param {string} caseId - Case ID for storing scheduling suggestions
 * @returns {Promise<Object>} Scheduling suggestions for user review
 */
async function schedulingAgent(diagnosticResult, vehicle, prediction, caseId = null) {
  try {
    console.log('📅 Scheduling Agent: Generating scheduling recommendations...');

    // Create the save_scheduling_suggestion tool with case context
    const saveSuggestionTool = createSaveSchedulingSuggestionTool(caseId);

    // Available service centers (in real app, this would be fetched from database)
    const serviceCenters = [
      { id: 'SC-001', name: 'Downtown Service Center', location: 'Downtown', specialties: ['All makes'] },
      { id: 'SC-002', name: 'North Auto Care', location: 'North District', specialties: ['Electric vehicles', 'Tesla'] },
      { id: 'SC-003', name: 'Express Auto Repair', location: 'West Side', specialties: ['Emergency service'] },
      { id: 'SC-004', name: 'Premium Motors Service', location: 'East District', specialties: ['Luxury vehicles', 'Ford', 'Toyota'] }
    ];

    // Prepare input data for prompt
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    const promptInput = {
      // Diagnostic result
      diagnosticSummary: diagnosticResult.summary,
      riskLevel: diagnosticResult.risk,
      urgencyLevel: diagnosticResult.urgency,
      
      // Vehicle information
      vehicleId: vehicle.vehicleId,
      vehicleMakeModel: `${vehicle.vehicleInfo.make} ${vehicle.vehicleInfo.model}`,
      vehicleYear: vehicle.vehicleInfo.year,
      location: 'Downtown', // In real app, get from vehicle GPS or owner address
      avgDailyKm: vehicle.usageProfile.avgDailyKm,
      loadPattern: vehicle.usageProfile.loadPattern,
      
      // Prediction data
      etaDays: prediction.etaDays,
      predictionType: prediction.predictionType,
      confidence: prediction.confidence,
      
      // Service centers
      serviceCenters: JSON.stringify(serviceCenters, null, 2),
      
      // Current date
      currentDate: currentDate,
      
      // Format instructions
      format_instructions: outputParser.getFormatInstructions()
    };

    // For LangChain agent with tools, we need to use a different approach
    // Since we're using temperature=0, we'll simulate the tool call manually
    // In a production system, you'd use AgentExecutor
    
    console.log('   📋 Analyzing urgency and generating suggestions...');
    
    // Calculate recommended dates based on urgency
    let primaryDaysToAdd = 0;
    let alternativeDays = [];
    
    switch (diagnosticResult.urgency) {
      case 'critical':
        primaryDaysToAdd = 1; // Next day
        alternativeDays = [0, 2]; // Today emergency, or day after
        break;
      case 'high':
        primaryDaysToAdd = 5; // Within a week
        alternativeDays = [3, 7]; // Earlier or slightly later
        break;
      case 'medium':
        primaryDaysToAdd = 14; // 2 weeks
        alternativeDays = [10, 21]; // 10 days or 3 weeks
        break;
      case 'low':
        primaryDaysToAdd = 30; // 1 month
        alternativeDays = [21, 45]; // 3 weeks or 6 weeks
        break;
    }

    // Ensure primary is before the predicted failure
    if (primaryDaysToAdd >= prediction.etaDays) {
      primaryDaysToAdd = Math.max(1, Math.floor(prediction.etaDays * 0.6)); // 60% of ETA
    }

    // Calculate dates
    const calculateDate = (daysFromNow) => {
      const date = new Date();
      date.setDate(date.getDate() + daysFromNow);
      return date.toISOString().split('T')[0];
    };

    const primaryDate = calculateDate(primaryDaysToAdd);
    
    // Select service centers based on urgency and vehicle type
    let primaryCenter = serviceCenters[0];
    let altCenters = [];
    
    if (diagnosticResult.urgency === 'critical') {
      // Primary: Emergency service
      primaryCenter = serviceCenters.find(sc => sc.specialties.includes('Emergency service')) || serviceCenters[0];
      // Alternatives: Other emergency or specialized
      altCenters = serviceCenters.filter(sc => sc.id !== primaryCenter.id).slice(0, 2);
    } else {
      // Primary: Match vehicle specialization
      const vehicleMake = vehicle.vehicleInfo.make;
      primaryCenter = serviceCenters.find(sc => 
        sc.specialties.some(s => s.toLowerCase().includes(vehicleMake.toLowerCase()))
      ) || serviceCenters[0];
      
      // Alternatives: Different specialized centers
      altCenters = serviceCenters
        .filter(sc => sc.id !== primaryCenter.id)
        .slice(0, 2);
    }

    console.log(`   � Primary suggestion: ${primaryDate} at ${primaryCenter.name}`);
    console.log(`   💡 Generating ${alternativeDays.length} alternative options...`);

    // Build primary and alternative options
    const primaryOption = {
      date: primaryDate,
      serviceCenter: primaryCenter.name,
      reason: `Best option: ${diagnosticResult.urgency} urgency, ${prediction.etaDays}-day ETA. ${primaryCenter.specialties.join(', ')}`
    };

    const alternativeOptions = alternativeDays.map((days, index) => {
      const altDate = calculateDate(days);
      const altCenter = altCenters[index] || serviceCenters[index + 1] || serviceCenters[0];
      
      return {
        date: altDate,
        serviceCenter: altCenter.name,
        reason: days < primaryDaysToAdd 
          ? `Earlier option: ${days} days at ${altCenter.specialties.join(', ')}`
          : `Alternative timing: ${days} days at ${altCenter.specialties.join(', ')}`
      };
    });

    // Call the save_scheduling_suggestion tool
    const toolResult = await saveSuggestionTool.invoke({
      primaryOption,
      alternativeOptions
    });

    console.log('✅ Scheduling Agent: Suggestions ready for user review');

    // Parse tool result
    const toolResultParsed = JSON.parse(toolResult);

    // Create response
    const result = {
      schedulingUrgency: diagnosticResult.urgency,
      primaryRecommendation: {
        date: primaryDate,
        serviceCenter: primaryCenter.name,
        serviceCenterId: primaryCenter.id,
        location: primaryCenter.location,
        reasoning: `Based on ${diagnosticResult.urgency} urgency and ${prediction.etaDays}-day ETA, this is the optimal timing at a center specializing in ${primaryCenter.specialties.join(', ')}`
      },
      alternativeRecommendations: alternativeDays.map((days, index) => {
        const altDate = calculateDate(days);
        const altCenter = altCenters[index] || serviceCenters[index + 1] || serviceCenters[0];
        return {
          date: altDate,
          serviceCenter: altCenter.name,
          serviceCenterId: altCenter.id,
          location: altCenter.location,
          reasoning: days < primaryDaysToAdd 
            ? `Earlier slot available for more urgent attention`
            : `More flexible timing if primary doesn't work for your schedule`
        };
      }),
      toolCalled: true,
      userApprovalRequired: true,
      suggestionsSaved: toolResultParsed.success,
      additionalNotes: diagnosticResult.urgency === 'critical' 
        ? 'URGENT: Please review and confirm appointment as soon as possible. Your vehicle needs immediate attention.'
        : diagnosticResult.urgency === 'high'
        ? 'IMPORTANT: Please review and select an appointment within the next 24 hours to ensure timely service.'
        : diagnosticResult.urgency === 'medium'
        ? 'Please review these options and select the most convenient appointment for you.'
        : 'These are suggested maintenance windows. Please select a time that fits your schedule.',
      daysUntilPrimaryAppointment: primaryDaysToAdd,
      safetyMargin: prediction.etaDays - primaryDaysToAdd,
      nextSteps: [
        'User will receive notification with scheduling options',
        'User reviews and selects preferred time slot',
        'System confirms appointment after user approval',
        'Service center is notified of confirmed appointment'
      ]
    };

    console.log('   Urgency:', result.schedulingUrgency);
    console.log('   Primary:', result.primaryRecommendation.date);
    console.log('   Alternatives:', result.alternativeRecommendations.length, 'options');
    console.log('   User approval required: YES');

    return result;

  } catch (error) {
    console.error('❌ Scheduling Agent Error:', error.message);
    throw error;
  }
}

/**
 * Get available service centers (utility function)
 * In production, this would query a database
 */
function getAvailableServiceCenters() {
  return [
    { id: 'SC-001', name: 'Downtown Service Center', location: 'Downtown', specialties: ['All makes'] },
    { id: 'SC-002', name: 'North Auto Care', location: 'North District', specialties: ['Electric vehicles', 'Tesla'] },
    { id: 'SC-003', name: 'Express Auto Repair', location: 'West Side', specialties: ['Emergency service'] },
    { id: 'SC-004', name: 'Premium Motors Service', location: 'East District', specialties: ['Luxury vehicles', 'Ford', 'Toyota'] }
  ];
}

module.exports = {
  schedulingAgent,
  createSaveSchedulingSuggestionTool,
  getAvailableServiceCenters
};
