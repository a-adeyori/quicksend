/**
 * Persists interactive demo wallet state (balance, tx list, contacts) — no server.
 * Web: localStorage · Native: MMKV
 */
import { Platform } from 'react-native';

const KEY = 'quicksend_demo_wallet_v1';

export function loadDemoWalletJson(): string | null {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage === 'undefined') return null;
      return localStorage.getItem(KEY);
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');
    const storage = new MMKV({ id: 'quicksend-demo' });
    return storage.getString(KEY) ?? null;
  } catch {
    return null;
  }
}

export function saveDemoWalletJson(json: string): void {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, json);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');
    const storage = new MMKV({ id: 'quicksend-demo' });
    storage.set(KEY, json);
  } catch {
    /* ignore */
  }
}

export function clearDemoWallet(): void {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');
    const storage = new MMKV({ id: 'quicksend-demo' });
    storage.delete(KEY);
  } catch {
    /* ignore */
  }
}
