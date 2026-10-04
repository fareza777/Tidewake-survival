/**
 * Frames of the `props` atlas that draw a dungeon. Groups ("door/door_10") are animations made of numbered frames
 * ("door/door_10/0" is closed, the last one is open).
 */
export const DUNGEON_ART = {
  door: { gate: 'door/door_dungeon_8_h', boss: 'door/door_10', exit: 'door/door_dungeon_9_h' },
  /** Frame 0 is shut, 3 is wide open. */
  chest: { free: 'chest/chest_01', locked: 'chest/chest_03' },
  /** Three shimmering frames each. */
  crystal: { dull: 'crystal/cristal_10', lit: 'crystal/cristal_20' },
  trapSheet: 'trap/trap_1',
  /** Frame numbers of the spike sheet: holes in the floor, a few points showing, spikes up. */
  trap: { down: 0, warn: 3, up: 4 },
  switch: { off: 'switch/switch_03/right/0', on: 'switch/switch_03/right/1' },
  block: 'p/block_01',
  /** Animated wall torch; its animation key is "torch_torch_03". */
  torch: 'torch/torch_03',
} as const;
