import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SystemUI from 'expo-system-ui';
import { colorScheme as nativewindColorScheme } from 'nativewind';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Appearance, Platform, useColorScheme as useSystemColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

const STORAGE_KEY = 'unimate.theme';
const VALID_PREFERENCES = ['system', 'light', 'dark'];

const ThemePreferenceContext = createContext({
  preference: 'system',
  resolved: 'light',
  isReady: false,
  setPreference: () => {},
});

function resolveScheme(preference, system) {
  if (preference === 'light' || preference === 'dark') return preference;
  return system === 'dark' ? 'dark' : 'light';
}

function applyOverrides(preference, resolved) {
  try {
    nativewindColorScheme.set(preference);
  } catch {
    // NativeWind may not accept "system" on every platform.
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
  const system = useSystemColorScheme();
  const [preference, setPreferenceState] = useState('system');
  const [isReady, setIsReady] = useState(false);
  const appliedOnce = useRef(false);
  const skipNextApply = useRef(true);
  const resolved = resolveScheme(preference, system);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const value = await AsyncStorage.getItem(STORAGE_KEY);
        const next = VALID_PREFERENCES.includes(value) ? value : 'system';
        const nextResolved = resolveScheme(next, Appearance.getColorScheme());
        if (cancelled) return;
        applyOverrides(next, nextResolved);
        SystemUI.setBackgroundColorAsync(Colors[nextResolved].background);
        setPreferenceState(next);
      } finally {
        if (!cancelled) {
          appliedOnce.current = true;
          setIsReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isReady || !appliedOnce.current) return;
    if (skipNextApply.current) {
      skipNextApply.current = false;
      return;
    }
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
