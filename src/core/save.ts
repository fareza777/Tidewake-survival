import { DAY_SECONDS, type Clock } from '@/sim/daynight';
import { emptyGather, type GatherState } from '@/sim/gather';

export const SAVE_VERSION = 1;
export const SLOT_COUNT = 3;
/** A save claiming more days than this is corrupt (real games last far fewer). */
const MAX_DAY = 1_000_000;

export type Difficulty = 'relaxed' | 'normal' | 'hardcore';
const DIFFICULTIES: readonly Difficulty[] = ['relaxed', 'normal', 'hardcore'];

/** Everything that survives closing the app. The island itself is regenerated from `seed`. */
export interface SaveSlot {
  version: number;
  slot: number;
  name: string;
  seed: number;
  difficulty: Difficulty;
  createdAt: number;
  updatedAt: number;
  playTimeSec: number;
  player: { x: number; y: number };
  /** Gathered materials by item id (the real inventory replaces this in a later phase). */
  bag: Record<string, number>;
  clock: Clock;
  gather: GatherState;
}

export interface SlotSummary {
  slot: number;
  name: string;
  day: number;
  playTimeSec: number;
  updatedAt: number;
  seed: number;
  difficulty: Difficulty;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function newSlot(
  slot: number, name: string, seed: number, difficulty: Difficulty, start: { x: number; y: number }, clock: Clock, now = Date.now(),
): SaveSlot {
  return {
    version: SAVE_VERSION, slot, name, seed, difficulty, createdAt: now, updatedAt: now, playTimeSec: 0,
    player: { x: start.x + 0.5, y: start.y + 0.5 },
    bag: {}, clock, gather: emptyGather(),
  };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isRecordOfNumbers = (v: unknown): v is Record<string, number> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && Object.values(v).every((n) => isNum(n) && n >= 0);

/** Validate untrusted JSON into a SaveSlot; null when it cannot be trusted (corrupt, or from a newer game version). */
export function parseSlot(raw: unknown, slot: number): SaveSlot | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const d = raw as Record<string, unknown>;
  if (!isNum(d.version) || d.version > SAVE_VERSION || !isNum(d.seed)) return null;
  const player = d.player as Record<string, unknown> | undefined;
  const clock = d.clock as Record<string, unknown> | undefined;
  if (!player || !isNum(player.x) || !isNum(player.y)) return null;
  if (!clock || !isNum(clock.day) || clock.day < 1 || clock.day > MAX_DAY) return null;
  // The time of day is always inside one day; a huge value would make the clock loop for ages.
  if (!isNum(clock.t) || clock.t < 0 || clock.t >= DAY_SECONDS) return null;
  const gather = d.gather as Record<string, unknown> | undefined;
  const bag = d.bag === undefined ? {} : d.bag;
  if (!isRecordOfNumbers(bag)) return null;
  const hp = gather?.hp ?? {};
  const gone = gather?.gone ?? {};
  if (!isRecordOfNumbers(hp) || !isRecordOfNumbers(gone)) return null;
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    slot,
    name: typeof d.name === 'string' && d.name.trim() ? d.name.trim().slice(0, 16) : 'Castaway',
    seed: d.seed >>> 0,
    difficulty: DIFFICULTIES.includes(d.difficulty as Difficulty) ? (d.difficulty as Difficulty) : 'normal',
    createdAt: isNum(d.createdAt) ? d.createdAt : now,
    updatedAt: isNum(d.updatedAt) ? d.updatedAt : now,
    playTimeSec: isNum(d.playTimeSec) && d.playTimeSec >= 0 ? d.playTimeSec : 0,
    player: { x: player.x, y: player.y },
    bag,
    clock: { day: Math.floor(clock.day), t: clock.t },
    gather: { hp, gone },
  };
}

const key = (slot: number): string => `tidewake.slot.${slot}`;
const backupKey = (slot: number): string => `${key(slot)}.bak`;

/** Three save slots on top of a localStorage-like store; every write keeps the previous copy as a backup. */
export class SaveStore {
  /** @param mirror optional durable copy (Capacitor Preferences on Android) written after every save. */
  constructor(private storage: StorageLike | null, private mirror?: (key: string, value: string) => void) {}

  private check(slot: number): void {
    if (!Number.isInteger(slot) || slot < 0 || slot >= SLOT_COUNT) throw new RangeError(`save slot ${slot} out of range`);
  }

  private read(k: string, slot: number): SaveSlot | null {
    try {
      const txt = this.storage?.getItem(k);
      return txt ? parseSlot(JSON.parse(txt), slot) : null;
    } catch {
      return null;
    }
  }

  load(slot: number): SaveSlot | null {
    this.check(slot);
    return this.read(key(slot), slot) ?? this.read(backupKey(slot), slot);
  }

  write(data: SaveSlot): void {
    this.check(data.slot);
    const txt = JSON.stringify({ ...data, updatedAt: Date.now() });
    try {
      const prev = this.storage?.getItem(key(data.slot));
      if (prev && parseSlot(JSON.parse(prev), data.slot)) this.storage?.setItem(backupKey(data.slot), prev);
      this.storage?.setItem(key(data.slot), txt);
    } catch (err) {
      console.error('[save] write failed', err);
    }
    this.mirror?.(key(data.slot), txt);
  }

  delete(slot: number): void {
    this.check(slot);
    this.storage?.removeItem(key(slot));
    this.storage?.removeItem(backupKey(slot));
  }

  list(): (SlotSummary | null)[] {
    return Array.from({ length: SLOT_COUNT }, (_, slot) => {
      const s = this.load(slot);
      return s ? { slot, name: s.name, day: s.clock.day, playTimeSec: s.playTimeSec, updatedAt: s.updatedAt, seed: s.seed, difficulty: s.difficulty } : null;
    });
  }

  /** Slot to resume: the most recently saved one, or null on a fresh install. */
  latest(): number | null {
    let best: SlotSummary | null = null;
    for (const s of this.list()) if (s && (!best || s.updatedAt > best.updatedAt)) best = s;
    return best ? best.slot : null;
  }

  /** Slot for a New Game: the first empty one, otherwise the least recently played (which it would overwrite). */
  slotForNewGame(): { slot: number; overwrites: boolean } {
    const list = this.list();
    const empty = list.findIndex((s) => s === null);
    if (empty >= 0) return { slot: empty, overwrites: false };
    let oldest = list[0]!;
    for (const s of list) if (s && s.updatedAt < oldest.updatedAt) oldest = s;
    return { slot: oldest.slot, overwrites: true };
  }

  /** Android can wipe localStorage under storage pressure; restore any slot the durable copy still has. */
  async restoreFromNative(read: (key: string) => Promise<string | null>): Promise<void> {
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      if (this.load(slot)) continue;
      try {
        const txt = await read(key(slot));
        if (txt && parseSlot(JSON.parse(txt), slot)) this.storage?.setItem(key(slot), txt);
      } catch (err) {
        console.warn('[save] native restore failed', err);
      }
    }
  }
}
