import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import queueRoutes from './routes/queue.js';
import staffRoutes from './routes/staff.js';
import adminRoutes from './routes/admin.js';
import windowRoutes from './routes/windows.js';
import categoryRoutes from './routes/categories.js';
import settingsRoutes from './routes/settings.js';
import staffProfileRoutes from './routes/staffProfile.js';
import ttsRoutes from './routes/tts.js';
import { getHourInManila, isPastStaffLogoutTime } from './middleware/auth.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5002;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Explicit OPTIONS handler for CORS preflight (so preflight never 404s)
app.options('/api/*', (req, res) => {
  res.sendStatus(204);
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
app.use('/api/tts', ttsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug: verify staff logout time logic (remove after troubleshooting)
app.get('/api/debug/staff-logout', (req, res) => {
  const hour = getHourInManila();
  const hideStaff = isPastStaffLogoutTime();
  res.json({
    manilaHour: hour,
    hideStaff,
    message: hideStaff ? 'Staff cards should be hidden on monitor' : 'Staff cards should be visible',
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
