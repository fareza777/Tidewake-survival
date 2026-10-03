import Phaser from 'phaser';
import type { GameScene } from './GameScene';
import { t } from '@/core/i18n';
import { services } from '@/core/services';
import { view } from '@/core/viewport';
import { controls } from '@/game/input';
import { clockLabel, lighting } from '@/sim/daynight';
import { showModal } from '@/ui/modal';
import { Joystick } from '@/ui/Joystick';
import { COLORS, FONT } from '@/ui/theme';
import { Button } from '@/ui/widgets';

/** Heads-up display on top of the island: time, materials, joystick, ACTION and pause buttons, plus the night shade. */
export class HudScene extends Phaser.Scene {
  private world!: GameScene;
  private shade!: Phaser.GameObjects.Rectangle;
  private dayText!: Phaser.GameObjects.BitmapText;
  private bagText!: Phaser.GameObjects.BitmapText;
  private lastDay = '';
  private lastBag = '';
  private menuOpen = false;

  constructor() {
    super('Hud');
  }

  create(data: { game: GameScene }): void {
    this.world = data.game;
    this.menuOpen = false;
    this.lastDay = '';
    this.lastBag = '';
    const { w: W, h: H } = view;
    // The night shade sits under every HUD element, so buttons and text are never darkened.
    this.shade = this.add.rectangle(0, 0, W, H, 0x0a1030, 0).setOrigin(0, 0).setDepth(0);
    this.dayText = this.add.bitmapText(8, 8, FONT.body, '').setTint(COLORS.text).setDepth(5);
    this.bagText = this.add.bitmapText(8, 28, FONT.small, '').setTint(COLORS.textDim).setDepth(5);
    new Button(this, W - 24, 22, 'II', () => this.openMenu(), { w: 34, h: 28 }).setDepth(6);
    new Button(this, W - 52, H - 90, t('hitAction'), () => {
      controls.action = true;
    }, { w: 68, h: 68, style: 'primary' }).setDepth(6);
    new Joystick(this, () => services.settings?.joystick ?? 'floating');
  }

  /** Pause dialog: the island stops while it is open. Also used for the Android back button. */
  openMenu(): void {
    if (this.menuOpen) return;
    this.menuOpen = true;
    this.scene.pause('Game');
    const finish = (): void => {
      this.menuOpen = false;
      unregister?.();
      this.scene.resume('Game');
    };
    const close = showModal(this, t('paused'), '', [
      { label: t('resume'), style: 'primary', onClick: finish },
      {
        label: t('saveQuit'),
        onClick: () => {
          finish();
          this.world.quitToMenu();
        },
      },
    ]);
    // Pressed after the dialog's own handler, so it runs first and also resumes the island.
    const unregister = services.platform?.onBack(() => {
      close();
      finish();
      return true;
    });
  }

  update(): void {
    const w = this.world;
    const day = `${t('hudDay', { n: w.clock.day })}  ${clockLabel(w.clock)}`;
    if (day !== this.lastDay) {
      this.lastDay = day;
      this.dayText.setText(day);
    }
    const bag = Object.entries(w.bag)
      .filter(([, n]) => n > 0)
      .map(([id, n]) => `${t(`item_${id}`)} ${n}`)
      .join('\n');
    if (bag !== this.lastBag) {
      this.lastBag = bag;
      this.bagText.setText(bag);
    }
    const light = lighting(w.clock);
    this.shade.setFillStyle(light.color, light.alpha);
  }
}
