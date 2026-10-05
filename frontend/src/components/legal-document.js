import { Fragment } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export function LegalDocument({ children, document }) {
  const insets = useSafeAreaInsets();

  return (
    <ThemedView className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-four gap-three pb-bottom-tab-gap max-w-content self-center w-full"
        contentContainerStyle={{ paddingTop: (insets.top || 59) + 52, paddingBottom: 40 }}
        alwaysBounceVertical>
        {children}
        {document ? <LegalSections document={document} /> : null}
      </ScrollView>
    </ThemedView>
  );
}

export function LegalSections({ document }) {
  return (
    <>
      {document.updated ? (
        <ThemedText type="small" themeColor="textSecondary">
          {document.updated}
        </ThemedText>
      ) : null}
      {(document.intro ?? []).map((paragraph) => (
        <ThemedText key={paragraph}>{paragraph}</ThemedText>
      ))}
      {(document.sections ?? []).map((section) => (
        <Fragment key={section.title}>
          <ThemedText type="smallBold">{section.title}</ThemedText>
          {(section.items ?? []).map((item) => (
            <ThemedText key={item}>• {item}</ThemedText>
          ))}
          {(section.paragraphs ?? []).map((paragraph) => (
            <ThemedText key={paragraph}>{paragraph}</ThemedText>
          ))}
        </Fragment>
      ))}
    </>
  );
}
