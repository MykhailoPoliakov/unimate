import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { ApiError, readUser } from '@/lib/api';
import { getDeviceId } from '@/lib/device-id';

const STORAGE_KEY = 'unimate.profile';

const ProfileContext = createContext({
  profile: null,
  isLoading: true,
  saveProfile: async () => {},
  clearProfile: async () => {},
  refreshUser: async () => {},
});

function isValidProfile(value) {
  return (
    value &&
    typeof value.userId === 'string' &&
    value.userId.length > 0 &&
    typeof value.institution === 'string' &&
    typeof value.program === 'string'
  );
}

export function mapRemoteUser(user, deviceId) {
  return {
    userId: String(user.id),
    institution: user.institution,
    program: user.program,
    yearOfStudy: user.year_of_study,
    language: user.language ?? 'en',
    role: user.role === 'admin' ? 'admin' : 'student',
    deviceId,
  };
}

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const persist = useCallback(async (next) => {
    setProfile(next);
    if (next) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else await AsyncStorage.removeItem(STORAGE_KEY);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const id = await getDeviceId();
        if (cancelled) return;
        setDeviceId(id);

        const value = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        if (!value) return;
        const parsed = JSON.parse(value);
        if (!isValidProfile(parsed)) return;

        try {
          const remote = await readUser(parsed.userId);
          if (cancelled) return;
          await persist({ ...parsed, ...mapRemoteUser(remote, id) });
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) {
            if (!cancelled) await persist(null);
            return;
          }
          if (!cancelled) {
            setProfile({
              ...parsed,
              deviceId: id,
              role: parsed.role === 'admin' ? 'admin' : 'student',
            });
          }
        }
      } catch {
        // Ignore corrupt storage.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [persist]);

  const saveProfile = useCallback(
    async (updates) => persist({ deviceId, ...(profile ?? {}), ...updates, deviceId }),
    [deviceId, persist, profile]
  );

  const clearProfile = useCallback(async () => persist(null), [persist]);

  const refreshUser = useCallback(async () => {
    if (!profile?.userId) return profile;
    const remote = await readUser(profile.userId);
    return persist({ ...profile, ...mapRemoteUser(remote, deviceId ?? profile.deviceId) });
  }, [deviceId, persist, profile]);

  return (
    <ProfileContext.Provider value={{ profile, isLoading, saveProfile, clearProfile, refreshUser }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
