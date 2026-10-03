import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/rng';
import { CROPS } from '@/data/crops';
import { ITEMS } from '@/data/items';
import { advanceDay, canTill, emptyFarm, harvest, isRipe, plant, plotAt, stageOf, till, water } from '@/sim/farm';
import { T, WORLD_SIZE, idx, type World } from '@/sim/world/types';

function makeWorld(): World {
  const size = WORLD_SIZE;
  const terrain = new Uint8Array(size * size).fill(T.GRASS);
  terrain[idx(3, 3)] = T.SAND;
  terrain[idx(4, 3)] = T.DIRT;
  terrain[idx(5, 3)] = T.RIVER;
  return { seed: 0, size, terrain, biome: new Uint8Array(size * size), landmarks: [], resources: [], start: { x: 1, y: 1 } };
}

const world = makeWorld();
const tile = idx(2, 2);
const none: ReadonlySet<number> = new Set();

describe('crop data', () => {
  it('refers to real items, with a ripe stage inside the sprite strip', () => {
    for (const c of Object.values(CROPS)) {
      expect(ITEMS[c.seed].seed).toBe(c.id);
      expect(ITEMS[c.produce].food).toBeDefined();
      expect(c.growDays).toBeGreaterThan(0);
      expect(c.ripeStage).toBeGreaterThan(0);
      expect(c.yield[1]).toBeGreaterThanOrEqual(c.yield[0]);
    }
  });
});

describe('tilling', () => {
  it('allows grass and dirt only', () => {
    expect(canTill(world, emptyFarm(), none, 2, 2)).toBe(true);
    expect(canTill(world, emptyFarm(), none, 4, 3)).toBe(true);
    expect(canTill(world, emptyFarm(), none, 3, 3)).toBe(false);
    expect(canTill(world, emptyFarm(), none, 5, 3)).toBe(false);
    expect(canTill(world, emptyFarm(), none, -1, 0)).toBe(false);
  });

  it('refuses occupied or already tilled tiles', () => {
    expect(canTill(world, emptyFarm(), new Set([tile]), 2, 2)).toBe(false);
    expect(canTill(world, till(emptyFarm(), tile), none, 2, 2)).toBe(false);
  });

  it('tills without mutating and tolerates tilling twice', () => {
    const farm = emptyFarm();
    const once = till(farm, tile);
    expect(farm.plots).toEqual({});
    expect(plotAt(once, tile)).toEqual({ crop: null, growth: 0, watered: false });
    expect(till(once, tile)).toBe(once);
  });
});

describe('planting and growing', () => {
  it('plants only on empty tilled soil', () => {
    expect(plant(emptyFarm(), tile, 'carrot')).toBeNull();
    const soil = till(emptyFarm(), tile);
    const planted = plant(soil, tile, 'carrot')!;
    expect(plotAt(planted, tile)?.crop).toBe('carrot');
    expect(plant(planted, tile, 'corn')).toBeNull();
  });

  it('grows only on watered days and never past ripeness', () => {
    let farm = plant(till(emptyFarm(), tile), tile, 'carrot')!;
    farm = advanceDay(farm);
    expect(plotAt(farm, tile)?.growth).toBe(0);
    for (let day = 0; day < 10; day++) farm = advanceDay(water(farm, tile));
    expect(plotAt(farm, tile)?.growth).toBe(CROPS.carrot.growDays);
    expect(isRipe(plotAt(farm, tile))).toBe(true);
  });

  it('dries the soil every morning', () => {
    let farm = water(till(emptyFarm(), tile), tile);
    expect(plotAt(farm, tile)?.watered).toBe(true);
    farm = advanceDay(farm);
    expect(plotAt(farm, tile)?.watered).toBe(false);
    expect(water(farm, idx(9, 9))).toBe(farm);
  });

  it('shows growing sprite stages up to the ripe one', () => {
    let farm = plant(till(emptyFarm(), tile), tile, 'pumpkin')!;
    const stages: number[] = [stageOf(plotAt(farm, tile)!)];
    for (let d = 0; d < CROPS.pumpkin.growDays; d++) {
      farm = advanceDay(water(farm, tile));
      stages.push(stageOf(plotAt(farm, tile)!));
    }
    expect(stages[0]).toBe(0);
    expect(stages[stages.length - 1]).toBe(CROPS.pumpkin.ripeStage);
    expect([...stages].sort((a, b) => a - b)).toEqual(stages);
  });
});

describe('harvest', () => {
  const ripe = () => {
    let farm = plant(till(emptyFarm(), tile), tile, 'corn')!;
    for (let d = 0; d < CROPS.corn.growDays; d++) farm = advanceDay(water(farm, tile));
    return farm;
  };

  it('gives produce within the yield range and leaves bare tilled soil', () => {
    const result = harvest(ripe(), tile, new Rng(1))!;
    const produce = result.items.find((i) => i.item === 'corn')!;
    expect(produce.qty).toBeGreaterThanOrEqual(CROPS.corn.yield[0]);
    expect(produce.qty).toBeLessThanOrEqual(CROPS.corn.yield[1]);
    expect(plotAt(result.farm, tile)).toEqual({ crop: null, growth: 0, watered: false });
  });

  it('sometimes returns a seed', () => {
    const seen = new Set<boolean>();
    for (let s = 0; s < 40; s++) seen.add(harvest(ripe(), tile, new Rng(s))!.items.some((i) => i.item === 'corn_seed'));
    expect(seen.size).toBe(2);
  });

  it('refuses unripe, empty or missing plots', () => {
    const young = plant(till(emptyFarm(), tile), tile, 'corn')!;
    expect(harvest(young, tile, new Rng(1))).toBeNull();
    expect(harvest(till(emptyFarm(), tile), tile, new Rng(1))).toBeNull();
    expect(harvest(emptyFarm(), tile, new Rng(1))).toBeNull();
  });
});
