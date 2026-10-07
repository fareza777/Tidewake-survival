import { describe, expect, it } from 'vitest';
import type { ItemId } from '@/data/items';
import { emptyFarm } from '@/sim/farm';
import { resolveAction, type ActionContext } from '@/sim/actions';
import { addItem, emptyInventory } from '@/sim/inventory';
import { emptyStructures, placeStructure } from '@/sim/structures';
import { fullVitals } from '@/sim/vitals';
import type { Spot } from '@/sim/world/spots';
import { T, WORLD_SIZE, idx, type World } from '@/sim/world/types';

function makeWorld(): World {
  const size = WORLD_SIZE;
  const terrain = new Uint8Array(size * size).fill(T.GRASS);
  terrain[idx(11, 10, size)] = T.SHALLOW;
  return { seed: 0, size, terrain, biome: new Uint8Array(size * size), landmarks: [], resources: [], start: { x: 10, y: 10 } };
}
const land = makeWorld();
land.terrain[idx(11, 10, WORLD_SIZE)] = T.GRASS;
const sea = makeWorld();

/** Hero at (10.5, 10.5) facing right; the tile in front is (11, 10). */
function ctx(over: Partial<ActionContext> & { give?: [ItemId, number][] } = {}): ActionContext {
  const { give, ...rest } = over;
  let inv = emptyInventory();
  for (const [item, n] of give ?? []) inv = addItem(inv, item, n).inv;
  return {
    world: land, inv, selected: 0, vitals: fullVitals(), pos: { x: 10.5, y: 10.5 }, facing: 'right', structures: emptyStructures(),
    farm: emptyFarm(), occupied: new Set(), node: null, creature: false, entrance: null, target: null, ...rest,
  };
}
const spot = (kind: Spot['kind'], id = `${kind}:1`): Spot => ({ id, kind, x: 11, y: 10 });

describe('talking', () => {
  it('talks to the islander in front, whatever is held', () => {
    expect(resolveAction(ctx({ npc: 'marlo' }))).toEqual({ kind: 'talk', npc: 'marlo' });
    expect(resolveAction(ctx({ npc: 'tali', give: [['axe_wood', 1]] }))).toEqual({ kind: 'talk', npc: 'tali' });
    expect(resolveAction(ctx({ npc: 'odo', give: [['sword_iron', 1]], creature: true }))).toEqual({ kind: 'talk', npc: 'odo' });
  });

  it('lets a building in front come first, and does nothing about an islander who is not there', () => {
    const structures = placeStructure(emptyStructures(), 'workbench', 11, 10);
    expect(resolveAction(ctx({ npc: 'nia', structures })).kind).toBe('open');
    expect(resolveAction(ctx({ npc: null })).kind).toBe('none');
  });

  it('does nothing for a hero with no hit points left', () => {
    expect(resolveAction(ctx({ npc: 'marlo', vitals: { ...fullVitals(), hp: 0 } })).kind).toBe('none');
  });
});

describe('finds', () => {
  it('reads a bottle, a tablet or finds the cat just by using what is in front', () => {
    for (const kind of ['bottle', 'tablet', 'cat'] as const) {
      expect(resolveAction(ctx({ spot: spot(kind) })), kind).toEqual({ kind: 'inspect', spot: spot(kind) });
    }
  });

  it('opens a buried treasure chest with a plain USE, whatever is in hand, even when tired', () => {
    const t = spot('treasure', 'treasure:1');
    const want = { kind: 'dig', spot: t, stamina: 0 };
    expect(resolveAction(ctx({ spot: t }))).toEqual(want);
    expect(resolveAction(ctx({ spot: t, give: [['axe_wood', 1]] }))).toEqual(want);
    expect(resolveAction(ctx({ spot: t, give: [['shovel', 1]], vitals: { ...fullVitals(), stamina: 0 } }))).toEqual(want);
  });
});

describe('fishing', () => {
  it('casts the rod at sea water or a river, and nowhere else', () => {
    expect(resolveAction(ctx({ world: sea, give: [['fishing_rod', 1]] }))).toEqual({ kind: 'fish', x: 11, y: 10, stamina: 4 });
    expect(resolveAction(ctx({ give: [['fishing_rod', 1]] })).kind).toBe('none');
    const river = makeWorld();
    river.terrain[idx(11, 10, WORLD_SIZE)] = T.RIVER;
    expect(resolveAction(ctx({ world: river, give: [['fishing_rod', 1]] })).kind).toBe('fish');
  });

  it('does not cast while too tired', () => {
    expect(resolveAction(ctx({ world: sea, give: [['fishing_rod', 1]], vitals: { ...fullVitals(), stamina: 1 } }))).toEqual({ kind: 'blocked', reason: 'tired' });
  });

  it('leaves drinking and salt-water warnings to the other tools', () => {
    expect(resolveAction(ctx({ world: sea, give: [['axe_wood', 1]] }))).toEqual({ kind: 'blocked', reason: 'saltWater' });
  });
});

describe('the raft and the lighthouse door', () => {
  it('uses a placed raft, even with an axe in hand', () => {
    const structures = placeStructure(emptyStructures(), 'raft', 11, 10);
    expect(resolveAction(ctx({ structures })).kind).toBe('raft');
    expect(resolveAction(ctx({ structures, give: [['axe_wood', 1]] })).kind).toBe('raft');
  });

  it('keeps the lighthouse door shut without the key, and opens it with it', () => {
    expect(resolveAction(ctx({ entrance: 'lighthouse' }))).toEqual({ kind: 'blocked', reason: 'needsLighthouseKey' });
    expect(resolveAction(ctx({ entrance: 'lighthouse', give: [['lighthouse_key', 1]] }))).toEqual({ kind: 'enter', dungeon: 'lighthouse' });
    expect(resolveAction(ctx({ entrance: 'grotto' }))).toEqual({ kind: 'enter', dungeon: 'grotto' });
  });
});
