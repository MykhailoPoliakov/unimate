import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

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

export function GlassCard({ children, style, contentClassName, solid = false }) {
  const theme = useTheme();
  const frame = [
    styles.frame,
    glassShadow(theme),
    {
      borderColor: solid ? theme.border : theme.glassBorder,
      backgroundColor: solid ? theme.backgroundElement : theme.glass,
    },
    style,
  ];

  if (!solid && GlassView && isLiquidGlassAvailable()) {
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
  circle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});

export function GlassCircleButton({ onPress, icon, accessibilityLabel }) {
  const theme = useTheme();
  const circle = [
    styles.circle,
    {
      borderColor: theme.glassBorder,
      backgroundColor: theme.glass,
    },
  ];
  const glyph = <Ionicons name={icon} size={20} color={theme.text} />;

  const button = (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="active:opacity-70"
      style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
      {glyph}
    </Pressable>
  );

  if (GlassView && isLiquidGlassAvailable()) {
    return (
      <GlassView glassEffectStyle="regular" style={circle}>
        {button}
      </GlassView>
    );
  }

  return <View style={circle}>{button}</View>;
}

export function GlassBackButton({ onPress }) {
  return (
    <GlassCircleButton
      onPress={onPress}
      icon={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'}
      accessibilityLabel="Back"
    />
  );
}
