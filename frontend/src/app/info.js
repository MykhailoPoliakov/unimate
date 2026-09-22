import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
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

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useFeed } from '@/hooks/use-feed';
import { useI18n } from '@/hooks/use-i18n';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { getNewsPoll, listInstitutions, listPrograms, voteNewsPoll } from '@/lib/api';

function NewsImage({ uri, height = 160 }) {
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
  const [poll, setPoll] = useState(null);
  const [pick, setPick] = useState(null);
  const [isEditing, setIsEditing] = useState(true);
  const [isVoting, setIsVoting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!post.options?.length || !profile?.userId) return undefined;
    getNewsPoll(profile.userId, post.id)
      .then((data) => {
        if (cancelled) return;
        setPoll(data);
        const voted = typeof data.your_vote === 'number';
        setPick(voted ? data.your_vote : null);
        setIsEditing(!voted);
      })
      .catch(() => {
        if (cancelled) return;
        setPoll({
          options: post.options,
          counts: post.options.map(() => 0),
          total: 0,
          your_vote: null,
        });
        setPick(null);
        setIsEditing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [post.id, post.options, profile?.userId]);

  if (!post.options?.length) return null;

  const options = poll?.options?.length ? poll.options : post.options;
  const counts = poll?.counts ?? options.map(() => 0);
  const total = poll?.total ?? 0;
  const submitted = typeof poll?.your_vote === 'number';
  const canSubmit =
    !isVoting &&
    pick != null &&
    isEditing &&
    (poll?.your_vote !== pick || !submitted);

  const handleSubmit = async () => {
    if (!profile?.userId || !canSubmit) return;
    setIsVoting(true);
    try {
      const data = await voteNewsPoll(profile.userId, post.id, pick);
      setPoll(data);
      setPick(data.your_vote);
      setIsEditing(false);
    } catch (error) {
      Alert.alert(t('couldNotSave'), error.message ?? t('tryAgain'));
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <ThemedView className="gap-two bg-transparent">
      <ThemedText type="smallBold">{t('poll')}</ThemedText>
      {options.map((label, index) => {
        const isSelected = pick === index;
        const count = counts[index] ?? 0;
        const percent = submitted && total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <Pressable
            key={`${post.id}-${index}`}
            onPress={() => isEditing && setPick(index)}
            disabled={!isEditing || isVoting}
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
      <ThemedText type="small" themeColor="textSecondary">
        {t('voteCount', { n: total })}
        {submitted && options[poll.your_vote] ? ` · ${t('youVoted')}: ${options[poll.your_vote]}` : ''}
      </ThemedText>
      {isEditing ? (
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          className="active:opacity-70">
          <ThemedView
            type="backgroundSelected"
            className="items-center py-three rounded-three"
            style={{ opacity: canSubmit ? 1 : 0.45 }}>
            <ThemedText type="smallBold" themeColor={canSubmit ? 'primary' : 'textSecondary'}>
              {isVoting ? '…' : t('submitVote')}
            </ThemedText>
          </ThemedView>
        </Pressable>
      ) : (
        <Pressable onPress={() => setIsEditing(true)} className="active:opacity-70">
          <ThemedView type="backgroundElement" className="items-center py-three rounded-three" style={{ borderWidth: 1, borderColor: theme.border }}>
            <ThemedText type="smallBold" themeColor="primary">
              {t('changeChoice')}
            </ThemedText>
          </ThemedView>
        </Pressable>
      )}
    </ThemedView>
  );
}

function PostCard({ post, isAdmin, onOpen, onEdit, onDelete }) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <ThemedView type="backgroundElement" className="rounded-three overflow-hidden">
      <Pressable onPress={() => onOpen(post)} className="active:opacity-80">
        <NewsImage uri={post.imageUrl} />
        <ThemedView className="gap-two px-three py-three bg-transparent">
          <ThemedView className="flex-row items-center gap-two bg-transparent">
            <ThemedView
              type="backgroundSelected"
              className="w-[36px] h-[36px] rounded-two items-center justify-center">
              <Ionicons name="newspaper" size={18} color={theme.primary} />
            </ThemedView>
            <ThemedView className="flex-1 bg-transparent">
              <ThemedText type="small" themeColor="primary">
                {t('news')}
              </ThemedText>
          <ThemedText type="smallBold">{post.title}</ThemedText>
          </ThemedView>
        </ThemedView>
          <MetaChips items={post.tags?.length ? post.tags : [post.audience]} />
          {post.body ? (
            <ThemedText themeColor="textSecondary" numberOfLines={3}>
              {post.body}
            </ThemedText>
          ) : null}
          {post.options?.length ? (
            <ThemedText type="small" themeColor="primary">
              {t('poll')}
            </ThemedText>
          ) : null}
        </ThemedView>
      </Pressable>
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
    </ThemedView>
  );
}

function NewsReader({ post, onClose }) {
  const { t } = useI18n();

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
            <NewsImage uri={post.imageUrl} height={200} />
            <ThemedText type="smallBold">{post.title}</ThemedText>
            <MetaChips items={post.tags?.length ? post.tags : [post.audience]} />
            {post.body ? <ThemedText themeColor="textSecondary">{post.body}</ThemedText> : null}
            <PollChoices post={post} />
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
        if (!cancelled) setInstitutions(items);
      })
      .catch(() => {
        if (!cancelled) setInstitutions([]);
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
        setPrograms(items);
        setProgramSlug((current) =>
          items.some((item) => item.slug === current) ? current : items[0]?.slug ?? null
        );
      })
      .catch(() => {
        if (!cancelled) setPrograms([]);
      });
    return () => {
      cancelled = true;
    };
  }, [everyone, institutionSlug]);

  const handleClose = () => {
    setTitle('');
    setBody('');
    setImageUrl('');
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

export default function InfoScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const { profile, refreshUser } = useProfile();
  const { posts, removePost, refresh } = useFeed();
  const [composer, setComposer] = useState(null);
  const [reader, setReader] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isAdmin = profile?.role === 'admin';

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshUser();
      await refresh();
    } catch {
      // Keep the current list if the API is unreachable.
    } finally {
      setIsRefreshing(false);
    }
  };

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
          <ThemedText type="subtitle">{t('info')}</ThemedText>
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
