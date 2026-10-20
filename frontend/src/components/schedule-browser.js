import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, View } from 'react-native';
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

const AUTO_SIGN_IN = `
(function () {
  var alertWrapped = false;
  if (!window.__unimateAlertWrapped) {
    window.__unimateAlertWrapped = true;
    var nativeAlert = window.alert;
    window.alert = function (message) {
      var text = String(message ?? '');
      if (/precondition failed/i.test(text) && /reloading page/i.test(text)) {
        var reloadKey = 'unimate.precondition.reload.' + window.location.pathname;
        try {
          var previousReload = Number(window.sessionStorage.getItem(reloadKey) || 0);
          if (previousReload === 0 || Date.now() - previousReload >= 10000) {
            window.sessionStorage.setItem(reloadKey, String(Date.now()));
            window.setTimeout(function () {
              window.location.reload();
            }, 0);
            return;
          }
        } catch {
          window.setTimeout(function () {
            window.location.reload();
          }, 0);
          return;
        }
      }
      return nativeAlert.apply(window, arguments);
    };
    alertWrapped = true;
  }

  if (window.__unimateAutoSignIn && !alertWrapped) return true;
  window.__unimateAutoSignIn = true;

  var observer;
  var retryTimer;

  function rememberChoice() {
    var checkboxes = document.querySelectorAll('input[type="checkbox"], [role="checkbox"]');
    for (var index = 0; index < checkboxes.length; index += 1) {
      var checkbox = checkboxes[index];
      var labels = checkbox.labels
        ? Array.prototype.map.call(checkbox.labels, function (label) {
            return label.innerText || label.textContent || '';
          }).join(' ')
        : '';
      var parentLabel = checkbox.closest('label');
      var label = [
        checkbox.getAttribute('aria-label'),
        checkbox.getAttribute('title'),
        labels,
        parentLabel && (parentLabel.innerText || parentLabel.textContent),
      ]
        .filter(Boolean)
        .join(' ')
        .replace(/\\s+/g, ' ')
        .trim();
      if (
        !/\\b(?:remember\\s+(?:my\\s+)?(?:choice|login|me)|keep\\s+me\\s+(?:signed|logged)\\s+in|stay\\s+(?:signed|logged)\\s+in)\\b/i.test(
          label
        )
      ) continue;
      if (checkbox.checked || checkbox.getAttribute('aria-checked') === 'true') continue;
      if (window.__unimateRememberedChoice === checkbox) continue;
      if (checkbox.disabled || !checkbox.getClientRects().length) continue;
      window.__unimateRememberedChoice = checkbox;
      checkbox.click();
      return true;
    }

    var controls = document.querySelectorAll('button, a, label, [role="button"]');
    for (var controlIndex = 0; controlIndex < controls.length; controlIndex += 1) {
      var control = controls[controlIndex];
      var controlLabel = (
        control.innerText ||
        control.textContent ||
        control.getAttribute('aria-label') ||
        control.getAttribute('title') ||
        ''
      )
        .replace(/\\s+/g, ' ')
        .trim();
      if (
        !/\\b(?:remember\\s+(?:my\\s+)?(?:choice|login|me)|keep\\s+me\\s+(?:signed|logged)\\s+in|stay\\s+(?:signed|logged)\\s+in)\\b/i.test(
          controlLabel
        )
      ) continue;
      if (
        control.disabled ||
        !control.getClientRects().length ||
        window.__unimateRememberedAction === control
      ) {
        continue;
      }
      window.__unimateRememberedAction = control;
      control.click();
      return true;
    }
    return false;
  }

  function isSchedulePage() {
    return Boolean(
      document.getElementById('openStartRangeButton') &&
      document.getElementById('searchTextWide')
    );
  }

  function stopRetryingOnSchedule() {
    if (!isSchedulePage()) return;
    if (retryTimer) clearInterval(retryTimer);
    if (observer) observer.disconnect();
  }

  function clickNextStep() {
    if (isSchedulePage()) return false;
    rememberChoice();

    var login = document.getElementById('loginAuth');
    if (login) {
      var wasHidden = login.classList.contains('hidelogin');
      if (wasHidden) {
        login.classList.remove('hidelogin');
        window.__unimateLoginClicked = false;
      }
      var wrap = document.getElementById('loginAuthWrap');
      var loading = wrap && wrap.classList.contains('loading');
      var authPosted = /TE Auth posted/i.test(document.body?.innerText || '');
      if (authPosted && window.__unimateLoginWasLoading) {
        window.__unimateLoginClicked = false;
        window.__unimateLoginWasLoading = false;
      }
      if (loading && !authPosted) {
        window.__unimateLoginWasLoading = true;
        return false;
      }
      if (
        window.__unimateLoginWasLoading ||
        window.__unimateLastLoginControl !== login
      ) {
        window.__unimateLoginClicked = false;
        window.__unimateLoginWasLoading = false;
      }
      window.__unimateLastLoginControl = login;
      if (
        !window.__unimateLoginClicked &&
        typeof window.loginWithTEAuth === 'function' &&
        !login.disabled &&
        login.getClientRects().length
      ) {
        window.__unimateLoginClicked = true;
        login.click();
        return true;
      }
    }

    var controls = document.querySelectorAll('button, a, [role="button"], input[type="submit"]');
    for (var index = 0; index < controls.length; index += 1) {
      var control = controls[index];
      var label = (control.innerText || control.value || control.getAttribute('aria-label') || '')
        .replace(/\\s+/g, ' ')
        .trim();
      var isSsoSignIn =
        /\\b(sign in|log in|login)\\b/i.test(label) &&
        /\\b(sso|single[ -]?sign[ -]?on)\\b/i.test(label);
      if (
        isSsoSignIn &&
        !control.disabled &&
        control.getClientRects().length
      ) {
        if (window.__unimateSsoClicked) continue;
        window.__unimateSsoClicked = true;
        control.click();
        return true;
      }
    }

    return false;
  }

  function showLogin() {
    if (!document.body) return;
    if (document.body.style.visibility !== 'visible') {
      document.body.style.visibility = 'visible';
    }
  }

  showLogin();
  observer = new MutationObserver(function () {
    showLogin();
    clickNextStep();
    stopRetryingOnSchedule();
  });
  if (document.documentElement) {
    observer.observe(document.documentElement, {
      attributes: true,
      childList: true,
      subtree: true,
    });
  }
  retryTimer = setInterval(function () {
    showLogin();
    clickNextStep();
    stopRetryingOnSchedule();
  }, 100);
  clickNextStep();
  stopRetryingOnSchedule();
  return true;
})();
true;
`;

