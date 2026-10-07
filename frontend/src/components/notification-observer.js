import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';

import {
  addNotificationResponseListener,
  canUseNativeNotifications,
} from '@/lib/device-notifications';
import { useFeed } from '@/hooks/use-feed';

const RESUME_WINDOW_MS = 2500;
const handledResponseIds = new Set();
let launchResponseConsumed = false;
let lastBecameActiveAt = 0;

function newsPathFromNotification(notification) {
  const data = notification?.request?.content?.data ?? {};
  const id = data.newsId ?? data.news_id ?? data.id;
  if (id == null || String(id).trim() === '') return '/news';
  return `/news/${id}`;
}

function responseId(response) {
  return response?.notification?.request?.identifier ?? null;
}

function openedFromOutside(appState) {
  if (appState !== 'active') return true;
  return lastBecameActiveAt > 0 && Date.now() - lastBecameActiveAt < RESUME_WINDOW_MS;
}

export function NotificationObserver() {
  const router = useRouter();
  const { refresh } = useFeed();
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') lastBecameActiveAt = Date.now();
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let active = true;

    const refreshFeed = () => {
      refresh().catch(() => {});
    };

    const openArticle = async (response) => {
      const id = responseId(response);
      if (id && handledResponseIds.has(id)) return;
      if (id) handledResponseIds.add(id);
      await refresh().catch(() => {});
      if (!active) return;
      router.push(newsPathFromNotification(response?.notification));
    };

    if (canUseNativeNotifications && !launchResponseConsumed) {
      launchResponseConsumed = true;
      Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          if (!active || !response) return;
          return openArticle(response).then(() => Notifications.clearLastNotificationResponseAsync());
        })
        .catch(() => {});
    }

    const tap = addNotificationResponseListener((response) => {
      if (!openedFromOutside(appStateRef.current)) {
        refreshFeed();
        return;
      }
      void openArticle(response);
    });

    const received = canUseNativeNotifications
      ? Notifications.addNotificationReceivedListener(() => {
          refreshFeed();
        })
      : { remove() {} };

    return () => {
      active = false;
      tap.remove();
      received.remove();
    };
  }, [refresh, router]);

  return null;
}
