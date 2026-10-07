import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DUNGEON_THEMES, themeTiles } from '@/data/terrainTiles';
import { TILE_FRAMES } from '@/data/tileIndex';
import { moveWithCollision, speedFactor, tileBlocked } from '@/sim/movement';
import { dungeonFrame } from '@/sim/tileView';
import { T, isWalkable, idx, type World } from '@/sim/world/types';

/** A 6x6 room: floor inside, wall all round. */
function room(): World {
  const size = 6;
  const terrain = new Uint8Array(size * size).fill(T.WALL);
  for (let y = 1; y < 5; y++) for (let x = 1; x < 5; x++) terrain[idx(x, y, size)] = T.FLOOR;
  return { seed: 0, size, terrain, biome: new Uint8Array(size * size), landmarks: [], resources: [], start: { x: 2, y: 2 } };
}

describe('floor and wall terrain', () => {
  it('has its own terrain ids, and walls cannot be walked through while floors can', () => {
    expect(new Set(Object.values(T)).size).toBe(Object.values(T).length);
    expect(T.FLOOR).not.toBe(T.WALL);
    expect(isWalkable(T.FLOOR)).toBe(true);
    expect(isWalkable(T.WALL)).toBe(false);
  });

  it('blocks movement into a wall, slides along it, and walks freely on the floor', () => {
    const w = room();
    const none = new Set<number>();
    expect(tileBlocked(w, none, 0, 0)).toBe(true);
    expect(tileBlocked(w, none, 2, 2)).toBe(false);
    expect(moveWithCollision(w, none, { x: 1.5, y: 2.5 }, -1, 0).x).toBeCloseTo(1.5, 0);
    expect(moveWithCollision(w, none, { x: 1.5, y: 2.5 }, -1, 0).x).toBeGreaterThanOrEqual(1.28);
    expect(moveWithCollision(w, none, { x: 2.5, y: 2.5 }, 0.5, 0)).toEqual({ x: 3, y: 2.5 });
    expect(speedFactor(w, 2.5, 2.5)).toBe(1);
  });
});

describe('dungeon tiles', () => {
  it('has seven themes with four floor tiles, a wall face and a wall top each, all packed', () => {
    expect(DUNGEON_THEMES).toEqual(['moss', 'mine', 'ruin', 'ice', 'magma', 'bone', 'void']);
    for (const theme of DUNGEON_THEMES) {
      const t = themeTiles(theme);
      expect(t[T.FLOOR].length, theme).toBe(4);
      for (const [name, weight] of [...t[T.FLOOR], ...t[T.WALL]]) {
        expect(TILE_FRAMES[name], name).toBeTypeOf('number');
        expect(weight).toBeGreaterThan(0);
      }
      expect(TILE_FRAMES[`wallface.${theme}`], theme).toBeTypeOf('number');
      expect(TILE_FRAMES[`walltop.${theme}`], theme).toBeTypeOf('number');
    }
  });

  it('draws the lit face of a wall where floor lies to its south, and a dark top elsewhere', () => {
    const w = room();
    const face = TILE_FRAMES['wallface.mine'];
    const top = TILE_FRAMES['walltop.mine'];
    // The north wall has floor to its south only one row down, so its own south neighbour (y = 1) is floor: it is a face.
    expect(dungeonFrame(w, 2, 0, 'mine')).toBe(face);
    expect(dungeonFrame(w, 0, 2, 'mine')).toBe(top);
    expect(dungeonFrame(w, 5, 2, 'mine')).toBe(top);
    expect(dungeonFrame(w, 2, 5, 'mine')).toBe(top);
    expect(dungeonFrame(w, 0, 0, 'mine')).toBe(top);
  });

  it('shows a wall face for a wall tile whose south neighbour is floor', () => {
    const w = room();
    // Put a wall in the middle of the floor: the tile above it is floor, the one it stands on has floor to its south.
    w.terrain[idx(2, 2, 6)] = T.WALL;
    expect(dungeonFrame(w, 2, 2, 'ruin')).toBe(TILE_FRAMES['wallface.ruin']);
    expect(dungeonFrame(w, 0, 3, 'ruin')).toBe(TILE_FRAMES['walltop.ruin']);
  });

  it('is stable for a position and mixes the floor variants, favouring the plain one', () => {
    const w = room();
    const counts = new Map<number, number>();
    for (let i = 0; i < 40; i++) expect(dungeonFrame(w, 1 + (i % 4), 2, 'moss')).toBe(dungeonFrame(w, 1 + (i % 4), 2, 'moss'));
    const big: World = { ...w, size: 40, terrain: new Uint8Array(1600).fill(T.FLOOR) };
    for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) counts.set(dungeonFrame(big, x, y, 'moss'), (counts.get(dungeonFrame(big, x, y, 'moss')) ?? 0) + 1);
    expect(counts.size).toBeGreaterThan(1);
    expect(counts.get(TILE_FRAMES['floor.moss.0'])!).toBeGreaterThan(1600 * 0.4);
  });

  it.skipIf(!fs.existsSync(path.resolve(__dirname, '../public/assets/pack/tiles.png')))('packs every frame the index names into the sheet', () => {
    const png = fs.readFileSync(path.resolve(__dirname, '../public/assets/pack/tiles.png'));
    const height = png.readUInt32BE(20);
    const width = png.readUInt32BE(16);
    expect((width / 16) * (height / 16)).toBeGreaterThanOrEqual(Math.max(...Object.values(TILE_FRAMES)) + 1);
  });
});
