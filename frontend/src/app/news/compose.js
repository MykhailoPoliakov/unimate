import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native';

import { NewsImage } from '@/components/news-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useFeed } from '@/hooks/use-feed';
import { useI18n } from '@/hooks/use-i18n';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { mergeInstitutions, mergePrograms } from '@/constants/study-catalog';
import { cooldownMessage, listInstitutions, listPrograms } from '@/lib/api';
import { moderatorScope, withinModeratorInstitutions, withinModeratorPrograms, withinModeratorYears } from '@/lib/moderator-scope';

export default function NewsComposeScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { profile } = useProfile();
  const { posts, addPost, editPost } = useFeed();
  const post = id ? posts.find((item) => String(item.id) === String(id)) : null;

  const [title, setTitle] = useState(post?.title ?? '');
  const [body, setBody] = useState(post?.body ?? '');
  const [imageUrl, setImageUrl] = useState(post?.imageUrl ?? '');
  const [linkUrl, setLinkUrl] = useState(post?.linkUrl ?? '');
  const [options, setOptions] = useState(post?.options?.length ? post.options : []);
  const [institutions, setInstitutions] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [everyone, setEveryone] = useState(post ? !post.institution : false);
  const [institutionSlug, setInstitutionSlug] = useState(post?.institution ?? null);
  const [programSlugs, setProgramSlugs] = useState(post?.programs ?? []);
  const [selectedYears, setSelectedYears] = useState(post?.years ?? []);
  const [isSaving, setIsSaving] = useState(false);

  const isModerator = profile?.role === 'moderator';
  const scope = moderatorScope(profile);
  const canTargetEveryone = !scope;
  const pollOn = options.length > 0;
  const filledOptions = options.map((item) => item.trim()).filter(Boolean);
  const pollValid = !pollOn || filledOptions.length >= 2;
  const targetingValid =
    everyone || (!!institutionSlug && programSlugs.length > 0 && selectedYears.length > 0);
  const canSave = title.trim().length > 0 && pollValid && targetingValid && !isSaving;
  const isEdit = !!post;
  const selectedInstitution = institutions.find((item) => item.slug === institutionSlug);
  const selectedPrograms = programs.filter((item) => programSlugs.includes(item.slug));
  const yearSource = selectedPrograms.length ? selectedPrograms : programs;
  const maxYear = yearSource.length ? Math.max(...yearSource.map((item) => item.duration_years)) : 0;
  const yearChoices = withinModeratorYears(
    Array.from({ length: maxYear }, (_, index) => index + 1),
    scope
  );

  useEffect(() => {
    if (isModerator) setEveryone(false);
  }, [isModerator]);

  useEffect(() => {
    let cancelled = false;
    const local = withinModeratorInstitutions(mergeInstitutions([]), scope);
    setInstitutions(local);
    listInstitutions()
      .then((items) => {
        if (!cancelled) setInstitutions(withinModeratorInstitutions(mergeInstitutions(items), scope));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isModerator, profile?.moderatorInstitutions]);

  useEffect(() => {
    if (everyone || !institutionSlug) {
      setPrograms([]);
      return;
    }
    const local = withinModeratorPrograms(mergePrograms(institutionSlug, []), scope);
    setPrograms(local);
    let cancelled = false;
    listPrograms(institutionSlug)
      .then((items) => {
        if (cancelled) return;
        setPrograms(withinModeratorPrograms(mergePrograms(institutionSlug, items), scope));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [everyone, institutionSlug, isModerator, profile?.moderatorPrograms]);

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
    const years = selectedYears
      .slice()
      .sort((a, b) => a - b)
      .map((year) => t('yearLabel', { n: year }));
    return [
      selectedInstitution?.name,
      ...selectedPrograms.map((item) => item.name),
      ...years,
    ].filter(Boolean);
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
        programs: everyone ? [] : programSlugs,
        years: everyone ? [] : selectedYears,
      };
      if (isEdit) await editPost({ id: post.id, ...payload });
      else await addPost(payload);
      router.back();
    } catch (error) {
      Alert.alert(
        isEdit ? t('couldNotSave') : t('couldNotPublish'),
        cooldownMessage(error, t, error.message ?? t('tryAgain'))
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ThemedView className="flex-1">
      <Stack.Screen
        options={{
          title: isEdit ? t('editPost') : t('newPost'),
          headerRight: () => (
            <Pressable
              onPress={handleSave}
              disabled={!canSave}
              className="active:opacity-70"
              hitSlop={8}
              style={{ paddingHorizontal: 10 }}>
              <ThemedText
                themeColor={canSave ? 'primary' : 'textSecondary'}
                numberOfLines={1}
                style={{ fontSize: 17, fontWeight: '600' }}>
                {isSaving ? '…' : isEdit ? t('save') : t('publish')}
              </ThemedText>
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-four py-three gap-three pb-bottom-tab-gap"
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
          {canTargetEveryone ? (
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
          ) : null}
          {!everyone ? (
            <ThemedView className="gap-two bg-transparent">
              <ThemedText type="small" themeColor="textSecondary">
                1. {t('pickUniversity')}
              </ThemedText>
              {institutions.map((institution) => {
                const selected = institutionSlug === institution.slug;
                return (
                  <Pressable
                    key={institution.slug}
                    onPress={() => {
                      setInstitutionSlug(institution.slug);
                      setProgramSlugs([]);
                    }}>
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
                const selected = programSlugs.includes(program.slug);
                return (
                  <Pressable
                    key={program.slug}
                    onPress={() =>
                      setProgramSlugs((current) =>
                        current.includes(program.slug)
                          ? current.filter((slug) => slug !== program.slug)
                          : [...current, program.slug]
                      )
                    }>
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
                {yearChoices.map((year) => {
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
    </ThemedView>
  );
}
