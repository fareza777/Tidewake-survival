import { describe, expect, it } from 'vitest';
import { newSlot, parseSlot } from '@/core/saveData';
import { ITEMS } from '@/data/items';
import { RECIPES } from '@/data/recipes';
import { gearStats, noEquipment } from '@/sim/equipment';
import { addItem } from '@/sim/inventory';
import { modsOf, neutralMods } from '@/sim/mods';
import { applyAction, craftRecipe, rewardKill, sessionFromSlot, upgradeItem, repairItem, type Session } from '@/sim/session';
import { MAX_LEVEL, SKILLS, gainXp, levelOf, noSkills, parseSkills, progressOf, rankOf, xpToReach } from '@/sim/skills';
import { UPGRADE_MAX, maxDurability, plusMult, repairCost, upgradeCost, upgradeSlot } from '@/sim/upgrade';
import type { ResourceNode } from '@/sim/world/types';

const slot = () => newSlot(0, 'Ari', 1234, 'normal', { x: 50, y: 50 }, { day: 1, t: 100 }, 1000);
const base = (over: Partial<Session> = {}): Session => ({ ...sessionFromSlot(slot()), ...over });
const tree: ResourceNode = { id: 1, kind: 'tree', x: 51, y: 50, variant: 0 };

describe('skills', () => {
  it('start at level 1 and climb with experience, each level costing more than the last', () => {
    expect(levelOf(0)).toBe(1);
    expect(xpToReach(1)).toBe(0);
    for (let n = 2; n <= MAX_LEVEL; n++) expect(xpToReach(n)).toBeGreaterThan(xpToReach(n - 1));
    expect(levelOf(xpToReach(5))).toBe(5);
    expect(levelOf(xpToReach(5) - 1)).toBe(4);
    expect(levelOf(10_000_000)).toBe(MAX_LEVEL);
  });

  it('say how far into a level the skill is, and nothing is left at the top', () => {
    const p = progressOf(xpToReach(3) + 10);
    expect(p.level).toBe(3);
    expect(p.into).toBe(10);
    expect(p.need).toBeGreaterThan(10);
    expect(progressOf(xpToReach(MAX_LEVEL)).need).toBe(0);
  });

  it('report the level reached by a gain, and never change the input', () => {
    const before = noSkills();
    const up = gainXp(before, 'mining', xpToReach(2));
    expect(up.leveledTo).toBe(2);
    expect(up.skills.mining).toBe(xpToReach(2));
    expect(before.mining).toBe(0);
    expect(gainXp(before, 'mining', 1).leveledTo).toBeNull();
    expect(gainXp(before, 'mining', 0).skills).toBe(before);
    expect(gainXp(before, 'mining', -5).skills).toBe(before);
  });

  it('rank the hero by the sum of his levels, and read untrusted saves safely', () => {
    expect(rankOf(noSkills())).toBe(1);
    expect(rankOf({ ...noSkills(), combat: xpToReach(4), farming: xpToReach(2) })).toBe(1 + 3 + 1);
    expect(parseSkills(null)).toEqual(noSkills());
    expect(parseSkills({ combat: 'lots', mining: -4, woodcutting: 1e12 }).combat).toBe(0);
    expect(parseSkills({ mining: -4 }).mining).toBe(0);
    expect(parseSkills({ woodcutting: 1e12 }).woodcutting).toBe(xpToReach(MAX_LEVEL));
    expect(SKILLS).toHaveLength(6);
  });
});

describe('what skills and gear add', () => {
  it('give nothing to a new hero', () => {
    const m = modsOf(noSkills(), noEquipment());
    expect(m).toEqual({ ...neutralMods() });
  });

  it('make a practised hero better at his trade', () => {
    const skilled = { ...noSkills(), woodcutting: xpToReach(MAX_LEVEL), combat: xpToReach(6), crafting: xpToReach(4) };
    const m = modsOf(skilled, noEquipment());
    expect(m.chopDamage).toBeGreaterThan(1.5);
    expect(m.staminaWood).toBeLessThan(0.85);
    expect(m.yieldWood).toBeGreaterThan(0.3);
    expect(m.meleeDamage).toBeGreaterThan(1.2);
    expect(m.crit).toBeGreaterThan(0.05);
    expect(m.craftSave).toBeGreaterThan(0.05);
    expect(m.mineDamage).toBe(1);
  });

  it('add up what the worn gear gives, and use each piece only in its own slot', () => {
    const eq = { armor: 'armor_steel', helm: 'helm_crystal', boots: 'boots_mithril', charm: 'ring_might' } as const;
    const g = gearStats(eq);
    expect(g.defense).toBe(ITEMS.armor_steel.armor!.defense + ITEMS.helm_crystal.armor!.defense + ITEMS.boots_mithril.armor!.defense);
    expect(g.speed).toBeCloseTo(0.08);
    expect(g.damage).toBeCloseTo(0.12);
    const m = modsOf(noSkills(), eq);
    expect(m.speed).toBeCloseTo(1.08);
    expect(m.meleeDamage).toBeCloseTo(1.12);
    expect(m.luck).toBeGreaterThan(0);
  });
});