function ScheduleBrowserScreen({ userId, initialUrl, onClose }) {
  const theme = useTheme();
  const { t } = useI18n();
  const webRef = useRef(null);
  const lastSaved = useRef(timetableUrl(initialUrl) ?? '');
  const signedIn = useRef(Boolean(timetableUrl(initialUrl)));
  const [canGoBack, setCanGoBack] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);

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
          {pageLoading ? (
            <View
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: Math.round(loadProgress * 100) }}
              style={{ paddingHorizontal: 16, paddingVertical: 6, gap: 5 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color={theme.primary} />
                <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
                  {t('loading')}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {Math.round(loadProgress * 100)}%
                </ThemedText>
              </View>
              <View
                style={{
                  height: 3,
                  overflow: 'hidden',
                  borderRadius: 2,
                  backgroundColor: theme.backgroundElement,
                }}>
                <View
                  style={{
                    width: `${Math.round(loadProgress * 100)}%`,
                    height: '100%',
                    backgroundColor: theme.primary,
                  }}
                />
              </View>
            </View>
          ) : null}
          <WebView
            key={`${userId ?? 'schedule'}:${initialUrl}`}
            ref={webRef}
            source={{ uri: initialUrl }}
            style={{ flex: 1, backgroundColor: theme.background, marginBottom: BOTTOM_INSET }}
            userAgent={Platform.OS === 'ios' ? MOBILE_SAFARI : undefined}
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            cacheEnabled
            incognito={false}
            javaScriptCanOpenWindowsAutomatically
            setSupportMultipleWindows={false}
            allowsBackForwardNavigationGestures
            injectedJavaScriptBeforeContentLoaded={AUTO_SIGN_IN}
            injectedJavaScript={AUTO_SIGN_IN}
            onLoadStart={() => {
              setPageLoading(true);
              setLoadProgress(0);
            }}
            onLoadProgress={({ nativeEvent }) => {
              setLoadProgress(Math.min(1, Math.max(0, nativeEvent.progress)));
            }}
            onLoadEnd={() => {
              setLoadProgress(1);
              setPageLoading(false);
            }}
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
