import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';

const KEEP_KEYS = new Set(['unimate.deviceId']);

function hasCookieModule() {
  return Platform.OS === 'ios'
    ? Boolean(NativeModules.RNCookieManagerIOS)
    : Boolean(NativeModules.RNCookieManagerAndroid);
}

async function clearWebViewCookies() {
  if (Platform.OS === 'web' || !hasCookieModule()) return;
  try {
    const CookieManager = require('@react-native-cookies/cookies').default;
    await CookieManager.clearAll(true);
    if (Platform.OS === 'ios') await CookieManager.clearAll(false);
  } catch {
    // Cookies are cleared best-effort; the rest of the reset must still run.
  }
}

let webSessionCleaner = null;

export function registerWebSessionCleaner(cleaner) {
  webSessionCleaner = cleaner;
  return () => {
    if (webSessionCleaner === cleaner) webSessionCleaner = null;
  };
}

// Removes every saved login, schedule link and per-user setting from this device.
export async function wipeLocalAccountData() {
  await clearWebViewCookies();
  if (webSessionCleaner) await webSessionCleaner().catch(() => {});
  const keys = await AsyncStorage.getAllKeys();
  const doomed = keys.filter((key) => key.startsWith('unimate.') && !KEEP_KEYS.has(key));
  if (doomed.length) await AsyncStorage.multiRemove(doomed);
}
