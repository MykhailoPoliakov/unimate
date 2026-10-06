import { useRef, useState } from 'react';

const COOLDOWN_MS = 4000;

export function useReload(action) {
  const [refreshing, setRefreshing] = useState(false);
  const busy = useRef(false);
  const lastAt = useRef(0);

  const reload = async () => {
    const now = Date.now();
    if (busy.current || now - lastAt.current < COOLDOWN_MS) return;
    busy.current = true;
    lastAt.current = now;
    setRefreshing(true);
    try {
      await action();
    } finally {
      busy.current = false;
      setRefreshing(false);
    }
  };

  return { refreshing, reload };
}
