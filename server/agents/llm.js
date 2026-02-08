/**
 * LLM Configuration for Agentic AI System
 * 
 * This module initializes and exports a reusable ChatOllama instance
 * configured for local LLM inference using Ollama.
 * 
 * Model: llama3
 * Temperature: 0 (deterministic output for consistent agent behavior)
 */

const { ChatOllama } = require('@langchain/ollama');

// Initialize ChatOllama with llama3 model
const llm = new ChatOllama({
  model: 'llama3',
  temperature: 0,
  // Optional: Configure base URL if Ollama is running on a different host/port
  // baseUrl: 'http://localhost:11434',
});

/**
 * Reusable LLM instance for all agents
 * 
 * Usage:
 * ```javascript
 * const { llm } = require('./agents/llm');
 * 
 * // Direct invocation
 * const response = await llm.invoke("What is the capital of France?");
 * console.log(response.content);
 * 
 * // With message array
 * const result = await llm.invoke([
 *   { role: 'system', content: 'You are a diagnostic agent.' },
 *   { role: 'user', content: 'Analyze this vehicle data...' }
 * ]);
 * ```
 */
module.exports = { llm };
