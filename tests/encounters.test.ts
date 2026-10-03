import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/rng';
import { CREATURES, isHostileKind } from '@/data/creatures';
import { ITEMS } from '@/data/items';
import { newCreature, type Creature } from '@/sim/creatures';
import {
  ARROW_SPEED, creatureInReach, emptyEncounters, hostilesNear, shoot, swing, takePickups, tickEncounters,
  type Encounters, type TickContext,
} from '@/sim/encounters';
import { addItem, countItem, emptyInventory } from '@/sim/inventory';
import { capsFor } from '@/sim/spawner';
import { emptyStructures } from '@/sim/structures';
import { B, T, WORLD_SIZE, idx, type World } from '@/sim/world/types';

function makeWorld(): World {
  const size = WORLD_SIZE;
  const terrain = new Uint8Array(size * size).fill(T.GRASS);
  return { seed: 0, size, terrain, biome: new Uint8Array(size * size).fill(B.FOREST), landmarks: [], resources: [], start: { x: 3, y: 3 } };
}

const hero = { x: 80.5, y: 80.5 };
const world = makeWorld();
const tctx = (over: Partial<TickContext> = {}): TickContext => ({
  world, solids: new Set(), structures: emptyStructures(), hero, heroAlive: true, night: false, difficulty: 'normal', defense: 0, rng: new Rng(4), ...over,
});
const mk = (kind: Creature['kind'], x: number, y: number, id: number, over: Partial<Creature> = {}): Creature =>
  ({ ...newCreature(id, kind, x, y, new Rng(id)), ...over });
const withCreatures = (...creatures: Creature[]): Encounters => ({ ...emptyEncounters(), creatures, nextId: 100 });
const sword = { damage: 5, reach: 1.3, arc: 110, knockback: 0.35 };
const spear = { damage: 5, reach: 1.9, arc: 30, knockback: 0.5 };

describe('swing', () => {
  it('hurts every creature inside the arc, pushes it away, and spares the ones outside', () => {
    const e = withCreatures(mk('slime', 81.5, 80.5, 1), mk('mushroom', 81.3, 80.9, 2), mk('slime', 79, 80.5, 3));
    const r = swing(e, hero, 'right', sword, new Rng(1));
    expect(r.events.map((ev) => ev.t === 'hit' && ev.id)).toEqual([1, 2]);
    expect(r.e.creatures.find((c) => c.id === 1)!.hp).toBe(CREATURES.slime.hp - 5);
    expect(r.e.creatures.find((c) => c.id === 1)!.pushX).toBeGreaterThan(0);
    expect(r.e.creatures.find((c) => c.id === 3)!.hp).toBe(CREATURES.slime.hp);
  });

  it('kills what runs out of hit points, removes it, and leaves its loot lying around', () => {
    const e = withCreatures(mk('rabbit', 81.2, 80.5, 7));
    const r = swing(e, hero, 'right', sword, new Rng(1));
    expect(r.e.creatures).toEqual([]);
    expect(r.events.map((ev) => ev.t)).toEqual(['hit', 'killed']);
    expect(r.e.pickups.map((p) => p.item)).toEqual(['raw_meat']);
    expect(r.e.nextId).toBe(101);
    expect(Math.hypot(r.e.pickups[0].x - 81.2, r.e.pickups[0].y - 80.5)).toBeLessThan(0.8);
  });

  it('lets a spear reach a target a sword cannot, but only straight ahead', () => {
    const e = withCreatures(mk('slime', 82.3, 80.5, 1), mk('slime', 82.3, 81.6, 2));
    expect(swing(e, hero, 'right', sword, new Rng(1)).events).toEqual([]);
    expect(swing(e, hero, 'right', spear, new Rng(1)).events.map((ev) => ev.t === 'hit' && ev.id)).toEqual([1]);
  });

  it('does nothing in an empty field', () => {
    const r = swing(emptyEncounters(), hero, 'up', sword, new Rng(1));
    expect(r.events).toEqual([]);
  });
});

describe('creatureInReach', () => {
  it('says whether a blow in that direction would land on something', () => {
    const e = withCreatures(mk('slime', 81.4, 80.5, 1));
    expect(creatureInReach(e, hero, 'right', 1.0, 90)).toBe(true);
    expect(creatureInReach(e, hero, 'left', 1.0, 90)).toBe(false);
    expect(creatureInReach(emptyEncounters(), hero, 'right', 1.0, 90)).toBe(false);
  });
});

