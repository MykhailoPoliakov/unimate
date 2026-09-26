import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useProfile } from '@/hooks/use-profile';
import { LANGUAGES } from '@/i18n/translations';
import { createNews, deleteNews, listManagedNews, listNews, updateNews } from '@/lib/api';
import { joinNewsBody, parseNewsBody } from '@/lib/poll';
import { normalizeUrl } from '@/lib/social-service';

const NEWS_NOTIFICATION_STORAGE_KEY = 'unimate.news-notification-preferences';

const FeedContext = createContext({
  posts: [],
  isLoading: true,
  unreadNewsCount: 0,
  inAppNewsEnabled: true,
  refresh: async () => {},
  markNewsRead: async () => {},
  setInAppNewsEnabled: async () => {},
  addPost: async () => {},
  editPost: async () => {},
  removePost: async () => {},
  applyPoll: () => {},
});

function imageFromTranslation(translation) {
  const block = (translation.blocks ?? []).find((item) => item?.type === 'image' && item.url);
  return block?.url || translation.hero_image_url || '';
}

function toPost(item, language) {
  const translations = item.translations ?? [];
  const translation =
    translations.find((row) => row.lang === language) ??
    translations.find((row) => row.lang === 'en') ??
    translations[0] ??
    {};
  const parsed = parseNewsBody(translation.body ?? '');
  return {
    id: item.id,
    title: translation.title ?? '',
    body: parsed.body,
    options: parsed.options,
    imageUrl: imageFromTranslation(translation),
    tags: Array.isArray(translation.tags) ? translation.tags.filter(Boolean) : [],
    audience: translation.excerpt ?? '',
    lang: translation.lang,
    isPublished: item.is_published,
    poll: item.poll ?? null,
    linkUrl: translation.cta_url ?? '',
    linkLabel: translation.cta_label ?? '',
    createdAt: item.created_at ?? null,
    authorId: item.author_id ?? null,
    canManage: false,
  };
}

function newsPayload(profile, data) {
  const language = profile?.language ?? 'en';
  const fullBody = joinNewsBody(data.body, data.options);
  const image = data.imageUrl?.trim() || null;
  const tags = (data.tags ?? []).map((item) => item.trim()).filter(Boolean);
  const excerpt = data.audience?.trim() || null;
  const shortUrl = image && image.length <= 500 && !image.startsWith('data:') ? image : null;
  const linkUrl = data.linkUrl?.trim() ? normalizeUrl(data.linkUrl) : null;
  const translation = {
    lang: language,
    title: data.title.trim(),
    body: fullBody,
    excerpt,
    hero_image_url: shortUrl,
    hero_image_alt: image ? data.title.trim() : null,
    cta_url: linkUrl,
    cta_label: data.linkLabel?.trim() || (linkUrl ? 'Open link' : null),
    tags,
    blocks: image ? [{ type: 'image', url: image, caption: data.title.trim() }] : [],
  };
  const translations = LANGUAGES.map((item) => ({ ...translation, lang: item.id }));
  const targeted = data.institution && data.program;
  return {
    translations,
    is_published: true,
    institution: targeted ? data.institution : undefined,
    program: targeted ? data.program : undefined,
    year_min: data.yearMin || undefined,
    year_max: data.yearMax || undefined,
  };
}

