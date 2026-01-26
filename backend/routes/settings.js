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

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads', 'logos');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
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
router.post('/logo', authenticateToken, requireAdmin, upload.single('logo'), async (req, res) => {
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

export default router;
