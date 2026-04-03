import React, {
  createContext, useContext, useEffect, useState, useCallback, ReactNode,
} from 'react';
import { useRouter, useSegments } from 'expo-router';
import { authService, AuthUser } from '../services/authService';
import { getAccessToken, clearTokens, authEventEmitter } from '../services/apiClient';
import { DEMO_USER, isDemoMode } from '../config/demo';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // On mount — demo session or restore JWT session
  useEffect(() => {
    if (isDemoMode) {
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
      router.replace('/dashboard');
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

  // Route guard: unauthenticated users → welcome screen
  useEffect(() => {
    if (state.isLoading) return;
    const inAuthGroup = segments[0] !== '(app)';
    if (!state.isAuthenticated && !inAuthGroup) router.replace('/');
    if (state.isAuthenticated && inAuthGroup) router.replace('/dashboard');
  }, [state.isAuthenticated, state.isLoading, segments]);

  const login = useCallback(async (email: string, password: string) => {
    if (isDemoMode) {
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
    if (isDemoMode) {
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
    const { user } = await authService.register(params);
    setState({ user, isLoading: false, isAuthenticated: true });
  }, []);

  const enterDemo = useCallback(() => {
    if (!isDemoMode) return;
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
    router.replace('/dashboard');
  }, [router]);

  const logout = useCallback(async () => {
    if (isDemoMode) {
      await clearTokens();
    } else {
      await authService.logout();
    }
    setState({ user: null, isLoading: false, isAuthenticated: false });
    router.replace('/');
  }, [router]);

  const refreshUser = useCallback(async () => {
    if (isDemoMode) return;
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
