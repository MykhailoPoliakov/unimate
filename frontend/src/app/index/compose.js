import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native';

import { DEFAULT_LINK_COLOR, LINK_COLORS, linksStorageKey } from '@/components/button-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useI18n } from '@/hooks/use-i18n';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { previewButton } from '@/lib/api';
import { getLinkDraft } from '@/lib/nav-draft';
import { isValidHttpUrl, normalizeUrl } from '@/lib/social-service';

export default function LinkComposeScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const { profile } = useProfile();
  const item = getLinkDraft();
  const [url, setUrl] = useState(item?.url ?? '');
  const [title, setTitle] = useState(item?.title ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [icon, setIcon] = useState(item?.icon ?? null);
  const [color, setColor] = useState(item?.color ?? DEFAULT_LINK_COLOR);
  const isEdit = !!item?.id;
  const urlLooksValid = isValidHttpUrl(url);
  const normalized = urlLooksValid ? normalizeUrl(url) : '';
  const canSave = urlLooksValid && title.trim().length > 0;
  const showUrlError = url.trim().length > 0 && !urlLooksValid;

  useEffect(() => {
    if (!urlLooksValid || !profile?.userId) return undefined;
    const timer = setTimeout(() => {
      previewButton(profile.userId, normalized)
        .then((preview) => {
          if (preview?.title) setTitle((current) => current.trim() || preview.title);
          if (preview?.icon) setIcon(preview.icon);
        })
        .catch(() => {});
    }, 700);
    return () => clearTimeout(timer);
  }, [normalized, profile?.userId]);

  const handleSave = async () => {
    if (!canSave || !profile?.userId) return;
    const link = {
      id: item?.id ?? `local-${Date.now()}`,
      url: normalized,
      icon,
      color,
      platform: 'custom',
      title: title.trim(),
      description: description.trim() || null,
      canManage: true,
    };
    const stored = JSON.parse((await AsyncStorage.getItem(linksStorageKey(profile.userId))) ?? '[]');
    const exists = stored.some((row) => row.id === link.id);
    const next = exists ? stored.map((row) => (row.id === link.id ? link : row)) : [...stored, link];
    await AsyncStorage.setItem(linksStorageKey(profile.userId), JSON.stringify(next));
    router.back();
  };

  return (
    <ThemedView className="flex-1">
      <Stack.Screen
        options={{
          title: isEdit ? t('editService') : t('addService'),
          headerRight: () => (
            <Pressable
              onPress={handleSave}
              disabled={!canSave}
              className="active:opacity-70"
              hitSlop={8}
              style={{ paddingHorizontal: 10 }}>
              <ThemedText
                themeColor={canSave ? 'primary' : 'textSecondary'}
                numberOfLines={1}
                style={{ fontSize: 17, fontWeight: '600' }}>
                {t('save')}
              </ThemedText>
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-four py-three gap-three pb-bottom-tab-gap"
          keyboardShouldPersistTaps="handled">
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="https://"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            className="rounded-three px-three py-three text-base font-medium"
            style={{ backgroundColor: theme.backgroundElement, color: theme.text }}
          />
          {showUrlError ? (
            <ThemedText type="small" style={{ color: theme.error }}>
              {t('enterALink')}
            </ThemedText>
          ) : null}
          <ThemedView className="flex-row items-center gap-three bg-transparent">
            {icon?.startsWith?.('http') ? (
              <Image source={{ uri: icon }} style={{ width: 40, height: 40, borderRadius: 8 }} />
            ) : (
              <ThemedView className="w-[40px] h-[40px] rounded-two" style={{ backgroundColor: color }} />
            )}
            <ThemedText type="small" themeColor="textSecondary">
              {t('iconFromSite')}
            </ThemedText>
          </ThemedView>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('title')}
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
            {t('buttonColor')}
          </ThemedText>
          <ThemedView className="flex-row flex-wrap gap-two bg-transparent">
            {LINK_COLORS.map((value) => {
              const selected = color === value;
              return (
                <Pressable key={value} onPress={() => setColor(value)}>
                  <ThemedView
                    className="w-[36px] h-[36px] rounded-two"
                    style={{
                      backgroundColor: value,
                      borderWidth: selected ? 3 : 1,
                      borderColor: selected ? theme.primary : theme.border,
                    }}
                  />
                </Pressable>
              );
            })}
          </ThemedView>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}
