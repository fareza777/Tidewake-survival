import Phaser from 'phaser';
import { COLORS, FONT } from '@/ui/theme';

/** Small texts that rise from a spot in the world and fade: picked-up items, damage numbers. */
export class FloatText {
  private row = 0;

  constructor(private scene: Phaser.Scene) {}

  /** Start a new group of texts: the next `show` calls with `stack` begin at the bottom again. */
  newGroup(): void {
    this.row = 0;
  }

  /** `x` and `y` are world pixels. With `stack`, texts shown in the same group sit on top of each other without overlapping. */
  show(x: number, y: number, text: string, color: number = COLORS.gold, stack = false): void {
    const top = stack ? y - this.row++ * 8 : y;
    const label = this.scene.add.bitmapText(x, top, FONT.small, text).setOrigin(0.5).setTint(color).setScale(0.5).setDepth(1_000_000);
    this.scene.tweens.add({ targets: label, y: top - 14, alpha: 0, duration: 900, ease: 'Sine.easeOut', onComplete: () => label.destroy() });
  }
}
