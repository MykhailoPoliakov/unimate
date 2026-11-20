import Ionicons from "@expo/vector-icons/Ionicons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { Image } from "expo-image"
import { useFocusEffect, useRouter } from "expo-router"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ActionSheetIOS,
  View,
} from "react-native"
import {
  GestureHandlerRootView,
  ScrollView,
} from "react-native-gesture-handler"
import Animated from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { useIsFocused } from "expo-router"

import { linksStorageKey } from "@/components/button-modal"
import { openExternalUrl } from "@/components/external-link"
import { GradientBackground } from "@/components/gradient-background"
import { GlassCard, GlassCircleButton } from "@/components/glass-card"
import {
  scheduleStartUrl,
  scheduleStorageKey,
  timetableUrl,
  useScheduleBrowser,
} from "@/components/schedule-browser"
import { listEnter } from "@/components/motion"
import { useReload } from "@/components/reload-button"
import { SortableSection } from "@/components/sortable-section"
import { ThemedText } from "@/components/themed-text"
import { ThemedView } from "@/components/themed-view"
import { useI18n } from "@/hooks/use-i18n"
import { useProfile } from "@/hooks/use-profile"
import { useTheme } from "@/hooks/use-theme"
import { campusServicesFor } from "@/constants/campus-services"
import {
  listButtons,
  listHomeButtons,
  listInstitutions,
  previewButton,
} from "@/lib/api"
import { setLinkDraft } from "@/lib/nav-draft"
import NewsScreen from "../news"
import Streak from "@/components/streak"

function labelFromSlug(slug) {
  return (slug ?? "")
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

const BRAND = {
  canvas: { icon: "book-outline" },
  timeedit: { icon: "calendar-outline" },
  "e-studentservice": { icon: "school-outline" },
  "kdg-website": { icon: "globe-outline" },
}

function isCanvasButton(button) {
  const url = (button.url ?? "").toLowerCase()
  return button.platform === "canvas" || url.includes("canvas")
}

function isScheduleButton(button) {
  const url = (button.url ?? "").toLowerCase()
  return (
    button.platform === "schedule" ||
    url.includes("timeedit") ||
    url.includes("schedule") ||
    url.includes("rooster")
  )
}

function isStudentServiceButton(button) {
  const url = (button.url ?? "").toLowerCase()
  return (
    button.platform === "student-service" ||
    url.includes("e-student") ||
    url.includes("studentservice")
  )
}

function isKdgWebsiteButton(button) {
  const url = (button.url ?? "").toLowerCase()
  return /^https?:\/\/(www\.)?kdg\.be(\/|$)/.test(url)
}

function buttonBrand(button) {
  if (button.platform === "custom") return null
  if (isCanvasButton(button)) return BRAND.canvas
  if (isScheduleButton(button)) return BRAND.timeedit
  if (isStudentServiceButton(button)) return BRAND["e-studentservice"]
  if (isKdgWebsiteButton(button)) return BRAND["kdg-website"]
  return null
}

function isCustomButton(button) {
  return button.platform === "custom" || !buttonBrand(button)
}

function linksMigratedKey(userId) {
  return `unimate.localLinksMigrated.${userId}`
}

function buttonIcon(button) {
  const brand = buttonBrand(button)
  if (brand) return brand.icon
  const legacyIconFallbacks = {
    canvas: "book-outline",
    timeedit: "calendar-outline",
    "e-studentservice": "school-outline",
    "kdg-icon": "globe-outline",
  }
  if (button.icon) return legacyIconFallbacks[button.icon] ?? button.icon
  const url = (button.url ?? "").toLowerCase()
  if (url.includes("student")) return "school"
  if (url.includes("outlook") || url.includes("mail")) return "mail"
  if (url.includes("kdg.be")) return "earth"
  return "open-outline"
}

function openButtonMenu({ t, onEdit, onDelete }) {
  const runDelete = () => setTimeout(onDelete, 350)

  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [t("cancel"), t("edit"), t("delete")],
        cancelButtonIndex: 0,
        destructiveButtonIndex: 2,
      },
      (index) => {
        if (index === 1) onEdit()
        if (index === 2) runDelete()
      },
    )
    return
  }

  Alert.alert(t("editService"), undefined, [
    { text: t("cancel"), style: "cancel" },
    { text: t("edit"), onPress: onEdit },
    { text: t("delete"), style: "destructive", onPress: onDelete },
  ])
}

