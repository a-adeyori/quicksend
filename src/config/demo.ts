import { Platform } from 'react-native';

/**
 * Interactive demo wallet — simulated balance/transactions (no real API money).
 * Enable with EXPO_PUBLIC_DEMO_MODE=true in .env (see .env.example).
 */
export const isDemoMode = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';

/**
 * Pure client app: no API / no backend — full welcome → login → demo flows, local persistence.
 * Set EXPO_PUBLIC_FRONTEND_ONLY=true (recommended with DEMO_MODE + no live auth).
 */
export const isFrontendOnly = process.env.EXPO_PUBLIC_FRONTEND_ONLY === 'true';

const RAW_API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

function apiPointsToLoopback(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  } catch {
    return false;
  }
}

/** True when this page is served from a non-loopback host (e.g. Vercel, LAN IP, tunnel URL). */
function webClientIsNonLoopbackHost(): boolean {
  if (Platform.OS !== 'web') return false;
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname.toLowerCase();
  return h !== '' && h !== 'localhost' && h !== '127.0.0.1';
}

/**
 * Browsers on https://your-app.vercel.app cannot reach http://localhost:3001 on the user's PC.
 * In that case we fall back to client-side demo so the app still works.
 */
export const isBackendUnreachableFromThisClient =
  webClientIsNonLoopbackHost() && apiPointsToLoopback(RAW_API_URL);

/**
 * Intended live API + JWT from env (before frontend-only / unreachable overrides).
 */
const envWantsLiveAuth =
  process.env.EXPO_PUBLIC_USE_LIVE_AUTH === 'true' || !isDemoMode;

/**
 * Real JWT auth (sign up / sign in) via EXPO_PUBLIC_API_URL.
 * - When EXPO_PUBLIC_DEMO_MODE=false → on by default (full production).
 * - When DEMO_MODE=true, set EXPO_PUBLIC_USE_LIVE_AUTH=true for secure accounts + demo wallet.
 * Disabled when frontend-only, or when the API URL cannot be reached from this client.
 */
export const useLiveAuth =
  envWantsLiveAuth && !isFrontendOnly && !isBackendUnreachableFromThisClient;

/**
 * Auto sign-in as demo user (no API) — demo mode, or unreachable backend with no live auth.
 */
export const useAutoDemoSession =
  (isDemoMode || isBackendUnreachableFromThisClient) && !useLiveAuth;

/** Use local simulated wallet instead of REST /payments etc. */
export const useDemoWallet = isDemoMode || isBackendUnreachableFromThisClient;

export const DEMO_USER = {
  id: 'demo-user',
  email: 'demo@quicksend.app',
  firstName: 'Demo',
  lastName: 'User',
} as const;
