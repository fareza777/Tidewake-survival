import { ITEMS, isItemId, type ItemId } from '@/data/items';
import { addItem, type Inventory } from '@/sim/inventory';

/** What the hero wears. Only armour for now. */
export interface Equipment {
  readonly armor: ItemId | null;
}

export const noEquipment = (): Equipment => ({ armor: null });

/** Points taken off every blow from a creature. */
export const defenseOf = (e: Equipment): number => (e.armor ? ITEMS[e.armor].armor?.defense ?? 0 : 0);

export interface Worn {
  inv: Inventory;
  equipment: Equipment;
}

/** Put the armour in a backpack slot on; whatever was worn takes its place. Null when the slot holds no armour. */
export function equipFromSlot(inv: Inventory, e: Equipment, index: number): Worn | null {
  const slot = inv[index];
  if (!slot || !ITEMS[slot.item].armor) return null;
  const out = inv.map((s, i) => (i === index ? (e.armor ? { item: e.armor, qty: 1 } : null) : s));
  return { inv: out, equipment: { armor: slot.item } };
}

/** Take the armour off into the first free slot. Null when nothing is worn or the backpack is full. */
export function unequipArmor(inv: Inventory, e: Equipment): Worn | null {
  if (!e.armor) return null;
  const { inv: next, left } = addItem(inv, e.armor, 1);
  return left > 0 ? null : { inv: next, equipment: { armor: null } };
}

/** Validate untrusted JSON into equipment; anything that is not real armour is dropped. */
export function parseEquipment(raw: unknown): Equipment {
  const armor = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>).armor : null;
  return { armor: isItemId(armor) && ITEMS[armor].armor ? armor : null };
}
