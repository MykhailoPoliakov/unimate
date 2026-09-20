import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'unimate.profile';

const ProfileContext = createContext({
  profile: null,
  isLoading: true,
  saveProfile: async () => {},
  clearProfile: async () => {},
});

function isValidProfile(value) {
  return (
    value &&
    typeof value.firstName === 'string' &&
    value.firstName.trim().length > 0 &&
    typeof value.lastName === 'string' &&
    value.lastName.trim().length > 0 &&
    typeof value.university === 'string' &&
    value.university.length > 0
  );
}

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const value = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        if (value) {
          const parsed = JSON.parse(value);
          if (isValidProfile(parsed)) setProfile(parsed);
        }
      } catch {
        // Ignore corrupt storage and fall through to onboarding.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const saveProfile = useCallback(async (updates) => {
    const merged = { ...(profile ?? {}), ...updates };
    setProfile(merged);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return merged;
  }, [profile]);

  const clearProfile = useCallback(async () => {
    setProfile(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <ProfileContext.Provider value={{ profile, isLoading, saveProfile, clearProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
