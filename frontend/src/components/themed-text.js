import { Text } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

const colorKeys = {
  text: 'text',
  textSecondary: 'textSecondary',
  background: 'background',
  backgroundElement: 'backgroundElement',
  backgroundSelected: 'backgroundSelected',
  primary: 'primary',
};

const colorClasses = {
  text: 'text-text',
  textSecondary: 'text-text-secondary',
  background: 'text-background',
  backgroundElement: 'text-background-element',
  backgroundSelected: 'text-background-selected',
  primary: 'text-primary',
};

const typeClasses = {
  default: 'text-base font-medium',
  title: 'text-5xl font-semibold leading-[52px]',
  small: 'text-sm font-medium',
  smallBold: 'text-sm font-bold',
  subtitle: 'text-[32px] font-semibold leading-[44px]',
  link: 'text-sm leading-[30px]',
  linkPrimary: 'text-sm leading-[30px]',
  code: 'font-mono text-[12px] font-medium android:font-bold',
};

export function ThemedText({ className = '', type = 'default', themeColor, style, ...rest }) {
  const theme = useTheme();
  const colorKey = type === 'linkPrimary' ? 'primary' : (themeColor ?? 'text');
  const colorClass = type === 'linkPrimary' ? 'text-link' : colorClasses[themeColor ?? 'text'];
  const isWhite = className.includes('text-white');

  return (
    <Text
      className={`${colorClass} ${typeClasses[type]} ${className}`}
      style={[{ color: isWhite ? '#FFFFFF' : theme[colorKeys[colorKey]] }, style]}
      {...rest}
    />
  );
}
