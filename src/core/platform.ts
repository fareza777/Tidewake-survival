/** Thin wrapper over Capacitor plugins with graceful browser fallbacks. */
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { StatusBar } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { InAppReview } from '@capacitor-community/in-app-review';

export const APP_ID = 'com.fajar.tidewake';
export const STORE_URL = `https://play.google.com/store/apps/details?id=${APP_ID}`;

type HapticKind = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

export class Platform {
  readonly native = Capacitor.isNativePlatform();
  hapticsEnabled = true;
  private backHandlers: (() => boolean)[] = [];
  private pauseHandlers: (() => void)[] = [];
  private resumeHandlers: (() => void)[] = [];

  async init(): Promise<void> {
    if (!this.native) return;
    try {
      await StatusBar.hide();
      await ScreenOrientation.lock({ orientation: 'portrait' });
    } catch (err) {
      console.warn('[platform] status bar/orientation', err);
    }
    App.addListener('backButton', () => {
      for (let i = this.backHandlers.length - 1; i >= 0; i--) {
        if (this.backHandlers[i]()) return;
      }
    });
    App.addListener('pause', () => this.pauseHandlers.forEach((fn) => fn()));
    App.addListener('resume', () => this.resumeHandlers.forEach((fn) => fn()));
  }

  async hideSplash(): Promise<void> {
    if (!this.native) return;
    try {
      await SplashScreen.hide();
    } catch (err) {
      console.warn('[platform] splash', err);
    }
  }

  /** Register an Android back-button handler. Return true to consume. Returns an unregister function. */
  onBack(fn: () => boolean): () => void {
    this.backHandlers.push(fn);
    return () => {
      this.backHandlers = this.backHandlers.filter((h) => h !== fn);
    };
  }

  onPause(fn: () => void): void {
    this.pauseHandlers.push(fn);
    if (!this.native && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) fn();
      });
    }
  }

  onResume(fn: () => void): void {
    this.resumeHandlers.push(fn);
    if (!this.native && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) fn();
      });
    }
  }

  haptic(kind: HapticKind): void {
    if (!this.hapticsEnabled) return;
    if (!this.native) {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        const ms = kind === 'light' ? 8 : kind === 'medium' ? 18 : kind === 'heavy' ? 35 : 20;
        try {
          navigator.vibrate(ms);
        } catch {
          /* vibration not permitted in this context */
        }
      }
      return;
    }
    const run = async () => {
      if (kind === 'success') await Haptics.notification({ type: NotificationType.Success });
      else if (kind === 'warning') await Haptics.notification({ type: NotificationType.Warning });
      else if (kind === 'error') await Haptics.notification({ type: NotificationType.Error });
      else {
        const style = kind === 'light' ? ImpactStyle.Light : kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Heavy;
        await Haptics.impact({ style });
      }
    };
    run().catch((err) => console.warn('[platform] haptic', err));
  }

  async share(title: string, text: string): Promise<boolean> {
    try {
      if (this.native) {
        await Share.share({ title, text, url: STORE_URL, dialogTitle: title });
        return true;
      }
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title, text, url: STORE_URL });
        return true;
      }
      await navigator.clipboard?.writeText(`${text} ${STORE_URL}`);
      return true;
    } catch (err) {
      console.warn('[platform] share cancelled/failed', err);
      return false;
    }
  }

  /** Native in-app review sheet, falling back to the Play Store listing. */
  async rate(): Promise<void> {
    if (this.native) {
      try {
        await InAppReview.requestReview();
        return;
      } catch (err) {
        console.warn('[platform] in-app review unavailable, opening store', err);
      }
    }
    this.openUrl(this.native ? `market://details?id=${APP_ID}` : STORE_URL);
  }

  openUrl(url: string): void {
    window.open(url, '_blank');
  }

  async exitApp(): Promise<void> {
    if (this.native) await App.exitApp();
  }
}
