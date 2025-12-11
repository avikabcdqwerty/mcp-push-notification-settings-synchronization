import React, { useEffect, useState } from 'react';
import { getNotificationSettings, updateDeviceSettings, disableDeviceNotifications, syncSettings } from '../api/api';

type DeviceSettings = {
  deviceId: string;
  enabled: boolean;
  preferences: Record<string, any>;
  updatedAt: string;
};

const NotificationSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<DeviceSettings[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<boolean>(false);

  // Fetch all device settings on mount
  useEffect(() => {
    fetchSettings();
    // Optionally, poll for real-time sync
    // const interval = setInterval(fetchSettings, 10000);
    // return () => clearInterval(interval);
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getNotificationSettings();
      setSettings(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (deviceId: string, enabled: boolean) => {
    setError(null);
    try {
      const device = settings.find((d) => d.deviceId === deviceId);
      if (!device) return;
      await updateDeviceSettings(deviceId, { enabled: !enabled, preferences: device.preferences });
      await fetchSettings();
    } catch (err: any) {
      setError(err?.message || 'Failed to update device settings.');
    }
  };

  const handlePreferenceChange = async (
    deviceId: string,
    prefKey: string,
    value: any
  ) => {
    setError(null);
    try {
      const device = settings.find((d) => d.deviceId === deviceId);
      if (!device) return;
      const newPrefs = { ...device.preferences, [prefKey]: value };
      await updateDeviceSettings(deviceId, { enabled: device.enabled, preferences: newPrefs });
      await fetchSettings();
    } catch (err: any) {
      setError(err?.message || 'Failed to update preferences.');
    }
  };

  const handleDisable = async (deviceId: string) => {
    setError(null);
    try {
      await disableDeviceNotifications(deviceId);
      await fetchSettings();
    } catch (err: any) {
      setError(err?.message || 'Failed to disable notifications.');
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    setError(null);
    try {
      // Prepare settings payload for sync
      const syncPayload: Record<string, any> = {};
      settings.forEach((d) => {
        syncPayload[d.deviceId] = {
          enabled: d.enabled,
          preferences: d.preferences,
        };
      });
      await syncSettings(syncPayload);
      await fetchSettings();
    } catch (err: any) {
      setError(err?.message || 'Failed to synchronize settings.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: 24, background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #eee' }}>
      <h2>Push Notification Settings</h2>
      {loading ? (
        <div>Loading settings...</div>
      ) : error ? (
        <div style={{ color: 'red', marginBottom: 16 }}>{error}</div>
      ) : (
        <>
          <button onClick={handleSyncAll} disabled={syncing} style={{ marginBottom: 20 }}>
            {syncing ? 'Synchronizing...' : 'Synchronize All Devices'}
          </button>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 8 }}>Device ID</th>
                <th style={{ textAlign: 'center', padding: 8 }}>Enabled</th>
                <th style={{ textAlign: 'center', padding: 8 }}>Sound</th>
                <th style={{ textAlign: 'center', padding: 8 }}>Vibration</th>
                <th style={{ textAlign: 'center', padding: 8 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {settings.map((device) => (
                <tr key={device.deviceId} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 8 }}>{device.deviceId}</td>
                  <td style={{ textAlign: 'center', padding: 8 }}>
                    <input
                      type="checkbox"
                      checked={device.enabled}
                      onChange={() => handleToggle(device.deviceId, device.enabled)}
                      aria-label={`Enable notifications for ${device.deviceId}`}
                    />
                  </td>
                  <td style={{ textAlign: 'center', padding: 8 }}>
                    <input
                      type="checkbox"
                      checked={!!device.preferences?.sound}
                      onChange={(e) =>
                        handlePreferenceChange(device.deviceId, 'sound', e.target.checked)
                      }
                      aria-label={`Sound for ${device.deviceId}`}
                      disabled={!device.enabled}
                    />
                  </td>
                  <td style={{ textAlign: 'center', padding: 8 }}>
                    <input
                      type="checkbox"
                      checked={!!device.preferences?.vibration}
                      onChange={(e) =>
                        handlePreferenceChange(device.deviceId, 'vibration', e.target.checked)
                      }
                      aria-label={`Vibration for ${device.deviceId}`}
                      disabled={!device.enabled}
                    />
                  </td>
                  <td style={{ textAlign: 'center', padding: 8 }}>
                    <button
                      onClick={() => handleDisable(device.deviceId)}
                      disabled={!device.enabled}
                      style={{ color: '#fff', background: '#d9534f', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer' }}
                    >
                      Disable
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};

export default NotificationSettingsPage;