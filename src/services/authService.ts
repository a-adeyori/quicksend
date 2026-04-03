import { api, saveTokens, clearTokens } from './apiClient';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export const authService = {
  async register(params: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    password: string;
  }): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/register', params);
    await saveTokens(data.accessToken, data.refreshToken);
    return data;
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
    await saveTokens(data.accessToken, data.refreshToken);
    return data;
  },

  async logout(refreshToken?: string) {
    try { await api.post('/auth/logout', { refreshToken }); } catch {}
    await clearTokens();
  },

  async me(): Promise<AuthUser & { walletAddress?: string; balanceCents: number; assetCode: string; assetScale: number }> {
    const { data } = await api.get('/auth/me');
    return data;
  },
};
