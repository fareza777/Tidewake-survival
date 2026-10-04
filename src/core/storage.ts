import type { StorageLike } from '@/core/save';

/** The browser's localStorage, or null when it is blocked (private windows, some webviews). */
export function browserStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
