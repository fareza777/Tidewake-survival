import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/rng';
import { addItem, countItem, emptyInventory } from '@/sim/inventory';
import {
  MAGNET_RADIUS, PICKUP_LIFETIME, PICKUP_RADIUS, ageOut, collect, drift, rollLoot, scatter, type Pickup,
} from '@/sim/pickups';

const hero = { x: 10.5, y: 10.5 };
const pickup = (over: Partial<Pickup> = {}): Pickup => ({ id: 1, item: 'raw_meat', qty: 2, x: 10.5, y: 10.8, age: 0, ...over });

describe('rollLoot', () => {
  it('gives a boar its meat every time and its bone only now and then', () => {
    let bones = 0;
    for (let i = 0; i < 400; i++) {
      const loot = rollLoot('boar', new Rng(i));
      const meat = loot.find((l) => l.item === 'raw_meat')!;
      expect(meat.qty).toBeGreaterThanOrEqual(2);
      expect(meat.qty).toBeLessThanOrEqual(3);
      if (loot.some((l) => l.item === 'bone')) bones++;
    }
    expect(bones).toBeGreaterThan(110);
    expect(bones).toBeLessThan(210);
  });

  it('never returns an empty stack', () => {
    for (let i = 0; i < 200; i++) for (const l of rollLoot('ghost', new Rng(i))) expect(l.qty).toBeGreaterThan(0);
  });

  it('is repeatable for the same random stream', () => {
    expect(rollLoot('skeleton_warrior', new Rng(3))).toEqual(rollLoot('skeleton_warrior', new Rng(3)));
  });
});

describe('scatter', () => {
  it('drops each stack near the spot, with its own id, spread apart', () => {
    const out = scatter([{ item: 'bone', qty: 2 }, { item: 'gel', qty: 1 }, { item: 'raw_meat', qty: 3 }], { x: 5, y: 5 }, 40, new Rng(2));
    expect(out.map((p) => p.id)).toEqual([40, 41, 42]);
    for (const p of out) {
      expect(Math.hypot(p.x - 5, p.y - 5)).toBeLessThanOrEqual(0.7);
      expect(p.age).toBe(0);
    }
    expect(new Set(out.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)).size).toBe(3);
  });
});

describe('collect', () => {
  it('puts what is within reach into the backpack and leaves the rest', () => {
    const near = pickup();
    const far = pickup({ id: 2, item: 'bone', x: 10.5 + PICKUP_RADIUS + 1, y: 10.5 });
    const r = collect(emptyInventory(), [near, far], hero);
    expect(countItem(r.inv, 'raw_meat')).toBe(2);
    expect(r.taken).toEqual([{ item: 'raw_meat', qty: 2 }]);
    expect(r.pickups).toEqual([far]);
    expect(r.full).toBe(false);
  });

  it('keeps what does not fit lying on the ground and says the backpack is full', () => {
    let inv = emptyInventory(1);
    inv = addItem(inv, 'raw_meat', 19).inv;
    const r = collect(inv, [pickup({ qty: 5 })], hero);
    expect(countItem(r.inv, 'raw_meat')).toBe(20);
    expect(r.pickups).toEqual([pickup({ qty: 4 })]);
    expect(r.taken).toEqual([{ item: 'raw_meat', qty: 1 }]);
    expect(r.full).toBe(true);
  });

  it('never loses anything when the backpack is completely full', () => {
    let inv = emptyInventory(1);
    inv = addItem(inv, 'wood', 99).inv;
    const r = collect(inv, [pickup()], hero);
    expect(r.inv).toEqual(inv);
    expect(r.pickups).toEqual([pickup()]);
    expect(r.taken).toEqual([]);
    expect(r.full).toBe(true);
  });
});

describe('ageOut', () => {
  it('ages items and removes them after two minutes', () => {
    const [a] = ageOut([pickup()], 10);
    expect(a.age).toBe(10);
    expect(ageOut([pickup({ age: PICKUP_LIFETIME - 1 })], 0.5)).toHaveLength(1);
    expect(ageOut([pickup({ age: PICKUP_LIFETIME - 1 })], 1.5)).toEqual([]);
  });
});

describe('drift', () => {
  it('pulls items that are close toward the hero, and leaves distant ones alone', () => {
    const close = pickup({ x: 10.5 + MAGNET_RADIUS - 0.2, y: 10.5 });
    const far = pickup({ id: 2, x: 10.5 + MAGNET_RADIUS + 3, y: 10.5 });
    const [c, f] = drift([close, far], hero, 0.1);
    expect(c.x).toBeLessThan(close.x);
    expect(c.y).toBeCloseTo(10.5);
    expect(f).toEqual(far);
  });

  it('never overshoots the hero', () => {
    const [p] = drift([pickup({ x: 10.6, y: 10.5 })], hero, 5);
    expect(p.x).toBeCloseTo(10.5);
  });
});
