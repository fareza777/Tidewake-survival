/** The three dungeons, one per region of the island. */
export const DUNGEON_IDS = ['grotto', 'deepmine', 'ruin'] as const;
export type DungeonId = (typeof DUNGEON_IDS)[number];

/** Bumped whenever the dungeon generator changes: progress saved under another version no longer fits the layout. */
export const DUNGEON_VERSION = 1;

export const isDungeonId = (v: unknown): v is DungeonId => typeof v === 'string' && (DUNGEON_IDS as readonly string[]).includes(v);

/**
 * What the hero has changed inside one dungeon, by the numeric ids the generator gives its doors, chests, rooms and
 * crystals. Saved with the game; the dungeon itself is regenerated from the world seed.
 */
export interface DungeonProgress {
  /** Doors that stay open. */
  readonly opened: readonly number[];
  /** Chests that have been emptied. */
  readonly looted: readonly number[];
  /** Rooms whose puzzle is solved or whose monsters are all dead. */
  readonly solved: readonly number[];
  /** Crystals that have been struck. */
  readonly lit: readonly number[];
  /** The boss is dead. */
  readonly boss: boolean;
}

export type Dungeons = Readonly<Record<DungeonId, DungeonProgress>>;

const MAX_IDS = 200;

export const emptyProgress = (): DungeonProgress => ({ opened: [], looted: [], solved: [], lit: [], boss: false });

export const emptyDungeons = (): Dungeons => ({ grotto: emptyProgress(), deepmine: emptyProgress(), ruin: emptyProgress() });

/** The list with `id` added, or the very same list when it is already there. */
export function addUnique(list: readonly number[], id: number): readonly number[] {
  return list.includes(id) ? list : [...list, id];
}

function parseIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  for (const v of raw as unknown[]) {
    if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 100_000 && !out.includes(v)) out.push(v);
    if (out.length >= MAX_IDS) break;
  }
  return out;
}

/** Validate untrusted JSON into dungeon progress; anything unreadable becomes "nothing done yet". */
export function parseDungeons(raw: unknown): Dungeons {
  const d = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const one = (id: DungeonId): DungeonProgress => {
    const p = d[id];
    if (typeof p !== 'object' || p === null) return emptyProgress();
    const r = p as Record<string, unknown>;
    return { opened: parseIds(r.opened), looted: parseIds(r.looted), solved: parseIds(r.solved), lit: parseIds(r.lit), boss: r.boss === true };
  };
  return { grotto: one('grotto'), deepmine: one('deepmine'), ruin: one('ruin') };
}
