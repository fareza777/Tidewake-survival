import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/rng';
import { BOSSES } from '@/data/bosses';
import { CREATURES } from '@/data/creatures';
import { ITEMS } from '@/data/items';
import { SHOT_RANGE, SHOT_SPEED, type FlyingShot } from '@/sim/boss';
import { MAX_MINIONS, flyShots, launch, placeSummons } from '@/sim/bossFight';
import { newCreature, type Creature } from '@/sim/creatures';
import { creatureInReach, emptyEncounters, hostilesNear, shoot, swing, tickEncounters, type Encounters, type TickContext } from '@/sim/encounters';
import { emptyStructures } from '@/sim/structures';
import { T, WORLD_SIZE, idx, type World } from '@/sim/world/types';

function makeWorld(): World {
  const size = WORLD_SIZE;
  const terrain = new Uint8Array(size * size).fill(T.GRASS);
  return { seed: 0, size, terrain, biome: new Uint8Array(size * size).fill(1), landmarks: [], resources: [], start: { x: 3, y: 3 } };
}
const world = makeWorld();
const hero = { x: 80.5, y: 80.5 };
const tctx = (over: Partial<TickContext> = {}): TickContext => ({
  world, solids: new Set(), structures: emptyStructures(), hero, heroAlive: true, night: false, difficulty: 'normal', defense: 0, rng: new Rng(4), ...over,
});
const mk = (kind: Creature['kind'], x: number, y: number, id: number, over: Partial<Creature> = {}): Creature =>
  ({ ...newCreature(id, kind, x, y, new Rng(id)), ...over });
const withCreatures = (...creatures: Creature[]): Encounters => ({ ...emptyEncounters(), creatures, nextId: 100, spawnTimer: 99 });
const bolt = (over: Partial<FlyingShot> = {}): FlyingShot => ({ id: 1, kind: 'ironbones', x: 74, y: 80.5, dx: 1, dy: 0, speed: SHOT_SPEED, left: SHOT_RANGE, damage: 10, ...over });

describe('boss bolts', () => {
  it('are added with ids from the shared counter and the kind that fired them', () => {
    const e = launch({ ...emptyEncounters(), nextId: 40 }, 'mirelord', [bolt(), bolt()]);
    expect(e.shots.map((s) => [s.id, s.kind])).toEqual([[40, 'mirelord'], [41, 'mirelord']]);
    expect(e.nextId).toBe(42);
  });

  it('fly straight, hurt the hero once with the difficulty and armour applied, and are used up', () => {
    let e: Encounters = { ...emptyEncounters(), shots: [bolt()], spawnTimer: 99 };
    const hits: number[] = [];
    for (let i = 0; i < 80; i++) {
      const r = flyShots(e, tctx({ defense: 3 }), 0.05);
      e = r.e;
      for (const ev of r.events) if (ev.t === 'hurtHero') hits.push(ev.amount);
    }
    expect(hits).toEqual([7]);
    expect(e.shots).toEqual([]);
  });

  it('miss a hero who is out of the way, fall at the end of their range, and never hurt a collapsed hero', () => {
    const aside = flyShots({ ...emptyEncounters(), shots: [bolt({ y: 78 })] }, tctx(), 5);
    expect(aside.events).toEqual([]);
    expect(aside.e.shots).toEqual([]);
    const down = flyShots({ ...emptyEncounters(), shots: [bolt()] }, tctx({ heroAlive: false }), 2);
    expect(down.events).toEqual([]);
    expect(down.e.shots).toHaveLength(1);
  });

  it('stop at a wall or a solid tile and cannot skip through one in a single big step', () => {
    const solids = new Set([idx(77, 80)]);
    const r = flyShots({ ...emptyEncounters(), shots: [bolt({ speed: 50 })] }, tctx({ solids }), 1);
    expect(r.events).toEqual([]);
    expect(r.e.shots).toEqual([]);
  });
});

