import { afterEach, describe, expect, it } from 'vitest';
import { getLang, setLang } from '@/core/i18n';
import { DEFAULT_NAME, NAME_MAX, cleanName, seedFromInput } from '@/core/newGame';
import { FLAG_ONBOARDED, FLAG_RATE_ASKED, readFlag, setFlag } from '@/core/flags';
import { codeToSeed, seedToCode } from '@/core/rng';
import { commitSettings } from '@/core/settingsApply';
import { SETTINGS_KEY, defaultSettings, loadSettings } from '@/core/settings';
import { services } from '@/core/services';
import type { StorageLike } from '@/core/save';

const memory = (): StorageLike & { data: Record<string, string> } => {
  const data: Record<string, string> = {};
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; } };
};

describe('the hero name', () => {
  it('keeps letters, digits, spaces, hyphens and apostrophes, trims and shortens', () => {
    expect(cleanName('  Ari  ')).toBe('Ari');
    expect(cleanName("Mary-Ann O'Neil 99")).toBe("Mary-Ann O'N");
    expect(cleanName('é kay ñ')).toBe('é kay ñ');
    expect(cleanName('a'.repeat(50))).toHaveLength(NAME_MAX);
    expect(cleanName('Ari    Budi')).toBe('Ari Budi');
  });

  it('falls back to the default for nothing usable', () => {
    for (const raw of ['', '   ', null, undefined, '!!!', '<>$%']) expect(cleanName(raw), String(raw)).toBe(DEFAULT_NAME);
  });

  it('only keeps letters the game font can draw, so a name is never invisible', () => {
    for (const raw of ['Андрей', '李雷', '😀😀', 'Ö']) expect(cleanName(raw), raw).toBe(DEFAULT_NAME);
    expect(cleanName('Ari 李')).toBe('Ari');
    expect(cleanName('😀 Ari')).toBe('Ari');
    expect(cleanName('Zoë')).toBe('Zo');
  });

  it('strips markup so a name can never inject anything', () => {
    expect(cleanName('<b>Ari</b>')).toBe('bArib');
  });
});

describe('the seed typed in New Game', () => {
  it('is random when left empty, a number when digits, a world code when it looks like one, and a hash of the words otherwise', () => {
    expect(seedFromInput('', 12345)).toBe(12345);
    expect(seedFromInput('   ', 777)).toBe(777);
    expect(seedFromInput(null, 5)).toBe(5);
    expect(seedFromInput('4242', 1)).toBe(4242);
    expect(seedFromInput('99999999999', 1)).toBe(99999999999 >>> 0);
    const code = seedToCode(987654321);
    expect(seedFromInput(code, 1)).toBe(codeToSeed(code));
    expect(seedFromInput(code.toLowerCase(), 1)).toBe(987654321);
    const words = seedFromInput('my little island', 1);
    expect(words).toBe(seedFromInput('  My Little Island ', 2));
    expect(words).not.toBe(seedFromInput('another island', 1));
    expect(Number.isInteger(words) && words >= 0 && words < 2 ** 32).toBe(true);
  });
});

describe('one-time flags', () => {
  it('start unset, stay set, and survive broken storage without crashing', () => {
    const s = memory();
    expect(readFlag(s, FLAG_ONBOARDED)).toBe(false);
    setFlag(s, FLAG_ONBOARDED);
    expect(readFlag(s, FLAG_ONBOARDED)).toBe(true);
    expect(readFlag(s, FLAG_RATE_ASKED)).toBe(false);
    const broken: StorageLike = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); }, removeItem: () => undefined };
    expect(readFlag(broken, FLAG_ONBOARDED)).toBe(false);
    expect(() => setFlag(broken, FLAG_ONBOARDED)).not.toThrow();
    expect(readFlag(null, FLAG_ONBOARDED)).toBe(false);
    expect(() => setFlag(null, FLAG_ONBOARDED)).not.toThrow();
  });
});

describe('committing settings', () => {
  afterEach(() => {
    delete services.audio;
    delete services.platform;
    delete services.settings;
    setLang('en');
  });

  it('applies them to the language, the audio and the vibration, remembers them, and loads them back', () => {
    const calls: string[] = [];
    services.audio = { setMusicVolume: (v: number) => calls.push(`music ${v}`), setSfxVolume: (v: number) => calls.push(`sfx ${v}`) } as never;
    const platform = { hapticsEnabled: true };
    services.platform = platform as never;
    const storage = memory();
    const next = { ...defaultSettings('en'), musicVol: 0.3, sfxVol: 0.5, vibration: false, lang: 'id' as const };
    commitSettings(next, storage);
    expect(services.settings).toBe(next);
    expect(getLang()).toBe('id');
    expect(calls).toEqual(['music 0.3', 'sfx 0.5']);
    expect(platform.hapticsEnabled).toBe(false);
    expect(loadSettings(storage)).toEqual(next);
    expect(storage.data[SETTINGS_KEY]).toBeDefined();
  });

  it('works before any service exists', () => {
    expect(() => commitSettings(defaultSettings('id'), memory())).not.toThrow();
    expect(getLang()).toBe('id');
  });
});
