import { describe, expect, it } from 'vitest';
import { newSlot } from '@/core/saveData';
import { CROPS } from '@/data/crops';
import { RECIPES } from '@/data/recipes';
import type { Station } from '@/data/structures';
import type { Action } from '@/sim/actions';
import { DAY_SECONDS } from '@/sim/daynight';
import { emptyFarm, plotAt, till, plant, water, advanceDay } from '@/sim/farm';
import { RESOURCES } from '@/data/resources';
import { RESPAWN_VITALS } from '@/sim/death';
import { emptyGather, isAlive } from '@/sim/gather';
import { addItem, countItem, emptyInventory, setDurability } from '@/sim/inventory';
import { emptyStructures, placeStructure, setStructureInventory } from '@/sim/structures';
import {
  applyAction, collapse, craftRecipe, moveInventorySlot, rollDay, selectSlot, sessionFromSlot, sessionToSlot, tickSession,
  transferStack, type Session,
} from '@/sim/session';
import { B, WORLD_SIZE, idx, type ResourceNode } from '@/sim/world/types';

const slot = () => newSlot(0, 'Ari', 1234, 'normal', { x: 50, y: 50 }, { day: 1, t: 100 }, 1000);
const base = (over: Partial<Session> = {}): Session => ({ ...sessionFromSlot(slot()), ...over });
const give = (s: Session, ...pairs: [Parameters<typeof addItem>[1], number][]): Session => ({
  ...s, inventory: pairs.reduce((inv, [item, n]) => addItem(inv, item, n).inv, s.inventory),
});
const pos = { x: 50.5, y: 50.5 };
const tree: ResourceNode = { id: 3, kind: 'tree', x: 51, y: 50, variant: 0 };
const say = (s: ReturnType<typeof applyAction>) => s.fx.filter((f) => f.t === 'say');

describe('session basics', () => {
  it('round-trips through a save slot', () => {
    const s = give(base(), ['wood', 4]);
    const out = sessionToSlot(slot(), s, { x: 1.5, y: 2.5 });
    expect(out.player).toEqual({ x: 1.5, y: 2.5 });
    expect(sessionFromSlot(out)).toEqual(s);
  });

  it('ticks the clock and the vital meters', () => {
    const s = tickSession(base(), 10, B.FOREST, false);
    expect(s.clock.t).toBeCloseTo(110);
    expect(s.playTime).toBe(10);
    expect(s.vitals.hunger).toBeLessThan(100);
  });

  it('selects only hotbar slots', () => {
    expect(selectSlot(base(), 5).selected).toBe(5);
    expect(selectSlot(base(), 8).selected).toBe(0);
    expect(selectSlot(base(), -1).selected).toBe(0);
  });

  it('moves inventory slots', () => {
    const s = moveInventorySlot(give(base(), ['wood', 2]), 0, 9);
    expect(s.inventory[9]).toEqual({ item: 'wood', qty: 2 });
  });
});

describe('hitting resource nodes', () => {
  const hit = (over: Partial<Extract<Action, { kind: 'hit' }>> = {}): Action => ({ kind: 'hit', node: tree, damage: 99, stamina: 2, wear: true, ...over });

  it('collects drops, spends stamina and wears the tool', () => {
    const s = give(base(), ['axe_wood', 1]);
    const r = applyAction(s, hit(), pos);
    expect(countItem(r.session.inventory, 'wood')).toBeGreaterThanOrEqual(2);
    expect(r.session.vitals.stamina).toBe(98);
    expect(r.session.inventory[0]?.dur).toBe(39);
    expect(isAlive(r.session.gather, tree.id)).toBe(false);
    expect(r.fx).toContainEqual({ t: 'gone', id: tree.id });
    expect(r.fx).toContainEqual({ t: 'swing' });
    expect(r.fx.some((f) => f.t === 'gain' && f.item === 'wood')).toBe(true);
    expect(countItem(s.inventory, 'wood')).toBe(0);
  });

  it('only chips a node when damage is low and gives nothing yet', () => {
    const r = applyAction(base(), hit({ damage: 0.34, wear: false }), pos);
    expect(r.session.gather.hp[tree.id]).toBeCloseTo(RESOURCES.tree.hp - 0.34);
    expect(r.fx.some((f) => f.t === 'gain')).toBe(false);
    expect(r.fx).toContainEqual({ t: 'hit', id: tree.id });
  });

  it('is deterministic for the same state', () => {
    const a = applyAction(base(), hit({ wear: false }), pos);
    const b = applyAction(base(), hit({ wear: false }), pos);
    expect(a.fx).toEqual(b.fx);
  });

  it('announces a broken tool', () => {
    let s = give(base(), ['axe_wood', 1]);
    s = { ...s, inventory: setDurability(s.inventory, 0, 1) };
    const r = applyAction(s, hit({ damage: 0.1 }), pos);
    expect(r.session.inventory[0]).toBeNull();
    expect(say(r)).toEqual([{ t: 'say', key: 'msgToolBroke', vars: { item: 'item_axe_wood' }, translate: ['item'] }]);
  });

  it('says so when the backpack is full and keeps what fits', () => {
    let s = base();
    s = { ...s, inventory: emptyInventory(1) };
    s = give(s, ['stone', 99]);
    const r = applyAction(s, hit({ wear: false, damage: 99 }), pos);
    expect(say(r).some((f) => f.t === 'say' && f.key === 'msgFull')).toBe(true);
    expect(r.session.inventory[0]).toEqual({ item: 'stone', qty: 99 });
  });
});

