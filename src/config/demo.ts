/**
 * Interactive demo mode — no backend, no real money, no ILP calls.
 * Enable with EXPO_PUBLIC_DEMO_MODE=true in .env (see .env.example).
 */
export const isDemoMode = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';

export const DEMO_USER = {
  id: 'demo-user',
  email: 'demo@quicksend.app',
  firstName: 'Demo',
  lastName: 'User',
} as const;
