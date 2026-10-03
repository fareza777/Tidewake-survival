import Phaser from 'phaser';
import { snapWorld } from '@/core/viewport';
import { dirFromVector, type Dir } from '@/gfx/animations';
import { TILE } from '@/gfx/TerrainLayer';
import { HERO_IFRAMES } from '@/sim/combat';
import type { Vec } from '@/sim/movement';

/** Where the hero's feet are inside a 32x32 hero frame (the body spans y 5..25). */
const FEET_Y = 25 / 32;

export class Player {
  readonly sprite: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private dir: Dir = 'down';
  private moving = false;
  /** Seconds left in which a blow cannot hurt him. */
  private safeFor = 0;

  constructor(private scene: Phaser.Scene, pos: Vec, private skin = 1) {
    this.sprite = scene.add.sprite(0, 0, 'heroes', `hero${skin}/idle/down/0`).setOrigin(0.5, FEET_Y);
    this.shadow = scene.add.image(0, 0, 'fx_shadow');
    this.sprite.play(this.animKey());
    this.place(pos);
  }

  get facing(): Dir {
    return this.dir;
  }

  private animKey(): string {
    return `hero${this.skin}_${this.moving ? 'walk' : 'idle'}_${this.dir}`;
  }

  /** Put the hero at a position given in tile units. Depth follows the feet so trees sort correctly. */
  private place(pos: Vec): void {
    const px = snapWorld(pos.x * TILE);
    const py = snapWorld(pos.y * TILE);
    this.sprite.setPosition(px, py).setDepth(py);
    this.shadow.setPosition(px, py - 1).setDepth(py - 1);
  }

  /** Move to `pos`, facing and animating according to the movement vector. */
  update(pos: Vec, move: Vec): void {
    const moving = Math.hypot(move.x, move.y) > 0.05;
    const dir = dirFromVector(move.x, move.y, this.dir);
    if (moving !== this.moving || dir !== this.dir) {
      this.moving = moving;
      this.dir = dir;
      this.sprite.play(this.animKey(), true);
    }
    this.place(pos);
  }

  /** Turn toward (dx, dy) without moving (used to face the thing being hit). */
  face(dx: number, dy: number): void {
    this.dir = dirFromVector(dx, dy, this.dir);
    this.sprite.play(this.animKey(), true);
  }

  get vulnerable(): boolean {
    return this.safeFor === 0;
  }

  /** A monster landed a blow: flash red and become safe for a moment. */
  hurt(): void {
    this.safeFor = HERO_IFRAMES;
    this.sprite.setTintFill(0xff4444);
    this.scene.time.delayedCall(110, () => this.sprite.clearTint());
  }

  /** Count down the moment of safety; the hero blinks while it lasts. */
  tick(dt: number): void {
    this.safeFor = Math.max(0, this.safeFor - dt);
    this.sprite.setAlpha(this.safeFor > 0 && Math.floor(this.safeFor * 16) % 2 === 0 ? 0.45 : 1);
  }

  /** Back to normal after waking up. */
  recover(): void {
    this.safeFor = 0;
    this.sprite.setAlpha(1).clearTint();
  }

  /** Short squash used as feedback for a hit. */
  punch(): void {
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.setScale(1);
    this.scene.tweens.add({ targets: this.sprite, scaleX: 1.14, scaleY: 0.88, duration: 70, yoyo: true });
  }
}
