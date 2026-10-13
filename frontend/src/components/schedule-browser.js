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

const TOP_INSET = Platform.OS === 'ios' ? Math.max(initialWindowMetrics?.insets.top ?? 0, 62) : (initialWindowMetrics?.insets.top ?? 0);
const BOTTOM_INSET = initialWindowMetrics?.insets.bottom ?? 0;

const MOBILE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

const CLICK_SCRIPT = `
(function () {
  if (window.__unimateScheduleWatch) return true;
  window.__unimateScheduleWatch = true;

  function onTimetable() {
    return /^https:\\/\\/(cloud\\.timeedit\\.net|timeedit\\.kdg\\.be)\\/.+\\.html([?#]|$)/i.test(location.href)
      && !/\\/(index|login|logout|error|saml|sso|signin|signon)\\.html([?#]|$)/i.test(location.pathname);
  }

  function report() {
    try {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(location.href);
    } catch (e) {}
  }

  function textOf(el) {
    return (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '')
      .replace(/\\s+/g, ' ')
      .trim();
  }

  function kindOf(text) {
    if (!text || text.length > 22) return '';
    if (/^(student|students|studenten)$/i.test(text)) return 'student';
    if (/^(schedule|schedules|rooster|lessenrooster|mijn rooster|my schedule|schema|horaire|stundenplan)$/i.test(text)) return 'schedule';
    return '';
  }

  function wouldReload(el) {
    var href = el.href || (el.getAttribute && el.getAttribute('href')) || '';
    if (!href || href === '#' || href.charAt(0) === '#') return href === '#' || (href && href.charAt(0) === '#');
    try {
      var next = new URL(href, location.href);
      return next.pathname === location.pathname && next.search === location.search;
    } catch (e) {
      return false;
    }
  }

  function visible(el) {
    var rects = el.getClientRects();
    return rects.length > 0 && rects[0].width > 8 && rects[0].height > 8;
  }

  function walk(root, out) {
    if (!root || !root.querySelectorAll) return;
    var nodes = root.querySelectorAll('a, button, [role="button"], [role="link"], [onclick], div, span, li');
    for (var i = 0; i < nodes.length; i++) {
      out.push(nodes[i]);
      if (nodes[i].shadowRoot) walk(nodes[i].shadowRoot, out);
    }
  }

  var clicked = [];
  var clicksOnUrl = 0;
  var urlForClicks = '';

  function already(el) {
    return clicked.indexOf(el) !== -1;
  }

  function scan() {
    report();
    if (!document.documentElement) return;
    if (location.href !== urlForClicks) {
      urlForClicks = location.href;
      clicksOnUrl = 0;
      clicked = [];
    }
    if (onTimetable() || clicksOnUrl >= 2) return;
    var nodes = [];
    walk(document, nodes);
    var student = null;
    var schedule = null;
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (already(el) || !visible(el) || wouldReload(el)) continue;
      var kind = kindOf(textOf(el));
      if (!kind) continue;
      var nested = false;
      for (var c = 0; c < el.children.length; c++) {
        if (kindOf(textOf(el.children[c]))) nested = true;
      }
      if (nested) continue;
      if (kind === 'student' && !student) student = el;
      if (kind === 'schedule' && !schedule) schedule = el;
    }
    var pick = student || schedule;
    if (!pick) return;
    clicked.push(pick);
    clicksOnUrl += 1;
    try { pick.click(); } catch (e) {}
  }

  var queued = false;
  function scheduleScan() {
    if (queued) return;
    queued = true;
    setTimeout(function () {
      queued = false;
      scan();
    }, 600);
  }

  function boot() {
    if (!document.documentElement) return;
    scheduleScan();
    new MutationObserver(scheduleScan).observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);
  return true;
})();
true;
`;

function ScheduleBrowserScreen({ userId, initialUrl, onClose }) {
  const theme = useTheme();
  const { t } = useI18n();
  const webRef = useRef(null);
  const lastSaved = useRef('');
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    lastSaved.current = timetableUrl(initialUrl) ?? '';
  }, [initialUrl]);

  const remember = useCallback(
    async (url) => {
      const next = timetableUrl(url);
      if (!next || !userId || next === lastSaved.current) return;
      lastSaved.current = next;
      await AsyncStorage.setItem(scheduleStorageKey(userId), next);
    },
    [userId]
  );

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
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            cacheEnabled
            javaScriptCanOpenWindowsAutomatically
            setSupportMultipleWindows={false}
            allowsBackForwardNavigationGestures
            injectedJavaScript={CLICK_SCRIPT}
            onMessage={(event) => remember(event.nativeEvent.data)}
            onNavigationStateChange={(nav) => {
              setCanGoBack(Boolean(nav.canGoBack));
              remember(nav.url);
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
