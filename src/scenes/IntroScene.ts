import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import type { GameInit } from './GameScene';
import { t } from '@/core/i18n';
import { COLORS, FONT } from '@/ui/theme';
import { Button, label } from '@/ui/widgets';

const LINES = ['intro1', 'intro2', 'intro3'] as const;
/** Seconds a line stays before the next one comes by itself. */
const LINE_SECONDS = 3;

/** A few lines over a dark sea before a new adventure begins. A tap moves on, Skip goes straight to the game. */
export class IntroScene extends BaseScene {
  private init_!: GameInit;
  private index = 0;
  private text!: Phaser.GameObjects.BitmapText;
  private timer?: Phaser.Time.TimerEvent;

  constructor() {
    super('Intro');
  }

  create(data: GameInit): void {
    this.init_ = data;
    this.index = -1;
    this.transitioning = false;
    this.cameras.main.setBackgroundColor(0x050f1c);
    this.fadeIn(400);
    const { W, H } = this;
    const sea = this.add.graphics();
    sea.fillGradientStyle(0x0d3a5c, 0x0d3a5c, 0x050f1c, 0x050f1c, 1);
    sea.fillRect(0, 0, W, H);
    this.text = label(this, W / 2, H / 2, '', FONT.head, COLORS.text, 0.5, 0.5).setMaxWidth(W - 60).setCenterAlign().setAlpha(0);
    new Button(this, W - 44, 26, t('introSkip'), () => this.finish(), { w: 72, h: 26, font: FONT.small });
    this.input.on('pointerup', (_p: unknown, over: unknown[]) => {
      if (over.length === 0) this.next();
    });
    this.handleBack(() => {
      this.finish();
      return true;
    });
    this.next();
  }

  private next(): void {
    this.timer?.remove();
    this.index += 1;
    if (this.index >= LINES.length) {
      this.finish();
      return;
    }
    this.text.setText(t(LINES[this.index])).setAlpha(0);
    this.tweens.add({ targets: this.text, alpha: 1, duration: 500 });
    this.timer = this.time.delayedCall(LINE_SECONDS * 1000, () => this.next());
  }

  private finish(): void {
    this.goTo('Game', this.init_);
  }
}
