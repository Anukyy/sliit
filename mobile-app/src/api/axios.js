import axios from 'axios';
import { Platform } from 'react-native';

/**
 * API base URL (must include `/api` — backend mounts routes under /api).
 *
 * Project LAN host is 192.168.1.3 (see `mobile-app/.env`).
 * Override for another PC / different network:
 *   EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:5000/api
 *   then restart Expo (`npx expo start -c`).
 *
 * Defaults (when EXPO_PUBLIC_API_URL is unset):
 *   - Web: localhost:5000
 *   - Android emulator: 10.0.2.2:5000
 *   - iOS / other native: LAN host 192.168.1.3:5000
 */
function resolveBaseUrl() {
  const fromEnv =
    typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL
      ? String(process.env.EXPO_PUBLIC_API_URL).trim().replace(/\/+$/, '')
      : '';
  if (fromEnv) {
    return fromEnv.endsWith('/api') ? fromEnv : `${fromEnv}/api`;
  }
  const port = process.env.EXPO_PUBLIC_API_PORT || '5000';
  if (Platform.OS === 'web') {
    return `http://localhost:${port}/api`;
  }
  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${port}/api`;
  }
  return `http://192.168.1.3:${port}/api`;
}

const BASE_URL = resolveBaseUrl();

if (__DEV__) {
  console.log(`[api] baseURL = ${BASE_URL}`);
}

const instance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const roleTokens = {
  admin: null,
  staff: null,
  customer: null,
};
let activeScope = null;

function resolveArgs(arg1, arg2) {
  if (arg2 === undefined) return { scope: 'default', token: arg1 };
  return { scope: String(arg1 || 'default').toLowerCase(), token: arg2 };
}

function applyActiveAuthHeader() {
  if (!activeScope || !roleTokens[activeScope]) {
    delete instance.defaults.headers.common['Authorization'];
    return;
  }
  instance.defaults.headers.common['Authorization'] = `Bearer ${roleTokens[activeScope]}`;
}

export const setAuthToken = (arg1, arg2) => {
  const { scope, token } = resolveArgs(arg1, arg2);
  if (scope !== 'default') {
    roleTokens[scope] = token || null;
    activeScope = scope;
    applyActiveAuthHeader();
    return;
  }
  if (token) {
    instance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete instance.defaults.headers.common['Authorization'];
  }
};

export const clearAuthToken = (scope = 'default') => {
  const normalized = String(scope || 'default').toLowerCase();
  if (normalized !== 'default') {
    roleTokens[normalized] = null;
    if (activeScope === normalized) {
      const fallback = ['staff', 'customer', 'admin'].find((s) => roleTokens[s]);
      activeScope = fallback || null;
      applyActiveAuthHeader();
    }
    return;
  }
  delete instance.defaults.headers.common['Authorization'];
};

export default instance;
