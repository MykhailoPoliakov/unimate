import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'unimate.deviceId';

function createUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

let cachedId = null;

export async function getDeviceId() {
  if (cachedId) return cachedId;
  const existing = await AsyncStorage.getItem(STORAGE_KEY);
  if (existing) {
    cachedId = existing;
    return existing;
  }
  const next = createUuid();
  await AsyncStorage.setItem(STORAGE_KEY, next);
  cachedId = next;
  return next;
}
