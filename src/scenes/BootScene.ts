import Phaser from 'phaser';
import { Preferences } from '@capacitor/preferences';
import { AudioManager } from '@/core/audio';
import { detectLang, setLang } from '@/core/i18n';
import { Platform } from '@/core/platform';
import { SaveStore, type StorageLike } from '@/core/save';
import { services } from '@/core/services';
import { loadSettings } from '@/core/settings';
import { view } from '@/core/viewport';
import { createHiResSkin } from '@/ui/skin';
import { createUiTextures, FONT, fontSuffix } from '@/ui/theme';

function browserStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Loads the fonts, wires up the services (settings, saves, platform, audio) and hands over to Preload. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    const sfx = fontSuffix(view.res);
    for (const key of Object.values(FONT)) {
      this.load.bitmapFont(key, `assets/fonts/${key}${sfx}.png`, `assets/fonts/${key}${sfx}.fnt`);
    }
  }

  async create(): Promise<void> {
    createUiTextures(this);
    createHiResSkin(this);
    const storage = browserStorage();
    const settings = loadSettings(storage, detectLang());
    services.settings = settings;
    setLang(settings.lang);
    const saves = new SaveStore(storage, (key, value) => {
      Preferences.set({ key, value }).catch((err) => console.warn('[save] native write failed', err));
    });
    services.saves = saves;
    const platform = new Platform();
    platform.hapticsEnabled = settings.vibration;
    services.platform = platform;
    const audio = new AudioManager(this.game);
    audio.setMusicVolume(settings.musicVol);
    audio.setSfxVolume(settings.sfxVol);
    services.audio = audio;
    await platform.init();
    await saves.restoreFromNative(async (key) => (await Preferences.get({ key })).value);
    this.scene.start('Preload');
  }
}
