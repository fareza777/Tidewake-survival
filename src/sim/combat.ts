import type { WeaponStats } from '@/data/items';
import type { Facing } from '@/sim/actions';
import type { Vec } from '@/sim/movement';
import type { Difficulty } from '@/sim/vitals';

/** The part of a weapon that decides what a swing hits and how hard. */
export type SwingStats = Pick<WeaponStats, 'damage' | 'reach' | 'arc' | 'knockback'>;

/** Armour points the hero wears: every blow is cut by this much. Armour items raise it later. */
export const HERO_DEFENSE = 0;

/** Seconds after a hit during which the hero cannot be hurt again. */
export const HERO_IFRAMES = 0.7;

/** What the difficulty does to the damage monsters deal. */
export const DIFFICULTY_DAMAGE: Record<Difficulty, number> = { relaxed: 0.6, normal: 1, hardcore: 1.4 };

/** Hit points a strike of `base` takes from the hero; `defense` is armour, and a hit always hurts at least one point. */
export function enemyDamage(base: number, difficulty: Difficulty, defense = 0): number {
  return Math.max(1, Math.round(base * DIFFICULTY_DAMAGE[difficulty]) - defense);
}

const FACING: Record<Facing, readonly [number, number]> = { down: [0, 1], left: [-1, 0], right: [1, 0], up: [0, -1] };
const DEG = 180 / Math.PI;

/**
 * Does a swing from `origin` (facing `facing`, `reach` tiles long, `arc` degrees wide) hit a round target?
 * A target touching the hero is always hit, and a big target counts when any edge of it is inside the arc.
 */
export function inSwing(origin: Vec, facing: Facing, reach: number, arc: number, target: Vec, targetRadius: number): boolean {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const d = Math.hypot(dx, dy);
  if (d > reach + targetRadius) return false;
  if (d <= targetRadius) return true;
  const [fx, fy] = FACING[facing];
  const cos = Math.min(1, Math.max(-1, (dx * fx + dy * fy) / d));
  const slack = Math.asin(Math.min(1, targetRadius / d)) * DEG;
  return Math.acos(cos) * DEG <= arc / 2 + slack;
}

/** How far to push `to` away from `from`: a vector of length `tiles`. */
export function knockbackVec(from: Vec, to: Vec, tiles: number): Vec {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) return { x: tiles, y: 0 };
  return { x: (dx / d) * tiles, y: (dy / d) * tiles };
}

/** The way a movement vector points: the stronger axis wins; standing still keeps the old facing. */
export function facingFromVector(x: number, y: number, previous: Facing): Facing {
  if (Math.abs(x) < 0.01 && Math.abs(y) < 0.01) return previous;
  if (Math.abs(x) > Math.abs(y) * 1.05) return x < 0 ? 'left' : 'right';
  return y < 0 ? 'up' : 'down';
}
