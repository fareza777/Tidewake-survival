import { BaseScene } from './BaseScene';
import { t } from '@/core/i18n';
import { Rng } from '@/core/rng';
import { services } from '@/core/services';
import { COLORS, FONT } from '@/ui/theme';
import { confirm, showModal } from '@/ui/modal';
import { Button, label, toast } from '@/ui/widgets';

export const GAME_VERSION = '0.1.0';

/** Main menu: Continue / New Game / Share / Rate. Settings and About arrive with the menu polish phase. */
export class MenuScene extends BaseScene {
  constructor() {
    super('Menu');
  }

  create(): void {
    this.transitioning = false;
    this.fadeIn(400);
    this.buildBackground();
    this.buildTitle();
    this.buildButtons();
    label(this, this.W - 6, this.H - 6, t('version', { v: GAME_VERSION }), FONT.small, COLORS.textDim, 1, 1).setAlpha(0.7);
    this.handleBack(() => {
      confirm(this, t('quitConfirm'), '', () => void services.platform?.exitApp());
      return true;
    });
  }

  private buildBackground(): void {
    const { W, H } = this;
    const sea = this.add.graphics();
    sea.fillGradientStyle(0x0d3a5c, 0x0d3a5c, 0x050f1c, 0x050f1c, 1);
    sea.fillRect(0, 0, W, H);
    this.add.image(W / 2, H / 2, 'fx_vignette').setDisplaySize(W * 1.3, H * 1.2).setAlpha(0.9);
  }

  private buildTitle(): void {
    const { W, H } = this;
    const y = Math.round(H * 0.2);
    const glow = this.add.image(W / 2, y + 4, 'fx_light').setTint(0x4fb3e8).setBlendMode('ADD').setAlpha(0.4);
    glow.setDisplaySize(W * 1.2, 120);
    this.tweens.add({ targets: glow, alpha: 0.2, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const title = this.add.bitmapText(W / 2, y, FONT.title, t('gameTitle').toUpperCase()).setOrigin(0.5).setScale(3).setTint(COLORS.gold);
    this.tweens.add({ targets: title, y: y - 3, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    label(this, W / 2, y + 38, t('subtitle').toUpperCase(), FONT.head, 0xbfe6ff, 0.5, 0.5);
  }

  private buildButtons(): void {
    const { W, H } = this;
    const latest = services.saves?.latest() ?? null;
    const bw = Math.min(200, W - 80);
    let y = Math.round(H * 0.52);
    const step = 40;
    const buttons: Button[] = [];
    if (latest !== null) {
      buttons.push(new Button(this, W / 2, y, t('menuContinue'), () => this.goTo('Game', { slot: latest }), { w: bw, h: 32, style: 'primary' }));
      y += step;
    }
    buttons.push(new Button(this, W / 2, y, t('menuNewGame'), () => this.newGame(), { w: bw, h: 32, style: latest === null ? 'primary' : 'normal' }));
    y += step;
    const half = Math.floor((bw - 6) / 2);
    buttons.push(new Button(this, W / 2 - half / 2 - 3, y, t('menuShare'), () => void this.share(), { w: half, h: 28, font: FONT.small }));
    buttons.push(new Button(this, W / 2 + half / 2 + 3, y, t('menuRate'), () => this.rate(), { w: half, h: 28, font: FONT.small }));
    buttons.forEach((b, i) => {
      b.setAlpha(0);
      b.y += 10;
      this.tweens.add({ targets: b, alpha: 1, y: b.y - 10, delay: 250 + i * 70, duration: 300, ease: 'Back.easeOut' });
    });
  }

  private newGame(): void {
    const saves = services.saves;
    if (!saves) return;
    const { slot, overwrites } = saves.slotForNewGame();
    const start = () => this.goTo('Game', { slot, seed: Rng.seedFromTime() });
    if (overwrites) confirm(this, t('menuNewGame'), t('newGameConfirm'), start, true);
    else start();
  }

  private async share(): Promise<void> {
    const ok = await services.platform?.share(t('gameTitle'), t('shareText'));
    if (ok && !services.platform?.native) toast(this, t('ok'));
  }

  private rate(): void {
    showModal(this, t('rateTitle'), t('rateBody'), [
      { label: t('later') },
      { label: t('rateNow'), style: 'primary', onClick: () => void services.platform?.rate() },
    ]);
  }
}
