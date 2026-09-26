import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, Switch, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useReload } from '@/components/reload-button';
import { StudyFields, useStudySelection } from '@/components/study-picker';
import { SettingsGroup, SettingsRow } from '@/components/settings-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useFeed } from '@/hooks/use-feed';
import { useI18n } from '@/hooks/use-i18n';
import { useNotifications } from '@/hooks/use-notifications';
import { mapRemoteUser, useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { useThemePreference } from '@/hooks/use-theme-preference';
import { updateUser, updateUserRole } from '@/lib/api';

const THEME_IDS = [
  { id: 'system', icon: 'phone-portrait-outline' },
  { id: 'light', icon: 'sunny-outline' },
  { id: 'dark', icon: 'moon-outline' },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const { t, language, languages } = useI18n();
  const { profile, saveProfile, refreshUser } = useProfile();
  const {
    refresh: refreshFeed,
    inAppNewsEnabled,
    setInAppNewsEnabled,
  } = useFeed();
  const { preference, setPreference } = useThemePreference();
  const {
    enabled: notificationsEnabled,
    setEnabled: setNotificationsEnabled,
    canUseNativeNotifications,
    pushError,
  } = useNotifications();
  const [roleTargetId, setRoleTargetId] = useState('');
  const [roleToAssign, setRoleToAssign] = useState('moderator');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [roleUpdated, setRoleUpdated] = useState(false);
  const study = useStudySelection({
    initialInstitution: profile?.institution,
    initialProgram: profile?.program,
    initialYear: profile?.yearOfStudy,
    initialInstitutionName: profile?.institutionName,
    programsDelayMs: 300,
  });
  const [isSavingStudy, setIsSavingStudy] = useState(false);

  const studyChanged =
    study.institutionSlug !== profile?.institution ||
    study.programSlug !== profile?.program ||
    study.yearOfStudy !== profile?.yearOfStudy;

  const { refreshing: isRefreshing, reload: handleRefresh } = useReload(async () => {
    try {
      await Promise.all([refreshUser(), study.loadInstitutions()]);
    } catch (error) {
      Alert.alert(t('couldNotSave'), error.message ?? t('tryAgain'));
    }
  });

  const handleLanguage = async (next) => {
    if (!profile?.userId || next === language) return;
    try {
      const remote = await updateUser(profile.userId, { language: next });
      await saveProfile({
        ...mapRemoteUser(remote, profile.deviceId),
        institutionName: profile.institutionName,
        programName: profile.programName,
      });
    } catch (error) {
      Alert.alert(t('couldNotSave'), error.message ?? t('tryAgain'));
    }
  };

  const handleSaveStudy = async () => {
    if (!profile?.userId || !study.canSubmit || !studyChanged || isSavingStudy) return;
    setIsSavingStudy(true);
    try {
      const remote = await updateUser(profile.userId, {
        institution: study.institutionSlug,
        program: study.programSlug,
        year_of_study: study.yearOfStudy,
      });
      await saveProfile({
        ...mapRemoteUser(remote, profile.deviceId),
        institutionName: study.selectedInstitution?.name,
        programName: study.selectedProgram?.name,
      });
      await refreshFeed();
    } catch (error) {
      Alert.alert(t('couldNotSave'), error.message ?? t('tryAgain'));
    } finally {
      setIsSavingStudy(false);
    }
  };

  const handleUpdateRole = async () => {
    const targetId = roleTargetId.trim();
    if (!profile?.userId || !targetId || isUpdatingRole) return;
    setIsUpdatingRole(true);
    setRoleUpdated(false);
    try {
      const updated = await updateUserRole(profile.userId, targetId, roleToAssign);
      setRoleUpdated(true);
      if (String(updated.id) === profile.userId) {
        await saveProfile({
          ...mapRemoteUser(updated, profile.deviceId),
          institutionName: profile.institutionName,
          programName: profile.programName,
        });
        await refreshFeed();
      }
    } catch (error) {
      Alert.alert(t('couldNotSave'), error.message ?? t('tryAgain'));
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const canSaveStudy = studyChanged && study.canSubmit && !isSavingStudy;

  const themeLabel = {
    system: t('themeSystem'),
    light: t('themeLight'),
    dark: t('themeDark'),
  };

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['bottom']}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            className="flex-1"
            contentContainerClassName="px-four py-four gap-five pb-bottom-tab-gap max-w-content self-center w-full"
            keyboardShouldPersistTaps="handled"
            alwaysBounceVertical
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={theme.primary}
                colors={[theme.primary]}
              />
            }>
            <SettingsGroup title={t('studies')}>
              <ThemedView className="gap-three px-three py-three bg-transparent">
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
                  onSelectProgram={study.setProgramSlug}
                  onSelectYear={study.setYearOfStudy}
                />
                <Pressable
                  onPress={handleSaveStudy}
                  disabled={!canSaveStudy}
                  className="rounded-three py-three items-center"
                  style={{
                    backgroundColor: canSaveStudy ? theme.primary : theme.border,
                  }}>
                  <ThemedText
                    className={canSaveStudy ? '!text-white' : ''}
                    themeColor={canSaveStudy ? undefined : 'textSecondary'}
                    type="smallBold">
                    {isSavingStudy ? t('saving') : t('saveChanges')}
                  </ThemedText>
                </Pressable>
              </ThemedView>
            </SettingsGroup>

            <SettingsGroup title={t('language')}>
              <ThemedView className="flex-row flex-wrap gap-two p-two bg-transparent">
                {languages.map((item) => {
                  const selected = language === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => handleLanguage(item.id)}
                      className="active:opacity-70">
                      <ThemedView
                        type={selected ? 'backgroundSelected' : 'backgroundElement'}
                        className="px-three py-two rounded-two"
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
            </SettingsGroup>

            <SettingsGroup title={t('appearance')}>
              <ThemedView className="flex-row gap-two p-two bg-transparent">
                {THEME_IDS.map((option) => {
                  const selected = preference === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => setPreference(option.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      className="flex-1 active:opacity-70">
                      <ThemedView
                        type={selected ? 'backgroundSelected' : 'backgroundElement'}
                        className="items-center gap-one py-three rounded-two"
                        style={{
                          borderWidth: 1,
                          borderColor: selected ? theme.primary : theme.border,
                        }}>
                        <Ionicons
                          name={option.icon}
                          size={20}
                          color={selected ? theme.primary : theme.textSecondary}
                        />
                        <ThemedText type="small" themeColor={selected ? 'primary' : 'textSecondary'}>
                          {themeLabel[option.id]}
                        </ThemedText>
                      </ThemedView>
                    </Pressable>
                  );
                })}
              </ThemedView>
            </SettingsGroup>

            <SettingsGroup title={t('notifications')}>
              <SettingsRow
                icon="notifications-outline"
                label={t('pushNotifications')}
                right={
                  <Switch
                    value={notificationsEnabled}
                    onValueChange={setNotificationsEnabled}
                    disabled={!canUseNativeNotifications}
                  />
                }
              />
              {pushError ? (
                <ThemedText type="small" themeColor="textSecondary" selectable>
                  {pushError}
                </ThemedText>
              ) : null}
              <SettingsRow
                icon="newspaper-outline"
                label={t('inAppNewsNotifications')}
                right={
                  <Switch
                    value={inAppNewsEnabled}
                    onValueChange={setInAppNewsEnabled}
                  />
                }
              />
            </SettingsGroup>

            <SettingsGroup title={t('accountRole')}>
              <ThemedView className="px-three py-three gap-one bg-transparent">
                <ThemedText type="smallBold">
                  {profile?.role ? t(profile.role) : t('student')}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" selectable>
                  {profile?.userId ?? '—'}
                </ThemedText>
              </ThemedView>
            </SettingsGroup>

            {profile?.role === 'admin' ? (
              <SettingsGroup title={t('manageRoles')}>
                <ThemedView className="gap-three px-three py-three bg-transparent">
                  <TextInput
                    value={roleTargetId}
                    onChangeText={(value) => {
                      setRoleTargetId(value);
                      setRoleUpdated(false);
                    }}
                    placeholder={t('accountId')}
                    placeholderTextColor={theme.textSecondary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={36}
                    className="rounded-three px-three py-three text-base font-medium"
                    style={{
                      backgroundColor: theme.backgroundElement,
                      color: theme.text,
                      borderWidth: 1,
                      borderColor: theme.border,
                    }}
                  />
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('roleToAssign')}
                  </ThemedText>
                  <ThemedView className="flex-row flex-wrap gap-two bg-transparent">
                    {['student', 'moderator', 'admin'].map((role) => {
                      const selected = roleToAssign === role;
                      return (
                        <Pressable
                          key={role}
                          onPress={() => setRoleToAssign(role)}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}>
                          <ThemedView
                            type={selected ? 'backgroundSelected' : 'backgroundElement'}
                            className="px-three py-two rounded-two"
                            style={{
                              borderWidth: 1,
                              borderColor: selected ? theme.primary : theme.border,
                            }}>
                            <ThemedText
                              type="small"
                              themeColor={selected ? 'primary' : 'textSecondary'}>
                              {t(role)}
                            </ThemedText>
                          </ThemedView>
                        </Pressable>
                      );
                    })}
                  </ThemedView>
                  <Pressable
                    onPress={handleUpdateRole}
                    disabled={!roleTargetId.trim() || isUpdatingRole}
                    className="rounded-three py-three items-center"
                    style={{
                      backgroundColor:
                        roleTargetId.trim() && !isUpdatingRole ? theme.primary : theme.border,
                    }}>
                    <ThemedText
                      className={roleTargetId.trim() && !isUpdatingRole ? '!text-white' : ''}
                      themeColor={roleTargetId.trim() && !isUpdatingRole ? undefined : 'textSecondary'}
                      type="smallBold">
                      {isUpdatingRole ? t('saving') : t('updateRole')}
                    </ThemedText>
                  </Pressable>
                  {roleUpdated ? (
                    <ThemedText type="small" themeColor="primary">
                      {t('roleUpdated')}
                    </ThemedText>
                  ) : null}
                </ThemedView>
              </SettingsGroup>
            ) : null}

            <SettingsGroup title={t('legal')}>
              <SettingsRow icon="shield-checkmark-outline" label={t('privacyPolicy')} href="/settings/privacy" />
              <SettingsRow icon="document-text-outline" label={t('termsOfUse')} href="/settings/terms" />
              <SettingsRow icon="information-circle-outline" label={t('aboutUnimate')} href="/settings/about" />
            </SettingsGroup>

            <ThemedText type="small" themeColor="textSecondary" className="text-center">
              UniMate {Constants.expoConfig?.version ?? '1.0.0'}
            </ThemedText>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}
