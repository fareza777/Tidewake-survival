import Phaser from 'phaser';
import { LANDMARK_PROPS } from '@/data/landmarkProps';
import { resourceFrame } from '@/data/resources';
import { TILE } from '@/gfx/TerrainLayer';
import type { ResourceKind, World } from '@/sim/world/types';

/**
 * Sprites for every resource node and landmark prop. Objects are y-sorted by their base line (depth = world y of the
 * feet), so the player walks behind trees that are further south. Phaser culls the ones off screen.
 */
/** Width (world pixels) of the soft ground shadow under each kind of node. */
const SHADOW_WIDTH: Record<ResourceKind, number> = {
  tree: 46, palm: 30, bush: 26, rock: 28, ore: 28, crystal: 24, swamptree: 46, redrock: 26, mithril: 26,
};

export class WorldObjects {
  private sprites = new Map<number, Phaser.GameObjects.Image>();
  private shadows = new Map<number, Phaser.GameObjects.Image>();
  private kinds = new Map<number, ResourceKind>();

  constructor(private scene: Phaser.Scene, world: World) {
    for (const n of world.resources) {
      const x = (n.x + 0.5) * TILE;
      const y = (n.y + 1) * TILE - 1;
      const img = scene.add.image(x, y, 'props', resourceFrame(n.kind, n.variant)).setOrigin(0.5, 1).setDepth(y);
      this.sprites.set(n.id, img);
      this.kinds.set(n.id, n.kind);
      const w = SHADOW_WIDTH[n.kind];
      this.shadows.set(n.id, scene.add.image(x, y - 1, 'fx_shadow_soft').setDisplaySize(w, w * 0.38).setDepth(-70));
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
    const shadow = this.shadows.get(id);
    this.scene.tweens.killTweensOf(s);
    s.setAngle(0);
    shadow?.setVisible(alive);
    if (alive) {
      s.setVisible(true).setAlpha(1).setScale(1);
      return;
    }
    if (!animate) {
      s.setVisible(false);
      return;
    }
    const kind = this.kinds.get(id);
    if (kind === 'tree' || kind === 'palm' || kind === 'swamptree' || kind === 'bush') {
      // Plants topple over, away from one side, and fade as they land.
      const side = Math.random() < 0.5 ? -1 : 1;
      shadow?.setVisible(true);
      this.scene.tweens.add({ targets: s, angle: side * 84, y: s.y + 2, duration: 420, delay: 110, ease: 'Cubic.easeIn' });
      this.scene.tweens.add({
        targets: s, alpha: 0, duration: 180, delay: 480,
        onComplete: () => {
          s.setVisible(false).setAngle(0).setY(s.y - 2);
          shadow?.setVisible(false);
        },
      });
      if (shadow) this.scene.tweens.add({ targets: shadow, alpha: 0, duration: 420, delay: 110, onComplete: () => shadow.setAlpha(1) });
      return;
    }
    // Rocks and ore crumble: they sink a little and shrink away.
    this.scene.tweens.add({
      targets: s, alpha: 0, scaleX: 0.7, scaleY: 0.45, duration: 240, delay: 110, ease: 'Quad.easeIn',
      onComplete: () => s.setVisible(false),
    });
  }

  /** Quick sway when a node is hit. */
  shake(id: number): void {
    const s = this.sprites.get(id);
    if (!s) return;
    this.scene.tweens.killTweensOf(s);
    s.setAngle(0).setScale(1);
    // A damped sway: the plant rocks one way, the other, and settles, with a squash as the blow lands (timed with the tool).
    const rock = this.kinds.get(id) === 'rock' || this.kinds.get(id) === 'ore' || this.kinds.get(id) === 'crystal' || this.kinds.get(id) === 'redrock';
    const amp = rock ? 0 : 5;
    this.scene.tweens.add({ targets: s, scaleX: 1.07, scaleY: 0.93, duration: 60, delay: 110, yoyo: true, ease: 'Quad.easeOut', onComplete: () => s.setScale(1) });
    if (amp > 0) {
      this.scene.tweens.chain({
        targets: s,
        tweens: [amp, -amp * 0.75, amp * 0.5, -amp * 0.3, amp * 0.15, 0].map((angle, i) => ({
          angle, duration: 70 + i * 12, ease: 'Sine.easeInOut', delay: i === 0 ? 110 : 0,
        })),
      });
    }
  }
}
