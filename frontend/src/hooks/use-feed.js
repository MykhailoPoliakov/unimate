import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { useNotifications } from '@/hooks/use-notifications';

const STORAGE_KEY = 'unimate.feed';

const FeedContext = createContext({
  posts: [],
  isLoading: true,
  addPost: async () => {},
});

export function FeedProvider({ children }) {
  const { notifyNewPost } = useNotifications();
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (cancelled || !value) return;
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) setPosts(parsed);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const addPost = useCallback(
    async ({ type, title, body }) => {
      const post = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type,
        title: title.trim(),
        body: body.trim(),
        createdAt: Date.now(),
      };

      let next;
      setPosts((current) => {
        next = [post, ...current];
        return next;
      });
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      await notifyNewPost({ type: post.type });
      return post;
    },
    [notifyNewPost]
  );

  return (
    <FeedContext.Provider value={{ posts, isLoading, addPost }}>{children}</FeedContext.Provider>
  );
}

export function useFeed() {
  return useContext(FeedContext);
}
