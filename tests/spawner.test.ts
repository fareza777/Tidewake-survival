import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/rng';
import { CREATURES, isHostileKind } from '@/data/creatures';
import { newCreature, type Creature } from '@/sim/creatures';
import { bodyBlocked } from '@/sim/movement';
import {
  DESPAWN_RADIUS, SPAWN_MAX, SPAWN_MIN, START_SAFE_RADIUS, capsFor, cull, hostileSpotOk, trySpawn, type SpawnContext,
} from '@/sim/spawner';
import { emptyStructures, placeStructure } from '@/sim/structures';
import { B, T, WORLD_SIZE, idx, type Biome, type World } from '@/sim/world/types';

function makeWorld(biome: Biome = B.FOREST, start = { x: 5, y: 5 }): World {
  const size = WORLD_SIZE;
  const terrain = new Uint8Array(size * size).fill(T.GRASS);
  return { seed: 0, size, terrain, biome: new Uint8Array(size * size).fill(biome), landmarks: [], resources: [], start };
}

const hero = { x: 80.5, y: 80.5 };
const ctx = (over: Partial<SpawnContext> = {}): SpawnContext => ({
  world: makeWorld(), solids: new Set(), structures: emptyStructures(), hero, night: false, creatures: [], nextId: 1, rng: new Rng(5), ...over,
});
const kinds = (list: readonly Creature[]) => list.map((c) => c.kind);
const many = (n: number, kind: Creature['kind'], base = 0): Creature[] =>
  Array.from({ length: n }, (_, i) => newCreature(base + i, kind, 70 + i, 70, new Rng(i)));

describe('capsFor', () => {
  it('allows more monsters and fewer animals at night', () => {
    expect(capsFor(true).hostile).toBeGreaterThan(capsFor(false).hostile);
    expect(capsFor(true).animals).toBeLessThan(capsFor(false).animals);
  });
});

