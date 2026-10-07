import { Rng, hashString } from '@/core/rng';
import { ITEMS, isItemId, type ItemId } from '@/data/items';
import { JOBS, JOB_DEFS, MAX_SETTLERS, STORE_CAP, hireCost, isJob, type Job } from '@/data/settlers';
import { addItem, removeItem, type Inventory } from '@/sim/inventory';
import type { Session, Step } from '@/sim/session';
import { say } from '@/sim/sessionKit';
import { withStory } from '@/sim/storySession';

/** What the settlers have brought in and nobody has taken yet. */
export type Store = Readonly<Record<string, number>>;

export const emptyStore = (): Store => ({});

/** The settlers' work for one day, added to the store (each kind is capped). Deterministic for a given seed and day. */
export function produceDay(s: Session): Session {
  if (s.settlers.length === 0) return s;
  const rng = new Rng(hashString(`${s.seed}:settlers:${s.clock.day}`));
  const store: Record<string, number> = { ...s.store };
  for (const job of s.settlers) {
    for (const o of JOB_DEFS[job].output) {
      if (o.chance !== undefined && !rng.chance(o.chance)) continue;
      const n = rng.int(o.min, o.max);
      if (n > 0) store[o.item] = Math.min(STORE_CAP, (store[o.item] ?? 0) + n);
    }
  }
  return { ...s, store };
}

/** Take on a settler of this trade for gold. Nothing changes when the camp is full or the gold is short. */
export function hire(s: Session, job: Job): Step {
  if (s.settlers.length >= MAX_SETTLERS) return { session: s, fx: [say('msgCampFull')] };
  const paid = removeItem(s.inventory, 'gold', hireCost(s.settlers.length));
  if (!paid) return { session: s, fx: [say('msgNoGold')] };
  return withStory({ session: { ...s, inventory: paid, settlers: [...s.settlers, job] }, fx: [say('msgHired')] }, ['hire']);
}

/** Move what the store holds into the backpack; whatever does not fit stays in the store. */
export function collectStore(s: Session): Step {
  let inv: Inventory = s.inventory;
  const left: Record<string, number> = {};
  let moved = 0;
  for (const [item, qty] of Object.entries(s.store)) {
    if (!isItemId(item) || qty <= 0) continue;
    const r = addItem(inv, item as ItemId, qty);
    inv = r.inv;
    moved += qty - r.left;
    if (r.left > 0) left[item] = r.left;
  }
  if (moved === 0) return { session: s, fx: Object.keys(s.store).length > 0 ? [say('msgFull')] : [] };
  const fx = Object.keys(left).length > 0 ? [say('msgFull')] : [];
  return { session: { ...s, inventory: inv, store: left }, fx: [{ t: 'say', key: 'msgCollected', vars: { n: moved } }, ...fx] };
}

/** Validate the settlers and their store from a save. */
export function parseSettlers(raw: unknown): Job[] {
  return Array.isArray(raw) ? raw.filter(isJob).slice(0, MAX_SETTLERS) : [];
}

export function parseStore(raw: unknown): Store {
  const out: Record<string, number> = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  for (const [item, qty] of Object.entries(raw)) {
    if (isItemId(item) && ITEMS[item] && typeof qty === 'number' && Number.isInteger(qty) && qty > 0) out[item] = Math.min(STORE_CAP, qty);
  }
  return out;
}

export { JOBS };
