import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { t } from '@/core/i18n';
import { FLAG_ONBOARDED, setFlag } from '@/core/flags';
import { services } from '@/core/services';
import { defaultSettings } from '@/core/settings';
import { commitSettings } from '@/core/settingsApply';
import { browserStorage } from '@/core/storage';
import { nightBackdrop } from '@/ui/backdrop';
import { COLORS, FONT } from '@/ui/theme';
import { Button, label, panel, para } from '@/ui/widgets';

interface Card {
  /** Key of the painted banner (assets/cinematic/onb*.webp). */
  art: string;
  title: string;
  body: string;
}

/** First launch only: choose a language, then three short cards about the game. */
export class OnboardingScene extends BaseScene {
  private step = -1;
  private ui!: Phaser.GameObjects.Container;

  constructor() {
    super('Onboarding');
  }

  preload(): void {
    for (let i = 1; i <= 3; i++) if (!this.textures.exists(`onb${i}`)) this.load.image(`onb${i}`, `assets/cinematic/onb${i}.webp`);
  }

  create(): void {
    this.transitioning = false;
    this.step = -1;
    this.cameras.main.setBackgroundColor(COLORS.bg0);
    nightBackdrop(this);
    this.fadeIn(300);
    this.ui = this.add.container(0, 0);
    this.handleBack(() => {
      if (this.step < 0) return false;
      this.go(this.step - 1);
      return true;
    });
    this.render();
  }

  private cards(): Card[] {
    return [
      { art: 'onb1', title: t('onb1Title'), body: t('onb1Body') },
      { art: 'onb2', title: t('onb2Title'), body: t('onb2Body') },
      { art: 'onb3', title: t('onb3Title'), body: t('onb3Body') },
    ];
  }

  private go(step: number): void {
    this.step = step;
    this.render();
  }

  private chooseLanguage(lang: 'en' | 'id'): void {
    commitSettings({ ...(services.settings ?? defaultSettings(lang)), lang });
    this.go(0);
  }

  private finish(): void {
    setFlag(browserStorage(), FLAG_ONBOARDED);
    this.goTo('Menu');
  }

  private render(): void {
    this.ui.removeAll(true);
    const { W, H } = this;
    if (this.step < 0) {
      this.ui.add(label(this, W / 2, H * 0.28, t('langTitle'), FONT.head, COLORS.gold, 0.5, 0.5));
      const bw = Math.min(220, W - 80);
      this.ui.add(new Button(this, W / 2, H * 0.42, 'English', () => this.chooseLanguage('en'), { w: bw, h: 34, style: 'primary' }));
      this.ui.add(new Button(this, W / 2, H * 0.42 + 48, 'Bahasa Indonesia', () => this.chooseLanguage('id'), { w: bw, h: 34, style: 'primary' }));
      return;
    }
    const card = this.cards()[this.step];
    const last = this.step === 2;
    const boxW = W - 32;
    const bannerW = boxW - 20;
    const bannerH = Math.round(bannerW * 0.52);
    const boxH = bannerH + 200;
    const top = Math.max(24, Math.round(H * 0.5 - boxH / 2) - 20);
    this.ui.add(panel(this, 16, top, boxW, boxH, 'ui_panel_ornate'));
    // The painting is cropped to a wide banner and eases in slowly.
    const art = this.add.image(W / 2, top + 10 + bannerH / 2, card.art);
    const cropH = Math.round(art.width * 0.52);
    art.setCrop(0, Math.round((art.height - cropH) / 2), art.width, cropH).setScale(bannerW / art.width).setAlpha(0);
    this.tweens.add({ targets: art, alpha: 1, duration: 450 });
    this.ui.add(art);
    this.ui.add(this.add.rectangle(W / 2, top + 10 + bannerH / 2, bannerW, bannerH).setStrokeStyle(2, COLORS.gold, 0.9));
    this.ui.add(label(this, W / 2, top + bannerH + 36, card.title, FONT.head, COLORS.gold, 0.5, 0.5));
    this.ui.add(para(this, 30, top + bannerH + 58, card.body, W - 60, FONT.body, COLORS.text));
    for (let i = 0; i < 3; i++) {
      this.ui.add(this.add.rectangle(W / 2 + (i - 1) * 16, top + boxH + 24, 8, 8, i === this.step ? COLORS.gold : COLORS.textDim).setOrigin(0.5));
    }
    const y = top + boxH + 64;
    if (!last) this.ui.add(new Button(this, 56, y, t('onbSkip'), () => this.finish(), { w: 80, h: 30, font: FONT.small }));
    this.ui.add(new Button(this, W - 76, y, last ? t('onbStart') : t('onbNext'), () => (last ? this.finish() : this.go(this.step + 1)), { w: 120, h: 32, style: 'primary' }));
  }
}
