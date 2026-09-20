import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function SocialsScreen() {
  return (
    <ThemedView className="flex-1 flex-row justify-center">
      <SafeAreaView className="flex-1 px-four items-center justify-center gap-three pb-bottom-tab-gap max-w-content">
        <ThemedText type="title">Socials</ThemedText>
        <ThemedText themeColor="textSecondary" className="text-center">
          Connect with your community here.
        </ThemedText>
      </SafeAreaView>
    </ThemedView>
  );
}