describe('the anvil', () => {
  const sword = (plus = 0, dur?: number) => ({ item: 'sword_iron' as const, qty: 1, dur: dur ?? maxDurability('sword_iron', plus), ...(plus ? { plus } : {}) });

  it('makes a tool hit harder and last longer with every level, up to a limit', () => {
    expect(plusMult(0)).toBe(1);
    expect(plusMult(3)).toBeGreaterThan(plusMult(2));
    expect(maxDurability('sword_iron', 2)).toBeGreaterThan(maxDurability('sword_iron', 0));
    expect(upgradeCost(sword(UPGRADE_MAX))).toBeNull();
    expect(upgradeCost({ item: 'watering_can', qty: 1, dur: 10 })).toBeNull();
    expect(upgradeCost({ item: 'wood', qty: 5 })).toBeNull();
  });

  it('charges more for each level and works each tier with its own metal', () => {
    const a = upgradeCost(sword(0))!;
    const b = upgradeCost(sword(1))!;
    expect(a[0][0]).toBe('iron_ingot');
    expect(b[0][1]).toBeGreaterThan(a[0][1]);
    expect(upgradeCost({ item: 'sword_steel', qty: 1, dur: 100 })![0][0]).toBe('steel_ingot');
    expect(upgradeCost({ item: 'axe_wood', qty: 1, dur: 10 })![0][0]).toBe('plank');
  });

  it('pays for the upgrade, restores the tool and keeps the level', () => {
    let inv = addItem(addItem([...Array(32)].map(() => null), 'sword_iron', 1).inv, 'iron_ingot', 20).inv;
    inv = inv.map((s, i) => (i === 0 && s ? { ...s, dur: 5 } : s));
    const up = upgradeSlot(inv, 0)!;
    expect(up[0]).toMatchObject({ item: 'sword_iron', plus: 1, dur: maxDurability('sword_iron', 1) });
    expect(up.find((s) => s?.item === 'iron_ingot')!.qty).toBe(20 - upgradeCost(sword(0))![0][1]);
    expect(upgradeSlot(addItem([...Array(32)].map(() => null), 'sword_iron', 1).inv, 0)).toBeNull();
  });

  it('repairs a worn tool for a little metal, and only a worn one', () => {
    let inv = addItem(addItem([...Array(32)].map(() => null), 'sword_iron', 1).inv, 'iron_ingot', 5).inv;
    expect(repairCost(inv[0]!)).toBeNull();
    inv = inv.map((s, i) => (i === 0 && s ? { ...s, dur: 20 } : s));
    expect(repairCost(inv[0]!)).not.toBeNull();
  });

  it('is only used at an anvil, and says when it cannot help', () => {
    let s = base();
    s = { ...s, inventory: addItem(addItem(s.inventory, 'axe_stone', 1).inv, 'stone', 30).inv };
    expect(upgradeItem(s, 0, new Set()).session).toBe(s);
    const done = upgradeItem(s, 0, new Set(['anvil']));
    expect(done.session.inventory[0]).toMatchObject({ item: 'axe_stone', plus: 1 });
    expect(done.fx.map((f) => f.t)).toContain('upgraded');
    expect(done.session.skills.crafting).toBeGreaterThan(0);
    const broke = base();
    expect(upgradeItem(broke, 0, new Set(['anvil'])).fx.map((f) => f.t)).toEqual(['say']);
    expect(repairItem(broke, 0, new Set(['anvil'])).fx.map((f) => f.t)).toEqual(['say']);
  });

  it('survives the save: an upgraded tool keeps its level and its longer life', () => {
    const raw = JSON.parse(JSON.stringify(slot()));
    raw.inventory[0] = { item: 'sword_iron', qty: 1, dur: maxDurability('sword_iron', 3), plus: 3 };
    raw.inventory[1] = { item: 'sword_iron', qty: 1, dur: 99999, plus: 99 };
    raw.inventory[2] = { item: 'watering_can', qty: 1, dur: 5, plus: 4 };
    const parsed = parseSlot(raw, 0)!;
    expect(parsed.inventory[0]).toMatchObject({ plus: 3, dur: maxDurability('sword_iron', 3) });
    expect(parsed.inventory[1]).toMatchObject({ plus: UPGRADE_MAX, dur: maxDurability('sword_iron', UPGRADE_MAX) });
    expect(parsed.inventory[2]!.plus).toBeUndefined();
  });
});

