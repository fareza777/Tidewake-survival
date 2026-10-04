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

/** A picture of the speaker: a frame of a sprite atlas. */
export interface Portrait {
  atlas: string;
  frame: string;
}

export interface DialogueData {
  /** Name of who is speaking, or null for a narrator. Already translated. */
  speaker: string | null;
  /** Already translated; shown one after another, a tap moves on. */
  lines: readonly string[];
  /** Offered after the last line (otherwise a tap closes the dialogue). */
  choices?: readonly DialogueChoice[];
  portrait?: Portrait;
}

const BOX_H = 150;
const PORTRAIT_R = 30;
/** Milliseconds between two letters of the line being typed out. */
const TYPE_MS = 18;

/** Someone speaking at the bottom of the screen, their face in a round frame; the island waits (paused) while it is open. */
export class DialogueScene extends BaseScene {
  private data_!: DialogueData;
  private index = 0;
  private ui!: Phaser.GameObjects.Container;
  private closing = false;
  private typer?: Phaser.Time.TimerEvent;
  private finishTyping: (() => void) | null = null;
  private nudges: Phaser.Tweens.Tween[] = [];

  constructor() {
    super('Dialogue');
  }

  create(data: DialogueData): void {
    this.data_ = data;
    this.index = 0;
    this.closing = false;
    this.transitioning = false;
    this.finishTyping = null;
    this.nudges = [];
    this.ui = this.add.container(0, 0);
    this.handleBack(() => {
      this.advance();
      return true;
    });
    this.input.on('pointerup', () => this.advance());
    this.draw();
    this.ui.setAlpha(0).setY(14);
    this.tweens.add({ targets: this.ui, alpha: 1, y: 0, duration: 170, ease: 'Cubic.easeOut' });
  }

  private draw(): void {
    this.typer?.remove();
    this.nudges.forEach((n) => n.stop());
    this.nudges = [];
    this.ui.removeAll(true);
    const { w: W, h: H } = view;
    const top = H - BOX_H - 12;
    const last = this.index >= this.data_.lines.length - 1;
    const choices = last ? this.data_.choices ?? [] : [];
    const portrait = this.data_.portrait;
    const veil = this.add.graphics();
    veil.fillGradientStyle(COLORS.bg0, COLORS.bg0, COLORS.bg0, COLORS.bg0, 0, 0, 0.55, 0.55);
    veil.fillRect(0, H * 0.45, W, H * 0.55);
    const catcher = this.add.rectangle(0, 0, W, H, 0x000000, 0.001).setOrigin(0, 0).setInteractive();
    this.ui.add([catcher, veil]);
    const box = panel(this, 8, top, W - 16, BOX_H, 'ui_panel_ornate');
    this.ui.add(box);
    if (portrait) this.drawPortrait(48, top + 2, portrait);
    if (this.data_.speaker) {
      const nameX = portrait ? 90 : 22;
      this.ui.add(label(this, nameX, top + (portrait ? 14 : 10), this.data_.speaker, FONT.body, COLORS.gold));
      if (portrait) this.ui.add(this.add.rectangle(nameX, top + 31, W - nameX - 24, 1, COLORS.gold, 0.35).setOrigin(0, 0));
    }
    const bodyY = top + (portrait ? 42 : this.data_.speaker ? 30 : 16);
    this.type(22, bodyY, W - 44, this.data_.lines[this.index] ?? '', () => this.finishLine(top, choices));
  }

  /** The round frame with the speaker's picture, hanging over the top edge of the box. */
  private drawPortrait(cx: number, cy: number, portrait: Portrait): void {
    const ring = this.add.graphics();
    ring.fillStyle(0x07060d, 0.55).fillCircle(cx + 1, cy + 3, PORTRAIT_R + 2);
    ring.fillStyle(0x221c3e, 1).fillCircle(cx, cy, PORTRAIT_R);
    ring.fillStyle(0x3a3266, 1).fillCircle(cx, cy - 4, PORTRAIT_R - 5);
    ring.lineStyle(2, COLORS.gold, 1).strokeCircle(cx, cy, PORTRAIT_R);
    ring.lineStyle(1, 0xffffff, 0.25).strokeCircle(cx, cy, PORTRAIT_R - 3);
    const face = this.add.image(cx, cy + 22, portrait.atlas, portrait.frame).setOrigin(0.5, 1).setScale(2.4);
    this.ui.add([ring, face]);
  }

  /** Types a line out letter by letter; a tap while it types shows the rest at once. */
  private type(x: number, y: number, width: number, text: string, done: () => void): void {
    const body = para(this, x, y, text, width, FONT.body, COLORS.text);
    const wrapped = body.getTextBounds().wrappedText || text;
    this.ui.add(body);
    let shown = 0;
    const finish = (): void => {
      this.typer?.remove();
      this.finishTyping = null;
      body.setText(wrapped);
      done();
    };
    body.setText('');
    this.finishTyping = finish;
    this.typer = this.time.addEvent({
      delay: TYPE_MS,
      loop: true,
      callback: () => {
        shown += 1;
        if (shown >= wrapped.length) finish();
        else body.setText(wrapped.slice(0, shown));
      },
    });
  }

  /** The line is fully shown: offer the choices, or a nudge to tap on. */
  private finishLine(top: number, choices: readonly DialogueChoice[]): void {
    const { w: W } = view;
    if (choices.length === 0) {
      const hint = label(this, W - 38, top + BOX_H - 12, t('talkContinue'), FONT.small, COLORS.textDim, 1, 1);
      const arrow = this.add.triangle(W - 28, top + BOX_H - 19, 0, 0, 10, 0, 5, 7, COLORS.gold).setOrigin(0.5);
      this.ui.add([hint, arrow]);
      this.nudges.push(this.tweens.add({ targets: arrow, y: arrow.y + 3, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
      this.nudges.push(this.tweens.add({ targets: hint, alpha: 0.45, duration: 700, yoyo: true, repeat: -1 }));
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
    if (this.finishTyping) {
      this.finishTyping();
      return;
    }
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
    this.typer?.remove();
    this.scene.stop();
    this.scene.resume('Game');
    after?.();
  }
}
