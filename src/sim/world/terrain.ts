import { Rng } from '@/core/rng';
import { fbm } from './noise';
import { B, T, WORLD_SIZE, idx, inBounds, isWater } from './types';

const isSea = (t: number): boolean => t === T.DEEP || t === T.SHALLOW;

export interface TerrainResult {
  terrain: Uint8Array;
  biome: Uint8Array;
  height: Float32Array;
}

const R = 68;
const SEA_LEVEL = 0.3;
const SHALLOW_LEVEL = 0.22;
const SAND_LEVEL = 0.36;
const STONE_LEVEL = 0.56;
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Keep the largest 4-connected land component; every other bit of land becomes water. */
export function keepLargestLand(terrain: Uint8Array, height: Float32Array, size: number): void {
  const label = new Int32Array(size * size).fill(-1);
  const sizes: number[] = [];
  for (let s = 0; s < size * size; s++) {
    if (label[s] !== -1 || isWater(terrain[s])) continue;
    const id = sizes.length;
    let count = 0;
    const stack = [s];
    label[s] = id;
    while (stack.length) {
      const c = stack.pop()!;
      count++;
      const x = c % size;
      const y = (c - x) / size;
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny, size)) continue;
        const n = idx(nx, ny, size);
        if (label[n] === -1 && !isWater(terrain[n])) {
          label[n] = id;
          stack.push(n);
        }
      }
    }
    sizes.push(count);
  }
  const best = sizes.indexOf(Math.max(...sizes));
  for (let i = 0; i < size * size; i++) {
    if (!isWater(terrain[i]) && label[i] !== best) terrain[i] = height[i] > SHALLOW_LEVEL ? T.SHALLOW : T.DEEP;
  }
}

interface Anchor {
  biome: number;
  x: number;
  y: number;
  weight: number;
}

/** Move a wanted anchor point toward the island centre until it sits on land. */
function landAnchor(terrain: Uint8Array, size: number, x: number, y: number): { x: number; y: number } {
  const c = size / 2;
  let px = x;
  let py = y;
  for (let i = 0; i < 120; i++) {
    const ix = Math.round(px);
    const iy = Math.round(py);
    if (inBounds(ix, iy, size) && !isWater(terrain[idx(ix, iy, size)])) return { x: ix, y: iy };
    px += Math.sign(c - px) * 1;
    py += Math.sign(c - py) * 1;
  }
  return { x: Math.round(c), y: Math.round(c) };
}

export function generateTerrain(seed: number, size = WORLD_SIZE): TerrainResult {
  const rng = new Rng(seed).fork('terrain');
  const c = size / 2;
  const terrain = new Uint8Array(size * size);
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c) / R;
      const n = fbm(seed, x, y, 38, 4);
      const h = 0.62 * (1 - Math.pow(Math.min(d, 1.4), 1.6)) + 0.38 * n;
      height[idx(x, y, size)] = h;
      terrain[idx(x, y, size)] = h > SEA_LEVEL ? T.GRASS : h > SHALLOW_LEVEL ? T.SHALLOW : T.DEEP;
    }
  }
  keepLargestLand(terrain, height, size);

  const west = rng.chance(0.5) ? -1 : 1;
  const jit = () => rng.float(-5, 5);
  const raw: [number, number, number, number][] = [
    [B.FOREST, c + jit(), c + 0.42 * R + jit(), 1.2],
    [B.MOUNTAIN, c + west * 0.05 * R + jit(), c - 0.12 * R + jit(), 0.95],
    [B.SWAMP, c + west * 0.5 * R + jit(), c + 0.12 * R + jit(), 1.0],
    [B.DESERT, c - west * 0.42 * R + jit(), c - 0.4 * R + jit(), 1.0],
  ];
  const anchors: Anchor[] = raw.map(([biome, x, y, weight]) => ({ biome, weight, ...landAnchor(terrain, size, x, y) }));

  const biome = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = idx(x, y, size);
      if (isWater(terrain[i])) continue;
      const wx = x + (fbm(seed + 7, x, y, 16, 3) - 0.5) * 44;
      const wy = y + (fbm(seed + 13, x, y, 16, 3) - 0.5) * 44;
      let best: number = B.FOREST;
      let bestScore = Infinity;
      for (const a of anchors) {
        const s = Math.hypot(wx - a.x, wy - a.y) / a.weight;
        if (s < bestScore) {
          bestScore = s;
          best = a.biome;
        }
      }
      biome[i] = best;
      const h = height[i];
      if (h < SAND_LEVEL) terrain[i] = T.SAND;
      else if (best === B.SWAMP) terrain[i] = T.SWAMP;
      else if (best === B.DESERT) terrain[i] = T.DESERT;
      else if (best === B.MOUNTAIN) terrain[i] = h > STONE_LEVEL ? T.STONE : T.DIRT;
      else terrain[i] = T.GRASS;
    }
  }
  carveRivers(terrain, anchors.find((a) => a.biome === B.MOUNTAIN)!, size, rng);
  return { terrain, biome, height };
}

/** Walk from the mountain toward the sea in two well-separated directions, wading two tiles wide. */
function carveRivers(terrain: Uint8Array, from: Anchor, size: number, rng: Rng): void {
  const dists: { ang: number; dist: number }[] = [];
  for (let k = 0; k < 16; k++) {
    const ang = (k / 16) * Math.PI * 2;
    let dist = 0;
    for (; dist < size; dist++) {
      const x = Math.round(from.x + Math.cos(ang) * dist);
      const y = Math.round(from.y + Math.sin(ang) * dist);
      if (!inBounds(x, y, size) || isSea(terrain[idx(x, y, size)])) break;
    }
    dists.push({ ang, dist });
  }
  dists.sort((a, b) => a.dist - b.dist);
  const first = dists[0];
  const second = dists.find((d) => Math.abs(Math.atan2(Math.sin(d.ang - first.ang), Math.cos(d.ang - first.ang))) > Math.PI / 2);
  for (const dir of [first, second]) {
    if (!dir) continue;
    let x = from.x;
    let y = from.y;
    let ang = dir.ang;
    for (let step = 0; step < size; step++) {
      ang += rng.float(-0.35, 0.35);
      x += Math.cos(ang);
      y += Math.sin(ang);
      const ix = Math.round(x);
      const iy = Math.round(y);
      if (!inBounds(ix, iy, size) || isSea(terrain[idx(ix, iy, size)])) break;
      for (const [ox, oy] of [[0, 0], [1, 0], [0, 1]]) {
        const ti = idx(ix + ox, iy + oy, size);
        if (inBounds(ix + ox, iy + oy, size) && !isSea(terrain[ti])) terrain[ti] = T.RIVER;
      }
    }
  }
}
