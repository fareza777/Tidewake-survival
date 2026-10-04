import Phaser from 'phaser';
import type { ResourceKind } from '@/sim/world/types';

/** Little pieces that fly off what was hit: colours, how many, and how hard they are thrown (world pixels a second). */
interface Look {
  colors: readonly number[];
  count: number;
  speed: number;
  size: number;
}

const LOOKS = {
  wood: { colors: [0x8a5a34, 0xb07a48, 0x5e3b20, 0xd8a468], count: 9, speed: 62, size: 2 },
  leaf: { colors: [0x5fa845, 0x8bd05a, 0x3f7a35, 0xb8e86a], count: 8, speed: 54, size: 2 },
  stone: { colors: [0xb8b6c4, 0x8d8c97, 0xf4f0d8, 0xffd96a], count: 9, speed: 78, size: 2 },
  ore: { colors: [0xffd96a, 0xf4f0d8, 0x9be2f0, 0xb8b6c4], count: 10, speed: 84, size: 2 },
  spark: { colors: [0xffffff, 0xfff1a8, 0xffc857, 0xff8a3c], count: 10, speed: 96, size: 2 },
} satisfies Record<string, Look>;
export type ImpactKind = keyof typeof LOOKS;

/** What flies off each kind of resource when the hero strikes it. */
export function impactOf(kind: ResourceKind | undefined): ImpactKind {
  switch (kind) {
    case 'tree': case 'palm': case 'swamptree': return 'wood';
    case 'bush': return 'leaf';
    case 'ore': case 'crystal': return 'ore';
    default: return 'stone';
  }
}

/**
 * A short burst at a world position: chips, leaves or sparks fly out, arc down under a little gravity and fade.
 * `depth` keeps it in front of whatever was hit.
 */
export function burst(scene: Phaser.Scene, x: number, y: number, kind: ImpactKind, depth: number, dirX = 0): void {
  const look: Look = LOOKS[kind];
  for (let i = 0; i < look.count; i++) {
    const angle = -Math.PI / 2 + Phaser.Math.FloatBetween(-1.25, 1.25) + dirX * 0.5;
    const speed = look.speed * Phaser.Math.FloatBetween(0.5, 1);
    const color = look.colors[i % look.colors.length];
    const bit = scene.add.rectangle(x, y, look.size, look.size, color).setDepth(depth);
    const life = Phaser.Math.Between(260, 420);
    const dx = Math.cos(angle) * speed * (life / 1000);
    const dy = Math.sin(angle) * speed * (life / 1000);
    scene.tweens.add({ targets: bit, x: x + dx, duration: life, ease: 'Sine.easeOut' });
    scene.tweens.add({
      targets: bit, y: [y + dy * 0.9, y + dy * 0.9 + 14], duration: life, ease: 'Quad.easeOut', alpha: { from: 1, to: 0 },
      onComplete: () => bit.destroy(),
    });
  }
  if (kind === 'spark' || kind === 'stone' || kind === 'ore') {
    const flash = scene.add.circle(x, y, 5, 0xffffff, 0.85).setDepth(depth);
    scene.tweens.add({ targets: flash, scale: 1.8, alpha: 0, duration: 130, onComplete: () => flash.destroy() });
  }
}
