import { BaseScene } from './BaseScene';
import { t } from '@/core/i18n';
import { FLAG_ONBOARDED, readFlag } from '@/core/flags';
import { browserStorage } from '@/core/storage';
import { COLORS, FONT } from '@/ui/theme';

/** Title card shown at launch; tap to skip. */
export class SplashScene extends BaseScene {
  constructor() {
    super('Splash');
  }

  create(): void {
    this.transitioning = false;
    this.cameras.main.setBackgroundColor(COLORS.bg0);
    const cx = this.W / 2;
    const cy = this.H / 2;
    const title = this.add.bitmapText(cx, cy - 8, FONT.title, t('gameTitle').toUpperCase()).setOrigin(0.5).setScale(3).setTint(COLORS.gold).setAlpha(0);
    const sub = this.add.bitmapText(cx, cy + 34, FONT.head, t('subtitle')).setOrigin(0.5).setTint(COLORS.textDim).setAlpha(0);
    this.tweens.add({ targets: [title, sub], alpha: 1, duration: 600, ease: 'Sine.easeOut' });
    const next = () => this.goTo(readFlag(browserStorage(), FLAG_ONBOARDED) ? 'Menu' : 'Onboarding', {}, 400);
    this.time.delayedCall(1800, next);
    this.input.once('pointerdown', next);
  }
}
