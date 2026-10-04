import { BaseScene } from './BaseScene';
import { t } from '@/core/i18n';
import { Rng } from '@/core/rng';
import { services } from '@/core/services';
import { COLORS, FONT } from '@/ui/theme';
import { confirm, showModal } from '@/ui/modal';
import { Button, label, toast } from '@/ui/widgets';

export const GAME_VERSION = '0.1.0';

/** Main menu: Continue, New Game, Settings, About, Share and Rate. */
export class MenuScene extends BaseScene {
  constructor() {
    super('Menu');
  }

  create(): void {
    this.transitioning = false;
    this.fadeIn(400);
    services.audio?.playMusic('day');
    this.buildBackground();
    this.buildScenery();
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

  /** Night on the beach: stars, a moon, waves, two palms and a hero beside a campfire. */
  private buildScenery(): void {
    const { W, H } = this;
    const rng = new Rng(7);
    const sky = this.add.graphics();
    for (let i = 0; i < 46; i++) {
      sky.fillStyle(0xffffff, rng.float(0.25, 0.9));
      sky.fillRect(Math.round(rng.float(4, W - 4)), Math.round(rng.float(8, H * 0.4)), rng.chance(0.2) ? 2 : 1, rng.chance(0.2) ? 2 : 1);
    }
    this.add.circle(W - 56, H * 0.1, 15, 0xf4f0d0, 0.95);
    this.add.circle(W - 50, H * 0.1 - 3, 13, 0x0d3a5c, 0.55);
    const ground = Math.round(H * 0.84);
    const sand = this.add.graphics();
    sand.fillStyle(0xb99a5a, 1);
    sand.fillRect(0, ground, W, H - ground);
    sand.fillStyle(0xd8bb78, 1);
    sand.fillRect(0, ground, W, 3);
    for (let i = 0; i < 3; i++) {
      const wave = this.add.rectangle(rng.float(0, W), ground - 10 - i * 9, 44, 2, 0xbfe6ff, 0.35 - i * 0.08).setOrigin(0.5);
      this.tweens.add({ targets: wave, x: wave.x + 36, alpha: 0.05, duration: 2400 + i * 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    this.add.image(W * 0.16, ground + 6, 'props', 'p/tree_06').setOrigin(0.5, 1).setScale(2.4);
    this.add.image(W * 0.86, ground + 12, 'props', 'p/tree_07').setOrigin(0.5, 1).setScale(2.2);
    const glow = this.add.image(W / 2, ground - 14, 'fx_light').setTint(0xffa030).setBlendMode('ADD').setAlpha(0.5).setDisplaySize(150, 110);
    this.tweens.add({ targets: glow, alpha: 0.28, duration: 380, yoyo: true, repeat: -1 });
    this.add.sprite(W / 2, ground + 4, 'props', 'fire/campfire_burning/0').setOrigin(0.5, 1).setScale(2.6).play('fire_campfire_burning');
    this.add.image(W / 2 - 38, ground + 6, 'heroes', 'hero1/idle/right/0').setOrigin(0.5, 0.86).setScale(2.6);
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
    let y = Math.round(H * 0.46);
    const step = 40;
    const buttons: Button[] = [];
    if (latest !== null) {
      buttons.push(new Button(this, W / 2, y, t('menuContinue'), () => this.goTo('Game', { slot: latest }), { w: bw, h: 32, style: 'primary' }));
      y += step;
    }
    buttons.push(new Button(this, W / 2, y, t('menuNewGame'), () => this.goTo('NewGame'), { w: bw, h: 32, style: latest === null ? 'primary' : 'normal' }));
    y += step;
    const half = Math.floor((bw - 6) / 2);
    buttons.push(new Button(this, W / 2 - half / 2 - 3, y, t('menuSettings'), () => this.goTo('Settings', { back: 'Menu' }), { w: half, h: 28, font: FONT.small }));
    buttons.push(new Button(this, W / 2 + half / 2 + 3, y, t('menuAbout'), () => this.goTo('About'), { w: half, h: 28, font: FONT.small }));
    y += step - 6;
    buttons.push(new Button(this, W / 2 - half / 2 - 3, y, t('menuShare'), () => void this.share(), { w: half, h: 28, font: FONT.small }));
    buttons.push(new Button(this, W / 2 + half / 2 + 3, y, t('menuRate'), () => this.rate(), { w: half, h: 28, font: FONT.small }));
    buttons.forEach((b, i) => {
      b.setAlpha(0);
      b.y += 10;
      this.tweens.add({ targets: b, alpha: 1, y: b.y - 10, delay: 250 + i * 70, duration: 300, ease: 'Back.easeOut' });
    });
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
