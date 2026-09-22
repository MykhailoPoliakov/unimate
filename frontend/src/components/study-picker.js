import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';
import { listInstitutions, listPrograms } from '@/lib/api';

export function Choice({ title, subtitle, isSelected, onSelect, icon }) {
  const theme = useTheme();

  return (
    <Pressable onPress={onSelect} className="active:opacity-70 self-stretch">
      <ThemedView
        type="backgroundElement"
        className="flex-row items-center gap-three px-three py-three rounded-three"
        style={{
          borderWidth: 1,
          borderColor: isSelected ? theme.primary : theme.border,
        }}>
        <ThemedView
          type="backgroundSelected"
          className="w-[44px] h-[44px] rounded-two items-center justify-center">
          <Ionicons name={icon} size={22} color={theme.primary} />
        </ThemedView>
        <ThemedView className="flex-1 bg-transparent">
          <ThemedText type="smallBold">{title}</ThemedText>
          {subtitle ? (
            <ThemedText type="small" themeColor="textSecondary">
              {subtitle}
            </ThemedText>
          ) : null}
        </ThemedView>
        <Ionicons
          name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
          size={22}
          color={isSelected ? theme.primary : theme.border}
        />
      </ThemedView>
    </Pressable>
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
    try {
      const items = await listInstitutions();
      const next = [...items];
      if (
        initialInstitution &&
        !next.some((item) => item.slug === initialInstitution)
      ) {
        next.push({
          slug: initialInstitution,
          name: initialInstitutionName ?? initialInstitution,
        });
      }

      setInstitutions(next);
      setInstitutionSlug((current) => current ?? next[0]?.slug ?? null);
    } catch {
      setLoadFailed(true);
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
    setIsLoadingPrograms(true);

    const load = () => {
      listPrograms(institutionSlug)
        .then((items) => {
          if (cancelled) return;
          setPrograms(items);
          setProgramSlug((current) =>
            items.some((item) => item.slug === current) ? current : items[0]?.slug ?? null
          );
        })
        .catch(() => {
          if (!cancelled) {
            setPrograms([]);
            setProgramSlug(null);
          }
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
}) {
  const theme = useTheme();
  const { t } = useI18n();

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
          <Choice
            key={institution.slug}
            icon="school"
            title={institution.name}
            subtitle={institution.slug}
            isSelected={institutionSlug === institution.slug}
            onSelect={() => onSelectInstitution(institution.slug)}
          />
        ))
      )}

      {isLoadingPrograms ? (
        <ThemedView className="flex-row items-center gap-two py-three bg-transparent">
          <ActivityIndicator color={theme.primary} />
          <ThemedText themeColor="textSecondary">{t('loading')}</ThemedText>
        </ThemedView>
      ) : programs.length > 0 ? (
        <>
          <ThemedText type="small" themeColor="textSecondary" className="mt-two">
            {t('yourProgram')}
          </ThemedText>
          {programs.map((program) => (
            <Choice
              key={program.slug}
              icon="library"
              title={program.name}
              subtitle={t('yearLabel', { n: program.duration_years })}
              isSelected={programSlug === program.slug}
              onSelect={() => onSelectProgram(program.slug)}
            />
          ))}

          <ThemedText type="small" themeColor="textSecondary" className="mt-two">
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
        </>
      ) : null}
    </>
  );
}
