/**
 * Master Agent - Workflow Orchestrator
 * 
 * The Master Agent analyzes predictions and vehicle data to determine:
 * - Severity level of the issue
 * - Which worker agents to invoke
 * - Customer contact strategy
 * - Workflow type
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
const masterAgentPrompt = PromptTemplate.fromTemplate(`You are a Master Orchestrator Agent for a vehicle predictive maintenance system.

Your role is to analyze vehicle predictions and determine the appropriate workflow and actions.

## Input Data

### Prediction:
- Vehicle ID: {vehicleId}
- Prediction Type: {predictionType}
- Confidence: {confidence}
- ETA Days: {etaDays}
- Signals: {signals}

### Vehicle Information:
- Make/Model: {vehicleMakeModel}
- Year: {vehicleYear}
- Powertrain: {powertrain}
- Average Daily KM: {avgDailyKm}
- Load Pattern: {loadPattern}
- Service History Count: {serviceHistoryCount}
- Last Service: {lastService}
- Owner Preferred Channel: {preferredChannel}

## Your Task

Analyze this data and determine:

1. **Severity**: How serious is this prediction?
   - "low": Minor issue, can wait for scheduled service
   - "medium": Should be addressed within normal timeframe
   - "high": Needs prompt attention to prevent breakdown
   - "critical": Immediate action required to prevent safety risk

2. **Agents to Invoke**: Which worker agents should process this case? (in order)
   You MUST choose from these exact agent names ONLY:
   - "DiagnosticAgent": Analyzes root cause and affected components
   - "SchedulerAgent": Provides service appointment suggestions for user approval
   - "CommunicationAgent": Generates customer notification messages
   
   **IMPORTANT**: Use ONLY these exact agent names. Do not make up new agent names.
   **NOTE**: SchedulerAgent provides suggestions only - user must approve appointments.

3. **Customer Contact**: When should we contact the vehicle owner?
   - "none": No immediate contact needed (routine service)
   - "delayed": Contact within 24-48 hours
   - "immediate": Contact within 1-4 hours

4. **Workflow Type**: What kind of workflow is this?
   - "routine_maintenance": Regular scheduled service
   - "predictive_maintenance": Proactive intervention based on prediction
   - "emergency_intervention": Critical issue requiring immediate action
   - "diagnostic_investigation": Further investigation needed

## Decision Factors

Consider these factors in your analysis:
- Prediction confidence and ETA days
- Prediction type (cascade vs single failure)
- Vehicle usage pattern and load
- Time since last service
- Owner's preferred contact channel

{format_instructions}

**CRITICAL**: Respond with a JSON object using EXACTLY these key names (case-sensitive):
{{
  "severity": "low|medium|high|critical",
  "agentsToInvoke": ["Agent1", "Agent2"],
  "customerContact": "none|delayed|immediate",
  "workflowType": "routine_maintenance|predictive_maintenance|emergency_intervention|diagnostic_investigation"
}}

Respond ONLY with the JSON object, no additional text.`);

/**
 * Master Agent - Orchestrates workflow based on prediction and vehicle data
 * 
 * @param {Object} prediction - Prediction event from database
 * @param {Object} vehicle - Vehicle information from database
 * @returns {Promise<Object>} Orchestration decision
 */
async function masterAgent(prediction, vehicle) {
  try {
    console.log('🤖 Master Agent: Analyzing prediction and vehicle data...');

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
      preferredChannel: vehicle.owner.preferredChannel,
      
      // Format instructions for JSON output
      format_instructions: outputParser.getFormatInstructions()
    };

    // Create separate chains: one without parser, one with
    const chainWithoutParser = masterAgentPrompt.pipe(llm);

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
          console.error('❌ Master Agent Error (all retries failed):', error.message);
          throw error;
        }
        
        // Wait before retrying (with exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
      }
    }

    console.log('✅ Master Agent: Analysis complete');
    console.log('   Raw result:', JSON.stringify(result));
    console.log('   Severity:', result.severity);
    console.log('   Agents to invoke:', result.agentsToInvoke?.join(', '));
    console.log('   Customer contact:', result.customerContact);
    console.log('   Workflow type:', result.workflowType);

    // Validate output structure
    if (!result.severity || !result.agentsToInvoke || !result.customerContact || !result.workflowType) {
      console.log('❌ Master Agent Error: Master Agent output missing required fields');
      console.log('   Result object keys:', Object.keys(result));
      throw new Error('Master Agent output missing required fields');
    }

    // Validate severity enum
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    if (!validSeverities.includes(result.severity)) {
      throw new Error(`Invalid severity: ${result.severity}`);
    }

    // Validate customerContact enum
    const validContactStrategies = ['none', 'delayed', 'immediate'];
    if (!validContactStrategies.includes(result.customerContact)) {
      throw new Error(`Invalid customerContact: ${result.customerContact}`);
    }

    // Validate workflowType enum
    const validWorkflowTypes = [
      'routine_maintenance',
      'predictive_maintenance',
      'emergency_intervention',
      'diagnostic_investigation'
    ];
    if (!validWorkflowTypes.includes(result.workflowType)) {
      throw new Error(`Invalid workflowType: ${result.workflowType}`);
    }

    // Validate agentsToInvoke is an array
    if (!Array.isArray(result.agentsToInvoke)) {
      throw new Error('agentsToInvoke must be an array');
    }

    return result;

  } catch (error) {
    console.error('❌ Master Agent Error:', error.message);
    throw error;
  }
}

/**
 * Get Master Agent prompt for debugging/testing
 */
async function getMasterAgentPrompt(prediction, vehicle) {
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
    preferredChannel: vehicle.owner.preferredChannel,
    format_instructions: outputParser.getFormatInstructions()
  };

  return await masterAgentPrompt.format(promptInput);
}

module.exports = {
  masterAgent,
  getMasterAgentPrompt
};
