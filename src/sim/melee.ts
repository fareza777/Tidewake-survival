import { ITEMS, type ItemId } from '@/data/items';
import { STAMINA_HAND, STAMINA_TOOL, TIER_DAMAGE } from '@/data/tools';
import type { SwingStats } from '@/sim/combat';

/** How a hand-to-hand blow with whatever is held behaves. */
export interface Melee extends SwingStats {
  stamina: number;
  /** Seconds before the next use. */
  cooldown: number;
  /** The held item takes wear (weapons do; a tool swung as a club does not). */
  wear: boolean;
}

const FISTS: Melee = { damage: 1, reach: 1, arc: 90, knockback: 0.15, stamina: STAMINA_HAND, cooldown: 0.4, wear: false };

/** The blow for the held item: its own stats for swords and spears, a club for tools, fists for the rest. */
export function meleeFor(held: ItemId | null): Melee {
  const def = held ? ITEMS[held] : null;
  const w = def?.weapon;
  if (w && w.kind === 'melee') {
    return { damage: w.damage, reach: w.reach, arc: w.arc, knockback: w.knockback, stamina: w.stamina, cooldown: w.cooldown, wear: true };
  }
  if (def?.tool && !w) return { ...FISTS, damage: TIER_DAMAGE[def.tool.tier], knockback: 0.25, stamina: STAMINA_TOOL, cooldown: 0.45 };
  return FISTS;
}
