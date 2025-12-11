import request from 'supertest';
import express, { Express } from 'express';
import { createConnection, getConnection, getRepository } from 'typeorm';
import { NotificationSettings } from '../src/models/notificationSettings.model';
import notificationSettingsRouter from '../src/controllers/notificationSettings.controller';
import { NotificationSettingsService } from '../src/services/notificationSettings.service';
import { auditLogger } from '../src/utils/auditLogger';

// Mock session middleware for testing
jest.mock('../src/middleware/sessionMiddleware', () => ({
  sessionMiddleware: (req: any, res: any, next: any) => {
    req.user = req.testUser || { id: 'test-user', isAdmin: false };
    next();
  },
}));

// Mock auditLogger for testing
jest.spyOn(auditLogger, 'info').mockImplementation(() => {});
jest.spyOn(auditLogger, 'error').mockImplementation(() => {});
jest.spyOn(auditLogger, 'fetchLogs').mockResolvedValue([
  { action: 'update', userId: 'test-user', deviceId: 'device-1', timestamp: new Date() },
]);

describe('Push Notification Settings Synchronization', () => {
  let app: Express;
  let service: NotificationSettingsService;

  beforeAll(async () => {
    // Use SQLite in-memory DB for testing
    await createConnection({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      entities: [NotificationSettings],
      synchronize: true,
      logging: false,
    });
    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.testUser = { id: 'test-user', isAdmin: false };
      next();
    });
    app.use('/api/notification-settings', notificationSettingsRouter);
    service = new NotificationSettingsService();
  });

  afterAll(async () => {
    await getConnection().close();
  });

  beforeEach(async () => {
    await getRepository(NotificationSettings).clear();
  });

  it('should create and fetch notification settings for multiple devices', async () => {
    // Create settings for two devices
    await service.updateDeviceSettings('test-user', 'device-1', { enabled: true });
    await service.updateDeviceSettings('test-user', 'device-2', { enabled: false });

    const res = await request(app)
      .get('/api/notification-settings')
      .expect(200);

    expect(res.body.settings).toEqual(
      expect.arrayContaining([
        { deviceId: 'device-1', enabled: true },
        { deviceId: 'device-2', enabled: false },
      ])
    );
  });

  it('should update notification setting for a specific device', async () => {
    await service.updateDeviceSettings('test-user', 'device-1', { enabled: true });

    const res = await request(app)
      .put('/api/notification-settings/device/device-1')
      .send({ enabled: false })
      .expect(200);

    expect(res.body.deviceSettings).toEqual({ deviceId: 'device-1', enabled: false });

    // Verify update
    const settings = await service.getUserSettings('test-user');
    expect(settings.find((s) => s.deviceId === 'device-1')?.enabled).toBe(false);
  });

  it('should synchronize settings across all devices', async () => {
    await service.updateDeviceSettings('test-user', 'device-1', { enabled: true });
    await service.updateDeviceSettings('test-user', 'device-2', { enabled: true });

    const res = await request(app)
      .post('/api/notification-settings/sync')
      .expect(200);

    expect(res.body.message).toBe('Settings synchronized successfully.');
    // No error thrown, auditLogger called
    expect(auditLogger.info).toHaveBeenCalledWith(
      'Notification settings synchronized across devices',
      expect.objectContaining({ userId: 'test-user' })
    );
  });

  it('should prevent duplicate notifications (only enabled devices)', async () => {
    await service.updateDeviceSettings('test-user', 'device-1', { enabled: true });
    await service.updateDeviceSettings('test-user', 'device-2', { enabled: false });
    await service.updateDeviceSettings('test-user', 'device-3', { enabled: true });

    const devicesToNotify = await service.getDevicesToNotify('test-user');
    expect(devicesToNotify).toEqual(expect.arrayContaining(['device-1', 'device-3']));
    expect(devicesToNotify).not.toContain('device-2');
  });

  it('should block unauthorized session attempts to update settings', async () => {
    // Remove user from session
    app.use((req, res, next) => {
      req.testUser = undefined;
      next();
    });

    const res = await request(app)
      .put('/api/notification-settings/device/device-1')
      .send({ enabled: true });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Unauthorized/);
  });

  it('should securely store settings (encrypted at rest)', async () => {
    await service.updateDeviceSettings('test-user', 'device-1', { enabled: true });
    const repo = getRepository(NotificationSettings);
    const setting = await repo.findOne({ where: { userId: 'test-user', deviceId: 'device-1' } });
    expect(setting).toBeDefined();
    expect(typeof setting?.enabledEncrypted).toBe('string');
    // Should not be plain 'true' or 'false'
    expect(setting?.enabledEncrypted).not.toBe('true');
    expect(setting?.enabledEncrypted).not.toBe('false');
  });

  it('should log audit events for settings changes', async () => {
    await service.updateDeviceSettings('test-user', 'device-1', { enabled: true });
    expect(auditLogger.info).toHaveBeenCalledWith(
      'Device notification settings updated',
      expect.objectContaining({
        userId: 'test-user',
        deviceId: 'device-1',
        enabled: true,
      })
    );
  });

  it('should allow admin to fetch audit logs', async () => {
    // Set user as admin for this request
    app.use((req, res, next) => {
      req.testUser = { id: 'test-user', isAdmin: true };
      next();
    });

    const res = await request(app)
      .get('/api/notification-settings/audit')
      .expect(200);

    expect(Array.isArray(res.body.logs)).toBe(true);
    expect(res.body.logs[0]).toHaveProperty('action');
  });

  it('should block non-admin from fetching audit logs', async () => {
    // Set user as non-admin
    app.use((req, res, next) => {
      req.testUser = { id: 'test-user', isAdmin: false };
      next();
    });

    const res = await request(app)
      .get('/api/notification-settings/audit')
      .expect(403);

    expect(res.body.error).toMatch(/Forbidden/);
  });
});