describe('boss fights in tickEncounters', () => {
  it('turn a boss move into bolts that then reach the hero', () => {
    let e = withCreatures(mk('ironbones', 72.5, 80.5, 1, { step: 1 }));
    const kinds: string[] = [];
    let launched = 0;
    for (let i = 0; i < 200; i++) {
      const r = tickEncounters(e, tctx({ fixed: true }), 0.05);
      launched = Math.max(launched, r.e.shots.length);
      e = r.e;
      for (const ev of r.events) if (ev.t === 'hurtHero') kinds.push(ev.kind);
    }
    expect(launched).toBe(3);
    expect(kinds.length).toBeGreaterThan(0);
    expect(new Set(kinds)).toEqual(new Set(['ironbones']));
  });

  it('use the boss move damage, not the creature damage, for a charge that lands', () => {
    let e = withCreatures(mk('mossback', 74, 80.5, 1));
    const amounts: number[] = [];
    for (let i = 0; i < 100; i++) {
      const r = tickEncounters(e, tctx({ fixed: true }), 0.05);
      e = r.e;
      for (const ev of r.events) if (ev.t === 'hurtHero') amounts.push(ev.amount);
    }
    expect(amounts[0]).toBe(BOSSES.mossback.phases[0].moves[0].damage);
    expect(amounts[0]).not.toBe(CREATURES.mossback.damage);
  });

  it('call helpers in the second phase: they appear beside the boss, already hunting, and stop at the limit', () => {
    let e = withCreatures(mk('mossback', 74, 80.5, 1, { hp: CREATURES.mossback.hp * 0.3, step: 2, state: 'windup', timer: 0.02, angry: true }));
    e = tickEncounters(e, tctx({ fixed: true }), 0.05).e;
    const minions = e.creatures.filter((c) => c.kind === 'mushroom');
    expect(minions).toHaveLength(2);
    for (const m of minions) {
      expect(Math.hypot(m.x - 74, m.y - 80.5)).toBeLessThan(2.5);
      expect(m).toMatchObject({ state: 'chase', angry: true });
    }
    expect(new Set(e.creatures.map((c) => c.id)).size).toBe(e.creatures.length);
    const crowd = Array.from({ length: MAX_MINIONS }, (_, i) => mk('slime', 60 + i, 60, 10 + i));
    const full = placeSummons({ ...withCreatures(mk('mossback', 74, 80.5, 1), ...crowd) }, mk('mossback', 74, 80.5, 1), ['mushroom', 'mushroom'], tctx());
    expect(full.creatures.filter((c) => c.kind === 'mushroom')).toHaveLength(0);
  });

  it('place helpers only on free ground', () => {
    const solids = new Set<number>();
    for (let y = 70; y < 90; y++) for (let x = 64; x < 84; x++) if (Math.hypot(x - 74, y - 80) > 0.5) solids.add(idx(x, y));
    const r = placeSummons(withCreatures(mk('mossback', 74.5, 80.5, 1)), mk('mossback', 74.5, 80.5, 1), ['mushroom'], tctx({ solids }));
    expect(r.creatures.filter((c) => c.kind === 'mushroom')).toHaveLength(0);
  });

  it('leave a dungeon alone when it is fixed: nothing appears and nothing far away fades', () => {
    let e: Encounters = { ...emptyEncounters(), creatures: [mk('rabbit', 10.5, 10.5, 1), mk('skeleton', 20, 20, 2, { state: 'idle', timer: 99 })], nextId: 100, spawnTimer: 0.01 };
    for (let i = 0; i < 400; i++) e = tickEncounters(e, tctx({ fixed: true }), 0.05).e;
    expect(e.creatures.map((c) => c.id)).toEqual([1, 2]);
    let wild: Encounters = { ...emptyEncounters(), creatures: [mk('rabbit', 10.5, 10.5, 1)], nextId: 100, spawnTimer: 0.01 };
    wild = tickEncounters(wild, tctx(), 0.05).e;
    expect(wild.creatures.find((c) => c.id === 1)).toBeUndefined();
  });

  it('count a charging boss as hunting the hero', () => {
    const e = withCreatures(mk('mossback', 82, 80.5, 1, { state: 'charge' }), mk('mossback', 120, 80.5, 2, { state: 'charge' }));
    expect(hostilesNear(e, hero, 10)).toBe(1);
  });

  it('leave nothing on the ground when a boss dies, because the level hands the reward over', () => {
    const e = withCreatures(mk('mossback', 81.2, 80.5, 1, { hp: 3 }));
    const r = swing(e, hero, 'right', { damage: 8, reach: 1.3, arc: 110, knockback: 0.35 }, new Rng(1));
    expect(r.events.map((ev) => ev.t)).toEqual(['hit', 'killed']);
    // The reward goes straight into the backpack (see claimReward), not onto the ground where it would fade away.
    expect(r.e.pickups).toEqual([]);
    for (const d of CREATURES.mossback.drops) expect(ITEMS[d.item]).toBeDefined();
  });
});

