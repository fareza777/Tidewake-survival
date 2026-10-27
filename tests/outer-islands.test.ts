import { describe, expect, it } from 'vitest';
import { newSlot } from '@/core/saveData';
import { cacheLoot } from '@/data/caches';
import { ITEMS } from '@/data/items';
import { countItem } from '@/sim/inventory';
import { sessionFromSlot } from '@/sim/session';
import { dig } from '@/sim/storySession';
import { spotsOf } from '@/sim/world/spots';
import { generateWorld, reachable } from '@/sim/world/generate';
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
        expect(ids).toEqual(['start', 'dock', OUTER[id].dungeon, 'cache1', 'cache2', 'cache3', 'cache4']);
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
      frost: [T.SAND, T.SNOW, T.STONE], ember: [T.SAND, T.ASH, T.STONE, T.LAVA], wreck: [T.SAND, T.DIRT, T.SWAMP], sky: [T.SAND, T.GRASS, T.STONE, T.SNOW],
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

describe('hidden chests', () => {
  it('lie on every far island, apart from the dock and dungeon and from each other, each a find with its own loot', () => {
    for (const id of IDS) {
      const w = generateOuter(2468, id);
      const spots = spotsOf(w);
      expect(spots.map((s) => s.id), id).toEqual([1, 2, 3, 4].map((k) => `cache:${id}:${k}`));
      for (const s of spots) {
        expect(s.kind).toBe('treasure');
        expect(isWater(w.terrain[idx(s.x, s.y, w.size)])).toBe(false);
        expect(Math.hypot(s.x - w.start.x, s.y - w.start.y), `${id} ${s.id}`).toBeGreaterThan(9);
      }
      for (let k = 1; k <= 4; k++) expect(cacheLoot(id, k).length, `${id} ${k}`).toBeGreaterThan(0);
      expect(cacheLoot(id, 1).some((l) => l.item !== 'gold' && ITEMS[l.item].armor)).toBe(true);
    }
    expect(spotsOf(generateWorld(2468)).some((s) => s.id.startsWith('cache'))).toBe(false);
  });

  it('open with a plain USE once, pay their loot and count as a cache (not as buried treasure)', () => {
    const w = generateOuter(2468, 'ember');
    const spot = spotsOf(w)[0];
    const s0 = sessionFromSlot(newSlot(0, 'Ari', 2468, 'normal', { x: 5, y: 5 }, { day: 1, t: 100 }, 1000));
    const s = { ...s0, island: 'ember' as const };
    const r = dig(s, spot, 0);
    expect(countItem(r.session.inventory, 'ring_might')).toBe(1);
    expect(countItem(r.session.inventory, 'gold')).toBeGreaterThanOrEqual(80);
    expect(r.session.quests.counters.cache).toBe(1);
    expect(r.session.quests.counters.dig).toBeUndefined();
    expect(dig(r.session, spot, 0).session).toBe(r.session);
  });
});
