import { describe, expect, it } from 'vitest';
import { STAMINA_TOOL } from '@/data/tools';
import { fullVitals, tickVitals, VITAL_MAX } from '@/sim/vitals';
import { strainOf } from '@/sim/weather';
import { B } from '@/sim/world/types';
import { levelOf, xpToReach } from '@/sim/skills';

const idle = { difficulty: 'normal' as const, biome: B.FOREST, busy: false };

describe('stamina', () => {
  it('runs out after a few trees of chopping and does not come back while he keeps working', () => {
    let v = fullVitals();
    let hits = 0;
    while (v.stamina >= STAMINA_TOOL && hits < 200) {
      v = tickVitals({ ...v, stamina: v.stamina - STAMINA_TOOL }, 0.45, { ...idle, busy: true });
      hits++;
    }
    expect(hits).toBeGreaterThan(10);
    expect(hits).toBeLessThan(40);
  });

  it('comes back slowly when hungry or thirsty, and faster when he rests', () => {
    const tired = { ...fullVitals(), stamina: 10 };
    const rested = tickVitals(tired, 5, idle).stamina;
    const hungry = tickVitals({ ...tired, hunger: 10 }, 5, idle).stamina;
    expect(hungry).toBeLessThan(rested);
    expect(tickVitals(tired, 5, { ...idle, busy: true }).stamina).toBeLessThan(rested);
  });
});

describe('weather on the body', () => {
  it('makes a hot day thirstier and tiring, rain slow, and snow slower still', () => {
    const calm = strainOf('spring', 'clear', B.FOREST);
    expect(calm).toEqual({ thirst: 1, regen: 1, speed: 1 });
    const heat = strainOf('summer', 'clear', B.FOREST);
    expect(heat.thirst).toBeGreaterThan(1);
    expect(heat.regen).toBeLessThan(1);
    const rain = strainOf('spring', 'rain', B.FOREST);
    expect(rain.speed).toBeLessThan(1);
    expect(strainOf('winter', 'snow', B.FOREST).speed).toBeLessThan(rain.speed);
    expect(strainOf('winter', 'storm', B.FOREST).speed).toBeLessThan(strainOf('spring', 'storm', B.FOREST).speed);
    expect(strainOf('spring', 'clear', B.VOLCANO).thirst).toBeGreaterThan(1);
  });

  it('is felt in the meters: heat dries him, rain slows his breath', () => {
    const v = { ...fullVitals(), stamina: 10 };
    const hot = tickVitals(v, 10, { ...idle, thirstMul: 1.35, regenMul: 0.8 });
    const mild = tickVitals(v, 10, idle);
    expect(hot.thirst).toBeLessThan(mild.thirst);
    expect(hot.stamina).toBeLessThan(mild.stamina);
    expect(VITAL_MAX).toBe(100);
  });
});

describe('skill levels', () => {
  it('take real work: the second level needs a good many blows, the last many hundreds of trees', () => {
    expect(xpToReach(2)).toBeGreaterThanOrEqual(70);
    expect(xpToReach(10)).toBeGreaterThanOrEqual(15000);
    expect(levelOf(xpToReach(10))).toBe(10);
  });
});
