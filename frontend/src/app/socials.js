import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import { openExternalUrl } from '@/components/external-link';
import { GlassCard } from '@/components/glass-card';
import { useReload } from '@/components/reload-button';
import { SocialBrandIcon } from '@/components/social-brand-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useI18n } from '@/hooks/use-i18n';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { mergeInstitutions, mergePrograms } from '@/constants/study-catalog';
import { LANGUAGES } from '@/i18n/translations';
import { createSocial, deleteSocial, listManageSocials, listSocials, updateSocial, listInstitutions, listPrograms } from '@/lib/api';
import {
  brandColor,
  detectService,
  iconOnBrand,
  MANUAL_ICONS,
  normalizeUrl,
  resolveIconName,
  socialIcon,
  brandForIcon,
} from '@/lib/social-service';

function flattenAdminSocial(item, language) {
  const translation =
    item.translations?.find((row) => row.lang === language) ?? item.translations?.[0] ?? {};
  return {
    id: item.id,
    url: item.url,
    icon: item.icon,
    platform: item.platform,
    title: translation.title ?? item.title ?? '',
    description: translation.description ?? item.description ?? '',
    institution: item.institution ?? null,
    program: item.program ?? null,
    yearMin: item.year_min ?? null,
    yearMax: item.year_max ?? null,
  };
}

function yearsFromRange(min, max) {
  if (!min && !max) return [];
  const start = min ?? max;
  const end = max ?? min;
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function SocialRow({ item, isAdmin, onEdit, onDelete }) {
  const theme = useTheme();
  const { t } = useI18n();
  const suppressRedirect = useRef(false);
  const suppressRedirectTimer = useRef(null);
  const icon = socialIcon(item);
  const accent = brandColor(item);
  const glyph = accent ? iconOnBrand(accent) : theme.primary;

  const copyLink = async () => {
    try {
      const copied = await Clipboard.setStringAsync(item.url);
      if (!copied) throw new Error('Clipboard write failed');
      Alert.alert(t('copied'), t('linkCopied'));
    } catch {
      Alert.alert(t('couldNotSave'), t('tryAgain'));
    }
  };

  const handleLongPress = () => {
    suppressRedirect.current = true;
    clearTimeout(suppressRedirectTimer.current);
    suppressRedirectTimer.current = setTimeout(() => {
      suppressRedirect.current = false;
    }, 1000);
    void copyLink();
  };

  const handleOpen = () => {
    if (suppressRedirect.current) {
      suppressRedirect.current = false;
      clearTimeout(suppressRedirectTimer.current);
      return;
    }
    void openExternalUrl(item.url, theme, { preferNativeApp: true });
  };

  const handleCopyPress = () => {
    suppressRedirect.current = false;
    clearTimeout(suppressRedirectTimer.current);
    void copyLink();
  };

  return (
    <GlassCard>
      <ThemedView className="flex-row items-center bg-transparent">
        <Pressable
          onPress={handleOpen}
          onLongPress={handleLongPress}
          delayLongPress={450}
          className="flex-1 active:opacity-70">
          <ThemedView className="flex-row items-center gap-three px-three py-three bg-transparent">
            <SocialBrandIcon
              name={icon}
              size={32}
              well={44}
              color={glyph}
              backgroundColor={accent ?? theme.backgroundSelected}
            />
            <ThemedView className="flex-1 bg-transparent">
              <ThemedText type="smallBold">{item.title}</ThemedText>
              {item.description ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {item.description}
                </ThemedText>
              ) : null}
            </ThemedView>
            <Ionicons name="open-outline" size={18} color={theme.textSecondary} />
          </ThemedView>
        </Pressable>
        <Pressable
          onPress={handleCopyPress}
          accessibilityRole="button"
          accessibilityLabel={t('copyLink')}
          accessibilityHint={t('copyLinkHint')}
          className="w-[44px] h-[44px] items-center justify-center active:opacity-70">
          <Ionicons name="copy-outline" size={19} color={theme.textSecondary} />
        </Pressable>
      </ThemedView>
      {isAdmin ? (
        <ThemedView className="flex-row gap-three px-three pb-three bg-transparent">
          <Pressable onPress={() => onEdit(item)} className="active:opacity-70">
            <ThemedText type="small" themeColor="primary">
              {t('edit')}
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => onDelete(item)} className="active:opacity-70">
            <ThemedText type="small" style={{ color: theme.error }}>
              {t('delete')}
            </ThemedText>
          </Pressable>
        </ThemedView>
      ) : null}
    </GlassCard>
  );
}

