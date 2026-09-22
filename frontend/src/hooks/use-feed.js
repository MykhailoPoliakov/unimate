import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { useNotifications } from '@/hooks/use-notifications';
import { useProfile } from '@/hooks/use-profile';
import { createNews, deleteNews, listNews, updateNews } from '@/lib/api';

const FeedContext = createContext({
  posts: [],
  isLoading: true,
  refresh: async () => {},
  addPost: async () => {},
  editPost: async () => {},
  removePost: async () => {},
});

function toPost(item) {
  const translation = item.translations?.[0] ?? {};
  return {
    id: item.id,
    title: translation.title ?? '',
    body: translation.body ?? '',
    lang: translation.lang,
    isPublished: item.is_published,
  };
}

function newsPayload(profile, title, body) {
  const language = profile?.language ?? 'en';
  const translations = [{ lang: language, title: title.trim(), body: body.trim() }];
  if (language !== 'en') {
    translations.push({ lang: 'en', title: title.trim(), body: body.trim() });
  }
  return {
    translations,
    is_published: true,
    institution: profile?.institution ?? undefined,
    program: profile?.program ?? undefined,
  };
}

export function FeedProvider({ children }) {
  const { profile } = useProfile();
  const { notifyNewPost } = useNotifications();
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!profile?.userId) {
      setPosts([]);
      setIsLoading(false);
      return;
    }
    const items = await listNews(profile.userId);
    setPosts(items.map(toPost));
  }, [profile?.userId, profile?.institution, profile?.program, profile?.yearOfStudy, profile?.language]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    refresh()
      .catch(() => {
        if (!cancelled) setPosts([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh, profile?.language]);

  const addPost = useCallback(
    async ({ title, body }) => {
      const created = await createNews(
        profile.userId,
        newsPayload(profile, title, body)
      );
      await notifyNewPost({ type: 'news' });
      await refresh();
      return toPost(created);
    },
    [notifyNewPost, profile, refresh]
  );

  const editPost = useCallback(
    async ({ id, title, body }) => {
      await updateNews(profile.userId, id, newsPayload(profile, title, body));
      await refresh();
    },
    [profile, refresh]
  );

  const removePost = useCallback(
    async (id) => {
      await deleteNews(profile.userId, id);
      await refresh();
    },
    [profile?.userId, refresh]
  );

  return (
    <FeedContext.Provider value={{ posts, isLoading, refresh, addPost, editPost, removePost }}>
      {children}
    </FeedContext.Provider>
  );
}

export function useFeed() {
  return useContext(FeedContext);
}
