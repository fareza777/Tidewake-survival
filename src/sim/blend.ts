import { tileHash } from '@/sim/tileView';
import { T, idx, inBounds, type World } from '@/sim/world/types';

/**
 * Soft ground transitions on a "dual grid": every drawn tile sits on the corner shared by four map cells and shows which of
 * those corners belong to a terrain, so borders curve and wobble instead of following the square cell outline.
 */

/** Ground kinds from the bottom layer to the top one; a higher layer paints over the lower ones. */
export const GROUND_LAYERS = [T.DEEP, T.SHALLOW, T.SAND, T.DESERT, T.DIRT, T.SWAMP, T.GRASS, T.STONE, T.SNOW, T.ASH, T.LAVA] as const;
export const LAYER_COUNT = GROUND_LAYERS.length;

const LAYER_OF: Record<number, number> = {
  [T.DEEP]: 0, [T.SHALLOW]: 1, [T.RIVER]: 1, [T.SAND]: 2, [T.DESERT]: 3, [T.DIRT]: 4, [T.SWAMP]: 5, [T.GRASS]: 6, [T.STONE]: 7,
  [T.SNOW]: 8, [T.ASH]: 9, [T.LAVA]: 10,
};

/** Layer a terrain belongs to (dungeon floors and walls are not blended and count as the lowest). */
export function layerOf(terrain: number): number {
  return LAYER_OF[terrain] ?? 0;
}

export const CORNER_TL = 1;
export const CORNER_TR = 2;
export const CORNER_BL = 4;
export const CORNER_BR = 8;
export const FULL = 15;

/** Layers of the four cells around dual tile (a, b): top-left, top-right, bottom-left, bottom-right. Outside the map is deep water. */
export function cornerLayers(world: World, a: number, b: number): [number, number, number, number] {
  const at = (x: number, y: number): number => (inBounds(x, y, world.size) ? layerOf(world.terrain[idx(x, y, world.size)]) : 0);
  return [at(a - 1, b - 1), at(a, b - 1), at(a - 1, b), at(a, b)];
}

/**
 * Mask of every layer at dual tile (a, b), or 0 where the layer is not drawn: layer k covers the corners whose terrain is
 * at layer k or higher, and is skipped under a layer above it that already fills the whole tile.
 */
export function layerMasks(world: World, a: number, b: number): number[] {
  const c = cornerLayers(world, a, b);
  const masks = new Array<number>(LAYER_COUNT).fill(0);
  let covered = false;
  for (let k = LAYER_COUNT - 1; k >= 0; k--) {
    if (covered) break;
    const m = (c[0] >= k ? CORNER_TL : 0) | (c[1] >= k ? CORNER_TR : 0) | (c[2] >= k ? CORNER_BL : 0) | (c[3] >= k ? CORNER_BR : 0);
    masks[k] = m;
    if (m === FULL) covered = true;
  }
  return masks;
}

const NOISE_AMP = 0.3;
const TILE_PX = 16;

function lattice(ix: number, iy: number, seed: number): number {
  return tileHash(ix, iy, seed) * 2 - 1;
}

/** Smooth value noise in [-1, 1]. */
function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = lattice(ix, iy, seed) * (1 - sx) + lattice(ix + 1, iy, seed) * sx;
  const bottom = lattice(ix, iy + 1, seed) * (1 - sx) + lattice(ix + 1, iy + 1, seed) * sx;
  return top * (1 - sy) + bottom * sy;
}

/**
 * How far into a terrain the pixel (px, py) of a tile lies: 0.5 is the border, above is inside. The noise fades out at the tile
 * edge, so two tiles that share a border always meet at the same point, whichever `variant` each one uses.
 */
export function fieldValue(mask: number, px: number, py: number, variant: number): number {
  const u = (px + 0.5) / TILE_PX;
  const v = (py + 0.5) / TILE_PX;
  const tl = mask & CORNER_TL ? 1 : 0;
  const tr = mask & CORNER_TR ? 1 : 0;
  const bl = mask & CORNER_BL ? 1 : 0;
  const br = mask & CORNER_BR ? 1 : 0;
  const f = tl * (1 - u) * (1 - v) + tr * u * (1 - v) + bl * (1 - u) * v + br * u * v;
  const edge = Math.min(u, 1 - u, v, 1 - v);
  const window = Math.min(1, Math.max(0, (edge - 0.05) / 0.25));
  const noise = 0.7 * valueNoise(px / 4.5, py / 4.5, variant * 7 + 1) + 0.3 * (tileHash(px, py, variant * 7 + 2) * 2 - 1);
  return f + NOISE_AMP * noise * window;
}
