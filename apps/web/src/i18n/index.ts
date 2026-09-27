import { useCallback, useEffect, useState } from 'react';
import en from './en.json';
import hi from './hi.json';
import mr from './mr.json';

export type Lang = 'mr' | 'hi' | 'en';
export type I18nKey = keyof typeof en;

const TABLES: Record<Lang, Record<I18nKey, string>> = { en, hi, mr };
const KEY = 'ks.lang';

export const LANGS: { code: Lang; label: string }[] = [
  { code: 'mr', label: 'मराठी' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'en', label: 'English' },
];

function initial(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'mr' || v === 'hi' || v === 'en') return v;
  } catch {
    // Fall through to the default.
  }
  return 'mr';
}

// Trainee-facing strings default to Marathi and switch to Hindi or English.
export function useI18n() {
  const [lang, setLangState] = useState<Lang>(initial);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, lang);
    } catch {
      // Preference applies to this tab only.
    }
  }, [lang]);
  const t = useCallback(
    (key: I18nKey, vars: Record<string, string | number> = {}) =>
      (TABLES[lang][key] ?? en[key]).replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)),
    [lang],
  );
  return { lang, setLang: setLangState, t };
}
