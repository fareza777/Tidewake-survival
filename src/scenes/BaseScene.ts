import Phaser from 'phaser';
import { services } from '@/core/services';
import { view } from '@/core/viewport';

/** Shared helpers for every scene: virtual size, fade transitions and Android back-button handling. */
export abstract class BaseScene extends Phaser.Scene {
  private unregisterBack?: () => void;
  protected transitioning = false;

  get W(): number {
    return view.w;
  }

  get H(): number {
    return view.h;
  }

  /** Call from create(). Return true from the handler to consume the back press. */
  protected handleBack(fn: () => boolean): void {
    this.unregisterBack?.();
    this.unregisterBack = services.platform?.onBack(() => (this.scene.isActive() ? fn() : false));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unregisterBack?.();
      this.unregisterBack = undefined;
    });
  }

  protected fadeIn(ms = 300): void {
    this.cameras.main.fadeIn(ms, 11, 10, 20);
  }

  /** Fade out then start another scene (stopping this one). */
  goTo(key: string, data?: object, ms = 280): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(ms, 11, 10, 20);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(key, data);
    });
  }
}
