import { describe, expect, it } from 'vitest';
import { PLAYER_HALF, WADE_SPEED, moveWithCollision, speedFactor, tileBlocked } from '@/sim/movement';
import { T, WORLD_SIZE, idx, type World } from '@/sim/world/types';

/** A tiny all-grass world with a deep-water column at x = 8 and a river tile at (3, 3). */
function makeWorld(): World {
  const size = WORLD_SIZE;
  const terrain = new Uint8Array(size * size).fill(T.GRASS);
  for (let y = 0; y < size; y++) terrain[idx(8, y)] = T.DEEP;
  terrain[idx(3, 3)] = T.RIVER;
  terrain[idx(4, 3)] = T.SHALLOW;
  return { seed: 0, size, terrain, biome: new Uint8Array(size * size), landmarks: [], resources: [], start: { x: 1, y: 1 } };
}

const none: ReadonlySet<number> = new Set();

describe('moveWithCollision', () => {
  it('moves freely over open ground', () => {
    expect(moveWithCollision(makeWorld(), none, { x: 5.5, y: 5.5 }, 0.1, -0.05)).toEqual({ x: 5.6, y: 5.45 });
  });

  it('is stopped by deep water', () => {
    const p = moveWithCollision(makeWorld(), none, { x: 7.5, y: 5.5 }, 0.5, 0);
    expect(p.x).toBe(7.5);
  });

  it('slides along a wall instead of sticking', () => {
    const p = moveWithCollision(makeWorld(), none, { x: 7.5, y: 5.5 }, 0.5, 0.2);
    expect(p.x).toBe(7.5);
    expect(p.y).toBeCloseTo(5.7);
  });

  it('is blocked by solid resource tiles', () => {
    const solids = new Set([idx(6, 5)]);
    expect(moveWithCollision(makeWorld(), solids, { x: 5.5, y: 5.5 }, 0.5, 0).x).toBe(5.5);
  });

  it('cannot leave the map', () => {
    const w = makeWorld();
    expect(moveWithCollision(w, none, { x: PLAYER_HALF + 0.01, y: 5.5 }, -1, 0).x).toBeCloseTo(PLAYER_HALF + 0.01);
    expect(moveWithCollision(w, none, { x: 5.5, y: WORLD_SIZE - PLAYER_HALF - 0.01 }, 0, 1).y).toBeCloseTo(WORLD_SIZE - PLAYER_HALF - 0.01);
  });

  it('lets a player who is stuck inside a solid tile walk out, but never off the map', () => {
    const solids = new Set([idx(5, 5)]);
    expect(moveWithCollision(makeWorld(), solids, { x: 5.5, y: 5.5 }, 0.1, 0)).toEqual({ x: 5.6, y: 5.5 });
    expect(moveWithCollision(makeWorld(), new Set([idx(0, 0)]), { x: 0.2, y: 0.2 }, -5, -5)).toEqual({ x: 0.01, y: 0.01 });
  });

  it('allows wading into shallow water and rivers', () => {
    const p = moveWithCollision(makeWorld(), none, { x: 2.7, y: 3.5 }, 0.5, 0);
    expect(p.x).toBeCloseTo(3.2);
  });
});

describe('tileBlocked / speedFactor', () => {
  it('blocks deep water, solids and out-of-bounds only', () => {
    const w = makeWorld();
    expect(tileBlocked(w, none, 8, 0)).toBe(true);
    expect(tileBlocked(w, none, -1, 0)).toBe(true);
    expect(tileBlocked(w, none, 0, WORLD_SIZE)).toBe(true);
    expect(tileBlocked(w, new Set([idx(2, 2)]), 2, 2)).toBe(true);
    expect(tileBlocked(w, none, 3, 3)).toBe(false);
  });

  it('slows the player in shallow water and rivers', () => {
    const w = makeWorld();
    expect(speedFactor(w, 5.5, 5.5)).toBe(1);
    expect(speedFactor(w, 3.5, 3.5)).toBe(WADE_SPEED);
    expect(speedFactor(w, 4.5, 3.5)).toBe(WADE_SPEED);
    expect(speedFactor(w, -4, -4)).toBe(1);
  });
});