describe('other actions', () => {
  it('places a structure and uses up the item', () => {
    const s = give(base(), ['campfire', 2]);
    const r = applyAction(s, { kind: 'place', type: 'campfire', x: 51, y: 50 }, pos);
    expect(r.session.structures.list).toHaveLength(1);
    expect(countItem(r.session.inventory, 'campfire')).toBe(1);
    expect(r.fx[0]).toMatchObject({ t: 'built', structure: { type: 'campfire', x: 51, y: 50 } });
  });

  it('tills, plants and waters step by step', () => {
    const tile = idx(51, 50);
    let s = give(base(), ['hoe', 1], ['carrot_seed', 2], ['watering_can', 1]);
    s = applyAction(s, { kind: 'till', x: 51, y: 50, stamina: 2 }, pos).session;
    expect(plotAt(s.farm, tile)).toBeDefined();
    expect(s.vitals.stamina).toBe(98);
    s = { ...s, selected: 1 };
    s = applyAction(s, { kind: 'plant', x: 51, y: 50, crop: 'carrot' }, pos).session;
    expect(plotAt(s.farm, tile)?.crop).toBe('carrot');
    expect(countItem(s.inventory, 'carrot_seed')).toBe(1);
    s = { ...s, selected: 2, inventory: setDurability(s.inventory, 2, 3) };
    s = applyAction(s, { kind: 'water', x: 51, y: 50 }, pos).session;
    expect(plotAt(s.farm, tile)?.watered).toBe(true);
    expect(s.inventory[2]?.dur).toBe(2);
  });

  it('refills a watering can to capacity', () => {
    const s = give(base(), ['watering_can', 1]);
    const r = applyAction(s, { kind: 'refill', x: 1, y: 1 }, pos);
    expect(r.session.inventory[0]?.dur).toBe(40);
  });

  it('eats and drinks', () => {
    let s = give(base(), ['roasted_corn', 2]);
    s = { ...s, vitals: { ...s.vitals, hunger: 20, thirst: 20 } };
    const eaten = applyAction(s, { kind: 'eat', food: { hunger: 28, thirst: 0, hp: 4 } }, pos);
    expect(eaten.session.vitals.hunger).toBe(48);
    expect(countItem(eaten.session.inventory, 'roasted_corn')).toBe(1);
    const drunk = applyAction(s, { kind: 'drink', x: 1, y: 1 }, pos);
    expect(drunk.session.vitals.thirst).toBe(45);
  });

  it('harvests a ripe crop into the backpack and leaves tilled soil', () => {
    const tile = idx(51, 50);
    let farm = plant(till(emptyFarm(), tile), tile, 'corn')!;
    for (let d = 0; d < CROPS.corn.growDays; d++) farm = advanceDay(water(farm, tile));
    const r = applyAction(base({ farm }), { kind: 'harvest', x: 51, y: 50 }, pos);
    expect(countItem(r.session.inventory, 'corn')).toBeGreaterThanOrEqual(1);
    expect(plotAt(r.session.farm, tile)).toEqual({ crop: null, growth: 0, watered: false });
    expect(applyAction(base(), { kind: 'harvest', x: 51, y: 50 }, pos).fx).toEqual([]);
  });

  it('opens stations and does nothing for none', () => {
    const structures = placeStructure(emptyStructures(), 'workbench', 51, 50);
    const st = structures.list[0];
    expect(applyAction(base(), { kind: 'open', structure: st }, pos).fx).toEqual([{ t: 'open', structure: st }]);
    expect(applyAction(base(), { kind: 'none' }, pos).fx).toEqual([]);
  });

  it('turns every blocked reason into a message', () => {
    const cases: [Action, string][] = [
      [{ kind: 'blocked', reason: 'needsTool', tool: 'pickaxe', tier: 2 }, 'msgNeedsTool'],
      [{ kind: 'blocked', reason: 'tired' }, 'msgTired'],
      [{ kind: 'blocked', reason: 'saltWater' }, 'msgSaltWater'],
      [{ kind: 'blocked', reason: 'canEmpty' }, 'msgCanEmpty'],
      [{ kind: 'blocked', reason: 'chestNotEmpty' }, 'msgChestNotEmpty'],
      [{ kind: 'blocked', reason: 'cannotPlace', why: 'water' }, 'msgPlace_water'],
    ];
    for (const [action, key] of cases) {
      const fx = applyAction(base(), action, pos).fx;
      expect(fx).toHaveLength(1);
      expect(fx[0]).toMatchObject({ t: 'say', key });
    }
    expect(applyAction(base(), cases[0][0], pos).fx[0]).toMatchObject({ vars: { tool: 'tool_pickaxe', tier: 2 }, translate: ['tool'] });
  });
});

