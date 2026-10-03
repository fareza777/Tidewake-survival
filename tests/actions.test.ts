import { describe, expect, it } from 'vitest';
import type { ItemId } from '@/data/items';
import { advanceDay, emptyFarm, plant, till, water } from '@/sim/farm';
import { frontTile, resolveAction, type Action, type ActionContext, type Facing } from '@/sim/actions';
import { addItem, emptyInventory, setDurability } from '@/sim/inventory';
import { emptyStructures, placeStructure, setStructureInventory } from '@/sim/structures';
import { fullVitals } from '@/sim/vitals';
import { T, WORLD_SIZE, idx, type ResourceNode, type World } from '@/sim/world/types';

function makeWorld(): World {
  const size = WORLD_SIZE;
  const terrain = new Uint8Array(size * size).fill(T.GRASS);
  terrain[idx(11, 12)] = T.RIVER; // south-east of the hero
  terrain[idx(10, 12)] = T.SHALLOW;
  terrain[idx(9, 10)] = T.SAND;
  return { seed: 0, size, terrain, biome: new Uint8Array(size * size), landmarks: [], resources: [], start: { x: 10, y: 10 } };
}

const tree: ResourceNode = { id: 1, kind: 'tree', x: 11, y: 10, variant: 0 };
const bush: ResourceNode = { id: 2, kind: 'bush', x: 11, y: 10, variant: 0 };
const ore: ResourceNode = { id: 3, kind: 'ore', x: 11, y: 10, variant: 0 };

/** Hero at (10.5, 10.5) facing right, so the front tile is (11, 10). `hold` goes in hotbar slot 0. */
function ctx(over: Partial<ActionContext> & { hold?: ItemId; facing?: Facing } = {}): ActionContext {
  const { hold, ...rest } = over;
  let inv = emptyInventory();
  if (hold) inv = addItem(inv, hold, 1).inv;
  return {
    world: makeWorld(), inv, selected: 0, vitals: fullVitals(), pos: { x: 10.5, y: 10.5 }, facing: 'right',
    structures: emptyStructures(), farm: emptyFarm(), occupied: new Set(), node: null, ...rest,
  };
}

const kind = (a: Action): string => a.kind;

describe('frontTile', () => {
  it('is the neighbouring tile in the facing direction', () => {
    const pos = { x: 10.9, y: 10.1 };
    expect(frontTile(pos, 'right')).toEqual({ x: 11, y: 10 });
    expect(frontTile(pos, 'left')).toEqual({ x: 9, y: 10 });
    expect(frontTile(pos, 'up')).toEqual({ x: 10, y: 9 });
    expect(frontTile(pos, 'down')).toEqual({ x: 10, y: 11 });
  });
});