export function FeedProvider({ children }) {
  const { profile } = useProfile();
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newsNotificationPreferences, setNewsNotificationPreferences] = useState({});
  const newsNotificationPreferencesRef = useRef(newsNotificationPreferences);

  useEffect(() => {
    const userId = profile?.userId;
    if (!userId) return undefined;

    let active = true;
    const loadPreferences = async () => {
      let preferences = {};
      try {
        const stored = await AsyncStorage.getItem(NEWS_NOTIFICATION_STORAGE_KEY);
        preferences = stored ? JSON.parse(stored) : {};
      } catch {
        preferences = {};
      }

      const existing = preferences[userId];
      if (!existing || typeof existing.enabled !== 'boolean' || !Number.isFinite(existing.lastReadAt)) {
        preferences = {
          ...preferences,
          [userId]: { enabled: true, lastReadAt: Date.now() },
        };
        await AsyncStorage.setItem(NEWS_NOTIFICATION_STORAGE_KEY, JSON.stringify(preferences)).catch(
          () => {}
        );
      }

      if (active) {
        newsNotificationPreferencesRef.current = preferences;
        setNewsNotificationPreferences(preferences);
      }
    };

    loadPreferences();
    return () => {
      active = false;
    };
  }, [profile?.userId]);

  const updateNewsNotificationPreferences = useCallback(async (userId, changes) => {
    if (!userId) return;
    const current = newsNotificationPreferencesRef.current;
    const accountPreferences = current[userId] ?? { enabled: true, lastReadAt: Date.now() };
    const next = {
      ...current,
      [userId]: { ...accountPreferences, ...changes },
    };
    newsNotificationPreferencesRef.current = next;
    setNewsNotificationPreferences(next);
    await AsyncStorage.setItem(NEWS_NOTIFICATION_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    if (!profile?.userId) {
      setPosts([]);
      setIsLoading(false);
      return;
    }
    const canManageNews = ['admin', 'moderator'].includes(profile.role);
    const [items, managedItems] = await Promise.all([
      listNews(profile.userId),
      canManageNews ? listManagedNews(profile.userId) : Promise.resolve([]),
    ]);
    const postsById = new Map(items.map((item) => [item.id, toPost(item, profile.language)]));
    for (const item of managedItems) {
      const managedPost = toPost(item, profile.language);
      const visiblePost = postsById.get(managedPost.id);
      postsById.set(managedPost.id, {
        ...managedPost,
        poll: visiblePost?.poll ?? managedPost.poll,
        authorId: visiblePost?.authorId ?? managedPost.authorId,
        canManage: true,
      });
    }
    setPosts(
      [...postsById.values()].sort(
        (first, second) => new Date(second.createdAt ?? 0) - new Date(first.createdAt ?? 0)
      )
    );
  }, [profile?.userId, profile?.institution, profile?.program, profile?.yearOfStudy, profile?.language, profile?.role]);

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

  useEffect(() => {
    const refreshWhenActive = () => {
      if (AppState.currentState === 'active') refresh().catch(() => {});
    };
    const timer = setInterval(refreshWhenActive, 15_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh().catch(() => {});
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [refresh]);

  const markNewsRead = useCallback(
    () => updateNewsNotificationPreferences(profile?.userId, { lastReadAt: Date.now() }),
    [profile?.userId, updateNewsNotificationPreferences]
  );

  const setInAppNewsEnabled = useCallback(
    (enabled) => updateNewsNotificationPreferences(profile?.userId, { enabled }),
    [profile?.userId, updateNewsNotificationPreferences]
  );

  const accountNotificationPreferences = newsNotificationPreferences[profile?.userId];
  const inAppNewsEnabled = accountNotificationPreferences?.enabled ?? true;
  const unreadNewsCount = inAppNewsEnabled
    ? posts.filter((post) => {
        const createdAt = Date.parse(post.createdAt ?? '');
        return (
          post.isPublished &&
          Number.isFinite(createdAt) &&
          createdAt > (accountNotificationPreferences?.lastReadAt ?? Date.now())
        );
      }).length
    : 0;

  const addPost = useCallback(
    async (data) => {
      const created = await createNews(
        profile.userId,
        newsPayload(profile, data)
      );
      await refresh();
      return toPost(created, profile?.language);
    },
    [profile, refresh]
  );

  const editPost = useCallback(
    async ({ id, ...data }) => {
      await updateNews(profile.userId, id, newsPayload(profile, data));
      await refresh();
    },
    [profile, refresh]
  );

  const applyPoll = useCallback((newsId, poll) => {
    setPosts((current) =>
      current.map((post) => (post.id === newsId ? { ...post, poll } : post))
    );
  }, []);

  const removePost = useCallback(
    async (id) => {
      await deleteNews(profile.userId, id);
      await refresh();
    },
    [profile?.userId, refresh]
  );

  return (
    <FeedContext.Provider
      value={{
        posts,
        isLoading,
        unreadNewsCount,
        inAppNewsEnabled,
        refresh,
        markNewsRead,
        setInAppNewsEnabled,
        addPost,
        editPost,
        removePost,
        applyPoll,
      }}>
      {children}
    </FeedContext.Provider>
  );
}

export function useFeed() {
  return useContext(FeedContext);
}
