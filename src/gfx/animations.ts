import Phaser from 'phaser';

/**
 * Every frame group in the packed atlases ("hero1/walk/down/0..3") becomes an animation keyed
 * "hero1_walk_down". Frame rate and looping are inferred from the animation name.
 */
const ONE_SHOT = /(attack|hit|death|bow|throw|spin|lift|chest|door|switch|sword|spear|staff|slash|shot|stuck|grow|dead)/;
const RATES: [RegExp, number][] = [
  [/attack|sword|spear|slash|staff/, 16],
  [/bow|throw/, 16],
  [/spin/, 18],
  [/death/, 12],
  [/hit/, 12],
  [/run/, 11],
  [/walk|move/, 8],
  [/breath/, 5],
  [/torch|lamp|fire|campfire/, 9],
  [/crystal|water|lava/, 6],
  [/chest|door|switch/, 12],
];

export function animKey(group: string): string {
  return group.replace(/\//g, '_');
}

export function registerAnimations(scene: Phaser.Scene): void {
  const created: string[] = [];
  for (const atlas of ['heroes', 'actors', 'monsters', 'props']) {
    const tex = scene.textures.get(atlas);
    const groups = new Map<string, string[]>();
    for (const name of tex.getFrameNames()) {
      const i = name.lastIndexOf('/');
      if (i < 0) continue;
      const idx = name.slice(i + 1);
      if (!/^\d+$/.test(idx)) continue;
      const g = name.slice(0, i);
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(name);
    }
    for (const [g, frames] of groups) {
      if (g === 'p') continue;
      frames.sort((a, b) => Number(a.slice(a.lastIndexOf('/') + 1)) - Number(b.slice(b.lastIndexOf('/') + 1)));
      const key = animKey(g);
      if (scene.anims.exists(key)) continue;
      const rate = RATES.find(([re]) => re.test(g))?.[1] ?? 8;
      scene.anims.create({
        key,
        frames: frames.map((f) => ({ key: atlas, frame: f })),
        frameRate: rate,
        repeat: ONE_SHOT.test(g) ? 0 : -1,
      });
      created.push(key);
    }
  }
  // 3-frame RPG walk sheets (idle pose in the middle) read best as a 0-1-2-1 ping-pong.
  for (const anim of created) {
    if (!/(npc\d+|arpg\d+|cat\d|fox\d|bird\d|bunny\d|mouse\d|farmer|^m\d\d_\d|^bonus)_/.test(anim)) continue;
    const a = scene.anims.get(anim);
    if (a.frames.length === 3 && a.repeat === -1) {
      const f = a.frames.map((fr) => ({ key: fr.textureKey, frame: fr.textureFrame as string }));
      scene.anims.remove(anim);
      scene.anims.create({ key: anim, frames: [f[0], f[1], f[2], f[1]], frameRate: 7, repeat: -1 });
    }
  }
}

/** Frame name of the first frame of a group, e.g. for static previews. */
export function firstFrame(group: string): string {
  return `${group}/0`;
}

export const DIRS = ['down', 'left', 'right', 'up'] as const;
export type Dir = (typeof DIRS)[number];

export function dirFromVector(x: number, y: number, prev: Dir = 'down'): Dir {
  if (Math.abs(x) < 0.01 && Math.abs(y) < 0.01) return prev;
  if (Math.abs(x) > Math.abs(y) * 1.05) return x < 0 ? 'left' : 'right';
  return y < 0 ? 'up' : 'down';
}
