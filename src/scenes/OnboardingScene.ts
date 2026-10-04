import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { t } from '@/core/i18n';
import { FLAG_ONBOARDED, setFlag } from '@/core/flags';
import { services } from '@/core/services';
import { defaultSettings } from '@/core/settings';
import { commitSettings } from '@/core/settingsApply';
import { browserStorage } from '@/core/storage';
import type { ItemId } from '@/data/items';
import { itemIcon } from '@/ui/itemIcon';
import { COLORS, FONT } from '@/ui/theme';
import { Button, label, panel, para } from '@/ui/widgets';

interface Card {
  icon: ItemId;
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

  create(): void {
    this.transitioning = false;
    this.step = -1;
    this.cameras.main.setBackgroundColor(COLORS.bg0);
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
      { icon: 'axe_wood', title: t('onb1Title'), body: t('onb1Body') },
      { icon: 'compass', title: t('onb2Title'), body: t('onb2Body') },
      { icon: 'sword_iron', title: t('onb3Title'), body: t('onb3Body') },
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
    this.ui.add(panel(this, 16, H * 0.16, W - 32, H * 0.56, 'ui_panel_ornate'));
    this.ui.add(itemIcon(this, W / 2, H * 0.16 + 54, card.icon, 56));
    this.ui.add(label(this, W / 2, H * 0.16 + 100, card.title, FONT.head, COLORS.gold, 0.5, 0.5));
    this.ui.add(para(this, 32, H * 0.16 + 124, card.body, W - 64, FONT.body, COLORS.text));
    for (let i = 0; i < 3; i++) {
      this.ui.add(this.add.rectangle(W / 2 + (i - 1) * 16, H * 0.78, 8, 8, i === this.step ? COLORS.gold : COLORS.textDim).setOrigin(0.5));
    }
    const y = H * 0.88;
    if (!last) this.ui.add(new Button(this, 56, y, t('onbSkip'), () => this.finish(), { w: 80, h: 30, font: FONT.small }));
    this.ui.add(new Button(this, W - 76, y, last ? t('onbStart') : t('onbNext'), () => (last ? this.finish() : this.go(this.step + 1)), { w: 120, h: 32, style: 'primary' }));
  }
}
