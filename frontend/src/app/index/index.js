import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Platform, Pressable, RefreshControl, ActionSheetIOS, View } from 'react-native';
import { GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { DEFAULT_LINK_COLOR, linksStorageKey } from '@/components/button-modal';
import { openExternalUrl } from '@/components/external-link';
import { useReload } from '@/components/reload-button';
import { SortableSection } from '@/components/sortable-section';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useI18n } from '@/hooks/use-i18n';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { listButtons } from '@/lib/api';
import { LOCAL_ICONS } from '@/lib/local-icons';
import { setLinkDraft } from '@/lib/nav-draft';

const buttonsByInstitution = {};

function labelFromSlug(slug) {
  return (slug ?? '')
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function parseRgb(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (trimmed.startsWith('#')) {
    let hex = trimmed.slice(1);
    if (hex.length === 3) hex = hex.split('').map((part) => part + part).join('');
    if (hex.length !== 6) return null;
    const n = Number.parseInt(hex, 16);
    if (Number.isNaN(n)) return null;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const parts = trimmed.split(/[,\s]+/).map((part) => Number.parseInt(part, 10)).filter((n) => !Number.isNaN(n));
  if (parts.length < 3) return null;
  return { r: parts[0], g: parts[1], b: parts[2] };
}

const BRAND = {
  canvas: { icon: 'canvas', rgb: { r: 225, g: 63, b: 43 } },
  timeedit: { icon: 'timeedit', rgb: { r: 140, g: 232, b: 196 } },
  'e-studentservice': { icon: 'e-studentservice', rgb: { r: 47, g: 95, b: 168 } },
  'kdg-website': {
    icon: 'kdg-icon',
    rgb: { r: 28, g: 28, b: 28 },
    lightRgb: { r: 52, g: 52, b: 54 },
  },
};

const SCHEDULE_SUBTITLE = {
  nl: 'Lesrooster',
  de: 'Stundenplan',
  fr: 'Emploi du temps',
  en: 'Class timetable',
  uk: 'Розклад',
  ru: 'Расписание',
};

function isCanvasButton(button) {
  const url = (button.url ?? '').toLowerCase();
  return button.platform === 'canvas' || url.includes('canvas');
}

function isScheduleButton(button) {
  const url = (button.url ?? '').toLowerCase();
  return (
    button.platform === 'schedule' ||
    url.includes('timeedit') ||
    url.includes('schedule') ||
    url.includes('rooster')
  );
}

function isStudentServiceButton(button) {
  const url = (button.url ?? '').toLowerCase();
  return (
    button.platform === 'student-service' ||
    url.includes('e-student') ||
    url.includes('studentservice')
  );
}

function isKdgWebsiteButton(button) {
  const url = (button.url ?? '').toLowerCase();
  return /^https?:\/\/(www\.)?kdg\.be(\/|$)/.test(url);
}

function buttonBrand(button) {
  if (button.platform === 'custom') return null;
  if (isCanvasButton(button)) return BRAND.canvas;
  if (isScheduleButton(button)) return BRAND.timeedit;
  if (isStudentServiceButton(button)) return BRAND['e-studentservice'];
  if (isKdgWebsiteButton(button)) return BRAND['kdg-website'];
  return null;
}

function isCustomButton(button) {
  return button.platform === 'custom' || !buttonBrand(button);
}

function linksMigratedKey(userId) {
  return `unimate.localLinksMigrated.${userId}`;
}

function buttonIcon(button) {
  const brand = buttonBrand(button);
  if (brand) return brand.icon;
  if (button.icon) return button.icon;
  const url = (button.url ?? '').toLowerCase();
  if (url.includes('student')) return 'school';
  if (url.includes('outlook') || url.includes('mail')) return 'mail';
  if (url.includes('kdg.be')) return 'earth';
  return 'open-outline';
}

function mixRgb(from, to, amount) {
  return {
    r: Math.round(from.r + (to.r - from.r) * amount),
    g: Math.round(from.g + (to.g - from.g) * amount),
    b: Math.round(from.b + (to.b - from.b) * amount),
  };
}

function rgbCss(value, alpha = 1) {
  return `rgba(${value.r}, ${value.g}, ${value.b}, ${alpha})`;
}

function openButtonMenu({ t, onEdit, onDelete }) {
  const runDelete = () => setTimeout(onDelete, 350);

  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [t('cancel'), t('edit'), t('delete')],
        cancelButtonIndex: 0,
        destructiveButtonIndex: 2,
      },
      (index) => {
        if (index === 1) onEdit();
        if (index === 2) runDelete();
      }
    );
    return;
  }

  Alert.alert(t('editService'), undefined, [
    { text: t('cancel'), style: 'cancel' },
    { text: t('edit'), onPress: onEdit },
    { text: t('delete'), style: 'destructive', onPress: onDelete },
  ]);
}

