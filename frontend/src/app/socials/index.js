import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { openExternalUrl } from '@/components/external-link';
import { GlassCard } from '@/components/glass-card';
import { useReload } from '@/components/reload-button';
import { SocialBrandIcon } from '@/components/social-brand-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useI18n } from '@/hooks/use-i18n';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { cooldownMessage, deleteSocial, listManageSocials, listSocials } from '@/lib/api';
import { setSocialDraft } from '@/lib/nav-draft';
import { brandColor, iconOnBrand, socialIcon } from '@/lib/social-service';

function flattenAdminSocial(item, language) {
  const translation =
    item.translations?.find((row) => row.lang === language) ?? item.translations?.[0] ?? {};
  return {
    id: item.id,
    url: item.url,
    icon: item.icon,
    platform: item.platform,
    title: translation.title ?? item.title ?? '',
    description: translation.description ?? item.description ?? '',
    institution: item.institution ?? null,
    programs: item.programs ?? (item.program ? [item.program] : []),
    years: item.years ?? yearsFromRange(item.year_min, item.year_max),
  };
}

function yearsFromRange(min, max) {
  if (!min && !max) return [];
  const start = min ?? max;
  const end = max ?? min;
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function SocialRow({ item, isAdmin, onEdit, onDelete }) {
  const theme = useTheme();
  const { t } = useI18n();
  const suppressRedirect = useRef(false);
  const suppressRedirectTimer = useRef(null);
  const icon = socialIcon(item);
  const accent = brandColor(item);
  const glyph = accent ? iconOnBrand(accent) : theme.primary;

  const copyLink = async () => {
    try {
      const copied = await Clipboard.setStringAsync(item.url);
      if (!copied) throw new Error('Clipboard write failed');
      Alert.alert(t('copied'), t('linkCopied'));
    } catch {
      Alert.alert(t('couldNotSave'), t('tryAgain'));
    }
  };

  const handleLongPress = () => {
    suppressRedirect.current = true;
    clearTimeout(suppressRedirectTimer.current);
    suppressRedirectTimer.current = setTimeout(() => {
      suppressRedirect.current = false;
    }, 1000);
    void copyLink();
  };

  const handleOpen = () => {
    if (suppressRedirect.current) {
      suppressRedirect.current = false;
      clearTimeout(suppressRedirectTimer.current);
      return;
    }
    void openExternalUrl(item.url, theme, { preferNativeApp: true });
  };

  const handleCopyPress = () => {
    suppressRedirect.current = false;
    clearTimeout(suppressRedirectTimer.current);
    void copyLink();
  };

  return (
    <GlassCard>
      <ThemedView className="flex-row items-center bg-transparent">
        <Pressable
          onPress={handleOpen}
          onLongPress={handleLongPress}
          delayLongPress={450}
          className="flex-1 active:opacity-70">
          <ThemedView className="flex-row items-center gap-three px-three py-three bg-transparent">
            <SocialBrandIcon
              name={icon}
              size={32}
              well={44}
              color={glyph}
              backgroundColor={accent ?? theme.backgroundSelected}
            />
            <ThemedView className="flex-1 bg-transparent">
              <ThemedText type="smallBold">{item.title}</ThemedText>
              {item.description ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {item.description}
                </ThemedText>
              ) : null}
            </ThemedView>
            <Ionicons name="open-outline" size={18} color={theme.textSecondary} />
          </ThemedView>
        </Pressable>
        <Pressable
          onPress={handleCopyPress}
          accessibilityRole="button"
          accessibilityLabel={t('copyLink')}
          accessibilityHint={t('copyLinkHint')}
          className="w-[44px] h-[44px] items-center justify-center active:opacity-70">
          <Ionicons name="copy-outline" size={19} color={theme.textSecondary} />
        </Pressable>
      </ThemedView>
      {isAdmin ? (
        <ThemedView className="flex-row gap-three px-three pb-three bg-transparent">
          <Pressable onPress={() => onEdit(item)} className="active:opacity-70">
            <ThemedText type="small" themeColor="primary">
              {t('edit')}
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => onDelete(item)} className="active:opacity-70">
            <ThemedText type="small" style={{ color: theme.error }}>
              {t('delete')}
            </ThemedText>
          </Pressable>
        </ThemedView>
      ) : null}
    </GlassCard>
  );
}

export default function SocialsScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const [items, setItems] = useState([]);
  const canManageSocials = ['admin', 'moderator'].includes(profile?.role);

  const refresh = useCallback(async () => {
    if (!profile?.userId) {
      setItems([]);
      return;
    }
    const language = profile.language ?? 'en';
    const visible = await listSocials(profile.userId);
    if (!['admin', 'moderator'].includes(profile.role)) {
      setItems(visible);
      return;
    }
    const managed = await listManageSocials(profile.userId);
    const managedById = new Map(managed.map((row) => [row.id, flattenAdminSocial(row, language)]));
    setItems(
      visible.map((item) => {
        const adminItem = managedById.get(item.id);
        return adminItem ? { ...item, ...adminItem, canManage: true } : item;
      })
    );
  }, [profile?.userId, profile?.institution, profile?.program, profile?.yearOfStudy, profile?.language, profile?.role]);

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => setItems([]));
    }, [refresh])
  );

  const { refreshing: isRefreshing, reload: handleRefresh } = useReload(async () => {
    try {
      await refresh();
    } catch {
      // Keep the current list if the API is unreachable.
    }
  });

  const handleDelete = (item) => {
    Alert.alert(t('deleteSocial'), t('deleteSocialMessage'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSocial(profile.userId, item.id);
            await refresh();
          } catch (error) {
            Alert.alert(t('couldNotSave'), cooldownMessage(error, t, error.message ?? t('tryAgain')));
          }
        },
      },
    ]);
  };

  const openComposer = (item) => {
    setSocialDraft(item?.id ? item : null);
    router.push('/socials/compose');
  };

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={[]}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-four pb-bottom-tab-gap gap-two max-w-content self-center w-full"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }>
          <ThemedView
            className="flex-row items-center justify-between bg-transparent pb-four"
            style={{ paddingTop: (insets.top || 59) + 8 }}>
            <ThemedText type="subtitle">{t('socials')}</ThemedText>
            {canManageSocials ? (
              <Pressable onPress={() => openComposer(null)} className="active:opacity-70">
                <ThemedView
                  type="backgroundSelected"
                  className="w-[40px] h-[40px] rounded-five items-center justify-center">
                  <Ionicons name="add" size={22} color={theme.primary} />
                </ThemedView>
              </Pressable>
            ) : null}
          </ThemedView>
          <ThemedText themeColor="textSecondary">{t('socialsSubtitle')}</ThemedText>
          {items.length === 0 ? (
            <ThemedView className="items-center py-six bg-transparent">
              <ThemedText themeColor="textSecondary" className="text-center">
                {t('noSocials')}
                {canManageSocials ? t('tapToAddSocial') : ''}
              </ThemedText>
            </ThemedView>
          ) : (
            items.map((item) => (
              <SocialRow
                key={item.id}
                item={item}
                isAdmin={canManageSocials}
                onEdit={openComposer}
                onDelete={handleDelete}
              />
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
