import { api } from './apiClient';

export interface WalletInfo {
  isConnected: boolean;
  walletAddress?: string;
  walletInfo?: {
    publicName?: string;
    assetCode: string;
    assetScale: number;
  };
  balance: {
    value: string;
    assetCode: string;
    assetScale: number;
    formatted: string;
  };
}

export const walletService = {
  async getInfo(): Promise<WalletInfo> {
    const { data } = await api.get<WalletInfo>('/wallet/info');
    return data;
  },

  async connect(walletAddress: string): Promise<{ message: string; wallet: object }> {
    const { data } = await api.post('/wallet/connect', { walletAddress });
    return data;
  },

  async createAddress(publicName?: string): Promise<{
    message: string;
    wallet: { id: string; address: string; publicName?: string; assetCode: string; assetScale: number };
  }> {
    const { data } = await api.post('/wallet/create-address', { publicName });
    return data;
  },

  async disconnect(): Promise<void> {
    await api.delete('/wallet/disconnect');
  },

  async syncBalance(): Promise<WalletInfo['balance']> {
    const { data } = await api.post('/wallet/sync-balance');
    return data.balance;
  },

  async getBalance(): Promise<WalletInfo['balance']> {
    const { data } = await api.get('/users/balance');
    return data;
  },

  // Dev only — top up balance for testing
  async deposit(amountDollars: number): Promise<{ newBalance: string }> {
    const { data } = await api.post('/wallet/deposit', { amountDollars });
    return data;
  },
};
