import type { Rng } from '@/core/rng';
import type { Vec } from '@/sim/movement';
import type { NpcPlace } from './spots';
import { GROUND, idx, inBounds, type World } from './types';

/** How far an islander strolls from where they live (tiles), and how close to the hero they may step. */
export const WANDER_RADIUS = 2;
const HERO_CLEARANCE = 1.3;
const STEPS: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * Where islander `i` may take their next single step: one tile to the side on dry ground, within reach of home, clear of
 * scenery, other islanders and the hero. Returns null when they should just stay (or nothing is free).
 */
export function wanderStep(
  world: World, blocked: ReadonlySet<number>, places: readonly NpcPlace[], homes: readonly NpcPlace[], i: number, hero: Vec, rng: Rng,
): { x: number; y: number } | null {
  if (rng.chance(0.25)) return null;
  const here = places[i];
  const home = homes[i];
  const options = STEPS.map(([dx, dy]) => ({ x: here.x + dx, y: here.y + dy })).filter((p) => {
    if (!inBounds(p.x, p.y, world.size)) return false;
    if (Math.max(Math.abs(p.x - home.x), Math.abs(p.y - home.y)) > WANDER_RADIUS) return false;
    const tile = idx(p.x, p.y, world.size);
    if (!GROUND.has(world.terrain[tile]) || blocked.has(tile)) return false;
    if (places.some((o, j) => j !== i && o.x === p.x && o.y === p.y)) return false;
    return Math.hypot(p.x + 0.5 - hero.x, p.y + 0.5 - hero.y) >= HERO_CLEARANCE;
  });
  return options.length === 0 ? null : options[rng.int(0, options.length - 1)];
}