// Icon shown for a service: the site's own favicon (remote image) or an Ionicon.
function ServiceIcon({ icon, tile, onImageError }) {
  const theme = useTheme()
  const isRemote = typeof icon === "string" && icon.startsWith("http")

  if (isRemote) {
    const size = tile ? 40 : 56
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: tile ? 12 : 18,
          borderWidth: tile ? 0 : 1,
          borderColor: tile ? "transparent" : theme.glassBorder,
          overflow: "hidden",
        }}
      >
        <Image
          source={{ uri: icon }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          onError={onImageError}
        />
      </View>
    )
  }

  return (
    <ThemedView
      className={
        tile
          ? "items-center justify-center bg-transparent"
          : "w-[56px] h-[56px] rounded-five items-center justify-center"
      }
      style={
        tile
          ? { width: 40, height: 40 }
          : {
              backgroundColor: theme.glass,
              borderWidth: 1,
              borderColor: theme.glassBorder,
            }
      }
    >
      <Ionicons name={icon} size={tile ? 32 : 30} color={theme.primary} />
    </ThemedView>
  )
}

function ServiceLink({
  title,
  subtitle,
  icon,
  href,
  onPress,
  onLongPress,
  blockHeldPress,
  // "featured": wide row with title + subtitle. "tile": square, icon with title underneath.
  variant = "featured",
}) {
  const theme = useTheme()
  const { profile } = useProfile()
  const [pressed, setPressed] = useState(false)
  const [siteIcon, setSiteIcon] = useState(null)

  useEffect(() => {
    if (!profile?.userId || !/^https?:\/\//i.test(href ?? "")) return undefined
    let cancelled = false
    previewButton(profile.userId, href)
      .then((preview) => {
        if (
          !cancelled &&
          typeof preview?.icon === "string" &&
          /^https?:\/\//i.test(preview.icon)
        ) {
          setSiteIcon({
            key: `${profile.userId}:${href}`,
            uri: preview.icon,
            failed: false,
          })
        }
      })
      .catch((error) => {
        if (!cancelled) console.warn("Unable to load home button icon", error)
      })
    return () => {
      cancelled = true
    }
  }, [href, profile?.userId])
  const iconKey = `${profile?.userId ?? ""}:${href ?? ""}`
  const parsedIcon =
    siteIcon?.key === iconKey && !siteIcon.failed ? siteIcon.uri : null
  const downAt = useRef(0)
  const skipPress = useRef(false)
  const displayIcon = parsedIcon || icon
  const tile = variant === "tile"

  const markIconFailed = () =>
    setSiteIcon((current) =>
      current?.key === iconKey ? { ...current, failed: true } : current,
    )

  return (
    <GlassCard
      style={{
        flex: tile ? 1 : undefined,
        borderRadius: tile ? 22 : 20,
        shadowOpacity: pressed ? 0 : theme.shadowOpacity,
        transform: [{ translateY: pressed ? 3 : 0 }],
      }}
    >
      <Pressable
        onPress={() => {
          if (skipPress.current) {
            skipPress.current = false
            return
          }
          if (blockHeldPress && Date.now() - downAt.current > 280) return
          if (onPress) onPress()
          else openExternalUrl(href, theme)
        }}
        onLongPress={
          onLongPress
            ? () => {
                skipPress.current = true
                onLongPress()
              }
            : undefined
        }
        delayLongPress={450}
        onPressIn={() => {
          downAt.current = Date.now()
          setPressed(true)
        }}
        onPressOut={() => setPressed(false)}
        accessibilityRole="button"
        accessibilityLabel={title}
        style={tile ? { flex: 1 } : undefined}
      >
        {tile ? (
          <ThemedView
            className="flex-1 items-center justify-center bg-transparent"
            style={{ gap: 8, paddingHorizontal: 6, paddingVertical: 10 }}
          >
            <ServiceIcon
              tile
              icon={displayIcon}
              onImageError={markIconFailed}
            />
            {/* One line for every tile so icons stay aligned; long titles shrink to fit. */}
            <ThemedText
              type="small"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={{
                fontSize: 12,
                lineHeight: 15,
                textAlign: "center",
                alignSelf: "stretch",
              }}
            >
              {title}
            </ThemedText>
          </ThemedView>
        ) : (
          <ThemedView className="min-h-[112px] flex-row items-center gap-three px-four py-three bg-transparent">
            <ServiceIcon icon={displayIcon} onImageError={markIconFailed} />
            <ThemedView className="flex-1 bg-transparent">
              <ThemedText type="subtitle">{title}</ThemedText>
              {subtitle ? (
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  style={{ marginTop: 4, lineHeight: 18 }}
                >
                  {subtitle}
                </ThemedText>
              ) : null}
            </ThemedView>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </ThemedView>
        )}
      </Pressable>
    </GlassCard>
  )
}

export default function HomeScreen() {
  const isFocused = useIsFocused()

  const insets = useSafeAreaInsets()
  const { profile } = useProfile()
  const { t } = useI18n()
  const theme = useTheme()
  const { preloadSchedule, openSchedule } = useScheduleBrowser()
  const router = useRouter()
  const institution = profile?.institution
  const defaultServices = useMemo(
    () => campusServicesFor(institution, profile?.language),
    [institution, profile?.language],
  )
  const [remoteServices, setRemoteServices] = useState(null)
  const services =
    remoteServices?.institution === institution
      ? remoteServices.buttons
      : defaultServices
  const schedulePortalUrl =
    services.find(
      (button) => isScheduleButton(button) && !isCustomButton(button),
    )?.url ?? "https://timeedit.kdg.be/"
  const scheduleService = services.find(
    (button) => isScheduleButton(button) && !isCustomButton(button),
  )
  const otherServices = scheduleService
    ? services.filter((button) => button.id !== scheduleService.id)
    : services
  const [extras, setExtras] = useState([])
  const [preloadedSchedule, setPreloadedSchedule] = useState(null)
  const [currentInstitutionName, setCurrentInstitutionName] = useState(null)

  useEffect(() => {
    if (Platform.OS === "web" || !profile?.userId) return undefined
    let cancelled = false
    AsyncStorage.getItem(scheduleStorageKey(profile.userId))
      .then((saved) => {
        if (!cancelled) {
          const initialUrl = scheduleStartUrl(
            timetableUrl(saved) || schedulePortalUrl,
          )
          setPreloadedSchedule({
            userId: profile.userId,
            url: initialUrl,
          })
          preloadSchedule(profile.userId, initialUrl)
        }
      })
      .catch((error) => {
        console.warn("Unable to preload saved schedule link", error)
        if (!cancelled) {
          const initialUrl = scheduleStartUrl(schedulePortalUrl)
          setPreloadedSchedule({
            userId: profile.userId,
            url: initialUrl,
          })
          preloadSchedule(profile.userId, initialUrl)
        }
      })
    return () => {
      cancelled = true
    }
  }, [preloadSchedule, profile?.userId, schedulePortalUrl])

  const openOwnSchedule = useCallback(
    async (forcePortal = false) => {
      if (!profile?.userId) return
      const next = forcePortal
        ? scheduleStartUrl(schedulePortalUrl)
        : preloadedSchedule?.userId === profile.userId
          ? preloadedSchedule.url
          : scheduleStartUrl(
              timetableUrl(
                await AsyncStorage.getItem(scheduleStorageKey(profile.userId)),
              ) || schedulePortalUrl,
            )
      if (Platform.OS === "web") {
        openExternalUrl(next, theme)
        return
      }
      openSchedule(profile.userId, next)
    },
    [openSchedule, preloadedSchedule, profile, schedulePortalUrl, theme],
  )

  const persistLinks = useCallback(
    async (next) => {
      setExtras(next)
      if (profile?.userId) {
        await AsyncStorage.setItem(
          linksStorageKey(profile.userId),
          JSON.stringify(next),
        )
      }
    },
    [profile],
  )

  const loadHome = useCallback(async () => {
    if (!profile?.userId) {
      setExtras([])
      setRemoteServices({
        institution,
        buttons: defaultServices,
        configured: false,
      })
      setCurrentInstitutionName(null)
      return
    }

    const [institutionResult, buttonResult] = await Promise.allSettled([
      listInstitutions(),
      listHomeButtons(profile.userId),
    ])
    if (institutionResult.status === "fulfilled") {
      const current = institutionResult.value.find(
        (row) => row.slug === institution,
      )
      setCurrentInstitutionName(current?.name ?? null)
    } else {
      setCurrentInstitutionName(null)
    }
    if (buttonResult.status === "fulfilled") {
      setRemoteServices({
        institution,
        buttons: buttonResult.value.configured
          ? buttonResult.value.buttons
          : defaultServices,
        configured: buttonResult.value.configured,
      })
    } else {
      setRemoteServices({
        institution,
        buttons: defaultServices,
        configured: false,
      })
    }

    try {
      const stored = JSON.parse(
        (await AsyncStorage.getItem(linksStorageKey(profile.userId))) ?? "[]",
      )
      if (Array.isArray(stored) && stored.length) {
        setExtras(stored.map((item) => ({ ...item, canManage: true })))
        return
      }
      const migrated = await AsyncStorage.getItem(
        linksMigratedKey(profile.userId),
      )
      if (migrated) {
        setExtras([])
        return
      }
      const items = await listButtons(profile.userId)
      const copied = items
        .filter((item) => isCustomButton(item))
        .map((item) => ({ ...item, platform: "custom", canManage: true }))
      await persistLinks(copied)
      await AsyncStorage.setItem(linksMigratedKey(profile.userId), "1")
    } catch {
      setExtras([])
    }
  }, [profile, institution, defaultServices, persistLinks])

  const { refreshing, reload } = useReload(loadHome)

  useFocusEffect(
    useCallback(() => {
      loadHome()
    }, [loadHome]),
  )

  const handleDelete = (item) => {
    persistLinks(extras.filter((row) => row.id !== item.id))
  }

  const handleHold = (item) => {
    openButtonMenu({
      t,
      onEdit: () => openComposer(item),
      onDelete: () => handleDelete(item),
    })
  }

  const openComposer = (item) => {
    setLinkDraft(item?.id ? item : null)
    router.push("/compose")
  }

  const openNewsTab = () => {
    router.push("/news")
  }

  const renderButton = (button, { blockHeldPress, variant } = {}) => {
    const schedule = isScheduleButton(button) && !isCustomButton(button)
    return (
      <ServiceLink
        title={button.title}
        subtitle={button.description}
        icon={buttonIcon(button)}
        href={button.url}
        blockHeldPress={blockHeldPress}
        variant={variant}
        onPress={schedule ? () => openOwnSchedule(false) : undefined}
        onLongPress={schedule ? () => openOwnSchedule(true) : undefined}
      />
    )
  }

  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      <ThemedView className="flex-1 bg-transparent">
        <GradientBackground />
        <View className="flex-1">
          <ScrollView
            className="flex-1"
            contentContainerClassName="px-four pb-bottom-tab-gap max-w-content self-center w-full"
            contentContainerStyle={{ paddingTop: insets.top }}
            alwaysBounceVertical
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={reload}
                tintColor={theme.primary}
                colors={[theme.primary]}
              />
            }
          >
            <ThemedView
              className="flex-row items-center justify-between bg-transparent pb-four"
              style={{ paddingTop: 8, margin: "0" }}
            >
              <ThemedText type="subtitle">
                {currentInstitutionName ||
                  profile?.institutionName ||
                  labelFromSlug(institution) ||
                  t("homeCampus")}
              </ThemedText>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <GlassCircleButton
                  onPress={() => openNewsTab()}
                  icon={"newspaper-outline"}
                />
                <GlassCircleButton
                  onPress={() => openComposer(null)}
                  icon={"add"}
                  accessibilityLabel={t("addHomeButton")}
                />
              </View>
            </ThemedView>

            <Streak isFocused={isFocused} />

            {scheduleService ? (
              <Animated.View
                key={scheduleService.id}
                entering={listEnter(0)}
                style={{ marginBottom: 12 }}
              >
                {renderButton(scheduleService)}
              </Animated.View>
            ) : null}
            {otherServices.length > 0 ? (
              <View style={{ gap: 12 }}>
                {Array.from(
                  { length: Math.ceil(otherServices.length / 3) },
                  (_, rowIndex) => {
                    const row = otherServices.slice(
                      rowIndex * 3,
                      rowIndex * 3 + 3,
                    )
                    return (
                      <View
                        key={`service-row-${rowIndex}`}
                        style={{ flexDirection: "row", gap: 12 }}
                      >
                        {row.map((button, index) => (
                          <Animated.View
                            key={button.id}
                            entering={listEnter(rowIndex * 3 + index + 1)}
                            style={{ flex: 1, aspectRatio: 1 }}
                          >
                            {renderButton(button, { variant: "tile" })}
                          </Animated.View>
                        ))}
                        {row.length < 3
                          ? Array.from(
                              { length: 3 - row.length },
                              (_, index) => (
                                <View
                                  key={`service-spacer-${rowIndex}-${index}`}
                                  style={{ flex: 1 }}
                                />
                              ),
                            )
                          : null}
                      </View>
                    )
                  },
                )}
              </View>
            ) : null}
            {services.length === 0 && (
              <ThemedText themeColor="textSecondary" className="mb-four">
                {t("noServices")}
              </ThemedText>
            )}
            {extras.length > 0 ? (
              <>
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  className="uppercase mb-two mt-three"
                >
                  {t("extraLinks")}
                </ThemedText>
                <SortableSection
                  items={extras}
                  enabled={extras.length > 1}
                  onHold={handleHold}
                  onReorder={persistLinks}
                  renderItem={(item) =>
                    renderButton(item, { blockHeldPress: true })
                  }
                />
              </>
            ) : null}
          </ScrollView>
        </View>
      </ThemedView>
    </GestureHandlerRootView>
  )
}
