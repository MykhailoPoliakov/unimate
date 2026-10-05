import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PostCard } from '@/components/news-ui';
import { useReload } from '@/components/reload-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useFeed } from '@/hooks/use-feed';
import { useI18n } from '@/hooks/use-i18n';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';

export default function NewsScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, refreshUser } = useProfile();
  const { posts, removePost, refresh, markNewsRead } = useFeed();
  const canManageNews = ['admin', 'moderator'].includes(profile?.role);

  useFocusEffect(
    useCallback(() => {
      return () => {
        void markNewsRead();
      };
    }, [markNewsRead])
  );

  const { refreshing: isRefreshing, reload: handleRefresh } = useReload(async () => {
    try {
      await refreshUser();
      await refresh();
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
      <SafeAreaView className="flex-1" edges={[]}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-four pb-bottom-tab-gap gap-two max-w-content self-center w-full"
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
            style={{ paddingTop: (insets.top || 59) + 8 }}>
            <ThemedText type="subtitle">{t('news')}</ThemedText>
            {canManageNews ? (
              <Pressable onPress={() => router.push('/news/compose')} className="active:opacity-70">
                <ThemedView
                  type="backgroundSelected"
                  className="w-[40px] h-[40px] rounded-five items-center justify-center">
                  <Ionicons name="add" size={22} color={theme.primary} />
                </ThemedView>
              </Pressable>
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
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onOpen={(item) => router.push(`/news/${item.id}`)}
                onEdit={(item) => router.push({ pathname: '/news/compose', params: { id: String(item.id) } })}
                onDelete={handleDelete}
              />
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
