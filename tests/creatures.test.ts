import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/rng';
import { CREATURES } from '@/data/creatures';
import { hurtCreature, newCreature, stepCreature, type Creature, type StepContext } from '@/sim/creatures';
import { T, WORLD_SIZE, idx, type World } from '@/sim/world/types';

/** All grass, with a deep-water column at x = 30. */
function makeWorld(): World {
  const size = WORLD_SIZE;
  const terrain = new Uint8Array(size * size).fill(T.GRASS);
  for (let y = 0; y < size; y++) terrain[idx(30, y)] = T.DEEP;
  return { seed: 0, size, terrain, biome: new Uint8Array(size * size), landmarks: [], resources: [], start: { x: 1, y: 1 } };
}

const world = makeWorld();
const none: ReadonlySet<number> = new Set();
const at = (kind: Parameters<typeof newCreature>[1], x: number, y: number, over: Partial<Creature> = {}): Creature =>
  ({ ...newCreature(1, kind, x, y, new Rng(1)), ...over });
const ctx = (hero: { x: number; y: number }, over: Partial<StepContext> = {}): StepContext =>
  ({ world, solids: none, hero, heroAlive: true, rng: new Rng(7), dt: 0.05, ...over });

/** Step repeatedly for `seconds`, collecting how many blows landed. */
function run(start: Creature, hero: { x: number; y: number }, seconds: number, over: Partial<StepContext> = {}) {
  let c = start;
  let strikes = 0;
  const trail: Creature[] = [];
  const rng = new Rng(7);
  for (let t = 0; t < seconds; t += 0.05) {
    const r = stepCreature(c, ctx(hero, { rng, ...over }));
    c = r.creature;
    if (r.strike) strikes++;
    trail.push(c);
  }
  return { c, strikes, trail };
}

describe('newCreature', () => {
  it('starts idle at full health, standing where it was put', () => {
    const c = newCreature(4, 'boar', 20.5, 21.5, new Rng(3));
    expect(c).toMatchObject({ id: 4, kind: 'boar', x: 20.5, y: 21.5, hp: CREATURES.boar.hp, state: 'idle', angry: false, stun: 0 });
    expect(c.timer).toBeGreaterThan(0);
  });
});

describe('strolling', () => {
  it('idles, then wanders a short way, and stays on solid ground', () => {
    const start = at('slime', 20.5, 20.5);
    const { trail } = run(start, { x: 100, y: 100 }, 20);
    expect(trail.some((c) => c.state === 'wander')).toBe(true);
    const far = trail.reduce((m, c) => Math.max(m, Math.hypot(c.x - 20.5, c.y - 20.5)), 0);
    expect(far).toBeGreaterThan(0.2);
    expect(far).toBeLessThan(15);
    expect(trail.every((c) => world.terrain[idx(Math.floor(c.x), Math.floor(c.y))] === T.GRASS)).toBe(true);
  });

  it('never walks into deep water or a solid tile, however long it wanders', () => {
    const solids = new Set([idx(26, 20), idx(26, 21), idx(26, 19)]);
    for (const seed of [1, 2, 3]) {
      let c = at('boar', 28.5, 20.5);
      const rng = new Rng(seed);
      for (let t = 0; t < 60; t += 0.05) {
        c = stepCreature(c, ctx({ x: 100, y: 100 }, { rng, solids })).creature;
        expect(c.x, `seed ${seed}`).toBeLessThan(30);
        expect(solids.has(idx(Math.floor(c.x), Math.floor(c.y)))).toBe(false);
      }
    }
  });
});

describe('a hunter', () => {
  it('notices the hero inside its sight and closes in', () => {
    const { c } = run(at('slime', 20.5, 20.5), { x: 24.5, y: 20.5 }, 1);
    expect(c.state === 'chase' || c.state === 'windup').toBe(true);
    expect(c.x).toBeGreaterThan(21);
    expect(c.facing).toBe('right');
  });

  it('ignores a hero outside its sight', () => {
    const { trail } = run(at('slime', 20.5, 20.5), { x: 30 - 2, y: 20.5 - 9 }, 0.5);
    expect(trail.every((c) => c.state !== 'chase')).toBe(true);
  });

  it('loses track of a hero who gets far enough away', () => {
    let c = at('slime', 20.5, 20.5, { state: 'chase' });
    c = run(c, { x: 20.5, y: 20.5 + CREATURES.slime.sight * 1.7 }, 0.2).c;
    expect(c.state).not.toBe('chase');
  });

  it('winds up, then lands a blow, then pauses before the next one', () => {
    const def = CREATURES.slime;
    const hero = { x: 21.2, y: 20.5 };
    let c = at('slime', 20.5, 20.5);
    const events: string[] = [];
    const rng = new Rng(9);
    for (let t = 0; t < 4; t += 0.05) {
      const r = stepCreature(c, ctx(hero, { rng }));
      if (r.strike) events.push('STRIKE');
      if (r.creature.state !== c.state) events.push(r.creature.state);
      c = r.creature;
    }
    expect(events.slice(0, 3)).toEqual(['windup', 'STRIKE', 'recover']);
    const strikes = events.filter((e) => e === 'STRIKE').length;
    expect(strikes).toBeGreaterThanOrEqual(2);
    expect(strikes).toBeLessThanOrEqual(Math.ceil(4 / (def.windup + def.cooldown)));
  });

  it('does not hit a hero who steps out of reach during the warning', () => {
    let c = at('slime', 20.5, 20.5, { state: 'windup', timer: 0.2 });
    c = { ...c, facing: 'right' };
    const r = run(c, { x: 24, y: 20.5 }, 0.3);
    expect(r.strikes).toBe(0);
    expect(r.c.state).toBe('recover');
  });

  it('stops hunting a hero who has collapsed, and never strikes him', () => {
    const r = run(at('skeleton', 20.5, 20.5, { state: 'windup', timer: 0.05 }), { x: 21, y: 20.5 }, 1, { heroAlive: false });
    expect(r.strikes).toBe(0);
    expect(r.trail.at(-1)!.state === 'idle' || r.trail.at(-1)!.state === 'wander').toBe(true);
  });

  it('slides around an obstacle instead of freezing', () => {
    const solids = new Set([idx(22, 20)]);
    const { c } = run(at('slime', 21.4, 20.5), { x: 25.5, y: 20.5 }, 6, { solids });
    expect(c.x).toBeGreaterThan(22.9);
  });
});

