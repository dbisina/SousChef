// Telling the server where to send this phone's notifications. Used when EXPO_PUBLIC_API_URL is set.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { RegisterDeviceRequest } from '../shared/index';
import { api } from '@/lib/api';

/** Where notificationService keeps the token on the phone. */
export const PUSH_TOKEN_KEY = '@souschef_push_token';

/** Registers (or refreshes) this phone's push token for the signed-in account. Web has no push, so it does nothing there. */
export async function apiRegisterDevice(pushToken: string, appVersion?: string): Promise<void> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  const body: RegisterDeviceRequest = { pushToken, platform: Platform.OS, ...(appVersion ? { appVersion } : {}) };
  await api().put('/v1/me/devices', body);
}

/** Stops notifications for the account on this phone (sign-out). Never throws: signing out must always work. */
export async function apiUnregisterDevice(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (token) await api().delete(`/v1/me/devices/${encodeURIComponent(token)}`);
  } catch {
    // The server drops a token by itself when a notification to it bounces.
  }
}
