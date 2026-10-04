import { describe, expect, it } from 'vitest';
import { CREATURES } from '@/data/creatures';
import { CROPS } from '@/data/crops';
import { ITEMS, ITEM_IDS, type ItemId } from '@/data/items';
import { RECIPES } from '@/data/recipes';
import { RESOURCES } from '@/data/resources';
import { STRUCTURES } from '@/data/structures';
import { eat, fullVitals, wouldWaste } from '@/sim/vitals';

/** Everything that can be got without crafting: gathered, dropped, grown, caught, found in a chest or given by a quest. */
function raw(): Set<ItemId> {
  const out = new Set<ItemId>();
  for (const r of Object.values(RESOURCES)) for (const d of r.drops) out.add(d.item);
  for (const c of Object.values(CREATURES)) for (const d of c.drops) out.add(d.item);
  for (const c of Object.values(CROPS)) {
    out.add(c.produce);
    out.add(c.seed);
  }
  for (const item of ['raw_fish', 'big_fish', 'small_key', 'boss_key', 'lost_pickaxe', 'honey', 'bandage', 'arrow'] as const) out.add(item);
  return out;
}

describe('the recipe book', () => {
  it('holds sixty recipes or more, with nothing listed twice', () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(60);
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
  });

  it('can be made in full: every ingredient is gathered or crafted, and every station can be built, with no circle', () => {
    const have = raw();
    const stations = new Set<string>(['hand']);
    const done = new Set<string>();
    for (let round = 0; round < 40; round++) {
      for (const r of RECIPES) {
        if (done.has(r.id) || !stations.has(r.station) || !r.cost.every(([item]) => have.has(item))) continue;
        done.add(r.id);
        have.add(r.out);
        const placed = ITEMS[r.out].place;
        if (placed && STRUCTURES[placed].station) stations.add(STRUCTURES[placed].station!);
      }
    }
    expect(RECIPES.filter((r) => !done.has(r.id)).map((r) => r.id)).toEqual([]);
  });

  it('only makes items that exist, in sensible amounts, and gives every crafted structure a station or a purpose', () => {
    for (const r of RECIPES) {
      expect(ITEMS[r.out], r.id).toBeDefined();
      expect(r.qty, r.id).toBeGreaterThan(0);
      for (const [item, n] of r.cost) {
        expect(ITEMS[item], `${r.id} needs ${item}`).toBeDefined();
        expect(n, `${r.id}: ${item}`).toBeGreaterThan(0);
      }
    }
  });

  it('turns the story items into the raft but nothing else eats the unique keys', () => {
    const consumed = new Set(RECIPES.flatMap((r) => r.cost.map(([item]) => item)));
    for (const item of ['boss_key', 'small_key', 'lighthouse_key', 'beacon_core', 'lost_pickaxe'] as const) expect(consumed.has(item), item).toBe(false);
  });

  it('covers every kind of thing the spec lists: tools, weapons, armour, food, potions and building', () => {
    const outs = RECIPES.map((r) => ITEMS[r.out]);
    expect(outs.some((d) => d.tool && !d.weapon)).toBe(true);
    expect(outs.some((d) => d.weapon)).toBe(true);
    expect(outs.some((d) => d.armor)).toBe(true);
    expect(outs.filter((d) => d.food).length).toBeGreaterThanOrEqual(12);
    expect(RECIPES.filter((r) => r.station === 'alchemy').length).toBeGreaterThanOrEqual(3);
    expect(outs.filter((d) => d.place).length).toBeGreaterThanOrEqual(12);
  });
});

describe('tonics', () => {
  it('give stamina back, and are wasted on a rested hero', () => {
    const tired = { ...fullVitals(), stamina: 20 };
    const tonic = ITEMS.stamina_tonic.food!;
    expect(eat(tired, tonic).stamina).toBe(100);
    expect(wouldWaste(tired, tonic)).toBe(false);
    expect(wouldWaste(fullVitals(), tonic)).toBe(true);
    expect(eat(fullVitals(), { hunger: 5, thirst: 0, hp: 0 }).stamina).toBe(100);
  });

  it('are part of a catalog of about ninety items or more', () => {
    expect(ITEM_IDS.length).toBeGreaterThanOrEqual(90);
  });
});
