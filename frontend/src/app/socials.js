import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useI18n } from '@/hooks/use-i18n';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { createSocial, deleteSocial, listSocials, updateSocial } from '@/lib/api';
import { detectService, MANUAL_ICONS, normalizeUrl, resolveIconName, socialIcon } from '@/lib/social-service';

function SocialRow({ item, isAdmin, onEdit, onDelete }) {
  const theme = useTheme();
  const { t } = useI18n();
  const icon = socialIcon(item);

  return (
    <ThemedView type="backgroundElement" className="rounded-three overflow-hidden">
      <ExternalLink href={item.url} asChild>
        <Pressable className="active:opacity-70">
          <ThemedView className="flex-row items-center gap-three px-three py-three bg-transparent">
            <ThemedView
              type="backgroundSelected"
              className="w-[44px] h-[44px] rounded-two items-center justify-center">
              <Ionicons name={icon} size={22} color={theme.primary} />
            </ThemedView>
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
      </ExternalLink>
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
    </ThemedView>
  );
}

function SocialModal({ item, onClose, onSaved }) {
  const theme = useTheme();
  const { t } = useI18n();
  const { profile } = useProfile();
  const [url, setUrl] = useState(item?.url ?? '');
  const [title, setTitle] = useState(item?.title ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [icon, setIcon] = useState(item?.icon ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const isEdit = !!item;

  const detected = useMemo(() => detectService(url), [url]);
  const hasLink = Boolean(url.trim());
  const resolvedIcon = hasLink
    ? resolveIconName(icon || detected?.icon || 'globe-outline')
    : 'globe-outline';
  const canSave = normalizeUrl(url).length > 8 && title.trim().length > 0 && !isSaving;

  useEffect(() => {
    if (!hasLink) {
      setIcon(null);
      return;
    }
    if (item || !detected) return;
    setTitle((current) => current.trim() || detected.label);
    if (!icon) setIcon(detected.icon);
  }, [detected, hasLink, icon, item]);

  const handleSave = async () => {
    if (!canSave || !profile?.userId) return;
    setIsSaving(true);
    try {
      const payload = {
        url: normalizeUrl(url),
        icon: resolvedIcon,
        platform: detected?.id ?? 'website',
        is_active: true,
        translations: [
          {
            lang: profile.language ?? 'en',
            title: title.trim(),
            description: description.trim() || null,
          },
        ],
      };
      if (isEdit) await updateSocial(profile.userId, item.id, payload);
      else await createSocial(profile.userId, payload);
      onSaved();
      onClose();
    } catch (error) {
      Alert.alert(t('couldNotSave'), error.message ?? t('tryAgain'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ThemedView className="flex-1">
        <SafeAreaView className="flex-1">
          <KeyboardAvoidingView
            className="flex-1"
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ThemedView className="flex-row items-center justify-between px-four py-three bg-transparent">
              <Pressable onPress={onClose} className="active:opacity-70">
                <ThemedText themeColor="primary">{t('cancel')}</ThemedText>
              </Pressable>
              <ThemedText type="smallBold">{isEdit ? t('editSocial') : t('addSocial')}</ThemedText>
              <Pressable onPress={handleSave} disabled={!canSave} className="active:opacity-70">
                <ThemedText themeColor={canSave ? 'primary' : 'textSecondary'} type="smallBold">
                  {isSaving ? '…' : isEdit ? t('save') : t('publish')}
                </ThemedText>
              </Pressable>
            </ThemedView>

            <ScrollView
              className="flex-1"
              contentContainerClassName="px-four py-three gap-three"
              keyboardShouldPersistTaps="handled">
              <TextInput
                value={url}
                onChangeText={(value) => {
                  setUrl(value);
                  if (!value.trim()) setIcon(null);
                }}
                placeholder="https://"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                className="rounded-three px-three py-three text-base font-medium"
                style={{ backgroundColor: theme.backgroundElement, color: theme.text }}
              />
              <ThemedView className="flex-row items-center gap-two bg-transparent">
                <ThemedView
                  type="backgroundSelected"
                  className="w-[36px] h-[36px] rounded-two items-center justify-center">
                  <Ionicons name={resolvedIcon} size={20} color={theme.primary} />
                </ThemedView>
                <ThemedText type="small" themeColor="textSecondary">
                  {detected ? t('detectedService', { name: detected.label }) : t('unknownService')}
                </ThemedText>
              </ThemedView>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={t('socialTitle')}
                placeholderTextColor={theme.textSecondary}
                className="rounded-three px-three py-three text-base font-medium"
                style={{ backgroundColor: theme.backgroundElement, color: theme.text }}
              />
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder={t('socialDescription')}
                placeholderTextColor={theme.textSecondary}
                className="rounded-three px-three py-three text-base font-medium"
                style={{ backgroundColor: theme.backgroundElement, color: theme.text }}
              />
              <ThemedText type="small" themeColor="textSecondary">
                {t('chooseIcon')}
              </ThemedText>
              <ThemedView className="flex-row flex-wrap gap-two bg-transparent">
                {MANUAL_ICONS.map((option) => {
                  const selected = resolvedIcon === option.icon;
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => {
                        setIcon(option.icon);
                      }}>
                      <ThemedView
                        type={selected ? 'backgroundSelected' : 'backgroundElement'}
                        className="w-[44px] h-[44px] rounded-two items-center justify-center"
                        style={{ borderWidth: 1, borderColor: selected ? theme.primary : theme.border }}>
                        <Ionicons name={option.icon} size={20} color={selected ? theme.primary : theme.text} />
                      </ThemedView>
                    </Pressable>
                  );
                })}
              </ThemedView>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

export default function SocialsScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const { profile } = useProfile();
  const [items, setItems] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [composer, setComposer] = useState(null);
  const isAdmin = profile?.role === 'admin';

  const refresh = useCallback(async () => {
    if (!profile?.userId) {
      setItems([]);
      return;
    }
    const next = await listSocials(profile.userId);
    setItems(next);
  }, [profile?.userId, profile?.institution, profile?.program, profile?.yearOfStudy, profile?.language]);

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => setItems([]));
    }, [refresh])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
    } catch {
      // Keep the current list if the API is unreachable.
    } finally {
      setIsRefreshing(false);
    }
  };

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
            Alert.alert(t('couldNotSave'), error.message ?? t('tryAgain'));
          }
        },
      },
    ]);
  };

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top']}>
        <ThemedView className="flex-row items-center justify-between px-four pt-three pb-two bg-transparent">
          <ThemedText type="subtitle">{t('socials')}</ThemedText>
          {isAdmin ? (
            <Pressable onPress={() => setComposer({})} className="active:opacity-70">
              <ThemedView
                type="backgroundSelected"
                className="w-[40px] h-[40px] rounded-five items-center justify-center">
                <Ionicons name="add" size={22} color={theme.primary} />
              </ThemedView>
            </Pressable>
          ) : null}
        </ThemedView>

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
          <ThemedText themeColor="textSecondary">{t('socialsSubtitle')}</ThemedText>
          {items.length === 0 ? (
            <ThemedView className="items-center py-six bg-transparent">
              <ThemedText themeColor="textSecondary" className="text-center">
                {t('noSocials')}
                {isAdmin ? t('tapToAddSocial') : ''}
              </ThemedText>
            </ThemedView>
          ) : (
            items.map((item) => (
              <SocialRow
                key={item.id}
                item={item}
                isAdmin={isAdmin}
                onEdit={setComposer}
                onDelete={handleDelete}
              />
            ))
          )}
        </ScrollView>
      </SafeAreaView>
      {composer ? (
        <SocialModal
          key={composer.id ?? 'new'}
          item={composer.id ? composer : null}
          onClose={() => setComposer(null)}
          onSaved={refresh}
        />
      ) : null}
    </ThemedView>
  );
}
