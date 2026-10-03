import type { Rng } from '@/core/rng';
import { CREATURES, type CreatureId } from '@/data/creatures';
import type { ItemId } from '@/data/items';
import { addItem, type Inventory } from '@/sim/inventory';
import type { Vec } from '@/sim/movement';

/** An item lying on the ground. Not saved: it fades after PICKUP_LIFETIME seconds. */
export interface Pickup {
  readonly id: number;
  readonly item: ItemId;
  readonly qty: number;
  readonly x: number;
  readonly y: number;
  readonly age: number;
}

export interface Stack {
  item: ItemId;
  qty: number;
}

/** Seconds an item stays on the ground, how close the hero must be to take it, and where it starts to drift toward him. */
export const PICKUP_LIFETIME = 120;
export const PICKUP_RADIUS = 0.9;
export const MAGNET_RADIUS = 2.2;
const MAGNET_SPEED = 5;
const SPREAD = 0.6;

/** What a creature leaves behind, rolled from its drop table. */
export function rollLoot(kind: CreatureId, rng: Rng): Stack[] {
  return CREATURES[kind].drops
    .filter((d) => d.chance === undefined || rng.chance(d.chance))
    .map((d) => ({ item: d.item, qty: rng.int(d.min, d.max) }))
    .filter((s) => s.qty > 0);
}

/** Lay stacks on the ground around a spot, numbering them from `nextId`. */
export function scatter(stacks: readonly Stack[], at: Vec, nextId: number, rng: Rng): Pickup[] {
  return stacks.map((s, i) => {
    const angle = rng.float(0, Math.PI * 2) + i * 2.1;
    const r = rng.float(0.25, SPREAD);
    return { id: nextId + i, item: s.item, qty: s.qty, x: at.x + Math.cos(angle) * r, y: at.y + Math.sin(angle) * r, age: 0 };
  });
}

export interface Collected {
  inv: Inventory;
  pickups: Pickup[];
  taken: Stack[];
  /** Something within reach did not fit. */
  full: boolean;
}

/** The hero takes what lies within reach. What does not fit stays on the ground; nothing is ever thrown away. */
export function collect(inv: Inventory, pickups: readonly Pickup[], hero: Vec): Collected {
  let cur = inv;
  let full = false;
  const taken: Stack[] = [];
  const left: Pickup[] = [];
  for (const p of pickups) {
    if (Math.hypot(p.x - hero.x, p.y - hero.y) > PICKUP_RADIUS) {
      left.push(p);
      continue;
    }
    const r = addItem(cur, p.item, p.qty);
    cur = r.inv;
    if (p.qty - r.left > 0) taken.push({ item: p.item, qty: p.qty - r.left });
    if (r.left > 0) {
      full = true;
      left.push({ ...p, qty: r.left });
    }
  }
  return { inv: cur, pickups: left, taken, full };
}

export function ageOut(pickups: readonly Pickup[], dt: number): Pickup[] {
  return pickups.map((p) => ({ ...p, age: p.age + dt })).filter((p) => p.age < PICKUP_LIFETIME);
}

/** Items close to the hero slide toward him so nothing has to be picked up pixel by pixel. */
export function drift(pickups: readonly Pickup[], hero: Vec, dt: number): Pickup[] {
  return pickups.map((p) => {
    const d = Math.hypot(hero.x - p.x, hero.y - p.y);
    if (d > MAGNET_RADIUS || d < 1e-6) return p;
    const step = Math.min(d, MAGNET_SPEED * dt);
    return { ...p, x: p.x + ((hero.x - p.x) / d) * step, y: p.y + ((hero.y - p.y) / d) * step };
  });
}
