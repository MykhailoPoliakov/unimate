import { Stack } from 'expo-router';

import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';

export default function SocialsLayout() {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <Stack
      screenOptions={{
        headerTintColor: theme.primary,
        headerTransparent: true,
        headerStyle: { backgroundColor: 'transparent' },
        headerTitleStyle: { color: theme.text },
        headerBackButtonDisplayMode: 'minimal',
        headerShadowVisible: false,
        headerBlurEffect: 'none',
        contentStyle: { backgroundColor: theme.background },
      }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="compose" options={{ headerBackTitle: t('socials') }} />
    </Stack>
  );
}
