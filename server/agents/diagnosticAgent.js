/**
 * Diagnostic Agent - Root Cause Analyzer
 * 
 * The Diagnostic Agent analyzes sensor signals and vehicle data to:
 * - Identify root cause of the predicted failure
 * - Assess risk level and urgency
 * - Generate customer-friendly explanations
 * 
 * Uses LangChain PromptTemplate and JsonOutputParser for structured output.
 */

const { PromptTemplate } = require('@langchain/core/prompts');
const { JsonOutputParser } = require('@langchain/core/output_parsers');
const { llm } = require('./llm');
const { jsonrepair } = require('jsonrepair');

// Define the output schema
const outputParser = new JsonOutputParser();

// Create the prompt template
const diagnosticAgentPrompt = PromptTemplate.fromTemplate(`You are a Diagnostic Agent for a vehicle predictive maintenance system.

Your role is to analyze sensor signals and vehicle data to diagnose the root cause of predicted failures and provide customer-friendly explanations.

## Input Data

### Prediction:
- Vehicle ID: {vehicleId}
- Prediction Type: {predictionType}
- Confidence: {confidence}
- ETA Days: {etaDays}
- Sensor Signals: {signals}

### Vehicle Information:
- Make/Model/Year: {vehicleMakeModel} {vehicleYear}
- Powertrain: {powertrain}
- Average Daily KM: {avgDailyKm}
- Load Pattern: {loadPattern}
- Service History Count: {serviceHistoryCount}
- Last Service: {lastService}

## Your Task

Analyze the sensor data and vehicle information to provide a comprehensive diagnostic assessment.

### 1. Summary
Provide a concise technical summary of the issue (1-2 sentences).
Focus on what components are affected and why.

### 2. Risk
Assess the risk level if this issue is not addressed:
- "low": Minor issue, no immediate risk
- "medium": Could lead to reduced performance or efficiency
- "high": Could cause breakdown or significant damage
- "critical": Imminent safety risk or catastrophic failure

### 3. Urgency
Determine how quickly this needs attention:
- "low": Can wait for next scheduled service
- "medium": Should be addressed within 2-4 weeks
- "high": Needs attention within 1 week
- "critical": Requires immediate action (within 24-48 hours)

### 4. Explanation For Customer
Provide a customer-friendly explanation (2-4 sentences) that:
- Explains what's happening in simple terms
- Why it's important to address
- What could happen if ignored
- Avoids technical jargon

## Analysis Guidelines

**For Sensor Signals:**
- Compare actual values vs. thresholds
- Look for patterns (multiple signals above threshold = cascade risk)
- Consider sensor combinations (e.g., high vibration + low oil pressure)

**For Prediction Type:**
- cascade_failure: Multiple systems affected, higher risk
- single_failure: Isolated issue, assess based on component
- degradation: Progressive wear, urgency depends on rate

**For Vehicle Context:**
- High daily usage (>80km/day) = faster progression
- Heavy load pattern = more stress on components
- Recent service = less likely to be maintenance-related
- No recent service = could be maintenance-related

**For ETA Days:**
- <3 days: Critical urgency
- 3-7 days: High urgency
- 8-14 days: Medium urgency
- >14 days: Low urgency

{format_instructions}

**CRITICAL**: Respond with a JSON object using EXACTLY these key names (case-sensitive):
{{
  "summary": "Technical summary of the issue",
  "risk": "low|medium|high|critical",
  "urgency": "low|medium|high|critical",
  "explanationForCustomer": "Customer-friendly explanation"
}}

Respond ONLY with the JSON object, no additional text.`);

/**
 * Diagnostic Agent - Analyzes prediction and vehicle data for root cause
 * 
 * @param {Object} prediction - Prediction event from database
 * @param {Object} vehicle - Vehicle information from database
 * @returns {Promise<Object>} Diagnostic analysis
 */
