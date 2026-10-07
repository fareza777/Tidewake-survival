import type { ToolType } from './items';
import type { ResourceKind } from '@/sim/world/types';

/** Damage per hit with bare hands; real tools do 1, 2 and 3 for tiers 1 to 3. */
export const HAND_DAMAGE = 0.34;
export const TIER_DAMAGE: readonly number[] = [HAND_DAMAGE, 1, 2, 3, 4.2, 5.8];

/** Stamina spent per swing, by hand and with a tool. */
export const STAMINA_HAND = 1;
export const STAMINA_TOOL = 4;

export interface NodeNeed {
  /** The tool that works best; null means any hand will do. */
  tool: Extract<ToolType, 'axe' | 'pickaxe'> | null;
  /** Minimum tool tier that can damage the node at all (0 means bare hands can, just slowly). */
  minTier: 0 | 1 | 2 | 3 | 4 | 5;
}

export const NODE_NEED: Record<ResourceKind, NodeNeed> = {
  tree: { tool: 'axe', minTier: 0 },
  palm: { tool: 'axe', minTier: 0 },
  swamptree: { tool: 'axe', minTier: 0 },
  bush: { tool: null, minTier: 0 },
  rock: { tool: 'pickaxe', minTier: 0 },
  redrock: { tool: 'pickaxe', minTier: 0 },
  ore: { tool: 'pickaxe', minTier: 2 },
  crystal: { tool: 'pickaxe', minTier: 3 },
  mithril: { tool: 'pickaxe', minTier: 4 },
  pine: { tool: 'axe', minTier: 0 },
  icerock: { tool: 'pickaxe', minTier: 0 },
  ashrock: { tool: 'pickaxe', minTier: 0 },
  coalvein: { tool: 'pickaxe', minTier: 2 },
  driftwood: { tool: 'axe', minTier: 0 },
};
