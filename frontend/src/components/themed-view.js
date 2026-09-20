import { View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

const backgroundKeys = {
  text: 'text',
  textSecondary: 'textSecondary',
  background: 'background',
  backgroundElement: 'backgroundElement',
  backgroundSelected: 'backgroundSelected',
  primary: 'primary',
};

const backgroundClasses = {
  text: 'bg-text',
  textSecondary: 'bg-text-secondary',
  background: 'bg-background',
  backgroundElement: 'bg-background-element',
  backgroundSelected: 'bg-background-selected',
  primary: 'bg-primary',
};

export function ThemedView({ className = '', type, style, ...otherProps }) {
  const theme = useTheme();
  const key = backgroundKeys[type ?? 'background'];
  const transparent = className.includes('bg-transparent');

  return (
    <View
      className={`${transparent ? '' : backgroundClasses[type ?? 'background']} ${className}`}
      style={transparent ? style : [{ backgroundColor: theme[key] }, style]}
      {...otherProps}
    />
  );
}
