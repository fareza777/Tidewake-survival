import { GROUND_TILES, themeTiles, type DungeonTheme } from '@/data/terrainTiles';
import { TILE_FRAMES } from '@/data/tileIndex';
import { T, idx, inBounds, isWater, type Terrain, type World } from '@/sim/world/types';

/** Stable pseudo-random number in [0, 1) for a tile, so the same tile always looks the same. */
export function tileHash(x: number, y: number, seed = 0): number {
  let h = (seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Frame index (in tiles.png) of the ground tile to draw at (x, y). */
export function groundFrame(terrain: number, x: number, y: number): number {
  const list = GROUND_TILES[terrain as Terrain];
  const total = list.reduce((s, [, w]) => s + w, 0);
  let roll = tileHash(x, y) * total;
  for (const [name, w] of list) {
    roll -= w;
    if (roll < 0) return TILE_FRAMES[name];
  }
  return TILE_FRAMES[list[list.length - 1][0]];
}

/** Frame of the dungeon tile at (x, y): a themed floor variant, the lit face of a wall that has floor to its south, or a wall top. */
export function dungeonFrame(world: World, x: number, y: number, theme: DungeonTheme): number {
  const here = world.terrain[idx(x, y, world.size)];
  if (here === T.WALL) {
    const below = inBounds(x, y + 1, world.size) ? world.terrain[idx(x, y + 1, world.size)] : T.WALL;
    return TILE_FRAMES[below === T.FLOOR ? (`wallface.${theme}` as const) : (`walltop.${theme}` as const)];
  }
  const list = themeTiles(theme)[T.FLOOR];
  const total = list.reduce((s, [, w]) => s + w, 0);
  let roll = tileHash(x, y) * total;
  for (const [name, w] of list) {
    roll -= w;
    if (roll < 0) return TILE_FRAMES[name];
  }
  return TILE_FRAMES[list[list.length - 1][0]];
}

export const SHORE_N = 1;
export const SHORE_E = 2;
export const SHORE_S = 4;
export const SHORE_W = 8;

/** For a water tile: which of its four sides touch land (a foam line is drawn there). 0 for land tiles. */
export function shoreMask(w: World, x: number, y: number): number {
  if (!isWater(w.terrain[idx(x, y, w.size)])) return 0;
  const land = (nx: number, ny: number): boolean => inBounds(nx, ny, w.size) && !isWater(w.terrain[idx(nx, ny, w.size)]);
  return (land(x, y - 1) ? SHORE_N : 0) | (land(x + 1, y) ? SHORE_E : 0) | (land(x, y + 1) ? SHORE_S : 0) | (land(x - 1, y) ? SHORE_W : 0);
}
