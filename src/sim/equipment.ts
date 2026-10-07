import { ITEMS, isItemId, type GearSlot, type ItemId } from '@/data/items';
import { addItem, type Inventory } from '@/sim/inventory';

export const GEAR_SLOTS: readonly GearSlot[] = ['armor', 'helm', 'boots', 'charm'];

/** What the hero wears: body armour, a helmet, boots and one charm. */
export type Equipment = Readonly<Record<GearSlot, ItemId | null>>;

export const noEquipment = (): Equipment => ({ armor: null, helm: null, boots: null, charm: null });

/** The slot a piece of gear goes into (body armour when it does not say). */
export const slotOf = (item: ItemId): GearSlot | null => {
  const a = ITEMS[item].armor;
  return a ? a.slot ?? 'armor' : null;
};

/** What the worn gear adds up to. */
export interface GearStats {
  /** Points taken off every blow from a creature. */
  defense: number;
  /** Extra walking speed (0.05 is 5% faster). */
  speed: number;
  /** Extra damage (0.1 is 10% more). */
  damage: number;
  /** Warmth added against the cold. */
  warmth: number;
  /** Extra stamina recovered per second. */
  regen: number;
  /** Extra luck: a bigger chance of more loot. */
  luck: number;
}

export function gearStats(e: Equipment): GearStats {
  const sum: GearStats = { defense: 0, speed: 0, damage: 0, warmth: 0, regen: 0, luck: 0 };
  for (const slot of GEAR_SLOTS) {
    const id = e[slot];
    const a = id ? ITEMS[id].armor : undefined;
    if (!a) continue;
    sum.defense += a.defense;
    sum.speed += a.speed ?? 0;
    sum.damage += a.damage ?? 0;
    sum.warmth += a.warmth ?? 0;
    sum.regen += a.regen ?? 0;
    sum.luck += a.luck ?? 0;
  }
  return sum;
}

/** Points taken off every blow from a creature. */
export const defenseOf = (e: Equipment): number => gearStats(e).defense;

export interface Worn {
  inv: Inventory;
  equipment: Equipment;
}

/** Put the gear in a backpack slot on; whatever was worn in that slot takes its place. Null when the slot holds no gear. */
export function equipFromSlot(inv: Inventory, e: Equipment, index: number): Worn | null {
  const slot = inv[index];
  if (!slot) return null;
  const place = slotOf(slot.item);
  if (!place) return null;
  const old = e[place];
  const out = inv.map((s, i) => (i === index ? (old ? { item: old, qty: 1 } : null) : s));
  return { inv: out, equipment: { ...e, [place]: slot.item } };
}

/** Take what is worn in a slot off into the first free backpack slot. Null when nothing is worn there or the backpack is full. */
export function unequipSlot(inv: Inventory, e: Equipment, place: GearSlot): Worn | null {
  const id = e[place];
  if (!id) return null;
  const { inv: next, left } = addItem(inv, id, 1);
  return left > 0 ? null : { inv: next, equipment: { ...e, [place]: null } };
}

/** Take the body armour off (kept for the older callers). */
export const unequipArmor = (inv: Inventory, e: Equipment): Worn | null => unequipSlot(inv, e, 'armor');

/** Validate untrusted JSON into equipment; anything that is not gear for that slot is dropped. */
export function parseEquipment(raw: unknown): Equipment {
  const d = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const out = { ...noEquipment() } as Record<GearSlot, ItemId | null>;
  for (const place of GEAR_SLOTS) {
    const id = d[place];
    out[place] = isItemId(id) && slotOf(id) === place ? id : null;
  }
  return out;
}
