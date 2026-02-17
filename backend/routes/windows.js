import express from 'express';
import prisma from '../db.js';
import { isPastStaffLogoutTime } from '../middleware/auth.js';

const router = express.Router();

// Get all active windows (public)
router.get('/active', async (req, res) => {
  try {
    const [windows, idleSetting] = await Promise.all([
      prisma.window.findMany({
        where: { isActive: true },
        include: {
          assignments: {
            where: { isActive: true },
            include: {
              staff: {
                select: {
                  id: true,
                  name: true,
                  profilePicture: true,
                  lastSeenAt: true,
                },
              },
            },
            take: 1,
            orderBy: { assignedAt: 'desc' },
          },
          queueEntries: {
            where: { status: 'NOW_SERVING' },
            take: 1,
            include: {
              category: true,
              subCategory: true,
            },
          },
        },
      }),
      prisma.settings.findUnique({ where: { key: 'staff_idle_minutes' } }),
    ]);

    const staffIdleMinutes = (() => {
      const v = idleSetting?.value;
      const parsed = v != null ? parseInt(String(v), 10) : NaN;
      return Number.isFinite(parsed) && parsed >= 1 && parsed <= 120 ? parsed : 15;
    })();

    const pastLogoutTime = isPastStaffLogoutTime();
    const idleThresholdMs = staffIdleMinutes * 60 * 1000;
    const now = Date.now();

    const windowsData = windows.map((window) => {
      const assignment = window.assignments[0];
      const rawStaff = assignment?.staff;
      let staff = null;
      if (rawStaff && !pastLogoutTime) {
        const lastSeen = rawStaff.lastSeenAt ? new Date(rawStaff.lastSeenAt).getTime() : 0;
        const isActive = lastSeen >= now - idleThresholdMs;
        if (isActive) {
          const { lastSeenAt: _, ...staffData } = rawStaff;
          staff = staffData;
        }
      }
      return {
        id: window.id,
        label: window.label,
        staff,
        currentServing: window.queueEntries[0] || null,
      };
    });

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({ windows: windowsData });
  } catch (error) {
    console.error('Get active windows error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
