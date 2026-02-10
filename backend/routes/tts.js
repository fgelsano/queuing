import express from 'express';
import dotenv from 'dotenv';
import prisma from '../db.js';

dotenv.config();

const router = express.Router();

async function getActiveVoiceId() {
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: 'tts_active_voice_id' },
    });
    if (setting && setting.value) {
      return setting.value;
    }
  } catch (error) {
    console.error('Failed to read active TTS voice from settings:', error);
  }
  return process.env.ELEVENLABS_VOICE_ID || null;
}

// POST /api/tts - Generate speech audio for given text using ElevenLabs
router.post('/', async (req, res) => {
  try {
    const { text, voiceId: requestedVoiceId } = req.body || {};

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    const activeVoiceId = await getActiveVoiceId();
    // Use requested voice when provided (e.g. preview); otherwise use active voice
    const voiceId =
      typeof requestedVoiceId === 'string' && requestedVoiceId.trim()
        ? requestedVoiceId.trim()
        : activeVoiceId;

    if (!apiKey || !voiceId) {
      return res.status(500).json({ error: 'TTS is not configured on the server' });
    }

    // Use a modern ElevenLabs model; allow override via env
    const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2';
    // Optional speed control (0.2 = much slower, 1.0 = normal, 2.0 = much faster)
    const speedFromEnv = parseFloat(process.env.ELEVENLABS_SPEED || '0.9');
    const clampedSpeed = Number.isNaN(speedFromEnv)
      ? 1.0
      : Math.min(Math.max(speedFromEnv, 0.2), 2.0);

    const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

    const elevenResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: text.trim(),
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
        },
        generation_config: {
          // Lower than 1.0 slows it down slightly
          speed: clampedSpeed,
        },
      }),
    });

    if (!elevenResponse.ok) {
      const errorText = await elevenResponse.text().catch(() => '');
      console.error('ElevenLabs TTS error:', elevenResponse.status, errorText);

      // Try to surface a meaningful error to the client
      let message = 'Failed to generate speech audio';
      try {
        const parsed = JSON.parse(errorText);
        if (parsed?.detail?.message) {
          message = parsed.detail.message;
        }
      } catch {
        // ignore JSON parse error
      }

      return res.status(500).json({ error: message });
    }

    // Read the audio data into a buffer and send it
    const arrayBuffer = await elevenResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
  } catch (error) {
    console.error('TTS route error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

