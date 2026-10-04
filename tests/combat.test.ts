import { describe, expect, it } from 'vitest';
import { DIFFICULTY_DAMAGE, HERO_IFRAMES, enemyDamage, facingFromVector, inSwing, knockbackVec } from '@/sim/combat';

const hero = { x: 10.5, y: 10.5 };

describe('enemyDamage', () => {
  it('scales with the difficulty and rounds to whole hit points', () => {
    expect(enemyDamage(10, 'normal')).toBe(10);
    expect(enemyDamage(10, 'relaxed')).toBe(6);
    expect(enemyDamage(10, 'hardcore')).toBe(14);
    expect(DIFFICULTY_DAMAGE.relaxed).toBeLessThan(DIFFICULTY_DAMAGE.normal);
    expect(DIFFICULTY_DAMAGE.normal).toBeLessThan(DIFFICULTY_DAMAGE.hardcore);
  });

  it('lets armour take points off but always leaves at least one', () => {
    expect(enemyDamage(10, 'normal', 4)).toBe(6);
    expect(enemyDamage(10, 'normal', 50)).toBe(1);
    expect(enemyDamage(1, 'relaxed', 0)).toBe(1);
  });
});

describe('inSwing', () => {
  const sword = (facing: 'down' | 'left' | 'right' | 'up', target: { x: number; y: number }, radius = 0.3) =>
    inSwing(hero, facing, 1.3, 110, target, radius);

  it('hits what is in front of the hero in all four directions', () => {
    expect(sword('right', { x: 11.5, y: 10.5 })).toBe(true);
    expect(sword('left', { x: 9.5, y: 10.5 })).toBe(true);
    expect(sword('down', { x: 10.5, y: 11.5 })).toBe(true);
    expect(sword('up', { x: 10.5, y: 9.5 })).toBe(true);
  });

  it('misses what is behind the hero or to the side outside the arc', () => {
    expect(sword('right', { x: 9.5, y: 10.5 })).toBe(false);
    expect(sword('right', { x: 10.5, y: 11.5 })).toBe(false);
    expect(sword('up', { x: 10.5, y: 11.5 })).toBe(false);
  });

  it('misses what is too far away but counts the size of the target', () => {
    expect(sword('right', { x: 12.2, y: 10.5 })).toBe(false);
    expect(sword('right', { x: 12.2, y: 10.5 }, 0.5)).toBe(true);
    expect(sword('right', { x: 13, y: 10.5 }, 0.5)).toBe(false);
  });

  it('always hits something touching the hero, whichever way the hero faces', () => {
    expect(sword('left', { x: 10.6, y: 10.5 })).toBe(true);
  });

  it('gives a narrow spear a narrow cone but a long reach', () => {
    const spear = (target: { x: number; y: number }) => inSwing(hero, 'right', 1.9, 30, target, 0.3);
    expect(spear({ x: 12.3, y: 10.5 })).toBe(true);
    expect(spear({ x: 12.3, y: 11.4 })).toBe(false);
    expect(sword('right', { x: 12.3, y: 10.5 })).toBe(false);
  });

  it('counts a target whose edge is inside the arc', () => {
    expect(inSwing(hero, 'right', 1.5, 20, { x: 11.5, y: 11.1 }, 0.45)).toBe(true);
    expect(inSwing(hero, 'right', 1.5, 20, { x: 11.5, y: 11.1 }, 0.05)).toBe(false);
  });
});

describe('knockbackVec', () => {
  it('pushes away from the source by the given distance', () => {
    const v = knockbackVec({ x: 0, y: 0 }, { x: 3, y: 4 }, 1);
    expect(v.x).toBeCloseTo(0.6);
    expect(v.y).toBeCloseTo(0.8);
  });

  it('still pushes somewhere when both are on the same spot', () => {
    const v = knockbackVec({ x: 2, y: 2 }, { x: 2, y: 2 }, 0.5);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(0.5);
  });
});

describe('facingFromVector', () => {
  it('picks the dominant axis and keeps the old facing when standing still', () => {
    expect(facingFromVector(1, 0.2, 'down')).toBe('right');
    expect(facingFromVector(-1, 0.2, 'down')).toBe('left');
    expect(facingFromVector(0.1, -1, 'down')).toBe('up');
    expect(facingFromVector(0.1, 1, 'up')).toBe('down');
    expect(facingFromVector(0, 0, 'left')).toBe('left');
  });
});

describe('hero constants', () => {
  it('gives the hero a short moment of safety after a hit', () => {
    expect(HERO_IFRAMES).toBeGreaterThan(0.3);
    expect(HERO_IFRAMES).toBeLessThan(1.5);
  });
});
