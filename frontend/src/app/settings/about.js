import Constants from 'expo-constants';

import about from 'unimate-docs/about.json';

import { LegalDocument } from '@/components/legal-document';
import { ThemedText } from '@/components/themed-text';

export default function AboutScreen() {
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <LegalDocument
      document={{
        ...about,
        updated: `Version ${version}`,
      }}>
      <ThemedText type="subtitle" themeColor="primary">
        {about.name}
      </ThemedText>
    </LegalDocument>
  );
}
