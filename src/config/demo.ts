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

/**
 * Real JWT auth (sign up / sign in) via EXPO_PUBLIC_API_URL.
 * - When EXPO_PUBLIC_DEMO_MODE=false → always on (full production).
 * - When EXPO_PUBLIC_DEMO_MODE=true → set EXPO_PUBLIC_USE_LIVE_AUTH=true to use secure
 *   accounts while keeping the demo wallet + ILP token in Settings.
 */
export const useLiveAuth =
  process.env.EXPO_PUBLIC_USE_LIVE_AUTH === 'true' || !isDemoMode;

export const DEMO_USER = {
  id: 'demo-user',
  email: 'demo@quicksend.app',
  firstName: 'Demo',
  lastName: 'User',
} as const;