describe('structures and crops come first', () => {
  it('opens a workbench, furnace, campfire or chest and sleeps in a bed with bare hands or food in hand', () => {
    for (const [type, expected] of [['workbench', 'open'], ['chest', 'open'], ['furnace', 'open'], ['campfire', 'open'], ['bed', 'sleep']] as const) {
      const structures = placeStructure(emptyStructures(), type, 11, 10);
      expect(kind(resolveAction(ctx({ structures })))).toBe(expected);
      expect(kind(resolveAction(ctx({ structures, hold: 'carrot' })))).toBe(expected);
    }
  });

  it('takes fences and torches down with a plain press, whatever is held', () => {
    for (const type of ['fence', 'torch'] as const) {
      const structures = placeStructure(emptyStructures(), type, 11, 10);
      expect(resolveAction(ctx({ structures }))).toMatchObject({ kind: 'pickup', structure: { type } });
      expect(kind(resolveAction(ctx({ structures, hold: 'carrot' })))).toBe('pickup');
    }
  });

  it('dismantles stations, beds and chests only while holding an axe or pickaxe', () => {
    for (const type of ['workbench', 'furnace', 'campfire', 'bed', 'chest'] as const) {
      const structures = placeStructure(emptyStructures(), type, 11, 10);
      expect(kind(resolveAction(ctx({ structures, hold: 'axe_wood' })))).toBe('pickup');
      expect(kind(resolveAction(ctx({ structures, hold: 'pickaxe_stone' })))).toBe('pickup');
      expect(kind(resolveAction(ctx({ structures, hold: 'hoe' })))).not.toBe('pickup');
    }
  });

  it('refuses to dismantle a chest that still holds items', () => {
    const full = setStructureInventory(placeStructure(emptyStructures(), 'chest', 11, 10), 1, addItem(emptyInventory(20), 'wood', 3).inv);
    expect(resolveAction(ctx({ structures: full, hold: 'axe_wood' }))).toEqual({ kind: 'blocked', reason: 'chestNotEmpty' });
    const empty = setStructureInventory(placeStructure(emptyStructures(), 'chest', 11, 10), 1, emptyInventory(20));
    expect(kind(resolveAction(ctx({ structures: empty, hold: 'axe_wood' })))).toBe('pickup');
  });

  it('harvests a ripe crop but not a young one', () => {
    const tile = idx(11, 10);
    let farm = plant(till(emptyFarm(), tile), tile, 'carrot')!;
    expect(kind(resolveAction(ctx({ farm })))).toBe('none');
    for (let d = 0; d < 3; d++) farm = advanceDay(water(farm, tile));
    expect(resolveAction(ctx({ farm }))).toEqual({ kind: 'harvest', x: 11, y: 10 });
  });
});

describe('held items', () => {
  it('eats food when something would be gained, otherwise does nothing', () => {
    const hungry = { ...fullVitals(), hunger: 50 };
    expect(kind(resolveAction(ctx({ hold: 'carrot', vitals: hungry })))).toBe('eat');
    expect(kind(resolveAction(ctx({ hold: 'carrot' })))).toBe('none');
    expect(kind(resolveAction(ctx({ hold: 'coconut', vitals: { ...fullVitals(), thirst: 10 } })))).toBe('eat');
  });

  it('places a structure in front, or says why not', () => {
    expect(resolveAction(ctx({ hold: 'campfire' }))).toEqual({ kind: 'place', type: 'campfire', x: 11, y: 10 });
    expect(resolveAction(ctx({ hold: 'campfire', facing: 'down', pos: { x: 11.5, y: 11.5 } }))).toEqual({
      kind: 'blocked', reason: 'cannotPlace', why: 'water',
    });
    expect(resolveAction(ctx({ hold: 'campfire', occupied: new Set([idx(11, 10)]) }))).toEqual({
      kind: 'blocked', reason: 'cannotPlace', why: 'occupied',
    });
  });

  it('will not build a wall into the hero body', () => {
    expect(resolveAction(ctx({ hold: 'fence', pos: { x: 10.9, y: 10.5 } }))).toEqual({ kind: 'blocked', reason: 'cannotPlace', why: 'hero' });
    expect(resolveAction(ctx({ hold: 'torch', pos: { x: 10.9, y: 10.5 } }))).toMatchObject({ kind: 'place', type: 'torch' });
  });

  it('plants a seed only on empty tilled soil', () => {
    const tile = idx(11, 10);
    expect(kind(resolveAction(ctx({ hold: 'corn_seed' })))).toBe('none');
    expect(resolveAction(ctx({ hold: 'corn_seed', farm: till(emptyFarm(), tile) }))).toEqual({ kind: 'plant', x: 11, y: 10, crop: 'corn' });
    const planted = plant(till(emptyFarm(), tile), tile, 'corn')!;
    expect(kind(resolveAction(ctx({ hold: 'corn_seed', farm: planted })))).toBe('none');
  });

  it('tills grass with a hoe, refuses sand, and needs stamina', () => {
    expect(resolveAction(ctx({ hold: 'hoe' }))).toEqual({ kind: 'till', x: 11, y: 10, stamina: 2 });
    expect(kind(resolveAction(ctx({ hold: 'hoe', facing: 'left' })))).toBe('none');
    expect(resolveAction(ctx({ hold: 'hoe', vitals: { ...fullVitals(), stamina: 1 } }))).toEqual({ kind: 'blocked', reason: 'tired' });
  });

  it('refills a watering can at a river, waters thirsty crops and refuses sea water', () => {
    const riverCtx = { hold: 'watering_can' as const, facing: 'down' as const, pos: { x: 11.5, y: 11.5 } };
    expect(resolveAction(ctx(riverCtx))).toEqual({ kind: 'refill', x: 11, y: 12 });
    expect(resolveAction(ctx({ ...riverCtx, pos: { x: 10.5, y: 11.5 } }))).toEqual({ kind: 'blocked', reason: 'saltWater' });
    const tile = idx(11, 10);
    const farm = plant(till(emptyFarm(), tile), tile, 'carrot')!;
    const full = setDurability(ctx({ hold: 'watering_can' }).inv, 0, 5);
    expect(resolveAction(ctx({ farm, inv: full }))).toEqual({ kind: 'water', x: 11, y: 10 });
    expect(resolveAction(ctx({ hold: 'watering_can', farm }))).toEqual({ kind: 'blocked', reason: 'canEmpty' });
    expect(kind(resolveAction(ctx({ farm: water(farm, tile), inv: full })))).toBe('none');
  });
});

