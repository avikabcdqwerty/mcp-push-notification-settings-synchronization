/**
 * Frontend API client for communicating with backend notification settings endpoints.
 * Handles authentication, error handling, and provides modular functions.
 */

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api/notification-settings';

// Helper to get JWT token (from localStorage or other secure storage)
function getToken(): string | null {
  return localStorage.getItem('jwt_token');
}

// Helper for API requests
async function apiRequest(
  endpoint: string,
  method: string = 'GET',
  body?: any
): Promise<any> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Handle errors
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'API request failed');
  }

  // Parse JSON response
  return response.json();
}

/**
 * Fetch all notification settings for the authenticated user.
 */
export async function getNotificationSettings(): Promise<any[]> {
  return apiRequest('/', 'GET');
}

/**
 * Update notification settings for a specific device.
 * @param deviceId - Device identifier
 * @param update - { enabled?: boolean, preferences?: object }
 */
export async function updateDeviceSettings(
  deviceId: string,
  update: { enabled?: boolean; preferences?: Record<string, any> }
): Promise<any> {
  return apiRequest(`/${deviceId}`, 'PUT', update);
}

/**
 * Disable push notifications for a specific device.
 * @param deviceId - Device identifier
 */
export async function disableDeviceNotifications(deviceId: string): Promise<any> {
  return apiRequest(`/${deviceId}/disable`, 'POST');
}

/**
 * Synchronize notification settings across all devices.
 * @param settings - { [deviceId]: { enabled, preferences } }
 */
export async function syncSettings(settings: Record<string, any>): Promise<any> {
  return apiRequest('/sync', 'POST', { settings });
}