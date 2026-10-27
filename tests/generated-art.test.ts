import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ITEMS } from '@/data/items';
import { DUNGEONS } from '@/data/dungeons';
import { LANDMARK_PROPS } from '@/data/landmarkProps';
import type { LandmarkId } from '@/sim/world/types';

interface Frame {
  frame: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
}
interface Atlas {
  frames: Record<string, Frame>;
  meta: { size: { w: number; h: number } };
}

const pack = path.resolve(__dirname, '../public/assets/pack');
function readAtlas(name: string): Atlas | null {
  const file = path.join(pack, `${name}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) as Atlas : null;
}

describe('generated item and dungeon art', () => {
  it('resolves every inventory item to its generated sprite, including crops and placeables', () => {
    const atlas = readAtlas('itemArt');
    expect(atlas, 'generated item atlas is required').not.toBeNull();
    for (const item of Object.values(ITEMS)) {
      expect(item.icon.atlas, item.id).toBe('itemArt');
      expect(atlas!.frames[item.icon.frame], item.id).toBeDefined();
    }
    expect(Object.keys(atlas!.frames)).toHaveLength(Object.keys(ITEMS).length);
  });

  it('packs transparent square sprites within the actual PNG dimensions', () => {
    for (const [name, cell] of [['itemArt', 64], ['entrances', 128]] as const) {
      const atlas = readAtlas(name);
      expect(atlas, name).not.toBeNull();
      const png = fs.readFileSync(path.join(pack, `${name}.png`));
      expect(png.subarray(1, 4).toString()).toBe('PNG');
      expect(png[25], `${name} needs an alpha channel`).toBe(6);
      expect(png.readUInt32BE(16)).toBe(atlas!.meta.size.w);
      expect(png.readUInt32BE(20)).toBe(atlas!.meta.size.h);
      for (const [id, f] of Object.entries(atlas!.frames)) {
        expect(f.sourceSize, id).toEqual({ w: cell, h: cell });
        expect(f.frame.x + f.frame.w, id).toBeLessThan(atlas!.meta.size.w);
        expect(f.frame.y + f.frame.h, id).toBeLessThan(atlas!.meta.size.h);
        expect(f.frame.x, id).toBeGreaterThan(0);
        expect(f.frame.y, id).toBeGreaterThan(0);
      }
    }
  });

  it('keeps the existing approach and collision tiles around every entrance', () => {
    const footprints: Record<string, number[][]> = {
      grotto: [[-1, 0], [0, 0], [1, 0]],
      deepmine: [[-1, 0], [0, 0], [1, 0]],
      ruin: [[0, 0], [-2, 1], [2, 1]],
      lighthouse: [[0, 0], [-2, 0], [2, 0]],
      frostcave: [[-1, 0], [0, 0], [1, 0]],
      magmaforge: [[-1, 0], [0, 0], [1, 0]],
      drownedcrypt: [[0, 0], [-2, 1], [2, 1]],
      skyspire: [[0, 0], [-2, 0], [2, 0]],
    };
    for (const [id, expected] of Object.entries(footprints)) {
      const blocks = LANDMARK_PROPS[id as LandmarkId].flatMap(prop => prop.blocks ?? []);
      expect(blocks.map(tile => tile.join(',')).sort(), id).toEqual(expected.map(tile => tile.join(',')).sort());
    }
  });

  it('shows a distinct generated entrance at every enterable island dungeon', () => {
    const atlas = readAtlas('entrances');
    expect(atlas, 'generated entrance atlas is required').not.toBeNull();
    const frames = new Set<string>();
    for (const id of Object.keys(DUNGEONS).filter(id => id !== 'depths')) {
      const prop = LANDMARK_PROPS[id as LandmarkId].find(p => p.atlas === 'entrances');
      expect(prop, id).toBeDefined();
      expect(atlas!.frames[prop!.frame], id).toBeDefined();
      expect(prop!.blocks, `${id} doorway footprint`).toContainEqual([0, 0]);
      frames.add(prop!.frame);
    }
    expect(frames.size).toBe(8);
  });
});
