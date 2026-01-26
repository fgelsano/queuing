import express from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../db.js';
import { generateQueueNumber } from '../utils/queueNumber.js';

const router = express.Router();

// Helper function to auto-resolve old NOW_SERVING entries
async function autoResolveOldServingEntries() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all entries that are still in NOW_SERVING status but were created before today
    const oldServingEntries = await prisma.queueEntry.findMany({
      where: {
        status: 'NOW_SERVING',
        createdAt: { lt: today },
      },
    });

    if (oldServingEntries.length > 0) {
      // Update them to SERVED status
      await prisma.queueEntry.updateMany({
        where: {
          status: 'NOW_SERVING',
          createdAt: { lt: today },
        },
        data: {
          status: 'SERVED',
          servedAt: new Date(), // Set servedAt to now
        },
      });

      console.log(`Auto-resolved ${oldServingEntries.length} old serving entries to SERVED status`);
    }
  } catch (error) {
    console.error('Error auto-resolving old serving entries:', error);
    // Don't throw - this is a background cleanup task
  }
}

// Create queue entry (public, no auth required)
router.post('/join', [
  body('clientName').notEmpty().withMessage('Client name is required'),
  body('clientType').isIn(['REGULAR', 'SENIOR_CITIZEN', 'PWD', 'PREGNANT']).withMessage('Invalid client type'),
  body('categoryId').notEmpty().withMessage('Category is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { clientName, clientType, categoryId, subCategoryId } = req.body;

    // Verify category exists
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Verify subcategory if provided
    if (subCategoryId) {
      const subCategory = await prisma.subCategory.findUnique({
        where: { id: subCategoryId },
      });

      if (!subCategory || subCategory.categoryId !== categoryId) {
        return res.status(400).json({ error: 'Invalid subcategory' });
      }
    }

    // Generate queue number
    const queueNumber = await generateQueueNumber();

    // Create queue entry
    const queueEntry = await prisma.queueEntry.create({
      data: {
        queueNumber,
        clientName,
        clientType,
        categoryId,
        subCategoryId: subCategoryId || null,
        status: 'WAITING',
      },
      include: {
        category: true,
        subCategory: true,
      },
    });

    res.json({
      queueEntry: {
        ...queueEntry,
        date: new Date().toISOString().split('T')[0],
      },
    });
  } catch (error) {
    console.error('Queue join error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get queue entry by number (public)
router.get('/:queueNumber', async (req, res) => {
  try {
    const { queueNumber } = req.params;

    const queueEntry = await prisma.queueEntry.findUnique({
      where: { queueNumber },
      include: {
        category: true,
        subCategory: true,
        window: {
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
            },
          },
        },
      },
    });

    if (!queueEntry) {
      return res.status(404).json({ error: 'Queue entry not found' });
    }

    res.json({ queueEntry });
  } catch (error) {
    console.error('Get queue entry error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all active windows with current serving info (public)
router.get('/public/windows', async (req, res) => {
  try {
    // Auto-resolve old serving entries before querying
    await autoResolveOldServingEntries();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

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
          where: { 
            status: 'NOW_SERVING',
            createdAt: { gte: today }, // Only today's entries
          },
          take: 1,
          include: {
            category: true,
            subCategory: true,
          },
        },
      },
    });

    const windowsData = windows.map(window => ({
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

// Get queue statistics (public)
router.get('/public/stats', async (req, res) => {
  try {
    // Auto-resolve old serving entries before querying
    await autoResolveOldServingEntries();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const waitingCount = await prisma.queueEntry.count({
      where: {
        status: 'WAITING',
        createdAt: { gte: today },
      },
    });

    const servingCount = await prisma.queueEntry.count({
      where: {
        status: 'NOW_SERVING',
        createdAt: { gte: today },
      },
    });

    res.json({
      waiting: waitingCount,
      serving: servingCount,
    });
  } catch (error) {
    console.error('Get queue stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get people ahead of a specific queue number
router.get('/:queueNumber/ahead', async (req, res) => {
  try {
    const { queueNumber } = req.params;

    const queueEntry = await prisma.queueEntry.findUnique({
      where: { queueNumber },
    });

    if (!queueEntry) {
      return res.status(404).json({ error: 'Queue entry not found' });
    }

    // Count entries that joined before this one and are still waiting
    const peopleAhead = await prisma.queueEntry.count({
      where: {
        status: { in: ['WAITING', 'NOW_SERVING'] },
        joinedAt: { lt: queueEntry.joinedAt },
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    });

    res.json({ peopleAhead });
  } catch (error) {
    console.error('Get people ahead error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
