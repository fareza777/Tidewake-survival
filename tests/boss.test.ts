import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/rng';
import { BOSSES } from '@/data/bosses';
import { CREATURES } from '@/data/creatures';
import type { BossId } from '@/data/dungeons';
import { CHARGE_SPEED, HIT_REST, SHOT_RANGE, SHOT_SPEED, isBoss, phaseOf, stepBoss, type Shot } from '@/sim/boss';
import { hurtCreature, newCreature, stepCreature, type Creature, type StepContext } from '@/sim/creatures';
import { T, WORLD_SIZE, idx, type World } from '@/sim/world/types';

/** A wall of solid tiles along x = `x`, from y = 10 to y = 30. */
const wallAt = (x: number): Set<number> => new Set(Array.from({ length: 21 }, (_, i) => idx(x, 10 + i)));

/** All grass, with a deep-water column at x = 40. */
function makeWorld(): World {
  const size = WORLD_SIZE;
  const terrain = new Uint8Array(size * size).fill(T.GRASS);
  for (let y = 0; y < size; y++) terrain[idx(40, y)] = T.DEEP;
  return { seed: 0, size, terrain, biome: new Uint8Array(size * size), landmarks: [], resources: [], start: { x: 1, y: 1 } };
}
const world = makeWorld();
const boss = (kind: BossId, x: number, y: number, over: Partial<Creature> = {}): Creature => ({ ...newCreature(1, kind, x, y, new Rng(1)), ...over });
const ctx = (hero: { x: number; y: number }, over: Partial<StepContext> = {}): StepContext =>
  ({ world, solids: new Set(), hero, heroAlive: true, rng: new Rng(3), dt: 0.05, ...over });

interface Log {
  c: Creature;
  strikes: { t: number; damage: number | undefined }[];
  shots: Shot[][];
  summons: string[][];
  states: string[];
}

/** Step a boss for `seconds`; `move` lets the test move the hero as the fight goes on. */
function fight(start: Creature, hero: { x: number; y: number }, seconds: number, move?: (t: number, h: { x: number; y: number }) => void): Log {
  const log: Log = { c: start, strikes: [], shots: [], summons: [], states: [] };
  const h = { ...hero };
  for (let t = 0; t < seconds; t += 0.05) {
    move?.(t, h);
    const r = stepBoss(log.c, CREATURES[log.c.kind], BOSSES[log.c.kind as BossId], ctx(h));
    if (r.creature.state !== log.c.state) log.states.push(r.creature.state);
    if (r.strike) log.strikes.push({ t, damage: r.damage });
    if (r.shots) log.shots.push(r.shots);
    if (r.summons) log.summons.push(r.summons);
    log.c = r.creature;
  }
  return log;
}

describe('boss definitions', () => {
  it('give every boss two phases, with a summon only in the second', () => {
    for (const id of ['mossback', 'ironbones', 'mirelord'] as const) {
      const b = BOSSES[id];
      expect(isBoss(id)).toBe(true);
      expect(CREATURES[id].temper).toBe('boss');
      expect(b.phases[0].moves.some((m) => m.action === 'summon'), id).toBe(false);
      expect(b.phases[1].moves.some((m) => m.action === 'summon'), id).toBe(true);
      expect(b.phases[1].speed, id).toBeGreaterThan(b.phases[0].speed);
      expect(CREATURES[b.summon], id).toBeDefined();
      for (const phase of b.phases) {
        for (const m of phase.moves) {
          expect(m.windup, id).toBeGreaterThan(0.3);
          expect(m.range[0], id).toBeLessThanOrEqual(m.range[1]);
          if (m.action !== 'summon') expect(m.damage, `${id} ${m.action}`).toBeGreaterThan(0);
        }
      }
    }
    expect(isBoss('slime')).toBe(false);
  });

  it('switch to the second phase at half health', () => {
    const def = CREATURES.mossback;
    expect(phaseOf(boss('mossback', 5, 5), def, BOSSES.mossback)).toBe(0);
    expect(phaseOf(boss('mossback', 5, 5, { hp: def.hp / 2 }), def, BOSSES.mossback)).toBe(1);
    expect(phaseOf(boss('mossback', 5, 5, { hp: def.hp / 2 + 1 }), def, BOSSES.mossback)).toBe(0);
  });
});

