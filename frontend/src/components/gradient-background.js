import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export function GradientBackground() {
  const theme = useTheme();
  return theme.backgroundGradient ? (
    <LinearGradient
      {...theme.backgroundGradient}
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    />
  ) : null;
}
