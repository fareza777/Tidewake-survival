import { describe, expect, it } from 'vitest';
import { ITEMS, type ItemId } from '@/data/items';
import { UI_STRINGS } from '@/data/strings';
import { addItem, emptyInventory } from '@/sim/inventory';

const STORY: ItemId[] = ['compass', 'hull_planks', 'lighthouse_key'];

describe('dungeon items', () => {
  it('has keys that stack a little, and story items that are one of a kind', () => {
    expect(ITEMS.small_key.stack).toBeGreaterThan(1);
    expect(ITEMS.small_key.stack).toBeLessThanOrEqual(9);
    expect(ITEMS.boss_key.stack).toBe(1);
    for (const id of STORY) expect(ITEMS[id].stack, id).toBe(1);
  });

  it('gives every one of them an icon frame and a name in both languages', () => {
    for (const id of ['small_key', 'boss_key', ...STORY] as const) {
      expect(ITEMS[id].icon.frame, id).toBe(id);
      expect(UI_STRINGS[`item_${id}`], id).toBeDefined();
    }
  });

  it('are plain items: no tool, weapon, armour, food or placement', () => {
    for (const id of ['small_key', 'boss_key', ...STORY] as const) {
      const d = ITEMS[id];
      expect([d.tool, d.weapon, d.armor, d.food, d.place, d.seed], id).toEqual([undefined, undefined, undefined, undefined, undefined, undefined]);
    }
  });

  it('go into the backpack like anything else, and keys merge', () => {
    let inv = addItem(emptyInventory(), 'small_key', 2).inv;
    inv = addItem(inv, 'small_key', 1).inv;
    expect(inv[0]).toEqual({ item: 'small_key', qty: 3 });
    expect(addItem(inv, 'compass', 1).inv[1]).toEqual({ item: 'compass', qty: 1 });
  });
});
