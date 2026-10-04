import type Phaser from 'phaser';
import { Rng } from '@/core/rng';
import { view } from '@/core/viewport';

/** A night-sea gradient with a sprinkle of stars, drawn behind the menu-like screens. Returns nothing to manage: it lives and dies with the scene. */
export function nightBackdrop(scene: Phaser.Scene, depth = -10): void {
  const { w: W, h: H } = view;
  const sea = scene.add.graphics().setDepth(depth);
  sea.fillGradientStyle(0x123f66, 0x123f66, 0x070b1a, 0x070b1a, 1);
  sea.fillRect(0, 0, W, H);
  const rng = new Rng(11);
  for (let i = 0; i < 40; i++) {
    sea.fillStyle(0xffffff, rng.float(0.2, 0.7));
    sea.fillRect(Math.round(rng.float(2, W - 2)), Math.round(rng.float(2, H * 0.6)), rng.chance(0.15) ? 2 : 1, rng.chance(0.15) ? 2 : 1);
  }
  scene.add.image(W / 2, H / 2, 'fx_vignette').setDisplaySize(W * 1.25, H * 1.2).setAlpha(0.8).setDepth(depth + 1);
}
