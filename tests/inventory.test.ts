import { describe, expect, it } from 'vitest';
import {
  HOTBAR_SIZE, INVENTORY_SIZE, addItem, canAfford, countItem, emptyInventory, loseHalfOfHotbar, moveSlot, newSlot,
  removeItem, setDurability, spend, takeOne, wearTool, type Inventory,
} from '@/sim/inventory';

const empty = emptyInventory();

describe('addItem', () => {
  it('fills the first free slots and keeps the input untouched', () => {
    const { inv, left } = addItem(empty, 'wood', 5);
    expect(left).toBe(0);
    expect(inv[0]).toEqual({ item: 'wood', qty: 5 });
    expect(empty.every((s) => s === null)).toBe(true);
  });

  it('tops up existing stacks before opening new ones', () => {
    const a = addItem(empty, 'wood', 90).inv;
    const b = addItem(a, 'wood', 20).inv;
    expect(b[0]).toEqual({ item: 'wood', qty: 99 });
    expect(b[1]).toEqual({ item: 'wood', qty: 11 });
  });

  it('reports what did not fit when the backpack is full', () => {
    const full = emptyInventory(2);
    const { inv, left } = addItem(full, 'wood', 250);
    expect(inv).toEqual([{ item: 'wood', qty: 99 }, { item: 'wood', qty: 99 }]);
    expect(left).toBe(52);
  });

  it('never stacks tools and gives them full durability (a watering can starts empty)', () => {
    const { inv } = addItem(empty, 'axe_wood', 2);
    expect(inv[0]).toEqual({ item: 'axe_wood', qty: 1, dur: 40 });
    expect(inv[1]).toEqual({ item: 'axe_wood', qty: 1, dur: 40 });
    expect(newSlot('watering_can', 1).dur).toBe(0);
  });

  it('ignores zero, negative and fractional quantities safely', () => {
    expect(addItem(empty, 'wood', 0).inv).toEqual(empty);
    expect(addItem(empty, 'wood', -4).inv).toEqual(empty);
    expect(addItem(empty, 'wood', 2.9).inv[0]).toEqual({ item: 'wood', qty: 2 });
  });
});

describe('removeItem / spend / canAfford', () => {
  const inv = addItem(addItem(empty, 'wood', 10).inv, 'stone', 4).inv;

  it('removes from the back of the backpack first', () => {
    const two = addItem(addItem(emptyInventory(3), 'wood', 99).inv, 'wood', 5).inv;
    const out = removeItem(two, 'wood', 7)!;
    expect(out[0]).toEqual({ item: 'wood', qty: 97 });
    expect(out[1]).toBeNull();
  });

  it('returns null instead of going negative', () => {
    expect(removeItem(inv, 'wood', 11)).toBeNull();
    expect(removeItem(inv, 'plank', 1)).toBeNull();
    expect(countItem(inv, 'wood')).toBe(10);
  });

  it('pays a whole cost atomically', () => {
    const paid = spend(inv, [['wood', 6], ['stone', 4]])!;
    expect(countItem(paid, 'wood')).toBe(4);
    expect(countItem(paid, 'stone')).toBe(0);
    expect(spend(inv, [['wood', 6], ['stone', 5]])).toBeNull();
    expect(canAfford(inv, [['wood', 10]])).toBe(true);
    expect(canAfford(inv, [['wood', 11]])).toBe(false);
  });
});

describe('moveSlot', () => {
  it('swaps different items and moves into empty slots', () => {
    const inv = addItem(addItem(empty, 'wood', 3).inv, 'stone', 2).inv;
    const swapped = moveSlot(inv, 0, 1);
    expect(swapped[0]).toEqual({ item: 'stone', qty: 2 });
    expect(swapped[1]).toEqual({ item: 'wood', qty: 3 });
    const moved = moveSlot(inv, 0, 5);
    expect(moved[0]).toBeNull();
    expect(moved[5]).toEqual({ item: 'wood', qty: 3 });
  });

  it('merges stacks of the same item up to the limit', () => {
    const inv: Inventory = [{ item: 'wood', qty: 90 }, { item: 'wood', qty: 20 }, null, null];
    const merged = moveSlot(inv, 1, 0);
    expect(merged[0]?.qty).toBe(99);
    expect(merged[1]?.qty).toBe(11);
    const other = moveSlot(inv, 0, 1);
    expect(other[1]?.qty).toBe(99);
    expect(other[0]?.qty).toBe(11);
  });

  it('ignores invalid moves', () => {
    const inv = addItem(empty, 'wood', 1).inv;
    expect(moveSlot(inv, 0, 0)).toBe(inv);
    expect(moveSlot(inv, 0, 99)).toBe(inv);
    expect(moveSlot(inv, -1, 2)).toBe(inv);
    expect(moveSlot(inv, 3, 4)).toBe(inv);
  });
});

describe('tools', () => {
  it('wears a tool down and breaks it at zero', () => {
    let inv = addItem(empty, 'axe_wood', 1).inv;
    inv = setDurability(inv, 0, 2);
    inv = wearTool(inv, 0);
    expect(inv[0]?.dur).toBe(1);
    inv = wearTool(inv, 0);
    expect(inv[0]).toBeNull();
  });

  it('lets a watering can run dry without breaking and caps refills at capacity', () => {
    let inv = addItem(empty, 'watering_can', 1).inv;
    inv = setDurability(inv, 0, 1);
    inv = wearTool(inv, 0);
    expect(inv[0]).toEqual({ item: 'watering_can', qty: 1, dur: 0 });
    expect(setDurability(inv, 0, 9999)[0]?.dur).toBe(40);
    expect(setDurability(inv, 0, -5)[0]?.dur).toBe(0);
  });

  it('does nothing for slots without a tool', () => {
    const inv = addItem(empty, 'wood', 1).inv;
    expect(wearTool(inv, 0)).toBe(inv);
    expect(wearTool(inv, 3)).toBe(inv);
    expect(setDurability(inv, 0, 5)).toBe(inv);
  });
});

describe('takeOne', () => {
  it('removes one item and empties the slot at the last one', () => {
    const inv = addItem(empty, 'carrot', 2).inv;
    const once = takeOne(inv, 0);
    expect(once[0]?.qty).toBe(1);
    expect(takeOne(once, 0)[0]).toBeNull();
    expect(takeOne(inv, 9)).toBe(inv);
  });
});

describe('loseHalfOfHotbar', () => {
  it('halves stacks on the hotbar and leaves the rest of the backpack alone', () => {
    let inv = addItem(empty, 'wood', 10).inv;
    inv = moveSlot(inv, 0, 20);
    inv = addItem(inv, 'stone', 5).inv;
    inv = addItem(inv, 'carrot', 1).inv;
    const out = loseHalfOfHotbar(inv, () => 0.9);
    expect(out[20]).toEqual({ item: 'wood', qty: 10 });
    expect(out[0]).toEqual({ item: 'stone', qty: 2 });
    expect(out[1]).toBeNull();
  });

  it('breaks or keeps a tool depending on the roll', () => {
    const inv = addItem(empty, 'axe_wood', 1).inv;
    expect(loseHalfOfHotbar(inv, () => 0.2)[0]).toBeNull();
    expect(loseHalfOfHotbar(inv, () => 0.8)[0]?.item).toBe('axe_wood');
  });

  it('has the sizes the spec calls for', () => {
    expect(INVENTORY_SIZE).toBe(32);
    expect(HOTBAR_SIZE).toBe(8);
  });
});
