import type { LandmarkId } from '@/sim/world/types';

export interface PropSpec {
  /** Frame in the chosen atlas; licensed world props are the default. */
  frame: string;
  atlas?: 'icons' | 'entrances';
  /** Explicit world size for generated sprites whose texture resolution is larger. */
  size?: readonly [number, number];
  /** Offset from the landmark tile, in tiles (the prop is drawn at the centre of that tile). */
  dx: number;
  dy: number;
  /** Animation key to loop instead of showing a still frame. */
  anim?: string;
  /** Colour the picture is tinted with. */
  tint?: number;
  /** Tiles, as integer offsets from the landmark tile, that the player cannot walk through. */
  blocks?: readonly (readonly [number, number])[];
}

/**
 * Scenery that marks each story landmark. Dungeon facades have individual generated art;
 * every footprint stays inside the area the generator keeps clear of resources.
 */
export const LANDMARK_PROPS: Record<LandmarkId, readonly PropSpec[]> = {
  start: [
    { frame: 'p/crate_03', dx: -2, dy: -1 },
    { frame: 'p/barrel_02', dx: 2, dy: 0 },
    { frame: 'p/crate_05', dx: 3, dy: -1 },
  ],
  camp: [{ frame: 'fire/campfire_burning/0', dx: 0, dy: 0, anim: 'fire_campfire_burning' }],
  sailor: [{ frame: 'p/house_01', dx: 0, dy: 0, blocks: [[-1, 0], [0, 0], [1, 0]] }],
  herbalist: [{ frame: 'p/house_02', dx: 0, dy: 0, blocks: [[-1, 0], [0, 0], [1, 0]] }],
  miner: [{ frame: 'p/house_05', dx: 0, dy: 0, blocks: [[-1, 0], [0, 0], [1, 0]] }],
  grotto: [{ frame: 'grotto', atlas: 'entrances', size: [64, 64], dx: 0, dy: 0, blocks: [[-1, 0], [0, 0], [1, 0]] }],
  deepmine: [{ frame: 'deepmine', atlas: 'entrances', size: [64, 64], dx: 0, dy: 0, blocks: [[-1, 0], [0, 0], [1, 0]] }],
  ruin: [{ frame: 'ruin', atlas: 'entrances', size: [64, 64], dx: 0, dy: 0, blocks: [[0, 0], [-2, 1], [2, 1]] }],
  lighthouse: [{ frame: 'lighthouse', atlas: 'entrances', size: [64, 64], dx: 0, dy: 0, blocks: [[0, 0], [-2, 0], [2, 0]] }],
  tablets: [{ frame: 'p/statue_03', dx: 0, dy: 0, blocks: [[0, 0]] }],
  treasure1: [{ frame: 'chest/chest_01/0', dx: 0, dy: 0 }],
  treasure2: [{ frame: 'chest/chest_01/0', dx: 0, dy: 0 }],
  treasure3: [{ frame: 'chest/chest_01/0', dx: 0, dy: 0 }],
  cache1: [{ frame: 'chest/chest_03/0', dx: 0, dy: 0 }],
  cache2: [{ frame: 'chest/chest_01/0', dx: 0, dy: 0 }],
  cache3: [{ frame: 'chest/chest_01/0', dx: 0, dy: 0 }],
  cache4: [{ frame: 'chest/chest_01/0', dx: 0, dy: 0 }],
  dock: [
    // The boat itself is drawn by IslandLevel; the crate under it keeps the tile solid.
    { frame: 'p/crate_03', dx: 0, dy: 0, blocks: [[0, 0]] },
    { frame: 'p/barrel_02', dx: -2, dy: 1 },
    { frame: 'p/crate_03', dx: 2, dy: 1 },
  ],
  outpost: [
    { frame: 'p/house_05', dx: 0, dy: 0, blocks: [[-1, 0], [0, 0], [1, 0]] },
    { frame: 'fire/campfire_burning/0', dx: 3, dy: 1, anim: 'fire_campfire_burning' },
  ],
  frostcave: [{ frame: 'frostcave', atlas: 'entrances', size: [64, 64], dx: 0, dy: 0, blocks: [[-1, 0], [0, 0], [1, 0]] }],
  magmaforge: [{ frame: 'magmaforge', atlas: 'entrances', size: [64, 64], dx: 0, dy: 0, blocks: [[-1, 0], [0, 0], [1, 0]] }],
  drownedcrypt: [{ frame: 'drownedcrypt', atlas: 'entrances', size: [64, 64], dx: 0, dy: 0, blocks: [[0, 0], [-2, 1], [2, 1]] }],
  skyspire: [{ frame: 'skyspire', atlas: 'entrances', size: [64, 64], dx: 0, dy: 0, blocks: [[0, 0], [-2, 0], [2, 0]] }],
};
