import React, {
  createContext, useContext, useEffect, useState, useCallback, ReactNode,
} from 'react';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { authService, AuthUser } from '../services/authService';
import { getAccessToken, clearTokens, authEventEmitter } from '../services/apiClient';
import { clearIlpGnapToken } from '../services/ilpTokenStorage';
import { DEMO_USER, isDemoMode, isFrontendOnly, useLiveAuth } from '../config/demo';
import { clearDemoWallet } from '../services/demoLocalStore';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (params: { firstName: string; lastName: string; email: string; phone?: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Re-enter demo session after logout (demo builds only). */
  enterDemo: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PUBLIC_SEGMENTS = new Set(['index', 'onboarding', 'login']);

function isPublicRouteSegment(first: string | undefined): boolean {
  return first === undefined || PUBLIC_SEGMENTS.has(first);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const rootNavigation = useRootNavigationState();
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // On mount — frontend-only: show welcome first. LAN demo: auto sign-in. Else JWT.
  useEffect(() => {
    if (isFrontendOnly) {
      setState({ user: null, isLoading: false, isAuthenticated: false });
      return;
    }
    if (isDemoMode && !useLiveAuth) {
      setState({
        user: {
          id: DEMO_USER.id,
          email: DEMO_USER.email,
          firstName: DEMO_USER.firstName,
          lastName: DEMO_USER.lastName,
        },
        isLoading: false,
        isAuthenticated: true,
      });
      return;
    }
    (async () => {
      try {
        const token = await getAccessToken();
        if (token) {
          const user = await authService.me();
          setState({ user, isLoading: false, isAuthenticated: true });
        } else {
          setState(s => ({ ...s, isLoading: false }));
        }
      } catch {
        await clearTokens();
        setState(s => ({ ...s, isLoading: false }));
      }
    })();
  }, []);

  // Listen for token expiry (no refresh possible)
  useEffect(() => {
    const handler = () => {
      setState({ user: null, isLoading: false, isAuthenticated: false });
      router.replace('/');
    };
    authEventEmitter.on(handler);
    return () => authEventEmitter.off(handler);
  }, [router]);

  // Route guard — only after navigator is mounted (avoids "navigate before Root Layout" crash)
  useEffect(() => {
    if (state.isLoading || !rootNavigation?.key) return;

    const first = segments[0];
    const isPublic = isPublicRouteSegment(first);

    if (!state.isAuthenticated && !isPublic) {
      router.replace('/');
      return;
    }
    if (state.isAuthenticated && isPublic) {
      router.replace('/dashboard');
    }
  }, [state.isAuthenticated, state.isLoading, segments, rootNavigation?.key, router]);

  const login = useCallback(async (email: string, password: string) => {
    if (isDemoMode && !useLiveAuth) {
      setState({
        user: {
          id: DEMO_USER.id,
          email: email || DEMO_USER.email,
          firstName: DEMO_USER.firstName,
          lastName: DEMO_USER.lastName,
        },
        isLoading: false,
        isAuthenticated: true,
      });
      return;
    }
    const { user } = await authService.login(email, password);
    setState({ user, isLoading: false, isAuthenticated: true });
  }, []);

  const register = useCallback(async (params: Parameters<typeof authService.register>[0]) => {
    if (isDemoMode && !useLiveAuth) {
      setState({
        user: {
          id: DEMO_USER.id,
          email: params.email,
          firstName: params.firstName,
          lastName: params.lastName,
        },
        isLoading: false,
        isAuthenticated: true,
      });
      return;
    }
    await authService.register(params);
    // Do not auto sign-in: clear tokens and send user to login (matches product flow + avoids silent dashboard redirect).
    await clearTokens();
    setState({ user: null, isLoading: false, isAuthenticated: false });
    router.replace('/login?registered=1');
  }, [router]);

  const enterDemo = useCallback(() => {
    if (!isDemoMode || useLiveAuth) return;
    setState({
      user: {
        id: DEMO_USER.id,
        email: DEMO_USER.email,
        firstName: DEMO_USER.firstName,
        lastName: DEMO_USER.lastName,
      },
      isLoading: false,
      isAuthenticated: true,
    });
    // Route guard will send to /dashboard once navigator is ready
  }, []);

  const logout = useCallback(async () => {
    if (useLiveAuth) {
      await authService.logout();
    } else {
      await clearTokens();
    }
    if (isFrontendOnly || (isDemoMode && !useLiveAuth)) {
      clearDemoWallet();
    }
    await clearIlpGnapToken();
    setState({ user: null, isLoading: false, isAuthenticated: false });
    router.replace('/');
  }, [router]);

  const refreshUser = useCallback(async () => {
    if (!useLiveAuth) return;
    try {
      const user = await authService.me();
      setState(s => ({ ...s, user }));
    } catch { /* ignore */ }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, refreshUser, enterDemo }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
