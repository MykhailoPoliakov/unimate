import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef } from 'react';
import { Alert, Pressable, ScrollView } from 'react-native';
import Animated from 'react-native-reanimated';

import { checkIn } from '@/components/motion';
import { SettingsGroup } from '@/components/settings-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useI18n } from '@/hooks/use-i18n';
import { mapRemoteUser, useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { updateUser } from '@/lib/api';

export default function LanguagesScreen() {
  const theme = useTheme();
  const { t, language, languages, setLanguage } = useI18n();
  const { profile, saveProfile } = useProfile();
  const languageTimer = useRef(null);

  useEffect(
    () => () => {
      if (languageTimer.current) clearTimeout(languageTimer.current);
    },
    []
  );

  const handleLanguage = (next) => {
    if (!profile?.userId || next === language) return;
    setLanguage(next);
    if (languageTimer.current) clearTimeout(languageTimer.current);
    languageTimer.current = setTimeout(async () => {
      try {
        const remote = await updateUser(profile.userId, { language: next });
        await saveProfile({
          ...mapRemoteUser(remote, profile.deviceId),
          institutionName: profile.institutionName,
          programName: profile.programName,
        });
        setLanguage(null);
      } catch (error) {
        setLanguage(null);
        Alert.alert(t('couldNotSave'), error.message ?? t('tryAgain'));
      }
    }, 600);
  };

  return (
    <ThemedView className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-four py-four pb-bottom-tab-gap max-w-content self-center w-full"
        alwaysBounceVertical>
        <SettingsGroup>
          {languages.map((item) => {
            const selected = language === item.id;
            return (
              <Pressable key={item.id} onPress={() => handleLanguage(item.id)} className="active:opacity-70">
                <ThemedView className="flex-row items-center gap-three px-three py-three bg-transparent">
                  <ThemedText className="flex-1">{item.nativeName}</ThemedText>
                  {selected ? (
                    <Animated.View entering={checkIn}>
                      <Ionicons name="checkmark" size={20} color={theme.primary} />
                    </Animated.View>
                  ) : null}
                </ThemedView>
              </Pressable>
            );
          })}
        </SettingsGroup>
      </ScrollView>
    </ThemedView>
  );
}
