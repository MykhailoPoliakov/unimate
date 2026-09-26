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
      backgroundColor={colors.backgroundElement}
      indicatorColor={colors.backgroundSelected}
      badgeBackgroundColor={colors.error}
      badgeTextColor="#FFFFFF"
      iconColor={{ default: colors.textSecondary, selected: colors.primary }}
      labelStyle={{ color: colors.textSecondary, selected: { color: colors.primary } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('home')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="home" />}
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
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="newspaper" />}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="socials">
        <NativeTabs.Trigger.Label>{t('socials')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="people" />}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>{t('settings')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="settings" />}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
