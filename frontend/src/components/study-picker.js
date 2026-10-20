import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, TextInput } from 'react-native';
import Animated from 'react-native-reanimated';

import { checkIn, fadeIn, PressScale } from '@/components/motion';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';
import { catalogInstitution, mergeInstitutions, mergePrograms } from '@/constants/study-catalog';
import { listInstitutions, listPrograms } from '@/lib/api';
import { LOCAL_ICONS } from '@/lib/local-icons';

export function Choice({ title, subtitle, isSelected, onSelect, icon, imageKey }) {
  const theme = useTheme();
  const image = imageKey
    ? LOCAL_ICONS[imageKey] ?? LOCAL_ICONS[String(imageKey).toLowerCase()]
    : null;

  return (
    <PressScale onPress={onSelect} style={{ alignSelf: 'stretch' }}>
      <ThemedView
        type="backgroundElement"
        className="flex-row items-center gap-three px-three py-three rounded-three"
        style={{
          borderWidth: 1,
          borderColor: isSelected ? theme.primary : theme.border,
        }}>
        {image ? (
          <Image
            source={image}
            style={{ width: 44, height: 44, borderRadius: 0 }}
            contentFit="cover"
          />
        ) : (
          <ThemedView
            type="backgroundSelected"
            className="w-[44px] h-[44px] rounded-two items-center justify-center">
            <Ionicons name={icon} size={22} color={theme.primary} />
          </ThemedView>
        )}
        <ThemedView className="flex-1 bg-transparent">
          <ThemedText type="smallBold">{title}</ThemedText>
          {subtitle ? (
            <ThemedText type="small" themeColor="textSecondary">
              {subtitle}
            </ThemedText>
          ) : null}
        </ThemedView>
        {isSelected ? (
          <Animated.View entering={checkIn}>
            <Ionicons name="checkmark-circle" size={22} color={theme.primary} />
          </Animated.View>
        ) : (
          <Ionicons name="ellipse-outline" size={22} color={theme.border} />
        )}
      </ThemedView>
    </PressScale>
  );
}

export function useStudySelection({
  initialInstitution,
  initialProgram,
  initialYear,
  initialInstitutionName,
  programsDelayMs = 0,
} = {}) {
  const { t } = useI18n();
  const [institutions, setInstitutions] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [institutionSlug, setInstitutionSlug] = useState(initialInstitution ?? null);
  const [programSlug, setProgramSlug] = useState(initialProgram ?? null);
  const [yearOfStudy, setYearOfStudy] = useState(initialYear ?? 1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPrograms, setIsLoadingPrograms] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const selectedInstitution = institutions.find((item) => item.slug === institutionSlug);
  const selectedProgram = programs.find((item) => item.slug === programSlug);
  const maxYear = selectedProgram?.duration_years ?? 1;

  const loadInstitutions = useCallback(async () => {
    setIsLoading(true);
    setLoadFailed(false);
    let items;
    try {
      items = await listInstitutions();
    } catch {
      items = null;
    }
    try {
      const next = mergeInstitutions(items);
      if (
        items === null &&
        initialInstitution &&
        !next.some((item) => item.slug === initialInstitution)
      ) {
        next.push({
          slug: initialInstitution,
          name: initialInstitutionName ?? initialInstitution,
          programs: catalogInstitution(initialInstitution)?.programs ?? [],
        });
      }

      setInstitutions(next);
      setInstitutionSlug((current) =>
        next.some((item) => item.slug === current) ? current : next[0]?.slug ?? null
      );
      if (items !== null && next.length === 0) setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, [initialInstitution, initialInstitutionName]);

  useEffect(() => {
    loadInstitutions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!institutionSlug) {
      setPrograms([]);
      setProgramSlug(null);
      setIsLoadingPrograms(false);
      return;
    }

    let cancelled = false;
    const fallback = mergePrograms(institutionSlug, null);
    setPrograms(fallback);
    setProgramSlug((current) =>
      fallback.some((item) => item.slug === current) ? current : fallback[0]?.slug ?? null
    );
    setIsLoadingPrograms(fallback.length === 0);

    const load = () => {
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
          if (cancelled) return;
          const next = mergePrograms(institutionSlug, null);
          setPrograms(next);
          setProgramSlug((current) =>
            next.some((item) => item.slug === current) ? current : next[0]?.slug ?? null
          );
        })
        .finally(() => {
          if (!cancelled) setIsLoadingPrograms(false);
        });
    };

    const timer =
      programsDelayMs > 0 ? setTimeout(load, programsDelayMs) : (load(), null);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [institutionSlug, programsDelayMs]);

  const reloadPrograms = useCallback(async () => {
    if (!institutionSlug) return;
    setIsLoadingPrograms(true);
    try {
      const rows = await listPrograms(institutionSlug);
      const next = mergePrograms(institutionSlug, rows);
      setPrograms(next);
      setProgramSlug((current) =>
        next.some((item) => item.slug === current) ? current : next[0]?.slug ?? null
      );
    } finally {
      setIsLoadingPrograms(false);
    }
  }, [institutionSlug]);

  useEffect(() => {
    if (!selectedProgram) return;
    if (yearOfStudy > maxYear) setYearOfStudy(maxYear);
  }, [selectedProgram, maxYear, yearOfStudy]);

  return {
    t,
    institutions,
    programs,
    institutionSlug,
    setInstitutionSlug,
    programSlug,
    setProgramSlug,
    yearOfStudy,
    setYearOfStudy,
    selectedInstitution,
    selectedProgram,
    maxYear,
    isLoading,
    loadFailed,
    loadInstitutions,
    reloadPrograms,
    isLoadingPrograms,
    canSubmit:
      !!institutionSlug &&
      !!programSlug &&
      yearOfStudy >= 1 &&
      !isLoading &&
      !isLoadingPrograms,
  };
}

