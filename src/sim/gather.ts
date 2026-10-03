import type { Rng } from '@/core/rng';
import { RESOURCES, type DropId } from '@/data/resources';
import type { ResourceNode } from '@/sim/world/types';

/** Days a destroyed node takes to grow back. */
export const RESPAWN_DAYS = 3;

/**
 * The player's changes to the generated world, stored as a diff so a save never has to hold the whole island:
 * `hp` is remaining hit points of damaged nodes, `gone` maps a destroyed node id to the day it was destroyed.
 */
export interface GatherState {
  readonly hp: Readonly<Record<number, number>>;
  readonly gone: Readonly<Record<number, number>>;
}

export interface DropResult {
  item: DropId;
  amount: number;
}

export interface HitResult {
  state: GatherState;
  drops: DropResult[];
  destroyed: boolean;
}

export const emptyGather = (): GatherState => ({ hp: {}, gone: {} });

export const isAlive = (s: GatherState, id: number): boolean => !(id in s.gone);

export function hitNode(state: GatherState, node: ResourceNode, damage: number, day: number, rng: Rng): HitResult {
  if (!isAlive(state, node.id) || damage <= 0) return { state, drops: [], destroyed: false };
  const def = RESOURCES[node.kind];
  const left = (state.hp[node.id] ?? def.hp) - damage;
  if (left > 0) return { state: { hp: { ...state.hp, [node.id]: left }, gone: state.gone }, drops: [], destroyed: false };
  const { [node.id]: _removed, ...hp } = state.hp;
  const drops = def.drops
    .map((d) => ({ item: d.item, amount: rng.int(d.min, d.max) }))
    .filter((d) => d.amount > 0);
  return { state: { hp, gone: { ...state.gone, [node.id]: day } }, drops, destroyed: true };
}

/**
 * Call when a new in-game day starts: damaged nodes heal and nodes destroyed RESPAWN_DAYS ago grow back.
 * `keepGone(id)` lets the caller postpone a regrowth (for example while the player stands on that tile).
 */
export function startNewDay(state: GatherState, day: number, keepGone: (id: number) => boolean = () => false): GatherState {
  const gone: Record<number, number> = {};
  for (const [key, since] of Object.entries(state.gone)) {
    const id = Number(key);
    if (day - since < RESPAWN_DAYS || keepGone(id)) gone[id] = since;
  }
  return { hp: {}, gone };
}
