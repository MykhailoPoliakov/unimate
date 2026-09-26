import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';

import {
  addNotificationResponseListener,
  canUseNativeNotifications,
} from '@/lib/device-notifications';
import { useFeed } from '@/hooks/use-feed';

export function NotificationObserver() {
  const router = useRouter();
  const { refresh } = useFeed();

  useEffect(() => {
    let active = true;
    const lastResponse = canUseNativeNotifications
      ? Notifications.getLastNotificationResponseAsync()
      : Promise.resolve(null);
    lastResponse.then((response) => {
      if (!active || !response) return;
      router.push('/news');
      void Notifications.clearLastNotificationResponseAsync();
    }).catch(() => {});

    const sub = addNotificationResponseListener(() => {
      router.push('/news');
    });
    const received = canUseNativeNotifications
      ? Notifications.addNotificationReceivedListener(() => {
          refresh().catch(() => {});
        })
      : { remove() {} };

    return () => {
      active = false;
      sub.remove();
      received.remove();
    };
  }, [refresh, router]);

  return null;
}
