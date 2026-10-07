import { emptyFarm, type Farm } from '@/sim/farm';
import { emptyGather, type GatherState } from '@/sim/gather';
import type { Dungeons } from '@/sim/dungeon/progress';
import type { Vec } from '@/sim/movement';
import type { Structures } from '@/sim/structures';
import { generateWorld } from '@/sim/world/generate';
import { generateOuter } from '@/sim/world/outer';
import type { IslandId, World } from '@/sim/world/types';

/** The islands of the archipelago, in the order the hero reaches them. */
export const ISLAND_IDS: readonly IslandId[] = ['home', 'frost', 'ember', 'wreck', 'sky'];

export const isIslandId = (v: unknown): v is IslandId => typeof v === 'string' && (ISLAND_IDS as readonly string[]).includes(v);

/** What the hero has done on an island he is not standing on: the nodes he cut, what he built and tilled, where he wakes. */
export interface Stash {
  gather: GatherState;
  structures: Structures;
  farm: Farm;
  respawn: Vec;
}
export type Stashes = Partial<Record<IslandId, Stash>>;

export const freshStash = (start: { x: number; y: number }): Stash => ({
  gather: emptyGather(), structures: { next: 1, list: [] }, farm: emptyFarm(), respawn: { x: start.x + 0.5, y: start.y + 0.5 },
});

/**
 * Which islands the sea route reaches: the frozen and the burning islands as soon as there is a boat, the wreck once one
 * of those two bosses has fallen, the sky island once all three of the others are conquered.
 */
export function islandUnlocked(d: Dungeons, id: IslandId): boolean {
  switch (id) {
    case 'home':
    case 'frost':
    case 'ember': return true;
    case 'wreck': return d.frostcave.boss || d.magmaforge.boss;
    case 'sky': return d.frostcave.boss && d.magmaforge.boss && d.drownedcrypt.boss;
  }
}

/** What an island is waiting for, as a text key (empty when it is open). */
export function islandNeeds(d: Dungeons, id: IslandId): string | null {
  if (islandUnlocked(d, id)) return null;
  return id === 'wreck' ? 'needsOneBoss' : 'needsThreeBosses';
}

let homeMemo: { seed: number; world: World } | null = null;

/** The ground of an island (generated from the world seed; generated once and reused). */
export function worldFor(seed: number, id: IslandId): World {
  if (id !== 'home') return generateOuter(seed, id);
  if (homeMemo?.seed === seed) return homeMemo.world;
  const world = generateWorld(seed);
  homeMemo = { seed, world };
  return world;
}
