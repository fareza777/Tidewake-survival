/** Localization: English + Bahasa Indonesia. Content data carries inline {en, id} pairs; UI strings use keys. */
import { UI_STRINGS } from '@/data/strings';

export type Lang = 'en' | 'id';
export interface L10n {
  en: string;
  id: string;
}

let current: Lang = 'en';

export function setLang(lang: Lang): void {
  current = lang;
}

export function getLang(): Lang {
  return current;
}

/** Translate an inline localized value. Plain strings pass through. */
export function tr(v: L10n | string | undefined, vars?: Record<string, string | number>): string {
  if (v === undefined) return '';
  const s = typeof v === 'string' ? v : v[current] || v.en;
  return vars ? fill(s, vars) : s;
}

/** Translate a UI key. Unknown keys are returned as-is so missing strings are visible but never crash. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const entry = UI_STRINGS[key];
  if (!entry) return key;
  return tr(entry, vars);
}

function fill(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_m, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function detectLang(): Lang {
  const nav = typeof navigator !== 'undefined' ? navigator.language || '' : '';
  return nav.toLowerCase().startsWith('id') || nav.toLowerCase().startsWith('in') ? 'id' : 'en';
}
