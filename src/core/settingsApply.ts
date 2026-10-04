import { setLang } from '@/core/i18n';
import type { StorageLike } from '@/core/save';
import { services } from '@/core/services';
import { saveSettings, type Settings } from '@/core/settings';
import { browserStorage } from '@/core/storage';

/** Make new settings take effect now (language, volumes, vibration) and remember them. */
export function commitSettings(next: Settings, storage: StorageLike | null = browserStorage()): void {
  services.settings = next;
  setLang(next.lang);
  services.audio?.setMusicVolume(next.musicVol);
  services.audio?.setSfxVolume(next.sfxVol);
  if (services.platform) services.platform.hapticsEnabled = next.vibration;
  saveSettings(storage, next);
}
