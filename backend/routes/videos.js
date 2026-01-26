import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../db.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default videos directory
const DEFAULT_VIDEOS_DIR = path.join(__dirname, '..', 'videos');

// Helper function to get the configured video folder path
async function getVideosDir() {
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: 'video_folder_path' },
    });

    if (setting && setting.value) {
      return setting.value;
    }
  } catch (error) {
    console.error('Error reading video folder path from settings:', error);
  }
  
  return DEFAULT_VIDEOS_DIR;
}

// Get list of available videos
router.get('/', async (req, res) => {
  try {
    const videosDir = await getVideosDir();
    
    // Check if videos directory exists
    if (!fs.existsSync(videosDir)) {
      // Try to create the directory if it doesn't exist (for default path)
      try {
        fs.mkdirSync(videosDir, { recursive: true });
        return res.json({ videos: [] });
      } catch (mkdirError) {
        // If directory creation fails (e.g., invalid path, permission issue)
        console.error('Failed to create videos directory:', mkdirError);
        return res.json({ videos: [] }); // Return empty array instead of error
      }
    }

    // Check if it's actually a directory
    const stats = fs.statSync(videosDir);
    if (!stats.isDirectory()) {
      console.error('Video path is not a directory:', videosDir);
      return res.json({ videos: [] });
    }

    try {
      const files = fs.readdirSync(videosDir);
      const videoFiles = files.filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return ['.mp4', '.webm', '.ogg', '.mov', '.avi'].includes(ext);
      });

      const videos = videoFiles.map((file) => ({
        filename: file,
        name: path.basename(file, path.extname(file)),
        url: `/videos/${file}`,
      }));

      res.json({ videos });
    } catch (readError) {
      // If readdir fails (e.g., permission issue)
      console.error('Failed to read videos directory:', readError);
      return res.json({ videos: [] });
    }
  } catch (error) {
    console.error('Get videos error:', error);
    // Return empty array instead of error to allow frontend to show message
    res.json({ videos: [] });
  }
});

export default router;
