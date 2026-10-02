import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from 'react';
import {
  DEFAULT_LOCALE,
  LOCALES,
  STORAGE_KEY,
  translate,
  localizeText,
  localizeEvent,
  localizeError,
  localizeHistory,
} from './translate.mjs';
const Context = createContext(null);
export function LocaleProvider({ children }) {
  const revision = useRef(0);
  const [locale, setLocale] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return LOCALES.includes(saved) ? saved : DEFAULT_LOCALE;
    } catch {
      return DEFAULT_LOCALE;
    }
  });
  const [preferenceError, setPreferenceError] = useState(false);
  useEffect(() => {
    let disposed = false;
    const saved = (() => {
      try {
        return localStorage.getItem(STORAGE_KEY);
      } catch {
        return null;
      }
    })();
    fetch('/api/preferences')
      .then((r) => {
        if (!r.ok) throw new Error('Preference read failed');
        return r.json();
      })
      .then((p) => {
        if (
          !disposed &&
          revision.current === 0 &&
          !LOCALES.includes(saved) &&
          LOCALES.includes(p.language)
        )
          setLocale(p.language);
        if (!disposed && revision.current === 0 && LOCALES.includes(saved) && saved !== p.language)
          fetch('/api/preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language: saved }),
          }).catch(() => {});
      })
      .catch(() => {});
    return () => {
      disposed = true;
    };
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {}
  }, [locale]);
  const setLanguage = useCallback(async (language) => {
    if (!LOCALES.includes(language)) return;
    revision.current++;
    setLocale(language);
    setPreferenceError(false);
    try {
      const response = await fetch('/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }),
      });
      if (!response.ok) throw new Error('Preference save failed');
    } catch {
      setPreferenceError(true);
    }
  }, []);
  const value = useMemo(
    () => ({
      locale,
      setLanguage,
      preferenceError,
      t: (key, params) => translate(key, locale, params),
      text: (value) => localizeText(value, locale),
      event: (value) => localizeEvent(value, locale),
      error: (value) => localizeError(value, locale),
      history: (state) => localizeHistory(state, locale),
    }),
    [locale, setLanguage, preferenceError],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useLocale() {
  const context = useContext(Context);
  if (!context) throw new Error('LocaleProvider missing');
  return context;
}
