import { ScrollView } from 'react-native';

import { ThemedView } from '@/components/themed-view';

export function LegalDocument({ children }) {
  return (
    <ThemedView className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-four py-four gap-three pb-bottom-tab-gap max-w-content self-center w-full"
        alwaysBounceVertical>
        {children}
      </ScrollView>
    </ThemedView>
  );
}