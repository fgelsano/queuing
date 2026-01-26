import express from 'express';
import prisma from '../db.js';

const router = express.Router();

// Get all active windows (public)
router.get('/active', async (req, res) => {
  try {
    const windows = await prisma.window.findMany({
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
    });

    const windowsData = windows.map((window) => ({
      id: window.id,
      label: window.label,
      staff: window.assignments[0]?.staff || null,
      currentServing: window.queueEntries[0] || null,
    }));

    res.json({ windows: windowsData });
  } catch (error) {
    console.error('Get active windows error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
