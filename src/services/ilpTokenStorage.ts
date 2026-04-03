import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'qs_ilp_gnap_token';

export async function saveIlpGnapToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEY, token);
    }
    return;
  }
  await SecureStore.setItemAsync(KEY, token);
}

export async function getIlpGnapToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(KEY);
  }
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function clearIlpGnapToken(): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(KEY);
    }
    return;
  }
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    /* ignore */
  }
}
