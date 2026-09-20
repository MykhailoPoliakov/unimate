/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#151622',
    textSecondary: '#686A78',
    background: '#F7F7FA',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#F0F0F6',
    primary: '#5B5CE2',
    primaryPressed: '#4849C7',
    border: '#E2E2EA',
    success: '#32B878',
    warning: '#F4B740',
    error: '#E85D75',
  },
  dark: {
    text: '#F5F5FA',
    textSecondary: '#A5A7B5',
    background: '#0D0E14',
    backgroundElement: '#171922',
    backgroundSelected: '#1E202B',
    primary: '#7C7FF2',
    primaryPressed: '#686BE0',
    border: '#292B38',
    success: '#43D48E',
    warning: '#FFC857',
    error: '#FF7187',
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
