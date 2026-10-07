import { ITEMS, type ItemId, type Tier } from '@/data/items';
import { canAfford, setSlot, spend, type Cost, type Inventory, type Slot } from '@/sim/inventory';

/** A tool or weapon can be upgraded at an anvil up to this many times. */
export const UPGRADE_MAX = 5;

/** What one upgrade level adds: damage, and extra uses before it wears out. */
const DAMAGE_PER_PLUS = 0.12;
const DURABILITY_PER_PLUS = 0.2;

export const plusMult = (plus: number | undefined): number => 1 + DAMAGE_PER_PLUS * (plus ?? 0);

/** How many uses a tool has when new, with its upgrades. */
export function maxDurability(item: ItemId, plus: number | undefined): number {
  const d = ITEMS[item].tool?.durability ?? 0;
  return Math.round(d * (1 + DURABILITY_PER_PLUS * (plus ?? 0)));
}

/** Can this item be upgraded at all: tools and weapons, but not a watering can. */
export const canUpgradeItem = (item: ItemId): boolean => {
  const t = ITEMS[item].tool;
  return t !== undefined && t.type !== 'can';
};

/** The material each tier is worked with. */
const TIER_MATERIAL: Record<Tier, ItemId> = { 1: 'plank', 2: 'stone', 3: 'iron_ingot', 4: 'steel_ingot', 5: 'mithril_ingot' };

/** The cost of the next upgrade level (null when the item is at the top or cannot be upgraded). */
export function upgradeCost(slot: Slot): Cost | null {
  const t = ITEMS[slot.item].tool;
  const plus = slot.plus ?? 0;
  if (!t || !canUpgradeItem(slot.item) || plus >= UPGRADE_MAX) return null;
  const material = TIER_MATERIAL[t.tier];
  const n = (plus + 1) * (t.tier <= 2 ? 3 : 2);
  const cost: [ItemId, number][] = [[material, n]];
  if (plus >= 2) cost.push([t.tier >= 4 ? 'crystal' : 'rope', plus]);
  return cost;
}

/** The cost of putting a worn tool back to full: one working material per quarter worn. */
export function repairCost(slot: Slot): Cost | null {
  const t = ITEMS[slot.item].tool;
  if (!t || !canUpgradeItem(slot.item)) return null;
  const max = maxDurability(slot.item, slot.plus);
  const dur = slot.dur ?? max;
  if (dur >= max) return null;
  const quarters = Math.max(1, Math.ceil(((max - dur) / max) * 4));
  return [[TIER_MATERIAL[t.tier], quarters * (t.tier <= 2 ? 2 : 1)]];
}

export const canAffordCost = canAfford;

/** Upgrade the tool in a backpack slot by one level: it is paid for, wears out later and hits harder, and comes back fully repaired. */
export function upgradeSlot(inv: Inventory, index: number): Inventory | null {
  const slot = inv[index];
  if (!slot) return null;
  const cost = upgradeCost(slot);
  if (!cost) return null;
  const paid = spend(inv, cost);
  if (!paid) return null;
  const plus = (slot.plus ?? 0) + 1;
  // Paying may have emptied or moved other stacks, never this one (a tool is a stack of one), but look it up again to be safe.
  const at = paid[index]?.item === slot.item ? index : paid.findIndex((s) => s?.item === slot.item && s.plus === slot.plus);
  return at < 0 ? null : setSlot(paid, at, { ...slot, plus, dur: maxDurability(slot.item, plus) });
}

/** Put a worn tool back to full strength. */
export function repairSlot(inv: Inventory, index: number): Inventory | null {
  const slot = inv[index];
  if (!slot) return null;
  const cost = repairCost(slot);
  if (!cost) return null;
  const paid = spend(inv, cost);
  if (!paid) return null;
  const at = paid[index]?.item === slot.item ? index : paid.findIndex((s) => s?.item === slot.item && s.plus === slot.plus);
  return at < 0 ? null : setSlot(paid, at, { ...slot, dur: maxDurability(slot.item, slot.plus) });
}
