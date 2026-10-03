import type { Lang } from '@/core/i18n';
import type { StorageLike } from '@/core/save';

export interface Settings {
  musicVol: number;
  sfxVol: number;
  vibration: boolean;
  screenShake: boolean;
  damageNumbers: boolean;
  autoAttack: boolean;
  joystick: 'floating' | 'fixed';
  lang: Lang;
  quality: 'auto' | 'high' | 'low';
  /** Accessibility text size multiplier, 1..1.3. */
  textScale: number;
}

export const SETTINGS_KEY = 'tidewake.settings.v1';

export function defaultSettings(lang: Lang = 'en'): Settings {
  return {
    musicVol: 0.6, sfxVol: 0.8, vibration: true, screenShake: true, damageNumbers: true,
    autoAttack: false, joystick: 'floating', lang, quality: 'auto', textScale: 1,
  };
}

const clamp01 = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

/** Merge stored JSON over the defaults, ignoring unknown keys and wrong types. */
export function parseSettings(raw: unknown, lang: Lang = 'en'): Settings {
  const base = defaultSettings(lang);
  if (typeof raw !== 'object' || raw === null) return base;
  const d = raw as Record<string, unknown>;
  return {
    musicVol: clamp01(d.musicVol, base.musicVol),
    sfxVol: clamp01(d.sfxVol, base.sfxVol),
    vibration: bool(d.vibration, base.vibration),
    screenShake: bool(d.screenShake, base.screenShake),
    damageNumbers: bool(d.damageNumbers, base.damageNumbers),
    autoAttack: bool(d.autoAttack, base.autoAttack),
    joystick: d.joystick === 'fixed' ? 'fixed' : 'floating',
    lang: d.lang === 'id' ? 'id' : d.lang === 'en' ? 'en' : base.lang,
    quality: d.quality === 'low' ? 'low' : d.quality === 'high' ? 'high' : 'auto',
    textScale: typeof d.textScale === 'number' && Number.isFinite(d.textScale) ? Math.min(1.3, Math.max(1, d.textScale)) : base.textScale,
  };
}

export function loadSettings(storage: StorageLike | null, lang: Lang = 'en'): Settings {
  try {
    const txt = storage?.getItem(SETTINGS_KEY);
    return parseSettings(txt ? JSON.parse(txt) : null, lang);
  } catch {
    return defaultSettings(lang);
  }
}

export function saveSettings(storage: StorageLike | null, s: Settings): void {
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch (err) {
    console.error('[settings] write failed', err);
  }
}
