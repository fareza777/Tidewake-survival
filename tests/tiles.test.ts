import { describe, expect, it } from 'vitest';
import { GROUND_TILES } from '@/data/terrainTiles';
import { TILE_FRAMES } from '@/data/tileIndex';
import { SHORE_E, SHORE_N, SHORE_S, SHORE_W, groundFrame, shoreMask, tileHash } from '@/sim/tileView';
import { T, WORLD_SIZE, idx, type World } from '@/sim/world/types';

describe('ground tiles', () => {
  it('maps every terrain type to existing packed tiles', () => {
    for (const t of Object.values(T)) {
      const list = GROUND_TILES[t];
      expect(list.length, `terrain ${t}`).toBeGreaterThan(0);
      for (const [name, weight] of list) {
        expect(TILE_FRAMES[name], name).toBeTypeOf('number');
        expect(weight).toBeGreaterThan(0);
      }
    }
  });

  it('picks the same tile for the same position and stays inside the packed frames', () => {
    const max = Math.max(...Object.values(TILE_FRAMES));
    for (let i = 0; i < 300; i++) {
      const f = groundFrame(T.GRASS, i, i * 3);
      expect(f).toBe(groundFrame(T.GRASS, i, i * 3));
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(max);
    }
  });

  it('mixes variants but favors the flat tile', () => {
    const counts = new Map<number, number>();
    for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) counts.set(groundFrame(T.GRASS, x, y), (counts.get(groundFrame(T.GRASS, x, y)) ?? 0) + 1);
    expect(counts.size).toBeGreaterThan(1);
    expect(counts.get(TILE_FRAMES['grass.0'])!).toBeGreaterThan(1600 * 0.4);
  });

  it('hashes tiles into [0, 1)', () => {
    for (let i = 0; i < 100; i++) {
      const h = tileHash(i, i * 7);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
  });
});

describe('shoreMask', () => {
  const size = WORLD_SIZE;
  const world = (): World => {
    const terrain = new Uint8Array(size * size).fill(T.DEEP);
    terrain[idx(5, 5)] = T.GRASS;
    return { seed: 0, size, terrain, biome: new Uint8Array(size * size), landmarks: [], resources: [], start: { x: 5, y: 5 } };
  };

  it('is 0 for land tiles and for open sea', () => {
    const w = world();
    expect(shoreMask(w, 5, 5)).toBe(0);
    expect(shoreMask(w, 20, 20)).toBe(0);
  });

  it('sets a bit for each side that touches land', () => {
    const w = world();
    expect(shoreMask(w, 5, 4)).toBe(SHORE_S);
    expect(shoreMask(w, 5, 6)).toBe(SHORE_N);
    expect(shoreMask(w, 4, 5)).toBe(SHORE_E);
    expect(shoreMask(w, 6, 5)).toBe(SHORE_W);
  });

  it('combines bits for narrow water and treats the map edge as not land', () => {
    const w = world();
    w.terrain[idx(7, 5)] = T.GRASS;
    expect(shoreMask(w, 6, 5)).toBe(SHORE_W | SHORE_E);
    expect(shoreMask(w, 0, 0)).toBe(0);
  });
});
