import { T, idx, inBounds, type World } from '@/sim/world/types';

/** Positions are in tile units: tile (n, m) covers [n, n+1) x [m, m+1). */
export interface Vec {
  x: number;
  y: number;
}

/** Half the player's collision box, in tiles. */
export const PLAYER_HALF = 0.28;
/** Walking speed multiplier while wading through shallow water or a river. */
export const WADE_SPEED = 0.6;

export function tileBlocked(world: World, solids: ReadonlySet<number>, tx: number, ty: number): boolean {
  if (!inBounds(tx, ty, world.size)) return true;
  const i = idx(tx, ty, world.size);
  return world.terrain[i] === T.DEEP || solids.has(i);
}

function boxBlocked(world: World, solids: ReadonlySet<number>, x: number, y: number, half: number): boolean {
  const x0 = Math.floor(x - half);
  const x1 = Math.floor(x + half);
  const y0 = Math.floor(y - half);
  const y1 = Math.floor(y + half);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (tileBlocked(world, solids, tx, ty)) return true;
    }
  }
  return false;
}

/**
 * Move by (dx, dy), one axis at a time, so the body slides along walls instead of sticking to them.
 * `half` is half the width of the body in tiles (the hero by default; creatures pass their own).
 */
export function moveWithCollision(
  world: World, solids: ReadonlySet<number>, pos: Vec, dx: number, dy: number, half = PLAYER_HALF,
): Vec {
  let { x, y } = pos;
  // Already inside something solid (it should not happen, but a stuck player must always be able to walk out).
  if (boxBlocked(world, solids, x, y, half)) {
    const max = world.size - 0.01;
    return { x: Math.min(max, Math.max(0.01, x + dx)), y: Math.min(max, Math.max(0.01, y + dy)) };
  }
  if (dx !== 0 && !boxBlocked(world, solids, x + dx, y, half)) x += dx;
  if (dy !== 0 && !boxBlocked(world, solids, x, y + dy, half)) y += dy;
  return { x, y };
}

export function speedFactor(world: World, x: number, y: number): number {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (!inBounds(tx, ty, world.size)) return 1;
  const t = world.terrain[idx(tx, ty, world.size)];
  return t === T.SHALLOW || t === T.RIVER ? WADE_SPEED : 1;
}
