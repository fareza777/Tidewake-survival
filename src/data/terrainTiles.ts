import { T, type Terrain } from '@/sim/world/types';
import type { TileName } from './tileIndex';

/** Texture key of the packed ground tiles (public/assets/pack/tiles.png, 16x16 frames). */
export const TILES_KEY = 'tiles_ss';

type Weighted = readonly (readonly [TileName, number])[];

/** Ground tiles by terrain; the flat tile dominates so the speckles read as texture, not noise. */
export const GROUND_TILES: Record<Terrain, Weighted> = {
  [T.DEEP]: [['water.deep', 1]],
  [T.SHALLOW]: [['water.shallow', 1]],
  [T.RIVER]: [['water.shallow', 1]],
  [T.SAND]: [['sand.0', 10], ['sand.1', 3], ['sand.2', 3], ['sand.3', 3]],
  [T.GRASS]: [['grass.0', 10], ['grass.1', 3], ['grass.2', 3], ['grass.3', 2], ['grass.4', 2]],
  [T.SWAMP]: [['swamp.0', 10], ['swamp.1', 3], ['swamp.2', 3], ['swamp.3', 3]],
  [T.DIRT]: [['dirt.0', 10], ['dirt.1', 3], ['dirt.2', 3], ['dirt.3', 3]],
  [T.STONE]: [['stone.0', 1]],
  [T.DESERT]: [['desert.0', 10], ['desert.1', 3], ['desert.2', 3], ['desert.3', 3]],
};