describe('animals', () => {
  it('a rabbit runs away from a hero who comes close, and settles once he is far', () => {
    const start = at('rabbit', 20.5, 20.5);
    const { trail } = run(start, { x: 18.5, y: 20.5 }, 2);
    const last = trail.at(-1)!;
    expect(last.x).toBeGreaterThan(22);
    expect(trail.some((c) => c.state === 'flee')).toBe(true);
    const calm = run({ ...last, state: 'flee' }, { x: 5, y: 20.5 }, 3).c;
    expect(calm.state === 'idle' || calm.state === 'wander').toBe(true);
  });

  it('a rabbit pinned against deep water slides along it instead of standing still', () => {
    const { c } = run(at('rabbit', 29.3, 20.5), { x: 27.5, y: 20.5 }, 1.2);
    expect(c.x).toBeLessThan(30);
    expect(Math.abs(c.y - 20.5)).toBeGreaterThan(0.5);
  });

  it('a boar ignores the hero until it is hurt, then goes for him', () => {
    const calm = run(at('boar', 20.5, 20.5), { x: 23, y: 20.5 }, 1);
    expect(calm.trail.every((c) => c.state !== 'chase' && c.state !== 'windup')).toBe(true);
    expect(calm.strikes).toBe(0);
    const hurt = hurtCreature(at('boar', 20.5, 20.5), 2, { x: 0, y: 0 }).creature;
    const angry = run({ ...hurt, stun: 0 }, { x: 23, y: 20.5 }, 3);
    expect(angry.trail.some((c) => c.state === 'chase')).toBe(true);
    expect(angry.strikes).toBeGreaterThan(0);
  });

  it('an angry boar calms down when the hero gets far away', () => {
    const angry = at('boar', 20.5, 20.5, { angry: true, state: 'chase' });
    const { c } = run(angry, { x: 20.5, y: 20.5 + CREATURES.boar.sight * 2.5 }, 0.2);
    expect(c.angry).toBe(false);
  });
});

describe('hurtCreature', () => {
  it('takes hit points, reports death at zero, and never goes below zero', () => {
    const c = at('slime', 20.5, 20.5);
    expect(hurtCreature(c, 3, { x: 0, y: 0 })).toMatchObject({ dead: false, creature: { hp: CREATURES.slime.hp - 3 } });
    expect(hurtCreature(c, 99, { x: 0, y: 0 })).toMatchObject({ dead: true, creature: { hp: 0 } });
  });

  it('staggers it, makes it angry, interrupts a wind-up and starts the hunt', () => {
    const winding = at('slime', 20.5, 20.5, { state: 'windup', timer: 0.2 });
    const hit = hurtCreature(winding, 1, { x: 0.3, y: 0 }).creature;
    expect(hit.stun).toBeGreaterThan(0);
    expect(hit.angry).toBe(true);
    expect(hit.state).toBe('recover');
    const idle = hurtCreature(at('slime', 20.5, 20.5), 1, { x: 0, y: 0 }).creature;
    expect(idle.state).toBe('chase');
  });

  it('turns on the hero at once, with no leftover idling or detour, when hit from beyond its sight', () => {
    const idle = at('slime', 20.5, 20.5, { state: 'idle', timer: 3 });
    const hero = { x: 27, y: 20.5 };
    const hit = hurtCreature(idle, 1, { x: 0, y: 0 }).creature;
    expect(hit).toMatchObject({ state: 'chase', timer: 0, headX: 0, headY: 0 });
    const r = run({ ...hit, stun: 0 }, hero, 0.5);
    expect(r.c.x).toBeGreaterThan(20.8);
    const walking = at('boar', 20.5, 20.5, { state: 'wander', timer: 2, headX: -1, headY: 0 });
    const away = run({ ...hurtCreature(walking, 1, { x: 0, y: 0 }).creature, stun: 0 }, { x: 26, y: 20.5 }, 0.5);
    expect(away.c.x).toBeGreaterThan(20.5);
  });

  it('pushes it back, stopped by walls, and does nothing else while staggered', () => {
    const hit = hurtCreature(at('slime', 28.5, 20.5), 1, { x: 1.5, y: 0 }).creature;
    const r = run(hit, { x: 100, y: 100 }, 0.2);
    expect(r.c.x).toBeGreaterThan(28.5);
    expect(r.c.x).toBeLessThan(30);
    const back = hurtCreature(at('slime', 20.5, 20.5), 1, { x: -1, y: 0 }).creature;
    const b = run(back, { x: 25, y: 20.5 }, 0.15);
    expect(b.c.x).toBeLessThan(20);
    expect(b.strikes).toBe(0);
  });
});

describe('determinism', () => {
  it('replays the same way from the same random stream', () => {
    const a = run(at('wasp', 20.5, 20.5), { x: 60, y: 60 }, 8).c;
    const b = run(at('wasp', 20.5, 20.5), { x: 60, y: 60 }, 8).c;
    expect(a).toEqual(b);
  });
});
