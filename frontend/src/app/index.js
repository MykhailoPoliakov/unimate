import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExternalLink } from '@/components/external-link';
import { useReload } from '@/components/reload-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useI18n } from '@/hooks/use-i18n';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { listButtons } from '@/lib/api';
import { LOCAL_ICONS } from '@/lib/local-icons';

const buttonsByInstitution = {};

function labelFromSlug(slug) {
  return (slug ?? '')
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function institutionFromUrl(url) {
  const value = (url ?? '').toLowerCase();
  if (value.includes('kdg')) return 'kdg';
  if (value.includes('thomasmore') || value.includes('thomas-more')) return 'tm';
  return null;
}

function buttonsForInstitution(items, institution) {
  return (items ?? []).filter((button) => {
    const owner = institutionFromUrl(button.url);
    return owner == null || owner === institution;
  });
}

function parseRgb(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (trimmed.startsWith('#')) return trimmed;
  const parts = trimmed.split(/[,\s]+/).map((part) => Number.parseInt(part, 10)).filter((n) => !Number.isNaN(n));
  if (parts.length < 3) return null;
  return { r: parts[0], g: parts[1], b: parts[2] };
}

const BRAND = {
  canvas: { icon: 'canvas', rgb: { r: 225, g: 63, b: 43 }, wash: 0.22 },
  timeedit: { icon: 'timeedit', rgb: { r: 140, g: 232, b: 196 }, wash: 0.3 },
  'e-studentservice': { icon: 'e-studentservice', rgb: { r: 47, g: 95, b: 168 }, wash: 0.28 },
  'kdg-website': {
    icon: 'kdg-icon',
    rgb: { r: 28, g: 28, b: 28 },
    wash: 0.42,
    lightRgb: { r: 52, g: 52, b: 54 },
    lightWash: 0.1,
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
  return button.platform === 'website' || /^https?:\/\/(www\.)?kdg\.be(\/|$)/.test(url);
}

function buttonBrand(button) {
  if (isCanvasButton(button)) return BRAND.canvas;
  if (isScheduleButton(button)) return BRAND.timeedit;
  if (isStudentServiceButton(button)) return BRAND['e-studentservice'];
  if (isKdgWebsiteButton(button)) return BRAND['kdg-website'];
  return null;
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

function ServiceLink({ title, subtitle, icon, href, color, brand }) {
  const theme = useTheme();
  const light = useColorScheme() !== 'dark';
  const [pressed, setPressed] = useState(false);
  const rgb = (light && brand?.lightRgb ? brand.lightRgb : brand?.rgb) ?? parseRgb(color) ?? { r: 92, g: 101, b: 112 };
  const paper = light ? { r: 243, g: 241, b: 236 } : { r: 22, g: 24, b: 27 };
  const face = mixRgb(paper, rgb, light ? 0.34 : 0.4);
  const highlight = mixRgb(face, { r: 255, g: 255, b: 255 }, light ? 0.72 : 0.38);
  const shadow = mixRgb(face, { r: 0, g: 0, b: 0 }, light ? 0.32 : 0.55);
  const topLeft = rgbCss(pressed ? shadow : highlight);
  const bottomRight = rgbCss(pressed ? highlight : shadow);
  const well = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.92)`;
  const localIcon = (brand?.icon && LOCAL_ICONS[brand.icon]) || LOCAL_ICONS[icon];

  return (
    <ExternalLink href={href} asChild>
      <Pressable
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={{ transform: [{ translateY: pressed ? 3 : 0 }] }}>
        <View
          style={{
            borderRadius: 16,
            backgroundColor: rgbCss(shadow),
            padding: 2,
            shadowColor: rgbCss(shadow),
            shadowOffset: { width: 0, height: pressed ? 0 : 4 },
            shadowOpacity: pressed ? 0 : light ? 0.18 : 0.45,
            shadowRadius: 0,
            elevation: pressed ? 0 : 4,
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
              {localIcon ? (
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
                    source={localIcon}
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
                  <ThemedText type="small" themeColor="textSecondary">
                    {subtitle}
                  </ThemedText>
                ) : null}
              </ThemedView>
              <Ionicons name="open-outline" size={18} color={theme.textSecondary} />
            </ThemedView>
          </View>
        </View>
      </Pressable>
    </ExternalLink>
  );
}

export default function HomeScreen() {
  const { profile } = useProfile();
  const { t } = useI18n();
  const theme = useTheme();
  const institution = profile?.institution;
  const institutionRef = useRef(institution);
  institutionRef.current = institution;
  const [buttons, setButtons] = useState(() =>
    institution ? buttonsByInstitution[institution] ?? [] : []
  );

  const loadButtons = useCallback(async () => {
    if (!profile?.userId || !institution) {
      setButtons([]);
      return;
    }

    const requestedFor = institution;
    setButtons(buttonsByInstitution[requestedFor] ?? []);
    try {
      const items = await listButtons(profile.userId);
      if (requestedFor !== institutionRef.current) return;
      const next = buttonsForInstitution(items, requestedFor);
      if (next.length > 0) {
        buttonsByInstitution[requestedFor] = next;
        setButtons(next);
        return;
      }
      setButtons(buttonsByInstitution[requestedFor] ?? []);
    } catch {
      if (requestedFor !== institutionRef.current) return;
      setButtons(buttonsByInstitution[requestedFor] ?? []);
    }
  }, [profile?.userId, institution, profile?.program, profile?.yearOfStudy, profile?.language]);

  const { refreshing, reload } = useReload(loadButtons);

  useFocusEffect(
    useCallback(() => {
      loadButtons();
    }, [loadButtons])
  );

  return (
    <ThemedView className="flex-1 flex-row justify-center">
      <SafeAreaView className="flex-1 px-four max-w-content self-stretch w-full pb-bottom-tab-gap">
        <ThemedView className="bg-transparent pt-six pb-four">
          <ThemedText type="subtitle">
            {profile?.institutionName || labelFromSlug(institution) || t('homeCampus')}
          </ThemedText>
        </ThemedView>

        <ThemedText type="small" themeColor="textSecondary" className="uppercase mb-two">
          {t('services')}
        </ThemedText>
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-two pb-two"
          alwaysBounceVertical
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={reload}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }>
        <ThemedView className="gap-two bg-transparent">
          {buttons.length === 0 ? (
            <ThemedText themeColor="textSecondary">{t('noServices')}</ThemedText>
          ) : (
            buttons.map((button) => (
              <ServiceLink
                key={button.id}
                title={button.title}
                subtitle={
                  isScheduleButton(button)
                    ? SCHEDULE_SUBTITLE[profile?.language] ?? SCHEDULE_SUBTITLE.en
                    : button.description
                }
                icon={buttonIcon(button)}
                href={button.url}
                color={button.color}
                brand={buttonBrand(button)}
              />
            ))
          )}
        </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
