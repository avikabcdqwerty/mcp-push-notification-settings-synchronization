import { Router, Request, Response, NextFunction } from 'express';
import { NotificationSettingsService } from '../services/notificationSettings.service';
import { auditLogger } from '../utils/auditLogger';

// Instantiate the service
const notificationSettingsService = new NotificationSettingsService();

const router = Router();

/**
 * @route   GET /api/notification-settings
 * @desc    Get all notification settings for the authenticated user
 * @access  Protected (JWT)
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // @ts-ignore - user is attached by auth middleware
    const userId: string = req.user.id;
    const settings = await notificationSettingsService.getUserSettings(userId);
    res.status(200).json(settings);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/notification-settings/:deviceId
 * @desc    Get notification settings for a specific device
 * @access  Protected (JWT)
 */
router.get('/:deviceId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // @ts-ignore - user is attached by auth middleware
    const userId: string = req.user.id;
    const { deviceId } = req.params;
    const settings = await notificationSettingsService.getDeviceSettings(userId, deviceId);
    if (!settings) {
      return res.status(404).json({ error: 'Device settings not found.' });
    }
    res.status(200).json(settings);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   PUT /api/notification-settings/:deviceId
 * @desc    Update notification settings for a specific device
 * @access  Protected (JWT)
 */
router.put('/:deviceId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // @ts-ignore - user is attached by auth middleware
    const userId: string = req.user.id;
    const { deviceId } = req.params;
    const { enabled, preferences } = req.body;

    // Validate input
    if (typeof enabled !== 'boolean' && typeof preferences !== 'object') {
      return res.status(400).json({ error: 'Invalid request body.' });
    }

    const updatedSettings = await notificationSettingsService.updateDeviceSettings(
      userId,
      deviceId,
      { enabled, preferences }
    );

    // Audit log
    await auditLogger.log({
      userId,
      deviceId,
      action: 'UPDATE_NOTIFICATION_SETTINGS',
      details: { enabled, preferences },
      timestamp: new Date(),
    });

    res.status(200).json(updatedSettings);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/notification-settings/sync
 * @desc    Synchronize notification settings across all devices for the user
 * @access  Protected (JWT)
 */
router.post('/sync', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // @ts-ignore - user is attached by auth middleware
    const userId: string = req.user.id;
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Invalid settings payload.' });
    }

    const result = await notificationSettingsService.syncSettings(userId, settings);

    // Audit log
    await auditLogger.log({
      userId,
      action: 'SYNC_NOTIFICATION_SETTINGS',
      details: { settings },
      timestamp: new Date(),
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/notification-settings/:deviceId/disable
 * @desc    Disable push notifications for a specific device
 * @access  Protected (JWT)
 */
router.post('/:deviceId/disable', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // @ts-ignore - user is attached by auth middleware
    const userId: string = req.user.id;
    const { deviceId } = req.params;

    const updatedSettings = await notificationSettingsService.disableDeviceNotifications(
      userId,
      deviceId
    );

    // Audit log
    await auditLogger.log({
      userId,
      deviceId,
      action: 'DISABLE_DEVICE_NOTIFICATIONS',
      details: {},
      timestamp: new Date(),
    });

    res.status(200).json(updatedSettings);
  } catch (err) {
    next(err);
  }
});

export default router;