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
  [T.FLOOR]: [['floor.mine.0', 10], ['floor.mine.1', 3], ['floor.mine.2', 3], ['floor.mine.3', 2]],
  [T.WALL]: [['walltop.mine', 1]],
  [T.SNOW]: [['snow.0', 10], ['snow.1', 3], ['snow.2', 3], ['snow.3', 3]],
  [T.ASH]: [['ash.0', 10], ['ash.1', 3], ['ash.2', 3], ['ash.3', 3]],
  [T.LAVA]: [['lava.0', 10], ['lava.1', 3], ['lava.2', 3], ['lava.3', 3]],
};

/** Looks of the three dungeons: mossy grotto, brown mine, sandstone ruin. */
export const DUNGEON_THEMES = ['moss', 'mine', 'ruin', 'ice', 'magma', 'bone', 'void'] as const;
export type DungeonTheme = (typeof DUNGEON_THEMES)[number];

/** Floor and wall tiles of one dungeon theme. */
export function themeTiles(theme: DungeonTheme): Record<typeof T.FLOOR | typeof T.WALL, Weighted> {
  return {
    [T.FLOOR]: [[`floor.${theme}.0`, 10], [`floor.${theme}.1`, 3], [`floor.${theme}.2`, 3], [`floor.${theme}.3`, 2]],
    [T.WALL]: [[`walltop.${theme}`, 1]],
  };
}
