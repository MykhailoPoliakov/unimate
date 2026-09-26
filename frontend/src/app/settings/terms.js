import { LegalDocument } from '@/components/legal-document';
import { ThemedText } from '@/components/themed-text';
import { useI18n } from '@/hooks/use-i18n';

export default function TermsScreen() {
  const { t } = useI18n();

  return (
    <LegalDocument>
      <ThemedText>{t('terms1')}</ThemedText>
      <ThemedText>{t('terms2')}</ThemedText>
      <ThemedText>{t('terms3')}</ThemedText>
    </LegalDocument>
  );
}
