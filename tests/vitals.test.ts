import { describe, expect, it } from 'vitest';
import {
  DESERT_THIRST, HUNGER_RATE, RUN_DRAIN, RUN_SPEED, RUN_START, STARVE_DAMAGE, THIRST_RATE, VITAL_MAX, eat, fullVitals, isDead, sleepRecovery, spendStamina,
  takeDamage, tickVitals, wouldWaste, type VitalsContext, type Vitals,
} from '@/sim/vitals';
import { B } from '@/sim/world/types';

const ctx = (over: Partial<VitalsContext> = {}): VitalsContext => ({ difficulty: 'normal', biome: B.FOREST, busy: false, ...over });
const v = (over: Partial<Vitals> = {}): Vitals => ({ ...fullVitals(), ...over });

describe('tickVitals', () => {
  it('drains hunger and thirst at the base rates and never mutates the input', () => {
    const start = fullVitals();
    const next = tickVitals(start, 10, ctx());
    expect(next.hunger).toBeCloseTo(VITAL_MAX - HUNGER_RATE * 10);
    expect(next.thirst).toBeCloseTo(VITAL_MAX - THIRST_RATE * 10);
    expect(start).toEqual(fullVitals());
  });

  it('empties hunger in about two days and thirst in a little over one', () => {
    expect(tickVitals(v(), 1200, ctx()).hunger).toBeCloseTo(0);
    expect(tickVitals(v(), 800, ctx()).thirst).toBeCloseTo(0);
  });

  it('makes the desert thirstier and scales drain with difficulty', () => {
    const desert = tickVitals(v(), 10, ctx({ biome: B.DESERT }));
    expect(VITAL_MAX - desert.thirst).toBeCloseTo(THIRST_RATE * 10 * DESERT_THIRST);
    const easy = tickVitals(v(), 10, ctx({ difficulty: 'relaxed' }));
    const hard = tickVitals(v(), 10, ctx({ difficulty: 'hardcore' }));
    expect(VITAL_MAX - easy.hunger).toBeLessThan(VITAL_MAX - hard.hunger);
  });

  it('hurts when a meter is empty and twice as much when both are', () => {
    const one = tickVitals(v({ hunger: 0 }), 10, ctx());
    const both = tickVitals(v({ hunger: 0, thirst: 0 }), 10, ctx());
    expect(VITAL_MAX - one.hp).toBeCloseTo(STARVE_DAMAGE * 10);
    expect(VITAL_MAX - both.hp).toBeCloseTo(STARVE_DAMAGE * 20);
  });

  it('heals only while fed and watered, and never above the maximum', () => {
    const healing = tickVitals(v({ hp: 50 }), 10, ctx());
    expect(healing.hp).toBeGreaterThan(50);
    expect(tickVitals(v({ hp: 50, hunger: 20 }), 10, ctx()).hp).toBe(50);
    expect(tickVitals(v({ hp: 99.9 }), 100, ctx()).hp).toBe(VITAL_MAX);
  });

  it('does not heal a hero who is already at zero hit points, so a fatal blow cannot be undone by the next tick', () => {
    const down = tickVitals(v({ hp: 0 }), 1, ctx());
    expect(down.hp).toBe(0);
    expect(isDead(down)).toBe(true);
    expect(isDead(tickVitals(v({ hp: 0.001 }), 1, ctx()))).toBe(false);
  });

  it('recovers stamina quickly at rest and slowly when busy', () => {
    const rest = tickVitals(v({ stamina: 0 }), 1, ctx());
    const busy = tickVitals(v({ stamina: 0 }), 1, ctx({ busy: true }));
    expect(rest.stamina).toBeGreaterThan(busy.stamina);
    expect(tickVitals(v(), 50, ctx()).stamina).toBe(VITAL_MAX);
  });

  it('ignores zero or negative time', () => {
    const start = v({ hunger: 50 });
    expect(tickVitals(start, 0, ctx())).toBe(start);
    expect(tickVitals(start, -3, ctx())).toBe(start);
  });

  it('keeps every meter inside 0..100 even for a huge time step', () => {
    const out = tickVitals(v(), 1e7, ctx());
    for (const k of ['hp', 'hunger', 'thirst', 'stamina'] as const) {
      expect(out[k]).toBeGreaterThanOrEqual(0);
      expect(out[k]).toBeLessThanOrEqual(VITAL_MAX);
    }
    expect(isDead(out)).toBe(true);
  });
});

describe('takeDamage', () => {
  it('lowers hit points without going below zero and leaves the other meters alone', () => {
    const hurt = takeDamage(fullVitals(), 30);
    expect(hurt).toEqual({ ...fullVitals(), hp: 70 });
    expect(takeDamage(hurt, 500).hp).toBe(0);
    expect(takeDamage(hurt, 0)).toBe(hurt);
    expect(takeDamage(hurt, -5)).toBe(hurt);
  });
});

describe('eating, stamina and sleep', () => {
  it('adds food values with a cap at the maximum', () => {
    expect(eat(v({ hunger: 50 }), { hunger: 20, thirst: 0, hp: 0 }).hunger).toBe(70);
    expect(eat(v({ hunger: 95, hp: 99 }), { hunger: 20, thirst: 0, hp: 5 })).toMatchObject({ hunger: 100, hp: 100 });
  });

  it('knows when food would be wasted', () => {
    expect(wouldWaste(fullVitals(), { hunger: 10, thirst: 0, hp: 0 })).toBe(true);
    expect(wouldWaste(v({ hunger: 90 }), { hunger: 10, thirst: 0, hp: 0 })).toBe(false);
    expect(wouldWaste(v({ thirst: 10 }), { hunger: 10, thirst: 20, hp: 0 })).toBe(false);
  });

  it('charges stamina or refuses when too tired', () => {
    expect(spendStamina(v({ stamina: 10 }), 3)?.stamina).toBe(7);
    expect(spendStamina(v({ stamina: 2 }), 3)).toBeNull();
  });

  it('sleeping heals and rests but costs food and water', () => {
    const out = sleepRecovery(v({ hp: 30, hunger: 60, thirst: 60, stamina: 5 }));
    expect(out).toEqual({ hp: 70, hunger: 45, thirst: 45, stamina: VITAL_MAX });
    expect(sleepRecovery(v({ hunger: 5, thirst: 5 }))).toMatchObject({ hunger: 0, thirst: 0 });
  });
});

describe('running', () => {
  it('drains stamina and recovers none while it lasts, and a hero who stops recovers again', () => {
    const running = tickVitals(v({ stamina: 50 }), 2, ctx({ running: true }));
    expect(running.stamina).toBeCloseTo(50 - RUN_DRAIN * 2);
    expect(tickVitals(v({ stamina: 50 }), 2, ctx()).stamina).toBeGreaterThan(50);
  });

  it('never takes stamina below zero', () => {
    expect(tickVitals(v({ stamina: 3 }), 5, ctx({ running: true })).stamina).toBe(0);
  });

  it('is clearly faster than walking but needs a little breath to start', () => {
    expect(RUN_SPEED).toBeGreaterThan(1.3);
    expect(RUN_START).toBeGreaterThan(0);
    expect(RUN_START).toBeLessThan(VITAL_MAX / 2);
  });
});
