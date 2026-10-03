import Phaser from 'phaser';
import { controls } from '@/game/input';
import { view, vx, vy } from '@/core/viewport';

/** Thumb travel (virtual px) and the radii where movement starts and reaches full speed. */
const MAX = 34;
const DEAD = 4;
const FULL = 22;
/** The bottom strip belongs to the hotbar; touches there never start the stick. */
const HOTBAR_BAND = 50;

/**
 * Touch joystick for the HUD scene. In floating mode it re-centres on the first touch in the lower-left area and
 * trails the thumb when it slides past the rim, so reversing direction is instant. Writes into `controls`.
 */
export class Joystick {
  private base: Phaser.GameObjects.Image;
  private knob: Phaser.GameObjects.Image;
  private origin: { x: number; y: number };
  private home: { x: number; y: number };
  private pointerId: number | null = null;

  constructor(private scene: Phaser.Scene, private mode: () => 'floating' | 'fixed') {
    const k = view.res;
    Joystick.makeTextures(scene);
    this.home = { x: 70, y: view.h - 110 };
    this.origin = { ...this.home };
    this.base = scene.add.image(this.origin.x, this.origin.y, 'joy_base').setScale(1 / k).setAlpha(0.55).setDepth(10);
    this.knob = scene.add.image(this.origin.x, this.origin.y, 'joy_knob').setScale(1 / k).setAlpha(0.75).setDepth(11);
    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** Drawn at the render scale so the rings stay smooth on high-density screens. */
  private static makeTextures(scene: Phaser.Scene): void {
    if (scene.textures.exists('joy_base')) return;
    const k = view.res;
    const g = scene.make.graphics({}, false);
    g.fillStyle(0x0b0914, 0.45).fillCircle(40 * k, 40 * k, 38 * k);
    g.lineStyle(3 * k, 0x07060d, 0.6).strokeCircle(40 * k, 40 * k, 38 * k);
    g.lineStyle(2 * k, 0xd8d0ff, 0.45).strokeCircle(40 * k, 40 * k, 36 * k);
    g.lineStyle(1 * k, 0xd8d0ff, 0.2).strokeCircle(40 * k, 40 * k, 22 * k);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      g.fillStyle(0xd8d0ff, 0.5).fillCircle((40 + Math.cos(a) * 30) * k, (40 + Math.sin(a) * 30) * k, 1.5 * k);
    }
    g.generateTexture('joy_base', 80 * k, 80 * k);
    g.clear();
    g.fillStyle(0x000000, 0.35).fillCircle(18 * k, 20 * k, 15 * k);
    g.fillStyle(0xe8e2ff, 0.85).fillCircle(18 * k, 18 * k, 15 * k);
    g.fillStyle(0xffffff, 0.9).fillCircle(15 * k, 14 * k, 6 * k);
    g.lineStyle(2 * k, 0x5a5078, 0.9).strokeCircle(18 * k, 18 * k, 15 * k);
    g.generateTexture('joy_knob', 36 * k, 36 * k);
    g.destroy();
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.pointerId !== null) return;
    const x = vx(p);
    const y = vy(p);
    if (x > view.w * 0.6 || y < view.h * 0.35 || y > view.h - HOTBAR_BAND) return;
    // A button (or an open dialog) is under the thumb: leave the touch to it.
    if (this.scene.input.hitTestPointer(p).length > 0) return;
    this.pointerId = p.id;
    if (this.mode() === 'floating') {
      this.origin = { x, y };
      this.base.setPosition(x, y);
    }
    this.base.setAlpha(0.85);
    this.update(p);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (p.id === this.pointerId) this.update(p);
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (p.id !== this.pointerId) return;
    this.pointerId = null;
    controls.moveX = 0;
    controls.moveY = 0;
    if (this.mode() === 'floating') {
      this.origin = { ...this.home };
      this.base.setPosition(this.home.x, this.home.y);
    }
    this.knob.setPosition(this.origin.x, this.origin.y);
    this.base.setAlpha(0.55);
  }

  private update(p: Phaser.Input.Pointer): void {
    let dx = vx(p) - this.origin.x;
    let dy = vy(p) - this.origin.y;
    let d = Math.hypot(dx, dy);
    if (d > MAX && this.mode() === 'floating') {
      const pull = (d - MAX) / d;
      this.origin = { x: this.origin.x + dx * pull, y: this.origin.y + dy * pull };
      this.base.setPosition(this.origin.x, this.origin.y);
      dx -= dx * pull;
      dy -= dy * pull;
      d = MAX;
    }
    const k = d > MAX ? MAX / d : 1;
    this.knob.setPosition(this.origin.x + dx * k, this.origin.y + dy * k);
    if (d < DEAD) {
      controls.moveX = 0;
      controls.moveY = 0;
      return;
    }
    const mag = Math.min(1, (d - DEAD) / (FULL - DEAD));
    controls.moveX = (dx / d) * mag;
    controls.moveY = (dy / d) * mag;
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.onDown, this);
    this.scene.input.off('pointermove', this.onMove, this);
    this.scene.input.off('pointerup', this.onUp, this);
    this.scene.input.off('pointerupoutside', this.onUp, this);
    controls.moveX = 0;
    controls.moveY = 0;
  }
}
