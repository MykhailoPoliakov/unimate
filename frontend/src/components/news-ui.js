import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ExternalLink } from '@/components/external-link';
import { GlassCard } from '@/components/glass-card';
import { PressScale } from '@/components/motion';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useFeed } from '@/hooks/use-feed';
import { useI18n } from '@/hooks/use-i18n';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { retractNewsPoll, voteNewsPoll } from '@/lib/api';

export function formatNewsTime(iso, language) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const locale = language === 'uk' ? 'uk-UA' : language === 'ru' ? 'ru-RU' : language;
  return date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}

export function NewsImage({ uri, height = 96 }) {
  const [failed, setFailed] = useState(false);
  if (!uri?.trim() || failed) return null;
  return (
    <Image
      source={{ uri: uri.trim() }}
      style={{ width: '100%', height, backgroundColor: 'transparent' }}
      contentFit="cover"
      onError={() => setFailed(true)}
    />
  );
}

export function MetaChips({ items }) {
  const labels = (items ?? []).map((item) => String(item).trim()).filter(Boolean);
  if (!labels.length) return null;
  return (
    <ThemedView className="flex-row flex-wrap gap-one bg-transparent">
      {labels.map((label) => (
        <ThemedView
          key={label}
          type="backgroundSelected"
          className="px-two py-half rounded-two">
          <ThemedText type="small" themeColor="primary">
            {label}
          </ThemedText>
        </ThemedView>
      ))}
    </ThemedView>
  );
}

function PollFill({ percent, color }) {
  const [track, setTrack] = useState(0);
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(track * (percent / 100), { duration: 400 });
  }, [percent, track, width]);

  const fillStyle = useAnimatedStyle(() => ({
    width: width.value,
  }));

  return (
    <View
      pointerEvents="none"
      onLayout={(event) => setTrack(event.nativeEvent.layout.width)}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
      }}>
      <Animated.View
        style={[
          {
            height: '100%',
            backgroundColor: color,
            opacity: 0.22,
          },
          fillStyle,
        ]}
      />
    </View>
  );
}

export function PollChoices({ post }) {
  const theme = useTheme();
  const { t } = useI18n();
  const { profile } = useProfile();
  const { applyPoll } = useFeed();
  const lock = useRef(false);
  const [isVoting, setIsVoting] = useState(false);

  if (!post.options?.length) return null;

  const poll = post.poll;
  const options = poll?.options?.length ? poll.options : post.options;
  const counts = poll?.counts ?? options.map(() => 0);
  const total = poll?.total ?? 0;
  const submitted = typeof poll?.your_vote === 'number';

  const runLocked = async (action) => {
    if (!profile?.userId || lock.current) return;
    lock.current = true;
    setIsVoting(true);
    try {
      applyPoll(post.id, await action());
    } catch (error) {
      Alert.alert(t('couldNotSave'), error.message ?? t('tryAgain'));
    } finally {
      lock.current = false;
      setIsVoting(false);
    }
  };

  const handleVote = (index) => {
    if (submitted) return;
    runLocked(() => voteNewsPoll(profile.userId, post.id, index));
  };

  const handleRetract = () => {
    if (!submitted) return;
    runLocked(() => retractNewsPoll(profile.userId, post.id));
  };

  return (
    <ThemedView className="gap-two px-three pb-three bg-transparent">
      {options.map((label, index) => {
        const isSelected = poll?.your_vote === index;
        const count = counts[index] ?? 0;
        const percent = submitted && total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <Pressable
            key={`${post.id}-${index}`}
            onPress={() => handleVote(index)}
            disabled={submitted || isVoting}
            className="active:opacity-70">
            <ThemedView
              type={isSelected ? 'backgroundSelected' : 'backgroundElement'}
              className="px-three py-three rounded-two overflow-hidden"
              style={{
                borderWidth: 1,
                borderColor: isSelected ? theme.primary : theme.border,
              }}>
              {submitted ? <PollFill percent={percent} color={theme.primary} /> : null}
              <ThemedView className="flex-row items-center justify-between bg-transparent">
                <ThemedText type="smallBold" themeColor={isSelected ? 'primary' : 'text'} className="flex-1 pr-two">
                  {label}
                </ThemedText>
                {submitted ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {percent}%
                  </ThemedText>
                ) : null}
              </ThemedView>
            </ThemedView>
          </Pressable>
        );
      })}
      <ThemedView className="flex-row items-center justify-between bg-transparent">
        <ThemedText type="small" themeColor="textSecondary">
          {t('voteCount', { n: total })}
        </ThemedText>
        {submitted ? (
          <Pressable onPress={handleRetract} disabled={isVoting} className="active:opacity-70">
            <ThemedText type="small" themeColor="primary">
              {t('retractVote')}
            </ThemedText>
          </Pressable>
        ) : null}
      </ThemedView>
    </ThemedView>
  );
}

export function PostCard({ post, onOpen, onEdit, onDelete }) {
  const theme = useTheme();
  const { t, language } = useI18n();
  const created = formatNewsTime(post.createdAt, language);

  return (
    <GlassCard>
      <PressScale onPress={() => onOpen(post)}>
        <NewsImage uri={post.imageUrl} />
        <ThemedView className="gap-one px-three pt-three pb-two bg-transparent">
          <ThemedText type="default" className="text-[22px] font-semibold leading-7">
            {post.title}
          </ThemedText>
          {post.body ? (
            <ThemedText themeColor="textSecondary" numberOfLines={3}>
              {post.body}
            </ThemedText>
          ) : null}
          <ThemedView className="flex-row items-center justify-between bg-transparent mt-half">
            {post.linkUrl ? (
              <ExternalLink href={post.linkUrl}>
                <ThemedText type="small" themeColor="primary">
                  {t('openLink')}
                </ThemedText>
              </ExternalLink>
            ) : (
              <ThemedView className="bg-transparent" />
            )}
            <ThemedView className="items-end bg-transparent">
              {created ? (
                <ThemedText style={{ fontSize: 11, color: theme.textSecondary, opacity: 0.55 }}>
                  {created}
                </ThemedText>
              ) : null}
              {post.authorId ? (
                <ThemedText style={{ fontSize: 11, color: theme.textSecondary, opacity: 0.55 }}>
                  {t('postedBy', { id: post.authorId })}
                </ThemedText>
              ) : null}
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </PressScale>
      {post.options?.length ? <PollChoices post={post} /> : null}
      {post.canManage ? (
        <ThemedView className="flex-row gap-three px-three pb-three bg-transparent">
          <Pressable onPress={() => onEdit(post)} className="active:opacity-70">
            <ThemedText type="small" themeColor="primary">
              {t('edit')}
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => onDelete(post)} className="active:opacity-70">
            <ThemedText type="small" style={{ color: theme.error }}>
              {t('delete')}
            </ThemedText>
          </Pressable>
        </ThemedView>
      ) : null}
    </GlassCard>
  );
}