describe('hostilesNear', () => {
  const heroAt = { x: 50, y: 50 };
  const at = (kind: Parameters<typeof newCreature>[1], dx: number, state: 'idle' | 'chase' | 'windup' | 'flee' = 'chase') =>
    ({ ...newCreature(1, kind, heroAt.x + dx, heroAt.y, new Rng(1)), state });

  it('counts monsters that are hunting the hero within the radius, and nothing else', () => {
    const e = {
      ...emptyEncounters(),
      creatures: [at('slime', 4), at('skeleton', 6, 'windup'), at('slime', 30), at('rabbit', 2, 'flee'), at('boar', 2, 'chase'), at('worm', 3, 'idle')],
    };
    expect(hostilesNear(e, heroAt, 10)).toBe(2);
    expect(hostilesNear(emptyEncounters(), heroAt, 10)).toBe(0);
  });
});

describe('arrows', () => {
  const bow = ITEMS.bow.weapon!;

  it('fly in the facing direction at a steady speed and fall at the end of their range', () => {
    let e = shoot(emptyEncounters(), hero, 'right', bow);
    expect(e.arrows).toHaveLength(1);
    expect(e.arrows[0]).toMatchObject({ dx: 1, dy: 0, damage: bow.damage, left: bow.reach });
    const x0 = e.arrows[0].x;
    e = tickEncounters(e, tctx(), 0.1).e;
    expect(e.arrows[0].x).toBeCloseTo(x0 + ARROW_SPEED * 0.1, 3);
    for (let i = 0; i < 40; i++) e = tickEncounters(e, tctx(), 0.05).e;
    expect(e.arrows).toEqual([]);
  });

  it('hit the first creature in their path, once, and are used up', () => {
    const e0 = { ...withCreatures(mk('slime', 83.5, 80.5, 1), mk('slime', 85.5, 80.5, 2)), spawnTimer: 99 };
    let e = shoot(e0, hero, 'right', bow);
    const events: string[] = [];
    for (let i = 0; i < 20; i++) {
      const r = tickEncounters(e, tctx(), 0.05);
      e = r.e;
      for (const ev of r.events) if (ev.t === 'hit') events.push(`${ev.id}:${ev.amount}`);
    }
    expect(events).toEqual([`1:${bow.damage}`]);
    expect(e.arrows).toEqual([]);
    expect(e.creatures.find((c) => c.id === 2)!.hp).toBe(CREATURES.slime.hp);
  });

  it('cannot hit a small fast target by skipping over it', () => {
    const e0 = { ...withCreatures(mk('bird', 83.4, 80.55, 1, { state: 'idle', timer: 99 })), spawnTimer: 99 };
    let e = shoot(e0, hero, 'right', bow);
    let hits = 0;
    for (let i = 0; i < 6; i++) {
      const r = tickEncounters(e, tctx(), 0.5);
      e = r.e;
      hits += r.events.filter((ev) => ev.t === 'hit').length;
    }
    expect(hits).toBe(1);
  });

  it('stop at a solid tile and never hit what stands behind it', () => {
    const solids = new Set([idx(82, 80)]);
    const e0 = { ...withCreatures(mk('slime', 84.5, 80.5, 1, { state: 'idle', timer: 99 })), spawnTimer: 99 };
    let e = shoot(e0, hero, 'right', bow);
    let hits = 0;
    for (let i = 0; i < 20; i++) {
      const r = tickEncounters(e, tctx({ solids }), 0.05);
      e = r.e;
      hits += r.events.filter((ev) => ev.t === 'hit').length;
    }
    expect(hits).toBe(0);
    expect(e.arrows).toEqual([]);
  });

  it('can kill, and the kill leaves loot', () => {
    const e0 = { ...withCreatures(mk('rabbit', 83.5, 80.5, 1, { state: 'idle', timer: 99 })), spawnTimer: 99 };
    let e = shoot(e0, hero, 'right', bow);
    const kinds: string[] = [];
    for (let i = 0; i < 20; i++) {
      const r = tickEncounters(e, tctx(), 0.05);
      e = r.e;
      kinds.push(...r.events.map((ev) => ev.t));
    }
    expect(kinds).toEqual(['hit', 'killed']);
    expect(e.pickups[0].item).toBe('raw_meat');
  });
});