function SocialModal({ item, onClose, onSaved }) {
  const theme = useTheme();
  const { t } = useI18n();
  const { profile } = useProfile();
  const [url, setUrl] = useState(item?.url ?? '');
  const [title, setTitle] = useState(item?.title ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [icon, setIcon] = useState(item?.icon ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [institutions, setInstitutions] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [everyone, setEveryone] = useState(!item?.institution);
  const [institutionSlug, setInstitutionSlug] = useState(item?.institution ?? profile?.institution ?? null);
  const [programSlug, setProgramSlug] = useState(item?.program ?? profile?.program ?? null);
  const [selectedYears, setSelectedYears] = useState(yearsFromRange(item?.yearMin, item?.yearMax));
  const isEdit = !!item;

  const detected = useMemo(() => detectService(url), [url]);
  const hasLink = Boolean(url.trim());
  const resolvedIcon = hasLink
    ? resolveIconName(icon || detected?.icon || 'globe-outline')
    : 'globe-outline';
  const targetingValid = everyone || (!!institutionSlug && !!programSlug);
  const canSave =
    normalizeUrl(url).length > 8 && title.trim().length > 0 && targetingValid && !isSaving;
  const selectedInstitution = institutions.find((row) => row.slug === institutionSlug);
  const selectedProgram = programs.find((row) => row.slug === programSlug);
  const maxYear = selectedProgram?.duration_years ?? 6;

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
    listInstitutions()
      .then((rows) => {
        if (!cancelled) setInstitutions(mergeInstitutions(rows));
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
      .then((rows) => {
        if (cancelled) return;
        const next = mergePrograms(institutionSlug, rows);
        setPrograms(next);
        setProgramSlug((current) =>
          next.some((row) => row.slug === current) ? current : next[0]?.slug ?? null
        );
      })
      .catch(() => {
        if (!cancelled) setPrograms(mergePrograms(institutionSlug, []));
      });
    return () => {
      cancelled = true;
    };
  }, [everyone, institutionSlug]);

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
        program: everyone ? null : programSlug,
        year_min: everyone || selectedYears.length === 0 ? null : Math.min(...selectedYears),
        year_max: everyone || selectedYears.length === 0 ? null : Math.max(...selectedYears),
        translations: LANGUAGES.map((row) => ({
          lang: row.id,
          title: title.trim(),
          description: description.trim() || null,
        })),
      };
      if (isEdit) await updateSocial(profile.userId, item.id, payload);
      else await createSocial(profile.userId, payload);
      onSaved();
      onClose();
    } catch (error) {
      Alert.alert(t('couldNotSave'), error.message ?? t('tryAgain'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ThemedView className="flex-1">
        <SafeAreaView className="flex-1">
          <KeyboardAvoidingView
            className="flex-1"
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ThemedView className="flex-row items-center justify-between px-four py-three bg-transparent">
              <Pressable onPress={onClose} className="active:opacity-70">
                <ThemedText themeColor="primary">{t('cancel')}</ThemedText>
              </Pressable>
              <ThemedText type="smallBold">{isEdit ? t('editSocial') : t('addSocial')}</ThemedText>
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
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

export default function SocialsScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const { profile } = useProfile();
  const [items, setItems] = useState([]);
  const [composer, setComposer] = useState(null);
  const isAdmin = profile?.role === 'admin';

  const refresh = useCallback(async () => {
    if (!profile?.userId) {
      setItems([]);
      return;
    }
    const language = profile.language ?? 'en';
    if (profile.role === 'admin') {
      const next = await listManageSocials(profile.userId);
      setItems(next.map((row) => flattenAdminSocial(row, language)));
      return;
    }
    setItems(await listSocials(profile.userId));
  }, [profile?.userId, profile?.institution, profile?.program, profile?.yearOfStudy, profile?.language]);

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => setItems([]));
    }, [refresh])
  );

  const { refreshing: isRefreshing, reload: handleRefresh } = useReload(async () => {
    try {
      await refresh();
    } catch {
      // Keep the current list if the API is unreachable.
    }
  });

  const handleDelete = (item) => {
    Alert.alert(t('deleteSocial'), t('deleteSocialMessage'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSocial(profile.userId, item.id);
            await refresh();
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
          <ThemedText type="subtitle">{t('socials')}</ThemedText>
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
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }>
          <ThemedText themeColor="textSecondary">{t('socialsSubtitle')}</ThemedText>
          {items.length === 0 ? (
            <ThemedView className="items-center py-six bg-transparent">
              <ThemedText themeColor="textSecondary" className="text-center">
                {t('noSocials')}
                {isAdmin ? t('tapToAddSocial') : ''}
              </ThemedText>
            </ThemedView>
          ) : (
            items.map((item) => (
              <SocialRow
                key={item.id}
                item={item}
                isAdmin={isAdmin}
                onEdit={setComposer}
                onDelete={handleDelete}
              />
            ))
          )}
        </ScrollView>
      </SafeAreaView>
      {composer ? (
        <SocialModal
          key={composer.id ?? 'new'}
          item={composer.id ? composer : null}
          onClose={() => setComposer(null)}
          onSaved={refresh}
        />
      ) : null}
    </ThemedView>
  );
}
