import privacyPolicy from 'unimate-docs/privacy-policy.json';

import { LegalDocument } from '@/components/legal-document';

export default function PrivacyScreen() {
  return <LegalDocument document={privacyPolicy} />;
}
