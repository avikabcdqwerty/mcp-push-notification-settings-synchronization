import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Switch,
  CircularProgress,
  Snackbar,
  Alert,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import axios from 'axios';

/**
 * Type definition for a device's notification setting.
 */
interface DeviceSetting {
  deviceId: string;
  enabled: boolean;
}

/**
 * Props for PushNotificationSettings component.
 * Extendable for future needs (e.g., userId, admin mode).
 */
interface PushNotificationSettingsProps {}

/**
 * PushNotificationSettings
 * React component for users to view and update their push notification settings per device.
 */
const PushNotificationSettings: React.FC<PushNotificationSettingsProps> = () => {
  const [settings, setSettings] = useState<DeviceSetting[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  /**
   * Fetch notification settings for all devices on mount.
   */
  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const response = await axios.get('/api/notification-settings', {
          withCredentials: true,
        });
        setSettings(response.data.settings || []);
      } catch (err: any) {
        setError(
          err?.response?.data?.error ||
            'Failed to load notification settings. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  /**
   * Handle toggle of notification setting for a device.
   * @param {string} deviceId
   * @param {boolean} enabled
   */
  const handleToggle = async (deviceId: string, enabled: boolean) => {
    setSaving(true);
    setError(null);
    try {
      await axios.put(
        `/api/notification-settings/device/${deviceId}`,
        { enabled },
        { withCredentials: true }
      );
      setSettings((prev) =>
        prev.map((s) =>
          s.deviceId === deviceId ? { ...s, enabled } : s
        )
      );
      setSuccessMsg('Settings updated successfully.');
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          'Failed to update setting. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  /**
   * Handle bulk synchronization of settings across devices.
   */
  const handleSync = async () => {
    setSaving(true);
    setError(null);
    try {
      await axios.post('/api/notification-settings/sync', {}, { withCredentials: true });
      setSuccessMsg('Settings synchronized across devices.');
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          'Failed to synchronize settings. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  /**
   * Render the list of device notification settings.
   */
  const renderDeviceList = () => (
    <List>
      {settings.map((device) => (
        <ListItem key={device.deviceId} divider>
          <ListItemText
            primary={`Device: ${device.deviceId}`}
            secondary={
              device.enabled
                ? 'Notifications enabled'
                : 'Notifications disabled'
            }
          />
          <ListItemSecondaryAction>
            <Switch
              checked={device.enabled}
              onChange={(e) =>
                handleToggle(device.deviceId, e.target.checked)
              }
              color="primary"
              disabled={saving}
              inputProps={{
                'aria-label': `Toggle notifications for device ${device.deviceId}`,
              }}
            />
          </ListItemSecondaryAction>
        </ListItem>
      ))}
    </List>
  );

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4, p: 2 }}>
      <Typography variant="h5" gutterBottom>
        Push Notification Settings
      </Typography>
      <Typography variant="body2" color="textSecondary" gutterBottom>
        Manage your push notification preferences for each device linked to your account.
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {settings.length === 0 ? (
            <Typography variant="body1" color="textSecondary" sx={{ mt: 2 }}>
              No devices found.
            </Typography>
          ) : (
            renderDeviceList()
          )}
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSync}
              disabled={saving || loading}
            >
              Synchronize Settings Across Devices
            </Button>
          </Box>
        </>
      )}

      {/* Success Snackbar */}
      <Snackbar
        open={!!successMsg}
        autoHideDuration={4000}
        onClose={() => setSuccessMsg(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSuccessMsg(null)}
          severity="success"
          sx={{ width: '100%' }}
        >
          {successMsg}
        </Alert>
      </Snackbar>

      {/* Error Snackbar */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setError(null)}
          severity="error"
          sx={{ width: '100%' }}
        >
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PushNotificationSettings;