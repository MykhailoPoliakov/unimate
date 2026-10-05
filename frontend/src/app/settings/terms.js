import termsOfUse from 'unimate-docs/terms-of-use.json';

import { LegalDocument } from '@/components/legal-document';

export default function TermsScreen() {
  return <LegalDocument document={termsOfUse} />;
}
