import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CUES, cueForEncounter, cueForFx, cueForNode, musicFor, type Cue } from '@/sim/cues';
import type { Fx } from '@/sim/session';
import type { ResourceKind } from '@/sim/world/types';

describe('cueForFx', () => {
  const cue = (fx: Fx, kind?: ResourceKind): Cue | null => cueForFx(fx, kind);

  it('maps the hero actions to their sounds', () => {
    expect(cue({ t: 'swing' })).toBe('swing');
    expect(cue({ t: 'gain', item: 'wood', qty: 1 })).toBe('pickup');
    expect(cue({ t: 'built', structure: { id: 1, type: 'fence', x: 1, y: 1 } })).toBe('place');
    expect(cue({ t: 'unbuilt', id: 1 })).toBe('pickup');
    expect(cue({ t: 'slept' })).toBe('sleep');
    expect(cue({ t: 'ate' })).toBe('eat');
    expect(cue({ t: 'shot', stats: { kind: 'bow', damage: 1, reach: 1, arc: 0, cooldown: 1, stamina: 1, knockback: 0 } })).toBe('shoot');
    expect(cue({ t: 'open', structure: { id: 1, type: 'chest', x: 1, y: 1 } })).toBe('ui_click');
  });

  it('says what a hit on a node sounds like from the kind of node', () => {
    expect(cue({ t: 'hit', id: 1 }, 'tree')).toBe('chop');
    expect(cue({ t: 'hit', id: 1 }, 'rock')).toBe('mine');
    expect(cue({ t: 'hit', id: 1 })).toBe('chop');
    for (const k of ['tree', 'palm', 'swamptree', 'bush'] as const) expect(cueForNode(k), k).toBe('chop');
    for (const k of ['rock', 'redrock', 'ore', 'crystal'] as const) expect(cueForNode(k), k).toBe('mine');
  });

  it('plays a sound for a broken tool, drinking and filling the can, and stays quiet for other messages', () => {
    const say = (key: string): Fx => ({ t: 'say', key });
    expect(cue(say('msgToolBroke'))).toBe('break');
    expect(cue(say('msgDrank'))).toBe('drink');
    expect(cue(say('msgFilled'))).toBe('drink');
    expect(cue(say('msgFull'))).toBeNull();
    expect(cue({ t: 'strike', melee: { damage: 1, reach: 1, arc: 90, knockback: 0, stamina: 1, cooldown: 1, wear: false } })).toBeNull();
    expect(cue({ t: 'gone', id: 1 })).toBeNull();
  });
});

describe('cueForEncounter', () => {
  it('has a sound for a creature being hit or killed and for the hero being hurt', () => {
    expect(cueForEncounter({ t: 'hit', id: 1, kind: 'slime', amount: 2, x: 0, y: 0 })).toBe('hit');
    expect(cueForEncounter({ t: 'killed', id: 1, kind: 'slime', x: 0, y: 0 })).toBe('kill');
    expect(cueForEncounter({ t: 'hurtHero', amount: 3, from: { x: 0, y: 0 }, kind: 'slime' })).toBe('hurt');
  });
});

describe('musicFor', () => {
  it('plays the battle theme in a fight, otherwise day or night music', () => {
    expect(musicFor(false, false)).toBe('day');
    expect(musicFor(true, false)).toBe('night');
    expect(musicFor(false, true)).toBe('battle');
    expect(musicFor(true, true)).toBe('battle');
  });
});

describe('audio files', () => {
  const dir = path.resolve(__dirname, '../public/assets/audio');
  const ready = fs.existsSync(path.join(dir, 'sfx.json'));

  it.skipIf(!ready)('has a clip in the sound sprite for every cue, none overlapping, inside the file', () => {
    const sprite = JSON.parse(fs.readFileSync(path.join(dir, 'sfx.json'), 'utf8')) as { spritemap: Record<string, { start: number; end: number }> };
    for (const c of CUES) expect(sprite.spritemap[c], c).toBeDefined();
    const clips = Object.values(sprite.spritemap).sort((a, b) => a.start - b.start);
    clips.forEach((clip, i) => {
      expect(clip.end).toBeGreaterThan(clip.start);
      if (i > 0) expect(clip.start).toBeGreaterThanOrEqual(clips[i - 1].end);
    });
    expect(fs.statSync(path.join(dir, 'sfx.ogg')).size).toBeGreaterThan(5_000);
  });

  it.skipIf(!ready)('has a music loop for every mood, and keeps the whole audio folder small', () => {
    for (const mood of ['day', 'night', 'battle']) expect(fs.statSync(path.join(dir, `music_${mood}.ogg`)).size, mood).toBeGreaterThan(50_000);
    const total = fs.readdirSync(dir).reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0);
    expect(total).toBeLessThan(3 * 1024 * 1024);
  });
});