function ServiceLink({ title, subtitle, icon, href, color, brand, onLongPress, blockHeldPress }) {
  const theme = useTheme();
  const light = useColorScheme() !== 'dark';
  const [pressed, setPressed] = useState(false);
  const downAt = useRef(0);
  const skipPress = useRef(false);
  const rgb = (light && brand?.lightRgb ? brand.lightRgb : brand?.rgb) ?? parseRgb(color) ?? parseRgb(DEFAULT_LINK_COLOR);
  const paper = light ? { r: 243, g: 241, b: 236 } : { r: 22, g: 24, b: 27 };
  const face = mixRgb(paper, rgb, light ? 0.34 : 0.4);
  const highlight = mixRgb(face, { r: 255, g: 255, b: 255 }, light ? 0.72 : 0.38);
  const shadow = mixRgb(face, { r: 0, g: 0, b: 0 }, light ? 0.32 : 0.55);
  const topLeft = rgbCss(pressed ? shadow : highlight);
  const bottomRight = rgbCss(pressed ? highlight : shadow);
  const well = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.92)`;
  const localIcon = (brand?.icon && LOCAL_ICONS[brand.icon]) || LOCAL_ICONS[icon];

  return (
    <Pressable
      onPress={() => {
        if (skipPress.current) {
          skipPress.current = false;
          return;
        }
        if (blockHeldPress && Date.now() - downAt.current > 280) return;
        openExternalUrl(href, theme);
      }}
      onLongPress={
        onLongPress
          ? () => {
              skipPress.current = true;
              onLongPress();
            }
          : undefined
      }
      delayLongPress={450}
      onPressIn={() => {
        downAt.current = Date.now();
        setPressed(true);
      }}
      onPressOut={() => setPressed(false)}
      style={{
        borderRadius: 16,
        backgroundColor: rgbCss(shadow),
        padding: 2,
        shadowColor: rgbCss(shadow),
        shadowOffset: { width: 0, height: pressed ? 0 : 4 },
        shadowOpacity: pressed ? 0 : light ? 0.18 : 0.45,
        shadowRadius: 0,
        elevation: pressed ? 0 : 4,
        transform: [{ translateY: pressed ? 3 : 0 }],
      }}>
      <View
        style={{
          borderRadius: 14,
          backgroundColor: rgbCss(mixRgb(face, shadow, pressed ? 0.12 : 0)),
          borderWidth: 3,
          borderTopColor: topLeft,
          borderLeftColor: topLeft,
          borderRightColor: bottomRight,
          borderBottomColor: bottomRight,
        }}>
        <ThemedView className="flex-row items-center gap-three px-three py-three bg-transparent">
          {localIcon || (typeof icon === 'string' && icon.startsWith('http')) ? (
            <View
              style={{
                borderRadius: 10,
                borderWidth: 2,
                borderTopColor: topLeft,
                borderLeftColor: topLeft,
                borderRightColor: bottomRight,
                borderBottomColor: bottomRight,
                overflow: 'hidden',
              }}>
              <Image
                source={localIcon ?? { uri: icon }}
                style={{ width: 40, height: 40, borderRadius: 8 }}
                contentFit="cover"
              />
            </View>
          ) : (
            <ThemedView
              className="w-[44px] h-[44px] rounded-two items-center justify-center bg-transparent"
              style={{
                backgroundColor: well,
                borderWidth: 2,
                borderTopColor: topLeft,
                borderLeftColor: topLeft,
                borderRightColor: bottomRight,
                borderBottomColor: bottomRight,
              }}>
              <Ionicons name={icon} size={28} color="#F3F0E8" />
            </ThemedView>
          )}
          <ThemedView className="flex-1 bg-transparent">
            <ThemedText type="smallBold">{title}</ThemedText>
            {subtitle ? (
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={{ fontSize: 11, lineHeight: 14 }}>
                {subtitle}
              </ThemedText>
            ) : null}
          </ThemedView>
          <Ionicons name="open-outline" size={18} color={theme.textSecondary} />
        </ThemedView>
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { profile } = useProfile();
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const institution = profile?.institution;
  const institutionRef = useRef(institution);
  institutionRef.current = institution;
  const [services, setServices] = useState(() =>
    institution ? buttonsByInstitution[institution] ?? [] : []
  );
  const [extras, setExtras] = useState([]);

  const persistLinks = useCallback(
    async (next) => {
      setExtras(next);
      if (profile?.userId) {
        await AsyncStorage.setItem(linksStorageKey(profile.userId), JSON.stringify(next));
      }
    },
    [profile?.userId]
  );

  const loadHome = useCallback(async () => {
    if (!profile?.userId || !institution) {
      setServices([]);
      setExtras([]);
      return;
    }

    const requestedFor = institution;
    setServices(buttonsByInstitution[requestedFor] ?? []);
    try {
      const stored = JSON.parse((await AsyncStorage.getItem(linksStorageKey(profile.userId))) ?? '[]');
      if (Array.isArray(stored) && stored.length) {
        setExtras(stored.map((item) => ({ ...item, canManage: true })));
      } else {
        const migrated = await AsyncStorage.getItem(linksMigratedKey(profile.userId));
        if (!migrated) {
          const items = await listButtons(profile.userId);
          const copied = items
            .filter((item) => isCustomButton(item))
            .map((item) => ({ ...item, platform: 'custom', canManage: true }));
          await persistLinks(copied);
          await AsyncStorage.setItem(linksMigratedKey(profile.userId), '1');
        } else {
          setExtras([]);
        }
      }
    } catch {
      setExtras([]);
    }

    try {
      const items = await listButtons(profile.userId);
      if (requestedFor !== institutionRef.current) return;
      const next = items.filter((item) => !isCustomButton(item));
      buttonsByInstitution[requestedFor] = next;
      setServices(next);
    } catch {
      if (requestedFor !== institutionRef.current) return;
      setServices(buttonsByInstitution[requestedFor] ?? []);
    }
  }, [profile?.userId, institution, persistLinks]);

  const { refreshing, reload } = useReload(loadHome);

  useFocusEffect(
    useCallback(() => {
      loadHome();
    }, [loadHome])
  );

  const handleDelete = (item) => {
    persistLinks(extras.filter((row) => row.id !== item.id));
  };

  const handleHold = (item) => {
    openButtonMenu({
      t,
      onEdit: () => openComposer(item),
      onDelete: () => handleDelete(item),
    });
  };

  const openComposer = (item) => {
    setLinkDraft(item?.id ? item : null);
    router.push('/compose');
  };

  const renderButton = (button, { blockHeldPress } = {}) => (
    <ServiceLink
      title={button.title}
      subtitle={
        isScheduleButton(button)
          ? SCHEDULE_SUBTITLE[profile?.language] ?? SCHEDULE_SUBTITLE.en
          : button.description
      }
      icon={buttonIcon(button)}
      href={button.url}
      color={button.color ?? DEFAULT_LINK_COLOR}
      brand={buttonBrand(button)}
      blockHeldPress={blockHeldPress}
    />
  );

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.background }}>
      <ThemedView className="flex-1">
        <SafeAreaView className="flex-1" edges={[]}>
          <ScrollView
            className="flex-1"
            contentContainerClassName="px-four pb-bottom-tab-gap max-w-content self-center w-full"
            alwaysBounceVertical
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={reload}
                tintColor={theme.primary}
                colors={[theme.primary]}
              />
            }>
            <ThemedView
              className="flex-row items-center justify-between bg-transparent pb-four"
              style={{ paddingTop: (insets.top || 59) + 8 }}>
              <ThemedText type="subtitle">
                {profile?.institutionName || labelFromSlug(institution) || t('homeCampus')}
              </ThemedText>
              <Pressable onPress={() => openComposer(null)} className="active:opacity-70">
                  <ThemedView
                    type="backgroundSelected"
                    className="w-[40px] h-[40px] rounded-five items-center justify-center">
                    <Ionicons name="add" size={22} color={theme.primary} />
                  </ThemedView>
                </Pressable>
            </ThemedView>

            <ThemedText type="small" themeColor="textSecondary" className="uppercase mb-two">
              {t('services')}
            </ThemedText>
            {services.length === 0 ? (
              <ThemedText themeColor="textSecondary" className="mb-four">
                {t('noServices')}
              </ThemedText>
            ) : (
              services.map((button) => (
                <View key={button.id} style={{ marginBottom: 8 }}>
                  {renderButton(button)}
                </View>
              ))
            )}
            {extras.length > 0 ? (
              <>
                <ThemedText type="small" themeColor="textSecondary" className="uppercase mb-two mt-three">
                  {t('extraLinks')}
                </ThemedText>
                <SortableSection
                  items={extras}
                  enabled={extras.length > 1}
                  onHold={handleHold}
                  onReorder={persistLinks}
                  renderItem={(item) => renderButton(item, { blockHeldPress: true })}
                />
              </>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    </GestureHandlerRootView>
  );
}
