import { ITEMS, type ItemId } from '@/data/items';

/** Backpack size; the first HOTBAR_SIZE slots are the hotbar. */
export const INVENTORY_SIZE = 32;
export const HOTBAR_SIZE = 8;

export interface Slot {
  readonly item: ItemId;
  readonly qty: number;
  /** Remaining uses of a tool (or water in a watering can). */
  readonly dur?: number;
  /** How many times the tool has been upgraded at an anvil. */
  readonly plus?: number;
}

export type Inventory = readonly (Slot | null)[];

export type Cost = readonly (readonly [ItemId, number])[];

export const emptyInventory = (size = INVENTORY_SIZE): Inventory => Array.from({ length: size }, () => null);

/** A fresh slot: tools start with full durability, a watering can starts empty. */
export function newSlot(item: ItemId, qty: number): Slot {
  const tool = ITEMS[item].tool;
  if (!tool) return { item, qty };
  return { item, qty, dur: tool.type === 'can' ? 0 : tool.durability };
}

export function countItem(inv: Inventory, item: ItemId): number {
  let n = 0;
  for (const s of inv) if (s && s.item === item) n += s.qty;
  return n;
}

const stackable = (item: ItemId): boolean => ITEMS[item].stack > 1;

/** Put `qty` of `item` into the inventory: top up existing stacks first, then empty slots from the left. */
export function addItem(inv: Inventory, item: ItemId, qty: number): { inv: Inventory; left: number } {
  const max = ITEMS[item].stack;
  const out = inv.slice();
  let left = Math.max(0, Math.floor(qty));
  if (stackable(item)) {
    for (let i = 0; i < out.length && left > 0; i++) {
      const s = out[i];
      if (!s || s.item !== item || s.qty >= max) continue;
      const take = Math.min(left, max - s.qty);
      out[i] = { ...s, qty: s.qty + take };
      left -= take;
    }
  }
  for (let i = 0; i < out.length && left > 0; i++) {
    if (out[i]) continue;
    const take = Math.min(left, max);
    out[i] = newSlot(item, take);
    left -= take;
  }
  return { inv: out, left };
}

/**
 * Put a tool, weapon or other new piece of gear into the tools column (the hotbar slots) when one is free; when the
 * column is full it goes wherever there is room, like anything else.
 */
export function addGear(inv: Inventory, item: ItemId, qty: number): { inv: Inventory; left: number } {
  if (stackable(item)) return addItem(inv, item, qty);
  const out = inv.slice();
  let left = Math.max(0, Math.floor(qty));
  for (let i = 0; i < Math.min(HOTBAR_SIZE, out.length) && left > 0; i++) {
    if (out[i]) continue;
    out[i] = newSlot(item, 1);
    left -= 1;
  }
  return left > 0 ? addItem(out, item, left) : { inv: out, left };
}

/** Remove `qty` of `item`, taking from the back of the backpack first. Null when there is not enough. */
export function removeItem(inv: Inventory, item: ItemId, qty: number): Inventory | null {
  if (countItem(inv, item) < qty) return null;
  const out = inv.slice();
  let need = qty;
  for (let i = out.length - 1; i >= 0 && need > 0; i--) {
    const s = out[i];
    if (!s || s.item !== item) continue;
    const take = Math.min(need, s.qty);
    out[i] = take === s.qty ? null : { ...s, qty: s.qty - take };
    need -= take;
  }
  return out;
}

export function canAfford(inv: Inventory, cost: Cost): boolean {
  return cost.every(([item, n]) => countItem(inv, item) >= n);
}

/** Pay a cost, or null when any ingredient is missing. */
export function spend(inv: Inventory, cost: Cost): Inventory | null {
  let cur: Inventory | null = inv;
  for (const [item, n] of cost) {
    cur = cur && removeItem(cur, item, n);
    if (!cur) return null;
  }
  return cur;
}

/** Drag a slot onto another: stacks of the same item merge, anything else swaps. */
export function moveSlot(inv: Inventory, from: number, to: number): Inventory {
  if (from === to || from < 0 || to < 0 || from >= inv.length || to >= inv.length) return inv;
  const a = inv[from];
  const b = inv[to];
  if (!a) return inv;
  const out = inv.slice();
  if (b && b.item === a.item && stackable(a.item)) {
    const max = ITEMS[a.item].stack;
    const moved = Math.min(a.qty, max - b.qty);
    out[to] = { ...b, qty: b.qty + moved };
    out[from] = moved === a.qty ? null : { ...a, qty: a.qty - moved };
    return out;
  }
  out[from] = b;
  out[to] = a;
  return out;
}

/** Use up one point of durability of the tool in `index`. Tools break at 0; a watering can just runs dry. */
export function wearTool(inv: Inventory, index: number): Inventory {
  const s = inv[index];
  if (!s || s.dur === undefined) return inv;
  const out = inv.slice();
  const dur = s.dur - 1;
  out[index] = dur <= 0 && ITEMS[s.item].tool?.type !== 'can' ? null : { ...s, dur: Math.max(0, dur) };
  return out;
}

/** Set the durability (water) of a slot, clamped to the tool's maximum. */
export function setDurability(inv: Inventory, index: number, dur: number): Inventory {
  const s = inv[index];
  const tool = s && ITEMS[s.item].tool;
  if (!s || !tool) return inv;
  const out = inv.slice();
  out[index] = { ...s, dur: Math.min(tool.durability, Math.max(0, dur)) };
  return out;
}

/** Replace the contents of one slot. */
export function setSlot(inv: Inventory, index: number, slot: Slot | null): Inventory {
  if (index < 0 || index >= inv.length) return inv;
  return inv.map((s, i) => (i === index ? slot : s));
}

/** Remove one item from a slot (eating, planting, placing). */
export function takeOne(inv: Inventory, index: number): Inventory {
  const s = inv[index];
  if (!s) return inv;
  const out = inv.slice();
  out[index] = s.qty <= 1 ? null : { ...s, qty: s.qty - 1 };
  return out;
}

/** Keep a random half of every hotbar stack (rounding the loss up), as a death penalty. Keys and story items are never lost. */
export function loseHalfOfHotbar(inv: Inventory, roll: () => number): Inventory {
  const out = inv.slice();
  for (let i = 0; i < Math.min(HOTBAR_SIZE, out.length); i++) {
    const s = out[i];
    if (!s || ITEMS[s.item].keep) continue;
    if (!stackable(s.item)) {
      if (roll() < 0.5) out[i] = null;
      continue;
    }
    const lost = Math.ceil(s.qty / 2);
    out[i] = lost >= s.qty ? null : { ...s, qty: s.qty - lost };
  }
  return out;
}
