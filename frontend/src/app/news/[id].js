import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView } from 'react-native';
import Animated from 'react-native-reanimated';

import { fadeIn } from '@/components/motion';
import { formatNewsTime, MetaChips, NewsImage, NewsLinkButton, PollChoices } from '@/components/news-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useFeed } from '@/hooks/use-feed';
import { BottomTabGap } from '@/constants/theme';
import { useI18n } from '@/hooks/use-i18n';

export default function NewsDetailScreen() {
  const { id } = useLocalSearchParams();
  const { t, language } = useI18n();
  const { posts, markNewsItemRead } = useFeed();
  const post = posts.find((item) => String(item.id) === String(id));
  const created = formatNewsTime(post?.createdAt, language);

  useFocusEffect(
    useCallback(() => {
      if (id) void markNewsItemRead(id);
    }, [id, markNewsItemRead])
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
              <ThemedText type="small" themeColor="textSecondary">
                {t('postedBy', { id: post.authorId })}
              </ThemedText>
            ) : null}
            <MetaChips items={post.tags?.length ? post.tags : [post.audience]} />
            {post.body ? <ThemedText themeColor="textSecondary">{post.body}</ThemedText> : null}
            {post.options?.length ? <PollChoices post={post} /> : null}
            {post.linkUrl ? (
              <NewsLinkButton
                href={post.linkUrl}
                label={post.linkLabel}
                onPress={() => markNewsItemRead(post.id)}
              />
            ) : null}
          </Animated.View>
        </ScrollView>
      )}
    </ThemedView>
  );
}
