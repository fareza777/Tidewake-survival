import { SAVE_VERSION, newSlot, parseSlot, type Difficulty, type SaveSlot, type SlotSummary } from './saveData';

export { SAVE_VERSION, newSlot, parseSlot };
export type { Difficulty, SaveSlot, SlotSummary };

export const SLOT_COUNT = 3;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const key = (slot: number): string => `tidewake.slot.${slot}`;
const backupKey = (slot: number): string => `${key(slot)}.bak`;

/** Three save slots on top of a localStorage-like store; every write keeps the previous copy as a backup. */
export class SaveStore {
  /**
   * @param mirror optional durable copy (Capacitor Preferences on Android) written after every save.
   * @param unmirror removes a key from that durable copy; without it a deleted slot would be restored on the next start.
   */
  constructor(
    private storage: StorageLike | null,
    private mirror?: (key: string, value: string) => void,
    private unmirror?: (key: string) => void,
  ) {}

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
    this.unmirror?.(key(slot));
    this.unmirror?.(backupKey(slot));
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
