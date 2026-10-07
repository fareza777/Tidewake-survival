import { describe, expect, it } from 'vitest';
import { reachable } from '@/sim/world/generate';
import { OUTER, generateOuter, validateOuter, type OuterId } from '@/sim/world/outer';
import { B, T, idx, isWater } from '@/sim/world/types';

const IDS = Object.keys(OUTER) as OuterId[];
const SEEDS = [1, 42, 20260607, 987654321];

describe('far islands', () => {
  it('are playable for any world seed: a beach to land on, a dock beside it and a dungeon that can be walked to', () => {
    for (const id of IDS) {
      for (const seed of SEEDS) {
        const w = generateOuter(seed, id);
        expect(validateOuter(w), `${id} ${seed}`).toEqual([]);
        expect(w.island).toBe(id);
        expect(w.terrain[idx(w.start.x, w.start.y, w.size)]).toBe(T.SAND);
        const ids = w.landmarks.map((l) => l.id);
        expect(ids).toEqual(['start', 'dock', OUTER[id].dungeon]);
        const seen = reachable(w.terrain, w.size, w.start);
        for (const l of w.landmarks) expect(seen[idx(l.x, l.y, w.size)], `${id} ${l.id}`).toBe(1);
      }
    }
  });

  it('give the same island for the same seed, and a different one for another seed', () => {
    for (const id of IDS) {
      const a = generateOuter(7, id);
      expect(generateOuter(7, id)).toBe(a);
      expect(generateOuter(8, id).terrain).not.toEqual(a.terrain);
    }
  });

  it('keep to their own biome and ground, and have things to gather', () => {
    const ground: Record<OuterId, number[]> = {
      frost: [T.SAND, T.SNOW, T.STONE], ember: [T.SAND, T.ASH, T.STONE, T.LAVA], wreck: [T.SAND, T.DIRT, T.SWAMP], sky: [T.SAND, T.GRASS, T.STONE],
    };
    for (const id of IDS) {
      const w = generateOuter(3, id);
      for (let i = 0; i < w.terrain.length; i++) {
        if (isWater(w.terrain[i])) continue;
        expect(ground[id], `${id} ground ${w.terrain[i]}`).toContain(w.terrain[i]);
        expect(w.biome[i]).toBe(OUTER[id].biome);
      }
      expect(w.resources.length, id).toBeGreaterThan(150);
    }
    expect(B.FROST).not.toBe(B.VOLCANO);
  });

  it('have lava only on the ember island, and no node stands on it', () => {
    for (const id of IDS) {
      const w = generateOuter(5, id);
      const lava = w.terrain.some((t) => t === T.LAVA);
      expect(lava, id).toBe(id === 'ember');
      for (const n of w.resources) expect(w.terrain[idx(n.x, n.y, w.size)]).not.toBe(T.LAVA);
    }
  });
});
