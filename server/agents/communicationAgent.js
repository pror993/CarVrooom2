/**
 * Communication Agent - Customer Notification Generator
 * 
 * The Communication Agent generates personalized customer communications based on:
 * - Diagnostic results (risk, urgency, explanation)
 * - Owner preferences (preferred channel)
 * - Severity level
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
const communicationAgentPrompt = PromptTemplate.fromTemplate(`You are a Communication Agent for a vehicle predictive maintenance system.

Your role is to generate personalized customer communications based on diagnostic results, owner preferences, and severity levels.

## Input Data

### Diagnostic Result:
- Summary: {diagnosticSummary}
- Risk Level: {riskLevel}
- Urgency Level: {urgencyLevel}
- Customer Explanation: {customerExplanation}

### Owner Preferences:
- Name: {ownerName}
- Preferred Channel: {preferredChannel}
- Contact: {ownerContact}

### Severity:
- Severity Level: {severity}

### Vehicle Information:
- Make/Model/Year: {vehicleMakeModel} {vehicleYear}
- Vehicle ID: {vehicleId}

## Your Task

Generate a customer communication strategy and message.

### 1. Channel
Select the best communication channel based on urgency and owner preference:
- "voice": Phone call (for critical/high urgency or if owner prefers voice)
- "app": In-app notification/push notification (for medium/low urgency or if owner prefers app)

**Priority Rules:**
- If severity is "critical" → Always use "voice" regardless of preference
- If severity is "high" AND urgency is "critical" → Use "voice"
- Otherwise, respect owner's preferred channel

### 2. Tone
Set the appropriate tone for the message:
- "urgent": Critical issues requiring immediate action (use for critical severity)
- "concerned": Serious issues needing prompt attention (use for high severity)
- "informative": Important updates requiring planning (use for medium severity)
- "routine": Standard maintenance notifications (use for low severity)

### 3. Message Text
Create a personalized message (3-5 sentences) that:
- Addresses the owner by name
- Mentions their specific vehicle
- Explains the issue in simple terms (use the customerExplanation as a base)
- Clearly states what action is needed
- Includes urgency indicators if applicable
- Is appropriate for the selected channel and tone

**Message Guidelines:**
- Voice messages: More conversational, include callback request
- App messages: Concise, actionable, include CTA button suggestion
- Urgent tone: Start with "URGENT:" or "Immediate action required"
- Concerned tone: Emphasize importance without panic
- Informative tone: Balanced, educational
- Routine tone: Friendly, low-pressure

### 4. Fallback Channel
Specify a backup communication method if primary channel fails:
- If primary is "voice" → fallback is "app"
- If primary is "app" → fallback is "voice"

## Decision Matrix

**Critical Severity:**
- Channel: voice
- Tone: urgent
- Message: Start with "URGENT", emphasize immediate action, provide callback number

**High Severity:**
- Channel: voice (if urgency is critical/high) or preferredChannel
- Tone: concerned
- Message: Emphasize importance, suggest scheduling within specific timeframe

**Medium Severity:**
- Channel: preferredChannel (or app if none specified)
- Tone: informative
- Message: Educational, suggest proactive scheduling

**Low Severity:**
- Channel: app (unless owner strongly prefers voice)
- Tone: routine
- Message: Friendly reminder, can wait for next service

{format_instructions}

**CRITICAL**: Respond with a JSON object using EXACTLY these key names (case-sensitive):
{{
  "channel": "voice|app",
  "tone": "urgent|concerned|informative|routine",
  "messageText": "The personalized message for the customer",
  "fallbackChannel": "voice|app"
}}

Respond ONLY with the JSON object, no additional text.`);

/**
 * Communication Agent - Generates customer communication strategy
 * 
 * @param {Object} diagnosticResult - Result from DiagnosticAgent
 * @param {Object} ownerPreferences - Owner contact preferences
 * @param {string} severity - Severity level from MasterAgent
 * @param {Object} vehicle - Vehicle information
 * @returns {Promise<Object>} Communication strategy
 */
