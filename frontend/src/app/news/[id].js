import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { Alert, Pressable, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import Animated from 'react-native-reanimated';

import { fadeIn } from '@/components/motion';
import { formatNewsTime, MetaChips, NewsFooter, NewsImage, newsAudienceLabels, PollChoices } from '@/components/news-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useFeed } from '@/hooks/use-feed';
import { BottomTabGap } from '@/constants/theme';
import { useI18n } from '@/hooks/use-i18n';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';

export default function NewsDetailScreen() {
  const { id } = useLocalSearchParams();
  const { t, language } = useI18n();
  const { posts, markNewsItemRead, recordNewsView } = useFeed();
  const { profile } = useProfile();
  const theme = useTheme();
  const post = posts.find((item) => String(item.id) === String(id));
  const created = formatNewsTime(post?.createdAt, language);

  const copyAuthorId = async () => {
    if (profile?.role !== 'admin' || !post?.authorId) return;
    try {
      const copied = await Clipboard.setStringAsync(post.authorId);
      if (!copied) throw new Error('Clipboard write failed');
      Alert.alert(t('copied'), t('idCopied'));
    } catch {
      Alert.alert(t('couldNotSave'), t('tryAgain'));
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (id) void markNewsItemRead(id);
      if (id) {
        recordNewsView(id).catch((error) => {
          console.error('Failed to record news view', error);
        });
      }
    }, [id, markNewsItemRead, recordNewsView])
  );

  return (
    <ThemedView className="flex-1">
      <Stack.Screen options={{ title: post?.title || t('news') }} />
      {!post ? (
        <ThemedView className="flex-1 items-center justify-center px-four">
          <ThemedText themeColor="textSecondary">{t('noNews')}</ThemedText>
        </ThemedView>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-four py-three gap-three"
          contentContainerStyle={{ paddingBottom: BottomTabGap }}>
          <Animated.View entering={fadeIn} style={{ gap: 12 }}>
            <NewsImage uri={post.imageUrl} />
            <ThemedText type="default" className="text-[22px] font-semibold leading-7">
              {post.title}
            </ThemedText>
            {created ? (
              <ThemedText type="small" themeColor="textSecondary">
                {created}
              </ThemedText>
            ) : null}
            {post.authorId ? (
              <ThemedView className="flex-row items-center gap-two bg-transparent">
                <ThemedText type="small" themeColor="textSecondary">
                  {t('postedBy', { id: post.authorId })}
                </ThemedText>
                {profile?.role === 'admin' ? (
                  <Pressable
                    onPress={copyAuthorId}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={t('copyId')}
                    className="active:opacity-70">
                    <Ionicons name="copy-outline" size={16} color={theme.textSecondary} />
                  </Pressable>
                ) : null}
              </ThemedView>
            ) : null}
            {profile?.role === 'admin' && Number.isInteger(post.viewCount) ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('newsViews', { n: post.viewCount })}
              </ThemedText>
            ) : null}
            <MetaChips items={newsAudienceLabels(post, t)} />
            {post.body ? <ThemedText themeColor="textSecondary">{post.body}</ThemedText> : null}
            {post.options?.length ? <PollChoices post={post} flush /> : null}
            <NewsFooter post={post} onOpenLink={() => markNewsItemRead(post.id)} />
          </Animated.View>
        </ScrollView>
      )}
    </ThemedView>
  );
}