describe('the world', () => {
  it('chops with the right tool and by hand, slowly', () => {
    expect(resolveAction(ctx({ hold: 'axe_wood', node: tree }))).toEqual({ kind: 'hit', node: tree, damage: 1, stamina: 2, wear: true });
    expect(resolveAction(ctx({ node: tree }))).toMatchObject({ kind: 'hit', damage: 0.34, wear: false });
  });

  it('tells the player which tool a hard node needs', () => {
    expect(resolveAction(ctx({ hold: 'pickaxe_wood', node: ore }))).toEqual({ kind: 'blocked', reason: 'needsTool', tool: 'pickaxe', tier: 2 });
    expect(resolveAction(ctx({ node: ore }))).toMatchObject({ reason: 'needsTool' });
  });

  it('picks berries without a tool and refuses when too tired to swing', () => {
    expect(resolveAction(ctx({ node: bush }))).toMatchObject({ kind: 'hit', damage: 1 });
    const tired = { ...fullVitals(), stamina: 0 };
    expect(resolveAction(ctx({ node: tree, vitals: tired }))).toEqual({ kind: 'blocked', reason: 'tired' });
  });

  it('drinks from a river, warns about sea water and otherwise does nothing', () => {
    const down = { facing: 'down' as const };
    expect(resolveAction(ctx({ ...down, pos: { x: 11.5, y: 11.5 } }))).toEqual({ kind: 'drink', x: 11, y: 12 });
    expect(resolveAction(ctx({ ...down, pos: { x: 10.5, y: 11.5 } }))).toEqual({ kind: 'blocked', reason: 'saltWater' });
    expect(kind(resolveAction(ctx()))).toBe('none');
  });

  it('drinks from a river in front even when a resource node is within reach behind the hero', () => {
    const behind = { id: 9, kind: 'bush' as const, x: 11, y: 10, variant: 0 };
    expect(resolveAction(ctx({ facing: 'down', pos: { x: 11.5, y: 11.5 }, node: behind }))).toEqual({ kind: 'drink', x: 11, y: 12 });
  });

  it('is safe at the edge of the map', () => {
    expect(kind(resolveAction(ctx({ pos: { x: 0.5, y: 0.5 }, facing: 'left' })))).toBe('blocked');
    expect(kind(resolveAction(ctx({ pos: { x: 0.5, y: 0.5 }, facing: 'up', hold: 'hoe' })))).toBe('none');
  });
});
