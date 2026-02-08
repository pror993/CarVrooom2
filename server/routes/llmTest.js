const express = require('express');
const router = express.Router();
const { llm } = require('../agents/llm');

// @desc    Test LLM with a simple prompt
// @route   POST /api/llm/test
// @access  Public (temporary test route)
router.post('/test', async (req, res) => {
  try {
    const { prompt } = req.body;

    // Validate prompt
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a prompt in the request body'
      });
    }

    // Check prompt length
    if (prompt.length > 2000) {
      return res.status(400).json({
        success: false,
        error: 'Prompt too long. Maximum 2000 characters.'
      });
    }

    console.log('🤖 LLM Test Route - Processing prompt...');
    console.log('Prompt:', prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''));

    // Send prompt to LLM
    const startTime = Date.now();
    const response = await llm.invoke(prompt);
    const duration = Date.now() - startTime;

    console.log('✅ LLM Response received in', duration, 'ms');

    // Return response
    res.status(200).json({
      success: true,
      data: {
        prompt: prompt,
        response: response.content,
        model: 'llama3',
        temperature: 0,
        duration: `${duration}ms`
      }
    });

  } catch (error) {
    console.error('❌ LLM Test Route Error:', error);

    // Check for Ollama connection errors
    if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch')) {
      return res.status(503).json({
        success: false,
        error: 'Ollama server is not running. Start it with: ollama serve',
        details: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to process LLM request',
      details: error.message
    });
  }
});

// @desc    Get LLM configuration info
// @route   GET /api/llm/test
// @access  Public
router.get('/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'LLM test endpoint is active',
    instructions: {
      method: 'POST',
      endpoint: '/api/llm/test',
      body: {
        prompt: 'Your prompt here'
      }
    },
    configuration: {
      model: 'llama3',
      temperature: 0,
      deterministic: true
    },
    examples: [
      {
        prompt: 'What is 2 + 2?',
        expected: 'Simple arithmetic response'
      },
      {
        prompt: 'Analyze vehicle sensor data: engine temp 110C, oil pressure 30 PSI. Return JSON with rootCause and severity.',
        expected: 'JSON formatted diagnostic response'
      }
    ]
  });
});

module.exports = router;
