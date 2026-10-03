import { describe, expect, it } from 'vitest';
import { emptyFarm, till } from '@/sim/farm';
import { emptyGather, hitNode } from '@/sim/gather';
import { Rng } from '@/core/rng';
import { blockingTiles } from '@/sim/solids';
import { emptyStructures, placeStructure } from '@/sim/structures';
import { T, WORLD_SIZE, idx, type ResourceNode, type World } from '@/sim/world/types';

const tree: ResourceNode = { id: 0, kind: 'tree', x: 10, y: 10, variant: 0 };
const rock: ResourceNode = { id: 1, kind: 'rock', x: 12, y: 10, variant: 0 };
const world: World = {
  seed: 0, size: WORLD_SIZE, terrain: new Uint8Array(WORLD_SIZE * WORLD_SIZE).fill(T.GRASS), biome: new Uint8Array(WORLD_SIZE * WORLD_SIZE),
  landmarks: [], resources: [tree, rock], start: { x: 1, y: 1 },
};
const fresh = () => ({ gather: emptyGather(), structures: emptyStructures(), farm: emptyFarm() });

describe('blockingTiles', () => {
  it('blocks living resource nodes and scenery, but not a node that has been cut down', () => {
    const { solids } = blockingTiles(world, [idx(5, 5)], fresh());
    expect([...solids].sort((a, b) => a - b)).toEqual([idx(5, 5), idx(10, 10), idx(12, 10)]);
    const cut = hitNode(emptyGather(), tree, 99, 1, new Rng(1)).state;
    expect(blockingTiles(world, [], { ...fresh(), gather: cut }).solids.has(idx(10, 10))).toBe(false);
  });

  it('blocks solid buildings for walking, and every building and plot for building', () => {
    const structures = placeStructure(placeStructure(emptyStructures(), 'fence', 20, 20), 'torch', 21, 20);
    const { solids, occupied } = blockingTiles(world, [], { ...fresh(), structures, farm: till(emptyFarm(), idx(22, 20)) });
    expect(solids.has(idx(20, 20))).toBe(true);
    expect(solids.has(idx(21, 20))).toBe(false);
    expect(occupied.has(idx(21, 20))).toBe(true);
    expect(occupied.has(idx(22, 20))).toBe(true);
    expect(solids.has(idx(22, 20))).toBe(false);
  });
});