async function communicationAgent(diagnosticResult, ownerPreferences, severity, vehicle) {
  try {
    console.log('💬 Communication Agent: Generating customer communication...');

    // Prepare input data for prompt
    const promptInput = {
      // Diagnostic result
      diagnosticSummary: diagnosticResult.summary,
      riskLevel: diagnosticResult.risk,
      urgencyLevel: diagnosticResult.urgency,
      customerExplanation: diagnosticResult.explanationForCustomer,
      
      // Owner preferences
      ownerName: ownerPreferences.name,
      preferredChannel: ownerPreferences.preferredChannel || 'app',
      ownerContact: ownerPreferences.contact,
      
      // Severity
      severity: severity,
      
      // Vehicle information
      vehicleMakeModel: `${vehicle.vehicleInfo.make} ${vehicle.vehicleInfo.model}`,
      vehicleYear: vehicle.vehicleInfo.year,
      vehicleId: vehicle.vehicleId,
      
      // Format instructions for JSON output
      format_instructions: outputParser.getFormatInstructions()
    };

    // Create separate chains: one without parser, one with
    const chainWithoutParser = communicationAgentPrompt.pipe(llm);

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
          console.error('❌ Communication Agent Error (all retries failed):', error.message);
          throw error;
        }
        
        // Wait before retrying (with exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
      }
    }

    console.log('✅ Communication Agent: Strategy generated');
    console.log('   Channel:', result.channel);
    console.log('   Tone:', result.tone);
    console.log('   Message length:', result.messageText?.length, 'characters');

    // Validate output structure
    if (!result.channel || !result.tone || !result.messageText || !result.fallbackChannel) {
      console.log('❌ Communication Agent Error: Output missing required fields');
      console.log('   Result object keys:', Object.keys(result));
      throw new Error('Communication Agent output missing required fields');
    }

    // Validate channel enum
    const validChannels = ['voice', 'app'];
    if (!validChannels.includes(result.channel)) {
      throw new Error(`Invalid channel: ${result.channel}. Must be one of: ${validChannels.join(', ')}`);
    }

    // Validate tone enum
    const validTones = ['urgent', 'concerned', 'informative', 'routine'];
    if (!validTones.includes(result.tone)) {
      throw new Error(`Invalid tone: ${result.tone}. Must be one of: ${validTones.join(', ')}`);
    }

    // Validate fallbackChannel enum
    if (!validChannels.includes(result.fallbackChannel)) {
      throw new Error(`Invalid fallbackChannel: ${result.fallbackChannel}. Must be one of: ${validChannels.join(', ')}`);
    }

    // Validate messageText is not empty
    if (result.messageText.trim().length === 0) {
      throw new Error('Message text cannot be empty');
    }

    // Validate that primary and fallback channels are different
    if (result.channel === result.fallbackChannel) {
      console.log('⚠️  Warning: Primary and fallback channels are the same');
    }

    return result;

  } catch (error) {
    console.error('❌ Communication Agent Error:', error.message);
    throw error;
  }
}

/**
 * Get the communication agent prompt (for debugging/testing)
 * 
 * @param {Object} diagnosticResult - Diagnostic result
 * @param {Object} ownerPreferences - Owner preferences
 * @param {string} severity - Severity level
 * @param {Object} vehicle - Vehicle information
 * @returns {Promise<string>} Formatted prompt
 */
async function getCommunicationAgentPrompt(diagnosticResult, ownerPreferences, severity, vehicle) {
  const promptInput = {
    diagnosticSummary: diagnosticResult.summary,
    riskLevel: diagnosticResult.risk,
    urgencyLevel: diagnosticResult.urgency,
    customerExplanation: diagnosticResult.explanationForCustomer,
    ownerName: ownerPreferences.name,
    preferredChannel: ownerPreferences.preferredChannel || 'app',
    ownerContact: ownerPreferences.contact,
    severity: severity,
    vehicleMakeModel: `${vehicle.vehicleInfo.make} ${vehicle.vehicleInfo.model}`,
    vehicleYear: vehicle.vehicleInfo.year,
    vehicleId: vehicle.vehicleId,
    format_instructions: outputParser.getFormatInstructions()
  };

  return await communicationAgentPrompt.format(promptInput);
}

module.exports = {
  communicationAgent,
  getCommunicationAgentPrompt
};
