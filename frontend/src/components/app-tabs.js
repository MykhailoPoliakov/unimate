import Ionicons from '@expo/vector-icons/Ionicons';
import { useSegments } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useEffect, useState } from 'react';
import { DynamicColorIOS, InteractionManager, Platform } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFeed } from '@/hooks/use-feed';
import { useI18n } from '@/hooks/use-i18n';

const systemTabBar = Platform.OS === 'ios' && parseInt(Platform.Version, 10) >= 26;
const labelColor = Platform.OS === 'ios'
  ? DynamicColorIOS({ light: Colors.light.textSecondary, dark: Colors.dark.textSecondary })
  : null;
const selectedColor = Platform.OS === 'ios'
  ? DynamicColorIOS({ light: Colors.light.primary, dark: Colors.dark.primary })
  : null;

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { t } = useI18n();
  const { unreadNewsCount } = useFeed();
  const segments = useSegments();
  const newsDepth = segments[0] === 'news' ? segments.length : 0;
  const [newsBadge, setNewsBadge] = useState(unreadNewsCount);
  const idleLabelColor = labelColor ?? colors.textSecondary;
  const idleSelectedColor = selectedColor ?? colors.primary;

  useEffect(() => {
    // Coming back from an article drops the unread badge. Updating the tab
    // item during that pop rebuilds the selected liquid-glass capsule.
    if (newsDepth > 1) return undefined;

    let cancelled = false;
    const apply = () => {
      if (!cancelled) setNewsBadge(unreadNewsCount);
    };

    if (newsDepth === 1) {
      const task = InteractionManager.runAfterInteractions(apply);
      return () => {
        cancelled = true;
        task.cancel();
      };
    }

    apply();
    return () => {
      cancelled = true;
    };
  }, [newsDepth, unreadNewsCount]);

  return (
    <NativeTabs
      {...(systemTabBar
        ? {}
        : {
            backgroundColor: colors.background,
            blurEffect: scheme === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterial',
          })}
      disableTransparentOnScrollEdge
      minimizeBehavior="never"
      tintColor={idleSelectedColor}
      badgeBackgroundColor={colors.error}
      badgeTextColor="#FFFFFF"
      iconColor={{ default: idleLabelColor, selected: idleSelectedColor }}
      labelStyle={{ color: idleLabelColor, selected: { color: idleSelectedColor } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('home')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'house', selected: 'house.fill' }}
          src={{
            default: <NativeTabs.Trigger.VectorIcon family={Ionicons} name="home-outline" />,
            selected: <NativeTabs.Trigger.VectorIcon family={Ionicons} name="home" />,
          }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="news" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Label>{t('news')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Badge hidden={newsBadge <= 0}>
          {newsBadge > 0 ? (newsBadge > 99 ? '99+' : String(newsBadge)) : undefined}
        </NativeTabs.Trigger.Badge>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'newspaper', selected: 'newspaper.fill' }}
          src={{
            default: <NativeTabs.Trigger.VectorIcon family={Ionicons} name="newspaper-outline" />,
            selected: <NativeTabs.Trigger.VectorIcon family={Ionicons} name="newspaper" />,
          }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="socials">
        <NativeTabs.Trigger.Label>{t('socials')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.2', selected: 'person.2.fill' }}
          src={{
            default: <NativeTabs.Trigger.VectorIcon family={Ionicons} name="people-outline" />,
            selected: <NativeTabs.Trigger.VectorIcon family={Ionicons} name="people" />,
          }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>{t('menu')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'ellipsis.circle', selected: 'ellipsis.circle.fill' }}
          src={{
            default: (
              <NativeTabs.Trigger.VectorIcon family={Ionicons} name="ellipsis-horizontal-circle-outline" />
            ),
            selected: (
              <NativeTabs.Trigger.VectorIcon family={Ionicons} name="ellipsis-horizontal-circle" />
            ),
          }}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
