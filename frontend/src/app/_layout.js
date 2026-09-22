import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

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

SplashScreen.preventAutoHideAsync();

function Root() {
  const { profile, isLoading } = useProfile();
  const { isReady } = useThemePreference();

  useEffect(() => {
    if (isLoading || !isReady) return;
    SplashScreen.hideAsync();
  }, [isLoading, isReady]);

  if (isLoading || !isReady) return null;
  if (!profile) return <Onboarding />;
  return (
    <>
      <NotificationObserver />
      <AppTabs />
    </>
  );
}

function Providers() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <ProfileProvider>
        <I18nProvider>
          <NotificationsProvider>
            <FeedProvider>
              <Root />
            </FeedProvider>
          </NotificationsProvider>
        </I18nProvider>
      </ProfileProvider>
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
