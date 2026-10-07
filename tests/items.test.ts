import { describe, expect, it } from 'vitest';
import { CROPS } from '@/data/crops';
import { ITEMS, ITEM_IDS, isItemId } from '@/data/items';
import { RESOURCES } from '@/data/resources';
import { STRUCTURES } from '@/data/structures';

describe('item catalog', () => {
  it('keys every entry by its own id, with a stack size and an icon', () => {
    for (const id of ITEM_IDS) {
      const def = ITEMS[id];
      expect(def.id).toBe(id);
      expect(def.stack).toBeGreaterThan(0);
      expect(def.icon.frame.length).toBeGreaterThan(0);
    }
  });

  it('never stacks tools and gives them a positive durability', () => {
    for (const def of Object.values(ITEMS)) {
      if (!def.tool) continue;
      expect(def.stack).toBe(1);
      expect(def.tool.durability).toBeGreaterThan(0);
    }
  });

  it('keeps tool tiers consistent with the item name', () => {
    expect(ITEMS.axe_wood.tool?.tier).toBe(1);
    expect(ITEMS.axe_stone.tool?.tier).toBe(2);
    expect(ITEMS.axe_iron.tool?.tier).toBe(3);
    expect(ITEMS.pickaxe_iron.tool?.tier).toBe(3);
  });

  it('links placeable items to real structures and seeds to real crops', () => {
    for (const def of Object.values(ITEMS)) {
      if (def.place) expect(STRUCTURES[def.place], def.id).toBeDefined();
      if (def.seed) expect(CROPS[def.seed].seed, def.id).toBe(def.id);
    }
    for (const s of Object.values(STRUCTURES)) expect(ITEMS[s.id].place).toBe(s.id);
  });

  it('makes food worth eating', () => {
    for (const def of Object.values(ITEMS)) {
      if (!def.food) continue;
      expect(def.food.hunger + def.food.thirst + def.food.hp + (def.food.stamina ?? 0) + (def.food.warmth ?? 0) + (def.food.buff ? 1 : 0), def.id).toBeGreaterThan(0);
    }
    expect(ITEMS.roasted_corn.food!.hunger).toBeGreaterThan(ITEMS.corn.food!.hunger);
    expect(ITEMS.coconut.food!.thirst).toBeGreaterThan(ITEMS.coconut.food!.hunger);
  });

  it('only lets nodes drop items that exist, with sound chances', () => {
    for (const [kind, def] of Object.entries(RESOURCES)) {
      for (const d of def.drops) {
        expect(isItemId(d.item), `${kind} drops ${d.item}`).toBe(true);
        if (d.chance !== undefined) {
          expect(d.chance).toBeGreaterThan(0);
          expect(d.chance).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('can be reached from the island: fibre, wood and stone come from nodes', () => {
    const dropped = new Set(Object.values(RESOURCES).flatMap((r) => r.drops.map((d) => d.item)));
    for (const item of ['wood', 'stone', 'fiber', 'iron_ore', 'coconut', 'berries', 'carrot_seed', 'corn_seed', 'pumpkin_seed', 'turnip_seed'] as const) {
      expect(dropped.has(item), item).toBe(true);
    }
  });

  it('recognises item ids safely', () => {
    expect(isItemId('wood')).toBe(true);
    expect(isItemId('toString')).toBe(false);
    expect(isItemId(5)).toBe(false);
  });
});
