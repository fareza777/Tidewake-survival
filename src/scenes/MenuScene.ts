import { BaseScene } from './BaseScene';
import { t } from '@/core/i18n';
import { Rng } from '@/core/rng';
import { services } from '@/core/services';
import { iconOf } from '@/ui/icons';
import { COLORS, FONT } from '@/ui/theme';
import { confirm, showModal } from '@/ui/modal';
import { Button, label, toast } from '@/ui/widgets';

export const GAME_VERSION = '1.3.2';

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
    // Stars that twinkle each in their own time.
    for (let i = 0; i < 46; i++) {
      const size = rng.chance(0.2) ? 2 : 1;
      const star = this.add.rectangle(Math.round(rng.float(4, W - 4)), Math.round(rng.float(8, H * 0.4)), size, size, 0xffffff, rng.float(0.35, 0.9)).setOrigin(0, 0);
      this.tweens.add({ targets: star, alpha: 0.08, duration: rng.int(700, 2600), delay: rng.int(0, 2000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    const moonGlow = this.add.image(W - 56, H * 0.1, 'fx_light').setTint(0xdfe8ff).setBlendMode('ADD').setAlpha(0.35).setDisplaySize(90, 90);
    this.tweens.add({ targets: moonGlow, alpha: 0.18, duration: 3200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add.circle(W - 56, H * 0.1, 15, 0xf4f0d0, 0.95);
    this.add.circle(W - 50, H * 0.1 - 3, 13, 0x0d3a5c, 0.55);
    this.driftClouds(rng);
    this.shootingStars();
    const ground = Math.round(H * 0.84);
    const sand = this.add.graphics();
    sand.fillStyle(0xb99a5a, 1);
    sand.fillRect(0, ground, W, H - ground);
    sand.fillStyle(0xd8bb78, 1);
    sand.fillRect(0, ground, W, 3);
    for (let i = 0; i < 9; i++) {
      const row = i % 3;
      const wave = this.add.rectangle(rng.float(0, W), ground - 8 - row * 11 - rng.int(0, 4), rng.int(30, 60), 2, 0xbfe6ff, 0.4 - row * 0.09).setOrigin(0.5);
      this.tweens.add({ targets: wave, x: wave.x + rng.int(24, 48), alpha: 0.04, duration: 2000 + row * 450 + rng.int(0, 600), yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: rng.int(0, 1500) });
    }
    // The palms sway in the night breeze, swinging from their roots.
    for (const [x, frame, scale, dy, phase] of [[W * 0.16, 'p/tree_06', 2.4, 6, 0], [W * 0.86, 'p/tree_07', 2.2, 12, 700]] as const) {
      const palm = this.add.image(x, ground + dy, 'props', frame).setOrigin(0.5, 1).setScale(scale);
      this.tweens.add({ targets: palm, angle: { from: -1.6, to: 1.6 }, duration: 2600, delay: phase, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    const glow = this.add.image(W / 2, ground - 14, 'fx_light').setTint(0xffa030).setBlendMode('ADD').setAlpha(0.5).setDisplaySize(150, 110);
    this.tweens.add({ targets: glow, alpha: 0.28, duration: 380, yoyo: true, repeat: -1 });
    this.add.sprite(W / 2, ground + 4, 'props', 'fire/campfire_burning/0').setOrigin(0.5, 1).setScale(2.6).play('fire_campfire_burning');
    this.add.sprite(W / 2 - 38, ground + 6, 'heroes', 'hero1/idle/right/0').setOrigin(0.5, 0.86).setScale(2.6).play('hero1_breath_idle_right');
    this.embers(W / 2, ground - 12);
    this.fireflies(rng, ground);
  }

  /** Slow clouds crossing the sky, lit faintly by the moon. */
  private driftClouds(rng: Rng): void {
    const { W, H } = this;
    for (let i = 0; i < 4; i++) {
      const cloud = this.add.image(rng.float(0, W), H * (0.08 + i * 0.07), 'fx_light').setTint(0x9fb6d8).setAlpha(0.13).setDisplaySize(W * 0.7, 28 + i * 6);
      const speed = 38000 + i * 9000;
      this.tweens.add({ targets: cloud, x: W + W * 0.4, duration: speed * (1 - cloud.x / (W * 1.4)), onComplete: () => {
        cloud.x = -W * 0.4;
        this.tweens.add({ targets: cloud, x: W + W * 0.4, duration: speed, repeat: -1 });
      } });
    }
  }

  /** Now and then a star streaks across the sky. */
  private shootingStars(): void {
    const { W, H } = this;
    this.time.addEvent({
      delay: 4200, loop: true, callback: () => {
        if (Math.random() < 0.4) return;
        const x = Math.random() * W * 0.7 + 10;
        const y = Math.random() * H * 0.18 + 6;
        const streak = this.add.rectangle(x, y, 22, 1, 0xffffff, 0.9).setOrigin(1, 0.5).setAngle(25).setBlendMode('ADD');
        this.tweens.add({ targets: streak, x: x + 90, y: y + 42, alpha: 0, duration: 520, ease: 'Quad.easeIn', onComplete: () => streak.destroy() });
      },
    });
  }

  /** Sparks lifting off the campfire. */
  private embers(x: number, y: number): void {
    this.add.particles(x, y, 'ui_white', {
      x: { min: -6, max: 6 }, lifespan: { min: 900, max: 1700 }, speedY: { min: -46, max: -24 }, speedX: { min: -12, max: 12 },
      scale: { start: 1.6, end: 0.4 }, alpha: { start: 0.95, end: 0 }, tint: [0xffd060, 0xff9a30, 0xff6a20], frequency: 140, blendMode: 'ADD',
    });
  }

  /** A few fireflies drifting over the sand. */
  private fireflies(rng: Rng, ground: number): void {
    const { W } = this;
    for (let i = 0; i < 7; i++) {
      const fly = this.add.circle(rng.float(10, W - 10), ground - rng.float(8, 70), 1.5, 0xe8ff7a, 0).setBlendMode('ADD');
      this.tweens.add({ targets: fly, alpha: { from: 0, to: 0.9 }, duration: rng.int(500, 1100), yoyo: true, repeat: -1, delay: rng.int(0, 2000) });
      this.tweens.add({ targets: fly, x: fly.x + rng.float(-28, 28), y: fly.y + rng.float(-18, 18), duration: rng.int(2400, 4200), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
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
    const bw = Math.min(230, W - 70);
    let y = Math.round(H * 0.46);
    const step = 50;
    const buttons: Button[] = [];
    if (latest !== null) {
      buttons.push(new Button(this, W / 2, y, t('menuContinue'), () => this.goTo('Game', { slot: latest }), { w: bw, h: 42, style: 'primary', icon: iconOf('play', 20) }));
      y += step;
    }
    buttons.push(new Button(this, W / 2, y, t('menuNewGame'), () => this.goTo('NewGame'), { w: bw, h: 42, style: latest === null ? 'primary' : 'normal', icon: latest === null ? iconOf('play', 20) : undefined }));
    y += step;
    const half = Math.floor((bw - 6) / 2);
    buttons.push(new Button(this, W / 2 - half / 2 - 3, y, t('menuSettings'), () => this.goTo('Settings', { back: 'Menu' }), { w: half, h: 38, font: FONT.small, icon: iconOf('gear', 20) }));
    buttons.push(new Button(this, W / 2 + half / 2 + 3, y, t('menuAbout'), () => this.goTo('About'), { w: half, h: 38, font: FONT.small, icon: iconOf('info', 20) }));
    y += step - 4;
    buttons.push(new Button(this, W / 2 - half / 2 - 3, y, t('menuShare'), () => void this.share(), { w: half, h: 38, font: FONT.small, icon: iconOf('share', 20) }));
    buttons.push(new Button(this, W / 2 + half / 2 + 3, y, t('menuRate'), () => this.rate(), { w: half, h: 38, font: FONT.small, icon: iconOf('star', 20) }));
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
