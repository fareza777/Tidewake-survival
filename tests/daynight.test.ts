import { describe, expect, it } from 'vitest';
import { DAY_SECONDS, NIGHT_DARKNESS, advance, clockLabel, darkness, lighting, newClock, phaseOf, type Clock } from '@/sim/daynight';

const at = (f: number, day = 1): Clock => ({ day, t: f * DAY_SECONDS });

describe('daynight', () => {
  it('starts on day 1 in the morning', () => {
    const c = newClock();
    expect(c.day).toBe(1);
    expect(phaseOf(c)).toBe('day');
    expect(darkness(c)).toBe(0);
  });

  it('advances time without mutating the input', () => {
    const c = newClock();
    const next = advance(c, 30);
    expect(next.t).toBeCloseTo(c.t + 30);
    expect(c).toEqual(newClock());
  });

  it('rolls over to the next day, even across several days at once', () => {
    expect(advance(at(0.95), DAY_SECONDS * 0.1)).toEqual({ day: 2, t: expect.closeTo(DAY_SECONDS * 0.05, 5) });
    expect(advance({ day: 1, t: 0 }, DAY_SECONDS * 3 + 5)).toEqual({ day: 4, t: 5 });
  });

  it('ignores negative time steps', () => {
    expect(advance(at(0.3), -50)).toEqual(at(0.3));
  });

  it('reports the four phases at the right times', () => {
    expect(phaseOf(at(0.05))).toBe('dawn');
    expect(phaseOf(at(0.3))).toBe('day');
    expect(phaseOf(at(0.65))).toBe('dusk');
    expect(phaseOf(at(0.9))).toBe('night');
  });

  it('is dark at night, bright at noon and ramps smoothly in between', () => {
    expect(darkness(at(0.3))).toBe(0);
    expect(darkness(at(0.9))).toBe(NIGHT_DARKNESS);
    let prev = darkness(at(0.6));
    for (let f = 0.61; f <= 0.7; f += 0.01) {
      const d = darkness(at(f));
      expect(d).toBeGreaterThanOrEqual(prev);
      prev = d;
    }
    expect(darkness(at(0))).toBeCloseTo(NIGHT_DARKNESS);
    expect(darkness(at(0.1))).toBeCloseTo(0);
  });

  it('gives a transparent overlay by day and a strong one at night', () => {
    expect(lighting(at(0.3)).alpha).toBe(0);
    expect(lighting(at(0.9)).alpha).toBeGreaterThan(0.6);
    expect(lighting(at(0.9)).color).toBe(0x0a1030);
  });

  it('formats the time of day, with 06:00 at dawn', () => {
    expect(clockLabel(at(0))).toBe('06:00');
    expect(clockLabel(at(0.25))).toBe('12:00');
    expect(clockLabel(at(0.5))).toBe('18:00');
    expect(clockLabel(at(0.9999))).toBe('05:59');
  });
});
