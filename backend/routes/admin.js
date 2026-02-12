import express from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import prisma from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

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

router.use(authenticateToken);
router.use(requireAdmin);

// Admin profile (logged-in admin only)
router.get('/profile', async (req, res) => {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.user.id },
      select: { id: true, username: true, name: true, createdAt: true },
    });
    if (!admin) return res.status(404).json({ error: 'Admin not found' });
    res.json({ admin });
  } catch (error) {
    console.error('Get admin profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/profile', [
  body('name').optional(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { name } = req.body;
    if (!req.body.hasOwnProperty('name')) {
      return res.status(400).json({ error: 'No updates provided' });
    }
    const value = typeof name === 'string' ? (name.trim() || null) : null;
    const admin = await prisma.admin.update({
      where: { id: req.user.id },
      data: { name: value },
      select: { id: true, username: true, name: true, createdAt: true },
    });
    res.json({ admin });
  } catch (error) {
    console.error('Update admin profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/profile/change-password', [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { currentPassword, newPassword } = req.body;
    const admin = await prisma.admin.findUnique({
      where: { id: req.user.id },
      select: { password: true },
    });
    if (!admin) return res.status(404).json({ error: 'Admin not found' });
    const valid = await bcrypt.compare(currentPassword, admin.password);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.admin.update({
      where: { id: req.user.id },
      data: { password: hashed },
    });
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Admin change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Staff Management
router.get('/staff', async (req, res) => {
  try {
    const staff = await prisma.staff.findMany({
      include: {
        specializations: {
          include: { category: true },
        },
        windowAssignments: {
          where: { isActive: true },
          include: { window: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ staff });
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/staff', [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('name').notEmpty().withMessage('Name is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password, name, categoryIds, windowIds } = req.body;

    // Check if username exists
    const existing = await prisma.staff.findUnique({
      where: { username },
    });

    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const staff = await prisma.staff.create({
      data: {
        username,
        password: hashedPassword,
        name,
        specializations: categoryIds
          ? {
              create: categoryIds.map((catId) => ({ categoryId: catId })),
            }
          : undefined,
      },
      include: {
        specializations: {
          include: { category: true },
        },
      },
    });

    res.json({ staff });
  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/staff/:id', [
  body('name').optional().notEmpty().withMessage('Name cannot be empty'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name, isActive, categoryIds, password } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Update specializations if provided
    if (categoryIds !== undefined) {
      await prisma.staffCategory.deleteMany({
        where: { staffId: id },
      });

      if (categoryIds.length > 0) {
        await prisma.staffCategory.createMany({
          data: categoryIds.map((catId) => ({
            staffId: id,
            categoryId: catId,
          })),
        });
      }
    }

    const staff = await prisma.staff.update({
      where: { id },
      data: updateData,
      include: {
        specializations: {
          include: { category: true },
        },
        windowAssignments: {
          where: { isActive: true },
          include: { window: true },
        },
      },
    });

    res.json({ staff });
  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete staff
router.delete('/staff/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.staff.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Staff not found' });
    }

    const servingLogCount = await prisma.servingLog.count({
      where: { staffId: id },
    });

    if (servingLogCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete staff with existing serving history. Please deactivate the staff instead.',
      });
    }

    await prisma.staff.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete staff error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset staff password
router.post('/staff/:id/reset-password', [
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { password } = req.body;

    // Check if staff exists
    const staff = await prisma.staff.findUnique({
      where: { id },
    });

    if (!staff) {
      return res.status(404).json({ error: 'Staff not found' });
    }

    // Hash and update password
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.staff.update({
      where: { id },
      data: { password: hashedPassword },
    });

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset staff password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Window Management
router.get('/windows', async (req, res) => {
  try {
    const windows = await prisma.window.findMany({
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
      orderBy: { label: 'asc' },
    });

    res.json({ windows });
  } catch (error) {
    console.error('Get windows error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/windows', [
  body('label').notEmpty().withMessage('Window label is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { label, isActive } = req.body;

    const window = await prisma.window.create({
      data: {
        label,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    res.json({ window });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Window label already exists' });
    }
    console.error('Create window error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/windows/:id', [
  body('label').optional().notEmpty().withMessage('Window label cannot be empty'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { label, isActive } = req.body;

    const updateData = {};
    if (label !== undefined) updateData.label = label;
    if (isActive !== undefined) updateData.isActive = isActive;

    const window = await prisma.window.update({
      where: { id },
      data: updateData,
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
    });

    res.json({ window });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Window label already exists' });
    }
    console.error('Update window error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/windows/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.window.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete window error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Category Management
router.get('/categories', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        subCategories: {
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/categories', [
  body('name').notEmpty().withMessage('Category name is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description } = req.body;

    const category = await prisma.category.create({
      data: {
        name,
        description,
      },
    });

    res.json({ category });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Category name already exists' });
    }
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/categories/:id', [
  body('name').optional().notEmpty().withMessage('Category name cannot be empty'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name, description } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    const category = await prisma.category.update({
      where: { id },
      data: updateData,
      include: {
        subCategories: true,
      },
    });

    res.json({ category });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Category name already exists' });
    }
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.category.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// SubCategory Management
router.post('/categories/:categoryId/subcategories', [
  body('name').notEmpty().withMessage('Subcategory name is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { categoryId } = req.params;
    const { name, description } = req.body;

    const subCategory = await prisma.subCategory.create({
      data: {
        categoryId,
        name,
        description,
      },
    });

    res.json({ subCategory });
  } catch (error) {
    if (error.code === 'P2001') {
      return res.status(400).json({ error: 'Subcategory name already exists for this category' });
    }
    console.error('Create subcategory error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/subcategories/:id', [
  body('name').optional().notEmpty().withMessage('Subcategory name cannot be empty'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name, description } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    const subCategory = await prisma.subCategory.update({
      where: { id },
      data: updateData,
    });

    res.json({ subCategory });
  } catch (error) {
    console.error('Update subcategory error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/subcategories/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.subCategory.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete subcategory error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin Reporting & Analytics
router.get('/reports', async (req, res) => {
  try {
    const { startDate, endDate, categoryId, staffId, windowId, clientType, startHour, endHour } = req.query;

    const start = startDate ? new Date(startDate) : new Date();
    start.setHours(0, 0, 0, 0);

    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    // Handle multiple categoryIds (array)
    const categoryIds = Array.isArray(categoryId) ? categoryId : (categoryId ? [categoryId] : []);
    // Handle multiple staffIds (array)
    const staffIds = Array.isArray(staffId) ? staffId : (staffId ? [staffId] : []);
    // Handle multiple clientTypes (array)
    const clientTypes = Array.isArray(clientType) ? clientType : (clientType ? [clientType] : []);

    const where = {
      servedAt: {
        gte: start,
        lte: end,
      },
    };

    if (categoryIds.length > 0) {
      where.categoryId = { in: categoryIds };
    }
    if (staffIds.length > 0) {
      where.staffId = { in: staffIds };
    }
    if (clientTypes.length > 0) {
      where.clientType = { in: clientTypes };
    }

    // Get serving logs
    const logs = await prisma.servingLog.findMany({
      where,
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            profilePicture: true,
          },
        },
        category: true,
        subCategory: true,
        queueEntry: {
          include: {
            window: true,
          },
        },
      },
      orderBy: { servedAt: 'desc' },
    });

    // Aggregate stats
    const byCategory = {};
    const bySubCategory = {};
    const byClientType = {};
    const byStaff = {};
    const byWindow = {};
    const byHour = {};
    let totalDuration = 0;

    // Filter by peak hours if specified
    let filteredLogs = logs;
    if (startHour !== undefined && startHour !== '') {
      const startHourNum = parseInt(startHour);
      filteredLogs = filteredLogs.filter(log => {
        const hour = new Date(log.servedAt).getHours();
        return hour >= startHourNum;
      });
    }
    if (endHour !== undefined && endHour !== '') {
      const endHourNum = parseInt(endHour);
      filteredLogs = filteredLogs.filter(log => {
        const hour = new Date(log.servedAt).getHours();
        return hour <= endHourNum;
      });
    }

    filteredLogs.forEach((log) => {
      // By category
      byCategory[log.category.name] = (byCategory[log.category.name] || 0) + 1;

      // By subcategory
      if (log.subCategory) {
        bySubCategory[log.subCategory.name] = (bySubCategory[log.subCategory.name] || 0) + 1;
      }

      // By client type
      byClientType[log.clientType] = (byClientType[log.clientType] || 0) + 1;

      // By staff
      byStaff[log.staff.name] = (byStaff[log.staff.name] || 0) + 1;

      // By window
      if (log.queueEntry.window) {
        byWindow[log.queueEntry.window.label] = (byWindow[log.queueEntry.window.label] || 0) + 1;
      }

      // By hour
      const hour = new Date(log.servedAt).getHours();
      byHour[hour] = (byHour[hour] || 0) + 1;

      // Duration
      if (log.duration) {
        totalDuration += log.duration;
      }
    });

    res.json({
      totalServed: filteredLogs.length,
      byCategory,
      bySubCategory,
      byClientType,
      byStaff,
      byWindow,
      byHour,
      averageDuration: filteredLogs.length > 0 ? Math.round(totalDuration / filteredLogs.length) : 0,
      logs: filteredLogs,
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get dashboard summary
router.get('/dashboard', async (req, res) => {
  try {
    // Auto-resolve old serving entries before querying
    await autoResolveOldServingEntries();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalStaff,
      activeStaff,
      totalWindows,
      activeWindows,
      todayQueueEntries,
      todayServed,
      waitingCount,
      servingCount,
    ] = await Promise.all([
      prisma.staff.count(),
      prisma.staff.count({ where: { isActive: true } }),
      prisma.window.count(),
      prisma.window.count({ where: { isActive: true } }),
      prisma.queueEntry.count({ where: { createdAt: { gte: today } } }),
      prisma.servingLog.count({ where: { servedAt: { gte: today } } }),
      prisma.queueEntry.count({ where: { status: 'WAITING', createdAt: { gte: today } } }),
      prisma.queueEntry.count({ where: { status: 'NOW_SERVING', createdAt: { gte: today } } }),
    ]);

    res.json({
      stats: {
        totalStaff,
        activeStaff,
        totalWindows,
        activeWindows,
        todayQueueEntries,
        todayServed,
        waitingCount,
        servingCount,
      },
    });
  } catch (error) {
    console.error('Get admin dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
