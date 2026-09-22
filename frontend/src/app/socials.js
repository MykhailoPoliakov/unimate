import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useI18n } from '@/hooks/use-i18n';

export default function SocialsScreen() {
  const { t } = useI18n();

  return (
    <ThemedView className="flex-1 flex-row justify-center">
      <SafeAreaView className="flex-1 px-four items-center justify-center gap-three pb-bottom-tab-gap max-w-content">
        <ThemedText type="title">{t('socials')}</ThemedText>
        <ThemedText themeColor="textSecondary" className="text-center">
          {t('socialsSubtitle')}
        </ThemedText>
      </SafeAreaView>
    </ThemedView>
  );
}
