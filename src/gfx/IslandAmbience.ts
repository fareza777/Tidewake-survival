import Phaser from 'phaser';
import { view } from '@/core/viewport';
import type { IslandId } from '@/sim/world/types';

/** What hangs in the air over each far island: drifting cloud, rising embers, ice glitter, green mist. Drawn over the world, under the buttons. */
export class IslandAmbience {
  private objects: Phaser.GameObjects.GameObject[] = [];

  constructor(private scene: Phaser.Scene, island: IslandId) {
    switch (island) {
      case 'sky': this.sky(); break;
      case 'ember': this.ember(); break;
      case 'frost': this.frost(); break;
      case 'wreck': this.wreck(); break;
      default: break;
    }
  }

  private wash(color: number, alpha: number): void {
    const { w: W, h: H } = view;
    this.objects.push(this.scene.add.rectangle(0, 0, W, H, color, alpha).setOrigin(0, 0).setDepth(1));
  }

  /** Big soft clouds sliding slowly across the screen. */
  private clouds(count: number, tint: number, alpha: number, speed: number): void {
    const { w: W, h: H } = view;
    for (let i = 0; i < count; i++) {
      const w = W * (0.9 + (i % 3) * 0.25);
      const cloud = this.scene.add.image(-w + ((i * 0.37) % 1) * (W + w), H * (0.12 + (i / count) * 0.8), 'fx_light')
        .setTint(tint).setAlpha(alpha).setDisplaySize(w, H * 0.2).setDepth(1);
      const run = (from: number): void => {
        this.scene.tweens.add({
          targets: cloud, x: W + w, duration: speed * ((W + w - from) / (W + 2 * w)), ease: 'Linear',
          onComplete: () => {
            cloud.x = -w;
            run(-w);
          },
        });
      };
      run(cloud.x);
      this.objects.push(cloud);
    }
  }

  private sky(): void {
    this.wash(0xb8a6ff, 0.1);
    this.clouds(6, 0xffffff, 0.2, 52000);
    const { w: W, h: H } = view;
    this.objects.push(this.scene.add.particles(0, 0, 'ui_white', {
      x: { min: 0, max: W }, y: { min: 0, max: H }, lifespan: 2600, speed: { min: 2, max: 8 }, scale: { start: 1.4, end: 0 },
      alpha: { start: 0.7, end: 0 }, tint: [0xffffff, 0xe8d8ff, 0xffe9a8], frequency: 180, blendMode: 'ADD',
    }).setDepth(2));
  }

  private ember(): void {
    this.wash(0xff6a20, 0.05);
    const { w: W, h: H } = view;
    this.objects.push(this.scene.add.particles(0, 0, 'ui_white', {
      x: { min: -10, max: W + 10 }, y: H + 8, lifespan: { min: 2200, max: 3600 }, speedY: { min: -120, max: -60 }, speedX: { min: -20, max: 30 },
      scale: { start: 1.8, end: 0.3 }, alpha: { start: 0.9, end: 0 }, tint: [0xffd060, 0xff9a30, 0xff6a20], frequency: 120, blendMode: 'ADD',
    }).setDepth(2));
  }

  private frost(): void {
    this.wash(0xcfe8ff, 0.07);
    const { w: W, h: H } = view;
    this.objects.push(this.scene.add.particles(0, 0, 'ui_white', {
      x: { min: 0, max: W }, y: { min: 0, max: H }, lifespan: 1600, speed: { min: 1, max: 6 }, scale: { start: 1.6, end: 0 },
      alpha: { start: 0.85, end: 0 }, tint: [0xffffff, 0xbfe6ff], frequency: 140, blendMode: 'ADD',
    }).setDepth(2));
  }

  private wreck(): void {
    this.wash(0x2a6a60, 0.08);
    this.clouds(4, 0x8fd8c0, 0.16, 40000);
  }

  destroy(): void {
    for (const o of this.objects) {
      this.scene.tweens.killTweensOf(o);
      o.destroy();
    }
    this.objects = [];
  }
}
