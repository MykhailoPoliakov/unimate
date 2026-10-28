import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { previewButton } from '@/lib/api';
import { discordInviteUrl, resolveIconName } from '@/lib/social-service';

async function discordServerIcon(url) {
  const invite = discordInviteUrl(url);
  const code = invite?.split('/').pop();
  if (!code) return null;
  const response = await fetch(`https://discord.com/api/v10/invites/${encodeURIComponent(code)}`);
  if (!response.ok) return null;
  const data = await response.json();
  const guild = data?.guild;
  if (!guild?.id || !guild?.icon) return null;
  const ext = String(guild.icon).startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${ext}?size=128`;
}

export function WebsiteIcon({ url, well = 44 }) {
  const theme = useTheme();
  const { profile } = useProfile();
  const [iconState, setIconState] = useState(null);
  const radius = Math.round(well * 0.22);

  useEffect(() => {
    let cancelled = false;
    const href = url?.trim();
    if (!href || !profile?.userId) return undefined;
    discordServerIcon(href)
      .catch(() => null)
      .then((discordIcon) => {
        if (cancelled) return null;
        if (discordIcon) return discordIcon;
        return previewButton(profile.userId, href).then((preview) => {
          const icon = preview?.icon;
          if (typeof icon === 'string' && /^https?:\/\//i.test(icon) && !icon.split('?')[0].toLowerCase().endsWith('.ico')) {
            return icon;
          }
          return null;
        });
      })
      .then((icon) => {
        if (!cancelled && icon) {
          setIconState({ key: `${profile.userId}:${href}`, uri: icon, failed: false });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url, profile?.userId]);

  const iconKey = `${profile?.userId ?? ''}:${url?.trim() ?? ''}`;
  const uri = iconState?.key === iconKey ? iconState.uri : null;
  const failed = iconState?.key === iconKey && iconState.failed;

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={{ width: well, height: well, borderRadius: radius, backgroundColor: theme.backgroundElement }}
        contentFit="cover"
        onError={() =>
          setIconState((current) =>
            current?.key === iconKey ? { ...current, failed: true } : current
          )
        }
      />
    );
  }

  return (
    <View
      style={{
        width: well,
        height: well,
        borderRadius: radius,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.backgroundElement,
      }}>
      <Ionicons name="globe-outline" size={Math.round(well * 0.55)} color={theme.primary} />
    </View>
  );
}

export function SocialBrandIcon({ name, size = 28, color, backgroundColor, well = 44 }) {
  const icon = resolveIconName(name);
  const radius = Math.round(well * 0.22);

  return (
    <View
      style={{
        width: well,
        height: well,
        borderRadius: radius,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: backgroundColor ?? '#5C6168',
      }}>
      <Ionicons name={icon} size={size} color={color ?? '#F3F0E8'} />
    </View>
  );
}
