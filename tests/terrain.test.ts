import { describe, expect, it } from 'vitest';
import { generateTerrain } from '@/sim/world/terrain';
import { B, T, WORLD_SIZE, idx, inBounds, isWater } from '@/sim/world/types';

describe('generateTerrain', () => {
  it('is deterministic for a seed', () => {
    const a = generateTerrain(77);
    const b = generateTerrain(77);
    expect(Array.from(a.terrain)).toEqual(Array.from(b.terrain));
    expect(Array.from(a.biome)).toEqual(Array.from(b.biome));
  });

  it('leaves the whole map border as deep water', () => {
    for (const seed of [1, 2, 3]) {
      const { terrain } = generateTerrain(seed);
      for (let i = 0; i < WORLD_SIZE; i++) {
        expect(terrain[idx(i, 0)]).toBe(T.DEEP);
        expect(terrain[idx(i, WORLD_SIZE - 1)]).toBe(T.DEEP);
        expect(terrain[idx(0, i)]).toBe(T.DEEP);
        expect(terrain[idx(WORLD_SIZE - 1, i)]).toBe(T.DEEP);
      }
    }
  });

  it('makes one connected island of a sensible size (rivers can be crossed)', () => {
    const isSea = (t: number): boolean => t === T.DEEP || t === T.SHALLOW;
    for (const seed of [4, 5, 6]) {
      const { terrain } = generateTerrain(seed);
      let land = 0;
      let first = -1;
      for (let i = 0; i < terrain.length; i++) {
        if (!isSea(terrain[i])) {
          land++;
          if (first < 0) first = i;
        }
      }
      expect(land).toBeGreaterThan(WORLD_SIZE * WORLD_SIZE * 0.3);
      expect(land).toBeLessThan(WORLD_SIZE * WORLD_SIZE * 0.65);
      const seen = new Set<number>([first]);
      const stack = [first];
      while (stack.length) {
        const c = stack.pop()!;
        const x = c % WORLD_SIZE;
        const y = (c - x) / WORLD_SIZE;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (!inBounds(x + dx, y + dy)) continue;
          const n = idx(x + dx, y + dy);
          if (!seen.has(n) && !isSea(terrain[n])) {
            seen.add(n);
            stack.push(n);
          }
        }
      }
      expect(seen.size).toBe(land);
    }
  });

  it('gives every land tile a biome and water none', () => {
    const { terrain, biome } = generateTerrain(8);
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === T.DEEP || terrain[i] === T.SHALLOW) expect(biome[i]).toBe(B.SEA);
      else expect(biome[i]).not.toBe(B.SEA);
    }
  });

  it('draws each biome with its own ground', () => {
    const { terrain, biome } = generateTerrain(9);
    const grounds = new Map<number, Set<number>>();
    for (let i = 0; i < terrain.length; i++) {
      if (isWater(terrain[i])) continue;
      if (!grounds.has(biome[i])) grounds.set(biome[i], new Set());
      grounds.get(biome[i])!.add(terrain[i]);
    }
    expect(grounds.get(B.FOREST)!.has(T.GRASS)).toBe(true);
    expect(grounds.get(B.SWAMP)!.has(T.SWAMP)).toBe(true);
    expect(grounds.get(B.DESERT)!.has(T.DESERT)).toBe(true);
    expect(grounds.get(B.MOUNTAIN)!.has(T.DIRT) || grounds.get(B.MOUNTAIN)!.has(T.STONE)).toBe(true);
    expect(grounds.get(B.FOREST)!.has(T.SWAMP)).toBe(false);
  });

  it('carves rivers on most islands', () => {
    let withRiver = 0;
    for (let seed = 1; seed <= 10; seed++) {
      if (generateTerrain(seed).terrain.some((t) => t === T.RIVER)) withRiver++;
    }
    expect(withRiver).toBeGreaterThanOrEqual(8);
  });
});
