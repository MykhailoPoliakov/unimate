import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Alert, RefreshControl, ScrollView } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listEnter, PressScale } from '@/components/motion';
import { PostCard } from '@/components/news-ui';
import { useReload } from '@/components/reload-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useFeed } from '@/hooks/use-feed';
import { useI18n } from '@/hooks/use-i18n';
import { useProfile } from '@/hooks/use-profile';
import { BottomTabGap } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function NewsScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const { profile, refreshUser } = useProfile();
  const { posts, removePost, refresh, markNewsBadgeSeen, recordNewsView } = useFeed();
  const pathname = usePathname();
  const canManageNews = ['admin', 'moderator'].includes(profile?.role);
  const screenFocused = useRef(false);
  const postLayouts = useRef(new Map());
  const postsRef = useRef(posts);
  const viewedPostIds = useRef(new Set());
  const scrollOffset = useRef(0);
  const viewportHeight = useRef(0);

  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  const checkVisiblePosts = useCallback(() => {
    if (!screenFocused.current || !profile?.userId || viewportHeight.current <= 0) return;
    for (const post of postsRef.current) {
      if (!post.isPublished || viewedPostIds.current.has(String(post.id))) continue;
      const frame = postLayouts.current.get(String(post.id));
      if (!frame) continue;
      const visibleHeight = Math.max(
        0,
        Math.min(frame.y + frame.height, scrollOffset.current + viewportHeight.current) -
          Math.max(frame.y, scrollOffset.current)
      );
      if (visibleHeight < Math.min(frame.height * 0.5, 120)) continue;
      viewedPostIds.current.add(String(post.id));
      recordNewsView(post.id).catch((error) => {
        console.error('Failed to record news view', error);
      });
    }
  }, [profile?.userId, recordNewsView]);

  useFocusEffect(
    useCallback(() => {
      screenFocused.current = true;
      void markNewsBadgeSeen();
      requestAnimationFrame(checkVisiblePosts);
      return () => {
        screenFocused.current = false;
      };
    }, [checkVisiblePosts, markNewsBadgeSeen])
  );

  useEffect(() => {
    if (pathname === '/news') void markNewsBadgeSeen();
  }, [pathname, markNewsBadgeSeen]);

  const { refreshing: isRefreshing, reload: handleRefresh } = useReload(async () => {
    try {
      await refreshUser();
      await refresh();
      await markNewsBadgeSeen();
    } catch {
      // Keep the current list if the API is unreachable.
    }
  });

  const handleDelete = (post) => {
    Alert.alert(t('deleteNews'), t('deleteNewsMessage'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await removePost(post.id);
          } catch (error) {
            Alert.alert(t('couldNotSave'), error.message ?? t('tryAgain'));
          }
        },
      },
    ]);
  };

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView
          className="flex-1"
          onLayout={(event) => {
            viewportHeight.current = event.nativeEvent.layout.height;
            checkVisiblePosts();
          }}
          onScroll={(event) => {
            scrollOffset.current = event.nativeEvent.contentOffset.y;
            checkVisiblePosts();
          }}
          scrollEventThrottle={150}
          contentContainerClassName="px-four gap-two max-w-content self-center w-full"
          contentContainerStyle={{ paddingBottom: BottomTabGap }}
          alwaysBounceVertical
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }>
          <ThemedView
            className="flex-row items-center justify-between bg-transparent pb-four"
            style={{ paddingTop: 8 }}>
            <ThemedText type="subtitle">{t('news')}</ThemedText>
            {canManageNews ? (
              <PressScale onPress={() => router.push('/news/compose')} pressedScale={0.94}>
                <ThemedView
                  type="backgroundSelected"
                  className="w-[40px] h-[40px] rounded-five items-center justify-center">
                  <Ionicons name="add" size={22} color={theme.primary} />
                </ThemedView>
              </PressScale>
            ) : null}
          </ThemedView>
          {posts.length === 0 ? (
            <ThemedView className="items-center py-six bg-transparent">
              <ThemedText themeColor="textSecondary" className="text-center">
                {t('noNews')}
                {canManageNews ? t('tapToPublish') : ''}
              </ThemedText>
            </ThemedView>
          ) : (
            posts.map((post, index) => (
              <Animated.View
                key={post.id}
                entering={listEnter(index)}
                onLayout={(event) => {
                  const { y, height } = event.nativeEvent.layout;
                  postLayouts.current.set(String(post.id), { y, height });
                  checkVisiblePosts();
                }}>
                <PostCard
                  post={post}
                  onOpen={(item) => router.push(`/news/${item.id}`)}
                  onEdit={(item) => router.push({ pathname: '/news/compose', params: { id: String(item.id) } })}
                  onDelete={handleDelete}
                />
              </Animated.View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
