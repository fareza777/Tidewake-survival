/** Global service locator, filled during boot. Kept tiny so pure systems (tests) never depend on it. */
import type { AudioManager } from './audio';
import type { Platform } from './platform';
import type { SaveStore } from './save';
import type { Settings } from './settings';
import type { Monetization } from './monetization';

export interface Services {
  audio?: AudioManager;
  platform?: Platform;
  saves?: SaveStore;
  settings?: Settings;
  monetization?: Monetization;
  notify?: (text: string, color?: number) => void;
}

export const services: Services = {};
