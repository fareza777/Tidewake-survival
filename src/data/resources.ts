import type { ResourceKind } from '@/sim/world/types';
import type { ItemId } from './items';

export interface Drop {
  item: ItemId;
  min: number;
  max: number;
  /** Probability that this drop happens at all (default 1). */
  chance?: number;
}

export interface ResourceDef {
  /** Frame names in the `props` atlas; a node shows frames[variant % frames.length]. */
  frames: readonly string[];
  /** Hits (at damage 1) needed to destroy the node. */
  hp: number;
  drops: readonly Drop[];
  /** Colour the sprite is tinted with (frosted trees, ash-dark rock). */
  tint?: number;
}

export const RESOURCES: Record<ResourceKind, ResourceDef> = {
  tree: {
    frames: ['p/tree_02', 'p/tree_04', 'p/tree_13', 'p/tree_03', 'p/tree_01'],
    hp: 5,
    drops: [{ item: 'wood', min: 2, max: 4 }, { item: 'fiber', min: 1, max: 1, chance: 0.35 }],
  },
  palm: {
    frames: ['p/tree_06', 'p/tree_07'],
    hp: 4,
    drops: [
      { item: 'wood', min: 1, max: 2 },
      { item: 'coconut', min: 1, max: 1, chance: 0.7 },
      { item: 'fiber', min: 1, max: 2, chance: 0.5 },
      { item: 'corn_seed', min: 1, max: 1, chance: 0.2 },
    ],
  },
  bush: {
    frames: ['p/tree_30', 'p/tree_31'],
    hp: 2,
    drops: [
      { item: 'berries', min: 1, max: 3 },
      { item: 'fiber', min: 1, max: 2 },
      { item: 'carrot_seed', min: 1, max: 1, chance: 0.3 },
      { item: 'turnip_seed', min: 1, max: 1, chance: 0.3 },
    ],
  },
  rock: {
    frames: ['p/rock_18', 'p/rock_19', 'p/rock_20', 'p/rock_36'],
    hp: 6,
    drops: [{ item: 'stone', min: 2, max: 4 }, { item: 'coal', min: 1, max: 2, chance: 0.22 }],
  },
  ore: {
    frames: ['p/rock_44', 'p/rock_45'],
    hp: 9,
    drops: [{ item: 'iron_ore', min: 1, max: 2 }, { item: 'stone', min: 1, max: 1 }, { item: 'coal', min: 1, max: 2, chance: 0.5 }],
  },
  pine: { frames: ['p/tree_02', 'p/tree_04', 'p/tree_13'], hp: 6, tint: 0xbddcff, drops: [{ item: 'wood', min: 2, max: 4 }, { item: 'fiber', min: 1, max: 1, chance: 0.2 }] },
  icerock: { frames: ['p/rock_18', 'p/rock_19', 'p/rock_20'], hp: 7, tint: 0xa4d6ff, drops: [{ item: 'stone', min: 1, max: 3 }, { item: 'crystal', min: 1, max: 1, chance: 0.12 }] },
  ashrock: { frames: ['p/rock_18', 'p/rock_19', 'p/rock_36'], hp: 7, tint: 0x6e6874, drops: [{ item: 'stone', min: 1, max: 2 }, { item: 'coal', min: 1, max: 2, chance: 0.45 }] },
  coalvein: { frames: ['p/rock_44', 'p/rock_45'], hp: 10, tint: 0x3c3a46, drops: [{ item: 'coal', min: 2, max: 3 }, { item: 'iron_ore', min: 1, max: 1, chance: 0.3 }] },
  driftwood: { frames: ['p/tree_30', 'p/tree_31'], hp: 3, tint: 0xb8905c, drops: [{ item: 'wood', min: 1, max: 2 }, { item: 'fiber', min: 1, max: 1, chance: 0.5 }] },
  mithril: {
    frames: ['p/rock_15', 'p/rock_16', 'p/rock_17'],
    hp: 14,
    drops: [{ item: 'mithril_ore', min: 1, max: 2 }, { item: 'coal', min: 1, max: 1, chance: 0.4 }],
  },
  crystal: {
    frames: ['p/rock_15', 'p/rock_16', 'p/rock_17'],
    hp: 10,
    drops: [{ item: 'crystal', min: 1, max: 1 }],
  },
  swamptree: {
    frames: ['p/tree_15', 'p/tree_16', 'p/tree_17', 'p/tree_18'],
    hp: 5,
    drops: [
      { item: 'wood', min: 2, max: 3 },
      { item: 'fiber', min: 1, max: 2, chance: 0.5 },
      { item: 'pumpkin_seed', min: 1, max: 1, chance: 0.15 },
    ],
  },
  redrock: {
    frames: ['p/rock_02', 'p/rock_03', 'p/rock_07', 'p/rock_08'],
    hp: 5,
    drops: [{ item: 'stone', min: 1, max: 3 }],
  },
};

export function resourceFrame(kind: ResourceKind, variant: number): string {
  const frames = RESOURCES[kind].frames;
  return frames[variant % frames.length];
}
