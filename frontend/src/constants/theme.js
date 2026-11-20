/**
 * Below are the colors that are used in the app. UniMate is dark-only.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from "react-native"

export const Colors = {
  dark: {
    text: "#F2F0EA",
    textSecondary: "#9A9EA6",
    background: "#070809",
    backgroundGradient: {
      colors: ["rgba(255, 255, 255, 0.2)", "rgba(0, 0, 0, 0.2)"],
      locations: [0.2, 1],
      start: { x: 0.61, y: 0 },
      end: { x: 0.39, y: 1 },
    },
    backgroundElement: "#121416",
    backgroundSelected: "#1B1E22",
    cardMuted: "#0A0B0D",
    primary: "#D5D8DE",
    primaryPressed: "#B4B9C0",
    border: "#2A2D32",
    glass: "rgba(18, 20, 22, 0.52)",
    glassBorder: "rgba(255, 255, 255, 0.1)",
    shadow: "#000000",
    shadowOpacity: 0.55,
    success: "#4ECB8C",
    warning: "#E0B34A",
    error: "#E56B7A",
  },
}

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "var(--font-display)",
    serif: "var(--font-serif)",
    rounded: "var(--font-rounded)",
    mono: "var(--font-mono)",
  },
})

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
}

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0
/** Clears the tab bar and home indicator, and leaves a gap under the last control. */
export const BottomTabGap =
  Platform.select({ ios: 128, android: 144, default: 112 }) ?? 112
export const MaxContentWidth = 800
