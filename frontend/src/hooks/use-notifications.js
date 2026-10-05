import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import {
  canUseNativeNotifications,
  ensureNotificationChannel,
  getExpoPushToken,
  requestNotificationPermission,
} from '@/lib/device-notifications';
import { useProfile } from '@/hooks/use-profile';
import { updatePushDevice } from '@/lib/api';

const STORAGE_KEY = 'unimate.notifications';
const PUSH_TOKEN_STORAGE_KEY = 'unimate.push-token';

const NotificationsContext = createContext({
  enabled: false,
  canUseNativeNotifications,
  pushError: null,
  setEnabled: async () => {},
});

export function NotificationsProvider({ children }) {
  const { profile } = useProfile();
  const [enabled, setEnabledState] = useState(false);
  const [pushError, setPushError] = useState(null);
  const syncingRef = useRef(false);
  const lastSyncedRef = useRef(null);

  useEffect(() => {
    let active = true;
    void ensureNotificationChannel();
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (active) setEnabledState(canUseNativeNotifications && value === 'on');
      })
      .catch(() => {
        if (active) setEnabledState(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const registerCurrentDevice = useCallback(async () => {
    if (!canUseNativeNotifications || !profile?.userId || syncingRef.current) return null;
    syncingRef.current = true;
    try {
      const token = await getExpoPushToken();
      if (!token) {
        throw new Error('Notification permission is not granted on this device.');
      }
      const syncKey = `${profile.userId}:${token}`;
      const stored = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
      if (stored === token && lastSyncedRef.current === syncKey) {
        return token;
      }
      await updatePushDevice(profile.userId, token, true);
      await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
      lastSyncedRef.current = syncKey;
      return token;
    } finally {
      syncingRef.current = false;
    }
  }, [profile?.userId]);

  useEffect(() => {
    if (!enabled || !canUseNativeNotifications || !profile?.userId) return undefined;
    let active = true;
    registerCurrentDevice()
      .then(() => {
        if (active) setPushError(null);
      })
      .catch((error) => {
        if (active) setPushError(error.message ?? 'Could not register this device for push.');
      });
    return () => {
      active = false;
    };
  }, [enabled, profile?.userId, registerCurrentDevice]);

  const setEnabled = useCallback(async (nextValue) => {
    setPushError(null);
    if (!canUseNativeNotifications) {
      setEnabledState(false);
      await AsyncStorage.setItem(STORAGE_KEY, 'off');
      return;
    }

    if (nextValue) {
      try {
        const granted = await requestNotificationPermission();
        if (!granted) {
          setEnabledState(false);
          await AsyncStorage.setItem(STORAGE_KEY, 'off');
          Alert.alert(
            'Notifications are off',
            'Allow notifications for UniMate in your device settings to get news and events.'
          );
          return;
        }

        if (!profile?.userId) {
          await AsyncStorage.setItem(STORAGE_KEY, 'on');
          setEnabledState(true);
          return;
        }

        await AsyncStorage.setItem(STORAGE_KEY, 'on');
        setEnabledState(true);
        await registerCurrentDevice();
      } catch (error) {
        lastSyncedRef.current = null;
        setEnabledState(false);
        await AsyncStorage.setItem(STORAGE_KEY, 'off');
        setPushError(error.message ?? 'Could not enable push notifications.');
        Alert.alert('Push notifications unavailable', error.message ?? 'Please try again.');
      }
      return;
    }

    setEnabledState(false);
    await AsyncStorage.setItem(STORAGE_KEY, 'off');
    lastSyncedRef.current = null;
    try {
      const token = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
      if (token && profile?.userId) await updatePushDevice(profile.userId, token, false);
    } catch (error) {
      setPushError(error.message ?? 'Could not disable push notifications on the server.');
      Alert.alert('Could not update push settings', error.message ?? 'Please try again.');
    }
  }, [profile?.userId, registerCurrentDevice]);

  return (
    <NotificationsContext.Provider
      value={{ enabled, canUseNativeNotifications, pushError, setEnabled }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