describe('a sleeping boss', () => {
  it('stays put until the hero comes within its sight, and never wakes for a collapsed hero', () => {
    const far = fight(boss('mossback', 20, 20), { x: 20 + CREATURES.mossback.sight + 3, y: 20 }, 2);
    expect(far.c).toMatchObject({ x: 20, y: 20, state: 'idle', angry: false });
    const down = stepBoss(boss('mossback', 20, 20, { angry: true, state: 'windup', timer: 0.1 }), CREATURES.mossback, BOSSES.mossback, ctx({ x: 21, y: 20 }, { heroAlive: false }));
    expect(down.creature).toMatchObject({ state: 'idle', angry: false });
    expect(down.strike).toBe(false);
  });

  it('wakes for good once the hero was near, even if he backs off', () => {
    const log = fight(boss('mossback', 20, 20), { x: 28, y: 20 }, 1.5, (t, h) => {
      if (t > 0.3) h.x = 20 + CREATURES.mossback.sight + 6;
    });
    expect(log.c.angry).toBe(true);
    expect(log.c.state).not.toBe('idle');
  });
});

describe('walls', () => {
  it('keep a sleeping boss asleep: it does not wake for a hero it cannot see', () => {
    const solids = wallAt(24);
    let c = boss('mossback', 20.5, 20.5);
    for (let t = 0; t < 2; t += 0.05) c = stepBoss(c, CREATURES.mossback, BOSSES.mossback, ctx({ x: 27.5, y: 20.5 }, { solids })).creature;
    expect(c).toMatchObject({ state: 'idle', angry: false });
    const open = stepBoss(boss('mossback', 20.5, 20.5), CREATURES.mossback, BOSSES.mossback, ctx({ x: 27.5, y: 20.5 }));
    expect(open.creature.angry).toBe(true);
  });

  it('stop a slam from landing on a hero on the other side', () => {
    const solids = wallAt(21);
    const windingUp = boss('mossback', 20.5, 20.5, { angry: true, state: 'windup', timer: 0.01, step: 1, headX: 1, headY: 0 });
    const through = stepBoss(windingUp, CREATURES.mossback, BOSSES.mossback, ctx({ x: 22.5, y: 20.5 }, { solids }));
    expect(through.strike).toBe(false);
    const open = stepBoss(windingUp, CREATURES.mossback, BOSSES.mossback, ctx({ x: 22.0, y: 20.5 }));
    expect(open.strike).toBe(true);
  });

  it('stop an ordinary monster from striking through them too', () => {
    const solids = wallAt(21);
    const c = { ...newCreature(1, 'skeleton_warrior', 20.5, 20.5, new Rng(1)), angry: true, state: 'windup' as const, timer: 0.01 };
    const hero = { x: 22.2, y: 20.5 };
    expect(stepCreature(c, ctx(hero, { solids })).strike).toBe(false);
    expect(stepCreature(c, ctx(hero)).strike).toBe(true);
  });
});

describe('a warning', () => {
  it('keeps the move it announced when the boss drops into its second phase meanwhile', () => {
    const def = CREATURES.mossback;
    // Step 2 is a charge in phase one and a summons in phase two.
    let c = boss('mossback', 20, 20, { step: 2, angry: true, hp: def.hp / 2 + 1 });
    c = stepBoss(c, def, BOSSES.mossback, ctx({ x: 25, y: 20 })).creature;
    expect(c.state).toBe('windup');
    c = { ...c, hp: def.hp / 2 - 1 };
    const summons: string[][] = [];
    const states: string[] = [];
    for (let t = 0; t < 2; t += 0.05) {
      const r = stepBoss(c, def, BOSSES.mossback, ctx({ x: 25, y: 20 }));
      if (r.summons) summons.push(r.summons);
      if (r.creature.state !== c.state) states.push(r.creature.state);
      c = r.creature;
    }
    expect(summons).toEqual([]);
    expect(states[0]).toBe('charge');
  });
});

