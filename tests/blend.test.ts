import { describe, expect, it } from 'vitest';
import {
  CORNER_BL, CORNER_BR, CORNER_TL, CORNER_TR, FULL, GROUND_LAYERS, cornerLayers, fieldValue, layerMasks, layerOf,
} from '@/sim/blend';
import { T, idx, type World } from '@/sim/world/types';

/** A tiny world of one terrain with a patch of another. */
function world(size: number, base: number, patches: readonly [number, number, number][] = []): World {
  const terrain = new Uint8Array(size * size).fill(base);
  for (const [x, y, t] of patches) terrain[idx(x, y, size)] = t;
  return { seed: 1, size, terrain } as unknown as World;
}

describe('ground layers', () => {
  it('stack from deep water up to stone and treat rivers like shallow water', () => {
    expect(GROUND_LAYERS.map(layerOf)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(layerOf(T.RIVER)).toBe(layerOf(T.SHALLOW));
    expect(layerOf(T.FLOOR)).toBe(0);
  });

  it('read the four cells around a corner, and count the outside of the map as deep water', () => {
    const w = world(4, T.GRASS, [[1, 1, T.SAND]]);
    expect(cornerLayers(w, 1, 1)).toEqual([6, 6, 6, 2]);
    expect(cornerLayers(w, 0, 0)).toEqual([0, 0, 0, 6]);
  });
});

describe('layerMasks', () => {
  it('draw only the top layer where it fills the tile', () => {
    const m = layerMasks(world(4, T.GRASS), 2, 2);
    expect(m[6]).toBe(FULL);
    expect(m.slice(0, 6).every((x) => x === 0)).toBe(true);
  });

  it('keep the layers below when the top one covers only some corners', () => {
    const w = world(4, T.SAND, [[1, 1, T.GRASS]]);
    const m = layerMasks(w, 2, 2);
    expect(m[6]).toBe(CORNER_TL);
    expect(m[2]).toBe(FULL);
    expect(m[1]).toBe(0);
  });

  it('start every coast on the water layer', () => {
    const w = world(6, T.DEEP, [[2, 2, T.SAND], [3, 2, T.SAND], [2, 3, T.SAND], [3, 3, T.SAND]]);
    const m = layerMasks(w, 2, 2);
    expect(m[0]).toBe(FULL);
    expect(m[2]).toBe(CORNER_BR);
  });
});

describe('fieldValue', () => {
  const pixels = Array.from({ length: 256 }, (_, i) => [i % 16, Math.floor(i / 16)] as const);

  it('keeps an empty tile empty and a full tile full, whatever the wobble', () => {
    for (let variant = 1; variant <= 4; variant++) {
      for (const [px, py] of pixels) {
        expect(fieldValue(0, px, py, variant)).toBeLessThan(0.5);
        expect(fieldValue(FULL, px, py, variant)).toBeGreaterThanOrEqual(0.5);
      }
    }
  });

  it('puts the border of two tiles that share an edge in the same place, whichever wobble each uses', () => {
    // Left tile has its right corners set, right tile has its left corners set: they describe the same border.
    const left = CORNER_TR | CORNER_BR;
    const right = CORNER_TL | CORNER_BL;
    for (let py = 0; py < 16; py++) {
      const a = fieldValue(left, 15, py, 1) >= 0.5;
      const b = fieldValue(right, 0, py, 3) >= 0.5;
      expect(a, `row ${py}`).toBe(b);
    }
  });

  it('draws a curved shape for a single corner, inside near the corner and outside far from it', () => {
    expect(fieldValue(CORNER_TL, 0, 0, 1)).toBeGreaterThanOrEqual(0.5);
    expect(fieldValue(CORNER_TL, 15, 15, 1)).toBeLessThan(0.5);
  });

  it('gives the same answer for the same arguments and different shapes for different wobbles', () => {
    const shape = (variant: number): string => pixels.map(([x, y]) => (fieldValue(CORNER_TL | CORNER_BL, x, y, variant) >= 0.5 ? 1 : 0)).join('');
    expect(shape(1)).toBe(shape(1));
    expect(shape(1)).not.toBe(shape(2));
  });
});
