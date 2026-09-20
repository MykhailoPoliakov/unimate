import { TextInput, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

export function FormField({ label, style, ...inputProps }) {
  const theme = useTheme();

  return (
    <ThemedView className="gap-one bg-transparent self-stretch">
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <TextInput
        className="rounded-three px-three py-three text-base font-medium"
        placeholderTextColor={theme.textSecondary}
        style={[
          {
            backgroundColor: theme.backgroundElement,
            color: theme.text,
            borderColor: theme.border,
            borderWidth: StyleSheet.hairlineWidth,
          },
          style,
        ]}
        {...inputProps}
      />
    </ThemedView>
  );
}
