import Phaser from 'phaser';
import { snapWorld } from '@/core/viewport';
import { dirFromVector, type Dir } from '@/gfx/animations';
import { TILE } from '@/gfx/TerrainLayer';
import { HERO_IFRAMES } from '@/sim/combat';
import type { Vec } from '@/sim/movement';

/** Where the hero's feet are inside a 32x32 hero frame (the body spans y 5..25). */
const FEET_Y = 25 / 32;

/** How fast the hero moves (1 = walking pace, about 1.6 = running) and whether he runs. */
export interface Gait {
  pace: number;
  running: boolean;
}

type Pose = 'idle' | 'walk' | 'run';
/** Seconds between two puffs of dust while running. */
const DUST_EVERY = 0.13;

export class Player {
  readonly sprite: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private dir: Dir = 'down';
  private pose: Pose = 'idle';
  private dustIn = 0;
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
    const group = this.pose === 'idle' ? 'breath_idle' : this.pose;
    return `hero${this.skin}_${group}_${this.dir}`;
  }

  /** Put the hero at a position given in tile units. Depth follows the feet so trees sort correctly. */
  private place(pos: Vec): void {
    const px = snapWorld(pos.x * TILE);
    const py = snapWorld(pos.y * TILE);
    this.sprite.setPosition(px, py).setDepth(py);
    this.shadow.setPosition(px, py - 1).setDepth(py - 1);
  }

  /** Move to `pos`, facing along the stick and animating at the pace he really moves (slow steps when he eases in or out). */
  update(pos: Vec, move: Vec, gait: Gait, dt: number): void {
    const pose: Pose = gait.pace < 0.12 ? 'idle' : gait.running ? 'run' : 'walk';
    const dir = dirFromVector(move.x, move.y, this.dir);
    if (pose !== this.pose || dir !== this.dir) {
      this.pose = pose;
      this.dir = dir;
      this.sprite.play(this.animKey(), true);
    }
    this.sprite.anims.timeScale = pose === 'idle' ? 1 : Math.min(1.35, Math.max(0.6, gait.pace * (pose === 'run' ? 0.7 : 1)));
    // A slight lean into a run sideways, and a shadow that follows the stride.
    const lean = pose === 'run' && (dir === 'left' || dir === 'right') ? (dir === 'right' ? 5 : -5) : 0;
    this.sprite.angle += (lean - this.sprite.angle) * Math.min(1, dt * 14);
    this.shadow.setScale(pose === 'idle' ? 1 : 1.1, 1);
    this.place(pos);
    if (pose === 'run') this.dust(dt);
    else this.dustIn = 0;
  }

  /** Little puffs kicked up at the heels while running. */
  private dust(dt: number): void {
    this.dustIn -= dt;
    if (this.dustIn > 0) return;
    this.dustIn = DUST_EVERY;
    const back = this.dir === 'left' ? 4 : this.dir === 'right' ? -4 : 0;
    const puff = this.scene.add.image(this.sprite.x + back, this.sprite.y - 1, 'fx_shadow_soft').setTint(0xe6d8b0).setAlpha(0.55).setDisplaySize(10, 6).setDepth(this.sprite.depth - 0.5);
    this.scene.tweens.add({
      targets: puff, alpha: 0, y: puff.y - 5, displayWidth: 18, displayHeight: 11, duration: 340, ease: 'Sine.easeOut',
      onComplete: () => puff.destroy(),
    });
  }

  /** Turn toward (dx, dy) without moving (used to face the thing being hit). */
  face(dx: number, dy: number): void {
    this.dir = dirFromVector(dx, dy, this.dir);
    this.pose = 'idle';
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