describe('tickEncounters', () => {
  it('reports a blow on the hero scaled by the difficulty and reduced by armour', () => {
    const run = (over: Partial<TickContext>) => {
      let e: Encounters = { ...withCreatures(mk('slime', 81.1, 80.5, 1)), spawnTimer: 99 };
      const hits: number[] = [];
      for (let i = 0; i < 40; i++) {
        const r = tickEncounters(e, tctx(over), 0.05);
        e = r.e;
        for (const ev of r.events) if (ev.t === 'hurtHero') hits.push(ev.amount);
      }
      return hits;
    };
    expect(run({})[0]).toBe(CREATURES.slime.damage);
    expect(run({ difficulty: 'relaxed' })[0]).toBe(4);
    expect(run({ difficulty: 'hardcore' })[0]).toBe(8);
    expect(run({ defense: 4 })[0]).toBe(2);
    expect(run({ heroAlive: false })).toEqual([]);
  });

  it('adds creatures over time, never beyond the caps, and keeps both kinds around', () => {
    let e = emptyEncounters();
    const rng = new Rng(8);
    for (let t = 0; t < 120; t += 0.1) {
      e = tickEncounters(e, tctx({ rng }), 0.1).e;
      const hostile = e.creatures.filter((c) => isHostileKind(c.kind)).length;
      expect(hostile).toBeLessThanOrEqual(capsFor(false).hostile);
      expect(e.creatures.length - hostile).toBeLessThanOrEqual(capsFor(false).animals);
    }
    expect(e.creatures.length).toBeGreaterThan(5);
  });

  it('removes creatures the hero has left far behind', () => {
    let e: Encounters = { ...withCreatures(mk('rabbit', 20.5, 20.5, 1)), spawnTimer: 0.01 };
    e = tickEncounters(e, tctx(), 0.05).e;
    expect(e.creatures.find((c) => c.id === 1)).toBeUndefined();
  });

  it('pushes creatures that stand on each other apart', () => {
    const e = { ...withCreatures(mk('slime', 60.5, 60.5, 1, { state: 'idle', timer: 99 }), mk('slime', 60.5, 60.5, 2, { state: 'idle', timer: 99 })), spawnTimer: 99 };
    const r = tickEncounters(e, tctx(), 0.05).e;
    const [a, b] = r.creatures;
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(CREATURES.slime.radius * 2 - 0.02);
  });

  it('ages loose items, drifts the near ones toward the hero and drops them after two minutes', () => {
    const near = { id: 1, item: 'bone' as const, qty: 1, x: 81.5, y: 80.5, age: 0 };
    const old = { id: 2, item: 'bone' as const, qty: 1, x: 50, y: 50, age: 119.95 };
    const e = { ...emptyEncounters(), pickups: [near, old], spawnTimer: 99 };
    const r = tickEncounters(e, tctx(), 0.1).e;
    expect(r.pickups).toHaveLength(1);
    expect(r.pickups[0].x).toBeLessThan(81.5);
  });
});

describe('takePickups', () => {
  it('moves loot into the backpack and keeps the rest on the ground', () => {
    const e = { ...emptyEncounters(), pickups: [{ id: 1, item: 'gel' as const, qty: 2, x: 80.6, y: 80.5, age: 0 }, { id: 2, item: 'gel' as const, qty: 2, x: 70, y: 70, age: 0 }] };
    const r = takePickups(e, emptyInventory(), hero);
    expect(countItem(r.inv, 'gel')).toBe(2);
    expect(r.taken).toEqual([{ item: 'gel', qty: 2 }]);
    expect(r.e.pickups.map((p) => p.id)).toEqual([2]);
  });

  it('returns the same state when there is nothing to take, and flags a full backpack', () => {
    const e = { ...emptyEncounters(), pickups: [{ id: 1, item: 'gel' as const, qty: 2, x: 50, y: 50, age: 0 }] };
    expect(takePickups(e, emptyInventory(), hero).e).toBe(e);
    const full = addItem(emptyInventory(1), 'wood', 99).inv;
    const here = { ...emptyEncounters(), pickups: [{ id: 1, item: 'gel' as const, qty: 2, x: 80.6, y: 80.5, age: 0 }] };
    const r = takePickups(here, full, hero);
    expect(r.full).toBe(true);
    expect(r.e.pickups).toHaveLength(1);
  });
});
