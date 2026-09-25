import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

let GlassView = null;
let isLiquidGlassAvailable = () => false;
try {
  const glass = require('expo-glass-effect');
  GlassView = glass.GlassView;
  isLiquidGlassAvailable = glass.isLiquidGlassAvailable ?? (() => false);
} catch {
  GlassView = null;
}

export function glassShadow(theme) {
  return {
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: theme.shadowOpacity,
    shadowRadius: 22,
    elevation: 10,
  };
}

export function GlassCard({ children, style, contentClassName }) {
  const theme = useTheme();
  const frame = [
    styles.frame,
    glassShadow(theme),
    { borderColor: theme.glassBorder, backgroundColor: theme.glass },
    style,
  ];

  if (GlassView && isLiquidGlassAvailable()) {
    return (
      <GlassView glassEffectStyle="regular" style={frame}>
        {children}
      </GlassView>
    );
  }

  return (
    <View style={frame} className={contentClassName}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
