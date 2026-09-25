import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useReload } from '@/components/reload-button';
import { StudyFields, useStudySelection } from '@/components/study-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useI18n } from '@/hooks/use-i18n';
import { mapRemoteUser, useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { createUser } from '@/lib/api';
import { getDeviceId } from '@/lib/device-id';

export function Onboarding() {
  const theme = useTheme();
  const { saveProfile } = useProfile();
  const { t, language, setLanguage, languages } = useI18n();
  const study = useStudySelection({ programsDelayMs: 700 });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const canContinue = study.canSubmit && !isSaving;
  const { refreshing, reload } = useReload(study.loadInstitutions);

  const handleContinue = async () => {
    if (!canContinue) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const deviceId = await getDeviceId();
      const user = await createUser({
        institution: study.institutionSlug,
        program: study.programSlug,
        year_of_study: study.yearOfStudy,
        language,
      });
      await saveProfile({
        institutionName: study.selectedInstitution?.name,
        programName: study.selectedProgram?.name,
        ...mapRemoteUser(user, deviceId),
      });
    } catch (error) {
      setSaveError(error.message ?? t('tryAgain'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ThemedView className="flex-1 flex-row justify-center">
      <SafeAreaView className="flex-1 max-w-content">
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            className="flex-1"
            contentContainerClassName="grow px-four py-six gap-three"
            keyboardShouldPersistTaps="handled"
            alwaysBounceVertical
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={reload}
                tintColor={theme.primary}
                colors={[theme.primary]}
              />
            }>
            <ThemedView className="gap-two bg-transparent mb-four">
              <ThemedText type="title">
                {t('welcomeTo')} <ThemedText type="title" themeColor="primary">UniMate</ThemedText>
              </ThemedText>
              <ThemedText themeColor="textSecondary">{t('onboardingSubtitle')}</ThemedText>
            </ThemedView>

            <ThemedText type="small" themeColor="textSecondary">
              {t('language')}
            </ThemedText>
            <ThemedView className="flex-row flex-wrap gap-two bg-transparent">
              {languages.map((item) => {
                const selected = language === item.id;
                return (
                  <Pressable key={item.id} onPress={() => setLanguage(item.id)} className="active:opacity-70">
                    <ThemedView
                      type={selected ? 'backgroundSelected' : 'backgroundElement'}
                      className="px-three py-two rounded-three"
                      style={{
                        borderWidth: 1,
                        borderColor: selected ? theme.primary : theme.border,
                      }}>
                      <ThemedText type="small" themeColor={selected ? 'primary' : 'textSecondary'}>
                        {item.nativeName}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                );
              })}
            </ThemedView>

            <StudyFields
              institutions={study.institutions}
              programs={study.programs}
              institutionSlug={study.institutionSlug}
              programSlug={study.programSlug}
              yearOfStudy={study.yearOfStudy}
              maxYear={study.maxYear}
              isLoading={study.isLoading}
              isLoadingPrograms={study.isLoadingPrograms}
              loadFailed={study.loadFailed}
              onRetry={study.loadInstitutions}
              onSelectInstitution={study.setInstitutionSlug}
              onSelectProgram={(slug) => {
                study.setProgramSlug(slug);
                study.setYearOfStudy(1);
              }}
              onSelectYear={study.setYearOfStudy}
            />

            {saveError ? <ThemedText style={{ color: theme.error }}>{saveError}</ThemedText> : null}

            <ThemedView className="grow bg-transparent" />

            <Pressable
              onPress={handleContinue}
              disabled={!canContinue}
              className="rounded-three py-three items-center"
              style={{
                backgroundColor: canContinue ? theme.primary : theme.border,
                opacity: canContinue ? 1 : 0.45,
              }}>
              <ThemedText type="smallBold" style={{ color: theme.background }}>
                {isSaving ? t('saving') : t('getStarted')}
              </ThemedText>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}
