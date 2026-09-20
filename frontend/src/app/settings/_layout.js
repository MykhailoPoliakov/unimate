import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

export default function SettingsLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerTintColor: theme.primary,
        headerStyle: { backgroundColor: theme.background },
        headerTitleStyle: { color: theme.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.background },
      }}>
      <Stack.Screen name="index" options={{ title: 'Settings' }} />
      <Stack.Screen name="privacy" options={{ title: 'Privacy policy' }} />
      <Stack.Screen name="terms" options={{ title: 'Terms of use' }} />
      <Stack.Screen name="about" options={{ title: 'About' }} />
    </Stack>
  );
}
