import { describe, expect, it } from 'vitest';
import { LANDMARK_PROPS } from '@/data/landmarkProps';
import { nearestNode } from '@/sim/interact';
import { nodesByTile, propSolidTiles } from '@/sim/solids';
import { generateWorld } from '@/sim/world/generate';
import { RESERVE_RADIUS } from '@/sim/world/landmarks';
import { T, WORLD_SIZE, idx, isWater, type ResourceNode } from '@/sim/world/types';

const node = (id: number, x: number, y: number): ResourceNode => ({ id, kind: 'tree', x, y, variant: 0 });

describe('nearestNode', () => {
  const nodes = new Map([node(1, 10, 10), node(2, 12, 10), node(3, 10, 14)].map((n) => [idx(n.x, n.y), n]));
  const alive = () => true;

  it('finds the closest node within the radius', () => {
    expect(nearestNode(nodes, WORLD_SIZE, { x: 10.5, y: 10.5 }, 1.3, alive)?.id).toBe(1);
    expect(nearestNode(nodes, WORLD_SIZE, { x: 11.9, y: 10.5 }, 1.3, alive)?.id).toBe(2);
  });

  it('returns null when nothing is in reach', () => {
    expect(nearestNode(nodes, WORLD_SIZE, { x: 20, y: 20 }, 1.3, alive)).toBeNull();
    expect(nearestNode(nodes, WORLD_SIZE, { x: 10.5, y: 12.5 }, 1.3, alive)).toBeNull();
  });

  it('skips nodes that are no longer alive', () => {
    expect(nearestNode(nodes, WORLD_SIZE, { x: 10.5, y: 10.5 }, 1.3, (id) => id !== 1)).toBeNull();
    expect(nearestNode(nodes, WORLD_SIZE, { x: 11.2, y: 10.5 }, 2, (id) => id !== 1)?.id).toBe(2);
  });

  it('is safe at the map edge', () => {
    expect(nearestNode(nodes, WORLD_SIZE, { x: 0.2, y: 0.2 }, 3, alive)).toBeNull();
    expect(nearestNode(nodes, WORLD_SIZE, { x: WORLD_SIZE - 0.1, y: WORLD_SIZE - 0.1 }, 3, alive)).toBeNull();
  });
});

describe('solids', () => {
  const world = generateWorld(13);

  it('indexes every resource node by its tile', () => {
    const map = nodesByTile(world);
    expect(map.size).toBe(world.resources.length);
    for (const n of world.resources) expect(map.get(idx(n.x, n.y))).toBe(n);
  });

  it('blocks only dry land inside each landmark clearing', () => {
    const tiles = new Set(propSolidTiles(world));
    expect(tiles.size).toBeGreaterThan(0);
    for (const l of world.landmarks) {
      for (const prop of LANDMARK_PROPS[l.id]) {
        for (const [bx, by] of prop.blocks ?? []) {
          expect(Math.abs(bx) <= RESERVE_RADIUS[l.id] && Math.abs(by) <= RESERVE_RADIUS[l.id], `${l.id} block ${bx},${by}`).toBe(true);
          expect(isWater(world.terrain[idx(l.x + bx, l.y + by)]), `${l.id} block in water`).toBe(false);
        }
      }
    }
    expect(world.terrain[idx(world.start.x, world.start.y)]).toBe(T.SAND);
    expect(tiles.has(idx(world.start.x, world.start.y))).toBe(false);
  });

  it('never blocks the tile where the player starts or a resource tile', () => {
    const tiles = new Set(propSolidTiles(world));
    for (const n of world.resources) expect(tiles.has(idx(n.x, n.y))).toBe(false);
  });
});
