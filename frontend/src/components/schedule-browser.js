import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { ThemedText } from '@/components/themed-text';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';

export function scheduleStorageKey(userId) {
  return `unimate.scheduleUrl.${userId}`;
}

const SKIP_HTML = /\/(index|login|logout|error|saml|sso|signin|signon)\.html$/i;

export function timetableUrl(value) {
  const trimmed = String(value ?? '').trim();
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const host = url.hostname.toLowerCase();
  if (host !== 'cloud.timeedit.net' && host !== 'timeedit.kdg.be') return null;
  if (/login|logout|saml|sso|microsoftonline|adfs/i.test(url.pathname)) return null;
  if (!/\.html$/i.test(url.pathname) || SKIP_HTML.test(url.pathname)) return null;
  return url.toString();
}

export function scheduleStartUrl(value) {
  const saved = timetableUrl(value);
  if (saved) return saved;
  try {
    const url = new URL(String(value ?? '').trim());
    const host = url.hostname.toLowerCase();
    if (host === 'timeedit.kdg.be') return 'https://cloud.timeedit.net/be_kdg/web/student/';
    if (host === 'cloud.timeedit.net') {
      const parts = url.pathname.split('/').filter(Boolean);
      const org = parts[0] || 'be_kdg';
      const section = parts[1] || 'web';
      return `https://cloud.timeedit.net/${org}/${section}/student/`;
    }
  } catch {
    // Fall through to the KdG student entry.
  }
  return 'https://cloud.timeedit.net/be_kdg/web/student/';
}

const TOP_INSET = Platform.OS === 'ios' ? Math.max(initialWindowMetrics?.insets.top ?? 0, 62) : (initialWindowMetrics?.insets.top ?? 0);
const BOTTOM_INSET = initialWindowMetrics?.insets.bottom ?? 0;

const MOBILE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

export function isScheduleSignInUrl(value) {
  try {
    const host = new URL(String(value ?? '')).hostname.toLowerCase();
    return (
      host === 'www.timeedit.net' ||
      host === 'auth.timeedit.net' ||
      /microsoftonline|live\.com|microsoft\.com|adfs|okta/.test(host)
    );
  } catch {
    return false;
  }
}

const SHOW_SIGN_IN = `
(function () {
  if (window.__unimateShowSignIn) return true;
  window.__unimateShowSignIn = true;

  function showLogin() {
    var button = document.getElementById('loginAuth');
    if (button) button.classList.remove('hidelogin');
    var wrap = document.getElementById('loginAuthWrap');
    if (wrap) wrap.classList.remove('loading');
    if (document.body) document.body.style.visibility = 'visible';
  }

  showLogin();
  setInterval(showLogin, 300);
  return true;
})();
true;
`;

function ScheduleBrowserScreen({ userId, initialUrl, onClose }) {
  const theme = useTheme();
  const { t } = useI18n();
  const webRef = useRef(null);
  const lastSaved = useRef('');
  const signedIn = useRef(Boolean(timetableUrl(initialUrl)));
  const mustSignIn = !signedIn.current;
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    lastSaved.current = timetableUrl(initialUrl) ?? '';
    signedIn.current = Boolean(lastSaved.current);
  }, [initialUrl]);

  const remember = useCallback(
    async (url) => {
      if (!signedIn.current) return;
      const next = timetableUrl(url);
      if (!next || !userId || next === lastSaved.current) return;
      lastSaved.current = next;
      await AsyncStorage.setItem(scheduleStorageKey(userId), next);
    },
    [userId]
  );

  const noteNavigation = useCallback(
    (url) => {
      if (isScheduleSignInUrl(url)) signedIn.current = true;
      remember(url);
    },
    [remember]
  );

  const allowNavigation = useCallback((request) => {
    const url = request?.url ?? '';
    if (signedIn.current || !timetableUrl(url)) return true;
    return false;
  }, []);

  const openPopupInPlace = useCallback((event) => {
    const url = event?.nativeEvent?.targetUrl;
    if (!url || !webRef.current) return;
    webRef.current.injectJavaScript(`window.location.assign(${JSON.stringify(url)}); true;`);
  }, []);

  return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
          <View style={{ height: TOP_INSET, backgroundColor: theme.background }} />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 8,
              height: 52,
              zIndex: 2,
              backgroundColor: theme.background,
            }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => (canGoBack ? webRef.current?.goBack() : onClose())}
              hitSlop={12}
              style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="chevron-back" size={28} color={theme.text} />
            </Pressable>
            <ThemedText type="smallBold" style={{ flex: 1, textAlign: 'center' }}>
              {t('yourSchedule')}
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={26} color={theme.text} />
            </Pressable>
          </View>
          <WebView
            key={`${userId ?? 'schedule'}:${initialUrl}`}
            ref={webRef}
            source={{ uri: initialUrl }}
            style={{ flex: 1, backgroundColor: theme.background, marginBottom: BOTTOM_INSET }}
            userAgent={Platform.OS === 'ios' ? MOBILE_SAFARI : undefined}
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled={false}
            thirdPartyCookiesEnabled
            cacheEnabled
            incognito={mustSignIn}
            javaScriptCanOpenWindowsAutomatically
            setSupportMultipleWindows={false}
            allowsBackForwardNavigationGestures
            injectedJavaScriptBeforeContentLoaded={mustSignIn ? SHOW_SIGN_IN : undefined}
            injectedJavaScript={mustSignIn ? SHOW_SIGN_IN : undefined}
            onShouldStartLoadWithRequest={allowNavigation}
            onNavigationStateChange={(nav) => {
              setCanGoBack(Boolean(nav.canGoBack));
              noteNavigation(nav.url);
            }}
            onOpenWindow={openPopupInPlace}
          />
      </View>
  );
}

export function ScheduleBrowser(props) {
  if (!props.visible || !props.initialUrl) return null;

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={props.onClose}>
      <ScheduleBrowserScreen {...props} />
    </Modal>
  );
}
