/** Day/night clock. Pure: every function returns a new value and never mutates its input. */

/** Real seconds in one in-game day. */
export const DAY_SECONDS = 600;
/** The first morning starts a fifth of the way through the day (about 10:48). */
export const START_FRACTION = 0.2;
/** Peak darkness of the night overlay (0..1). */
export const NIGHT_DARKNESS = 0.85;

const DAWN_END = 0.1;
const DUSK_START = 0.6;
const NIGHT_START = 0.7;

export type Phase = 'dawn' | 'day' | 'dusk' | 'night';

export interface Clock {
  /** 1-based day counter. */
  readonly day: number;
  /** Seconds since dawn of the current day, in [0, DAY_SECONDS). */
  readonly t: number;
}

export const newClock = (): Clock => ({ day: 1, t: DAY_SECONDS * START_FRACTION });

export function advance(c: Clock, dt: number): Clock {
  let t = c.t + Math.max(0, dt);
  let day = c.day;
  while (t >= DAY_SECONDS) {
    t -= DAY_SECONDS;
    day += 1;
  }
  return { day, t };
}

const fraction = (c: Clock): number => c.t / DAY_SECONDS;

export function phaseOf(c: Clock): Phase {
  const f = fraction(c);
  if (f < DAWN_END) return 'dawn';
  if (f < DUSK_START) return 'day';
  if (f < NIGHT_START) return 'dusk';
  return 'night';
}

/** 0 in full daylight, rising through dusk to NIGHT_DARKNESS, falling back to 0 through dawn. */
export function darkness(c: Clock): number {
  const f = fraction(c);
  if (f < DAWN_END) return NIGHT_DARKNESS * (1 - f / DAWN_END);
  if (f < DUSK_START) return 0;
  if (f < NIGHT_START) return NIGHT_DARKNESS * ((f - DUSK_START) / (NIGHT_START - DUSK_START));
  return NIGHT_DARKNESS;
}

function lerpColor(a: number, b: number, k: number): number {
  const ch = (shift: number) => Math.round(((a >> shift) & 255) * (1 - k) + ((b >> shift) & 255) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Overlay for the world: a colour and an alpha to draw over everything except the HUD. */
export function lighting(c: Clock): { color: number; alpha: number } {
  const d = darkness(c);
  // Warm purple glow at the middle of dawn and dusk, deep blue at night.
  const warmth = d > 0 && d < NIGHT_DARKNESS ? 1 - Math.abs(d / NIGHT_DARKNESS - 0.5) * 2 : 0;
  return { color: lerpColor(0x0a1030, 0x7a3a50, warmth), alpha: d * 0.78 };
}

/** The hero can only sleep once evening has come. */
export const canSleep = (c: Clock): boolean => phaseOf(c) === 'dusk' || phaseOf(c) === 'night';

/** Wake up at dawn of the next day. */
export const wakeUp = (c: Clock): Clock => ({ day: c.day + 1, t: 0 });

/** "HH:MM" time of day; the day starts at 06:00 with dawn. */
export function clockLabel(c: Clock): string {
  const minutes = Math.floor((6 * 60 + fraction(c) * 24 * 60) % (24 * 60));
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}
