import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, RefreshControl, ScrollView, Share, Switch, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { HalfSheet } from '@/components/half-sheet';
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
import { updateUser, updateUserRole, listInstitutions, listPrograms } from '@/lib/api';
import { mergeInstitutions, mergePrograms } from '@/constants/study-catalog';

const THEME_IDS = [
  { id: 'system', icon: 'phone-portrait-outline' },
  { id: 'light', icon: 'sunny-outline' },
  { id: 'dark', icon: 'moon-outline' },
];

const FEEDBACK_EMAIL = 'unimate.app@proton.me';

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
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
  const [scopeInstitutionsList, setScopeInstitutionsList] = useState([]);
  const [scopeProgramsList, setScopeProgramsList] = useState([]);
  const [assignedInstitutions, setAssignedInstitutions] = useState([]);
  const [assignedPrograms, setAssignedPrograms] = useState([]);
  const [assignedYears, setAssignedYears] = useState([]);
  const study = useStudySelection({
    initialInstitution: profile?.institution,
    initialProgram: profile?.program,
    initialYear: profile?.yearOfStudy,
    initialInstitutionName: profile?.institutionName,
    programsDelayMs: 300,
  });
  const [isSavingStudy, setIsSavingStudy] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

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

  useEffect(() => {
    if (profile?.role !== 'admin') return undefined;
    let cancelled = false;
    listInstitutions()
      .then((rows) => {
        if (!cancelled) setScopeInstitutionsList(mergeInstitutions(rows));
      })
      .catch(() => {
        if (!cancelled) setScopeInstitutionsList(mergeInstitutions([]));
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.role]);

  useEffect(() => {
    if (assignedInstitutions.length === 0) {
      setScopeProgramsList([]);
      setAssignedPrograms([]);
      return undefined;
    }
    let cancelled = false;
    Promise.all(assignedInstitutions.map((slug) => listPrograms(slug).catch(() => [])))
      .then((groups) => {
        if (cancelled) return;
        const next = groups.flatMap((rows, index) =>
          mergePrograms(assignedInstitutions[index], rows)
        );
        const unique = [];
        for (const program of next) {
          if (!unique.some((item) => item.slug === program.slug)) unique.push(program);
        }
        setScopeProgramsList(unique);
        setAssignedPrograms((current) => current.filter((slug) => unique.some((item) => item.slug === slug)));
      });
    return () => {
      cancelled = true;
    };
  }, [assignedInstitutions]);

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
    if (roleToAssign === 'moderator' && (!assignedInstitutions.length || !assignedPrograms.length)) return;
    setIsUpdatingRole(true);
    setRoleUpdated(false);
    try {
      const updated = await updateUserRole(profile.userId, targetId, {
        role: roleToAssign,
        institutions: roleToAssign === 'moderator' ? assignedInstitutions : [],
        programs: roleToAssign === 'moderator' ? assignedPrograms : [],
        years: roleToAssign === 'moderator' ? assignedYears : [],
      });
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

  const handleShare = () => {
    Share.share({ message: t('shareMessage') }).catch(() => {});
  };

  const handleCopyId = async () => {
    if (!profile?.userId) return;
    try {
      const copied = await Clipboard.setStringAsync(profile.userId);
      if (!copied) throw new Error('Clipboard write failed');
      Alert.alert(t('copied'), t('idCopied'));
    } catch {
      Alert.alert(t('couldNotSave'), t('tryAgain'));
    }
  };

  const handleOpenFeedback = () => {
    const subject = encodeURIComponent('UniMate Feedback');
    Linking.openURL(`mailto:${FEEDBACK_EMAIL}?subject=${subject}`).catch(() => {
      Alert.alert(t('couldNotOpenMail'), FEEDBACK_EMAIL);
    });
  };

  const themeLabel = {
    system: t('themeSystem'),
    light: t('themeLight'),
    dark: t('themeDark'),
  };

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={[]}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            className="flex-1"
            contentContainerClassName="px-four pb-four gap-five max-w-content self-center w-full"
            contentContainerStyle={{ paddingBottom: 160 }}
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
            <ThemedView className="bg-transparent pb-two" style={{ paddingTop: (insets.top || 59) + 8 }}>
              <ThemedText type="subtitle">{t('menu')}</ThemedText>
            </ThemedView>
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
                    type="smallBold"
                    style={{
                      color: canSaveStudy ? theme.background : theme.textSecondary,
                    }}>
                    {isSavingStudy ? t('saving') : t('saveChanges')}
                  </ThemedText>
                </Pressable>
              </ThemedView>
            </SettingsGroup>

            <SettingsGroup title={t('languages')}>
              <SettingsRow
                icon="language-outline"
                label={t('language')}
                value={languages.find((item) => item.id === language)?.nativeName}
                href="/settings/languages"
              />
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
                  {roleToAssign === 'moderator' ? (
                    <ThemedView className="gap-two bg-transparent">
                      <ThemedText type="small" themeColor="textSecondary">
                        {t('moderatorScopeHint')}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {t('pickUniversity')}
                      </ThemedText>
                      {scopeInstitutionsList.map((institution) => {
                        const selected = assignedInstitutions.includes(institution.slug);
                        return (
                          <Pressable
                            key={institution.slug}
                            onPress={() =>
                              setAssignedInstitutions((current) =>
                                current.includes(institution.slug)
                                  ? current.filter((slug) => slug !== institution.slug)
                                  : [...current, institution.slug]
                              )
                            }>
                            <ThemedView
                              type={selected ? 'backgroundSelected' : 'backgroundElement'}
                              className="px-three py-two rounded-two"
                              style={{
                                borderWidth: 1,
                                borderColor: selected ? theme.primary : theme.border,
                              }}>
                              <ThemedText type="small" themeColor={selected ? 'primary' : 'textSecondary'}>
                                {institution.name}
                              </ThemedText>
                            </ThemedView>
                          </Pressable>
                        );
                      })}
                      <ThemedText type="small" themeColor="textSecondary">
                        {t('pickProgram')}
                      </ThemedText>
                      {scopeProgramsList.map((program) => {
                        const selected = assignedPrograms.includes(program.slug);
                        return (
                          <Pressable
                            key={program.slug}
                            onPress={() =>
                              setAssignedPrograms((current) =>
                                current.includes(program.slug)
                                  ? current.filter((slug) => slug !== program.slug)
                                  : [...current, program.slug]
                              )
                            }>
                            <ThemedView
                              type={selected ? 'backgroundSelected' : 'backgroundElement'}
                              className="px-three py-two rounded-two"
                              style={{
                                borderWidth: 1,
                                borderColor: selected ? theme.primary : theme.border,
                              }}>
                              <ThemedText type="small" themeColor={selected ? 'primary' : 'textSecondary'}>
                                {program.name}
                              </ThemedText>
                            </ThemedView>
                          </Pressable>
                        );
                      })}
                      <ThemedText type="small" themeColor="textSecondary">
                        {t('pickModeratorYearsHint')}
                      </ThemedText>
                      <ThemedView className="flex-row flex-wrap gap-two bg-transparent">
                        {Array.from(
                          {
                            length: Math.max(
                              3,
                              ...scopeProgramsList
                                .filter((item) => assignedPrograms.includes(item.slug))
                                .map((item) => item.duration_years)
                            ),
                          },
                          (_, index) => index + 1
                        ).map((year) => {
                          const selected = assignedYears.includes(year);
                          return (
                            <Pressable
                              key={year}
                              onPress={() =>
                                setAssignedYears((current) =>
                                  current.includes(year)
                                    ? current.filter((item) => item !== year)
                                    : [...current, year].sort((a, b) => a - b)
                                )
                              }>
                              <ThemedView
                                type={selected ? 'backgroundSelected' : 'backgroundElement'}
                                className="px-three py-two rounded-two"
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
                    </ThemedView>
                  ) : null}
                  <Pressable
                    onPress={handleUpdateRole}
                    disabled={
                      !roleTargetId.trim() ||
                      isUpdatingRole ||
                      (roleToAssign === 'moderator' &&
                        (!assignedInstitutions.length || !assignedPrograms.length))
                    }
                    className="rounded-three py-three items-center"
                    style={{
                      backgroundColor:
                        roleTargetId.trim() &&
                        !isUpdatingRole &&
                        (roleToAssign !== 'moderator' ||
                          (assignedInstitutions.length && assignedPrograms.length))
                          ? theme.primary
                          : theme.border,
                    }}>
                    <ThemedText
                      className={
                        roleTargetId.trim() &&
                        !isUpdatingRole &&
                        (roleToAssign !== 'moderator' ||
                          (assignedInstitutions.length && assignedPrograms.length))
                          ? '!text-white'
                          : ''
                      }
                      themeColor={
                        roleTargetId.trim() &&
                        !isUpdatingRole &&
                        (roleToAssign !== 'moderator' ||
                          (assignedInstitutions.length && assignedPrograms.length))
                          ? undefined
                          : 'textSecondary'
                      }
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

            <SettingsGroup title={t('support')}>
              <SettingsRow
                icon="share-outline"
                label={t('shareWithFriends')}
                onPress={handleShare}
              />
              <SettingsRow
                icon="chatbubble-ellipses-outline"
                label={t('contactSupport')}
                onPress={() => setSupportOpen(true)}
              />
            </SettingsGroup>

            <SettingsGroup title={t('legal')}>
              <SettingsRow icon="shield-checkmark-outline" label={t('privacyPolicy')} href="/settings/privacy" />
              <SettingsRow icon="document-text-outline" label={t('termsOfUse')} href="/settings/terms" />
              <SettingsRow icon="information-circle-outline" label={t('aboutUnimate')} href="/settings/about" />
            </SettingsGroup>

            <ThemedView className="items-center pt-four bg-transparent" style={{ paddingBottom: 24 }}>
              <ThemedText type="small" themeColor="textSecondary">
                v{Constants.expoConfig?.version ?? '1.0.0'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {profile?.role ? t(profile.role) : t('student')}
              </ThemedText>
              {profile?.userId ? (
                <ThemedView className="flex-row items-center gap-two bg-transparent">
                  <ThemedText type="small" themeColor="textSecondary">
                    {profile.userId}
                  </ThemedText>
                  <Pressable
                    onPress={handleCopyId}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={t('copyId')}
                    className="active:opacity-70">
                    <Ionicons name="copy-outline" size={16} color={theme.textSecondary} />
                  </Pressable>
                </ThemedView>
              ) : null}
            </ThemedView>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <HalfSheet
        visible={supportOpen}
        title={t('contactSupport')}
        onClose={() => setSupportOpen(false)}>
        <ThemedView className="gap-three bg-transparent">
          <ThemedText themeColor="textSecondary">{t('contactSupportBody')}</ThemedText>
          <ThemedText type="smallBold" selectable>
            {FEEDBACK_EMAIL}
          </ThemedText>
          <Pressable
            onPress={handleOpenFeedback}
            className="rounded-three py-three items-center"
            style={{ backgroundColor: theme.primary }}>
            <ThemedText type="smallBold" style={{ color: theme.background }}>
              {t('sendFeedback')}
            </ThemedText>
          </Pressable>
        </ThemedView>
      </HalfSheet>
    </ThemedView>
  );
}
