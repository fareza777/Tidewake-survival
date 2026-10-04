import type { StorageLike } from '@/core/save';

/** Things that are asked or shown once per install. */
export const FLAG_ONBOARDED = 'tidewake.onboarded';
export const FLAG_RATE_ASKED = 'tidewake.rateAsked';

export function readFlag(storage: StorageLike | null, key: string): boolean {
  try {
    return storage?.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function setFlag(storage: StorageLike | null, key: string): void {
  try {
    storage?.setItem(key, '1');
  } catch {
    // Storage is unavailable: the flag is simply not remembered.
  }
}
