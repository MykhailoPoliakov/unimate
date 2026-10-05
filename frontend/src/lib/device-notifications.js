import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const CHANNEL_ID = 'unimate-info';

export const canUseNativeNotifications = Platform.OS !== 'web';

function hasPermission(permission) {
  return (
    permission.granted ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

if (canUseNativeNotifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: false,
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureNotificationChannel() {
  if (!canUseNativeNotifications || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'UniMate News',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#1A1C1F',
  });
}

export async function requestNotificationPermission() {
  if (!canUseNativeNotifications) return false;

  const next = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });
  await ensureNotificationChannel();
  return hasPermission(next) || next.status === 'granted' || next.status === 'provisional';
}

const EAS_PROJECT_ID_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function easProjectId() {
  const candidates = [
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
    Constants.expoConfig?.extra?.eas?.projectId,
    Constants.easConfig?.projectId,
  ];
  return candidates.find((value) => typeof value === 'string' && EAS_PROJECT_ID_UUID.test(value.trim())) ?? null;
}

export async function getExpoPushToken() {
  if (!canUseNativeNotifications) return null;
  const permission = await Notifications.getPermissionsAsync();
  if (!hasPermission(permission)) return null;

  const projectId = easProjectId();
  if (!projectId) {
    throw new Error(
      'Push notifications need a valid EAS project ID. Set EXPO_PUBLIC_EAS_PROJECT_ID to the UUID from app.json and reload Expo.'
    );
  }

  const result = await Notifications.getExpoPushTokenAsync({ projectId });
  return result.data;
}

export async function scheduleInfoNotification({ title, body }) {
  if (!canUseNativeNotifications) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { screen: 'news' },
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
