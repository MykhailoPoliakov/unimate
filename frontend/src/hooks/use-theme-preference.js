import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SystemUI from 'expo-system-ui';
import { colorScheme as nativewindColorScheme } from 'nativewind';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, AppState, Platform } from 'react-native';

import { Colors } from '@/constants/theme';

const STORAGE_KEY = 'unimate.theme';
const VALID_PREFERENCES = ['system', 'light', 'dark'];

const ThemePreferenceContext = createContext({
  preference: 'system',
  resolved: 'light',
  isReady: false,
  setPreference: () => {},
});

function readSystemScheme() {
  const scheme = Appearance.getColorScheme();
  return scheme === 'dark' ? 'dark' : scheme === 'light' ? 'light' : null;
}

function resolveScheme(preference, system) {
  if (preference === 'light' || preference === 'dark') return preference;
  return system === 'dark' ? 'dark' : 'light';
}

function applyOverrides(preference, resolved) {
  try {
    nativewindColorScheme.set(resolved);
  } catch {
    // NativeWind colorScheme may be unavailable during early web boot.
  }

  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', resolved === 'dark');
      document.documentElement.style.colorScheme = resolved;
    }
    return;
  }

  Appearance.setColorScheme(preference === 'system' ? null : preference);
}

export function ThemePreferenceProvider({ children }) {
  const [preference, setPreferenceState] = useState('system');
  const [system, setSystem] = useState(readSystemScheme);
  const [isReady, setIsReady] = useState(false);
  const resolved = resolveScheme(preference, system);

  useEffect(() => {
    const syncSystem = () => {
      const next = readSystemScheme();
      if (next) setSystem(next);
    };

    syncSystem();
    const appearance = Appearance.addChangeListener(syncSystem);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncSystem();
    });

    return () => {
      appearance.remove();
      appState.remove();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const value = await AsyncStorage.getItem(STORAGE_KEY);
        const next = VALID_PREFERENCES.includes(value) ? value : 'system';
        const nextSystem = readSystemScheme() ?? system;
        const nextResolved = resolveScheme(next, nextSystem);
        if (cancelled) return;
        if (nextSystem) setSystem(nextSystem);
        applyOverrides(next, nextResolved);
        SystemUI.setBackgroundColorAsync(Colors[nextResolved].background);
        setPreferenceState(next);
      } finally {
        if (!cancelled) setIsReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    applyOverrides(preference, resolved);
    SystemUI.setBackgroundColorAsync(Colors[resolved].background);
  }, [isReady, preference, resolved]);

  const setPreference = useCallback((value) => {
    setPreferenceState(value);
    AsyncStorage.setItem(STORAGE_KEY, value);
  }, []);

  const value = useMemo(
    () => ({ preference, resolved, isReady, setPreference }),
    [preference, resolved, isReady, setPreference]
  );

  return (
    <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>
  );
}

export function useThemePreference() {
  return useContext(ThemePreferenceContext);
}

export function useResolvedColorScheme() {
  return useContext(ThemePreferenceContext).resolved;
}
