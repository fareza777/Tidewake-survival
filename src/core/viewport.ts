import type Phaser from 'phaser';
import { SETTINGS_KEY } from '@/core/settings';

/**
 * Layout works in a small "virtual" resolution (about 360 px wide) so pixel art and UI keep their proportions,
 * but the canvas itself is rendered at `res` canvas pixels per virtual pixel (the device's integer scale on High
 * quality). Cameras zoom by `res`, so sprites move in sub-virtual-pixel steps, lights are smooth and text is crisp.
 */
export interface Viewport {
  /** Virtual size used by all layout code. */
  width: number;
  height: number;
  /** Integer device pixels per virtual pixel. */
  scale: number;
  /** Canvas pixels per virtual pixel (= scale on High quality, 1 on Low). */
  res: number;
  /** CSS zoom passed to Phaser (device pixels per canvas pixel / devicePixelRatio). */
  zoom: number;
}

export const MIN_W = 320;
export const MAX_W = 420;

export function computeViewport(cssW: number, cssH: number, dpr: number, hiRes = true): Viewport {
  const devW = Math.max(1, Math.floor(cssW * dpr));
  const devH = Math.max(1, Math.floor(cssH * dpr));
  const byWidth = Math.round(devW / 360);
  const byHeight = Math.floor(devH / 600);
  const scale = Math.max(1, Math.min(byWidth, byHeight));
  const height = Math.floor(devH / scale);
  let width = Math.floor(devW / scale);
  width = Math.max(MIN_W, Math.min(MAX_W, width, Math.floor(height * 0.62)));
  // 4x screens (1440p) render at 2x and upscale by an exact 2: a quarter of the pixel cost, still crisp.
  const res = !hiRes ? 1 : scale >= 4 && scale % 2 === 0 ? scale / 2 : scale;
  return { width, height, scale, res, zoom: scale / res / dpr };
}

/** Live virtual size + render scale, updated on resize. Read these instead of `scene.scale.width`. */
export const view = { w: 360, h: 640, res: 1, cssPerVirtual: 1 };

export function setView(vp: Viewport): void {
  view.w = vp.width;
  view.h = vp.height;
  view.res = vp.res;
  view.cssPerVirtual = vp.zoom * vp.res;
}

/** Camera zoom that magnifies the world `z` times in virtual pixels. */
export function worldZoom(z: number): number {
  return z * view.res;
}

/**
 * Snap a world coordinate to the nearest device pixel under a world camera of virtual zoom `z` (2 in the world).
 * Keeps pixel art crisp while letting sprites glide in sub-pixel steps instead of whole-texel jumps.
 */
export function snapWorld(v: number, z = 2): number {
  const k = z * view.res;
  return Math.round(v * k) / k;
}

/** Pointer position in virtual coordinates (pointer.x/y are canvas pixels). */
export function vx(p: { x: number }): number {
  return p.x / view.res;
}

export function vy(p: { y: number }): number {
  return p.y / view.res;
}

/** Set when the frame-rate guard found the device too slow for hi-res rendering. */
export const AUTO_LOW_KEY = 'tidewake.autoLow';

function readSettings(): { quality?: unknown; textScale?: unknown } {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return typeof parsed === 'object' && parsed !== null ? (parsed as { quality?: unknown; textScale?: unknown }) : {};
  } catch {
    return {};
  }
}

/** Accessibility text size chosen in Settings (read before boot, because fonts are set up once). */
export function savedTextScale(): number {
  const k = readSettings().textScale;
  return typeof k === 'number' && k >= 1 && k <= 1.3 ? k : 1;
}

/** True while the player has not chosen a graphics quality themselves. */
export function autoQuality(): boolean {
  const q = readSettings().quality;
  return q !== 'low' && q !== 'high';
}

/**
 * Decides hi-res rendering before the settings system boots (the canvas size is fixed at startup): the player's
 * choice if they made one, otherwise hi-res unless the device reports little memory or already failed the frame-rate check.
 */
export function savedHiRes(): boolean {
  const q = readSettings().quality;
  if (q === 'low') return false;
  if (q === 'high') return true;
  try {
    if (localStorage.getItem(AUTO_LOW_KEY) === '1') return false;
  } catch {
    // Storage unavailable: fall through to the device check.
  }
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return !(mem !== undefined && mem <= 3);
}

/**
 * Camera shake whose strength is the same on every screen. Phaser measures shake in canvas pixels times zoom, so on a
 * hi-res canvas (res device pixels per virtual pixel) a raw shake would be res times stronger.
 */
export function shakeCamera(cam: Phaser.Cameras.Scene2D.Camera, ms: number, intensity: number): void {
  cam.shake(ms, intensity / Math.max(1, view.res));
}
