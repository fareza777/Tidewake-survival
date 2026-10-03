import { ITEMS, type ItemId, type ToolType } from '@/data/items';
import { NODE_NEED, STAMINA_HAND, STAMINA_TOOL, TIER_DAMAGE } from '@/data/tools';
import type { ResourceKind } from '@/sim/world/types';

export type HitCheck =
  | { ok: true; damage: number; stamina: number; /** The held tool takes wear. */ wear: boolean }
  | { ok: false; tool: ToolType; tier: number };

/** What happens when the hero swings `held` (null for bare hands) at a node of this kind. */
export function checkHit(kind: ResourceKind, held: ItemId | null): HitCheck {
  const need = NODE_NEED[kind];
  const tool = held ? ITEMS[held].tool : undefined;
  const matching = tool && need.tool !== null && tool.type === need.tool ? tool.tier : 0;
  if (need.tool === null) return { ok: true, damage: 1, stamina: STAMINA_HAND, wear: false };
  if (matching < need.minTier) return { ok: false, tool: need.tool, tier: need.minTier };
  return {
    ok: true,
    damage: TIER_DAMAGE[matching],
    stamina: matching > 0 ? STAMINA_TOOL : STAMINA_HAND,
    wear: matching > 0,
  };
}
