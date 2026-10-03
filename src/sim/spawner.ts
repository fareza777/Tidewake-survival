import type { Rng } from '@/core/rng';
import { CREATURES, isHostileKind, spawnWeights } from '@/data/creatures';
import { STRUCTURES } from '@/data/structures';
import { newCreature, type Creature } from '@/sim/creatures';
import type { Vec } from '@/sim/movement';
import type { Structures } from '@/sim/structures';
import { T, idx, inBounds, type Biome, type World } from '@/sim/world/types';

/** New creatures appear this far from the hero (tiles): beyond the edge of a portrait screen, but not far away. */
export const SPAWN_MIN = 12;
export const SPAWN_MAX = 18;
/** Creatures farther than this from the hero are removed. */
export const DESPAWN_RADIUS = 30;
/** Seconds between attempts to add a creature. */
export const SPAWN_INTERVAL = 1.5;
/** No monster appears within this many tiles of the shipwreck, and the glow of a fire adds a little extra. */
export const START_SAFE_RADIUS = 10;
const GLOW_MARGIN = 1.5;
const TRIES = 12;
const MIN_GAP = 0.8;

export interface Caps {
  hostile: number;
  animals: number;
}

export const capsFor = (night: boolean): Caps => (night ? { hostile: 9, animals: 3 } : { hostile: 4, animals: 8 });

export interface SpawnContext {
  world: World;
  solids: ReadonlySet<number>;
  structures: Structures;
  hero: Vec;
  night: boolean;
  creatures: readonly Creature[];
  nextId: number;
  rng: Rng;
}

const GROUND: ReadonlySet<number> = new Set([T.SAND, T.GRASS, T.SWAMP, T.DIRT, T.STONE, T.DESERT]);

/** Monsters keep away from the starting beach and from anything that gives light (campfires, torches, furnaces). */
export function hostileSpotOk(world: World, structures: Structures, x: number, y: number): boolean {
  if (Math.hypot(x + 0.5 - world.start.x, y + 0.5 - world.start.y) < START_SAFE_RADIUS) return false;
  return structures.list.every((s) => {
    const glow = STRUCTURES[s.type].light;
    return glow <= 0 || Math.hypot(x - s.x, y - s.y) > glow + GLOW_MARGIN;
  });
}

function spotFree(c: SpawnContext, x: number, y: number): boolean {
  if (!inBounds(Math.floor(x), Math.floor(y), c.world.size)) return false;
  const tile = idx(Math.floor(x), Math.floor(y), c.world.size);
  if (!GROUND.has(c.world.terrain[tile]) || c.solids.has(tile)) return false;
  return c.creatures.every((o) => Math.hypot(o.x - x, o.y - y) > MIN_GAP);
}

/** Try to add one creature in the ring around the hero, or return null (nothing fits, or the caps are reached). */
export function trySpawn(c: SpawnContext): Creature | null {
  const caps = capsFor(c.night);
  const hostile = c.creatures.filter((o) => isHostileKind(o.kind)).length;
  const animals = c.creatures.length - hostile;
  for (let i = 0; i < TRIES; i++) {
    const angle = c.rng.float(0, Math.PI * 2);
    const radius = c.rng.float(SPAWN_MIN, SPAWN_MAX);
    const x = c.hero.x + Math.cos(angle) * radius;
    const y = c.hero.y + Math.sin(angle) * radius;
    if (!spotFree(c, x, y)) continue;
    const biome = c.world.biome[idx(Math.floor(x), Math.floor(y), c.world.size)] as Biome;
    const roster = spawnWeights(biome, c.night).filter(([id]) => (isHostileKind(id) ? hostile < caps.hostile : animals < caps.animals));
    if (roster.length === 0) continue;
    const kind = c.rng.weighted(roster);
    if (isHostileKind(kind) && !hostileSpotOk(c.world, c.structures, Math.floor(x), Math.floor(y))) continue;
    return newCreature(c.nextId, kind, x, y, c.rng);
  }
  return null;
}

/** Drop creatures that are far away, and let the night's creatures fade at dawn once they are out of the hero's sight. */
export function cull(creatures: readonly Creature[], hero: Vec, night: boolean): Creature[] {
  return creatures.filter((c) => {
    const d = Math.hypot(c.x - hero.x, c.y - hero.y);
    if (d > DESPAWN_RADIUS) return false;
    return night || CREATURES[c.kind].spawn.when !== 'night' || d <= SPAWN_MIN;
  });
}
