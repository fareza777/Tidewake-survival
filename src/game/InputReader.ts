import Phaser from 'phaser';
import { controls, takeAction } from '@/game/input';
import type { Vec } from '@/sim/movement';

/** Keyboard (for desktop testing) and the touch controls, read once per frame by the island scene. */
export class InputReader {
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: Record<'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
  private actionKeys: Phaser.Input.Keyboard.Key[] = [];
  private digitKeys: Phaser.Input.Keyboard.Key[] = [];
  private shift?: Phaser.Input.Keyboard.Key;

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (!kb) return;
    this.cursors = kb.createCursorKeys();
    this.wasd = kb.addKeys({ w: 'W', a: 'A', s: 'S', d: 'D' }) as Record<'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
    this.shift = kb.addKey('SHIFT');
    this.actionKeys = [kb.addKey('SPACE'), kb.addKey('E')];
    this.digitKeys = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT'].map((k) => kb.addKey(k));
  }

  /** Walking direction from the keys and the joystick, capped at length 1. */
  move(): Vec {
    let x = controls.moveX;
    let y = controls.moveY;
    if (this.cursors && this.wasd) {
      if (this.cursors.left.isDown || this.wasd.a.isDown) x -= 1;
      if (this.cursors.right.isDown || this.wasd.d.isDown) x += 1;
      if (this.cursors.up.isDown || this.wasd.w.isDown) y -= 1;
      if (this.cursors.down.isDown || this.wasd.s.isDown) y += 1;
    }
    const len = Math.hypot(x, y);
    return len > 1 ? { x: x / len, y: y / len } : { x, y };
  }

  /** Run is wanted: the on-screen toggle is on, or Shift is held. */
  running(): boolean {
    return controls.run || this.shift?.isDown === true;
  }

  /** True once per press of ACTION (the key or the on-screen button). */
  actionPressed(): boolean {
    const fromKeys = this.actionKeys.some((k) => Phaser.Input.Keyboard.JustDown(k));
    return takeAction() || fromKeys;
  }

  /** The hotbar slot whose number key was just pressed, or -1. */
  slotPressed(): number {
    return this.digitKeys.findIndex((k) => Phaser.Input.Keyboard.JustDown(k));
  }
}
