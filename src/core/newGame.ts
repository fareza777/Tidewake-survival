import { codeToSeed, hashString } from '@/core/rng';

export const NAME_MAX = 12;
export const DEFAULT_NAME = 'Castaway';

/** A hero name from whatever was typed: letters, digits, spaces, hyphens and apostrophes only, trimmed and shortened. */
export function cleanName(raw: string | null | undefined): string {
  const name = (raw ?? '').replace(/[^\p{L}\p{N} '-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim();
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
