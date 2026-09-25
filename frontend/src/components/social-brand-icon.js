import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { View } from 'react-native';

import { LOCAL_ICONS } from '@/lib/local-icons';
import { resolveIconName } from '@/lib/social-service';

export function SocialBrandIcon({ name, size = 28, color, backgroundColor, well = 44 }) {
  const icon = resolveIconName(name);
  const radius = Math.round(well * 0.22);
  const local = LOCAL_ICONS[icon] ?? (icon === 'instagram' ? LOCAL_ICONS['logo-instagram'] : null);

  if (local) {
    return (
      <Image
        source={local}
        style={{ width: well, height: well, borderRadius: radius }}
        contentFit="cover"
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
        backgroundColor: backgroundColor ?? '#5C6168',
      }}>
      <Ionicons name={icon} size={size} color={color ?? '#F3F0E8'} />
    </View>
  );
}
