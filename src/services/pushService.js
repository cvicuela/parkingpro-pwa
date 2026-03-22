/**
 * ParkingPro Push Notification Service
 * Handles browser push subscription management
 */

const API_URL = import.meta.env.VITE_API_URL || '';
const DEPLOYMENT_MODE = import.meta.env.VITE_DEPLOYMENT_MODE || 'remote';

function getToken() {
  return localStorage.getItem('pp_token') || '';
}

/**
 * Check if push backend is available (requires Express server)
 */
export function isPushBackendAvailable() {
  return DEPLOYMENT_MODE === 'local' || DEPLOYMENT_MODE === 'hybrid';
}

async function apiCall(path, options = {}) {
  if (!isPushBackendAvailable()) {
    return { success: false, error: 'Push requiere el servidor local (Express). No disponible en modo cloud.' };
  }
  const res = await fetch(`${API_URL}/api/v1/notifications${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
      ...options.headers,
    },
  });
  return res.json();
}

/**
 * Check if push notifications are supported
 */
export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Get current permission state
 */
export function getPermissionState() {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission; // 'default', 'granted', 'denied'
}

/**
 * Get VAPID public key from server
 */
export async function getVapidKey() {
  const result = await apiCall('/push/vapid-key');
  if (!result.success) return null;
  return result.data.publicKey;
}

/**
 * Convert URL-safe base64 to Uint8Array for applicationServerKey
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush() {
  if (!isPushSupported()) {
    return { success: false, error: 'Push notifications not supported' };
  }

  // Request permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { success: false, error: 'Permission denied' };
  }

  // Get VAPID key
  const vapidKey = await getVapidKey();
  if (!vapidKey) {
    return { success: false, error: 'Push service not configured on server' };
  }

  // Get service worker registration
  const registration = await navigator.serviceWorker.ready;

  // Subscribe
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });

  // Send subscription to server
  const result = await apiCall('/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });

  if (result.success) {
    localStorage.setItem('pp_push_enabled', 'true');
  }

  return result;
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush() {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    // Tell server
    await apiCall('/push/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });

    // Unsubscribe locally
    await subscription.unsubscribe();
  }

  localStorage.removeItem('pp_push_enabled');
  return { success: true };
}

/**
 * Check if currently subscribed
 */
export async function isSubscribed() {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}

/**
 * Get push subscription status from server
 */
export async function getPushStatus() {
  return apiCall('/push/status');
}
