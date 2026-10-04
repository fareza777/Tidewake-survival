import { codeToSeed, hashString } from '@/core/rng';

export const NAME_MAX = 12;
export const DEFAULT_NAME = 'Castaway';

/** The letters the game's bitmap font can draw besides A to Z, digits, space, hyphen and apostrophe. */
const DRAWABLE = /[^A-Za-z0-9 '\-\u00e0\u00e1\u00e4\u00e7\u00e8\u00e9\u00ed\u00f1\u00f3\u00f6\u00fa\u00fc]/g;

/** A hero name from whatever was typed: letters the font can draw, digits, spaces, hyphens and apostrophes only, trimmed and shortened. */
export function cleanName(raw: string | null | undefined): string {
  const name = (raw ?? '').replace(DRAWABLE, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim();
  return name === '' ? DEFAULT_NAME : name;
}

/**
 * The world seed from what was typed in New Game: random when empty, a number when it is digits, a world code (as shown
 * by the game) when it looks like one, and otherwise a hash of the words, so any phrase gives the same island every time.
 */
export function seedFromInput(raw: string | null | undefined, random: number): number {
  const text = (raw ?? '').trim();
  if (text === '') return random >>> 0;
  if (/^\d+$/.test(text)) return Number(text) >>> 0;
  if (/^[A-HJ-NP-Za-hj-np-z2-9]{7}$/.test(text)) return codeToSeed(text);
  return hashString(text.toLowerCase().replace(/\s+/g, ' ')) >>> 0;
}
