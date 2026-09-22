import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useI18n } from '@/hooks/use-i18n';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { listButtons } from '@/lib/api';

const buttonsByInstitution = {};

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

function buttonIcon(button) {
  if (button.icon) return button.icon;
  const url = (button.url ?? '').toLowerCase();
  if (url.includes('canvas')) return 'book';
  if (url.includes('student')) return 'document-text';
  if (url.includes('timeedit') || url.includes('schedule') || url.includes('rooster')) {
    return 'calendar';
  }
  if (url.includes('outlook') || url.includes('mail')) return 'mail';
  if (url.includes('kdg.be')) return 'globe-outline';
  return 'open-outline';
}

function ServiceLink({ title, subtitle, icon, href }) {
  const theme = useTheme();

  return (
    <ExternalLink href={href} asChild>
      <Pressable className="active:opacity-70">
        <ThemedView
          type="backgroundElement"
          className="flex-row items-center gap-three px-three py-three rounded-three">
          <ThemedView
            type="backgroundSelected"
            className="w-[44px] h-[44px] rounded-two items-center justify-center">
            <Ionicons name={icon} size={22} color={theme.primary} />
          </ThemedView>
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
      </Pressable>
    </ExternalLink>
  );
}

export default function HomeScreen() {
  const { profile } = useProfile();
  const { t } = useI18n();
  const institution = profile?.institution;
  const institutionRef = useRef(institution);
  institutionRef.current = institution;
  const [buttons, setButtons] = useState(() =>
    institution ? buttonsByInstitution[institution] ?? [] : []
  );

  useFocusEffect(
    useCallback(() => {
      if (!profile?.userId || !institution) {
        setButtons([]);
        return undefined;
      }

      setButtons(buttonsByInstitution[institution] ?? []);

      const requestedFor = institution;
      let cancelled = false;
      listButtons(profile.userId)
        .then((items) => {
          if (cancelled || requestedFor !== institutionRef.current) return;
          const next = buttonsForInstitution(items, requestedFor);
          if (next.length > 0) {
            buttonsByInstitution[requestedFor] = next;
            setButtons(next);
            return;
          }
          setButtons(buttonsByInstitution[requestedFor] ?? []);
        })
        .catch(() => {
          if (cancelled || requestedFor !== institutionRef.current) return;
          setButtons(buttonsByInstitution[requestedFor] ?? []);
        });

      return () => {
        cancelled = true;
      };
    }, [profile?.userId, institution, profile?.program, profile?.yearOfStudy, profile?.language])
  );

  return (
    <ThemedView className="flex-1 flex-row justify-center">
      <SafeAreaView className="flex-1 px-four max-w-content self-stretch w-full pb-bottom-tab-gap">
        <ThemedView className="flex-row items-center flex-wrap gap-two bg-transparent pt-six pb-four">
          <ThemedText type="subtitle">{t('hiThere')}</ThemedText>
          <Text style={{ fontSize: 32, lineHeight: 44 }}>👋</Text>
        </ThemedView>
        <ThemedText themeColor="textSecondary" className="mb-four">
          {t('homeSubtitle')}
        </ThemedText>

        <ThemedText type="small" themeColor="textSecondary" className="uppercase mb-two">
          {t('services')}
        </ThemedText>
        <ThemedView className="gap-two bg-transparent">
          {buttons.length === 0 ? (
            <ThemedText themeColor="textSecondary">{t('noServices')}</ThemedText>
          ) : (
            buttons.map((button) => (
              <ServiceLink
                key={button.id}
                title={button.title}
                subtitle={button.description}
                icon={buttonIcon(button)}
                href={button.url}
              />
            ))
          )}
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}
