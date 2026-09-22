import { ScrollView } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useI18n } from '@/hooks/use-i18n';

export default function TermsScreen() {
  const { t } = useI18n();

  return (
    <ThemedView className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-four py-four gap-three pb-bottom-tab-gap max-w-content self-center w-full">
        <ThemedText type="small" themeColor="textSecondary">
          {t('privacyUpdated')}
        </ThemedText>
        <ThemedText>{t('terms1')}</ThemedText>
        <ThemedText>{t('terms2')}</ThemedText>
        <ThemedText>{t('terms3')}</ThemedText>
      </ScrollView>
    </ThemedView>
  );
}
