import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DEFAULT_LINK_COLOR } from '@/components/button-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { campusServicesFor } from '@/constants/campus-services';
import { useI18n } from '@/hooks/use-i18n';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { listHomeButtons, listInstitutions, saveHomeButtons } from '@/lib/api';

export default function HomeButtonsSettingsScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const { profile, isLoading: isProfileLoading } = useProfile();
  const [buttons, setButtons] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [currentInstitutionName, setCurrentInstitutionName] = useState(null);
  const isKdg = profile?.institution === 'kdg';
  const hasSchedule = buttons.some((button) => button.platform === 'schedule');
  const valid = buttons.every((button) => button.title?.trim() && button.url?.trim());

  useEffect(() => {
    if (profile?.role !== 'admin' || !profile?.userId || !profile?.institution) return undefined;
    let cancelled = false;
    setIsLoading(true);
    setLoadFailed(false);
    Promise.all([listHomeButtons(profile.userId), listInstitutions()])
      .then(([config, institutionRows]) => {
        if (cancelled) return;
        setCurrentInstitutionName(
          institutionRows.find((row) => row.slug === profile.institution)?.name ?? null
        );
        const defaults = campusServicesFor(profile.institution, profile.language).map((button) => ({
          id: button.id,
          title: button.title,
          description: button.description,
          url: button.url,
          color: button.color,
          platform: button.platform ?? 'custom',
        }));
        setButtons(config.configured ? config.buttons : defaults);
      })
      .catch((error) => {
        if (!cancelled) {
          setCurrentInstitutionName(null);
          setLoadFailed(true);
          Alert.alert(t('couldNotLoadHomeButtons'), error.message ?? t('tryAgain'));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadAttempt, profile?.institution, profile?.language, profile?.role, profile?.userId, t]);

  const updateButton = (id, field, value) => {
    setButtons((current) =>
      current.map((button) => (button.id === id ? { ...button, [field]: value } : button))
    );
  };

  const addButton = (platform = 'custom') => {
    if (platform === 'schedule') {
      const schedule = campusServicesFor('kdg', profile?.language).find(
        (button) => button.platform === 'schedule'
      );
      if (!schedule) return;
      setButtons((current) => [
        ...current,
        {
          id: `draft-${Date.now()}`,
          title: schedule.title,
          description: schedule.description,
          url: schedule.url,
          color: schedule.color,
          platform: 'schedule',
        },
      ]);
      return;
    }
    setButtons((current) => [
      ...current,
      {
        id: `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title: '',
        description: '',
        url: '',
        color: DEFAULT_LINK_COLOR,
        platform: 'custom',
      },
    ]);
  };

  const removeButton = (button) => {
    Alert.alert(
      t('removeHomeButton'),
      t('removeHomeButtonMessage', { name: button.title || t('homeButtonName') }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: () => setButtons((current) => current.filter((item) => item.id !== button.id)),
        },
      ]
    );
  };

  const saveButtons = async () => {
    if (!profile?.userId || isSaving || !valid) return;
    setIsSaving(true);
    try {
      const result = await saveHomeButtons(profile.userId, buttons);
      setButtons(result.buttons);
      Alert.alert(t('saved'));
    } catch (error) {
      Alert.alert(t('couldNotSave'), error.message ?? t('tryAgain'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isProfileLoading) {
    return (
      <ThemedView className="flex-1 items-center justify-center">
        <ThemedText type="small" themeColor="textSecondary">{t('loading')}</ThemedText>
      </ThemedView>
    );
  }
  if (profile?.role !== 'admin') return <Redirect href="/settings" />;

  return (
    <ThemedView className="flex-1">
      <Stack.Screen
        options={{
          title: t('homeScreenButtons'),
        }}
      />
      <SafeAreaView className="flex-1" edges={['bottom']}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            className="flex-1"
            contentContainerClassName="px-four py-three gap-three pb-bottom-tab-gap"
            keyboardShouldPersistTaps="handled">
            <ThemedText type="small" themeColor="textSecondary">
              {t('homeButtonsFor', {
                name: currentInstitutionName || profile.institutionName || profile.institution,
              })}
            </ThemedText>
            {isLoading ? (
              <ThemedText type="small" themeColor="textSecondary">{t('loading')}</ThemedText>
            ) : loadFailed ? (
              <Pressable onPress={() => setLoadAttempt((attempt) => attempt + 1)}>
                <ThemedText type="small" themeColor="primary">{t('retry')}</ThemedText>
              </Pressable>
            ) : buttons.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">{t('noHomeButtons')}</ThemedText>
            ) : (
              buttons.map((button, index) => (
                <ThemedView
                  key={button.id}
                  className="gap-two p-three rounded-three"
                  style={{ backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: theme.border }}>
                  <ThemedView className="flex-row items-center justify-between bg-transparent">
                    <ThemedText type="smallBold">{t('homeButtonNumber', { n: index + 1 })}</ThemedText>
                    {button.platform === 'schedule' ? (
                      <ThemedText type="small" themeColor="primary">{t('specialSchedule')}</ThemedText>
                    ) : null}
                    <Pressable
                      onPress={() => removeButton(button)}
                      accessibilityRole="button"
                      accessibilityLabel={t('removeHomeButton')}>
                      <Ionicons name="trash-outline" size={19} color={theme.error} />
                    </Pressable>
                  </ThemedView>
                  {[
                    ['title', t('homeButtonName'), false],
                    ['description', t('homeButtonSubtitle'), false],
                    ['url', t('homeButtonLink'), true],
                    ['color', t('homeButtonColor'), false],
                  ].map(([field, label, url]) => (
                    <TextInput
                      key={field}
                      value={button[field] ?? ''}
                      onChangeText={(value) => updateButton(button.id, field, value)}
                      placeholder={label}
                      placeholderTextColor={theme.textSecondary}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType={url ? 'url' : 'default'}
                      maxLength={field === 'description' ? 100 : undefined}
                      accessibilityLabel={label}
                      className="rounded-three px-three py-two text-base font-medium"
                      style={{
                        backgroundColor: theme.background,
                        color: theme.text,
                        borderWidth: 1,
                        borderColor: theme.border,
                      }}
                    />
                  ))}
                </ThemedView>
              ))
            )}
            <Pressable
              onPress={() => addButton()}
              disabled={isLoading || loadFailed || isSaving}
              className="rounded-three py-three items-center"
              style={{ borderWidth: 1, borderColor: theme.primary }}>
              <ThemedText type="smallBold" themeColor="primary">{t('addHomeButton')}</ThemedText>
            </Pressable>
            {isKdg && !hasSchedule ? (
              <Pressable
                onPress={() => addButton('schedule')}
                disabled={isLoading || loadFailed || isSaving}
                className="rounded-three py-three items-center"
                style={{ borderWidth: 1, borderColor: theme.border }}>
                <ThemedText type="smallBold" themeColor="primary">{t('restoreScheduleButton')}</ThemedText>
              </Pressable>
            ) : null}
            <ThemedText type="small" themeColor="textSecondary">
              {t('homeButtonsSaveHint')}
            </ThemedText>
            <Pressable
              onPress={saveButtons}
              disabled={isLoading || loadFailed || isSaving || !valid}
              className="rounded-three py-three items-center"
              style={{
                backgroundColor: !isLoading && !loadFailed && !isSaving && valid ? theme.primary : theme.border,
              }}>
              <ThemedText
                type="smallBold"
                style={{
                  color: !isLoading && !loadFailed && !isSaving && valid ? theme.background : theme.textSecondary,
                }}>
                {isSaving ? t('saving') : t('saveHomeButtons')}
              </ThemedText>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}
