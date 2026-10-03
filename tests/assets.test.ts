import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CROPS } from '@/data/crops';
import { ITEMS } from '@/data/items';
import { STRUCTURES } from '@/data/structures';
import { TILE_FRAMES } from '@/data/tileIndex';

const PACK = path.resolve(__dirname, '../public/assets/pack');
const atlasFrames = (name: string): Record<string, unknown> | null => {
  const file = path.join(PACK, `${name}.json`);
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as { frames: Record<string, unknown> }).frames : null;
};
const props = atlasFrames('props');
const icons = atlasFrames('icons');
const ready = !!props && !!icons;

describe.skipIf(!ready)('packed art matches the game data', () => {
  it('has an icon for every item, in the atlas the item names', () => {
    for (const def of Object.values(ITEMS)) {
      const frames = def.icon.atlas === 'icons' ? icons! : props!;
      expect(frames[def.icon.frame], `${def.id}: ${def.icon.atlas}/${def.icon.frame}`).toBeDefined();
    }
  });

  it('has a sprite for every structure, and a matching animation for the animated ones', () => {
    for (const s of Object.values(STRUCTURES)) {
      expect(icons![s.frame], s.id).toBeDefined();
      if (!s.world) continue;
      expect(props![s.world.frame], `${s.id} world frame`).toBeDefined();
      const group = s.world.frame.slice(0, s.world.frame.lastIndexOf('/'));
      expect(s.world.anim).toBe(group.replace(/\//g, '_'));
    }
  });

  it('has every growth stage of every crop', () => {
    for (const c of Object.values(CROPS)) {
      for (let stage = 0; stage <= c.ripeStage; stage++) expect(props![`plant/${c.sheet}/${stage}`], `${c.id} stage ${stage}`).toBeDefined();
    }
  });

  it('has the HUD icons and the farm soil tiles', () => {
    for (const name of ['ui_heart', 'ui_food', 'ui_drop', 'ui_bolt']) expect(icons![name], name).toBeDefined();
    expect(TILE_FRAMES['soil.dry']).toBeTypeOf('number');
    expect(TILE_FRAMES['soil.wet']).toBeTypeOf('number');
  });
});