async function diagnosticAgent(prediction, vehicle) {
  try {
    console.log('🔍 Diagnostic Agent: Analyzing sensor signals and vehicle data...');

    // Prepare input data for prompt
    const promptInput = {
      // Prediction data
      vehicleId: prediction.vehicleId,
      predictionType: prediction.predictionType,
      confidence: prediction.confidence,
      etaDays: prediction.etaDays,
      signals: JSON.stringify(prediction.signals, null, 2),
      
      // Vehicle data
      vehicleMakeModel: `${vehicle.vehicleInfo.make} ${vehicle.vehicleInfo.model}`,
      vehicleYear: vehicle.vehicleInfo.year,
      powertrain: vehicle.vehicleInfo.powertrain,
      avgDailyKm: vehicle.usageProfile.avgDailyKm,
      loadPattern: vehicle.usageProfile.loadPattern,
      serviceHistoryCount: vehicle.serviceHistory?.length || 0,
      lastService: vehicle.serviceHistory?.length > 0 
        ? JSON.stringify(vehicle.serviceHistory[vehicle.serviceHistory.length - 1])
        : 'No service history',
      
      // Format instructions for JSON output
      format_instructions: outputParser.getFormatInstructions()
    };

    // Create separate chains: one without parser, one with
    const chainWithoutParser = diagnosticAgentPrompt.pipe(llm);

    // Execute with retry logic and JSON repair
    let result;
    const maxRetries = 5;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Get raw response from LLM
        const rawResponse = await chainWithoutParser.invoke(promptInput);
        const rawText = rawResponse.content || rawResponse;
        
        // Extract JSON from markdown code blocks if present
        let jsonStr = rawText;
        const jsonMatch = rawText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1];
        }
        
        // Try parsing directly first
        try {
          result = JSON.parse(jsonStr);
          break; // Success!
        } catch (parseError) {
          // Log the problematic JSON for debugging (first attempt only)
          if (attempt === 1) {
            console.log('   📋 Raw JSON (characters 600-800):');
            console.log('   "...' + jsonStr.substring(600, 800) + '..."');
          }
          
          // Try basic JSON repair
          console.log(`   ⚠️  Attempt ${attempt}/${maxRetries} - JSON parse failed, attempting repair...`);
          
          try {
            // Use jsonrepair library for professional JSON repair
            const repairedJson = jsonrepair(jsonStr);
            result = JSON.parse(repairedJson);
            console.log('   ✅ JSON repaired successfully with jsonrepair!');
            break;
          } catch (repairError) {
            // If jsonrepair fails, fall through to next attempt
            throw parseError;
          }
        }
      } catch (error) {
        console.log(`   ⚠️  Attempt ${attempt}/${maxRetries} failed: ${error.message}`);
        
        if (attempt === maxRetries) {
          console.error('❌ Diagnostic Agent Error (all retries failed):', error.message);
          throw error;
        }
        
        // Wait before retrying (with exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
      }
    }

    console.log('✅ Diagnostic Agent: Analysis complete');
    console.log('   Summary:', result.summary?.substring(0, 60) + '...');
    console.log('   Risk:', result.risk);
    console.log('   Urgency:', result.urgency);

    // Validate output structure
    if (!result.summary || !result.risk || !result.urgency || !result.explanationForCustomer) {
      console.log('❌ Diagnostic Agent Error: Output missing required fields');
      console.log('   Result object keys:', Object.keys(result));
      throw new Error('Diagnostic Agent output missing required fields');
    }

    // Validate risk enum
    const validRisks = ['low', 'medium', 'high', 'critical'];
    if (!validRisks.includes(result.risk)) {
      throw new Error(`Invalid risk level: ${result.risk}. Must be one of: ${validRisks.join(', ')}`);
    }

    // Validate urgency enum
    const validUrgencies = ['low', 'medium', 'high', 'critical'];
    if (!validUrgencies.includes(result.urgency)) {
      throw new Error(`Invalid urgency level: ${result.urgency}. Must be one of: ${validUrgencies.join(', ')}`);
    }

    // Validate string fields are not empty
    if (result.summary.trim().length === 0) {
      throw new Error('Summary cannot be empty');
    }
    if (result.explanationForCustomer.trim().length === 0) {
      throw new Error('Customer explanation cannot be empty');
    }

    return result;

  } catch (error) {
    console.error('❌ Diagnostic Agent Error:', error.message);
    throw error;
  }
}

/**
 * Get the diagnostic agent prompt (for debugging/testing)
 * 
 * @param {Object} prediction - Prediction event
 * @param {Object} vehicle - Vehicle information
 * @returns {Promise<string>} Formatted prompt
 */
async function getDiagnosticAgentPrompt(prediction, vehicle) {
  const promptInput = {
    vehicleId: prediction.vehicleId,
    predictionType: prediction.predictionType,
    confidence: prediction.confidence,
    etaDays: prediction.etaDays,
    signals: JSON.stringify(prediction.signals, null, 2),
    vehicleMakeModel: `${vehicle.vehicleInfo.make} ${vehicle.vehicleInfo.model}`,
    vehicleYear: vehicle.vehicleInfo.year,
    powertrain: vehicle.vehicleInfo.powertrain,
    avgDailyKm: vehicle.usageProfile.avgDailyKm,
    loadPattern: vehicle.usageProfile.loadPattern,
    serviceHistoryCount: vehicle.serviceHistory?.length || 0,
    lastService: vehicle.serviceHistory?.length > 0 
      ? JSON.stringify(vehicle.serviceHistory[vehicle.serviceHistory.length - 1])
      : 'No service history',
    format_instructions: outputParser.getFormatInstructions()
  };

  return await diagnosticAgentPrompt.format(promptInput);
}

module.exports = {
  diagnosticAgent,
  getDiagnosticAgentPrompt
};
