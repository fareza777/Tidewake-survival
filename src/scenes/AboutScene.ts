import { BaseScene } from './BaseScene';
import { GAME_VERSION } from './MenuScene';
import { t } from '@/core/i18n';
import { CONTACT_EMAIL, PRIVACY_URL } from '@/core/config';
import { services } from '@/core/services';
import { COLORS, FONT } from '@/ui/theme';
import { Button, label, panel, para } from '@/ui/widgets';

/** Version, credits, the privacy policy and a way to get in touch. */
export class AboutScene extends BaseScene {
  constructor() {
    super('About');
  }

  create(): void {
    this.transitioning = false;
    this.cameras.main.setBackgroundColor(COLORS.bg0);
    this.fadeIn(250);
    const { W, H } = this;
    this.add.existing(panel(this, 6, 6, W - 12, H - 12, 'ui_panel_dark'));
    label(this, W / 2, 24, t('aboutTitle'), FONT.head, COLORS.gold, 0.5, 0.5);
    label(this, W / 2, 46, t('version', { v: GAME_VERSION }), FONT.small, COLORS.textDim, 0.5, 0.5);
    para(this, 20, 70, t('aboutCredits'), W - 40, FONT.body, COLORS.text);
    const bw = Math.min(220, W - 60);
    new Button(this, W / 2, H - 112, t('aboutPrivacy'), () => services.platform?.openUrl(PRIVACY_URL), { w: bw, h: 30 });
    new Button(this, W / 2, H - 72, t('aboutContact'), () => services.platform?.openUrl(`mailto:${CONTACT_EMAIL}`), { w: bw, h: 30 });
    new Button(this, W / 2, H - 30, t('back'), () => this.goTo('Menu'), { w: 140, h: 30, style: 'primary' });
    this.handleBack(() => {
      this.goTo('Menu');
      return true;
    });
  }
}