describe('trySpawn', () => {
  it('puts a creature on land in the ring around the hero, out of sight and not too far', () => {
    let spawned = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const c = trySpawn(ctx({ rng: new Rng(seed), nextId: 7 }));
      if (!c) continue;
      spawned++;
      const d = Math.hypot(c.x - hero.x, c.y - hero.y);
      expect(d).toBeGreaterThanOrEqual(SPAWN_MIN - 0.01);
      expect(d).toBeLessThanOrEqual(SPAWN_MAX + 0.01);
      expect(c.id).toBe(7);
      expect(c.hp).toBe(CREATURES[c.kind].hp);
    }
    expect(spawned).toBeGreaterThan(30);
  });

  it('only picks creatures that belong to the biome and the time of day', () => {
    const forestDay = new Set<string>();
    const mountainNight = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const a = trySpawn(ctx({ rng: new Rng(seed) }));
      if (a) forestDay.add(a.kind);
      const b = trySpawn(ctx({ rng: new Rng(seed), world: makeWorld(B.MOUNTAIN), night: true }));
      if (b) mountainNight.add(b.kind);
    }
    expect([...forestDay].sort()).toEqual(['bird', 'boar', 'fox', 'mushroom', 'rabbit', 'slime', 'wasp']);
    expect([...mountainNight].sort()).toEqual(['fox', 'skeleton', 'zombie']);
  });

  it('never spawns on water, deep or shallow, rivers, or a solid tile', () => {
    const world = makeWorld();
    for (let y = 0; y < WORLD_SIZE; y++) {
      for (let x = 0; x < WORLD_SIZE; x++) {
        const dx = x - 80;
        if (dx > 5) world.terrain[idx(x, y)] = T.SHALLOW;
        else if (dx < -5) world.terrain[idx(x, y)] = T.RIVER;
        else if (y > 85) world.terrain[idx(x, y)] = T.DEEP;
      }
    }
    const solids = new Set<number>();
    for (let x = 70; x < 90; x++) solids.add(idx(x, 70));
    for (let seed = 1; seed <= 200; seed++) {
      const c = trySpawn(ctx({ world, solids, rng: new Rng(seed) }));
      if (!c) continue;
      const tile = idx(Math.floor(c.x), Math.floor(c.y));
      expect(world.terrain[tile]).toBe(T.GRASS);
      expect(solids.has(tile)).toBe(false);
    }
  });

  it('spawns nothing on an island with no land in the ring, and nothing in the sea biome', () => {
    const sea = makeWorld();
    sea.terrain.fill(T.DEEP);
    expect(trySpawn(ctx({ world: sea }))).toBeNull();
    expect(trySpawn(ctx({ world: makeWorld(B.SEA) }))).toBeNull();
  });

  it('stops at the cap for monsters, and at the cap for animals, independently', () => {
    const hostileDay = capsFor(false).hostile;
    const animalDay = capsFor(false).animals;
    const full = [...many(hostileDay, 'slime'), ...many(animalDay, 'rabbit', 100)];
    for (let seed = 1; seed <= 30; seed++) expect(trySpawn(ctx({ creatures: full, rng: new Rng(seed) }))).toBeNull();
    const noMonsters = many(animalDay, 'rabbit', 100);
    const picks = new Set<string>();
    for (let seed = 1; seed <= 100; seed++) {
      const c = trySpawn(ctx({ creatures: noMonsters, rng: new Rng(seed) }));
      if (c) picks.add(isHostileKind(c.kind) ? 'hostile' : 'animal');
    }
    expect([...picks]).toEqual(['hostile']);
  });

  it('keeps monsters away from the starting beach and out of the glow of a fire or torch', () => {
    const near = { x: 85, y: 85 };
    const fire = placeStructure(emptyStructures(), 'campfire', 85, 85);
    expect(hostileSpotOk(makeWorld(B.FOREST, near), emptyStructures(), 87, 87)).toBe(false);
    expect(hostileSpotOk(makeWorld(B.FOREST, near), emptyStructures(), 85 + START_SAFE_RADIUS + 2, 85)).toBe(true);
    expect(hostileSpotOk(makeWorld(), fire, 85 + 5, 85)).toBe(false);
    expect(hostileSpotOk(makeWorld(), fire, 85 + 8, 85)).toBe(true);
    const world = makeWorld(B.FOREST, hero);
    const seen = new Set<string>();
    for (let seed = 1; seed <= 100; seed++) {
      const c = trySpawn(ctx({ world, rng: new Rng(seed) }));
      if (c) seen.add(isHostileKind(c.kind) ? 'hostile' : 'animal');
    }
    expect(seen.has('hostile')).toBe(true);
  });

  it('only spawns where the whole body fits, never overlapping a tree or rock next to the spot', () => {
    const solids = new Set<number>();
    for (let y = 40; y < 120; y++) for (let x = 40; x < 120; x++) if ((x + y) % 2 === 0) solids.add(idx(x, y));
    let spawned = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const c = trySpawn(ctx({ solids, rng: new Rng(seed) }));
      if (!c) continue;
      spawned++;
      expect(bodyBlocked(makeWorld(), solids, c.x, c.y, CREATURES[c.kind].radius), `seed ${seed}`).toBe(false);
    }
    expect(spawned).toBeGreaterThan(0);
    const clear = new Set<number>([idx(100, 80), idx(100, 79)]);
    for (let seed = 1; seed <= 100; seed++) {
      const c = trySpawn(ctx({ solids: clear, rng: new Rng(seed) }));
      if (c) expect(bodyBlocked(makeWorld(), clear, c.x, c.y, CREATURES[c.kind].radius)).toBe(false);
    }
  });

  it('does not stack a new creature on one that is already there', () => {
    const existing = Array.from({ length: 360 }, (_, i) => {
      const a = (i / 360) * Math.PI * 2;
      return newCreature(i, 'rabbit', hero.x + Math.cos(a) * 15, hero.y + Math.sin(a) * 15, new Rng(i));
    }).slice(0, capsFor(false).animals);
    for (let seed = 1; seed <= 50; seed++) {
      const c = trySpawn(ctx({ creatures: existing, rng: new Rng(seed) }));
      if (c) for (const e of existing) expect(Math.hypot(c.x - e.x, c.y - e.y)).toBeGreaterThan(0.8);
    }
  });

  it('is deterministic for the same random stream', () => {
    expect(trySpawn(ctx({ rng: new Rng(11) }))).toEqual(trySpawn(ctx({ rng: new Rng(11) })));
  });
});

describe('cull', () => {
  const at = (kind: Creature['kind'], dx: number, dy = 0) => newCreature(1, kind, hero.x + dx, hero.y + dy, new Rng(1));

  it('removes creatures that are far from the hero and keeps the near ones', () => {
    const list = [at('rabbit', 3), at('rabbit', DESPAWN_RADIUS + 1), at('slime', 0, -(DESPAWN_RADIUS + 5))];
    expect(kinds(cull(list, hero, false))).toEqual(['rabbit']);
  });

  it('lets the creatures of the night fade at dawn unless the hero is close to them', () => {
    const list = [at('skeleton', SPAWN_MIN + 3), at('skeleton', 3), at('slime', SPAWN_MIN + 3)];
    expect(kinds(cull(list, hero, true))).toEqual(['skeleton', 'skeleton', 'slime']);
    expect(kinds(cull(list, hero, false))).toEqual(['skeleton', 'slime']);
  });
});
