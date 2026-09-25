import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import {
  canUseNativeNotifications,
  requestNotificationPermission,
  scheduleInfoNotification,
} from '@/lib/device-notifications';

const STORAGE_KEY = 'unimate.notifications';

const NotificationsContext = createContext({
  enabled: false,
  setEnabled: async () => {},
  notifyNewPost: async () => {},
});

export function NotificationsProvider({ children }) {
  const [enabled, setEnabledState] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      setEnabledState(value === 'on');
    });
  }, []);

  const setEnabled = useCallback(async (nextValue) => {
    if (nextValue && canUseNativeNotifications) {
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
    }
    setEnabledState(nextValue);
    await AsyncStorage.setItem(STORAGE_KEY, nextValue ? 'on' : 'off');
  }, []);

  const notifyNewPost = useCallback(
    async ({ type, title }) => {
      if (!enabled || !canUseNativeNotifications) return;

      const granted = await requestNotificationPermission();
      if (!granted) return;

      const isEvent = type === 'event';
      await scheduleInfoNotification({
        title: 'UniMate News',
        body: title?.trim() || (isEvent ? 'A new event was published.' : 'A new update was published.'),
      });
    },
    [enabled]
  );

  return (
    <NotificationsContext.Provider value={{ enabled, setEnabled, notifyNewPost }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
