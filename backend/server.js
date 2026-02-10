import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import prisma from './db.js';
import authRoutes from './routes/auth.js';
import queueRoutes from './routes/queue.js';
import staffRoutes from './routes/staff.js';
import adminRoutes from './routes/admin.js';
import windowRoutes from './routes/windows.js';
import categoryRoutes from './routes/categories.js';
import videoRoutes from './routes/videos.js';
import settingsRoutes from './routes/settings.js';
import staffProfileRoutes from './routes/staffProfile.js';
import ttsRoutes from './routes/tts.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5002;

// Default videos directory
const DEFAULT_VIDEOS_DIR = path.join(__dirname, 'videos');

// Cache for video directory path to avoid database queries on every request
let cachedVideosDir = DEFAULT_VIDEOS_DIR;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // Cache for 60 seconds

// Helper function to get the configured video folder path
async function getVideosDir(forceRefresh = false) {
  const now = Date.now();
  
  // Return cached value if still valid and not forcing refresh
  if (!forceRefresh && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedVideosDir;
  }
  
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: 'video_folder_path' },
    });

    if (setting && setting.value) {
      cachedVideosDir = setting.value;
      cacheTimestamp = now;
      return cachedVideosDir;
    }
  } catch (error) {
    console.error('Error reading video folder path from settings:', error);
  }
  
  cachedVideosDir = DEFAULT_VIDEOS_DIR;
  cacheTimestamp = now;
  return cachedVideosDir;
}

// Initialize video directory cache on startup (non-blocking)
getVideosDir(true).then(() => {
  console.log('Video directory initialized:', cachedVideosDir);
}).catch((error) => {
  console.error('Error initializing video directory:', error);
  console.log('Using default video directory:', DEFAULT_VIDEOS_DIR);
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve video files dynamically from configured path
app.use('/videos', async (req, res, next) => {
  try {
    const videosDir = await getVideosDir();
    
    // Ensure directory exists
    if (!fs.existsSync(videosDir)) {
      fs.mkdirSync(videosDir, { recursive: true });
    }
    
    // Create static middleware for the configured directory
    const staticMiddleware = express.static(videosDir);
    
    // Call the static middleware
    staticMiddleware(req, res, next);
  } catch (error) {
    console.error('Error serving video file:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    } else {
      next(error);
    }
  }
});

// Serve uploaded files (logos)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/staff/profile', staffProfileRoutes);
// Settings routes (must come before /api/admin to avoid auth middleware)
app.use('/api/admin/settings', settingsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/windows', windowRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/tts', ttsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
