import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

export function Collapsible({ children, title }) {
  const [isOpen, setIsOpen] = useState(false);
  const theme = useTheme();

  return (
    <ThemedView>
      <Pressable
        className="flex-row items-center gap-two active:opacity-70"
        onPress={() => setIsOpen((value) => !value)}>
        <ThemedView
          type="backgroundElement"
          className="w-four h-four rounded-xl justify-center items-center">
          <SymbolView
            name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
            size={14}
            weight="bold"
            tintColor={theme.text}
            style={{ transform: [{ rotate: isOpen ? '-90deg' : '90deg' }] }}
          />
        </ThemedView>

        <ThemedText type="small">{title}</ThemedText>
      </Pressable>
      {isOpen && (
        <Animated.View entering={FadeIn.duration(200)}>
          <ThemedView
            type="backgroundElement"
            className="mt-three rounded-three ml-four p-four">
            {children}
          </ThemedView>
        </Animated.View>
      )}
    </ThemedView>
  );
}
