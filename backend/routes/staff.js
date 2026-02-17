import express from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../db.js';
import { authenticateToken, requireStaff } from '../middleware/auth.js';

const router = express.Router();

async function enrichQueueEntryWithConcerns(entry) {
  let catIds = [];
  try {
    catIds = entry.concernCategoryIds ? JSON.parse(entry.concernCategoryIds) : (entry.categoryId ? [entry.categoryId] : []);
  } catch { catIds = [entry.categoryId]; }
  let subIds = [];
  try {
    subIds = entry.concernSubCategoryIds ? JSON.parse(entry.concernSubCategoryIds) : (entry.subCategoryId ? [entry.subCategoryId] : []);
  } catch { subIds = entry.subCategoryId ? [entry.subCategoryId] : []; }
  const concernCategories = catIds.length > 0 ? await prisma.category.findMany({ where: { id: { in: catIds } }, orderBy: { name: 'asc' } }) : [];
  const concernSubCategories = subIds.length > 0 ? await prisma.subCategory.findMany({ where: { id: { in: subIds } }, include: { category: true } }) : [];
  return { ...entry, concernCategories, concernSubCategories };
}

router.use(authenticateToken);
router.use(requireStaff);

// Staff logout - clears lastSeenAt so they show as Offline immediately
router.post('/logout', async (req, res) => {
  try {
    const staffId = req.user.id;
    await prisma.staff.update({ where: { id: staffId }, data: { lastSeenAt: null } });
    res.json({ success: true });
  } catch (error) {
    console.error('Staff logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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

// Get staff dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    const staffId = req.user.id;
    // Update last seen for online indicator (fire-and-forget to avoid adding latency)
    void prisma.staff.update({ where: { id: staffId }, data: { lastSeenAt: new Date() } }).catch(() => {});

    // Auto-resolve old serving entries before querying
    await autoResolveOldServingEntries();

    // Get current window assignment
    const windowAssignment = await prisma.windowAssignment.findFirst({
      where: {
        staffId,
        isActive: true,
      },
      include: {
        window: true,
        staff: {
          select: {
            id: true,
            name: true,
            profilePicture: true,
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    if (!windowAssignment) {
      // In older Prisma schema on production, QueueEntry might not have skippedByStaffId
      // To stay compatible, just count all SKIPPED entries for today instead of per-staff
      const totalSkippedNoWindow = await prisma.queueEntry.count({
        where: {
          status: 'SKIPPED',
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      });
      return res.json({
        window: null,
        queue: [],
        stats: { totalServed: 0, totalSkipped: totalSkippedNoWindow },
      });
    }

    const windowId = windowAssignment.windowId;

    // Get staff specializations
    const specializations = await prisma.staffCategory.findMany({
      where: { staffId },
      include: { category: true },
    });

    const categoryIds = specializations.length > 0
      ? specializations.map(s => s.categoryId)
      : []; // If no specializations, staff can handle all categories

    // Debug logging
    console.log(`Staff ${staffId} - Specializations: ${categoryIds.length > 0 ? categoryIds.join(', ') : 'All categories'}`);

    // Get today's date for filtering
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get queue entries for this window
    // First get all waiting entries that match the window's category filter
    const allWaiting = await prisma.queueEntry.findMany({
      where: {
        status: 'WAITING',
        windowId: null, // Not yet assigned to any window
        createdAt: { gte: today }, // Only today's entries
        ...(categoryIds.length > 0 ? { categoryId: { in: categoryIds } } : {}),
      },
      include: {
        category: true,
        subCategory: true,
      },
      orderBy: [
        { clientType: 'asc' }, // Priority clients first (enum order)
        { joinedAt: 'asc' }, // Then FIFO
      ],
    });

    // Get entries already assigned to this window (including those being served)
    const windowEntries = await prisma.queueEntry.findMany({
      where: {
        windowId,
        status: { in: ['WAITING', 'NOW_SERVING'] },
        createdAt: { gte: today }, // Only today's entries
      },
      include: {
        category: true,
        subCategory: true,
      },
      orderBy: [
        { clientType: 'asc' },
        { joinedAt: 'asc' },
      ],
    });

    // Combine: window entries first, then unassigned waiting entries
    const combined = [...windowEntries, ...allWaiting];
    const queueEntries = await Promise.all(combined.map(enrichQueueEntryWithConcerns));

    // Debug logging
    console.log(`Staff ${staffId} - Window entries: ${windowEntries.length}, Unassigned waiting: ${allWaiting.length}, Total: ${queueEntries.length}`);

    // Get today's stats (today already defined above)
    const stats = await prisma.servingLog.groupBy({
      by: ['clientType', 'categoryId'],
      where: {
        staffId,
        servedAt: { gte: today },
      },
      _count: true,
    });

    const totalServed = await prisma.servingLog.count({
      where: {
        staffId,
        servedAt: { gte: today },
      },
    });

    const totalSkipped = await prisma.queueEntry.count({
      where: {
        status: 'SKIPPED',
        skippedByStaffId: staffId,
        createdAt: { gte: today },
      },
    });

    res.json({
      window: windowAssignment.window,
      queue: queueEntries,
      stats: {
        totalServed,
        totalSkipped,
        byType: stats.reduce((acc, s) => {
          acc[s.clientType] = (acc[s.clientType] || 0) + s._count;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    console.error('Get staff dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Assign window to staff
router.post('/assign-window', async (req, res) => {
  try {
    const staffId = req.user.id;
    const { windowId } = req.body;

    // Validate staff exists to avoid foreign key issues
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
    });

    if (!staff) {
      console.warn(`Assign window error: staff ${staffId} not found`);
      return res.status(401).json({ error: 'Staff account no longer exists' });
    }

    // Deactivate current assignments.
    // NOTE: On some existing databases the unique constraint
    // (staffId, windowId, isActive) can cause a conflict if we
    // flip isActive from true -> false (because a historical
    // inactive row may already exist). To avoid P2002, we simply
    // delete active assignments instead of toggling the flag.
    await prisma.windowAssignment.deleteMany({
      where: {
        staffId,
        isActive: true,
      },
    });

    // If windowId is null, just deactivate (logout scenario) and clear lastSeenAt
    if (!windowId) {
      await prisma.staff.update({ where: { id: staffId }, data: { lastSeenAt: null } });
      return res.json({ success: true, assignment: null });
    }

    // Validate that the window exists to avoid foreign key errors
    const window = await prisma.window.findUnique({
      where: { id: windowId },
    });

    if (!window) {
      console.warn(`Assign window error: window ${windowId} not found`);
      return res.status(400).json({ error: 'Selected window does not exist. Please refresh and try again.' });
    }

    // Create new assignment
    let assignment;
    try {
      assignment = await prisma.windowAssignment.create({
        data: {
          staffId,
          windowId,
          isActive: true,
        },
        include: {
          window: true,
          staff: {
            select: {
              id: true,
              name: true,
              profilePicture: true,
            },
          },
        },
      });
    } catch (error) {
      // Handle foreign key constraint issues more gracefully
      if (error.code === 'P2003') {
        console.error('Assign window foreign key error:', error);
        return res.status(400).json({
          error:
            'Unable to assign window due to invalid staff or window reference. Please refresh the page and try again.',
        });
      }
      throw error;
    }

    res.json({ assignment });
  } catch (error) {
    console.error('Assign window error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get staff profile (includes current window assignment for profile page)
router.get('/profile', async (req, res) => {
  try {
    const staffId = req.user.id;
    // Update last seen for online indicator (fire-and-forget)
    void prisma.staff.update({ where: { id: staffId }, data: { lastSeenAt: new Date() } }).catch(() => {});

    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: {
        id: true,
        username: true,
        name: true,
        profilePicture: true,
        createdAt: true,
      },
    });

    const windowAssignment = await prisma.windowAssignment.findFirst({
      where: { staffId, isActive: true },
      orderBy: { assignedAt: 'desc' },
      include: { window: true },
    });
    const currentWindow = windowAssignment?.window || null;

    res.json({ staff, currentWindow });
  } catch (error) {
    console.error('Get staff profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update staff profile
router.put('/profile', async (req, res) => {
  try {
    const staffId = req.user.id;
    const { name, profilePicture } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (profilePicture !== undefined) updateData.profilePicture = profilePicture;

    const staff = await prisma.staff.update({
      where: { id: staffId },
      data: updateData,
      select: {
        id: true,
        username: true,
        name: true,
        profilePicture: true,
      },
    });

    res.json({ staff });
  } catch (error) {
    console.error('Update staff profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change staff password
router.post('/profile/change-password', async (req, res) => {
  try {
    const staffId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Get staff and verify current password
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: { password: true },
    });

    if (!staff) {
      return res.status(404).json({ error: 'Staff not found' });
    }

    const isValid = await bcrypt.compare(currentPassword, staff.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash and update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.staff.update({
      where: { id: staffId },
      data: { password: hashedPassword },
    });

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change staff password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start serving a client - atomic claim to prevent race (only one staff can claim)
router.post('/serve/:queueEntryId', async (req, res) => {
  try {
    const staffId = req.user.id;
    const { queueEntryId } = req.params;

    // Get current window
    const windowAssignment = await prisma.windowAssignment.findFirst({
      where: {
        staffId,
        isActive: true,
      },
    });

    if (!windowAssignment) {
      return res.status(400).json({ error: 'No active window assignment' });
    }

    // Atomic update: only claim if still WAITING and unassigned
    const result = await prisma.queueEntry.updateMany({
      where: {
        id: queueEntryId,
        status: 'WAITING',
        windowId: null,
      },
      data: {
        status: 'NOW_SERVING',
        windowId: windowAssignment.windowId,
      },
    });

    if (result.count === 0) {
      return res.status(409).json({
        error: 'Client was already claimed by another window. Please refresh the queue.',
      });
    }

    const queueEntry = await prisma.queueEntry.findUnique({
      where: { id: queueEntryId },
      include: {
        category: true,
        subCategory: true,
      },
    });

    const enriched = await enrichQueueEntryWithConcerns(queueEntry);
    res.json({ queueEntry: enriched });
  } catch (error) {
    console.error('Start serving error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark as served
router.post('/complete/:queueEntryId', async (req, res) => {
  try {
    const staffId = req.user.id;
    const { queueEntryId } = req.params;

    const queueEntry = await prisma.queueEntry.findUnique({
      where: { id: queueEntryId },
      include: {
        category: true,
        subCategory: true,
      },
    });

    if (!queueEntry) {
      return res.status(404).json({ error: 'Queue entry not found' });
    }

    // Calculate duration if serving started
    let duration = null;
    if (queueEntry.status === 'NOW_SERVING') {
      duration = Math.floor((new Date() - queueEntry.updatedAt) / 1000);
    }

    // Update queue entry
    await prisma.queueEntry.update({
      where: { id: queueEntryId },
      data: {
        status: 'SERVED',
        servedAt: new Date(),
      },
    });

    // Create serving log
    const servingLog = await prisma.servingLog.create({
      data: {
        queueEntryId,
        staffId,
        categoryId: queueEntry.categoryId,
        subCategoryId: queueEntry.subCategoryId,
        clientType: queueEntry.clientType,
        duration,
      },
    });

    res.json({ success: true, servingLog });
  } catch (error) {
    console.error('Complete serving error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark as skipped (records staffId for stats)
router.post('/skip/:queueEntryId', async (req, res) => {
  try {
    const staffId = req.user.id;
    const { queueEntryId } = req.params;

    const entry = await prisma.queueEntry.findUnique({
      where: { id: queueEntryId },
    });

    if (!entry) {
      return res.status(404).json({ error: 'Queue entry not found' });
    }

    if (entry.status === 'SKIPPED') {
      return res.status(400).json({ error: 'Entry already skipped' });
    }

    await prisma.queueEntry.update({
      where: { id: queueEntryId },
      data: {
        status: 'SKIPPED',
        skippedByStaffId: staffId,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Skip queue entry error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get staff analytics
router.get('/analytics', async (req, res) => {
  try {
    const staffId = req.user.id;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date();
    start.setHours(0, 0, 0, 0);

    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    // Get serving logs
    const logs = await prisma.servingLog.findMany({
      where: {
        staffId,
        servedAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        category: true,
        subCategory: true,
      },
    });

    // Aggregate stats
    const byCategory = {};
    const bySubCategory = {};
    const byClientType = {};
    let totalDuration = 0;

    logs.forEach(log => {
      // By category
      byCategory[log.category.name] = (byCategory[log.category.name] || 0) + 1;

      // By subcategory
      if (log.subCategory) {
        bySubCategory[log.subCategory.name] = (bySubCategory[log.subCategory.name] || 0) + 1;
      }

      // By client type
      byClientType[log.clientType] = (byClientType[log.clientType] || 0) + 1;

      // Duration
      if (log.duration) {
        totalDuration += log.duration;
      }
    });

    res.json({
      totalServed: logs.length,
      byCategory,
      bySubCategory,
      byClientType,
      averageDuration: logs.length > 0 ? Math.round(totalDuration / logs.length) : 0,
      logs,
    });
  } catch (error) {
    console.error('Get staff analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
