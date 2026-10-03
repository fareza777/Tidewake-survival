import { describe, expect, it } from 'vitest';
import { STRUCTURES } from '@/data/structures';
import { addItem, emptyInventory } from '@/sim/inventory';
import {
  PLACE_REACH, canPlace, emptyStructures, nearbyStations, placeStructure, removeStructure, setStructureInventory,
  structureAt, structureSolids,
} from '@/sim/structures';
import { T, WORLD_SIZE, idx, type World } from '@/sim/world/types';

function makeWorld(): World {
  const size = WORLD_SIZE;
  const terrain = new Uint8Array(size * size).fill(T.GRASS);
  terrain[idx(12, 10)] = T.RIVER;
  terrain[idx(13, 10)] = T.SHALLOW;
  terrain[idx(14, 10)] = T.DEEP;
  return { seed: 0, size, terrain, biome: new Uint8Array(size * size), landmarks: [], resources: [], start: { x: 10, y: 10 } };
}

const world = makeWorld();
const hero = { x: 10.5, y: 10.5 };
const noSolids: ReadonlySet<number> = new Set();

describe('canPlace', () => {
  it('allows an empty land tile within reach', () => {
    expect(canPlace(world, emptyStructures(), noSolids, 11, 10, hero)).toEqual({ ok: true });
  });

  it('refuses water of every kind, the map edge and the hero tile', () => {
    expect(canPlace(world, emptyStructures(), noSolids, 12, 10, hero)).toEqual({ ok: false, reason: 'water' });
    expect(canPlace(world, emptyStructures(), noSolids, 13, 10, hero)).toEqual({ ok: false, reason: 'water' });
    expect(canPlace(world, emptyStructures(), noSolids, 14, 10, hero)).toEqual({ ok: false, reason: 'water' });
    expect(canPlace(world, emptyStructures(), noSolids, -1, 5, hero)).toEqual({ ok: false, reason: 'bounds' });
    expect(canPlace(world, emptyStructures(), noSolids, 10, 10, hero)).toEqual({ ok: false, reason: 'hero' });
  });

  it('refuses tiles that are occupied by a solid thing or another structure', () => {
    expect(canPlace(world, emptyStructures(), new Set([idx(11, 10)]), 11, 10, hero)).toEqual({ ok: false, reason: 'occupied' });
    const built = placeStructure(emptyStructures(), 'chest', 11, 10);
    expect(canPlace(world, built, noSolids, 11, 10, hero)).toEqual({ ok: false, reason: 'occupied' });
  });

  it('refuses a solid structure that would overlap the hero body, but still allows a torch', () => {
    const nearEdge = { x: 10.9, y: 10.5 };
    expect(canPlace(world, emptyStructures(), noSolids, 11, 10, nearEdge)).toEqual({ ok: false, reason: 'hero' });
    expect(canPlace(world, emptyStructures(), noSolids, 11, 10, nearEdge, false)).toEqual({ ok: true });
    expect(canPlace(world, emptyStructures(), noSolids, 11, 10, { x: 10.6, y: 10.5 })).toEqual({ ok: true });
    expect(canPlace(world, emptyStructures(), noSolids, 10, 11, { x: 10.5, y: 10.8 })).toEqual({ ok: false, reason: 'hero' });
  });

  it('refuses tiles that are too far away', () => {
    expect(canPlace(world, emptyStructures(), noSolids, 10 + PLACE_REACH + 1, 10, hero)).toEqual({ ok: false, reason: 'far' });
  });
});

describe('structures', () => {
  it('places and removes immutably with unique ids', () => {
    const a = placeStructure(emptyStructures(), 'campfire', 3, 4);
    const b = placeStructure(a, 'bed', 5, 6);
    expect(a.list).toHaveLength(1);
    expect(b.list.map((s) => s.id)).toEqual([1, 2]);
    const c = removeStructure(b, 1);
    expect(c.list.map((s) => s.type)).toEqual(['bed']);
    const d = placeStructure(c, 'fence', 7, 8);
    expect(d.list.map((s) => s.id)).toEqual([2, 3]);
    expect(structureAt(d, 7, 8)?.type).toBe('fence');
    expect(structureAt(d, 0, 0)).toBeUndefined();
  });

  it('gives a freshly placed chest an empty storage and other structures none', () => {
    const s = placeStructure(placeStructure(emptyStructures(), 'chest', 1, 1), 'bed', 2, 2);
    expect(s.list[0].inv).toHaveLength(20);
    expect(s.list[0].inv!.every((slot) => slot === null)).toBe(true);
    expect(s.list[1].inv).toBeUndefined();
  });

  it('stores chest contents without touching other structures', () => {
    const s = placeStructure(placeStructure(emptyStructures(), 'chest', 1, 1), 'chest', 2, 2);
    const inv = addItem(emptyInventory(20), 'wood', 5).inv;
    const out = setStructureInventory(s, 1, inv);
    expect(out.list[0].inv).toBe(inv);
    expect(out.list[1].inv).toBe(s.list[1].inv);
    expect(s.list[0].inv).not.toBe(inv);
  });

  it('reports crafting stations only when they are close', () => {
    let s = placeStructure(emptyStructures(), 'workbench', 11, 10);
    s = placeStructure(s, 'furnace', 40, 40);
    s = placeStructure(s, 'bed', 10, 11);
    const near = nearbyStations(s, hero);
    expect([...near]).toEqual(['workbench']);
    expect(nearbyStations(s, { x: 40.5, y: 40.5 }).has('furnace')).toBe(true);
  });

  it('blocks walking for everything except torches', () => {
    let s = placeStructure(emptyStructures(), 'torch', 1, 1);
    s = placeStructure(s, 'fence', 2, 2);
    expect(structureSolids(s, WORLD_SIZE)).toEqual([idx(2, 2)]);
    expect(STRUCTURES.torch.solid).toBe(false);
  });
});
