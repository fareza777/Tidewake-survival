import Phaser from 'phaser';
import { services } from '@/core/services';
import { view } from '@/core/viewport';
import { nine } from '@/ui/skin';
import { COLORS, FONT } from '@/ui/theme';

interface Pending {
  text: string;
  color: number;
}

/** Always-on overlay for toasts (quest updates, new day). Queues messages so they never overlap. */
export class NotifyScene extends Phaser.Scene {
  private queue: Pending[] = [];
  private busy = false;

  constructor() {
    super({ key: 'Notify', active: false });
  }

  create(): void {
    services.notify = (text, color = COLORS.gold) => {
      this.queue.push({ text, color });
      if (!this.busy) this.next();
    };
  }

  /** Toasts sit under the HUD bar while playing and at the very top of menus. */
  private toastY(): number {
    const top = this.game.scene.getScenes(true).filter((sc) => sc !== this).pop();
    return top && (top.scene.key === 'Game' || top.scene.key === 'Hud') ? 58 : 18;
  }

  private next(): void {
    const item = this.queue.shift();
    if (!item) {
      this.busy = false;
      return;
    }
    this.busy = true;
    this.scene.bringToTop();
    const W = view.w;
    const y = this.toastY();
    const txt = this.add.bitmapText(W / 2, y, FONT.body, item.text).setOrigin(0.5).setTint(item.color).setMaxWidth(W - 60).setCenterAlign();
    const bg = nine(this, W / 2, y, 'ui_panel_ornate', Math.min(W - 24, txt.width + 28), txt.height + 14);
    this.children.bringToTop(txt);
    const objs = [bg, txt];
    for (const o of objs) {
      o.setAlpha(0);
      o.y -= 16;
    }
    this.tweens.add({ targets: objs, alpha: 1, y: '+=16', duration: 220, ease: 'Back.easeOut' });
    this.time.delayedCall(2000, () => {
      this.tweens.add({
        targets: objs, alpha: 0, y: '-=12', duration: 220,
        onComplete: () => {
          objs.forEach((o) => o.destroy());
          this.next();
        },
      });
    });
  }
}
