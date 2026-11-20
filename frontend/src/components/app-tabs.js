import Ionicons from "@expo/vector-icons/Ionicons"
import { useSegments } from "expo-router"
import { NativeTabs } from "expo-router/unstable-native-tabs"
import { useEffect, useState } from "react"
import { Platform } from "react-native"

import { Colors } from "@/constants/theme"
import { useFeed } from "@/hooks/use-feed"
import { useI18n } from "@/hooks/use-i18n"
import { createNativeStackNavigator } from "expo-router/build/react-navigation/native-stack/index.js"
import SettingsScreen from "@/app/settings"

const systemTabBar =
  Platform.OS === "ios" && parseInt(Platform.Version, 10) >= 26

const Stack = createNativeStackNavigator()

export default function AppTabs() {
  const colors = Colors.dark
  const { t } = useI18n()
  const { unreadNewsCount } = useFeed()
  const segments = useSegments()
  const newsDepth = segments[0] === "news" ? segments.length : 0
  const [newsBadge, setNewsBadge] = useState(unreadNewsCount)

  useEffect(() => {
    // Coming back from an article drops the unread badge. Updating the tab
    // item during that pop rebuilds the selected liquid-glass capsule.
    if (newsDepth > 1) return undefined

    let cancelled = false
    const apply = () => {
      if (!cancelled) setNewsBadge(unreadNewsCount)
    }

    if (newsDepth === 1) {
      const timer = setTimeout(apply, 400)
      return () => {
        cancelled = true
        clearTimeout(timer)
      }
    }

    apply()
    return () => {
      cancelled = true
    }
  }, [newsDepth, unreadNewsCount])

  return (
    <NativeTabs
      {...(systemTabBar
        ? {}
        : {
            backgroundColor: colors.background,
            blurEffect: "systemChromeMaterialDark",
          })}
      disableTransparentOnScrollEdge
      minimizeBehavior="never"
      tintColor={colors.text}
      badgeBackgroundColor={colors.error}
      badgeTextColor="#FFFFFF"
      iconColor={{ default: colors.text, selected: colors.text }}
      labelStyle={{ color: colors.text, selected: { color: colors.text } }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t("home")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "house", selected: "house.fill" }}
          src={{
            default: (
              <NativeTabs.Trigger.VectorIcon
                family={Ionicons}
                name="home-outline"
              />
            ),
            selected: (
              <NativeTabs.Trigger.VectorIcon family={Ionicons} name="home" />
            ),
          }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="news" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Label>{t("news")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Badge hidden={newsBadge <= 0}>
          {newsBadge > 0
            ? newsBadge > 99
              ? "99+"
              : String(newsBadge)
            : undefined}
        </NativeTabs.Trigger.Badge>
        <NativeTabs.Trigger.Icon
          sf={{ default: "newspaper", selected: "newspaper.fill" }}
          src={{
            default: (
              <NativeTabs.Trigger.VectorIcon
                family={Ionicons}
                name="newspaper-outline"
              />
            ),
            selected: (
              <NativeTabs.Trigger.VectorIcon
                family={Ionicons}
                name="newspaper"
              />
            ),
          }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>{t("menu")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "ellipsis.circle", selected: "ellipsis.circle.fill" }}
          src={{
            default: (
              <NativeTabs.Trigger.VectorIcon
                family={Ionicons}
                name="ellipsis-horizontal-circle-outline"
              />
            ),
            selected: (
              <NativeTabs.Trigger.VectorIcon
                family={Ionicons}
                name="ellipsis-horizontal-circle"
              />
            ),
          }}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
