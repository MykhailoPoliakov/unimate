import { View } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

export function HintRow({ title = 'Try editing', hint = 'app/index.js' }) {
  return (
    <View className="flex-row justify-between">
      <ThemedText type="small">{title}</ThemedText>
      <ThemedView type="backgroundSelected" className="rounded-two py-half px-two">
        <ThemedText themeColor="textSecondary">{hint}</ThemedText>
      </ThemedView>
    </View>
  );
}
