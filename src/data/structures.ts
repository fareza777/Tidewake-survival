/** Things the player can build. `station` is the crafting station a structure provides, if any. */
export type StructureId = 'campfire' | 'workbench' | 'furnace' | 'bed' | 'chest' | 'torch' | 'fence' | 'raft' | 'alchemy' | 'sign' | 'table' | 'stool' | 'lamp_post' | 'barrel';

/** Where a recipe can be crafted. `hand` is always available. */
export type Station = 'hand' | 'campfire' | 'workbench' | 'furnace' | 'alchemy';

export interface StructureDef {
  id: StructureId;
  station?: Exclude<Station, 'hand'>;
  /** Blocks walking. Torches are decoration the hero can walk past. */
  solid: boolean;
  /** Still frame in the `icons` atlas: the inventory icon and the in-world sprite. */
  frame: string;
  /** Animated in-world sprite from the `props` atlas that replaces the still frame (fires and torches). */
  world?: { frame: string; anim: string };
  /** Radius of the night glow in tiles; 0 means none. */
  light: number;
  /**
   * How it is taken down: `always` with a plain ACTION (fences and torches), or `tool` while holding an axe or pickaxe
   * (stations, chests and beds, which ACTION otherwise uses). Nothing the player builds can trap them.
   */
  pickup: 'always' | 'tool';
}

export const STRUCTURES: Record<StructureId, StructureDef> = {
  campfire: { id: 'campfire', station: 'campfire', solid: true, frame: 'struct_campfire', world: { frame: 'fire/campfire_burning/0', anim: 'fire_campfire_burning' }, light: 5, pickup: 'tool' },
  workbench: { id: 'workbench', station: 'workbench', solid: true, frame: 'struct_workbench', light: 0, pickup: 'tool' },
  furnace: { id: 'furnace', station: 'furnace', solid: true, frame: 'struct_furnace', light: 2, pickup: 'tool' },
  bed: { id: 'bed', solid: true, frame: 'struct_bed', light: 0, pickup: 'tool' },
  chest: { id: 'chest', solid: true, frame: 'struct_chest', light: 0, pickup: 'tool' },
  torch: { id: 'torch', solid: false, frame: 'struct_torch', world: { frame: 'torch/torch_03/0', anim: 'torch_torch_03' }, light: 3, pickup: 'always' },
  fence: { id: 'fence', solid: true, frame: 'struct_fence', light: 0, pickup: 'always' },
  raft: { id: 'raft', solid: true, frame: 'struct_raft', light: 0, pickup: 'tool' },
  alchemy: { id: 'alchemy', station: 'alchemy', solid: true, frame: 'struct_alchemy', light: 0, pickup: 'tool' },
  sign: { id: 'sign', solid: false, frame: 'struct_sign', light: 0, pickup: 'always' },
  table: { id: 'table', solid: true, frame: 'struct_table', light: 0, pickup: 'always' },
  stool: { id: 'stool', solid: false, frame: 'struct_stool', light: 0, pickup: 'always' },
  lamp_post: { id: 'lamp_post', solid: true, frame: 'struct_lamp_post', light: 5, pickup: 'always' },
  barrel: { id: 'barrel', solid: true, frame: 'struct_barrel', light: 0, pickup: 'always' },
};

/** Number of slots in a chest. */
export const CHEST_SLOTS = 20;
