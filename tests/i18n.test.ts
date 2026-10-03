import { describe, expect, it } from 'vitest';
import { getLang, setLang, t, tr } from '@/core/i18n';
import { RESOURCES } from '@/data/resources';
import { UI_STRINGS } from '@/data/strings';

const placeholders = (s: string): string[] => (s.match(/\{\w+\}/g) ?? []).sort();

describe('UI strings', () => {
  it('has a non-empty English and Indonesian text for every key', () => {
    for (const [key, v] of Object.entries(UI_STRINGS)) {
      expect(v.en.trim(), `${key}.en`).not.toBe('');
      expect(v.id.trim(), `${key}.id`).not.toBe('');
    }
  });

  it('uses the same {placeholders} in both languages', () => {
    for (const [key, v] of Object.entries(UI_STRINGS)) {
      expect(placeholders(v.id), key).toEqual(placeholders(v.en));
    }
  });
});

describe('item names', () => {
  it('has a name for every item a resource can drop', () => {
    for (const def of Object.values(RESOURCES)) {
      for (const d of def.drops) expect(UI_STRINGS[`item_${d.item}`], `name for ${d.item}`).toBeDefined();
    }
  });
});

describe('new game confirmation', () => {
  it('names the save that will be replaced, in both languages', () => {
    for (const lang of ['en', 'id'] as const) {
      setLang(lang);
      const text = t('newGameConfirm', { name: 'Ari', day: 4 });
      expect(text, lang).toContain('Ari');
      expect(text, lang).toContain('4');
      expect(text, lang).not.toContain('{');
    }
    setLang('en');
  });
});

describe('t / tr', () => {
  it('translates by key in the current language and fills variables', () => {
    setLang('en');
    expect(t('hudDay', { n: 3 })).toBe('Day 3');
    setLang('id');
    expect(t('hudDay', { n: 3 })).toBe('Hari 3');
    expect(getLang()).toBe('id');
    setLang('en');
  });

  it('returns unknown keys as-is and keeps unknown placeholders visible', () => {
    expect(t('does_not_exist')).toBe('does_not_exist');
    expect(tr({ en: 'Hi {name}', id: 'Halo {name}' }, {})).toBe('Hi {name}');
    expect(tr(undefined)).toBe('');
    expect(tr('plain')).toBe('plain');
  });
});
