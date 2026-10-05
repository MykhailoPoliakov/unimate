import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';

import '@/global.css';
import '@/nativewind-interop';

import AppTabs from '@/components/app-tabs';
import { Onboarding } from '@/components/onboarding';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { NotificationObserver } from '@/components/notification-observer';
import { FeedProvider } from '@/hooks/use-feed';
import { I18nProvider } from '@/hooks/use-i18n';
import { NotificationsProvider } from '@/hooks/use-notifications';
import { ProfileProvider, useProfile } from '@/hooks/use-profile';
import { ThemePreferenceProvider, useThemePreference } from '@/hooks/use-theme-preference';
import { Colors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

function navigationTheme(scheme) {
  const dark = scheme === 'dark';
  const colors = Colors[dark ? 'dark' : 'light'];
  return {
    ...(dark ? DarkTheme : DefaultTheme),
    colors: {
      ...(dark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.background,
      border: colors.border,
      text: colors.text,
      primary: colors.primary,
    },
  };
}

function Root() {
  const { profile, isLoading } = useProfile();
  const { isReady, resolved } = useThemePreference();
  const backgroundColor = Colors[resolved === 'dark' ? 'dark' : 'light'].background;

  useEffect(() => {
    if (isLoading || !isReady) return;
    SplashScreen.hideAsync();
  }, [isLoading, isReady]);

  if (isLoading || !isReady) {
    return <View style={{ flex: 1, backgroundColor }} />;
  }
  if (!profile) return <Onboarding />;
  return (
    <View style={{ flex: 1, backgroundColor }}>
      <NotificationObserver />
      <AppTabs />
    </View>
  );
}

function Providers() {
  const colorScheme = useColorScheme();
  const backgroundColor = Colors[colorScheme === 'dark' ? 'dark' : 'light'].background;
  return (
    <ThemeProvider value={navigationTheme(colorScheme)}>
      <View style={{ flex: 1, backgroundColor }}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} translucent />
        <ProfileProvider>
          <I18nProvider>
            <NotificationsProvider>
              <FeedProvider>
                <Root />
              </FeedProvider>
            </NotificationsProvider>
          </I18nProvider>
        </ProfileProvider>
      </View>
    </ThemeProvider>
  );
}

export default function TabLayout() {
  return (
    <ThemePreferenceProvider>
      <Providers />
    </ThemePreferenceProvider>
  );
}
