import type { ItemId } from '@/data/items';
import { addItem, type Inventory } from '@/sim/inventory';
import type { Fx } from '@/sim/session';

/** A message for the player. `translate` names variables that are themselves string keys. */
export const say = (key: string, vars?: Record<string, string | number>, translate?: string[]): Fx => ({ t: 'say', key, vars, translate });

/** Put items into an inventory. `overflow` is true when some did not fit (what did fit is in `inv`). */
export function giveItems(inv: Inventory, items: readonly { item: ItemId; qty: number }[]): { inv: Inventory; fx: Fx[]; overflow: boolean } {
  const fx: Fx[] = [];
  let cur = inv;
  let overflow = false;
  for (const it of items) {
    const { inv: next, left } = addItem(cur, it.item, it.qty);
    cur = next;
    if (it.qty - left > 0) fx.push({ t: 'gain', item: it.item, qty: it.qty - left });
    if (left > 0) overflow = true;
  }
  if (overflow) fx.push(say('msgFull'));
  return { inv: cur, fx, overflow };
}
