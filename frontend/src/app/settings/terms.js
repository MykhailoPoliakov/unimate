import { useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';

import { useReload } from '@/components/reload-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';

export default function TermsScreen() {
  const { t } = useI18n();
  const theme = useTheme();
  const [tick, setTick] = useState(0);
  const { refreshing, reload } = useReload(async () => {
    setTick((value) => value + 1);
  });

  return (
    <ThemedView className="flex-1">
      <ScrollView
        key={tick}
        className="flex-1"
        contentContainerClassName="px-four py-four gap-three pb-bottom-tab-gap max-w-content self-center w-full"
        alwaysBounceVertical
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={reload}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }>
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
