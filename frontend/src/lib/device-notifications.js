import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'unimate-info';

export const canUseNativeNotifications = Platform.OS !== 'web';

if (canUseNativeNotifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureNotificationChannel() {
  if (!canUseNativeNotifications || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'News and events',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#5B5CE2',
  });
}

export async function requestNotificationPermission() {
  if (!canUseNativeNotifications) return false;

  await ensureNotificationChannel();
  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    const next = await Notifications.requestPermissionsAsync();
    status = next.status;
  }
  return status === 'granted';
}

export async function scheduleInfoNotification({ title, body }) {
  if (!canUseNativeNotifications) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { screen: 'info' },
      sound: true,
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    },
    trigger: null,
  });
}

export function addNotificationResponseListener(callback) {
  if (!canUseNativeNotifications) return { remove() {} };
  return Notifications.addNotificationResponseReceivedListener(callback);
}
