import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, View } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { PressScale } from '@/components/motion';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useI18n } from '@/hooks/use-i18n';

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
const TOOLBAR_BUTTON_STYLE = {
  width: 40,
  height: 40,
  borderRadius: 20,
  borderWidth: 1,
};
const TOOLBAR_BUTTON_CONTENT_STYLE = {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
};

const MOBILE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

const STARTUP_PROGRESS = 0.6;
const READY_DISPLAY_MS = 100;

const ScheduleBrowserContext = createContext(null);

export function useScheduleBrowser() {
  const context = useContext(ScheduleBrowserContext);
  if (!context) throw new Error('useScheduleBrowser must be used within ScheduleBrowserProvider');
  return context;
}

export function ScheduleBrowserProvider({ children }) {
  const [browser, setBrowser] = useState({
    userId: null,
    initialUrl: null,
    visible: false,
  });

  const preloadSchedule = useCallback((userId, initialUrl) => {
    setBrowser((current) => {
      if (current.userId === userId && current.initialUrl === initialUrl) return current;
      if (current.visible && current.userId === userId) return current;
      return { userId, initialUrl, visible: false };
    });
  }, []);
  const openSchedule = useCallback((userId, initialUrl) => {
    setBrowser({ userId, initialUrl, visible: true });
  }, []);
  const closeSchedule = useCallback(() => {
    setBrowser((current) => ({ ...current, visible: false }));
  }, []);

  const context = { preloadSchedule, openSchedule };

  return (
    <ScheduleBrowserContext.Provider value={context}>
      <View style={{ flex: 1 }}>
        {children}
        {browser.initialUrl ? (
          <ScheduleBrowser
            visible={browser.visible}
            initialUrl={browser.initialUrl}
            userId={browser.userId}
            onClose={closeSchedule}
          />
        ) : null}
      </View>
    </ScheduleBrowserContext.Provider>
  );
}

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
      var isPreconditionReload = /precondition failed/i.test(text) && /reloading page/i.test(text);
      var isPageUpdate =
        /\bpage\b.{0,100}\bneed(?:s)? to be updated\b/i.test(text) ||
        /\b(?:update|refresh|reload) (?:the|this|your) page\b/i.test(text);
      if (isPreconditionReload || isPageUpdate) {
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
        }
        return;
      }
      return nativeAlert.apply(window, arguments);
    };
    alertWrapped = true;
  }

  function isSchedulePage() {
    return Boolean(
      document.getElementById('openStartRangeButton') &&
      document.getElementById('searchTextWide')
    );
  }

  function isPageStillLoading() {
    var indicators = document.querySelectorAll(
      '[aria-busy="true"], [role="progressbar"], progress, .loading, .loader, .spinner, [class*="loading"], [class*="spinner"]'
    );
    for (var index = 0; index < indicators.length; index += 1) {
      var indicator = indicators[index];
      var style = window.getComputedStyle(indicator);
      if (
        indicator.getClientRects().length &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number(style.opacity || 1) > 0
      ) {
        return true;
      }
    }
    return false;
  }

  if (window.__unimateAutoSignIn && !alertWrapped) return true;
  window.__unimateAutoSignIn = true;

  var observer;
  var retryTimer;
  var scheduleReadyTimer;

  function clickImmediately(control, onCancel) {
    if (!control.isConnected || control.disabled || !control.getClientRects().length) {
      if (onCancel) onCancel();
      return false;
    }
    control.click();
    return true;
  }

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
      if (
        !clickImmediately(checkbox, function () {
          if (window.__unimateRememberedChoice === checkbox) {
            window.__unimateRememberedChoice = null;
          }
        })
      ) continue;
      window.__unimateRememberedChoice = checkbox;
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
      if (
        !clickImmediately(control, function () {
          if (window.__unimateRememberedAction === control) {
            window.__unimateRememberedAction = null;
          }
        })
      ) continue;
      window.__unimateRememberedAction = control;
      return true;
    }
    return false;
  }

  function stopRetryingOnSchedule() {
    if (!isSchedulePage()) return;
    if (!window.__unimateScheduleReadySent && !scheduleReadyTimer) {
      scheduleReadyTimer = setTimeout(function () {
        scheduleReadyTimer = null;
        if (
          !isSchedulePage() ||
          document.readyState !== 'complete' ||
          isPageStillLoading()
        ) {
          return;
        }
        if (window.ReactNativeWebView) {
          window.__unimateScheduleReadySent = true;
          window.ReactNativeWebView.postMessage('schedule-ready');
        }
      }, 2000);
    }
    if (!window.__unimateScheduleReadySent) return;
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
        clickImmediately(login, function () {
          window.__unimateLoginClicked = false;
        });
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
        clickImmediately(control, function () {
          window.__unimateSsoClicked = false;
        });
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
  const theme = Colors.light;
  const { t } = useI18n();
  const webRef = useRef(null);
  const lastSaved = useRef(timetableUrl(initialUrl) ?? '');
  const signedIn = useRef(Boolean(timetableUrl(initialUrl)));
  const progressRef = useRef(STARTUP_PROGRESS);
  const lastRefresh = useRef(0);
  const scheduleReady = useRef(false);
  const pageLoadStarted = useRef(false);
  const readyDisplayTimer = useRef(null);
  const [authOverlayVisible, setAuthOverlayVisible] = useState(true);
  const [topProgressVisible, setTopProgressVisible] = useState(false);
  const [loadProgress, setLoadProgress] = useState(STARTUP_PROGRESS);
  const toolbarButtonStyle = {
    ...TOOLBAR_BUTTON_STYLE,
    borderColor: theme.border,
    backgroundColor: theme.backgroundElement,
  };

  const updateLoadProgress = useCallback((progress) => {
    const next = Math.max(progressRef.current, Math.min(0.99, Math.max(0, progress)));
    if (next === progressRef.current) return;
    progressRef.current = next;
    setLoadProgress(next);
  }, []);

  const beginPageLoad = useCallback(() => {
    if (!scheduleReady.current || pageLoadStarted.current) return;
    pageLoadStarted.current = true;
    progressRef.current = 0;
    setLoadProgress(0);
    setTopProgressVisible(true);
  }, []);

  const finishPageLoad = useCallback(() => {
    if (!scheduleReady.current) return;
    pageLoadStarted.current = false;
    progressRef.current = 1;
    setLoadProgress(1);
    setTopProgressVisible(false);
  }, []);

  useEffect(() => {
    if (!authOverlayVisible) return undefined;
    const timer = setInterval(() => {
      updateLoadProgress(progressRef.current + 0.01);
    }, 300);
    return () => clearInterval(timer);
  }, [authOverlayVisible, updateLoadProgress]);

  useEffect(
    () => () => {
      if (readyDisplayTimer.current) clearTimeout(readyDisplayTimer.current);
    },
    []
  );

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
      if (isScheduleSignInUrl(url)) {
        signedIn.current = true;
        scheduleReady.current = false;
        if (readyDisplayTimer.current) clearTimeout(readyDisplayTimer.current);
        readyDisplayTimer.current = null;
        setAuthOverlayVisible(true);
      }
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

  const reloadSchedule = useCallback(() => {
    if (Date.now() - lastRefresh.current < 1500) return;
    lastRefresh.current = Date.now();
    beginPageLoad();
    webRef.current?.reload();
  }, [beginPageLoad]);

  return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ height: TOP_INSET, backgroundColor: theme.background }} />
        <View
          style={{
            height: 56,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            backgroundColor: theme.background,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
            zIndex: 1,
          }}>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={t('reload')}
            onPress={reloadSchedule}
            pressedScale={0.86}
            style={toolbarButtonStyle}
            contentStyle={TOOLBAR_BUTTON_CONTENT_STYLE}>
            <Ionicons name="refresh" size={22} color={theme.text} />
          </PressScale>
          <ThemedText
            type="smallBold"
            numberOfLines={1}
            style={{
              position: 'absolute',
              left: 64,
              right: 64,
              textAlign: 'center',
              color: theme.text,
            }}>
            {t('yourSchedule')}
          </ThemedText>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={t('close')}
            onPress={onClose}
            pressedScale={0.86}
            style={toolbarButtonStyle}
            contentStyle={TOOLBAR_BUTTON_CONTENT_STYLE}>
            <Ionicons name="close" size={22} color={theme.text} />
          </PressScale>
        </View>
        <View style={{ flex: 1, position: 'relative', backgroundColor: theme.background }}>
            <WebView
              key={`${userId ?? 'schedule'}:${initialUrl}`}
              ref={webRef}
              source={{ uri: initialUrl }}
              style={{ flex: 1, backgroundColor: theme.background }}
              userAgent={Platform.OS === 'ios' ? MOBILE_SAFARI : undefined}
              javaScriptEnabled
              domStorageEnabled
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              cacheEnabled
              incognito={false}
              scrollEnabled
              nestedScrollEnabled={Platform.OS === 'android'}
              overScrollMode={Platform.OS === 'android' ? 'always' : undefined}
              automaticallyAdjustContentInsets={false}
              bounces
              decelerationRate={Platform.OS === 'ios' ? 'normal' : undefined}
              javaScriptCanOpenWindowsAutomatically
              setSupportMultipleWindows={false}
              allowsBackForwardNavigationGestures
              injectedJavaScriptBeforeContentLoaded={AUTO_SIGN_IN}
              injectedJavaScript={AUTO_SIGN_IN}
              onMessage={({ nativeEvent }) => {
                if (nativeEvent.data !== 'schedule-ready') return;
                scheduleReady.current = true;
                if (pageLoadStarted.current) {
                  finishPageLoad();
                } else {
                  progressRef.current = 1;
                  setLoadProgress(1);
                  setTopProgressVisible(false);
                }
                if (readyDisplayTimer.current) clearTimeout(readyDisplayTimer.current);
                readyDisplayTimer.current = setTimeout(() => {
                  readyDisplayTimer.current = null;
                  if (scheduleReady.current) setAuthOverlayVisible(false);
                }, READY_DISPLAY_MS);
              }}
              onLoadProgress={({ nativeEvent }) => {
                if (pageLoadStarted.current) {
                  updateLoadProgress(nativeEvent.progress * 0.99);
                }
              }}
              onLoadEnd={finishPageLoad}
              onShouldStartLoadWithRequest={allowNavigation}
              onNavigationStateChange={(nav) => {
                noteNavigation(nav.url);
              }}
              onOpenWindow={openPopupInPlace}
            />
            {topProgressVisible ? (
              <View
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: Math.round(loadProgress * 100) }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  overflow: 'hidden',
                  backgroundColor: theme.border,
                }}>
                <View
                  style={{
                    width: `${Math.round(loadProgress * 100)}%`,
                    height: '100%',
                    backgroundColor: theme.primary,
                  }}
                />
              </View>
            ) : null}
            {authOverlayVisible ? (
              <View
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: Math.round(loadProgress * 100) }}
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  bottom: 0,
                  left: 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 24,
                  backgroundColor: theme.background,
                }}>
                <ActivityIndicator size="large" color={theme.primary} />
                <ThemedText type="smallBold" style={{ marginTop: 20, color: theme.text }}>
                  {t('loggingInAndLoading')}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 10, marginBottom: 8 }}>
                  {Math.round(loadProgress * 100)}%
                </ThemedText>
                <View
                  style={{
                    width: '100%',
                    maxWidth: 280,
                    height: 4,
                    overflow: 'hidden',
                    borderRadius: 4,
                    backgroundColor: theme.backgroundElement,
                  }}
                >
                  <View
                    style={{
                      width: `${Math.round(loadProgress * 100)}%`,
                      height: '100%',
                      borderRadius: 4,
                      backgroundColor: theme.primary,
                    }}
                  />
                </View>
              </View>
            ) : null}
        </View>
      </View>
  );
}

function ScheduleBrowser({ visible, initialUrl, onClose, userId }) {
  const handleClose = useCallback(() => {
    if (!visible) return false;
    onClose();
    return true;
  }, [onClose, visible]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', handleClose);
    return () => subscription.remove();
  }, [handleClose]);

  if (!initialUrl) return null;

  return (
    <View
      pointerEvents={visible ? 'auto' : 'none'}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: visible ? 1000 : -1,
        elevation: visible ? 1000 : 0,
        opacity: visible ? 1 : 0,
      }}>
      <ScheduleBrowserScreen
        key={`${userId ?? 'schedule'}:${initialUrl}`}
        userId={userId}
        initialUrl={initialUrl}
        onClose={onClose}
      />
    </View>
  );
}
