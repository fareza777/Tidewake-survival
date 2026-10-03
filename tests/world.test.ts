import { describe, expect, it } from 'vitest';
import { fbm, valueNoise } from '@/sim/world/noise';
import { generateWorld, reachable, validateWorld } from '@/sim/world/generate';
import { RESERVE_RADIUS } from '@/sim/world/landmarks';
import { B, T, WORLD_SIZE, idx, isWater, type World } from '@/sim/world/types';

describe('noise', () => {
  it('is deterministic and stays in [0, 1)', () => {
    for (let i = 0; i < 200; i++) {
      const a = fbm(42, i * 1.7, i * 0.9, 38, 4);
      expect(a).toBe(fbm(42, i * 1.7, i * 0.9, 38, 4));
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(1);
    }
    expect(valueNoise(1, 3.2, 4.1)).not.toBe(valueNoise(2, 3.2, 4.1));
  });
});

describe('generateWorld', () => {
  it('returns the same island for the same seed', () => {
    const a = generateWorld(1234);
    const b = generateWorld(1234);
    expect(Array.from(a.terrain)).toEqual(Array.from(b.terrain));
    expect(a.landmarks).toEqual(b.landmarks);
    expect(a.resources).toEqual(b.resources);
  });

  it('differs between seeds', () => {
    expect(Array.from(generateWorld(1).terrain)).not.toEqual(Array.from(generateWorld(2).terrain));
  });

  it('produces a valid, fully reachable island for many seeds', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const w = generateWorld(seed);
      expect(validateWorld(w), `seed ${seed}`).toEqual([]);
    }
  }, 60_000);

  it('copes with extreme seeds (0, the largest 32-bit value, negative and fractional input)', () => {
    for (const seed of [0, 1, 2 ** 31, 4294967295, -5, 12.7]) {
      const w = generateWorld(seed);
      expect(validateWorld(w), `seed ${seed}`).toEqual([]);
    }
  }, 30_000);

  it('places every story landmark exactly once', () => {
    const w = generateWorld(7);
    const ids = w.landmarks.map((l) => l.id);
    expect(new Set(ids).size).toBe(13);
    for (const id of ['start', 'camp', 'sailor', 'herbalist', 'miner', 'grotto', 'deepmine', 'ruin', 'lighthouse', 'tablets', 'treasure1', 'treasure2', 'treasure3']) {
      expect(ids).toContain(id);
    }
  });

  it('puts the start on a southern beach and the lighthouse on the north cape', () => {
    for (const seed of [3, 11, 99]) {
      const w = generateWorld(seed);
      expect(w.terrain[idx(w.start.x, w.start.y)]).toBe(T.SAND);
      expect(w.start.y).toBeGreaterThan(WORLD_SIZE * 0.6);
      const light = w.landmarks.find((l) => l.id === 'lighthouse')!;
      expect(light.y).toBeLessThan(WORLD_SIZE * 0.35);
    }
  });

  it('places dungeons and NPC huts in the biomes the story expects', () => {
    const w = generateWorld(21);
    const biomeOf = (id: string) => w.landmarks.find((l) => l.id === id)!.biome;
    expect(biomeOf('grotto')).toBe(B.FOREST);
    expect(biomeOf('deepmine')).toBe(B.MOUNTAIN);
    expect(biomeOf('herbalist')).toBe(B.SWAMP);
    expect(biomeOf('ruin')).toBe(B.DESERT);
  });

  it('has all four biomes with real land area', () => {
    const w = generateWorld(5);
    for (const b of [B.FOREST, B.MOUNTAIN, B.SWAMP, B.DESERT]) {
      let n = 0;
      for (let i = 0; i < w.biome.length; i++) if (w.biome[i] === b && !isWater(w.terrain[i])) n++;
      expect(n).toBeGreaterThan(400);
    }
  });

  it('scatters plenty of resources, never in water, on landmarks or stacked', () => {
    const w = generateWorld(8);
    expect(w.resources.length).toBeGreaterThan(400);
    const seen = new Set<number>();
    for (const r of w.resources) {
      expect(isWater(w.terrain[idx(r.x, r.y)])).toBe(false);
      expect(seen.has(idx(r.x, r.y))).toBe(false);
      seen.add(idx(r.x, r.y));
      for (const l of w.landmarks) {
        const rad = RESERVE_RADIUS[l.id];
        expect(Math.abs(r.x - l.x) <= rad && Math.abs(r.y - l.y) <= rad, `${r.kind}@${r.x},${r.y} inside ${l.id}`).toBe(false);
      }
    }
  });

  it('does not let resource nodes touch each other', () => {
    const w = generateWorld(8);
    const at = new Set(w.resources.map((r) => idx(r.x, r.y)));
    for (const r of w.resources) {
      for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) expect(at.has(idx(r.x + dx, r.y + dy))).toBe(false);
    }
  });
});

describe('validateWorld', () => {
  const clone = (w: World): World => ({ ...w, terrain: w.terrain.slice(), landmarks: w.landmarks.map((l) => ({ ...l })) });

  it('reports a landmark sunk into deep water', () => {
    const w = clone(generateWorld(9));
    const l = w.landmarks.find((x) => x.id === 'sailor')!;
    w.terrain[idx(l.x, l.y)] = T.DEEP;
    expect(validateWorld(w)).toContain('sailor is in water');
  });

  it('reports a landmark cut off by deep water', () => {
    const w = clone(generateWorld(9));
    const l = w.landmarks.find((x) => x.id === 'ruin')!;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === 3) w.terrain[idx(l.x + dx, l.y + dy)] = T.DEEP;
      }
    }
    expect(validateWorld(w)).toContain('ruin is unreachable');
  });

  it('reachable() never crosses deep water', () => {
    const w = generateWorld(4);
    const seen = reachable(w.terrain, w.size, w.start);
    for (let i = 0; i < seen.length; i++) if (seen[i]) expect(w.terrain[i]).not.toBe(T.DEEP);
  });
});
