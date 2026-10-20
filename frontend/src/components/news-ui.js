import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Share, View } from 'react-native';

import { catalogInstitution, mergePrograms } from '@/constants/study-catalog';
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

const NEWS_IMAGE_RATIO = 3 / 2;
const NEWS_LIST_IMAGE_RATIO = 2;

export function NewsImage({ uri, height, compact = false }) {
  const [failed, setFailed] = useState(false);
  if (!uri?.trim() || failed) return null;
  return (
    <Image
      source={{ uri: uri.trim() }}
      style={
        height
          ? { width: '100%', height, backgroundColor: 'transparent' }
          : { width: '100%', aspectRatio: compact ? NEWS_LIST_IMAGE_RATIO : NEWS_IMAGE_RATIO, backgroundColor: 'transparent' }
      }
      contentFit="cover"
      onError={() => setFailed(true)}
    />
  );
}

export function institutionChip(slug, name) {
  if (String(slug || '').toLowerCase() === 'kdg') return 'KdG';
  const label = (name || slug || '').replace(/\s+university$/i, '').trim();
  return label;
}

export function audienceLabels({
  everyone,
  institutionName,
  programNames = [],
  selectedProgramCount = 0,
  allProgramCount = 0,
  years = [],
  allYearCount = 0,
  t,
}) {
  if (everyone || !institutionName) return [];
  const allPrograms = allProgramCount > 0 && selectedProgramCount >= allProgramCount;
  const sortedYears = [...years]
    .map((year) => Number(year))
    .filter((year) => Number.isFinite(year))
    .sort((a, b) => a - b);
  const coversEveryYear =
    allYearCount > 0 &&
    sortedYears.length >= allYearCount &&
    Array.from({ length: allYearCount }, (_, index) => index + 1).every((year) => sortedYears.includes(year));
  const allYears = sortedYears.length === 0 || coversEveryYear;
  if (allPrograms && allYears) return [institutionName];
  const chips = allPrograms ? [institutionName] : programNames.filter(Boolean);
  if (!allYears) chips.push(...sortedYears.map((year) => t('yearLabel', { n: year })));
  return chips.filter(Boolean);
}

export function newsAudienceLabels(post, t) {
  if (!post?.institution) return [];
  const catalog = catalogInstitution(post.institution);
  const programs = mergePrograms(post.institution, []);
  const selected = post.programs ?? [];
  const chosen = selected.length ? programs.filter((item) => selected.includes(item.slug)) : programs;
  const names = selected.map((slug) => programs.find((item) => item.slug === slug)?.name ?? slug);
  const maxYear = chosen.length ? Math.max(...chosen.map((item) => item.duration_years || 0)) : 0;
  return audienceLabels({
    institutionName: institutionChip(post.institution, catalog?.name),
    programNames: names,
    selectedProgramCount: selected.length ? selected.length : programs.length,
    allProgramCount: programs.length,
    years: post.years ?? [],
    allYearCount: maxYear,
    t,
  });
}

function newsShareText(post) {
  return [post?.title, post?.body, post?.linkUrl].map((item) => item?.trim()).filter(Boolean).join('\n\n');
}

export function NewsShareButton({ post }) {
  const theme = useTheme();
  const { t } = useI18n();

  const share = () => {
    const message = newsShareText(post);
    const payload = post?.linkUrl ? { message, url: post.linkUrl } : { message };
    Share.share(payload).catch(() => {});
  };

  return (
    <Pressable
      onPress={share}
      accessibilityRole="button"
      accessibilityLabel={t('share')}
      style={{
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.backgroundElement,
        borderWidth: 1,
        borderColor: theme.border,
      }}>
      <Ionicons name="share-outline" size={22} color={theme.primary} />
    </Pressable>
  );
}

export function NewsFooter({ post, onOpenLink }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {post.linkUrl ? (
        <View style={{ flex: 1 }}>
          <NewsLinkButton href={post.linkUrl} label={post.linkLabel} onPress={onOpenLink} />
        </View>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      <NewsShareButton post={post} />
    </View>
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

export function PollChoices({ post, flush = false }) {
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
    <ThemedView className={`gap-two bg-transparent ${flush ? '' : 'px-three pb-three'}`}>
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

export function NewsLinkButton({ href, label, onPress }) {
  const theme = useTheme();
  const { t } = useI18n();
  const text = label?.trim() || t('openLink');

  return (
    <ExternalLink
      href={href}
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={text}
      style={{
        minHeight: 48,
        borderRadius: 14,
        backgroundColor: theme.primary,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}>
      <Ionicons name="open-outline" size={20} color={theme.background} />
      <ThemedText type="smallBold" style={{ color: theme.background, flexShrink: 1 }} numberOfLines={2}>
        {text}
      </ThemedText>
    </ExternalLink>
  );
}

export function PostCard({ post, onOpen, onEdit, onDelete }) {
  const theme = useTheme();
  const { t, language } = useI18n();
  const { profile } = useProfile();
  const { isNewsUnread, markNewsItemRead } = useFeed();
  const unread = isNewsUnread(post);
  const created = formatNewsTime(post.createdAt, language);
  const showPoll = post.options?.length && typeof post.poll?.your_vote !== 'number';

  return (
    <GlassCard
      solid
      style={{
        backgroundColor: unread ? theme.backgroundElement : theme.cardMuted,
        borderColor: unread ? theme.border : theme.background,
      }}>
      <PressScale onPress={() => onOpen(post)}>
        <NewsImage uri={post.imageUrl} compact />
        <ThemedView className="gap-half px-three pt-two pb-one bg-transparent">
          <ThemedText
            type="default"
            className="text-[18px] leading-6"
            style={{
              fontWeight: unread ? '700' : '500',
              color: unread ? theme.text : theme.textSecondary,
            }}>
            {post.title}
          </ThemedText>
          {post.body ? (
            <ThemedText
              themeColor="textSecondary"
              numberOfLines={2}
              style={{ opacity: unread ? 1 : 0.78 }}>
              {post.body}
            </ThemedText>
          ) : null}
          <ThemedView className="items-end bg-transparent mt-half">
              {created ? (
                <ThemedText style={{ fontSize: 11, color: theme.textSecondary, opacity: unread ? 0.8 : 0.55 }}>
                  {created}
                </ThemedText>
              ) : null}
              {post.authorId ? (
                <ThemedText style={{ fontSize: 11, color: theme.textSecondary, opacity: unread ? 0.8 : 0.55 }}>
                  {t('postedBy', { id: post.authorId })}
                </ThemedText>
              ) : null}
              {profile?.role === 'admin' && Number.isInteger(post.viewCount) ? (
                <ThemedText style={{ fontSize: 11, color: theme.textSecondary, opacity: 0.7 }}>
                  {t('newsViews', { n: post.viewCount })}
                </ThemedText>
              ) : null}
            </ThemedView>
        </ThemedView>
      </PressScale>
      {post.canManage ? (
        <ThemedView className="flex-row gap-three px-three pb-two bg-transparent">
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
      {showPoll ? <PollChoices post={post} /> : null}
      <ThemedView className="px-three pb-two bg-transparent">
        <NewsFooter post={post} onOpenLink={() => markNewsItemRead(post.id)} />
      </ThemedView>
    </GlassCard>
  );
}
