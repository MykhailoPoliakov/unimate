import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExternalLink } from '@/components/external-link';
import { GlassCard } from '@/components/glass-card';
import { useReload } from '@/components/reload-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useFeed } from '@/hooks/use-feed';
import { useI18n } from '@/hooks/use-i18n';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { mergeInstitutions, mergePrograms } from '@/constants/study-catalog';
import { listInstitutions, listPrograms, retractNewsPoll, voteNewsPoll } from '@/lib/api';

function formatNewsTime(iso, language) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const locale = language === 'uk' ? 'uk-UA' : language === 'ru' ? 'ru-RU' : language;
  return date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}

function NewsImage({ uri, height = 96 }) {
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

function MetaChips({ items }) {
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

function PollChoices({ post }) {
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
              {submitted ? (
                <ThemedView
                  className="absolute left-0 top-0 bottom-0"
                  style={{
                    width: `${percent}%`,
                    backgroundColor: theme.primary,
                    opacity: 0.22,
                  }}
                />
              ) : null}
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

function PostCard({ post, isAdmin, onOpen, onEdit, onDelete }) {
  const theme = useTheme();
  const { t, language } = useI18n();
  const created = formatNewsTime(post.createdAt, language);

  return (
    <GlassCard>
      <Pressable onPress={() => onOpen(post)} className="active:opacity-80">
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
            {created ? (
              <ThemedText style={{ fontSize: 11, color: theme.textSecondary, opacity: 0.55 }}>
                {created}
              </ThemedText>
            ) : null}
          </ThemedView>
        </ThemedView>
      </Pressable>
      {post.options?.length ? <PollChoices post={post} /> : null}
      {isAdmin ? (
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

function NewsReader({ post, onClose }) {
  const { t, language } = useI18n();
  const created = formatNewsTime(post.createdAt, language);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ThemedView className="flex-1">
        <SafeAreaView className="flex-1">
          <ThemedView className="flex-row items-center justify-between px-four py-three bg-transparent">
            <Pressable onPress={onClose} className="active:opacity-70">
              <ThemedText themeColor="primary">{t('close')}</ThemedText>
            </Pressable>
            <ThemedText type="smallBold">{t('news')}</ThemedText>
            <ThemedView className="w-[48px] bg-transparent" />
          </ThemedView>
          <ScrollView className="flex-1" contentContainerClassName="px-four py-three gap-three">
            <NewsImage uri={post.imageUrl} height={120} />
            <ThemedText type="default" className="text-[22px] font-semibold leading-7">
              {post.title}
            </ThemedText>
            {created ? (
              <ThemedText type="small" themeColor="textSecondary">
                {created}
              </ThemedText>
            ) : null}
            <MetaChips items={post.tags?.length ? post.tags : [post.audience]} />
            {post.body ? <ThemedText themeColor="textSecondary">{post.body}</ThemedText> : null}
            {post.linkUrl ? (
              <ExternalLink href={post.linkUrl}>
                <ThemedText type="small" themeColor="primary">
                  {post.linkLabel || t('openLink')}
                </ThemedText>
              </ExternalLink>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

function NewsModal({ visible, post, onClose }) {
  const theme = useTheme();
  const { t } = useI18n();
  const { profile } = useProfile();
  const { addPost, editPost } = useFeed();
  const [title, setTitle] = useState(post?.title ?? '');
  const [body, setBody] = useState(post?.body ?? '');
  const [imageUrl, setImageUrl] = useState(post?.imageUrl ?? '');
  const [linkUrl, setLinkUrl] = useState(post?.linkUrl ?? '');
  const [options, setOptions] = useState(
    post?.options?.length ? post.options : []
  );
  const [institutions, setInstitutions] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [everyone, setEveryone] = useState(true);
  const [institutionSlug, setInstitutionSlug] = useState(profile?.institution ?? null);
  const [programSlug, setProgramSlug] = useState(profile?.program ?? null);
  const [selectedYears, setSelectedYears] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  const pollOn = options.length > 0;
  const filledOptions = options.map((item) => item.trim()).filter(Boolean);
  const pollValid = !pollOn || filledOptions.length >= 2;
  const targetingValid = everyone || (!!institutionSlug && !!programSlug);
  const canSave = title.trim().length > 0 && pollValid && targetingValid && !isSaving;
  const isEdit = !!post;
  const selectedInstitution = institutions.find((item) => item.slug === institutionSlug);
  const selectedProgram = programs.find((item) => item.slug === programSlug);
  const maxYear = selectedProgram?.duration_years ?? 6;

  useEffect(() => {
    let cancelled = false;
    listInstitutions()
      .then((items) => {
        if (!cancelled) setInstitutions(mergeInstitutions(items));
      })
      .catch(() => {
        if (!cancelled) setInstitutions(mergeInstitutions([]));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (everyone || !institutionSlug) {
      setPrograms([]);
      return;
    }
    let cancelled = false;
    listPrograms(institutionSlug)
      .then((items) => {
        if (cancelled) return;
        const next = mergePrograms(institutionSlug, items);
        setPrograms(next);
        setProgramSlug((current) =>
          next.some((item) => item.slug === current) ? current : next[0]?.slug ?? null
        );
      })
      .catch(() => {
        if (!cancelled) setPrograms(mergePrograms(institutionSlug, []));
      });
    return () => {
      cancelled = true;
    };
  }, [everyone, institutionSlug]);

  const handleClose = () => {
    setTitle('');
    setBody('');
    setImageUrl('');
    setLinkUrl('');
    setSelectedYears([]);
    setOptions([]);
    onClose();
  };

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('couldNotSave'), t('photoPermission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.45,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset?.base64) {
      setImageUrl(`data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`);
      return;
    }
    if (asset?.uri) setImageUrl(asset.uri);
  };

  const audienceTags = () => {
    if (everyone) return [t('everyone')];
    const years =
      selectedYears.length > 0 && selectedYears.length < maxYear
        ? selectedYears
            .slice()
            .sort((a, b) => a - b)
            .map((year) => t('yearLabel', { n: year }))
        : [t('allYears')];
    return [selectedInstitution?.name, selectedProgram?.name, ...years].filter(Boolean);
  };

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    try {
      const payload = {
        title,
        body,
        options: pollOn ? filledOptions : [],
        imageUrl,
        linkUrl,
        tags: audienceTags(),
        audience: audienceTags().join(' · '),
        institution: everyone ? null : institutionSlug,
        program: everyone ? null : programSlug,
        yearMin: everyone || selectedYears.length === 0 ? null : Math.min(...selectedYears),
        yearMax: everyone || selectedYears.length === 0 ? null : Math.max(...selectedYears),
      };
      if (isEdit) await editPost({ id: post.id, ...payload });
      else await addPost(payload);
      handleClose();
    } catch (error) {
      Alert.alert(isEdit ? t('couldNotSave') : t('couldNotPublish'), error.message ?? t('tryAgain'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <ThemedView className="flex-1">
        <SafeAreaView className="flex-1">
          <KeyboardAvoidingView
            className="flex-1"
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ThemedView className="flex-row items-center justify-between px-four py-three bg-transparent">
              <Pressable onPress={handleClose} className="active:opacity-70">
                <ThemedText themeColor="primary">{t('cancel')}</ThemedText>
              </Pressable>
              <ThemedText type="smallBold">{isEdit ? t('editPost') : t('newPost')}</ThemedText>
              <Pressable onPress={handleSave} disabled={!canSave} className="active:opacity-70">
                <ThemedText themeColor={canSave ? 'primary' : 'textSecondary'} type="smallBold">
                  {isSaving ? '…' : isEdit ? t('save') : t('publish')}
                </ThemedText>
              </Pressable>
            </ThemedView>

            <ScrollView
              className="flex-1"
              contentContainerClassName="px-four py-three gap-three"
              keyboardShouldPersistTaps="handled">
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={t('title')}
                placeholderTextColor={theme.textSecondary}
                className="rounded-three px-three py-three text-base font-medium"
                style={{
                  backgroundColor: theme.backgroundElement,
                  color: theme.text,
                }}
              />
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder={t('details')}
                placeholderTextColor={theme.textSecondary}
                multiline
                className="rounded-three px-three py-three text-base font-medium min-h-[120px]"
                style={{
                  backgroundColor: theme.backgroundElement,
                  color: theme.text,
                  textAlignVertical: 'top',
                }}
              />
              <TextInput
                value={linkUrl}
                onChangeText={setLinkUrl}
                placeholder={t('newsLink')}
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                className="rounded-three px-three py-three text-base font-medium"
                style={{
                  backgroundColor: theme.backgroundElement,
                  color: theme.text,
                }}
              />
              <ThemedText type="small" themeColor="textSecondary">
                {t('imageUrl')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('imageHint')}
              </ThemedText>
              <ThemedView className="flex-row gap-three bg-transparent">
                <Pressable onPress={pickPhoto} className="active:opacity-70">
                  <ThemedText themeColor="primary">{t('choosePhoto')}</ThemedText>
                </Pressable>
                {imageUrl ? (
                  <Pressable onPress={() => setImageUrl('')} className="active:opacity-70">
                    <ThemedText themeColor="textSecondary">{t('removePhoto')}</ThemedText>
                  </Pressable>
                ) : null}
              </ThemedView>
              <NewsImage uri={imageUrl} height={140} />

              <ThemedText type="smallBold">{t('audience')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('audienceHint')}
              </ThemedText>
              <ThemedView className="flex-row gap-two bg-transparent">
                <Pressable onPress={() => setEveryone(true)} className="flex-1">
                  <ThemedView
                    type={everyone ? 'backgroundSelected' : 'backgroundElement'}
                    className="px-three py-three rounded-two items-center"
                    style={{ borderWidth: 1, borderColor: everyone ? theme.primary : theme.border }}>
                    <ThemedText type="smallBold" themeColor={everyone ? 'primary' : 'text'}>
                      {t('everyone')}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
                <Pressable onPress={() => setEveryone(false)} className="flex-1">
                  <ThemedView
                    type={!everyone ? 'backgroundSelected' : 'backgroundElement'}
                    className="px-three py-three rounded-two items-center"
                    style={{ borderWidth: 1, borderColor: !everyone ? theme.primary : theme.border }}>
                    <ThemedText type="smallBold" themeColor={!everyone ? 'primary' : 'text'}>
                      {t('specificAudience')}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              </ThemedView>
              {!everyone ? (
                <ThemedView className="gap-two bg-transparent">
                  <ThemedText type="small" themeColor="textSecondary">
                    1. {t('pickUniversity')}
                  </ThemedText>
                  {institutions.map((institution) => {
                    const selected = institutionSlug === institution.slug;
                    return (
                      <Pressable key={institution.slug} onPress={() => setInstitutionSlug(institution.slug)}>
                        <ThemedView
                          type={selected ? 'backgroundSelected' : 'backgroundElement'}
                          className="px-three py-three rounded-two"
                          style={{ borderWidth: 1, borderColor: selected ? theme.primary : theme.border }}>
                          <ThemedText type="smallBold" themeColor={selected ? 'primary' : 'text'}>
                            {institution.name}
                          </ThemedText>
                        </ThemedView>
                      </Pressable>
                    );
                  })}
                  <ThemedText type="small" themeColor="textSecondary">
                    2. {t('pickProgram')}
                  </ThemedText>
                  {programs.map((program) => {
                    const selected = programSlug === program.slug;
                    return (
                      <Pressable key={program.slug} onPress={() => setProgramSlug(program.slug)}>
                        <ThemedView
                          type={selected ? 'backgroundSelected' : 'backgroundElement'}
                          className="px-three py-three rounded-two"
                          style={{ borderWidth: 1, borderColor: selected ? theme.primary : theme.border }}>
                          <ThemedText type="smallBold" themeColor={selected ? 'primary' : 'text'}>
                            {program.name}
                          </ThemedText>
                        </ThemedView>
                      </Pressable>
                    );
                  })}
                  <ThemedText type="small" themeColor="textSecondary">
                    3. {t('pickYears')}
                  </ThemedText>
                  <ThemedView className="flex-row flex-wrap gap-two bg-transparent">
                    <Pressable onPress={() => setSelectedYears([])}>
                      <ThemedView
                        type={selectedYears.length === 0 ? 'backgroundSelected' : 'backgroundElement'}
                        className="px-three py-two rounded-two"
                        style={{
                          borderWidth: 1,
                          borderColor: selectedYears.length === 0 ? theme.primary : theme.border,
                        }}>
                        <ThemedText type="small" themeColor={selectedYears.length === 0 ? 'primary' : 'textSecondary'}>
                          {t('allYears')}
                        </ThemedText>
                      </ThemedView>
                    </Pressable>
                    {Array.from({ length: maxYear }, (_, index) => index + 1).map((year) => {
                      const selected = selectedYears.includes(year);
                      return (
                        <Pressable
                          key={year}
                          onPress={() =>
                            setSelectedYears((current) =>
                              current.includes(year)
                                ? current.filter((item) => item !== year)
                                : [...current, year].sort((a, b) => a - b)
                            )
                          }>
                          <ThemedView
                            type={selected ? 'backgroundSelected' : 'backgroundElement'}
                            className="px-three py-two rounded-two"
                            style={{ borderWidth: 1, borderColor: selected ? theme.primary : theme.border }}>
                            <ThemedText type="small" themeColor={selected ? 'primary' : 'textSecondary'}>
                              {t('yearLabel', { n: year })}
                            </ThemedText>
                          </ThemedView>
                        </Pressable>
                      );
                    })}
                  </ThemedView>
                </ThemedView>
              ) : null}

              {pollOn ? (
                <ThemedView className="gap-two bg-transparent">
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('pollHint')}
                  </ThemedText>
                  {options.map((option, index) => (
                    <ThemedView key={index} className="flex-row items-center gap-two bg-transparent">
                      <TextInput
                        value={option}
                        onChangeText={(value) => {
                          const next = [...options];
                          next[index] = value;
                          setOptions(next);
                        }}
                        placeholder={t('pollOption', { n: index + 1 })}
                        placeholderTextColor={theme.textSecondary}
                        className="flex-1 rounded-three px-three py-three text-base font-medium"
                        style={{
                          backgroundColor: theme.backgroundElement,
                          color: theme.text,
                        }}
                      />
                      {options.length > 2 ? (
                        <Pressable
                          onPress={() => setOptions(options.filter((_, itemIndex) => itemIndex !== index))}
                          className="active:opacity-70">
                          <Ionicons name="close-circle" size={22} color={theme.textSecondary} />
                        </Pressable>
                      ) : null}
                    </ThemedView>
                  ))}
                  <Pressable onPress={() => setOptions([...options, ''])} className="active:opacity-70">
                    <ThemedText themeColor="primary">{t('addOption')}</ThemedText>
                  </Pressable>
                  <Pressable onPress={() => setOptions([])} className="active:opacity-70">
                    <ThemedText themeColor="textSecondary">{t('removePoll')}</ThemedText>
                  </Pressable>
                </ThemedView>
              ) : (
                <Pressable onPress={() => setOptions(['', ''])} className="active:opacity-70">
                  <ThemedText themeColor="primary">{t('addPoll')}</ThemedText>
                </Pressable>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

export default function NewsScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const { profile, refreshUser } = useProfile();
  const { posts, removePost, refresh } = useFeed();
  const [composer, setComposer] = useState(null);
  const [reader, setReader] = useState(null);
  const isAdmin = profile?.role === 'admin';

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
      <SafeAreaView className="flex-1" edges={['top']}>
        <ThemedView className="flex-row items-center justify-between px-four pt-three pb-two bg-transparent">
          <ThemedText type="subtitle">{t('news')}</ThemedText>
          {isAdmin ? (
            <Pressable onPress={() => setComposer({})} className="active:opacity-70">
              <ThemedView
                type="backgroundSelected"
                className="w-[40px] h-[40px] rounded-five items-center justify-center">
                <Ionicons name="add" size={22} color={theme.primary} />
              </ThemedView>
            </Pressable>
          ) : null}
        </ThemedView>

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
          {posts.length === 0 ? (
            <ThemedView className="items-center py-six bg-transparent">
              <ThemedText themeColor="textSecondary" className="text-center">
                {t('noNews')}
                {isAdmin ? t('tapToPublish') : ''}
              </ThemedText>
            </ThemedView>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                isAdmin={isAdmin}
                onOpen={setReader}
                onEdit={(item) => setComposer(item)}
                onDelete={handleDelete}
              />
            ))
          )}
        </ScrollView>
      </SafeAreaView>
      {reader ? <NewsReader post={reader} onClose={() => setReader(null)} /> : null}
      {composer ? (
        <NewsModal
          key={composer.id ?? 'new'}
          visible
          post={composer.id ? composer : null}
          onClose={() => setComposer(null)}
        />
      ) : null}
    </ThemedView>
  );
}
