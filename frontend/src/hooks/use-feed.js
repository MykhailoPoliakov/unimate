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
  isNewsUnread: () => false,
  markNewsItemRead: async () => {},
  markNewsBadgeSeen: async () => {},
  setInAppNewsEnabled: async () => {},
  addPost: async () => {},
  editPost: async () => {},
  removePost: async () => {},
  applyPoll: () => {},
});

function newsIdKey(id) {
  return String(id);
}

function readIdList(preferences) {
  const ids = preferences?.readIds;
  if (!Array.isArray(ids)) return [];
  return ids.map(newsIdKey);
}

function postCreatedAt(post) {
  const createdAt = Date.parse(post?.createdAt ?? '');
  return Number.isFinite(createdAt) ? createdAt : null;
}

function isVisuallyUnread(post, preferences) {
  if (!post?.isPublished || post.id == null) return false;
  if (readIdList(preferences).includes(newsIdKey(post.id))) return false;
  const createdAt = postCreatedAt(post);
  if (createdAt == null) return false;
  const baseline = preferences?.seenBaseline ?? preferences?.lastReadAt;
  if (Number.isFinite(baseline) && createdAt <= baseline) return false;
  return true;
}

function isBadgeUnread(post, preferences) {
  if (!post?.isPublished) return false;
  const createdAt = postCreatedAt(post);
  if (createdAt == null) return false;
  return createdAt > (preferences?.lastReadAt ?? Date.now());
}

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
    institution: item.institution ?? null,
    programs: item.programs ?? (item.program ? [item.program] : []),
    years: item.years ?? [],
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
  const base = {
    title: data.title.trim(),
    body: fullBody,
    excerpt,
    hero_image_alt: image ? data.title.trim() : null,
    cta_url: linkUrl,
    cta_label: data.linkLabel?.trim() || (linkUrl ? 'Open link' : null),
    tags,
  };
  const translations = LANGUAGES.map((item) => {
    const imageForLang = item.id === language ? image : shortUrl;
    return {
      ...base,
      lang: item.id,
      hero_image_url: shortUrl,
      blocks: imageForLang ? [{ type: 'image', url: imageForLang, caption: data.title.trim() }] : [],
    };
  });
  const programs = data.programs ?? (data.program ? [data.program] : []);
  const years = data.years ?? [];
  const targeted = Boolean(data.institution && programs.length && years.length);
  return {
    translations,
    is_published: true,
    institution: targeted ? data.institution : undefined,
    programs: targeted ? programs : undefined,
    years: targeted ? years : undefined,
  };
}

function sortPosts(items) {
  return [...items].sort(
    (first, second) => new Date(second.createdAt ?? 0) - new Date(first.createdAt ?? 0)
  );
}

function localPostFromInput(profile, data, id) {
  const linkUrl = data.linkUrl?.trim() ? normalizeUrl(data.linkUrl) : '';
  return {
    id,
    title: data.title.trim(),
    body: data.body ?? '',
    options: data.options ?? [],
    imageUrl: data.imageUrl ?? '',
    tags: data.tags ?? [],
    audience: data.audience ?? '',
    lang: profile?.language,
    isPublished: true,
    poll: null,
    linkUrl,
    linkLabel: data.linkLabel?.trim() || (linkUrl ? 'Open link' : ''),
    createdAt: new Date().toISOString(),
    authorId: profile?.userId ?? null,
    canManage: true,
    institution: data.institution ?? null,
    programs: data.programs ?? [],
    years: data.years ?? [],
  };
}

