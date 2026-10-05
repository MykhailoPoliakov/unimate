import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFeed } from '@/hooks/use-feed';
import { useI18n } from '@/hooks/use-i18n';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { t } = useI18n();
  const { unreadNewsCount } = useFeed();

  return (
    <NativeTabs
      backgroundColor={colors.background}
      blurEffect={scheme === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterial'}
      disableTransparentOnScrollEdge
      minimizeBehavior="never"
      tintColor={colors.primary}
      badgeBackgroundColor={colors.error}
      badgeTextColor="#FFFFFF"
      iconColor={{ default: colors.textSecondary, selected: colors.primary }}
      labelStyle={{ color: colors.textSecondary, selected: { color: colors.primary } }}>
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

      <NativeTabs.Trigger name="news">
        <NativeTabs.Trigger.Label>{t('news')}</NativeTabs.Trigger.Label>
        {unreadNewsCount > 0 ? (
          <NativeTabs.Trigger.Badge>
            {unreadNewsCount > 99 ? '99+' : String(unreadNewsCount)}
          </NativeTabs.Trigger.Badge>
        ) : null}
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
