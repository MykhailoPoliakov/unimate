import { useRef, useState } from 'react';

const COOLDOWN_MS = 4000;
const SPINNER_MS = 700;

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
    const work = Promise.resolve()
      .then(action)
      .catch(() => {});
    await Promise.race([work, new Promise((resolve) => setTimeout(resolve, SPINNER_MS))]);
    setRefreshing(false);
    busy.current = false;
    void work;
  };

  return { refreshing, reload };
}
