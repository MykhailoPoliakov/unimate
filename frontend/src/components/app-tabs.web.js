import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, TabList, TabTrigger, TabSlot } from 'expo-router/ui';
import { Pressable, View } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useI18n } from '@/hooks/use-i18n';

export default function AppTabs() {
  const { t } = useI18n();

  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton icon="home">{t('home')}</TabButton>
          </TabTrigger>
          <TabTrigger name="news" href="/news" asChild>
            <TabButton icon="newspaper">{t('news')}</TabButton>
          </TabTrigger>
          <TabTrigger name="socials" href="/socials" asChild>
            <TabButton icon="people">{t('socials')}</TabButton>
          </TabTrigger>
          <TabTrigger name="settings" href="/settings" asChild>
            <TabButton icon="settings">{t('settings')}</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, icon, isFocused, ...props }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <Pressable {...props} className="active:opacity-70">
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        className="py-one px-three rounded-three flex-row items-center gap-one">
        {icon && (
          <Ionicons
            name={icon}
            size={14}
            color={isFocused ? colors.primary : colors.textSecondary}
          />
        )}
        <ThemedText type="small" themeColor={isFocused ? 'primary' : 'textSecondary'}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props) {
  return (
    <View {...props} className="absolute w-full p-three justify-center items-center flex-row">
      <ThemedView
        type="backgroundElement"
        className="py-two px-five rounded-five flex-row items-center grow gap-two max-w-content">
        <ThemedText type="smallBold" themeColor="primary" className="mr-auto">
          UniMate
        </ThemedText>

        {props.children}
      </ThemedView>
    </View>
  );
}
