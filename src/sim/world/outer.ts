import { Rng, hashString } from '@/core/rng';
import { keepLargestLand } from './terrain';
import { fbm } from './noise';
import { scatterResources } from './resources';
import { reachable } from './generate';
import {
  B, T, WORLD_SIZE, idx, inBounds, isWater, type Biome, type IslandId, type Landmark, type LandmarkId, type World,
} from './types';

/** The far islands, their size, their one biome and the dungeon each hides. */
export type OuterId = Exclude<IslandId, 'home'>;

interface OuterSpec {
  size: number;
  radius: number;
  biome: Biome;
  dungeon: Extract<LandmarkId, 'frostcave' | 'magmaforge' | 'drownedcrypt' | 'skyspire'>;
}

export const OUTER: Record<OuterId, OuterSpec> = {
  frost: { size: WORLD_SIZE, radius: 52, biome: B.FROST, dungeon: 'frostcave' },
  ember: { size: WORLD_SIZE, radius: 52, biome: B.VOLCANO, dungeon: 'magmaforge' },
  wreck: { size: WORLD_SIZE, radius: 56, biome: B.WRECK, dungeon: 'drownedcrypt' },
  sky: { size: WORLD_SIZE, radius: 56, biome: B.SKY, dungeon: 'skyspire' },
};

const MAX_ATTEMPTS = 24;
const SEA_LEVEL = 0.3;
const SHALLOW_LEVEL = 0.22;
const SAND_LEVEL = 0.36;
const ROCK_LEVEL = 0.56;

/** What the ground is at a place of height `h`, by island. */
function groundFor(id: OuterId, seed: number, x: number, y: number, h: number): number {
  const patch = fbm(seed + 31, x, y, 11, 3);
  if (h < SAND_LEVEL) return T.SAND;
  switch (id) {
    case 'frost':
      return h > ROCK_LEVEL + 0.06 && patch > 0.45 ? T.STONE : T.SNOW;
    case 'ember':
      if (h > 0.46 && fbm(seed + 53, x, y, 9, 2) > 0.7) return T.LAVA;
      return h > ROCK_LEVEL && patch > 0.4 ? T.STONE : T.ASH;
    case 'wreck':
      return patch > 0.62 ? T.SWAMP : patch < 0.3 ? T.SAND : T.DIRT;
    case 'sky':
      return h > ROCK_LEVEL && patch > 0.5 ? T.STONE : T.GRASS;
  }
}

function shape(id: OuterId, seed: number): { terrain: Uint8Array; biome: Uint8Array; size: number } {
  const { size, radius, biome: b } = OUTER[id];
  const c = size / 2;
  const terrain = new Uint8Array(size * size);
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c) / radius;
      const n = fbm(seed, x, y, 30, 4);
      const h = 0.62 * (1 - Math.pow(Math.min(d, 1.4), 1.6)) + 0.38 * n;
      height[idx(x, y, size)] = h;
      terrain[idx(x, y, size)] = h > SEA_LEVEL ? T.GRASS : h > SHALLOW_LEVEL ? T.SHALLOW : T.DEEP;
    }
  }
  keepLargestLand(terrain, height, size);
  const biome = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = idx(x, y, size);
      if (isWater(terrain[i])) continue;
      biome[i] = b;
      terrain[i] = groundFor(id, seed, x, y, height[i]);
    }
  }
  return { terrain, biome, size };
}

const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by);

function footprintIsLand(terrain: Uint8Array, size: number, x: number, y: number, half: number): boolean {
  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      if (!inBounds(x + dx, y + dy, size)) return false;
      const t = terrain[idx(x + dx, y + dy, size)];
      if (isWater(t) || t === T.LAVA) return false;
    }
  }
  return true;
}

/** Landing beach in the south, the dock beside it and the dungeon far inland; null when this shape cannot host them. */
function placeOuterLandmarks(id: OuterId, terrain: Uint8Array, size: number, rng: Rng): Landmark[] | null {
  const c = size / 2;
  let start: { x: number; y: number } | null = null;
  let best = -Infinity;
  for (let y = 4; y < size - 4; y++) {
    for (let x = 6; x < size - 6; x++) {
      if (terrain[idx(x, y, size)] !== T.SAND || !footprintIsLand(terrain, size, x, y, 3)) continue;
      if (!isWater(terrain[idx(x, y + 5, size)] ?? T.DEEP)) continue;
      const score = y * 1000 - Math.abs(x - c);
      if (score > best) {
        best = score;
        start = { x, y };
      }
    }
  }
  if (!start) return null;
  const b = OUTER[id].biome;
  const dock = { x: start.x + 3, y: start.y };
  if (!footprintIsLand(terrain, size, dock.x, dock.y, 1)) return null;
  const placed: Landmark[] = [
    { id: 'start', x: start.x, y: start.y, biome: b },
    { id: 'dock', x: dock.x, y: dock.y, biome: b },
  ];
  const spot: { x: number; y: number }[] = [];
  for (let y = 6; y < size - 6; y++) {
    for (let x = 6; x < size - 6; x++) {
      const d = dist(x, y, start.x, start.y);
      if (d < 24 || d > 60 || !footprintIsLand(terrain, size, x, y, 2)) continue;
      if (terrain[idx(x, y, size)] === T.SAND) continue;
      spot.push({ x, y });
    }
  }
  if (!spot.length) return null;
  const pick = rng.fork('dungeon').pick(spot);
  placed.push({ id: OUTER[id].dungeon, x: pick.x, y: pick.y, biome: b });
  return placed;
}

/** Problems that make an island unplayable (empty when fine). */
export function validateOuter(w: World): string[] {
  const problems: string[] = [];
  const seen = reachable(w.terrain, w.size, w.start);
  for (const l of w.landmarks) {
    const i = idx(l.x, l.y, w.size);
    if (isWater(w.terrain[i])) problems.push(`${l.id} is in water`);
    else if (!seen[i]) problems.push(`${l.id} is unreachable`);
  }
  let land = 0;
  for (let i = 0; i < w.terrain.length; i++) if (!isWater(w.terrain[i]) && w.terrain[i] !== T.LAVA) land++;
  if (land < 900) problems.push(`only ${land} land tiles`);
  return problems;
}

const cache = new Map<string, World>();

/** Deterministic far island: the same world seed and island always give the same ground. */
export function generateOuter(worldSeed: number, id: OuterId): World {
  const key = `${worldSeed}:${id}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const base = (worldSeed ^ hashString(`island:${id}`)) >>> 0;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const seed = (base + Math.imul(attempt, 7919)) >>> 0;
    const { terrain, biome, size } = shape(id, seed);
    const rng = new Rng(seed);
    const landmarks = placeOuterLandmarks(id, terrain, size, rng);
    if (!landmarks) continue;
    const start = landmarks.find((l) => l.id === 'start')!;
    const world: World = {
      island: id, seed: base, size, terrain, biome, landmarks, resources: scatterResources(terrain, biome, landmarks, size, rng),
      start: { x: start.x, y: start.y },
    };
    if (validateOuter(world).length === 0) {
      cache.set(key, world);
      return world;
    }
  }
  throw new Error(`generateOuter: no valid ${id} island for seed ${worldSeed}`);
}
