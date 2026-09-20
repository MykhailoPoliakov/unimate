import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField } from '@/components/form-field';
import { SettingsGroup, SettingsRow } from '@/components/settings-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getUniversity } from '@/constants/universities';
import { useNotifications } from '@/hooks/use-notifications';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { useThemePreference } from '@/hooks/use-theme-preference';

const THEME_OPTIONS = [
  { id: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { id: 'light', label: 'Light', icon: 'sunny-outline' },
  { id: 'dark', label: 'Dark', icon: 'moon-outline' },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const { profile, saveProfile, clearProfile } = useProfile();
  const { preference, setPreference } = useThemePreference();
  const { enabled: notificationsEnabled, setEnabled: setNotificationsEnabled } = useNotifications();
  const university = getUniversity(profile?.university);

  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.lastName ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const canSave =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    (firstName.trim() !== profile?.firstName || lastName.trim() !== profile?.lastName) &&
    !isSaving;

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    try {
      await saveProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Reset UniMate?',
      'This clears your name and university from this device and shows onboarding again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => clearProfile(),
        },
      ]
    );
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
            keyboardShouldPersistTaps="handled">
            <SettingsGroup title="Profile">
              <ThemedView type="backgroundElement" className="gap-three px-three py-three">
                <FormField
                  label="First name"
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                  autoComplete="given-name"
                />
                <FormField
                  label="Surname"
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                  autoComplete="family-name"
                />
                <ThemedView className="gap-one bg-transparent">
                  <ThemedText type="small" themeColor="textSecondary">
                    University
                  </ThemedText>
                  <ThemedText>
                    {university.shortName} · {university.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    More universities are coming soon.
                  </ThemedText>
                </ThemedView>
                <Pressable
                  onPress={handleSave}
                  disabled={!canSave}
                  className={`rounded-three py-three items-center ${
                    canSave ? 'bg-primary active:bg-primary-pressed' : 'bg-background-selected'
                  }`}>
                  <ThemedText
                    className={canSave ? '!text-white' : ''}
                    themeColor={canSave ? undefined : 'textSecondary'}
                    type="smallBold">
                    {isSaving ? 'Saving…' : saved ? 'Saved' : 'Save changes'}
                  </ThemedText>
                </Pressable>
              </ThemedView>
            </SettingsGroup>

            <SettingsGroup title="Appearance">
              <ThemedView type="backgroundElement" className="flex-row gap-two p-two">
                {THEME_OPTIONS.map((option) => {
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
                        <ThemedText
                          type="small"
                          themeColor={selected ? 'primary' : 'textSecondary'}>
                          {option.label}
                        </ThemedText>
                      </ThemedView>
                    </Pressable>
                  );
                })}
              </ThemedView>
            </SettingsGroup>

            <SettingsGroup title="Notifications">
              <SettingsRow
                icon="notifications-outline"
                label="Push notifications"
                right={
                  <Switch
                    value={notificationsEnabled}
                    onValueChange={setNotificationsEnabled}
                    trackColor={{ false: theme.border, true: theme.primary }}
                    thumbColor="#FFFFFF"
                    ios_backgroundColor={theme.border}
                  />
                }
              />
            </SettingsGroup>

            <SettingsGroup title="Account">
              <ThemedView type="backgroundElement" className="px-three py-three gap-two">
                <ThemedText type="small" themeColor="textSecondary">
                  Account type
                </ThemedText>
                <ThemedView className="flex-row gap-two bg-transparent">
                  {[
                    { id: 'default', label: 'Student' },
                    { id: 'admin', label: 'Admin' },
                  ].map((option) => {
                    const selected = (profile?.role ?? 'default') === option.id;
                    return (
                      <Pressable
                        key={option.id}
                        onPress={() => saveProfile({ role: option.id })}
                        className="flex-1 active:opacity-70">
                        <ThemedView
                          type={selected ? 'backgroundSelected' : 'backgroundElement'}
                          className="items-center py-three rounded-two"
                          style={{
                            borderWidth: 1,
                            borderColor: selected ? theme.primary : theme.border,
                          }}>
                          <ThemedText type="small" themeColor={selected ? 'primary' : 'textSecondary'}>
                            {option.label}
                          </ThemedText>
                        </ThemedView>
                      </Pressable>
                    );
                  })}
                </ThemedView>
                <ThemedText type="small" themeColor="textSecondary">
                  Admins can publish news and events. This will come from your account later.
                </ThemedText>
              </ThemedView>
            </SettingsGroup>

            <SettingsGroup title="Legal">
              <SettingsRow icon="shield-checkmark-outline" label="Privacy policy" href="/settings/privacy" />
              <SettingsRow icon="document-text-outline" label="Terms of use" href="/settings/terms" />
              <SettingsRow icon="information-circle-outline" label="About UniMate" href="/settings/about" />
            </SettingsGroup>

            <SettingsGroup title="Data">
              <SettingsRow
                icon="refresh-outline"
                label="Reset profile"
                onPress={handleReset}
                destructive
              />
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
