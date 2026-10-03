import { Rng } from '@/core/rng';
import { generateTerrain } from './terrain';
import { placeLandmarks } from './landmarks';
import { scatterResources } from './resources';
import { B, WORLD_SIZE, idx, inBounds, isWalkable, isWater, T, type World } from './types';

/**
 * Bump when a change to the generator would alter existing islands. Saves record it so that a changed island does not
 * silently scramble the resource nodes the player already harvested (node ids are positions in the scatter order).
 */
export const GENERATOR_VERSION = 1;

const MAX_ATTEMPTS = 24;
const MIN_BIOME_LAND = 400;
const LANDMARK_COUNT = 13;

/** Flood-fill walkable ground from `from`; returns the set of reachable tile indexes. */
export function reachable(terrain: Uint8Array, size: number, from: { x: number; y: number }): Uint8Array {
  const seen = new Uint8Array(size * size);
  const stack = [idx(from.x, from.y, size)];
  seen[stack[0]] = 1;
  while (stack.length) {
    const c = stack.pop()!;
    const x = c % size;
    const y = (c - x) / size;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny, size)) continue;
      const n = idx(nx, ny, size);
      if (!seen[n] && isWalkable(terrain[n])) {
        seen[n] = 1;
        stack.push(n);
      }
    }
  }
  return seen;
}

/** Human-readable problems; an empty list means the world is playable. */
export function validateWorld(w: World): string[] {
  const problems: string[] = [];
  if (w.landmarks.length !== LANDMARK_COUNT) problems.push(`expected ${LANDMARK_COUNT} landmarks, got ${w.landmarks.length}`);
  const seen = reachable(w.terrain, w.size, w.start);
  for (const l of w.landmarks) {
    const i = idx(l.x, l.y, w.size);
    if (isWater(w.terrain[i])) problems.push(`${l.id} is in water`);
    else if (!seen[i]) problems.push(`${l.id} is unreachable`);
  }
  if (w.terrain[idx(w.start.x, w.start.y, w.size)] !== T.SAND) problems.push('start is not on sand');
  for (const b of [B.FOREST, B.MOUNTAIN, B.SWAMP, B.DESERT]) {
    let n = 0;
    for (let i = 0; i < w.biome.length; i++) if (w.biome[i] === b && !isWater(w.terrain[i])) n++;
    if (n < MIN_BIOME_LAND) problems.push(`biome ${b} has only ${n} land tiles`);
  }
  return problems;
}

/** Deterministic: the same seed always yields the same island (re-rolling internally if a layout is unplayable). */
export function generateWorld(seed: number, size = WORLD_SIZE): World {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const s = (seed + Math.imul(attempt, 7919)) >>> 0;
    const { terrain, biome } = generateTerrain(s, size);
    const rng = new Rng(s);
    const landmarks = placeLandmarks(terrain, biome, size, rng);
    if (!landmarks) continue;
    const start = landmarks.find((l) => l.id === 'start')!;
    const world: World = {
      seed, size, terrain, biome, landmarks,
      resources: scatterResources(terrain, biome, landmarks, size, rng),
      start: { x: start.x, y: start.y },
    };
    if (validateWorld(world).length === 0) return world;
  }
  throw new Error(`generateWorld: no valid island for seed ${seed}`);
}
