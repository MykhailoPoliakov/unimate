import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import * as Notifications from 'expo-notifications';

import {
  canUseNativeNotifications,
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

  useEffect(() => {
    let active = true;
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
    if (!canUseNativeNotifications || !profile?.userId) return null;
    const token = await getExpoPushToken();
    if (!token) {
      throw new Error('Notification permission is not granted on this device.');
    }
    await updatePushDevice(profile.userId, token, true);
    await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
    return token;
  }, [profile?.userId]);

  useEffect(() => {
    if (!enabled || !canUseNativeNotifications || !profile?.userId) return undefined;

    let active = true;
    const register = async () => {
      try {
        await registerCurrentDevice();
        if (active) setPushError(null);
      } catch (error) {
        if (active) setPushError(error.message ?? 'Could not register this device for push.');
      }
    };
    void register();

    const subscription = Notifications.addPushTokenListener(() => {
      void register();
    });
    return () => {
      active = false;
      subscription.remove();
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
      if (!profile?.userId) return;
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

        const token = await getExpoPushToken();
        if (!token) throw new Error('The device did not return an Expo push token.');
        await updatePushDevice(profile.userId, token, true);
        await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
        await AsyncStorage.setItem(STORAGE_KEY, 'on');
        setEnabledState(true);
      } catch (error) {
        setEnabledState(false);
        await AsyncStorage.setItem(STORAGE_KEY, 'off');
        setPushError(error.message ?? 'Could not enable push notifications.');
        Alert.alert('Push notifications unavailable', error.message ?? 'Please try again.');
      }
      return;
    }

    setEnabledState(false);
    await AsyncStorage.setItem(STORAGE_KEY, 'off');
    try {
      const token = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
      if (token && profile?.userId) await updatePushDevice(profile.userId, token, false);
    } catch (error) {
      setPushError(error.message ?? 'Could not disable push notifications on the server.');
      Alert.alert('Could not update push settings', error.message ?? 'Please try again.');
    }
  }, [profile?.userId]);

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
