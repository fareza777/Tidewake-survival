import { describe, expect, it } from 'vitest';
import { ITEMS, ITEM_IDS, type ItemId } from '@/data/items';
import { RECIPES } from '@/data/recipes';
import { UI_STRINGS } from '@/data/strings';
import { eat, fullVitals, wouldWaste } from '@/sim/vitals';

const weapons = ITEM_IDS.filter((id) => ITEMS[id].weapon);
const recipe = (out: ItemId) => RECIPES.find((r) => r.out === out)!;

describe('weapons', () => {
  it('are the three swords, the bone spear and the bow', () => {
    expect(weapons).toEqual(['sword_wood', 'sword_stone', 'sword_iron', 'spear_bone', 'bow']);
  });

  it('never stack, wear out, and have positive stats', () => {
    for (const id of weapons) {
      const def = ITEMS[id];
      const w = def.weapon!;
      expect(def.stack, id).toBe(1);
      expect(def.tool?.durability, id).toBeGreaterThan(0);
      for (const v of [w.damage, w.reach, w.cooldown, w.stamina]) expect(v, id).toBeGreaterThan(0);
      expect(w.knockback, id).toBeGreaterThanOrEqual(0);
    }
  });

  it('hit harder with every sword tier, and keep tiers matching the name', () => {
    const dmg = (id: ItemId) => ITEMS[id].weapon!.damage;
    expect(dmg('sword_wood')).toBeLessThan(dmg('sword_stone'));
    expect(dmg('sword_stone')).toBeLessThan(dmg('sword_iron'));
    expect([1, 2, 3]).toEqual(['sword_wood', 'sword_stone', 'sword_iron'].map((id) => ITEMS[id as ItemId].tool!.tier));
  });

  it('give melee weapons an arc and the bow none, and let the spear reach furthest of the melee set', () => {
    for (const id of weapons) {
      const w = ITEMS[id].weapon!;
      if (w.kind === 'melee') expect(w.arc, id).toBeGreaterThan(0);
      else expect(w.arc, id).toBe(0);
    }
    expect(ITEMS.spear_bone.weapon!.reach).toBeGreaterThan(ITEMS.sword_iron.weapon!.reach);
    expect(ITEMS.spear_bone.weapon!.arc).toBeLessThan(ITEMS.sword_iron.weapon!.arc);
    expect(ITEMS.bow.weapon!.kind).toBe('bow');
  });
});

describe('meat and healing items', () => {
  it('makes cooked meat much better than raw meat, and honey and bandages heal', () => {
    expect(ITEMS.cooked_meat.food!.hunger).toBeGreaterThan(ITEMS.raw_meat.food!.hunger * 3);
    expect(ITEMS.honey.food!.hp).toBeGreaterThan(0);
    expect(ITEMS.bandage.food).toEqual({ hunger: 0, thirst: 0, hp: 30 });
  });

  it('lets a bandage heal a hurt hero but is wasted at full health', () => {
    const hurt = { ...fullVitals(), hp: 40 };
    expect(wouldWaste(hurt, ITEMS.bandage.food!)).toBe(false);
    expect(eat(hurt, ITEMS.bandage.food!).hp).toBe(70);
    expect(wouldWaste(fullVitals(), ITEMS.bandage.food!)).toBe(true);
  });

  it('stacks the loot and arrows', () => {
    for (const id of ['arrow', 'raw_meat', 'cooked_meat', 'honey', 'bandage', 'gel', 'bone'] as const) {
      expect(ITEMS[id].stack, id).toBeGreaterThan(1);
    }
  });
});

describe('combat recipes', () => {
  it('lets a castaway make a wooden sword by hand but needs a workbench for the rest', () => {
    expect(recipe('sword_wood').station).toBe('hand');
    for (const id of ['sword_stone', 'sword_iron', 'spear_bone', 'bow', 'arrow'] as const) expect(recipe(id).station, id).toBe('workbench');
  });

  it('cooks meat at a campfire and makes bandages by hand', () => {
    expect(recipe('cooked_meat')).toMatchObject({ station: 'campfire', qty: 1, cost: [['raw_meat', 1]] });
    expect(recipe('bandage')).toMatchObject({ station: 'hand', cost: [['fiber', 2], ['gel', 1]] });
  });

  it('gives four arrows per batch', () => {
    expect(recipe('arrow').qty).toBe(4);
  });
});

describe('names', () => {
  it('has English and Indonesian names for every weapon, loot item and the combat messages', () => {
    for (const id of ['sword_wood', 'sword_stone', 'sword_iron', 'spear_bone', 'bow', 'arrow', 'raw_meat', 'cooked_meat', 'honey', 'bandage', 'gel', 'bone']) {
      expect(UI_STRINGS[`item_${id}`], id).toBeDefined();
    }
    for (const key of ['msgNoArrows', 'weaponDamage']) expect(UI_STRINGS[key], key).toBeDefined();
  });
});
