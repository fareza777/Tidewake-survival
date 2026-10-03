import { describe, expect, it } from 'vitest';
import { ITEMS } from '@/data/items';
import { RECIPES } from '@/data/recipes';
import type { Station } from '@/data/structures';
import { availableRecipes, canCraft, craft, hasStation, missingFor } from '@/sim/crafting';
import { addItem, countItem, emptyInventory } from '@/sim/inventory';
import { checkHit } from '@/sim/tools';
import { HAND_DAMAGE } from '@/data/tools';

const none: ReadonlySet<Station> = new Set();
const recipe = (id: string) => RECIPES.find((r) => r.id === id)!;
const withItems = (...pairs: [Parameters<typeof addItem>[1], number][]) =>
  pairs.reduce((inv, [item, n]) => addItem(inv, item, n).inv, emptyInventory());

describe('recipe data', () => {
  it('only uses known items and sensible amounts, with unique ids', () => {
    const ids = new Set<string>();
    for (const r of RECIPES) {
      expect(ids.has(r.id), r.id).toBe(false);
      ids.add(r.id);
      expect(ITEMS[r.out], r.id).toBeDefined();
      expect(r.qty).toBeGreaterThan(0);
      expect(r.cost.length).toBeGreaterThan(0);
      for (const [item, n] of r.cost) {
        expect(ITEMS[item], `${r.id} needs ${item}`).toBeDefined();
        expect(n).toBeGreaterThan(0);
      }
    }
  });

  it('lets a player with nothing but their hands reach every station', () => {
    const handMade = new Set(RECIPES.filter((r) => r.station === 'hand').map((r) => r.out));
    expect(handMade.has('workbench')).toBe(true);
    expect(handMade.has('campfire')).toBe(true);
    expect(handMade.has('axe_wood')).toBe(true);
    // The furnace comes from the workbench, and iron tools need the furnace: no circular dependency.
    expect(recipe('furnace').station).toBe('workbench');
    expect(recipe('iron_ingot').station).toBe('furnace');
  });
});

describe('crafting', () => {
  it('crafts by hand and keeps the input untouched', () => {
    const inv = withItems(['wood', 4]);
    const out = craft(inv, recipe('plank'), none)!;
    expect(countItem(out, 'wood')).toBe(2);
    expect(countItem(out, 'plank')).toBe(2);
    expect(countItem(inv, 'plank')).toBe(0);
  });

  it('needs the station for non-hand recipes', () => {
    const inv = withItems(['plank', 20], ['rope', 5], ['stone', 10]);
    expect(craft(inv, recipe('axe_stone'), none)).toBeNull();
    expect(canCraft(inv, recipe('axe_stone'), new Set<Station>(['workbench']))).toBe(true);
    expect(craft(inv, recipe('axe_stone'), new Set<Station>(['workbench']))).not.toBeNull();
    expect(hasStation('hand', none)).toBe(true);
  });

  it('refuses when an ingredient is missing and reports the shortfall', () => {
    const inv = withItems(['wood', 2], ['fiber', 1]);
    expect(craft(inv, recipe('axe_wood'), none)).toBeNull();
    expect(missingFor(inv, recipe('axe_wood'))).toEqual([['wood', 1], ['fiber', 1]]);
    expect(missingFor(withItems(['wood', 9], ['fiber', 9]), recipe('axe_wood'))).toEqual([]);
  });

  it('does not craft when the product would not fit, and loses nothing', () => {
    let inv = emptyInventory(2);
    inv = addItem(inv, 'axe_wood', 1).inv;
    inv = addItem(inv, 'wood', 2).inv;
    expect(craft(inv, recipe('axe_wood'), none)).toBeNull();
    expect(countItem(inv, 'wood')).toBe(2);
  });

  it('crafts the product even when it takes the freed slot', () => {
    let inv = emptyInventory(1);
    inv = addItem(inv, 'wood', 2).inv;
    const out = craft(inv, recipe('plank'), none)!;
    expect(countItem(out, 'plank')).toBe(2);
  });

  it('lists only recipes whose station is available', () => {
    const hand = availableRecipes(none);
    expect(hand.every((r) => r.station === 'hand')).toBe(true);
    const bench = availableRecipes(new Set<Station>(['workbench']));
    expect(bench.length).toBeGreaterThan(hand.length);
    expect(bench.some((r) => r.station === 'furnace')).toBe(false);
  });
});

describe('checkHit', () => {
  it('lets bare hands chop and mine slowly, but not break ore or crystal', () => {
    expect(checkHit('tree', null)).toEqual({ ok: true, damage: HAND_DAMAGE, stamina: 1, wear: false });
    expect(checkHit('rock', null)).toMatchObject({ ok: true, damage: HAND_DAMAGE });
    expect(checkHit('ore', null)).toEqual({ ok: false, tool: 'pickaxe', tier: 2 });
    expect(checkHit('crystal', null)).toEqual({ ok: false, tool: 'pickaxe', tier: 3 });
  });

  it('scales damage with tool tier and wears the tool', () => {
    expect(checkHit('tree', 'axe_wood')).toEqual({ ok: true, damage: 1, stamina: 2, wear: true });
    expect(checkHit('tree', 'axe_stone')).toMatchObject({ damage: 2 });
    expect(checkHit('tree', 'axe_iron')).toMatchObject({ damage: 3 });
  });

  it('unlocks ore with a stone pickaxe and crystal with an iron one', () => {
    expect(checkHit('ore', 'pickaxe_wood')).toMatchObject({ ok: false });
    expect(checkHit('ore', 'pickaxe_stone')).toMatchObject({ ok: true, damage: 2 });
    expect(checkHit('crystal', 'pickaxe_stone')).toMatchObject({ ok: false });
    expect(checkHit('crystal', 'pickaxe_iron')).toMatchObject({ ok: true, damage: 3 });
  });

  it('treats the wrong tool like bare hands and picks berries with anything', () => {
    expect(checkHit('tree', 'pickaxe_iron')).toMatchObject({ ok: true, damage: HAND_DAMAGE, wear: false });
    expect(checkHit('ore', 'axe_iron')).toMatchObject({ ok: false });
    expect(checkHit('bush', null)).toMatchObject({ ok: true, damage: 1, wear: false });
    expect(checkHit('bush', 'axe_iron')).toMatchObject({ ok: true, damage: 1, wear: false });
  });
});
