import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native';

import { SocialBrandIcon } from '@/components/social-brand-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useI18n } from '@/hooks/use-i18n';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { mergeInstitutions, mergePrograms } from '@/constants/study-catalog';
import { LANGUAGES } from '@/i18n/translations';
import { cooldownMessage, createSocial, listInstitutions, listPrograms, updateSocial } from '@/lib/api';
import { getSocialDraft } from '@/lib/nav-draft';
import { moderatorScope, withinModeratorInstitutions, withinModeratorPrograms, withinModeratorYears } from '@/lib/moderator-scope';
import {
  brandForIcon,
  detectService,
  iconOnBrand,
  MANUAL_ICONS,
  normalizeUrl,
  resolveIconName,
} from '@/lib/social-service';

export default function SocialComposeScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const { profile } = useProfile();
  const item = getSocialDraft();
  const [url, setUrl] = useState(item?.url ?? '');
  const [title, setTitle] = useState(item?.title ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [icon, setIcon] = useState(item?.icon ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [institutions, setInstitutions] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [everyone, setEveryone] = useState(item ? !item.institution : false);
  const [institutionSlug, setInstitutionSlug] = useState(item?.institution ?? null);
  const [programSlugs, setProgramSlugs] = useState(item?.programs ?? []);
  const [selectedYears, setSelectedYears] = useState(item?.years ?? []);
  const isEdit = !!item;

  const detected = useMemo(() => detectService(url), [url]);
  const hasLink = Boolean(url.trim());
  const resolvedIcon = hasLink
    ? resolveIconName(icon || detected?.icon || 'globe-outline')
    : 'globe-outline';
  const targetingValid =
    everyone || (!!institutionSlug && programSlugs.length > 0 && selectedYears.length > 0);
  const canSave =
    normalizeUrl(url).length > 8 && title.trim().length > 0 && targetingValid && !isSaving;
  const selectedInstitution = institutions.find((row) => row.slug === institutionSlug);
  const selectedPrograms = programs.filter((row) => programSlugs.includes(row.slug));
  const yearSource = selectedPrograms.length ? selectedPrograms : programs;
  const maxYear = yearSource.length ? Math.max(...yearSource.map((row) => row.duration_years)) : 0;
  const isModerator = profile?.role === 'moderator';
  const scope = moderatorScope(profile);
  const canTargetEveryone = !scope;
  const yearChoices = withinModeratorYears(
    Array.from({ length: maxYear }, (_, index) => index + 1),
    scope
  );

  useEffect(() => {
    if (isModerator) setEveryone(false);
  }, [isModerator]);

  useEffect(() => {
    if (!hasLink) {
      setIcon(null);
      return;
    }
    if (item || !detected) return;
    setTitle((current) => current.trim() || detected.label);
    if (!icon) setIcon(detected.icon);
  }, [detected, hasLink, icon, item]);

  useEffect(() => {
    let cancelled = false;
    setInstitutions(withinModeratorInstitutions(mergeInstitutions([]), scope));
    listInstitutions()
      .then((rows) => {
        if (!cancelled) setInstitutions(withinModeratorInstitutions(mergeInstitutions(rows), scope));
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
      .then((rows) => {
        if (cancelled) return;
        setPrograms(withinModeratorPrograms(mergePrograms(institutionSlug, rows), scope));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [everyone, institutionSlug, isModerator, profile?.moderatorPrograms]);

  const handleSave = async () => {
    if (!canSave || !profile?.userId) return;
    setIsSaving(true);
    try {
      const payload = {
        url: normalizeUrl(url),
        icon: resolvedIcon,
        platform: detected?.id ?? 'website',
        is_active: true,
        institution: everyone ? null : institutionSlug,
        programs: everyone ? [] : programSlugs,
        years: everyone ? [] : selectedYears,
        translations: LANGUAGES.map((row) => ({
          lang: row.id,
          title: title.trim(),
          description: description.trim() || null,
        })),
      };
      if (isEdit) await updateSocial(profile.userId, item.id, payload);
      else await createSocial(profile.userId, payload);
      router.back();
    } catch (error) {
      Alert.alert(t('couldNotSave'), cooldownMessage(error, t, error.message ?? t('tryAgain')));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ThemedView className="flex-1">
      <Stack.Screen
        options={{
          title: isEdit ? t('editSocial') : t('addSocial'),
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
            value={url}
            onChangeText={(value) => {
              setUrl(value);
              if (!value.trim()) setIcon(null);
            }}
            placeholder="https://"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            className="rounded-three px-three py-three text-base font-medium"
            style={{ backgroundColor: theme.backgroundElement, color: theme.text }}
          />
          <ThemedView className="flex-row items-center gap-two bg-transparent">
            <SocialBrandIcon
              name={resolvedIcon}
              size={22}
              well={36}
              color={iconOnBrand(brandForIcon(resolvedIcon)?.color ?? detected?.color) ?? theme.primary}
              backgroundColor={
                brandForIcon(resolvedIcon)?.color ?? detected?.color ?? theme.backgroundSelected
              }
            />
            <ThemedText type="small" themeColor="textSecondary">
              {detected ? t('detectedService', { name: detected.label }) : t('unknownService')}
            </ThemedText>
          </ThemedView>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('socialTitle')}
            placeholderTextColor={theme.textSecondary}
            className="rounded-three px-three py-three text-base font-medium"
            style={{ backgroundColor: theme.backgroundElement, color: theme.text }}
          />
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={t('socialDescription')}
            placeholderTextColor={theme.textSecondary}
            className="rounded-three px-three py-three text-base font-medium"
            style={{ backgroundColor: theme.backgroundElement, color: theme.text }}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {t('chooseIcon')}
          </ThemedText>
          <ThemedView className="flex-row flex-wrap gap-two bg-transparent">
            {MANUAL_ICONS.map((option) => {
              const selected = resolvedIcon === option.icon;
              const accent = brandForIcon(option.icon)?.color;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => {
                    setIcon(option.icon);
                  }}>
                  <ThemedView
                    className="bg-transparent"
                    style={{
                      borderWidth: 1,
                      borderRadius: 10,
                      borderColor: selected ? accent ?? theme.primary : theme.border,
                    }}>
                    <SocialBrandIcon
                      name={option.icon}
                      size={20}
                      well={36}
                      color={iconOnBrand(accent) ?? theme.primary}
                      backgroundColor={accent ?? theme.backgroundElement}
                    />
                  </ThemedView>
                </Pressable>
              );
            })}
          </ThemedView>

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
                            ? current.filter((row) => row !== year)
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
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}
