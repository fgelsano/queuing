import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import prisma from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directories exist
const logoUploadsDir = path.join(__dirname, '..', 'uploads', 'logos');
const soundUploadsDir = path.join(__dirname, '..', 'uploads', 'sounds');

if (!fs.existsSync(logoUploadsDir)) {
  fs.mkdirSync(logoUploadsDir, { recursive: true });
}
if (!fs.existsSync(soundUploadsDir)) {
  fs.mkdirSync(soundUploadsDir, { recursive: true });
}

// Configure multer for logo file uploads
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, logoUploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const logoUpload = multer({
  storage: logoStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|svg|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  },
});

// Configure multer for ding sound uploads
const soundStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, soundUploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'ding-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const soundUpload = multer({
  storage: soundStorage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit for ding sound
  },
  fileFilter: (req, file, cb) => {
    // Allow common audio formats, plus MP4 containers (often used for short audio clips)
    const allowedTypes = /mp3|mpeg|wav|ogg|m4a|aac|mp4/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = /audio|video\/mp4/.test(file.mimetype.toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed! (mp3, wav, ogg, m4a, aac, mp4)'));
    }
  },
});

// Get site title (public - used next to/below logo on all pages)
router.get('/site-title', async (req, res) => {
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: 'site_title' },
    });
    const siteTitle = setting?.value?.trim() || null;
    res.json({ siteTitle });
  } catch (error) {
    console.error('Get site title error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Set site title (admin only)
router.post('/site-title', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { siteTitle } = req.body ?? {};
    const value = typeof siteTitle === 'string' ? siteTitle.trim() : '';
    await prisma.settings.upsert({
      where: { key: 'site_title' },
      update: { value },
      create: { key: 'site_title', value },
    });
    res.json({ success: true, siteTitle: value || null });
  } catch (error) {
    console.error('Set site title error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get logo (public endpoint - no auth required)
router.get('/logo', async (req, res) => {
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: 'logo_url' },
    });

    if (setting && setting.value) {
      res.json({ logoUrl: setting.value });
    } else {
      res.json({ logoUrl: null });
    }
  } catch (error) {
    console.error('Get logo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload logo (admin only)
router.post('/logo', authenticateToken, requireAdmin, logoUpload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Delete old logo if exists
    const oldSetting = await prisma.settings.findUnique({
      where: { key: 'logo_url' },
    });

    if (oldSetting && oldSetting.value) {
      const oldLogoPath = path.join(__dirname, '..', oldSetting.value.replace('/uploads/', 'uploads/'));
      if (fs.existsSync(oldLogoPath)) {
        fs.unlinkSync(oldLogoPath);
      }
    }

    // Save new logo URL - use absolute path from server root
    const logoUrl = `/uploads/logos/${req.file.filename}`;
    
    await prisma.settings.upsert({
      where: { key: 'logo_url' },
      update: { value: logoUrl },
      create: { key: 'logo_url', value: logoUrl },
    });

    console.log('Logo uploaded successfully:', logoUrl);
    res.json({ success: true, logoUrl });
  } catch (error) {
    console.error('Upload logo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get ding sound URL (public - used by monitoring page)
router.get('/ding-sound', async (req, res) => {
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: 'ding_sound_url' },
    });

    if (setting && setting.value) {
      res.json({ dingSoundUrl: setting.value });
    } else {
      res.json({ dingSoundUrl: null });
    }
  } catch (error) {
    console.error('Get ding sound error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload ding sound (admin only)
router.post('/ding-sound', authenticateToken, requireAdmin, soundUpload.single('sound'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Delete old ding sound if exists
    const oldSetting = await prisma.settings.findUnique({
      where: { key: 'ding_sound_url' },
    });

    if (oldSetting && oldSetting.value) {
      const oldSoundPath = path.join(__dirname, '..', oldSetting.value.replace('/uploads/', 'uploads/'));
      if (fs.existsSync(oldSoundPath)) {
        fs.unlinkSync(oldSoundPath);
      }
    }

    const dingSoundUrl = `/uploads/sounds/${req.file.filename}`;

    await prisma.settings.upsert({
      where: { key: 'ding_sound_url' },
      update: { value: dingSoundUrl },
      create: { key: 'ding_sound_url', value: dingSoundUrl },
    });

    console.log('Ding sound uploaded successfully:', dingSoundUrl);
    res.json({ success: true, dingSoundUrl });
  } catch (error) {
    console.error('Upload ding sound error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete ding sound (admin only)
router.delete('/ding-sound', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: 'ding_sound_url' },
    });

    if (setting && setting.value) {
      const soundPath = path.join(__dirname, '..', setting.value.replace('/uploads/', 'uploads/'));
      if (fs.existsSync(soundPath)) {
        fs.unlinkSync(soundPath);
      }

      await prisma.settings.delete({
        where: { key: 'ding_sound_url' },
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete ding sound error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete logo (admin only)
router.delete('/logo', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: 'logo_url' },
    });

    if (setting && setting.value) {
      const logoPath = path.join(__dirname, '..', setting.value.replace('/uploads/', 'uploads/'));
      if (fs.existsSync(logoPath)) {
        fs.unlinkSync(logoPath);
      }

      await prisma.settings.delete({
        where: { key: 'logo_url' },
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete logo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get video source (public - used by monitoring page)
router.get('/video-source', async (req, res) => {
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: 'video_source' },
    });
    let source = setting?.value || 'youtube';
    if (source === 'server') source = 'youtube'; // migrate legacy
    res.json({ videoSource: source });
  } catch (error) {
    console.error('Get video source error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Set video source (admin only)
router.post('/video-source', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { videoSource } = req.body;
    if (!['local', 'youtube'].includes(videoSource)) {
      return res.status(400).json({ error: 'Video source must be "local" or "youtube"' });
    }
    await prisma.settings.upsert({
      where: { key: 'video_source' },
      update: { value: videoSource },
      create: { key: 'video_source', value: videoSource },
    });
    res.json({ success: true, videoSource });
  } catch (error) {
    console.error('Set video source error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get default video volume (0–100, public - used by monitoring page)
router.get('/video-volume', async (req, res) => {
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: 'video_volume_percent' },
    });
    let value = 1;
    if (setting?.value != null) {
      const parsed = parseInt(String(setting.value), 10);
      if (!Number.isNaN(parsed)) {
        value = Math.max(0, Math.min(100, parsed));
      }
    }
    res.json({ videoVolumePercent: value });
  } catch (error) {
    console.error('Get video volume error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Set default video volume (admin only)
router.post('/video-volume', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { videoVolumePercent } = req.body || {};
    const num = Number(videoVolumePercent);
    if (!Number.isFinite(num)) {
      return res.status(400).json({ error: 'Video volume must be a number between 0 and 100.' });
    }
    const clamped = Math.max(0, Math.min(100, Math.round(num)));
    await prisma.settings.upsert({
      where: { key: 'video_volume_percent' },
      update: { value: String(clamped) },
      create: { key: 'video_volume_percent', value: String(clamped) },
    });
    res.json({ success: true, videoVolumePercent: clamped });
  } catch (error) {
    console.error('Set video volume error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get YouTube playlist (public - used by monitoring page)
router.get('/youtube-playlist', async (req, res) => {
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: 'youtube_playlist' },
    });
    let urls = [];
    if (setting && setting.value) {
      try {
        urls = JSON.parse(setting.value);
        if (!Array.isArray(urls)) urls = [];
      } catch (_) {
        urls = [];
      }
    }
    res.json({ urls: urls.filter((u) => u && typeof u === 'string' && u.trim()) });
  } catch (error) {
    console.error('Get YouTube playlist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Set YouTube playlist (admin only)
router.post('/youtube-playlist', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { urls } = req.body;
    if (!Array.isArray(urls)) {
      return res.status(400).json({ error: 'URLs must be an array' });
    }
    const cleaned = urls
      .map((u) => (typeof u === 'string' ? u.trim() : ''))
      .filter((u) => u);
    await prisma.settings.upsert({
      where: { key: 'youtube_playlist' },
      update: { value: JSON.stringify(cleaned) },
      create: { key: 'youtube_playlist', value: JSON.stringify(cleaned) },
    });
    res.json({ success: true, urls: cleaned });
  } catch (error) {
    console.error('Set YouTube playlist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get staff idle minutes (admin only - used for online/offline indicator)
router.get('/staff-idle-minutes', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: 'staff_idle_minutes' },
    });
    let value = 5;
    if (setting?.value != null) {
      const parsed = parseInt(String(setting.value), 10);
      if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 120) {
        value = parsed;
      }
    }
    res.json({ staffIdleMinutes: value });
  } catch (error) {
    console.error('Get staff idle minutes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Set staff idle minutes (admin only)
router.post('/staff-idle-minutes', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { staffIdleMinutes: raw } = req.body || {};
    const num = Number(raw);
    if (!Number.isFinite(num) || num < 1 || num > 120) {
      return res.status(400).json({ error: 'Staff idle minutes must be a number between 1 and 120.' });
    }
    const value = Math.round(num);
    await prisma.settings.upsert({
      where: { key: 'staff_idle_minutes' },
      update: { value: String(value) },
      create: { key: 'staff_idle_minutes', value: String(value) },
    });
    res.json({ success: true, staffIdleMinutes: value });
  } catch (error) {
    console.error('Set staff idle minutes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get TTS announcement template (public - used by monitoring page)
router.get('/tts-announcement', async (req, res) => {
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: 'tts_announcement_template' },
    });

    const defaultTemplate =
      'Window {{window}} will now serve queue number {{queueNumber}}{{clientNamePart}}.';

    res.json({
      template: setting?.value || defaultTemplate,
    });
  } catch (error) {
    console.error('Get TTS announcement template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Set TTS announcement template (admin only)
router.post('/tts-announcement', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { template } = req.body || {};

    if (!template || typeof template !== 'string' || !template.trim()) {
      return res.status(400).json({ error: 'Template is required' });
    }

    const trimmed = template.trim();

    await prisma.settings.upsert({
      where: { key: 'tts_announcement_template' },
      update: { value: trimmed },
      create: { key: 'tts_announcement_template', value: trimmed },
    });

    console.log('TTS announcement template updated successfully');

    res.json({
      success: true,
      template: trimmed,
    });
  } catch (error) {
    console.error('Set TTS announcement template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get TTS voices configuration (admin only)
router.get('/tts-voices', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const voicesSetting = await prisma.settings.findUnique({
      where: { key: 'tts_voices_json' },
    });
    const activeVoiceSetting = await prisma.settings.findUnique({
      where: { key: 'tts_active_voice_id' },
    });

    let voices = [];
    if (voicesSetting && voicesSetting.value) {
      try {
        voices = JSON.parse(voicesSetting.value);
      } catch {
        voices = [];
      }
    }

    const activeVoiceId = activeVoiceSetting?.value || null;

    res.json({
      voices,
      activeVoiceId,
    });
  } catch (error) {
    console.error('Get TTS voices error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Set TTS voices configuration (admin only)
router.post('/tts-voices', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { voices, activeVoiceId } = req.body || {};

    if (!Array.isArray(voices)) {
      return res.status(400).json({ error: 'Voices must be an array' });
    }

    // Normalize and limit to 3 voices
    const normalizedVoices = voices
      .map((v) => ({
        id: typeof v.id === 'string' ? v.id.trim() : '',
        name: typeof v.name === 'string' ? v.name.trim() : '',
      }))
      .filter((v) => v.id)
      .slice(0, 3);

    if (normalizedVoices.length === 0) {
      return res.status(400).json({ error: 'At least one voice ID is required' });
    }

    // Validate activeVoiceId
    const activeId = typeof activeVoiceId === 'string' ? activeVoiceId.trim() : '';
    const resolvedActiveId =
      activeId && normalizedVoices.some((v) => v.id === activeId)
        ? activeId
        : normalizedVoices[0].id;

    await prisma.settings.upsert({
      where: { key: 'tts_voices_json' },
      update: { value: JSON.stringify(normalizedVoices) },
      create: { key: 'tts_voices_json', value: JSON.stringify(normalizedVoices) },
    });

    await prisma.settings.upsert({
      where: { key: 'tts_active_voice_id' },
      update: { value: resolvedActiveId },
      create: { key: 'tts_active_voice_id', value: resolvedActiveId },
    });

    console.log('TTS voices updated successfully');

    res.json({
      success: true,
      voices: normalizedVoices,
      activeVoiceId: resolvedActiveId,
    });
  } catch (error) {
    console.error('Set TTS voices error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset all queue stats (keeps staff, windows, categories) - admin only
router.post('/reset-queue-stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await prisma.servingLog.deleteMany({});
    await prisma.queueEntry.deleteMany({});
    await prisma.dailyCounter.deleteMany({});
    res.json({ success: true, message: 'Queue stats reset successfully' });
  } catch (error) {
    console.error('Reset queue stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
