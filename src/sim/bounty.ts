import { Rng, hashString } from '@/core/rng';
import { CREATURES, type CreatureId } from '@/data/creatures';
import { BOUNTIES, type Wanted } from '@/data/bounties';
import { ITEMS, isItemId, type ItemId } from '@/data/items';
import type { NpcId } from '@/data/npcs';
import { NPC_IDS } from '@/data/npcs';
import { addItem, countItem, removeItem } from '@/sim/inventory';
import type { Session, Step } from '@/sim/session';
import { say } from '@/sim/sessionKit';
import { withStory } from '@/sim/storySession';

/** A job a trader posted and the hero took: what is wanted, how many, the pay, and the kills counted so far when it began. */
export interface Bounty {
  npc: NpcId;
  kind: 'hunt' | 'fetch';
  target: string;
  n: number;
  reward: number;
  /** The kill counter when the bounty was taken (hunts count only what follows). */
  base: number;
  day: number;
}

const killKey = (target: string): string => `kill:${target}`;

/** The job a trader offers on a given day: the same seed, trader and day always give the same job (nothing when they post none). */
export function offerFor(seed: number, npc: NpcId, day: number): Omit<Bounty, 'base'> | null {
  const pool = BOUNTIES[npc];
  if (!pool || pool.length === 0) return null;
  const rng = new Rng(hashString(`${seed}:bounty:${npc}:${day}`));
  const w: Wanted = rng.pick([...pool]);
  const n = rng.int(w.min, w.max);
  // A fetch pays a little less than a hunt per unit of risk, but never less than the goods are worth to the trader.
  return { npc, kind: w.kind, target: w.target, n, reward: Math.round(n * w.unit * 1.3), day };
}

/** How far the active bounty has come, as `[have, need]`. */
export function bountyProgress(s: Session): readonly [number, number] | null {
  const b = s.bounty;
  if (!b) return null;
  const have = b.kind === 'hunt' ? (s.quests.counters[killKey(b.target)] ?? 0) - b.base : isItemId(b.target) ? countItem(s.inventory, b.target) : 0;
  return [Math.max(0, Math.min(b.n, have)), b.n];
}

/** Take the trader's job of the day. Only one at a time, and a trader gives only one job a day. */
export function acceptBounty(s: Session, npc: NpcId): Step {
  if (s.bounty) return { session: s, fx: [say('msgBountyBusy')] };
  if ((s.quests.counters[`bountyday:${npc}`] ?? 0) === s.clock.day) return { session: s, fx: [say('msgBountyDone')] };
  const offer = offerFor(s.seed, npc, s.clock.day);
  if (!offer) return { session: s, fx: [] };
  const base = offer.kind === 'hunt' ? (s.quests.counters[killKey(offer.target)] ?? 0) : 0;
  return { session: { ...s, bounty: { ...offer, base } }, fx: [say('msgBountyTaken')] };
}

/** Give the job up. */
export function dropBounty(s: Session): Session {
  return s.bounty ? { ...s, bounty: null } : s;
}

/** Hand in the finished job: the goods are taken, the gold paid, and the trader will not post another until tomorrow. */
export function turnInBounty(s: Session): Step {
  const b = s.bounty;
  const p = bountyProgress(s);
  if (!b || !p || p[0] < p[1]) return { session: s, fx: [] };
  let inventory = s.inventory;
  if (b.kind === 'fetch') {
    const paid = removeItem(inventory, b.target as ItemId, b.n);
    if (!paid) return { session: s, fx: [] };
    inventory = paid;
  }
  const got = addItem(inventory, 'gold', b.reward);
  if (got.left > 0) return { session: s, fx: [say('msgFull')] };
  const quests = { ...s.quests, counters: { ...s.quests.counters, [`bountyday:${b.npc}`]: s.clock.day } };
  return withStory(
    { session: { ...s, inventory: got.inv, bounty: null, quests }, fx: [{ t: 'gain', item: 'gold', qty: b.reward }] },
    ['bounty'],
  );
}

/** What the job asks, as a name key and quantity for the board. */
export function wantedName(b: Pick<Bounty, 'kind' | 'target'>): string {
  return b.kind === 'hunt' ? (CREATURES[b.target as CreatureId]?.temper === 'boss' ? `boss_${b.target}` : `creature_${b.target}`) : `item_${b.target}`;
}

/** Validate a saved bounty. */
export function parseBounty(raw: unknown): Bounty | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const d = raw as Record<string, unknown>;
  const npc = NPC_IDS.find((id) => id === d.npc);
  if (!npc || (d.kind !== 'hunt' && d.kind !== 'fetch') || typeof d.target !== 'string') return null;
  if (d.kind === 'hunt' ? !(d.target in CREATURES) : !isItemId(d.target) || !ITEMS[d.target]) return null;
  const int = (v: unknown, min: number, max: number): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null);
  const n = int(d.n, 1, 500);
  const reward = int(d.reward, 1, 100000);
  const base = int(d.base, 0, 1_000_000);
  const day = int(d.day, 1, 1_000_000);
  if (n === null || reward === null || base === null || day === null) return null;
  return { npc, kind: d.kind, target: d.target, n, reward, base, day };
}
