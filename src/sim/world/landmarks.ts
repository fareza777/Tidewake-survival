import type { Rng } from '@/core/rng';
import { B, T, idx, inBounds, isWater, type Biome, type Landmark, type LandmarkId } from './types';

interface SpotSpec {
  id: LandmarkId;
  biome: Biome;
  /** Half-size of the footprint that must be dry land (footprint is (2*half+1)^2 tiles). */
  half: number;
  minStart?: number;
  maxStart?: number;
  near?: { id: LandmarkId; min: number; max: number };
  spacing?: number;
}

/** Placement order matters: later landmarks are positioned relative to earlier ones. */
const SPECS: SpotSpec[] = [
  { id: 'camp', biome: B.FOREST, half: 2, minStart: 6, maxStart: 14, spacing: 6 },
  { id: 'sailor', biome: B.FOREST, half: 1, minStart: 14, maxStart: 30, spacing: 10 },
  { id: 'grotto', biome: B.FOREST, half: 2, minStart: 30, maxStart: 64, spacing: 16 },
  { id: 'deepmine', biome: B.MOUNTAIN, half: 2, spacing: 16 },
  { id: 'miner', biome: B.MOUNTAIN, half: 1, near: { id: 'deepmine', min: 6, max: 16 }, spacing: 8 },
  { id: 'herbalist', biome: B.SWAMP, half: 1, spacing: 12 },
  { id: 'ruin', biome: B.DESERT, half: 2, spacing: 16 },
  { id: 'tablets', biome: B.DESERT, half: 1, near: { id: 'ruin', min: 8, max: 26 }, spacing: 8 },
  { id: 'treasure1', biome: B.FOREST, half: 0, minStart: 10, maxStart: 60, spacing: 12 },
  { id: 'treasure2', biome: B.FOREST, half: 0, minStart: 10, maxStart: 60, spacing: 12 },
  { id: 'treasure3', biome: B.FOREST, half: 0, minStart: 10, maxStart: 60, spacing: 12 },
];

export const RESERVE_RADIUS: Record<LandmarkId, number> = {
  start: 6, camp: 5, sailor: 4, herbalist: 4, miner: 4, grotto: 4, deepmine: 4, ruin: 4,
  lighthouse: 4, tablets: 3, treasure1: 1, treasure2: 1, treasure3: 1,
  dock: 4, outpost: 4, frostcave: 4, magmaforge: 4, drownedcrypt: 4, skyspire: 4,
};

const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by);

function footprintIsLand(terrain: Uint8Array, size: number, x: number, y: number, half: number): boolean {
  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      if (!inBounds(x + dx, y + dy, size)) return false;
      if (isWater(terrain[idx(x + dx, y + dy, size)])) return false;
    }
  }
  return true;
}

function findSpot(
  terrain: Uint8Array, biome: Uint8Array, size: number, placed: Landmark[], spec: SpotSpec, rng: Rng, relax: number,
): { x: number; y: number } | null {
  const start = placed.find((l) => l.id === 'start')!;
  const near = spec.near ? placed.find((l) => l.id === spec.near!.id) : undefined;
  const spacing = (spec.spacing ?? 8) * relax;
  const candidates: { x: number; y: number }[] = [];
  for (let y = 4; y < size - 4; y++) {
    for (let x = 4; x < size - 4; x++) {
      if (biome[idx(x, y, size)] !== spec.biome) continue;
      if (!footprintIsLand(terrain, size, x, y, spec.half)) continue;
      const d = dist(x, y, start.x, start.y);
      if (spec.minStart !== undefined && d < spec.minStart * relax) continue;
      if (spec.maxStart !== undefined && d > spec.maxStart / relax) continue;
      if (near) {
        const dn = dist(x, y, near.x, near.y);
        if (dn < spec.near!.min * relax || dn > spec.near!.max / relax) continue;
      }
      if (placed.some((l) => dist(x, y, l.x, l.y) < spacing)) continue;
      candidates.push({ x, y });
    }
  }
  return candidates.length ? rng.pick(candidates) : null;
}

/** Pick the spot with the best score among dry-land spots whose footprint (half) is all land. */
function bestSpot(
  terrain: Uint8Array, size: number, half: number, ok: (x: number, y: number) => boolean, score: (x: number, y: number) => number,
): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestScore = -Infinity;
  for (let y = 2; y < size - 2; y++) {
    for (let x = 2; x < size - 2; x++) {
      if (!ok(x, y) || !footprintIsLand(terrain, size, x, y, half)) continue;
      const s = score(x, y);
      if (s > bestScore) {
        bestScore = s;
        best = { x, y };
      }
    }
  }
  return best;
}

/** Returns every landmark, or null when the island cannot host them (the caller re-rolls the seed). */
export function placeLandmarks(terrain: Uint8Array, biome: Uint8Array, size: number, rng: Rng): Landmark[] | null {
  const c = size / 2;
  const start = bestSpot(
    terrain, size, 1,
    (x, y) => terrain[idx(x, y, size)] === T.SAND && biome[idx(x, y, size)] === B.FOREST && isWater(terrain[idx(x, y + 2, size)]),
    (x, y) => y * 1000 - Math.abs(x - c),
  );
  if (!start) return null;
  const placed: Landmark[] = [{ id: 'start', x: start.x, y: start.y, biome: B.FOREST }];

  const light = bestSpot(
    terrain, size, 1,
    (x, y) => terrain[idx(x, y, size)] !== T.RIVER,
    (x, y) => -y * 1000 - Math.abs(x - c),
  );
  if (!light) return null;
  placed.push({ id: 'lighthouse', x: light.x, y: light.y, biome: biomeAt(biome, size, light.x, light.y) });

  const spotRng = rng.fork('landmarks');
  for (const spec of SPECS) {
    const spot = findSpot(terrain, biome, size, placed, spec, spotRng, 1) ?? findSpot(terrain, biome, size, placed, spec, spotRng, 0.6);
    if (!spot) return null;
    placed.push({ id: spec.id, x: spot.x, y: spot.y, biome: spec.biome });
  }
  return placed;
}

function biomeAt(biome: Uint8Array, size: number, x: number, y: number): Biome {
  return biome[idx(x, y, size)] as Biome;
}
