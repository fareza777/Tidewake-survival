import { Rng, hashString } from '@/core/rng';
import { BOTTLES, TABLETS } from '@/data/lore';
import { NPCS, NPC_IDS, type NpcId } from '@/data/npcs';
import { nodesByTile, propSolidTiles } from '@/sim/solids';
import type { QuestState } from '@/sim/quests';
import { B, T, idx, inBounds, type World } from './types';

/** Things lying about the island that the hero can use: a lost cat, bottles on the beach, old tablets, buried treasure. */
export type SpotKind = 'cat' | 'bottle' | 'tablet' | 'treasure';

export interface Spot {
  /** `bottle:1`, `tablet:3`, `treasure:2`, `cat`: also what the quest log remembers as found. */
  id: string;
  kind: SpotKind;
  x: number;
  y: number;
}

export interface NpcPlace {
  id: NpcId;
  x: number;
  y: number;
}

export const GROUND: ReadonlySet<number> = new Set([T.SAND, T.GRASS, T.DIRT, T.STONE, T.DESERT, T.SWAMP]);
const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by);

/** Tiles where nothing may be put: scenery, trees and rocks. */
function blockedTiles(world: World): Set<number> {
  return new Set([...propSolidTiles(world), ...nodesByTile(world).keys()]);
}

/** The nearest dry, free tile to (x, y), searching outwards ring by ring. */
function freeNear(world: World, x: number, y: number, taken: ReadonlySet<number>): { x: number; y: number } {
  for (let r = 0; r < 24; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = x + dx;
        const ty = y + dy;
        if (!inBounds(tx, ty, world.size)) continue;
        const i = idx(tx, ty, world.size);
        if (GROUND.has(world.terrain[i]) && !taken.has(i)) return { x: tx, y: ty };
      }
    }
  }
  return { x, y };
}

const placesCache = new WeakMap<World, NpcPlace[]>();
const spotsCache = new WeakMap<World, Spot[]>();

/** Where each islander stands: beside their landmark, on the nearest free ground. Same island, same places. */
export function npcPlaces(world: World): NpcPlace[] {
  const cached = placesCache.get(world);
  if (cached) return cached;
  const taken = blockedTiles(world);
  const out: NpcPlace[] = [];
  for (const id of NPC_IDS) {
    const def = NPCS[id];
    const l = world.landmarks.find((m) => m.id === def.near)!;
    const p = freeNear(world, l.x + def.dx, l.y + def.dy, taken);
    taken.add(idx(p.x, p.y, world.size));
    out.push({ id, x: p.x, y: p.y });
  }
  placesCache.set(world, out);
  return out;
}

/** Choose `count` tiles from `candidates` at least `spacing` apart (relaxing the spacing when the island is small). */
function spread(candidates: readonly number[], size: number, count: number, spacing: number, rng: Rng, avoid: readonly Spot[]): number[] {
  const chosen: number[] = [];
  for (let relax = 1; relax >= 0.25 && chosen.length < count; relax /= 2) {
    const pool = [...candidates];
    while (pool.length && chosen.length < count) {
      const i = pool.splice(rng.int(0, pool.length - 1), 1)[0];
      const x = i % size;
      const y = Math.floor(i / size);
      const far = (a: number, b: number) => dist(x, y, a, b) >= spacing * relax;
      if (chosen.every((c) => far(c % size, Math.floor(c / size))) && avoid.every((s) => far(s.x, s.y))) chosen.push(i);
    }
  }
  return chosen;
}

/** Every find on the island, placed from the seed: three treasure spots, four tablets, five bottles and one cat. */
export function spotsOf(world: World): Spot[] {
  const cached = spotsCache.get(world);
  if (cached) return cached;
  const size = world.size;
  const taken = blockedTiles(world);
  for (const p of npcPlaces(world)) taken.add(idx(p.x, p.y, size));
  const rng = new Rng(hashString(`${world.seed}:spots`));
  const land = (id: string) => world.landmarks.find((l) => l.id === id)!;
  const out: Spot[] = [];
  const put = (id: string, kind: SpotKind, x: number, y: number) => {
    out.push({ id, kind, x, y });
    taken.add(idx(x, y, size));
  };
  for (const k of [1, 2, 3]) {
    const l = land(`treasure${k}`);
    const p = freeNear(world, l.x, l.y, taken);
    put(`treasure:${k}`, 'treasure', p.x, p.y);
  }
  const tab = land('tablets');
  [[-2, -1], [2, -1], [-2, 2], [2, 2]].slice(0, TABLETS.length).forEach(([dx, dy], i) => {
    const p = freeNear(world, tab.x + dx, tab.y + dy, taken);
    put(`tablet:${i + 1}`, 'tablet', p.x, p.y);
  });
  const start = world.start;
  const near = (i: number, min: number, max: number): boolean => {
    const x = i % size;
    const y = Math.floor(i / size);
    const d = dist(x, y, start.x, start.y);
    return d >= min && d <= max && world.landmarks.every((l) => dist(x, y, l.x, l.y) >= 5);
  };
  const free = (i: number) => !taken.has(i);
  const beach: number[] = [];
  const grass: number[] = [];
  for (let i = 0; i < size * size; i++) {
    if (!free(i)) continue;
    if (world.terrain[i] === T.SAND && near(i, 9, 200)) beach.push(i);
    else if (world.terrain[i] === T.GRASS && world.biome[i] === B.FOREST && near(i, 12, 40)) grass.push(i);
  }
  spread(beach, size, BOTTLES.length, 20, rng, out).forEach((i, n) => put(`bottle:${n + 1}`, 'bottle', i % size, Math.floor(i / size)));
  const cat = spread(grass, size, 1, 10, rng, out)[0];
  const c = cat === undefined ? freeNear(world, start.x + 12, start.y - 8, taken) : { x: cat % size, y: Math.floor(cat / size) };
  put('cat', 'cat', c.x, c.y);
  spotsCache.set(world, out);
  return out;
}

/** The finds not yet used up. */
export function visibleSpots(all: readonly Spot[], q: QuestState): Spot[] {
  return all.filter((s) => !q.found.includes(s.id));
}

/** The find on the tile in front of the hero, or on the tile he stands on. */
export function spotAt(spots: readonly Spot[], front: { x: number; y: number }, hero: { x: number; y: number }): Spot | null {
  const hx = Math.floor(hero.x);
  const hy = Math.floor(hero.y);
  return spots.find((s) => (s.x === front.x && s.y === front.y) || (s.x === hx && s.y === hy)) ?? null;
}

/** The islander standing on a tile. */
export function npcAt(places: readonly NpcPlace[], x: number, y: number): NpcId | null {
  return places.find((p) => p.x === x && p.y === y)?.id ?? null;
}
