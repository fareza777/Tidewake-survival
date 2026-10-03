import Phaser from 'phaser';
import { LANDMARK_PROPS } from '@/data/landmarkProps';
import { resourceFrame } from '@/data/resources';
import { TILE } from '@/gfx/TerrainLayer';
import type { World } from '@/sim/world/types';

/**
 * Sprites for every resource node and landmark prop. Objects are y-sorted by their base line (depth = world y of the
 * feet), so the player walks behind trees that are further south. Phaser culls the ones off screen.
 */
export class WorldObjects {
  private sprites = new Map<number, Phaser.GameObjects.Image>();

  constructor(private scene: Phaser.Scene, world: World) {
    for (const n of world.resources) {
      const x = (n.x + 0.5) * TILE;
      const y = (n.y + 1) * TILE - 1;
      const img = scene.add.image(x, y, 'props', resourceFrame(n.kind, n.variant)).setOrigin(0.5, 1).setDepth(y);
      this.sprites.set(n.id, img);
    }
    for (const l of world.landmarks) {
      for (const p of LANDMARK_PROPS[l.id]) {
        const x = (l.x + p.dx + 0.5) * TILE;
        const y = (l.y + p.dy + 1) * TILE - 1;
        const obj = p.anim ? scene.add.sprite(x, y, 'props', p.frame).play(p.anim) : scene.add.image(x, y, 'props', p.frame);
        obj.setOrigin(0.5, 1).setDepth(y);
      }
    }
  }

  /** Show or hide a node. Destroyed nodes shrink away; `animate` is off when restoring a save. */
  setAlive(id: number, alive: boolean, animate = true): void {
    const s = this.sprites.get(id);
    if (!s) return;
    this.scene.tweens.killTweensOf(s);
    s.setAngle(0);
    if (alive) {
      s.setVisible(true).setAlpha(1).setScale(1);
      return;
    }
    if (!animate) {
      s.setVisible(false);
      return;
    }
    this.scene.tweens.add({
      targets: s, alpha: 0, scaleX: 0.6, scaleY: 0.6, duration: 160,
      onComplete: () => s.setVisible(false),
    });
  }

  /** Quick sway when a node is hit. */
  shake(id: number): void {
    const s = this.sprites.get(id);
    if (!s) return;
    this.scene.tweens.killTweensOf(s);
    s.setAngle(0);
    this.scene.tweens.add({
      targets: s, angle: { from: -4, to: 4 }, duration: 45, yoyo: true, repeat: 1,
      onComplete: () => s.setAngle(0),
    });
  }
}