describe('taking buildings down', () => {
  it('returns the item to the backpack and removes the structure', () => {
    const structures = placeStructure(emptyStructures(), 'fence', 51, 50);
    const r = applyAction(base({ structures }), { kind: 'pickup', structure: structures.list[0] }, pos);
    expect(r.session.structures.list).toHaveLength(0);
    expect(countItem(r.session.inventory, 'fence')).toBe(1);
    expect(r.fx).toEqual([{ t: 'unbuilt', id: 1 }, { t: 'gain', item: 'fence', qty: 1 }]);
  });

  it('leaves the building standing when the backpack has no room', () => {
    const structures = placeStructure(emptyStructures(), 'workbench', 51, 50);
    const full = base({ structures, inventory: addItem(emptyInventory(1), 'stone', 99).inv });
    const r = applyAction(full, { kind: 'pickup', structure: structures.list[0] }, pos);
    expect(r.session.structures.list).toHaveLength(1);
    expect(r.fx).toEqual([{ t: 'say', key: 'msgFull', vars: undefined, translate: undefined }]);
  });
});

describe('sleeping', () => {
  const bed = placeStructure(emptyStructures(), 'bed', 51, 50).list[0];

  it('sets the respawn point by day without skipping time', () => {
    const r = applyAction(base(), { kind: 'sleep', structure: bed }, { x: 60.5, y: 61.5 });
    expect(r.session.respawn).toEqual({ x: 60.5, y: 61.5 });
    expect(r.session.clock).toEqual({ day: 1, t: 100 });
    expect(say(r)[0]).toMatchObject({ key: 'msgSleepDay' });
  });

  it('skips to dawn at night, healing and costing food and water', () => {
    const night = base({ clock: { day: 2, t: DAY_SECONDS * 0.9 }, vitals: { hp: 30, hunger: 80, thirst: 80, stamina: 10 } });
    const r = applyAction(night, { kind: 'sleep', structure: bed }, pos);
    expect(r.session.clock).toEqual({ day: 3, t: 0 });
    expect(r.session.vitals).toEqual({ hp: 70, hunger: 65, thirst: 65, stamina: 100 });
    expect(r.fx).toContainEqual({ t: 'slept' });
  });
});

