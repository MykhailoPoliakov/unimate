import Constants from 'expo-constants';

import { LegalDocument } from '@/components/legal-document';
import { ThemedText } from '@/components/themed-text';
import { useI18n } from '@/hooks/use-i18n';

export default function AboutScreen() {
  const { t } = useI18n();

  return (
    <LegalDocument>
      <ThemedText type="subtitle" themeColor="primary">
        UniMate
      </ThemedText>
      <ThemedText themeColor="textSecondary">
        {t('version')} {Constants.expoConfig?.version ?? '1.0.0'}
      </ThemedText>
      <ThemedText>{t('aboutBody')}</ThemedText>
    </LegalDocument>
  );
}
