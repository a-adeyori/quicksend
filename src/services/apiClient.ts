/**
 * QuickSend API Client
 *
 * Single Axios instance used by all hooks/screens.
 * Handles:
 *   - Base URL config (dev vs prod)
 *   - JWT access token injection on every request
 *   - Automatic token refresh on 401
 *   - Consistent error shape
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// ─── Config ───────────────────────────────────────────────────────────────────

function devMachineHostFromExpo(): string | null {
  const dbg = Constants.expoGoConfig?.debuggerHost;
  if (dbg && typeof dbg === 'string') {
    const host = dbg.split(':')[0];
    if (host) return host;
  }
  const uri = Constants.expoConfig?.hostUri;
  if (uri && typeof uri === 'string') {
    const host = uri.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') return host;
  }
  return null;
}

/**
 * On a physical device, `localhost` in EXPO_PUBLIC_API_URL points at the phone, not your PC.
 * When Expo provides the packager host (LAN IP), rewrite loopback to that host.
 */
function resolveApiBaseUrl(): string {
  const raw = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1').trim();
  if (Platform.OS === 'web') return raw;
  const lan = devMachineHostFromExpo();
  if (!lan) return raw;
  try {
    const u = new URL(raw);
    if (u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') return raw;
    u.hostname = lan;
    return u.href.replace(/\/?$/, '');
  } catch {
    return raw;
  }
}

const BASE_URL = resolveApiBaseUrl();

// ─── Token storage keys ───────────────────────────────────────────────────────

export const TOKEN_KEYS = {
  access: 'qs_access_token',
  refresh: 'qs_refresh_token',
} as const;

const isWeb = () => Platform.OS === 'web';

export async function getAccessToken(): Promise<string | null> {
  if (isWeb()) {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEYS.access);
  }
  try { return await SecureStore.getItemAsync(TOKEN_KEYS.access); }
  catch { return null; }
}

export async function getRefreshToken(): Promise<string | null> {
  if (isWeb()) {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEYS.refresh);
  }
  try { return await SecureStore.getItemAsync(TOKEN_KEYS.refresh); }
  catch { return null; }
}

export async function saveTokens(access: string, refresh: string) {
  if (isWeb()) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TOKEN_KEYS.access, access);
      localStorage.setItem(TOKEN_KEYS.refresh, refresh);
    }
    return;
  }
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEYS.access, access),
    SecureStore.setItemAsync(TOKEN_KEYS.refresh, refresh),
  ]);
}

export async function clearTokens() {
  if (isWeb()) {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(TOKEN_KEYS.access);
      localStorage.removeItem(TOKEN_KEYS.refresh);
    }
    return;
  }
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEYS.access),
    SecureStore.deleteItemAsync(TOKEN_KEYS.refresh),
  ]);
}

// ─── Axios instance ───────────────────────────────────────────────────────────

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach JWT
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor — refresh on 401
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

/** Login/register 401 = wrong credentials — do not run refresh flow (avoids triple requests + spurious logout). */
function isAuthCredentialEndpoint(config: InternalAxiosRequestConfig | undefined): boolean {
  const path = (config?.url ?? '').replace(/\?.*$/, '');
  return path === '/auth/login' || path === '/auth/register';
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(formatError(error));
    }

    if (isAuthCredentialEndpoint(original)) {
      return Promise.reject(formatError(error));
    }

    // Already refreshing — queue this request
    if (isRefreshing) {
      return new Promise((resolve) => {
        refreshQueue.push((newToken) => {
          original.headers.Authorization = `Bearer ${newToken}`;
          resolve(api(original));
        });
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) throw new Error('No refresh token');

      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
      await saveTokens(data.accessToken, data.refreshToken);

      // Flush queue
      refreshQueue.forEach((cb) => cb(data.accessToken));
      refreshQueue = [];

      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(original);
    } catch {
      refreshQueue = [];
      await clearTokens();
      // Signal app to redirect to login
      authEventEmitter.emit('unauthenticated');
      return Promise.reject(formatError(error));
    } finally {
      isRefreshing = false;
    }
  }
);

// ─── Simple event bus for auth events ────────────────────────────────────────

type AuthEventListener = () => void;
const authEventEmitter = {
  _listeners: [] as AuthEventListener[],
  on(listener: AuthEventListener) { this._listeners.push(listener); },
  off(listener: AuthEventListener) { this._listeners = this._listeners.filter(l => l !== listener); },
  emit(_event: string) { this._listeners.forEach(l => l()); },
};
export { authEventEmitter };

// ─── Error formatter ──────────────────────────────────────────────────────────

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
}

function formatError(error: AxiosError): ApiError {
  const data = error.response?.data as Record<string, unknown> | undefined;
  if (!error.response && error.message === 'Network Error') {
    return {
      message:
        'Cannot reach the API. On web, use a public HTTPS EXPO_PUBLIC_API_URL (not localhost). On a phone, use your computer\'s LAN IP or deploy the backend.',
      code: 'NETWORK',
      details: { baseURL: BASE_URL },
    };
  }
  return {
    message: (data?.error as string) ?? error.message ?? 'An unexpected error occurred',
    code: data?.code as string | undefined,
    status: error.response?.status,
    details: data?.details,
  };
}

export function isApiError(err: unknown): err is ApiError {
  return typeof err === 'object' && err !== null && 'message' in err;
}
