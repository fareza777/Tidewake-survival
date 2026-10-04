import { describe, expect, it } from 'vitest';
import type { ItemId } from '@/data/items';
import { ITEMS } from '@/data/items';
import { emptyFarm } from '@/sim/farm';
import { resolveAction, type Action, type ActionContext, type Facing } from '@/sim/actions';
import { addItem, emptyInventory } from '@/sim/inventory';
import { meleeFor } from '@/sim/melee';
import { emptyStructures, placeStructure } from '@/sim/structures';
import { fullVitals } from '@/sim/vitals';
import { T, WORLD_SIZE, idx, type ResourceNode, type World } from '@/sim/world/types';

function makeWorld(): World {
  const size = WORLD_SIZE;
  const terrain = new Uint8Array(size * size).fill(T.GRASS);
  terrain[idx(10, 12)] = T.RIVER;
  return { seed: 0, size, terrain, biome: new Uint8Array(size * size), landmarks: [], resources: [], start: { x: 10, y: 10 } };
}

const tree: ResourceNode = { id: 1, kind: 'tree', x: 11, y: 10, variant: 0 };

/** Hero at (10.5, 10.5) facing right; `hold` goes in hotbar slot 0 and `arrows` into slot 1. */
function ctx(over: Partial<ActionContext> & { hold?: ItemId; arrows?: number; facing?: Facing } = {}): ActionContext {
  const { hold, arrows, ...rest } = over;
  let inv = emptyInventory();
  if (hold) inv = addItem(inv, hold, 1).inv;
  if (arrows) inv = addItem(inv, 'arrow', arrows).inv;
  return {
    world: makeWorld(), inv, selected: 0, vitals: fullVitals(), pos: { x: 10.5, y: 10.5 }, facing: 'right',
    structures: emptyStructures(), farm: emptyFarm(), occupied: new Set(), node: null, creature: false, entrance: null, target: null, ...rest,
  };
}
const kind = (a: Action): string => a.kind;

describe('the bow', () => {
  it('shoots whenever it is held and there are arrows, without needing a target', () => {
    const a = resolveAction(ctx({ hold: 'bow', arrows: 5 }));
    expect(a).toEqual({ kind: 'shoot', stats: ITEMS.bow.weapon });
  });

  it('shoots instead of drinking or chopping while it is held', () => {
    expect(kind(resolveAction(ctx({ hold: 'bow', arrows: 5, facing: 'down', pos: { x: 10.5, y: 11.5 } })))).toBe('shoot');
    expect(kind(resolveAction(ctx({ hold: 'bow', arrows: 5, node: tree })))).toBe('shoot');
  });

  it('says so when there are no arrows, and when the hero is too tired', () => {
    expect(resolveAction(ctx({ hold: 'bow' }))).toEqual({ kind: 'blocked', reason: 'noArrows' });
    const tired = { ...fullVitals(), stamina: 0 };
    expect(resolveAction(ctx({ hold: 'bow', arrows: 5, vitals: tired }))).toEqual({ kind: 'blocked', reason: 'tired' });
  });
});

describe('a hero at zero hit points', () => {
  it('can do nothing at all, so no action can heal him before the death check', () => {
    const down = { ...fullVitals(), hp: 0 };
    expect(resolveAction(ctx({ hold: 'cooked_meat', vitals: { ...down, hunger: 10 } }))).toEqual({ kind: 'none' });
    const bed = placeStructure(emptyStructures(), 'bed', 11, 10);
    expect(resolveAction(ctx({ structures: bed, vitals: down }))).toEqual({ kind: 'none' });
    expect(resolveAction(ctx({ hold: 'sword_wood', creature: true, vitals: down }))).toEqual({ kind: 'none' });
  });
});

describe('melee', () => {
  it('swings a sword or spear when something is within reach', () => {
    expect(resolveAction(ctx({ hold: 'sword_iron', creature: true }))).toEqual({ kind: 'attack', melee: meleeFor('sword_iron') });
    expect(resolveAction(ctx({ hold: 'spear_bone', creature: true }))).toEqual({ kind: 'attack', melee: meleeFor('spear_bone') });
  });

  it('does not swing at nothing: a sword by a tree chops by hand, and by the river it drinks', () => {
    expect(resolveAction(ctx({ hold: 'sword_wood', node: tree }))).toMatchObject({ kind: 'hit', wear: false });
    expect(kind(resolveAction(ctx({ hold: 'sword_wood', facing: 'down', pos: { x: 10.5, y: 11.5 } })))).toBe('drink');
    expect(kind(resolveAction(ctx({ hold: 'sword_wood' })))).toBe('none');
  });

  it('lets bare hands and tools fight back, ahead of chopping', () => {
    expect(resolveAction(ctx({ creature: true }))).toEqual({ kind: 'attack', melee: meleeFor(null) });
    expect(resolveAction(ctx({ hold: 'axe_stone', creature: true, node: tree }))).toEqual({ kind: 'attack', melee: meleeFor('axe_stone') });
  });

  it('lets a hoe, a watering can, seeds and food that would be wasted fight back when there is nothing for them to do', () => {
    const attack = { kind: 'attack', melee: expect.objectContaining({ damage: expect.any(Number) }) };
    const sand = { x: 11, y: 10 };
    const world = makeWorld();
    world.terrain[idx(sand.x, sand.y)] = T.SAND;
    expect(resolveAction(ctx({ hold: 'hoe', creature: true, world }))).toMatchObject(attack);
    expect(resolveAction(ctx({ hold: 'watering_can', creature: true }))).toMatchObject(attack);
    expect(resolveAction(ctx({ hold: 'carrot_seed', creature: true }))).toMatchObject(attack);
    expect(resolveAction(ctx({ hold: 'cooked_meat', creature: true }))).toMatchObject(attack);
  });

  it('still tills with a hoe on tillable ground even if a creature is near', () => {
    expect(kind(resolveAction(ctx({ hold: 'hoe', creature: true })))).toBe('till');
  });

  it('is blocked when the hero is too tired to swing', () => {
    const tired = { ...fullVitals(), stamina: 0 };
    expect(resolveAction(ctx({ hold: 'sword_wood', creature: true, vitals: tired }))).toEqual({ kind: 'blocked', reason: 'tired' });
    expect(resolveAction(ctx({ creature: true, vitals: tired }))).toEqual({ kind: 'blocked', reason: 'tired' });
  });

  it('still lets a structure in front, or something to eat, come first', () => {
    const structures = placeStructure(emptyStructures(), 'workbench', 11, 10);
    expect(kind(resolveAction(ctx({ hold: 'sword_wood', creature: true, structures })))).toBe('open');
    const hurt = { ...fullVitals(), hp: 20 };
    expect(kind(resolveAction(ctx({ hold: 'cooked_meat', creature: true, vitals: { ...hurt, hunger: 10 } })))).toBe('eat');
  });
});
