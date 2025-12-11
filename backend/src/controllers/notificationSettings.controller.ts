import { Request, Response, NextFunction, Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { NotificationSettingsService } from '../services/notificationSettings.service';
import { auditLogger } from '../utils/auditLogger';
import { sessionMiddleware } from '../middleware/sessionMiddleware';

// Instantiate service
const notificationSettingsService = new NotificationSettingsService();

// Create Express router
const router = Router();

/**
 * @route   GET /api/notification-settings
 * @desc    Fetch all notification settings for the authenticated user
 * @access  Protected
 */
router.get(
  '/',
  sessionMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized: User not found in session.' });
      }

      const settings = await notificationSettingsService.getUserSettings(userId);
      return res.status(200).json({ settings });
    } catch (error) {
      // Log error and respond
      auditLogger.error('Failed to fetch notification settings', { error, userId: req.user?.id });
      next(error);
    }
  }
);

/**
 * @route   GET /api/notification-settings/device/:deviceId
 * @desc    Fetch notification settings for a specific device
 * @access  Protected
 */
router.get(
  '/device/:deviceId',
  sessionMiddleware,
  param('deviceId').isString().notEmpty(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user?.id;
      const deviceId = req.params.deviceId;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized: User not found in session.' });
      }

      const deviceSettings = await notificationSettingsService.getDeviceSettings(userId, deviceId);
      if (!deviceSettings) {
        return res.status(404).json({ error: 'Device settings not found.' });
      }

      return res.status(200).json({ deviceSettings });
    } catch (error) {
      auditLogger.error('Failed to fetch device notification settings', {
        error,
        userId: req.user?.id,
        deviceId: req.params.deviceId,
      });
      next(error);
    }
  }
);

/**
 * @route   PUT /api/notification-settings/device/:deviceId
 * @desc    Update notification settings for a specific device
 * @access  Protected
 */
router.put(
  '/device/:deviceId',
  sessionMiddleware,
  param('deviceId').isString().notEmpty(),
  body('enabled').isBoolean(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user?.id;
      const deviceId = req.params.deviceId;
      const { enabled } = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized: User not found in session.' });
      }

      const updatedSettings = await notificationSettingsService.updateDeviceSettings(
        userId,
        deviceId,
        { enabled }
      );

      // Audit log
      auditLogger.info('Device notification settings updated', {
        userId,
        deviceId,
        enabled,
      });

      return res.status(200).json({ deviceSettings: updatedSettings });
    } catch (error) {
      auditLogger.error('Failed to update device notification settings', {
        error,
        userId: req.user?.id,
        deviceId: req.params.deviceId,
      });
      next(error);
    }
  }
);

/**
 * @route   PUT /api/notification-settings
 * @desc    Update notification settings for all devices (bulk update)
 * @access  Protected
 */
router.put(
  '/',
  sessionMiddleware,
  body('settings').isArray({ min: 1 }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user?.id;
      const { settings } = req.body; // Array of { deviceId, enabled }

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized: User not found in session.' });
      }

      const updatedSettings = await notificationSettingsService.updateUserSettings(userId, settings);

      // Audit log
      auditLogger.info('Bulk notification settings updated', {
        userId,
        settings,
      });

      return res.status(200).json({ settings: updatedSettings });
    } catch (error) {
      auditLogger.error('Failed to bulk update notification settings', {
        error,
        userId: req.user?.id,
      });
      next(error);
    }
  }
);

/**
 * @route   POST /api/notification-settings/sync
 * @desc    Synchronize notification settings across all devices for the user
 * @access  Protected
 */
router.post(
  '/sync',
  sessionMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized: User not found in session.' });
      }

      await notificationSettingsService.synchronizeSettings(userId);

      auditLogger.info('Notification settings synchronized across devices', { userId });

      return res.status(200).json({ message: 'Settings synchronized successfully.' });
    } catch (error) {
      auditLogger.error('Failed to synchronize notification settings', {
        error,
        userId: req.user?.id,
      });
      next(error);
    }
  }
);

/**
 * @route   GET /api/notification-settings/audit
 * @desc    Fetch audit logs for notification settings changes (admin only)
 * @access  Protected (admin)
 */
router.get(
  '/audit',
  sessionMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Only allow admin users
      if (!req.user?.isAdmin) {
        return res.status(403).json({ error: 'Forbidden: Admin access required.' });
      }

      const logs = await auditLogger.fetchLogs('notification-settings');
      return res.status(200).json({ logs });
    } catch (error) {
      auditLogger.error('Failed to fetch audit logs', { error, userId: req.user?.id });
      next(error);
    }
  }
);

export default router;