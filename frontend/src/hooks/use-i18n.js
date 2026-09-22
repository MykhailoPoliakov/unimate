import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { useProfile } from '@/hooks/use-profile';
import { LANGUAGES, translate } from '@/i18n/translations';

const I18nContext = createContext({
  language: 'en',
  setLanguage: () => {},
  t: (key) => key,
  languages: LANGUAGES,
});

export function I18nProvider({ children }) {
  const { profile } = useProfile();
  const [override, setOverride] = useState(null);
  const language = profile?.language ?? override ?? 'en';

  const setLanguage = useCallback((next) => {
    setOverride(next);
  }, []);

  const t = useCallback((key, vars) => translate(language, key, vars), [language]);

  const value = useMemo(
    () => ({ language, setLanguage, t, languages: LANGUAGES }),
    [language, setLanguage, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
