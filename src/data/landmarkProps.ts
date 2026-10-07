import type { LandmarkId } from '@/sim/world/types';

export interface PropSpec {
  /** Frame in the `props` atlas (or in the `icons` atlas when `atlas` says so). */
  frame: string;
  atlas?: 'icons';
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
 * Scenery that marks each story landmark. These are stand-ins that later phases replace with real NPC huts,
 * dungeon doors and the lighthouse; the footprint stays inside the area the generator keeps clear of resources.
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
  grotto: [
    { frame: 'door/door_dungeon_8_h/0', dx: 0, dy: 0, blocks: [[0, 0]] },
    { frame: 'p/column_01', dx: -1, dy: 0, blocks: [[-1, 0]] },
    { frame: 'p/column_01', dx: 1, dy: 0, blocks: [[1, 0]] },
  ],
  deepmine: [
    { frame: 'door/door_dungeon_9_h/0', dx: 0, dy: 0, blocks: [[0, 0]] },
    { frame: 'p/column_03', dx: -1, dy: 0, blocks: [[-1, 0]] },
    { frame: 'p/column_03', dx: 1, dy: 0, blocks: [[1, 0]] },
  ],
  ruin: [
    { frame: 'door/door_dungeon_10_h/0', dx: 0, dy: 0, blocks: [[0, 0]] },
    { frame: 'p/statue_01', dx: 0, dy: -1 },
    { frame: 'p/column_05', dx: -2, dy: 1, blocks: [[-2, 1]] },
    { frame: 'p/column_05', dx: 2, dy: 1, blocks: [[2, 1]] },
  ],
  lighthouse: [
    { frame: 'door/door_dungeon_11_h/0', dx: 0, dy: 0, blocks: [[0, 0]] },
    { frame: 'p/statue_02', dx: 0, dy: -1 },
    { frame: 'p/lamp_04', dx: -2, dy: 0, blocks: [[-2, 0]] },
    { frame: 'p/lamp_04', dx: 2, dy: 0, blocks: [[2, 0]] },
  ],
  tablets: [{ frame: 'p/statue_03', dx: 0, dy: 0, blocks: [[0, 0]] }],
  treasure1: [{ frame: 'chest/chest_01/0', dx: 0, dy: 0 }],
  treasure2: [{ frame: 'chest/chest_01/0', dx: 0, dy: 0 }],
  treasure3: [{ frame: 'chest/chest_01/0', dx: 0, dy: 0 }],
  dock: [
    { frame: 'struct_boat', atlas: 'icons', dx: 0, dy: 0, blocks: [[0, 0]] },
    { frame: 'p/barrel_02', dx: -2, dy: 1 },
    { frame: 'p/crate_03', dx: 2, dy: 1 },
  ],
  outpost: [
    { frame: 'p/house_05', dx: 0, dy: 0, blocks: [[-1, 0], [0, 0], [1, 0]] },
    { frame: 'fire/campfire_burning/0', dx: 3, dy: 1, anim: 'fire_campfire_burning' },
  ],
  frostcave: [
    { frame: 'door/door_dungeon_8_h/0', dx: 0, dy: 0, blocks: [[0, 0]], tint: 0xbfe4ff },
    { frame: 'p/column_01', dx: -1, dy: 0, blocks: [[-1, 0]], tint: 0xbfe4ff },
    { frame: 'p/column_01', dx: 1, dy: 0, blocks: [[1, 0]], tint: 0xbfe4ff },
  ],
  magmaforge: [
    { frame: 'door/door_dungeon_9_h/0', dx: 0, dy: 0, blocks: [[0, 0]], tint: 0xffa070 },
    { frame: 'p/column_03', dx: -1, dy: 0, blocks: [[-1, 0]], tint: 0xff9060 },
    { frame: 'p/column_03', dx: 1, dy: 0, blocks: [[1, 0]], tint: 0xff9060 },
  ],
  drownedcrypt: [
    { frame: 'door/door_dungeon_10_h/0', dx: 0, dy: 0, blocks: [[0, 0]], tint: 0xa8c8b8 },
    { frame: 'p/statue_01', dx: 0, dy: -1, tint: 0xa8c8b8 },
    { frame: 'p/column_05', dx: -2, dy: 1, blocks: [[-2, 1]], tint: 0xa8c8b8 },
    { frame: 'p/column_05', dx: 2, dy: 1, blocks: [[2, 1]], tint: 0xa8c8b8 },
  ],
  skyspire: [
    { frame: 'door/door_dungeon_11_h/0', dx: 0, dy: 0, blocks: [[0, 0]], tint: 0xd8c8ff },
    { frame: 'p/statue_02', dx: 0, dy: -1, tint: 0xd8c8ff },
    { frame: 'p/lamp_04', dx: -2, dy: 0, blocks: [[-2, 0]], tint: 0xd8c8ff },
    { frame: 'p/lamp_04', dx: 2, dy: 0, blocks: [[2, 0]], tint: 0xd8c8ff },
  ],
};