describe('progress in play', () => {
  const chop = (s: Session, damage = 1) => applyAction(s, { kind: 'hit', node: tree, damage, stamina: 1, wear: false }, { x: 50.5, y: 50.5 });

  it('gives woodcutting experience for every blow, more for the felling blow, and announces a level', () => {
    let s = base();
    const first = chop(s);
    expect(first.session.skills.woodcutting).toBeGreaterThan(0);
    s = { ...s, skills: { ...s.skills, woodcutting: xpToReach(2) - 1 } };
    const r = chop(s);
    expect(r.fx.find((f) => f.t === 'levelUp')).toMatchObject({ skill: 'woodcutting', level: 2 });
  });

  it('gives combat experience for a kill, three times as much for a boss', () => {
    const slime = rewardKill(base(), 'slime').session.skills.combat;
    const boss = rewardKill(base(), 'mossback').session.skills.combat;
    expect(slime).toBeGreaterThan(0);
    expect(boss).toBeGreaterThan(slime * 3);
  });

  it('keeps recipes with a crafting level locked until the hero has it', () => {
    const anvil = RECIPES.find((r) => r.out === 'anvil')!;
    let s = base();
    s = { ...s, inventory: addItem(addItem(addItem(s.inventory, 'iron_ingot', 20).inv, 'stone', 20).inv, 'plank', 10).inv };
    const stations = new Set(['workbench'] as const);
    expect(craftRecipe(s, anvil, stations).session).toBe(s);
    s = { ...s, skills: { ...s.skills, crafting: xpToReach(anvil.lvl ?? 1) } };
    const made = craftRecipe(s, anvil, stations);
    expect(made.session.inventory.some((x) => x?.item === 'anvil')).toBe(true);
    expect(made.session.skills.crafting).toBeGreaterThan(s.skills.crafting);
  });

  it('makes a seasoned cook feed the hero better', () => {
    const food = ITEMS.cooked_meat.food!;
    const plain = applyAction({ ...base(), vitals: { hp: 50, hunger: 10, thirst: 100, stamina: 100 }, inventory: addItem(base().inventory, 'cooked_meat', 1).inv }, { kind: 'eat', food }, { x: 1, y: 1 });
    const cook = applyAction({ ...base(), skills: { ...noSkills(), cooking: xpToReach(8) }, vitals: { hp: 50, hunger: 10, thirst: 100, stamina: 100 }, inventory: addItem(base().inventory, 'cooked_meat', 1).inv }, { kind: 'eat', food }, { x: 1, y: 1 });
    expect(cook.session.vitals.hunger).toBeGreaterThan(plain.session.vitals.hunger);
  });
});

describe('the new tiers', () => {
  it('can all be made: steel needs coal, mithril needs ore, and every piece has a recipe', () => {
    for (const id of ['axe_steel', 'pickaxe_steel', 'sword_steel', 'spear_steel', 'armor_steel', 'helm_steel', 'boots_steel', 'sword_mithril', 'armor_mithril', 'ring_might'] as const) {
      expect(RECIPES.some((r) => r.out === id), id).toBe(true);
    }
    expect(RECIPES.find((r) => r.out === 'steel_ingot')!.cost.some(([i]) => i === 'coal')).toBe(true);
    expect(RECIPES.find((r) => r.out === 'mithril_ingot')!.cost.some(([i]) => i === 'mithril_ore')).toBe(true);
  });

  it('get stronger up the ladder', () => {
    const dmg = (id: 'sword_iron' | 'sword_crystal' | 'sword_steel' | 'sword_mithril') => ITEMS[id].weapon!.damage;
    expect(dmg('sword_iron')).toBeLessThan(dmg('sword_crystal'));
    expect(dmg('sword_crystal')).toBeLessThan(dmg('sword_steel'));
    expect(dmg('sword_steel')).toBeLessThan(dmg('sword_mithril'));
    expect(ITEMS.pickaxe_steel.tool!.tier).toBe(4);
    expect(ITEMS.pickaxe_mithril.tool!.tier).toBe(5);
  });
});