export function FeedProvider({ children }) {
  const { profile } = useProfile();
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newsNotificationPreferences, setNewsNotificationPreferences] = useState({});
  const newsNotificationPreferencesRef = useRef(newsNotificationPreferences);
  const postsRef = useRef(posts);
  postsRef.current = posts;

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
      const lastReadAt = Number.isFinite(existing?.lastReadAt) ? existing.lastReadAt : Date.now();
      const seenBaseline = Number.isFinite(existing?.seenBaseline) ? existing.seenBaseline : lastReadAt;
      if (
        !existing ||
        typeof existing.enabled !== 'boolean' ||
        !Number.isFinite(existing.lastReadAt) ||
        !Number.isFinite(existing.seenBaseline)
      ) {
        preferences = {
          ...preferences,
          [userId]: {
            enabled: existing?.enabled ?? true,
            lastReadAt,
            seenBaseline,
            readIds: readIdList(existing),
          },
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
    const accountPreferences = current[userId] ?? {
      enabled: true,
      lastReadAt: Date.now(),
      seenBaseline: Date.now(),
      readIds: [],
    };
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
    setPosts(sortPosts([...postsById.values()]));
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

  const setInAppNewsEnabled = useCallback(
    (enabled) => updateNewsNotificationPreferences(profile?.userId, { enabled }),
    [profile?.userId, updateNewsNotificationPreferences]
  );

  const markNewsItemRead = useCallback(
    (id) => {
      if (!profile?.userId || id == null || String(id).trim() === '') return;
      const current = newsNotificationPreferencesRef.current[profile.userId] ?? {
        enabled: true,
        lastReadAt: Date.now(),
        seenBaseline: Date.now(),
        readIds: [],
      };
      const key = newsIdKey(id);
      const readIds = readIdList(current);
      if (readIds.includes(key)) return;
      return updateNewsNotificationPreferences(profile.userId, { readIds: [...readIds, key] });
    },
    [profile?.userId, updateNewsNotificationPreferences]
  );

  const markNewsBadgeSeen = useCallback(() => {
    const latestPostAt = postsRef.current.reduce((latest, post) => {
      const createdAt = postCreatedAt(post);
      return createdAt != null && createdAt > latest ? createdAt : latest;
    }, 0);
    return updateNewsNotificationPreferences(profile?.userId, {
      lastReadAt: Math.max(Date.now(), latestPostAt),
    });
  }, [profile?.userId, updateNewsNotificationPreferences]);

  const isNewsUnread = useCallback(
    (post) => isVisuallyUnread(post, newsNotificationPreferences[profile?.userId]),
    [newsNotificationPreferences, profile?.userId]
  );

  const accountNotificationPreferences = newsNotificationPreferences[profile?.userId];
  const inAppNewsEnabled = accountNotificationPreferences?.enabled ?? true;
  const unreadNewsCount = inAppNewsEnabled
    ? posts.filter((post) => isBadgeUnread(post, accountNotificationPreferences)).length
    : 0;

  const addPost = useCallback(
    async (data) => {
      const tempId = `tmp-${Date.now()}`;
      const optimistic = localPostFromInput(profile, data, tempId);
      setPosts((current) => [optimistic, ...current.filter((item) => item.id !== tempId)]);
      void markNewsItemRead(tempId);
      try {
        const created = await createNews(profile.userId, newsPayload(profile, data));
        const post = { ...toPost(created, profile?.language), canManage: true };
        setPosts((current) =>
          sortPosts([post, ...current.filter((item) => item.id !== tempId && item.id !== post.id)])
        );
        void markNewsItemRead(post.id);
        return post;
      } catch (error) {
        setPosts((current) => current.filter((item) => item.id !== tempId));
        throw error;
      }
    },
    [markNewsItemRead, profile]
  );

  const editPost = useCallback(
    async ({ id, ...data }) => {
      const optimistic = localPostFromInput(profile, data, id);
      setPosts((current) =>
        current.map((item) => (item.id === id ? { ...item, ...optimistic, poll: item.poll } : item))
      );
      try {
        const updated = await updateNews(profile.userId, id, newsPayload(profile, data));
        const post = { ...toPost(updated, profile?.language), canManage: true };
        setPosts((current) =>
          current.map((item) => (item.id === post.id ? { ...item, ...post, poll: item.poll } : item))
        );
      } catch (error) {
        refresh().catch(() => {});
        throw error;
      }
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
      let removed = null;
      setPosts((current) => {
        removed = current.find((item) => item.id === id) ?? null;
        return current.filter((item) => item.id !== id);
      });
      try {
        await deleteNews(profile.userId, id);
      } catch (error) {
        if (removed) {
          setPosts((current) =>
            current.some((item) => item.id === id) ? current : sortPosts([removed, ...current])
          );
        }
        throw error;
      }
    },
    [profile?.userId]
  );

  return (
    <FeedContext.Provider
      value={{
        posts,
        isLoading,
        unreadNewsCount,
        inAppNewsEnabled,
        refresh,
        isNewsUnread,
        markNewsItemRead,
        markNewsBadgeSeen,
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
