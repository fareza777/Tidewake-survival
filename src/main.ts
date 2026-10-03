import Phaser from 'phaser';
import { SCENES } from './scenes';
import { AUTO_LOW_KEY, autoQuality, computeViewport, savedHiRes, savedTextScale, setView, view } from './core/viewport';
import { installBitmapTextDefaults, setTextScale } from './ui/theme';
import { services } from './core/services';

const hiRes = savedHiRes();
const vp = computeViewport(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1, hiRes);
setView(vp);
setTextScale(savedTextScale());
installBitmapTextDefaults(vp.res);

/** Every scene's main camera zooms by the render scale, so all layout code keeps working in virtual pixels. */
class HiResCamera extends Phaser.Plugins.ScenePlugin {
  boot(): void {
    this.systems!.events.on(Phaser.Scenes.Events.START, this.apply, this);
  }

  apply(): void {
    this.scene!.cameras.main.setOrigin(0, 0).setZoom(view.res);
  }
}

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  width: vp.width * vp.res,
  height: vp.height * vp.res,
  backgroundColor: '#0b0a14',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: { mode: Phaser.Scale.NONE, zoom: vp.zoom },
  input: { activePointers: 4 },
  fps: { target: 60, smoothStep: true },
  render: { powerPreference: 'high-performance', batchSize: 4096 },
  audio: { disableWebAudio: false },
  scene: SCENES,
  plugins: { scene: [{ key: 'HiResCamera', plugin: HiResCamera, mapping: 'hiResCamera' }] },
});

let resizeTimer: ReturnType<typeof setTimeout> | null = null;
window.addEventListener('resize', () => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const next = computeViewport(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1, hiRes);
    setView(next);
    game.scale.setZoom(next.zoom);
    game.scale.resize(next.width * next.res, next.height * next.res);
  }, 150);
});

// Frame-rate guard: if hi-res rendering runs slowly on this device (and the player never picked a quality),
// remember that and restart once in the lighter pixel-resolution mode.
if (hiRes && vp.res > 1 && autoQuality()) {
  setTimeout(() => {
    const samples: number[] = [];
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      samples.push(game.loop.actualFps);
      if (samples.length < 8) return;
      clearInterval(id);
      const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
      if (avg < 32) {
        try {
          localStorage.setItem(AUTO_LOW_KEY, '1');
        } catch {
          return;
        }
        window.location.reload();
      }
    }, 500);
  }, 6000);
}

// Debug and automated-test hooks: dev server and QA builds only.
if (import.meta.env.DEV || import.meta.env.VITE_QA === '1') {
  (window as unknown as { __game: Phaser.Game }).__game = game;
  (window as unknown as { __services: typeof services }).__services = services;
  const errs: string[] = [];
  (window as unknown as { __errs: string[] }).__errs = errs;
  window.addEventListener('error', (e) => errs.push(String((e.error as Error | undefined)?.stack ?? e.message)));
  window.addEventListener('unhandledrejection', (e) => errs.push(String((e.reason as Error | undefined)?.stack ?? e.reason)));
}
