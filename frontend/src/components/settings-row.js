import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { Children, Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { GlassCard } from '@/components/glass-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

export function SettingsRow({ icon, label, value, href, onPress, destructive, right }) {
  const theme = useTheme();
  const color = destructive ? theme.error : theme.text;
  const iconColor = destructive ? theme.error : theme.primary;

  const content = (
    <ThemedView className="flex-row items-center gap-three px-three py-three bg-transparent">
      {icon ? (
        <ThemedView
          type="backgroundSelected"
          className="w-[36px] h-[36px] rounded-two items-center justify-center">
          <Ionicons name={icon} size={18} color={iconColor} />
        </ThemedView>
      ) : null}
      <ThemedText className="flex-1" style={{ color }}>
        {label}
      </ThemedText>
      {value ? (
        <ThemedText type="small" themeColor="textSecondary">
          {value}
        </ThemedText>
      ) : null}
      {right}
      {!right && (href || onPress) ? (
        <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
      ) : null}
    </ThemedView>
  );

  if (href) {
    return (
      <Link href={href} asChild>
        <Pressable className="active:opacity-70">{content}</Pressable>
      </Link>
    );
  }

  if (onPress) {
    return (
      <Pressable onPress={onPress} className="active:opacity-70">
        {content}
      </Pressable>
    );
  }

  return content;
}

export function SettingsGroup({ title, children }) {
  const theme = useTheme();
  const items = Children.toArray(children);

  return (
    <ThemedView className="gap-two bg-transparent">
      {title ? (
        <ThemedText type="small" themeColor="textSecondary" className="uppercase px-one">
          {title}
        </ThemedText>
      ) : null}
      <GlassCard>
        {items.map((child, index) => (
          <Fragment key={index}>
            {index > 0 ? (
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: theme.border,
                  marginLeft: 60,
                }}
              />
            ) : null}
            {child}
          </Fragment>
        ))}
      </GlassCard>
    </ThemedView>
  );
}
