/**
 * Voice API Routes — Sarvam AI STT/TTS proxy
 * 
 * Keeps the API key server-side. The frontend sends audio blobs
 * and receives base64 audio back.
 * 
 * POST /api/voice/stt   — Speech-to-Text (audio file → transcript)
 * POST /api/voice/tts   — Text-to-Speech (text → base64 audio)
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
// Using Node 22's native FormData, Blob, and fetch

const SARVAM_API_KEY = process.env.SARVAM_API_KEY;
const SARVAM_STT_URL = 'https://api.sarvam.ai/speech-to-text';
const SARVAM_TTS_URL = 'https://api.sarvam.ai/text-to-speech';

// Multer — store in memory (audio blobs are small)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
});

// ── Speech-to-Text ──────────────────────────────────────────────
router.post('/stt', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No audio file provided' });
    }

    // Build native FormData for Sarvam (Node 22 has built-in FormData & Blob)
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype || 'audio/webm' });
    const formData = new FormData();
    formData.append('file', blob, req.file.originalname || 'audio.webm');
    formData.append('model', 'saarika:v2.5');
    formData.append('language_code', 'en-IN');

    const response = await fetch(SARVAM_STT_URL, {
      method: 'POST',
      headers: {
        'api-subscription-key': SARVAM_API_KEY,
      },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Sarvam STT error:', response.status, errText);
      return res.status(response.status).json({
        success: false,
        error: `STT failed: ${response.status}`,
        details: errText,
      });
    }

    const data = await response.json();
    res.json({
      success: true,
      transcript: data.transcript || '',
      languageCode: data.language_code,
    });
  } catch (error) {
    console.error('STT proxy error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Text-to-Speech ──────────────────────────────────────────────
router.post('/tts', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: 'Text is required' });
    }

    // Truncate to Sarvam limit (2500 chars for bulbul:v3)
    const truncated = text.slice(0, 2400);

    const response = await fetch(SARVAM_TTS_URL, {
      method: 'POST',
      headers: {
        'api-subscription-key': SARVAM_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: truncated,
        target_language_code: 'en-IN',
        model: 'bulbul:v2',
        speaker: 'anushka',
        pace: 1.1,
        speech_sample_rate: 24000,
        enable_preprocessing: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Sarvam TTS error:', response.status, errText);
      return res.status(response.status).json({
        success: false,
        error: `TTS failed: ${response.status}`,
        details: errText,
      });
    }

    const data = await response.json();
    const audioBase64 = data.audios?.[0] || null;

    if (!audioBase64) {
      return res.status(500).json({ success: false, error: 'No audio returned from TTS' });
    }

    res.json({
      success: true,
      audioBase64,
      format: 'wav',
    });
  } catch (error) {
    console.error('TTS proxy error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
