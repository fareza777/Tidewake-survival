import { CREATURES, type CreatureId } from '@/data/creatures';
import { addItem, type Inventory } from '@/sim/inventory';

/**
 * What a boss leaves behind (its story item and armour), put into the backpack. All or nothing: when it would not all
 * fit, `null` comes back and the backpack is untouched, so the hero can make room and the level tries again.
 */
export function claimDepthsReward(inv: Inventory, floor: number): Inventory | null {
  let cur = inv;
  for (const [item, qty] of [['gold', 50 + 35 * floor], [floor % 2 === 0 ? 'steel_ingot' : 'crystal', 1 + Math.floor(floor / 4)]] as const) {
    const r = addItem(cur, item, qty);
    if (r.left > 0) return null;
    cur = r.inv;
  }
  return cur;
}

export function claimReward(inv: Inventory, boss: CreatureId): Inventory | null {
  let cur = inv;
  for (const d of CREATURES[boss].drops) {
    const r = addItem(cur, d.item, d.min);
    if (r.left > 0) return null;
    cur = r.inv;
  }
  return cur;
}
