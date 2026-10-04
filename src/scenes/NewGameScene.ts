import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import type { GameInit } from './GameScene';
import { t } from '@/core/i18n';
import { DEFAULT_NAME, cleanName, seedFromInput } from '@/core/newGame';
import { Rng, seedToCode } from '@/core/rng';
import { SLOT_COUNT } from '@/core/save';
import { services } from '@/core/services';
import type { Difficulty } from '@/sim/vitals';
import { COLORS, FONT } from '@/ui/theme';
import { Button, label, panel, para } from '@/ui/widgets';
import { confirm } from '@/ui/modal';

const DIFFICULTIES: readonly Difficulty[] = ['relaxed', 'normal', 'hardcore'];

/** One screen for everything about a new adventure: the save slot, the hero's name, the world seed and the difficulty. */
export class NewGameScene extends BaseScene {
  private slot = 0;
  private name = DEFAULT_NAME;
  private seedText = '';
  private difficulty: Difficulty = 'normal';
  private ui!: Phaser.GameObjects.Container;

  constructor() {
    super('NewGame');
  }

  create(): void {
    this.transitioning = false;
    this.slot = services.saves?.slotForNewGame().slot ?? 0;
    this.name = DEFAULT_NAME;
    this.seedText = '';
    this.difficulty = 'normal';
    this.cameras.main.setBackgroundColor(COLORS.bg0);
    this.fadeIn(250);
    this.ui = this.add.container(0, 0);
    this.handleBack(() => {
      this.goTo('Menu');
      return true;
    });
    this.render();
  }

  /** Ask for a line of text with the platform's own dialog; null when it was cancelled or is not available. */
  private ask(message: string, current: string): string | null {
    try {
      return window.prompt(message, current);
    } catch {
      return null;
    }
  }

  private begin(): void {
    const init: GameInit = {
      slot: this.slot, seed: seedFromInput(this.seedText, Rng.seedFromTime()), name: cleanName(this.name), difficulty: this.difficulty,
    };
    this.goTo('Intro', init);
  }

  private start(): void {
    const old = services.saves?.list()[this.slot] ?? null;
    if (old) confirm(this, t('ngTitle'), t('newGameConfirm', { name: old.name, day: old.day }), () => this.begin(), true);
    else this.begin();
  }

  private render(): void {
    this.ui.removeAll(true);
    const { W, H } = this;
    const bw = Math.min(W - 40, 280);
    this.ui.add(panel(this, 6, 6, W - 12, H - 12, 'ui_panel_dark'));
    this.ui.add(label(this, W / 2, 24, t('ngTitle'), FONT.head, COLORS.gold, 0.5, 0.5));
    let y = 48;
    this.ui.add(label(this, 18, y, t('ngSlot'), FONT.small, COLORS.textDim));
    y += 14;
    const list = services.saves?.list() ?? [];
    for (let i = 0; i < SLOT_COUNT; i++) {
      const s = list[i];
      const caption = s ? t('ngSlotUsed', { n: i + 1, name: s.name, day: s.day }) : t('ngSlotEmpty', { n: i + 1 });
      this.ui.add(new Button(this, W / 2, y + 13, caption, () => { this.slot = i; this.render(); }, { w: bw, h: 26, font: FONT.small, style: this.slot === i ? 'primary' : 'normal' }));
      y += 30;
    }
    y += 6;
    this.ui.add(label(this, 18, y, t('ngName'), FONT.small, COLORS.textDim));
    y += 14;
    this.ui.add(new Button(this, W / 2, y + 13, cleanName(this.name), () => {
      const next = this.ask(t('ngNamePrompt'), cleanName(this.name));
      if (next !== null) this.name = next;
      this.render();
    }, { w: bw, h: 26 }));
    y += 36;
    this.ui.add(label(this, 18, y, t('ngSeed'), FONT.small, COLORS.textDim));
    y += 14;
    const seedShown = this.seedText.trim() === '' ? t('ngSeedRandom') : seedToCode(seedFromInput(this.seedText, 0));
    this.ui.add(new Button(this, W / 2, y + 13, seedShown, () => {
      const next = this.ask(t('ngSeedPrompt'), this.seedText);
      if (next !== null) this.seedText = next;
      this.render();
    }, { w: bw, h: 26 }));
    y += 36;
    this.ui.add(label(this, 18, y, t('ngDifficulty'), FONT.small, COLORS.textDim));
    y += 14;
    const dw = Math.floor((bw - 8) / 3);
    DIFFICULTIES.forEach((d, i) => {
      this.ui.add(new Button(this, W / 2 + (i - 1) * (dw + 4), y + 13, t(`diff_${d}`), () => { this.difficulty = d; this.render(); }, { w: dw, h: 26, font: FONT.small, style: this.difficulty === d ? 'primary' : 'normal' }));
    });
    y += 34;
    this.ui.add(para(this, 18, y, t(`diffDesc_${this.difficulty}`), W - 36, FONT.small, COLORS.textDim));
    this.ui.add(new Button(this, W / 2 + 56, H - 30, t('ngStart'), () => this.start(), { w: 120, h: 30, style: 'primary' }));
    this.ui.add(new Button(this, W / 2 - 56, H - 30, t('back'), () => this.goTo('Menu'), { w: 100, h: 30 }));
  }
}
