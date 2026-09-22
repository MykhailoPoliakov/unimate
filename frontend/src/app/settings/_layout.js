import { Stack } from 'expo-router';

import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';

export default function SettingsLayout() {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <Stack
      screenOptions={{
        headerTintColor: theme.primary,
        headerStyle: { backgroundColor: theme.background },
        headerTitleStyle: { color: theme.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.background },
      }}>
      <Stack.Screen name="index" options={{ title: t('settings') }} />
      <Stack.Screen name="privacy" options={{ title: t('privacyPolicy') }} />
      <Stack.Screen name="terms" options={{ title: t('termsOfUse') }} />
      <Stack.Screen name="about" options={{ title: t('aboutUnimate') }} />
    </Stack>
  );
}
