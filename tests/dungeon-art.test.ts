import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DUNGEON_ART } from '@/data/dungeonArt';
import { LANDMARK_PROPS } from '@/data/landmarkProps';
import { DUNGEON_IDS } from '@/sim/dungeon/progress';

const PROPS = path.resolve(__dirname, '../public/assets/pack/props.json');
const frames = fs.existsSync(PROPS) ? (JSON.parse(fs.readFileSync(PROPS, 'utf8')) as { frames: Record<string, unknown> }).frames : null;
const entranceFrames = (JSON.parse(fs.readFileSync(path.resolve(__dirname, '../public/assets/pack/entrances.json'), 'utf8')) as { frames: Record<string, unknown> }).frames;

describe.skipIf(!frames)('dungeon art', () => {
  const need = (name: string): void => expect(frames![name], name).toBeDefined();

  it('has every door, chest, crystal, trap, switch and block frame the dungeon draws', () => {
    for (const door of Object.values(DUNGEON_ART.door)) for (let i = 0; i < 4; i++) need(`${door}/${i}`);
    for (const chest of Object.values(DUNGEON_ART.chest)) for (let i = 0; i < 4; i++) need(`${chest}/${i}`);
    for (const crystal of Object.values(DUNGEON_ART.crystal)) for (let i = 0; i < 3; i++) need(`${crystal}/${i}`);
    for (const i of Object.values(DUNGEON_ART.trap)) need(`${DUNGEON_ART.trapSheet}/${i}`);
    need(DUNGEON_ART.switch.off);
    need(DUNGEON_ART.switch.on);
    need(DUNGEON_ART.block);
    need(`${DUNGEON_ART.torch}/0`);
  });

  it('puts a generated dungeon facade on each entrance tile and keeps the doorway solid', () => {
    for (const id of DUNGEON_IDS.filter((x) => x !== 'depths')) {
      const door = LANDMARK_PROPS[id as keyof typeof LANDMARK_PROPS].find((p) => p.dx === 0 && p.dy === 0);
      expect(door, id).toBeDefined();
      expect(door!.atlas, id).toBe('entrances');
      expect(door!.blocks, id).toContainEqual([0, 0]);
      expect(entranceFrames[door!.frame], id).toBeDefined();
    }
  });
});
