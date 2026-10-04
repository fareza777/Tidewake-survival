import { describe, expect, it } from 'vitest';
import type { ItemId } from '@/data/items';
import { resolveAction, type ActionContext } from '@/sim/actions';
import { emptyFarm } from '@/sim/farm';
import { addItem, emptyInventory } from '@/sim/inventory';
import { emptyStructures, placeStructure } from '@/sim/structures';
import { fullVitals } from '@/sim/vitals';
import { T, WORLD_SIZE, type World } from '@/sim/world/types';

const world: World = { seed: 0, size: WORLD_SIZE, terrain: new Uint8Array(WORLD_SIZE * WORLD_SIZE).fill(T.GRASS), biome: new Uint8Array(WORLD_SIZE * WORLD_SIZE), landmarks: [], resources: [], start: { x: 10, y: 10 } };

/** Hero at (10.5, 10.5) facing right; a table stands on the tile in front. */
function ctx(over: Partial<ActionContext> & { hold?: ItemId; structure?: 'table' | 'fence' | 'barrel' | 'torch' } = {}): ActionContext {
  const { hold, structure = 'table', ...rest } = over;
  let inv = emptyInventory();
  if (hold) inv = addItem(inv, hold, 1).inv;
  return {
    world, inv, selected: 0, vitals: { ...fullVitals(), hunger: 50 }, pos: { x: 10.5, y: 10.5 }, facing: 'right',
    structures: placeStructure(emptyStructures(), structure, 11, 10), farm: emptyFarm(), occupied: new Set(), node: null, creature: false,
    entrance: null, target: null, ...rest,
  };
}

describe('furniture and other things a plain USE can pick up', () => {
  it('is picked up by an empty hand or a tool, as before', () => {
    expect(resolveAction(ctx()).kind).toBe('pickup');
    expect(resolveAction(ctx({ hold: 'axe_wood' })).kind).toBe('pickup');
    expect(resolveAction(ctx({ structure: 'fence', hold: 'sword_iron' })).kind).toBe('pickup');
  });

  it('is left alone when something is in reach to fight: the blow comes first', () => {
    expect(resolveAction(ctx({ creature: true, hold: 'sword_iron' })).kind).toBe('attack');
    expect(resolveAction(ctx({ creature: true, structure: 'barrel' })).kind).toBe('attack');
  });

  it('is left alone when the hero holds something to place or eat, so a second sign is not a taken first one', () => {
    expect(resolveAction(ctx({ hold: 'sign' }))).toMatchObject({ kind: 'blocked', reason: 'cannotPlace' });
    expect(resolveAction(ctx({ hold: 'cooked_meat' })).kind).toBe('eat');
  });

  it('still lets the stations be used and taken down only with a tool, as before', () => {
    const bench = ctx({ structure: 'torch' });
    expect(resolveAction(bench).kind).toBe('pickup');
  });
});
