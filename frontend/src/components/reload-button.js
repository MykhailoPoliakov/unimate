import { useState } from 'react';

export function useReload(action) {
  const [refreshing, setRefreshing] = useState(false);

  const reload = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await action();
    } finally {
      setRefreshing(false);
    }
  };

  return { refreshing, reload };
}
