import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/rng';
import { T, idx, type World } from '@/sim/world/types';
import { WANDER_RADIUS, wanderStep } from '@/sim/world/wander';

const SIZE = 20;
function grass(): World {
  return { seed: 1, size: SIZE, terrain: new Uint8Array(SIZE * SIZE).fill(T.GRASS) } as unknown as World;
}
const home = [{ id: 'tali' as const, x: 10, y: 10 }];
const far = { x: 0.5, y: 0.5 };

describe('wanderStep', () => {
  it('takes one step to a side tile, and never leaves the neighbourhood of home', () => {
    const w = grass();
    let at = { x: home[0].x, y: home[0].y };
    const rng = new Rng(3);
    for (let i = 0; i < 300; i++) {
      const to = wanderStep(w, new Set(), [{ id: 'tali' as const, x: at.x, y: at.y }], home, 0, far, rng);
      if (!to) continue;
      expect(Math.abs(to.x - at.x) + Math.abs(to.y - at.y)).toBe(1);
      at = to;
      expect(Math.max(Math.abs(at.x - home[0].x), Math.abs(at.y - home[0].y))).toBeLessThanOrEqual(WANDER_RADIUS);
    }
  });

  it('keeps off water, blocked tiles, other islanders and the hero', () => {
    const w = grass();
    w.terrain[idx(11, 10, SIZE)] = T.SHALLOW;
    const blocked = new Set([idx(9, 10, SIZE)]);
    const places = [{ id: 'tali' as const, x: 10, y: 10 }, { id: 'odo' as const, x: 10, y: 9 }];
    const homes = [places[0], places[1]];
    const hero = { x: 10.5, y: 11.5 };
    const rng = new Rng(5);
    for (let i = 0; i < 100; i++) expect(wanderStep(w, blocked, places, homes, 0, hero, rng)).toBeNull();
  });

  it('sometimes stays put', () => {
    const w = grass();
    const rng = new Rng(9);
    const results = Array.from({ length: 200 }, () => wanderStep(w, new Set(), home, home, 0, far, rng));
    expect(results.some((r) => r === null)).toBe(true);
    expect(results.some((r) => r !== null)).toBe(true);
  });
});
