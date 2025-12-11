import { getRepository } from 'typeorm';
import { NotificationSettings } from '../models/notificationSettings.model';
import { encryptData, decryptData } from '../utils/encryption.util';
import { redisClient } from '../server';
import { v4 as uuidv4 } from 'uuid';

/**
 * NotificationSettingsService
 * Handles business logic for notification settings management, synchronization,
 * deduplication, and encryption.
 */
export class NotificationSettingsService {
  private settingsRepo = getRepository(NotificationSettings);

  /**
   * Get all notification settings for a user (across all devices).
   * Decrypts settings before returning.
   */
  async getUserSettings(userId: string): Promise<any[]> {
    try {
      const settings = await this.settingsRepo.find({ where: { userId } });
      return settings.map((s) => ({
        deviceId: s.deviceId,
        enabled: s.enabled,
        preferences: s.preferences ? decryptData(s.preferences) : {},
        updatedAt: s.updatedAt,
      }));
    } catch (err) {
      console.error(`[NotificationSettingsService] getUserSettings error:`, err);
      throw new Error('Failed to fetch user notification settings.');
    }
  }

  /**
   * Get notification settings for a specific device.
   * Decrypts settings before returning.
   */
  async getDeviceSettings(userId: string, deviceId: string): Promise<any | null> {
    try {
      const setting = await this.settingsRepo.findOne({ where: { userId, deviceId } });
      if (!setting) return null;
      return {
        deviceId: setting.deviceId,
        enabled: setting.enabled,
        preferences: setting.preferences ? decryptData(setting.preferences) : {},
        updatedAt: setting.updatedAt,
      };
    } catch (err) {
      console.error(`[NotificationSettingsService] getDeviceSettings error:`, err);
      throw new Error('Failed to fetch device notification settings.');
    }
  }

  /**
   * Update notification settings for a specific device.
   * Encrypts preferences before storing.
   * Synchronizes changes across all devices if needed.
   */
  async updateDeviceSettings(
    userId: string,
    deviceId: string,
    update: { enabled?: boolean; preferences?: Record<string, any> }
  ): Promise<any> {
    try {
      let setting = await this.settingsRepo.findOne({ where: { userId, deviceId } });
      if (!setting) {
        // Create new settings if not exist
        setting = this.settingsRepo.create({
          id: uuidv4(),
          userId,
          deviceId,
          enabled: typeof update.enabled === 'boolean' ? update.enabled : true,
          preferences: update.preferences ? encryptData(update.preferences) : encryptData({}),
        });
      } else {
        if (typeof update.enabled === 'boolean') setting.enabled = update.enabled;
        if (update.preferences) setting.preferences = encryptData(update.preferences);
      }
      setting.updatedAt = new Date();
      await this.settingsRepo.save(setting);

      // Invalidate deduplication cache for this device
      await this.invalidateDeduplicationCache(userId, deviceId);

      return {
        deviceId: setting.deviceId,
        enabled: setting.enabled,
        preferences: update.preferences || (setting.preferences ? decryptData(setting.preferences) : {}),
        updatedAt: setting.updatedAt,
      };
    } catch (err) {
      console.error(`[NotificationSettingsService] updateDeviceSettings error:`, err);
      throw new Error('Failed to update device notification settings.');
    }
  }

  /**
   * Synchronize notification settings across all devices for a user.
   * Encrypts preferences before storing.
   */
  async syncSettings(userId: string, settings: Record<string, any>): Promise<any> {
    try {
      const deviceSettings = await this.settingsRepo.find({ where: { userId } });
      const updated: any[] = [];

      for (const device of deviceSettings) {
        if (settings[device.deviceId]) {
          const update = settings[device.deviceId];
          if (typeof update.enabled === 'boolean') device.enabled = update.enabled;
          if (update.preferences) device.preferences = encryptData(update.preferences);
          device.updatedAt = new Date();
          await this.settingsRepo.save(device);
          updated.push({
            deviceId: device.deviceId,
            enabled: device.enabled,
            preferences: update.preferences || (device.preferences ? decryptData(device.preferences) : {}),
            updatedAt: device.updatedAt,
          });

          // Invalidate deduplication cache for this device
          await this.invalidateDeduplicationCache(userId, device.deviceId);
        }
      }
      return updated;
    } catch (err) {
      console.error(`[NotificationSettingsService] syncSettings error:`, err);
      throw new Error('Failed to synchronize notification settings.');
    }
  }

  /**
   * Disable push notifications for a specific device.
   */
  async disableDeviceNotifications(userId: string, deviceId: string): Promise<any> {
    try {
      const setting = await this.settingsRepo.findOne({ where: { userId, deviceId } });
      if (!setting) {
        throw new Error('Device settings not found.');
      }
      setting.enabled = false;
      setting.updatedAt = new Date();
      await this.settingsRepo.save(setting);

      // Invalidate deduplication cache for this device
      await this.invalidateDeduplicationCache(userId, deviceId);

      return {
        deviceId: setting.deviceId,
        enabled: setting.enabled,
        preferences: setting.preferences ? decryptData(setting.preferences) : {},
        updatedAt: setting.updatedAt,
      };
    } catch (err) {
      console.error(`[NotificationSettingsService] disableDeviceNotifications error:`, err);
      throw new Error('Failed to disable device notifications.');
    }
  }

  /**
   * Invalidate deduplication cache for a device (prevents duplicate notifications).
   */
  private async invalidateDeduplicationCache(userId: string, deviceId: string): Promise<void> {
    try {
      const key = `dedup:${userId}:${deviceId}`;
      await new Promise<void>((resolve, reject) => {
        redisClient.del(key, (err) => {
          if (err) {
            console.warn(`[NotificationSettingsService] Failed to invalidate deduplication cache for ${key}:`, err);
            return reject(err);
          }
          resolve();
        });
      });
    } catch (err) {
      // Non-fatal, log and continue
      console.warn(`[NotificationSettingsService] invalidateDeduplicationCache error:`, err);
    }
  }
}

export default NotificationSettingsService;