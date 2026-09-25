import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { useNotifications } from '@/hooks/use-notifications';
import { useProfile } from '@/hooks/use-profile';
import { LANGUAGES } from '@/i18n/translations';
import { createNews, deleteNews, listNews, updateNews } from '@/lib/api';
import { joinNewsBody, parseNewsBody } from '@/lib/poll';
import { normalizeUrl } from '@/lib/social-service';

const FeedContext = createContext({
  posts: [],
  isLoading: true,
  refresh: async () => {},
  addPost: async () => {},
  editPost: async () => {},
  removePost: async () => {},
  applyPoll: () => {},
});

function imageFromTranslation(translation) {
  const block = (translation.blocks ?? []).find((item) => item?.type === 'image' && item.url);
  return block?.url || translation.hero_image_url || '';
}

function toPost(item) {
  const translation = item.translations?.[0] ?? {};
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
    async (data) => {
      const created = await createNews(
        profile.userId,
        newsPayload(profile, data)
      );
      await notifyNewPost({ type: 'news', title: data.title.trim() });
      await refresh();
      return toPost(created);
    },
    [notifyNewPost, profile, refresh]
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
    <FeedContext.Provider value={{ posts, isLoading, refresh, addPost, editPost, removePost, applyPoll }}>
      {children}
    </FeedContext.Provider>
  );
}

export function useFeed() {
  return useContext(FeedContext);
}
