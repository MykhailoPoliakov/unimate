import { cloneElement, isValidElement } from 'react';
import { Linking, Pressable } from 'react-native';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';

import { useTheme } from '@/hooks/use-theme';
import { nativeAppUrl } from '@/lib/social-service';

export async function openExternalUrl(href, colors, { preferNativeApp = false } = {}) {
  if (process.env.EXPO_OS === 'web') {
    if (typeof window !== 'undefined') {
      window.open(href, '_blank', 'noopener,noreferrer');
    }
    return;
  }

  if (preferNativeApp) {
    const appUrl = nativeAppUrl(href);
    if (appUrl && appUrl !== href) {
      try {
        const supported = await Linking.canOpenURL(appUrl);
        if (supported) {
          await Linking.openURL(appUrl);
          return;
        }
      } catch {
        // Fall through to the in-app browser.
      }
      try {
        await Linking.openURL(appUrl);
        return;
      } catch {
        // Fall through to the in-app browser.
      }
    }
  }

  try {
    await openBrowserAsync(href, {
      presentationStyle: WebBrowserPresentationStyle.FULL_SCREEN,
      dismissButtonStyle: 'close',
      enableDefaultShareMenuItem: true,
      showInRecents: true,
      toolbarColor: colors?.backgroundElement,
      controlsColor: colors?.primary,
      secondaryToolbarColor: colors?.background,
    });
  } catch {
    await Linking.openURL(href);
  }
}

export function ExternalLink({ href, asChild, children, onPress, preferNativeApp = false, ...rest }) {
  const theme = useTheme();

  const handlePress = (event) => {
    onPress?.(event);
    openExternalUrl(href, theme, { preferNativeApp });
  };

  if (asChild && isValidElement(children)) {
    return cloneElement(children, {
      onPress: (event) => {
        children.props.onPress?.(event);
        handlePress(event);
      },
    });
  }

  return (
    <Pressable onPress={handlePress} {...rest}>
      {children}
    </Pressable>
  );
}
