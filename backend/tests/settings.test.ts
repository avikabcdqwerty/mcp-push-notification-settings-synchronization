import request from 'supertest';
import { createConnection, getConnection, getRepository } from 'typeorm';
import app from '../src/server';
import { NotificationSettings } from '../src/models/notificationSettings.model';
import { encryptData } from '../src/utils/encryption.util';
import { shouldSendNotification, clearDeduplication } from '../src/utils/notificationDeduplication';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme-in-production';

describe('Push Notification Settings Synchronization', () => {
  let userId: string;
  let deviceId1: string;
  let deviceId2: string;
  let token: string;

  beforeAll(async () => {
    // Setup test DB connection
    await createConnection();

    // Create test user and devices
    userId = '11111111-1111-1111-1111-111111111111';
    deviceId1 = 'device-1';
    deviceId2 = 'device-2';

    // Generate JWT token for test user
    token = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '1h' });

    // Insert initial settings for both devices
    const repo = getRepository(NotificationSettings);
    await repo.save([
      repo.create({
        id: '22222222-2222-2222-2222-222222222222',
        userId,
        deviceId: deviceId1,
        enabled: true,
        preferences: encryptData({ sound: true, vibration: true }),
      }),
      repo.create({
        id: '33333333-3333-3333-3333-333333333333',
        userId,
        deviceId: deviceId2,
        enabled: true,
        preferences: encryptData({ sound: false, vibration: true }),
      }),
    ]);
  });

  afterAll(async () => {
    // Cleanup DB
    const repo = getRepository(NotificationSettings);
    await repo.delete({ userId });
    await getConnection().close();
  });

  test('Settings updates on one device are synchronized across all devices', async () => {
    // Update device 1 settings
    const res = await request(app)
      .put(`/api/notification-settings/${deviceId1}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: false, preferences: { sound: false, vibration: false } });

    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
    expect(res.body.preferences.sound).toBe(false);

    // Sync settings across devices
    const syncRes = await request(app)
      .post('/api/notification-settings/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({
        settings: {
          [deviceId1]: { enabled: false, preferences: { sound: false, vibration: false } },
          [deviceId2]: { enabled: true, preferences: { sound: true, vibration: true } },
        },
      });

    expect(syncRes.status).toBe(200);
    expect(syncRes.body.length).toBeGreaterThanOrEqual(2);

    // Fetch device 2 settings and verify sync
    const getRes = await request(app)
      .get(`/api/notification-settings/${deviceId2}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.enabled).toBe(true);
    expect(getRes.body.preferences.sound).toBe(true);
  });

  test('Disabling notifications on a device prevents alerts on that device but not on others', async () => {
    // Disable device 1 notifications
    const res = await request(app)
      .post(`/api/notification-settings/${deviceId1}/disable`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);

    // Device 2 should still be enabled
    const getRes = await request(app)
      .get(`/api/notification-settings/${deviceId2}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.enabled).toBe(true);
  });

  test('Only one push notification is delivered per notification event, regardless of device count', async () => {
    const eventId = 'notif-event-123';

    // Clear deduplication key before test
    await clearDeduplication(userId, eventId);

    // First call should return true (send notification)
    const shouldSend1 = await shouldSendNotification(userId, eventId);
    expect(shouldSend1).toBe(true);

    // Second call (same event) should return false (duplicate)
    const shouldSend2 = await shouldSendNotification(userId, eventId);
    expect(shouldSend2).toBe(false);
  });

  test('Unauthorized or expired session attempts to update settings are blocked', async () => {
    // Use invalid token
    const res = await request(app)
      .put(`/api/notification-settings/${deviceId1}`)
      .set('Authorization', `Bearer invalidtoken`)
      .send({ enabled: true });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Unauthorized|expired/);
  });

  test('Settings updates are securely transmitted and stored using encryption', async () => {
    // Update device 2 settings
    const newPrefs = { sound: true, vibration: false, custom: 'secure' };
    const res = await request(app)
      .put(`/api/notification-settings/${deviceId2}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: true, preferences: newPrefs });

    expect(res.status).toBe(200);
    expect(res.body.preferences.custom).toBe('secure');

    // Verify in DB that preferences are encrypted
    const repo = getRepository(NotificationSettings);
    const setting = await repo.findOne({ where: { userId, deviceId: deviceId2 } });
    expect(setting).toBeDefined();
    expect(typeof setting?.preferences).toBe('string');
    expect(setting?.preferences).not.toContain('secure'); // Should be encrypted
  });
});