describe('crystals in a dungeon, which are solid tiles', () => {
  const shootAt = (crystalY: number, heroY: number, dt: number): string[] => {
    const solids = new Set([idx(84, Math.floor(crystalY))]);
    const from = { x: 80.5, y: heroY };
    let e: Encounters = { ...shoot({ ...emptyEncounters(), targets: [{ id: 3, x: 84.5, y: crystalY }], spawnTimer: 99 }, from, 'right', ITEMS.bow.weapon!) };
    const seen: string[] = [];
    for (let i = 0; i < 60; i++) {
      const r = tickEncounters(e, tctx({ fixed: true, solids, hero: from }), dt);
      e = r.e;
      seen.push(...r.events.map((ev) => (ev.t === 'struck' ? `struck:${ev.id}` : ev.t)));
    }
    return seen;
  };

  it('are struck by an arrow that is aimed at them, whatever the frame rate and a small offset', () => {
    for (const dt of [1 / 60, 1 / 30, 0.05]) {
      for (const off of [0, 0.3, -0.3]) expect(shootAt(80.5, 80.5 + off, dt), `dt ${dt} offset ${off}`).toEqual(['struck:3']);
    }
  });

  it('still stop an arrow that flies into the wall beside them', () => {
    expect(shootAt(80.5, 82.5, 0.05)).toEqual([]);
  });
});

describe('targets', () => {
  const crystal = { id: 7, x: 81.4, y: 80.5 };

  it('are struck by a blow in front of the hero, not by one aimed elsewhere, and do not use up creatures', () => {
    const e = { ...emptyEncounters(), targets: [crystal, { id: 8, x: 78, y: 80.5 }] };
    const r = swing(e, hero, 'right', { damage: 5, reach: 1.3, arc: 110, knockback: 0.35 }, new Rng(1));
    expect(r.events).toEqual([{ t: 'struck', id: 7 }]);
    expect(swing(e, hero, 'up', { damage: 5, reach: 1.3, arc: 110, knockback: 0.35 }, new Rng(1)).events).toEqual([]);
  });

  it('count as something a blow would land on, so a sword is swung at them', () => {
    const e = { ...emptyEncounters(), targets: [crystal] };
    expect(creatureInReach(e, hero, 'right', 1.3, 110)).toBe(true);
    expect(creatureInReach(e, hero, 'left', 1.3, 110)).toBe(false);
    expect(creatureInReach(emptyEncounters(), hero, 'right', 1.3, 110)).toBe(false);
  });

  it('are struck by an arrow, which is then used up, and not by one that flies past', () => {
    const bow = ITEMS.bow.weapon!;
    let e: Encounters = { ...shoot({ ...emptyEncounters(), targets: [{ id: 3, x: 84.5, y: 80.5 }], spawnTimer: 99 }, hero, 'right', bow) };
    const events: string[] = [];
    for (let i = 0; i < 20; i++) {
      const r = tickEncounters(e, tctx({ fixed: true }), 0.05);
      e = r.e;
      events.push(...r.events.map((ev) => (ev.t === 'struck' ? `struck:${ev.id}` : ev.t)));
    }
    expect(events).toEqual(['struck:3']);
    expect(e.arrows).toEqual([]);
    let miss: Encounters = { ...shoot({ ...emptyEncounters(), targets: [{ id: 3, x: 84.5, y: 82.5 }], spawnTimer: 99 }, hero, 'right', bow) };
    const seen: string[] = [];
    for (let i = 0; i < 20; i++) {
      const r = tickEncounters(miss, tctx({ fixed: true }), 0.05);
      miss = r.e;
      seen.push(...r.events.map((ev) => ev.t));
    }
    expect(seen).toEqual([]);
  });
});
