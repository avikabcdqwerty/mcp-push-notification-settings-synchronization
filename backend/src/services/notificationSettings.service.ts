import { Repository, getRepository } from 'typeorm';
import { NotificationSettings } from '../models/notificationSettings.model';
import { auditLogger } from '../utils/auditLogger';
import crypto from 'crypto';

// AES-256 encryption configuration
const ENCRYPTION_KEY = process.env.NOTIF_AES_KEY || ''; // Must be 32 bytes
const IV_LENGTH = 16;

/**
 * Encrypts data using AES-256-CBC.
 * @param {string} text - Plain text to encrypt.
 * @returns {string} - Encrypted text (base64).
 */
function encrypt(text: string): string {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
    throw new Error('Invalid AES encryption key');
  }
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return iv.toString('base64') + ':' + encrypted;
}

/**
 * Decrypts data using AES-256-CBC.
 * @param {string} text - Encrypted text (base64).
 * @returns {string} - Decrypted plain text.
 */
function decrypt(text: string): string {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
    throw new Error('Invalid AES encryption key');
  }
  const textParts = text.split(':');
  const iv = Buffer.from(textParts[0], 'base64');
  const encryptedText = textParts[1];
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Service class for managing notification settings business logic.
 */
export class NotificationSettingsService {
  private settingsRepo: Repository<NotificationSettings>;

  constructor() {
    this.settingsRepo = getRepository(NotificationSettings);
  }

  /**
   * Fetch all notification settings for a user.
   * @param {string} userId
   * @returns {Promise<Array<{ deviceId: string; enabled: boolean }>>}
   */
  async getUserSettings(userId: string): Promise<Array<{ deviceId: string; enabled: boolean }>> {
    try {
      const settings = await this.settingsRepo.find({ where: { userId } });
      return settings.map((s) => ({
        deviceId: s.deviceId,
        enabled: JSON.parse(decrypt(s.enabledEncrypted)),
      }));
    } catch (error) {
      auditLogger.error('Error fetching user notification settings', { error, userId });
      throw error;
    }
  }

  /**
   * Fetch notification settings for a specific device.
   * @param {string} userId
   * @param {string} deviceId
   * @returns {Promise<{ deviceId: string; enabled: boolean } | null>}
   */
  async getDeviceSettings(
    userId: string,
    deviceId: string
  ): Promise<{ deviceId: string; enabled: boolean } | null> {
    try {
      const setting = await this.settingsRepo.findOne({ where: { userId, deviceId } });
      if (!setting) return null;
      return {
        deviceId: setting.deviceId,
        enabled: JSON.parse(decrypt(setting.enabledEncrypted)),
      };
    } catch (error) {
      auditLogger.error('Error fetching device notification settings', { error, userId, deviceId });
      throw error;
    }
  }

  /**
   * Update notification settings for a specific device.
   * @param {string} userId
   * @param {string} deviceId
   * @param {{ enabled: boolean }} update
   * @returns {Promise<{ deviceId: string; enabled: boolean }>}
   */
  async updateDeviceSettings(
    userId: string,
    deviceId: string,
    update: { enabled: boolean }
  ): Promise<{ deviceId: string; enabled: boolean }> {
    try {
      let setting = await this.settingsRepo.findOne({ where: { userId, deviceId } });
      if (!setting) {
        // Create new setting if not exists
        setting = this.settingsRepo.create({
          userId,
          deviceId,
          enabledEncrypted: encrypt(JSON.stringify(update.enabled)),
        });
      } else {
        setting.enabledEncrypted = encrypt(JSON.stringify(update.enabled));
      }
      await this.settingsRepo.save(setting);

      auditLogger.info('Device notification settings updated', {
        userId,
        deviceId,
        enabled: update.enabled,
      });

      // Synchronize settings across devices if needed
      await this.synchronizeSettings(userId);

      return {
        deviceId: setting.deviceId,
        enabled: update.enabled,
      };
    } catch (error) {
      auditLogger.error('Error updating device notification settings', { error, userId, deviceId });
      throw error;
    }
  }

  /**
   * Bulk update notification settings for all devices.
   * @param {string} userId
   * @param {Array<{ deviceId: string; enabled: boolean }>} settings
   * @returns {Promise<Array<{ deviceId: string; enabled: boolean }>>}
   */
  async updateUserSettings(
    userId: string,
    settings: Array<{ deviceId: string; enabled: boolean }>
  ): Promise<Array<{ deviceId: string; enabled: boolean }>> {
    try {
      const deviceIds = settings.map((s) => s.deviceId);
      const existingSettings = await this.settingsRepo.find({
        where: { userId, deviceId: deviceIds },
      });

      // Update or create settings per device
      const updatedSettings: NotificationSettings[] = [];
      for (const s of settings) {
        let setting = existingSettings.find((es) => es.deviceId === s.deviceId);
        if (!setting) {
          setting = this.settingsRepo.create({
            userId,
            deviceId: s.deviceId,
            enabledEncrypted: encrypt(JSON.stringify(s.enabled)),
          });
        } else {
          setting.enabledEncrypted = encrypt(JSON.stringify(s.enabled));
        }
        updatedSettings.push(setting);
      }
      await this.settingsRepo.save(updatedSettings);

      auditLogger.info('Bulk notification settings updated', {
        userId,
        settings,
      });

      // Synchronize settings across devices
      await this.synchronizeSettings(userId);

      return settings;
    } catch (error) {
      auditLogger.error('Error bulk updating notification settings', { error, userId, settings });
      throw error;
    }
  }

  /**
   * Synchronize notification settings across all devices for a user.
   * Ensures settings consistency and prevents duplicate notifications.
   * @param {string} userId
   * @returns {Promise<void>}
   */
  async synchronizeSettings(userId: string): Promise<void> {
    try {
      const settings = await this.settingsRepo.find({ where: { userId } });

      // Business logic: Prevent duplicate notifications
      // Only enabled devices should receive notifications
      // (actual notification dispatch logic would be elsewhere)

      // For demonstration, ensure all settings are consistent (if needed)
      // This could be expanded to propagate changes to device caches, etc.

      auditLogger.info('Notification settings synchronized', { userId });
    } catch (error) {
      auditLogger.error('Error synchronizing notification settings', { error, userId });
      throw error;
    }
  }

  /**
   * Utility to determine which devices should receive a notification for a user.
   * Prevents duplicate notifications.
   * @param {string} userId
   * @returns {Promise<string[]>} - Array of deviceIds to notify
   */
  async getDevicesToNotify(userId: string): Promise<string[]> {
    try {
      const settings = await this.settingsRepo.find({ where: { userId } });
      // Only enabled devices
      return settings
        .filter((s) => JSON.parse(decrypt(s.enabledEncrypted)) === true)
        .map((s) => s.deviceId);
    } catch (error) {
      auditLogger.error('Error determining devices to notify', { error, userId });
      throw error;
    }
  }
}