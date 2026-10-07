import Phaser from 'phaser';
import { snapWorld } from '@/core/viewport';
import { ITEMS, type ItemId } from '@/data/items';
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

/** How fast the sword animation of the sprite pack plays (its own pace is 16 frames a second): a quick, snappy blow. */
const SLASH_SPEED = 1.35;
/** Hand position of a held tool relative to the feet, per direction, and how it swings (degrees: raised back, then through). */
const HAND: Record<Dir, { x: number; y: number; wind: number; strike: number; flip: boolean; front: boolean }> = {
  right: { x: 5, y: -10, wind: -95, strike: 45, flip: false, front: true },
  left: { x: -5, y: -10, wind: -95, strike: 45, flip: true, front: true },
  down: { x: 6, y: -9, wind: -110, strike: 60, flip: false, front: true },
  up: { x: 5, y: -12, wind: -80, strike: 40, flip: false, front: false },
};
/** Seconds between two puffs of dust while running. */
const DUST_EVERY = 0.13;

export class Player {
  readonly sprite: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private dir: Dir = 'down';
  private pose: Pose | null = 'idle';
  private lunge = { x: 0, y: 0 };
  private tool?: Phaser.GameObjects.Image;
  private dustIn = 0;
  /** Seconds left in which a blow cannot hurt him. */
  private safeFor = 0;
  /** The sword animation is playing; walking poses wait until it is over. */
  private slashing = false;

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
    const group = this.pose === 'idle' || this.pose === null ? 'breath_idle' : this.pose;
    return `hero${this.skin}_${group}_${this.dir}`;
  }

  /** Put the hero at a position given in tile units. Depth follows the feet so trees sort correctly. */
  private place(pos: Vec): void {
    const px = snapWorld(pos.x * TILE + this.lunge.x);
    const py = snapWorld(pos.y * TILE + this.lunge.y);
    this.sprite.setPosition(px, py).setDepth(py);
    this.shadow.setPosition(px, py - 1).setDepth(py - 1);
  }

  /** Move to `pos`, facing along the stick and animating at the pace he really moves (slow steps when he eases in or out). */
  update(pos: Vec, move: Vec, gait: Gait, dt: number): void {
    const pose: Pose = gait.pace < 0.12 ? 'idle' : gait.running ? 'run' : 'walk';
    const dir = dirFromVector(move.x, move.y, this.dir);
    if (this.slashing) {
      // He keeps the way he faces while the blade sweeps.
    } else if (pose !== this.pose || dir !== this.dir) {
      this.pose = pose;
      this.dir = dir;
      this.sprite.play(this.animKey(), true);
    }
    if (!this.slashing) this.sprite.anims.timeScale = pose === 'idle' ? 1 : Math.min(1.35, Math.max(0.6, gait.pace * (pose === 'run' ? 0.7 : 1)));
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

  /**
   * The hero uses what he holds. A sword or spear plays the sword animation of the sprite pack (the hero swings his blade
   * and a white crescent sweeps round him); a tool (axe, pickaxe, hoe...) shows in his hand and chops through; with
   * nothing in hand he just jabs.
   */
  swing(item: ItemId | null): void {
    const type = item ? ITEMS[item].tool?.type : undefined;
    if (item && (type === 'sword' || type === 'spear')) this.slash();
    else if (item && type && type !== 'bow') this.swingTool(item);
    else this.punch();
  }

  /** The sword blow: the pack's own attack animation, with the body leaning into it. */
  private slash(): void {
    const key = `hero${this.skin}_attack_${this.dir}`;
    if (!this.scene.anims.exists(key)) {
      this.punch();
      return;
    }
    this.tool?.destroy();
    this.tool = undefined;
    this.slashing = true;
    this.sprite.setScale(1);
    this.sprite.play(key, true);
    this.sprite.anims.timeScale = SLASH_SPEED;
    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.slashing = false;
      this.sprite.anims.timeScale = 1;
      this.sprite.play(this.animKey(), true);
    });
    const k = 3;
    const push = this.dir === 'left' ? [-k, 0] : this.dir === 'right' ? [k, 0] : this.dir === 'up' ? [0, -k] : [0, k];
    this.scene.tweens.killTweensOf(this.lunge);
    this.lunge.x = 0;
    this.lunge.y = 0;
    this.scene.tweens.add({ targets: this.lunge, x: push[0], y: push[1], duration: 90, delay: 60, yoyo: true, ease: 'Quad.easeOut' });
  }

  /** The held tool appears in his hand, is raised behind the shoulder and brought down through the target. */
  private swingTool(item: ItemId): void {
    const blade = false;
    const icon = ITEMS[item].icon;
    const hand = HAND[this.dir];
    this.tool?.destroy();
    const wind = hand.wind;
    const strike = hand.strike;
    const img = this.scene.add.image(this.sprite.x + hand.x, this.sprite.y + hand.y, icon.atlas, icon.frame)
      .setOrigin(0.14, 0.86).setFlipX(hand.flip).setScale(blade ? 1.05 : 0.95)
      .setDepth(this.sprite.depth + (hand.front ? 0.5 : -0.5));
    const sign = hand.flip ? -1 : 1;
    const windMs = blade ? 55 : 70;
    const strikeMs = blade ? 65 : 80;
    img.setAngle(sign * wind * 0.6);
    this.tool = img;
    this.scene.tweens.add({ targets: img, angle: sign * wind, duration: windMs, ease: 'Quad.easeOut' });
    this.scene.tweens.add({
      targets: img, angle: sign * strike, duration: strikeMs, delay: windMs, ease: 'Cubic.easeIn',
      onComplete: () => {
        this.scene.tweens.add({
          targets: img, alpha: 0, duration: 140, delay: 80,
          onComplete: () => {
            img.destroy();
            if (this.tool === img) this.tool = undefined;
          },
        });
      },
    });
    // The body leans into the blow.
    const k = blade ? 3 : 2;
    const push = this.dir === 'left' ? [-k, 0] : this.dir === 'right' ? [k, 0] : this.dir === 'up' ? [0, -k] : [0, k];
    this.scene.tweens.killTweensOf(this.lunge);
    this.lunge.x = 0;
    this.lunge.y = 0;
    this.scene.tweens.add({ targets: this.lunge, x: push[0], y: push[1], duration: strikeMs, delay: windMs, yoyo: true, ease: 'Quad.easeOut' });
    this.punch();
  }

  /** Where the held tool lands when it strikes (world pixels), for the chips that fly off. */
  strikePoint(): { x: number; y: number } {
    const hand = HAND[this.dir];
    const reach = this.dir === 'left' ? -9 : this.dir === 'right' ? 9 : 0;
    return { x: this.sprite.x + hand.x + reach, y: this.sprite.y + (this.dir === 'down' ? 2 : this.dir === 'up' ? -16 : -6) };
  }

  /** Turn toward (dx, dy) without moving (used to face the thing being hit). */
  face(dx: number, dy: number): void {
    this.slashing = false;
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
