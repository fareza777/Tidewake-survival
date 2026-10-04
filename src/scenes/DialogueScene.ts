import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { t } from '@/core/i18n';
import { view } from '@/core/viewport';
import { COLORS, FONT } from '@/ui/theme';
import { Button, label, panel, para } from '@/ui/widgets';

export interface DialogueChoice {
  label: string;
  /** Runs after the dialogue has closed. */
  onPick: () => void;
  style?: 'normal' | 'primary';
}

export interface DialogueData {
  /** Name of who is speaking, or null for a narrator. Already translated. */
  speaker: string | null;
  /** Already translated; shown one after another, a tap moves on. */
  lines: readonly string[];
  /** Offered after the last line (otherwise a tap closes the dialogue). */
  choices?: readonly DialogueChoice[];
}

const BOX_H = 150;

/** A box at the bottom of the screen with someone speaking. The island waits (paused) while it is open. */
export class DialogueScene extends BaseScene {
  private data_!: DialogueData;
  private index = 0;
  private ui!: Phaser.GameObjects.Container;
  private closing = false;

  constructor() {
    super('Dialogue');
  }

  create(data: DialogueData): void {
    this.data_ = data;
    this.index = 0;
    this.closing = false;
    this.transitioning = false;
    this.ui = this.add.container(0, 0);
    this.handleBack(() => {
      this.advance();
      return true;
    });
    this.input.on('pointerup', () => this.advance());
    this.draw();
  }

  private draw(): void {
    this.ui.removeAll(true);
    const { w: W, h: H } = view;
    const top = H - BOX_H - 12;
    const last = this.index >= this.data_.lines.length - 1;
    const choices = last ? this.data_.choices ?? [] : [];
    const shade = this.add.rectangle(0, 0, W, H, COLORS.bg0, 0.35).setOrigin(0, 0).setInteractive();
    this.ui.add(shade);
    this.ui.add(panel(this, 8, top, W - 16, BOX_H, 'ui_panel_ornate'));
    if (this.data_.speaker) this.ui.add(label(this, 22, top + 10, this.data_.speaker, FONT.body, COLORS.gold));
    const bodyY = top + (this.data_.speaker ? 30 : 16);
    this.ui.add(para(this, 22, bodyY, this.data_.lines[this.index] ?? '', W - 44, FONT.body, COLORS.text));
    if (choices.length === 0) {
      this.ui.add(label(this, W - 22, top + BOX_H - 12, t('talkContinue'), FONT.small, COLORS.textDim, 1, 1));
      return;
    }
    const bw = Math.min(W - 44, 260);
    choices.forEach((c, i) => {
      const y = top + BOX_H - 14 - (choices.length - 1 - i) * 30;
      this.ui.add(new Button(this, W / 2, y, c.label, () => this.close(c.onPick), { w: bw, h: 26, style: c.style ?? 'normal', font: FONT.small }).setDepth(2));
    });
  }

  private advance(): void {
    if (this.closing) return;
    const choices = this.data_.choices ?? [];
    if (this.index < this.data_.lines.length - 1) {
      this.index += 1;
      this.draw();
    } else if (choices.length === 0) {
      this.close();
    }
  }

  private close(after?: () => void): void {
    if (this.closing) return;
    this.closing = true;
    this.scene.stop();
    this.scene.resume('Game');
    after?.();
  }
}