describe('Mossback', () => {
  it('winds up, then charges in a straight line and hurts a hero who stood still', () => {
    const log = fight(boss('mossback', 20, 20), { x: 28, y: 20 }, 3);
    expect(log.states.slice(0, 3)).toEqual(['windup', 'charge', 'recover']);
    expect(log.strikes[0].damage).toBe(BOSSES.mossback.phases[0].moves[0].damage);
    expect(log.c.x).toBeGreaterThan(20);
  });

  it('charges where the hero was when the warning began, so a hero who steps aside is missed, and crashes into the wall behind him', () => {
    const log = fight(boss('mossback', 31, 20), { x: 37, y: 20 }, 2.6, (t, h) => {
      if (t > 0.3) h.y = 25;
    });
    expect(log.strikes).toHaveLength(0);
    expect(log.states.slice(0, 3)).toEqual(['windup', 'charge', 'recover']);
    expect(log.c.x).toBeLessThan(40 - CREATURES.mossback.radius + 0.01);
    expect(log.c.x).toBeGreaterThan(37);
  });

  it('charges faster than the hero can walk, over at most eight tiles', () => {
    expect(CHARGE_SPEED).toBeGreaterThan(3.4);
    const log = fight(boss('mossback', 10, 20), { x: 19, y: 20 }, 2, (t, h) => {
      if (t > 0.3) h.y = 30;
    });
    expect(log.c.x - 10).toBeLessThanOrEqual(CHARGE_SPEED * 1 + 0.5);
    expect(log.c.x).toBeGreaterThan(16);
  });

  it('slams a hero who is next to it, for the slam damage, after a warning', () => {
    const log = fight(boss('mossback', 20, 20, { step: 1 }), { x: 21.2, y: 20 }, 2);
    expect(log.states.slice(0, 2)).toEqual(['windup', 'recover']);
    expect(log.strikes[0].damage).toBe(BOSSES.mossback.phases[0].moves[1].damage);
    const missed = fight(boss('mossback', 20, 20, { step: 1 }), { x: 21.2, y: 20 }, 2, (t, h) => {
      if (t > 0.2) h.x = 25;
    });
    expect(missed.strikes).toHaveLength(0);
  });

  it('calls two mushrooms in its second phase, and never in its first', () => {
    const def = CREATURES.mossback;
    const first = fight(boss('mossback', 20, 20), { x: 24, y: 20 }, 20);
    expect(first.summons).toEqual([]);
    const second = fight(boss('mossback', 20, 20, { hp: def.hp * 0.4, step: 2 }), { x: 24, y: 20 }, 4);
    expect(second.summons[0]).toEqual(['mushroom', 'mushroom']);
  });
});

describe('boss shots', () => {
  it('fans out aimed at the hero for Ironbones', () => {
    const log = fight(boss('ironbones', 20, 20, { step: 1 }), { x: 28, y: 20 }, 2);
    const fan = log.shots[0];
    expect(fan).toHaveLength(3);
    for (const s of fan) {
      expect(Math.hypot(s.dx, s.dy)).toBeCloseTo(1);
      expect(s.speed).toBe(SHOT_SPEED);
      expect(s.left).toBe(SHOT_RANGE);
      expect(s.damage).toBe(BOSSES.ironbones.phases[0].moves[1].damage);
      expect(s.x).toBe(20);
    }
    expect(fan[1].dy).toBeCloseTo(0);
    expect(fan[0].dy).toBeLessThan(0);
    expect(fan[2].dy).toBeGreaterThan(0);
    expect(fan.every((s) => s.dx > 0)).toBe(true);
  });

  it('sends a ring of bolts in every direction in the second phase, and rings are never fired in the first', () => {
    const def = CREATURES.ironbones;
    const first = fight(boss('ironbones', 20, 20), { x: 26, y: 20 }, 15);
    expect(first.shots.every((s) => s.length < 8)).toBe(true);
    const log = fight(boss('ironbones', 20, 20, { hp: def.hp * 0.3, step: 2 }), { x: 26, y: 20 }, 4);
    const ring = log.shots[0];
    expect(ring).toHaveLength(8);
    const angles = ring.map((s) => Math.atan2(s.dy, s.dx));
    expect(Math.max(...angles) - Math.min(...angles)).toBeGreaterThan(Math.PI * 1.5);
  });

  it('keeps Mirelord at a distance: it backs away from a hero who gets close, and closes in on one who is far', () => {
    const near = fight(boss('mirelord', 20, 20), { x: 22, y: 20 }, 1);
    expect(near.c.x).toBeLessThan(20);
    const far = fight(boss('mirelord', 20, 20), { x: 33, y: 20 }, 1.5);
    expect(far.c.x).toBeGreaterThan(20);
  });
});

describe('hurting a boss', () => {
  it('takes hit points but neither staggers nor pushes it, and does not interrupt a wind-up', () => {
    const winding = boss('mossback', 20, 20, { state: 'windup', timer: 0.5 });
    const r = hurtCreature(winding, 10, { x: 1, y: 0 });
    expect(r.dead).toBe(false);
    expect(r.creature).toMatchObject({ hp: CREATURES.mossback.hp - 10, state: 'windup', timer: 0.5, stun: 0, pushX: 0, angry: true });
    expect(hurtCreature(winding, 9999, { x: 0, y: 0 }).dead).toBe(true);
  });

  it('is run by stepCreature, so the island code needs no special case', () => {
    const r = stepCreature(boss('mossback', 20, 20), ctx({ x: 24, y: 20 }));
    expect(r.creature.state).toBe('windup');
    expect(HIT_REST).toBeGreaterThan(0);
  });
});
