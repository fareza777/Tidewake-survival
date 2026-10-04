import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DUNGEON_ART } from '@/data/dungeonArt';
import { LANDMARK_PROPS } from '@/data/landmarkProps';
import { DUNGEON_IDS } from '@/sim/dungeon/progress';

const PROPS = path.resolve(__dirname, '../public/assets/pack/props.json');
const frames = fs.existsSync(PROPS) ? (JSON.parse(fs.readFileSync(PROPS, 'utf8')) as { frames: Record<string, unknown> }).frames : null;

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

  it('puts a closed dungeon door on the entrance tile of the three dungeons, and keeps it solid', () => {
    for (const id of DUNGEON_IDS) {
      const door = LANDMARK_PROPS[id].find((p) => p.dx === 0 && p.dy === 0);
      expect(door, id).toBeDefined();
      expect(door!.frame, id).toMatch(/^door\//);
      expect(door!.blocks, id).toEqual([[0, 0]]);
      need(door!.frame);
    }
  });
});
