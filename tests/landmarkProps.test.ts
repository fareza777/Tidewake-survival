import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LANDMARK_PROPS } from '@/data/landmarkProps';
import { RESERVE_RADIUS } from '@/sim/world/landmarks';
import type { LandmarkId } from '@/sim/world/types';

const PROPS = path.resolve(__dirname, '../public/assets/pack/props.json');

describe('landmark props', () => {
  it('defines scenery for all 19 landmarks', () => {
    expect(Object.keys(LANDMARK_PROPS)).toHaveLength(19);
    for (const props of Object.values(LANDMARK_PROPS)) expect(props.length).toBeGreaterThan(0);
  });

  it('keeps every prop and blocked tile inside the clearing the generator leaves free', () => {
    for (const [id, props] of Object.entries(LANDMARK_PROPS)) {
      const rad = RESERVE_RADIUS[id as LandmarkId];
      for (const p of props) {
        expect(Math.abs(p.dx) <= rad && Math.abs(p.dy) <= rad, `${id} prop ${p.frame}`).toBe(true);
        for (const [bx, by] of p.blocks ?? []) expect(Math.abs(bx) <= rad && Math.abs(by) <= rad, `${id} block`).toBe(true);
      }
    }
  });

  it.skipIf(!fs.existsSync(PROPS))('only uses frames that exist in the packed props atlas', () => {
    const atlas = JSON.parse(fs.readFileSync(PROPS, 'utf8')) as { frames: Record<string, unknown> };
    for (const [id, props] of Object.entries(LANDMARK_PROPS)) {
      for (const p of props) expect(atlas.frames[p.frame], `${id}: ${p.frame}`).toBeDefined();
    }
  });
});