describe('crafting and chests', () => {
  const plank = RECIPES.find((r) => r.id === 'plank')!;
  const none: ReadonlySet<Station> = new Set();

  it('crafts when possible and changes nothing otherwise', () => {
    const r = craftRecipe(give(base(), ['wood', 2]), plank, none);
    expect(countItem(r.session.inventory, 'plank')).toBe(2);
    expect(r.fx).toEqual([{ t: 'gain', item: 'plank', qty: 2 }]);
    const fail = base();
    expect(craftRecipe(fail, plank, none).session).toBe(fail);
  });

  const withChest = (s: Session): Session => {
    const structures = placeStructure(emptyStructures(), 'chest', 52, 50);
    return { ...s, structures: setStructureInventory(structures, 1, emptyInventory(20)) };
  };

  it('moves stacks into a chest and back', () => {
    let s = withChest(give(base(), ['wood', 30]));
    s = transferStack(s, 1, 'bag', 0).session;
    expect(countItem(s.inventory, 'wood')).toBe(0);
    expect(s.structures.list[0].inv?.[0]).toEqual({ item: 'wood', qty: 30 });
    s = transferStack(s, 1, 'chest', 0).session;
    expect(countItem(s.inventory, 'wood')).toBe(30);
    expect(s.structures.list[0].inv?.[0]).toBeNull();
  });

  it('keeps what does not fit and reports a full target', () => {
    let s = withChest(give(base(), ['wood', 99], ['axe_wood', 1]));
    s = { ...s, structures: setStructureInventory(s.structures, 1, addItem(emptyInventory(1), 'wood', 90).inv) };
    const r = transferStack(s, 1, 'bag', 0);
    expect(r.session.structures.list[0].inv?.[0]).toEqual({ item: 'wood', qty: 99 });
    expect(r.session.inventory[0]).toEqual({ item: 'wood', qty: 90 });
    const full = transferStack(r.session, 1, 'bag', 0);
    expect(full.fx).toEqual([{ t: 'say', key: 'msgFull', vars: undefined, translate: undefined }]);
    expect(full.session).toBe(r.session);
  });

  it('keeps a tool worn down when it moves', () => {
    let s = withChest(give(base(), ['axe_stone', 1]));
    s = { ...s, inventory: setDurability(s.inventory, 0, 7) };
    s = transferStack(s, 1, 'bag', 0).session;
    expect(s.structures.list[0].inv?.[0]).toEqual({ item: 'axe_stone', qty: 1, dur: 7 });
    s = transferStack(s, 1, 'chest', 0).session;
    expect(s.inventory[0]).toEqual({ item: 'axe_stone', qty: 1, dur: 7 });
  });

  it('can fill a chest that was just built by the player', () => {
    let s = give(base(), ['chest', 1], ['wood', 12]);
    s = applyAction(s, { kind: 'place', type: 'chest', x: 51, y: 50 }, pos).session;
    const wood = s.inventory.findIndex((slot) => slot?.item === 'wood');
    s = transferStack(s, 1, 'bag', wood).session;
    expect(s.structures.list[0].inv?.find(Boolean)).toEqual({ item: 'wood', qty: 12 });
    expect(countItem(s.inventory, 'wood')).toBe(0);
  });

  it('ignores empty slots and things that are not chests', () => {
    const s = withChest(base());
    expect(transferStack(s, 1, 'bag', 5).session).toBe(s);
    expect(transferStack(s, 99, 'bag', 0).session).toBe(s);
  });
});

describe('collapse and new days', () => {
  it('applies the death penalty of the difficulty', () => {
    const s = give(base(), ['wood', 10]);
    expect(countItem(collapse(s, () => 0.9).session.inventory, 'wood')).toBe(5);
    expect(collapse(s, () => 0.9).session.vitals).toEqual(RESPAWN_VITALS);
    expect(collapse({ ...s, difficulty: 'relaxed' }, () => 0.9).session.inventory).toBe(s.inventory);
    expect(collapse({ ...s, difficulty: 'hardcore' }, () => 0.9).wipeSave).toBe(true);
  });

  it('grows watered crops and regrows nodes once a day rolls over', () => {
    const tile = idx(51, 50);
    const farm = water(plant(till(emptyFarm(), tile), tile, 'carrot')!, tile);
    const gather = { hp: {}, gone: { 7: 1 } };
    const s = base({ farm, gather, clock: { day: 4, t: 0 } });
    const next = rollDay(s, () => false);
    expect(plotAt(next.farm, tile)?.growth).toBe(1);
    expect(plotAt(next.farm, tile)?.watered).toBe(false);
    expect(isAlive(next.gather, 7)).toBe(true);
    expect(isAlive(rollDay(s, (id) => id === 7).gather, 7)).toBe(false);
    expect(emptyGather()).toEqual({ hp: {}, gone: {} });
    expect(WORLD_SIZE).toBe(160);
  });
});
