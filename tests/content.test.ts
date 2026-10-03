import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RESOURCES, resourceFrame } from '@/data/resources';
import type { ResourceKind } from '@/sim/world/types';

const PROPS = path.resolve(__dirname, '../public/assets/pack/props.json');

describe('resource content', () => {
  const kinds = Object.keys(RESOURCES) as ResourceKind[];

  it('defines sane hit points and drops for every kind', () => {
    for (const k of kinds) {
      const def = RESOURCES[k];
      expect(def.frames.length, k).toBeGreaterThan(0);
      expect(def.hp, k).toBeGreaterThan(0);
      expect(def.drops.length, k).toBeGreaterThan(0);
      for (const d of def.drops) {
        expect(d.min).toBeGreaterThanOrEqual(0);
        expect(d.max).toBeGreaterThanOrEqual(d.min);
      }
    }
  });

  it('picks sprite frames by variant, wrapping around', () => {
    expect(resourceFrame('tree', 0)).toBe(RESOURCES.tree.frames[0]);
    expect(resourceFrame('tree', 255)).toBe(RESOURCES.tree.frames[255 % RESOURCES.tree.frames.length]);
  });

  it.skipIf(!fs.existsSync(PROPS))('only uses sprite frames that exist in the packed props atlas', () => {
    const atlas = JSON.parse(fs.readFileSync(PROPS, 'utf8')) as { frames: Record<string, unknown> };
    for (const k of kinds) for (const f of RESOURCES[k].frames) expect(atlas.frames[f], `${k}: ${f}`).toBeDefined();
  });
});
