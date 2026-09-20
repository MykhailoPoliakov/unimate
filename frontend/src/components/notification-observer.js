import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { addNotificationResponseListener } from '@/lib/device-notifications';

export function NotificationObserver() {
  const router = useRouter();

  useEffect(() => {
    const sub = addNotificationResponseListener(() => {
      router.push('/info');
    });

    return () => sub.remove();
  }, [router]);

  return null;
}
