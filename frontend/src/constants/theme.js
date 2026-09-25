/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#141618',
    textSecondary: '#5C6168',
    background: '#E4E1DB',
    backgroundElement: '#F3F1EC',
    backgroundSelected: '#D8D4CC',
    primary: '#2A2E33',
    primaryPressed: '#1A1D21',
    border: '#C6C1B8',
    glass: 'rgba(255, 252, 247, 0.58)',
    glassBorder: 'rgba(255, 255, 255, 0.72)',
    shadow: '#1A1C1F',
    shadowOpacity: 0.2,
    success: '#2F8F68',
    warning: '#C4922A',
    error: '#C44B5A',
  },
  dark: {
    text: '#F2F0EA',
    textSecondary: '#9A9EA6',
    background: '#070809',
    backgroundElement: '#121416',
    backgroundSelected: '#1B1E22',
    primary: '#D5D8DE',
    primaryPressed: '#B4B9C0',
    border: '#2A2D32',
    glass: 'rgba(18, 20, 22, 0.52)',
    glassBorder: 'rgba(255, 255, 255, 0.1)',
    shadow: '#000000',
    shadowOpacity: 0.55,
    success: '#4ECB8C',
    warning: '#E0B34A',
    error: '#E56B7A',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
};

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
