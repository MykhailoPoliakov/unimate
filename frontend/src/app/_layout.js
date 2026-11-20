import { DarkTheme, ThemeProvider } from "expo-router"
import * as ScreenOrientation from "expo-screen-orientation"
import * as SplashScreen from "expo-splash-screen"
import * as SystemUI from "expo-system-ui"
import { colorScheme as nativewindColorScheme } from "nativewind"
import { useLayoutEffect } from "react"
import { Appearance, Platform, StatusBar, View } from "react-native"

import "@/global.css"
import "@/nativewind-interop"

import AppTabs from "@/components/app-tabs"
import { Onboarding } from "@/components/onboarding"
import { ScheduleBrowserProvider } from "@/components/schedule-browser"
import { NotificationObserver } from "@/components/notification-observer"
import { FeedProvider } from "@/hooks/use-feed"
import { I18nProvider } from "@/hooks/use-i18n"
import { NotificationsProvider } from "@/hooks/use-notifications"
import { ProfileProvider, useProfile } from "@/hooks/use-profile"
import { Colors } from "@/constants/theme"

SplashScreen.preventAutoHideAsync()
SplashScreen.setOptions?.({ duration: 0, fade: false })

if (Platform.OS !== "web") {
  ScreenOrientation.lockAsync(
    ScreenOrientation.OrientationLock.PORTRAIT_UP,
  ).catch(() => {})
}

// UniMate is dark-only: pin every layer (native appearance, NativeWind, web) to dark.
try {
  nativewindColorScheme.set("dark")
} catch {
  // NativeWind colorScheme may be unavailable during early web boot.
}
if (Platform.OS === "web") {
  if (typeof document !== "undefined") {
    document.documentElement.classList.add("dark")
    document.documentElement.style.colorScheme = "dark"
  }
} else {
  Appearance.setColorScheme("dark")
}

const colors = Colors.dark

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.background,
    border: colors.border,
    text: colors.text,
    primary: colors.primary,
  },
}

function Root() {
  const { profile, isLoading } = useProfile()
  const backgroundColor = colors.background

  useLayoutEffect(() => {
    SystemUI.setBackgroundColorAsync(backgroundColor)
  }, [backgroundColor])

  useLayoutEffect(() => {
    if (isLoading) return
    SplashScreen.hideAsync()
  }, [isLoading])

  if (isLoading) {
    return <View style={{ flex: 1, backgroundColor }} />
  }
  if (!profile) return <Onboarding />
  return (
    <View style={{ flex: 1, backgroundColor }}>
      <NotificationObserver />
      <ScheduleBrowserProvider>
        <AppTabs />
      </ScheduleBrowserProvider>
    </View>
  )
}

export default function TabLayout() {
  return (
    <ThemeProvider value={navigationTheme}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />
        <ProfileProvider>
          <I18nProvider>
            <NotificationsProvider>
              <FeedProvider>
                <Root />
              </FeedProvider>
            </NotificationsProvider>
          </I18nProvider>
        </ProfileProvider>
      </View>
    </ThemeProvider>
  )
}
