import { LegalDocument } from '@/components/legal-document';
import { ThemedText } from '@/components/themed-text';
import { useI18n } from '@/hooks/use-i18n';

export default function PrivacyScreen() {
  const { t } = useI18n();

  return (
    <LegalDocument>
      <ThemedText type="small" themeColor="textSecondary">
        {t('privacyUpdated')}
      </ThemedText>
      <ThemedText>{t('privacy1')}</ThemedText>
      <ThemedText>{t('privacy2')}</ThemedText>
      <ThemedText>{t('privacy3')}</ThemedText>
      <ThemedText>{t('privacy4')}</ThemedText>
    </LegalDocument>
  );
}
