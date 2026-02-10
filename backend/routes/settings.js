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

// Get video folder path (admin only)
router.get('/video-folder', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: 'video_folder_path' },
    });

    if (setting && setting.value) {
      res.json({ videoFolderPath: setting.value });
    } else {
      // Return default path if not set
      const defaultPath = path.join(__dirname, '..', 'videos');
      res.json({ videoFolderPath: defaultPath });
    }
  } catch (error) {
    console.error('Get video folder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Set video folder path (admin only)
router.post('/video-folder', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { videoFolderPath } = req.body;

    if (!videoFolderPath || typeof videoFolderPath !== 'string') {
      return res.status(400).json({ error: 'Video folder path is required' });
    }

    // Validate that the path exists and is a directory
    // Normalize the path first to handle both forward and backslashes
    let normalizedInput = path.normalize(videoFolderPath);
    let resolvedPath = normalizedInput;
    
    // If it's a relative path, resolve it relative to the backend directory
    if (!path.isAbsolute(normalizedInput)) {
      resolvedPath = path.join(__dirname, '..', normalizedInput);
    }

    // Normalize again after joining to ensure proper path format for the platform
    resolvedPath = path.normalize(resolvedPath);

    // Check if path exists and is a directory
    if (!fs.existsSync(resolvedPath)) {
      return res.status(400).json({ error: 'The specified folder does not exist' });
    }

    const stats = fs.statSync(resolvedPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'The specified path is not a directory' });
    }

    // Store the absolute path
    await prisma.settings.upsert({
      where: { key: 'video_folder_path' },
      update: { value: resolvedPath },
      create: { key: 'video_folder_path', value: resolvedPath },
    });

    console.log('Video folder path updated successfully:', resolvedPath);
    res.json({ success: true, videoFolderPath: resolvedPath });
  } catch (error) {
    console.error('Set video folder error:', error);
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

export default router;