export function StudyFields({
  institutions,
  programs,
  institutionSlug,
  programSlug,
  yearOfStudy,
  maxYear,
  isLoading,
  isLoadingPrograms,
  loadFailed,
  onRetry,
  onSelectInstitution,
  onSelectProgram,
  onSelectYear,
  canManage = false,
  onAddInstitution,
  onDeleteInstitution,
  onAddProgram,
  onDeleteProgram,
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const [institutionName, setInstitutionName] = useState('');
  const [institutionSlugDraft, setInstitutionSlugDraft] = useState('');
  const [programName, setProgramName] = useState('');
  const [programSlugDraft, setProgramSlugDraft] = useState('');
  const [durationYears, setDurationYears] = useState('3');
  const [isManaging, setIsManaging] = useState(false);

  const manage = async (action, clear) => {
    if (isManaging) return;
    setIsManaging(true);
    try {
      await action();
      clear?.();
    } catch (error) {
      Alert.alert(t('couldNotSave'), error?.message ?? t('tryAgain'));
    } finally {
      setIsManaging(false);
    }
  };

  const confirmDelete = (title, message, action) => {
    Alert.alert(title, message, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: () => manage(action) },
    ]);
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    color: theme.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
  };

  return (
    <>
      <ThemedText type="small" themeColor="textSecondary">
        {t('yourUniversity')}
      </ThemedText>
      {isLoading ? <ThemedText themeColor="textSecondary">{t('loading')}</ThemedText> : null}
      {loadFailed ? (
        <ThemedView className="gap-two bg-transparent">
          <ThemedText themeColor="textSecondary">{t('couldNotLoadUniversities')}</ThemedText>
          <Pressable onPress={onRetry} className="active:opacity-70">
            <ThemedText themeColor="primary">{t('retry')}</ThemedText>
          </Pressable>
        </ThemedView>
      ) : (
        institutions.map((institution) => (
          <ThemedView key={institution.slug} className="flex-row items-center gap-two bg-transparent">
            <ThemedView className="flex-1 bg-transparent">
              <Choice
                icon="school"
                imageKey={institution.slug}
                title={institution.name}
                subtitle={institution.slug}
                isSelected={institutionSlug === institution.slug}
                onSelect={() => onSelectInstitution(institution.slug)}
              />
            </ThemedView>
            {canManage ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('deleteUniversityNamed', { name: institution.name })}
                onPress={() =>
                  confirmDelete(
                    t('deleteUniversity'),
                    t('deleteUniversityMessage', { name: institution.name }),
                    () => onDeleteInstitution(institution.slug)
                  )
                }
                hitSlop={10}
                className="p-two">
                <Ionicons name="trash-outline" size={20} color={theme.error} />
              </Pressable>
            ) : null}
          </ThemedView>
        ))
      )}

      {canManage ? (
        <ThemedView
          className="gap-two rounded-three p-three bg-transparent"
          style={{ borderWidth: 1, borderColor: theme.border }}>
          <ThemedText type="smallBold">{t('addUniversity')}</ThemedText>
          <TextInput
            value={institutionName}
            onChangeText={setInstitutionName}
            placeholder={t('universityName')}
            placeholderTextColor={theme.textSecondary}
            style={inputStyle}
          />
          <TextInput
            value={institutionSlugDraft}
            onChangeText={setInstitutionSlugDraft}
            placeholder={t('universitySlug')}
            autoCapitalize="none"
            placeholderTextColor={theme.textSecondary}
            style={inputStyle}
          />
          <Pressable
            disabled={isManaging || !institutionName.trim() || !institutionSlugDraft.trim()}
            onPress={() =>
              manage(
                () => onAddInstitution({
                  name: institutionName.trim(),
                  slug: institutionSlugDraft.trim().toLowerCase(),
                }),
                () => {
                  setInstitutionName('');
                  setInstitutionSlugDraft('');
                }
              )
            }
            className="rounded-three py-two items-center"
            style={{ backgroundColor: theme.primary, opacity: isManaging ? 0.5 : 1 }}>
            <ThemedText type="smallBold" style={{ color: theme.background }}>
              {t('addUniversity')}
            </ThemedText>
          </Pressable>
        </ThemedView>
      ) : null}

      {isLoadingPrograms ? (
        <ThemedView className="flex-row items-center gap-two py-three bg-transparent">
          <ActivityIndicator color={theme.primary} />
          <ThemedText themeColor="textSecondary">{t('loading')}</ThemedText>
        </ThemedView>
      ) : programs.length > 0 || (canManage && institutionSlug) ? (
        <Animated.View key={institutionSlug} entering={fadeIn} style={{ gap: 12 }}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('yourProgram')}
          </ThemedText>
          {programs.map((program) => (
            <ThemedView key={program.slug} className="flex-row items-center gap-two bg-transparent">
              <ThemedView className="flex-1 bg-transparent">
                <Choice
                  icon="library"
                  title={program.name}
                  subtitle={`${program.duration_years} ${t('years')}`}
                  isSelected={programSlug === program.slug}
                  onSelect={() => onSelectProgram(program.slug)}
                />
              </ThemedView>
              {canManage ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('deleteProgramNamed', { name: program.name })}
                  onPress={() =>
                    confirmDelete(
                      t('deleteProgram'),
                      t('deleteProgramMessage', { name: program.name }),
                      () => onDeleteProgram(program.slug)
                    )
                  }
                  hitSlop={10}
                  className="p-two">
                  <Ionicons name="trash-outline" size={20} color={theme.error} />
                </Pressable>
              ) : null}
            </ThemedView>
          ))}

          {canManage ? (
            <ThemedView
              className="gap-two rounded-three p-three bg-transparent"
              style={{ borderWidth: 1, borderColor: theme.border }}>
              <ThemedText type="smallBold">{t('addProgram')}</ThemedText>
              <TextInput
                value={programName}
                onChangeText={setProgramName}
                placeholder={t('programName')}
                placeholderTextColor={theme.textSecondary}
                style={inputStyle}
              />
              <TextInput
                value={programSlugDraft}
                onChangeText={setProgramSlugDraft}
                placeholder={t('programSlug')}
                autoCapitalize="none"
                placeholderTextColor={theme.textSecondary}
                style={inputStyle}
              />
              <TextInput
                value={durationYears}
                onChangeText={setDurationYears}
                placeholder={t('durationYears')}
                keyboardType="number-pad"
                placeholderTextColor={theme.textSecondary}
                style={inputStyle}
              />
              <Pressable
                disabled={
                  isManaging ||
                  !programName.trim() ||
                  !programSlugDraft.trim() ||
                  !/^\d+$/.test(durationYears) ||
                  Number(durationYears) < 1
                }
                onPress={() =>
                  manage(
                    () => onAddProgram({
                      name: programName.trim(),
                      slug: programSlugDraft.trim().toLowerCase(),
                      duration_years: Number(durationYears),
                    }),
                    () => {
                      setProgramName('');
                      setProgramSlugDraft('');
                      setDurationYears('3');
                    }
                  )
                }
                className="rounded-three py-two items-center"
                style={{ backgroundColor: theme.primary, opacity: isManaging ? 0.5 : 1 }}>
                <ThemedText type="smallBold" style={{ color: theme.background }}>
                  {t('addProgram')}
                </ThemedText>
              </Pressable>
            </ThemedView>
          ) : null}

          <ThemedText type="small" themeColor="textSecondary">
            {t('yearOfStudy')}
          </ThemedText>
          <ThemedView className="flex-row flex-wrap gap-two bg-transparent">
            {Array.from({ length: maxYear }, (_, index) => index + 1).map((year) => {
              const selected = yearOfStudy === year;
              return (
                <Pressable key={year} onPress={() => onSelectYear(year)} className="active:opacity-70">
                  <ThemedView
                    type={selected ? 'backgroundSelected' : 'backgroundElement'}
                    className="px-three py-two rounded-three"
                    style={{
                      borderWidth: 1,
                      borderColor: selected ? theme.primary : theme.border,
                    }}>
                    <ThemedText type="small" themeColor={selected ? 'primary' : 'textSecondary'}>
                      {t('yearLabel', { n: year })}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              );
            })}
          </ThemedView>
        </Animated.View>
      ) : null}
    </>
  );
}
