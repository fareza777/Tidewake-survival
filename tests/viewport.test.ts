import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUTO_LOW_KEY, MAX_W, MIN_W, autoQuality, computeViewport, savedHiRes, savedTextScale, setView, snapWorld, view, vx, vy } from '@/core/viewport';
import { SETTINGS_KEY } from '@/core/settings';

function stubStorage(items: Record<string, string>, deviceMemory?: number): void {
  vi.stubGlobal('localStorage', { getItem: (k: string) => items[k] ?? null });
  vi.stubGlobal('navigator', { deviceMemory });
}

afterEach(() => vi.unstubAllGlobals());

describe('computeViewport', () => {
  it('renders a 390x844 @2x phone at 2x', () => {
    expect(computeViewport(390, 844, 2)).toEqual({ width: 390, height: 844, scale: 2, res: 2, zoom: 0.5 });
  });

  it('renders a tall 412x915 @2.625x phone at 3x', () => {
    const vp = computeViewport(412, 915, 2.625);
    expect(vp).toMatchObject({ width: 360, height: 800, scale: 3, res: 3 });
  });

  it('draws at 1x when hi-res is off', () => {
    expect(computeViewport(360, 640, 3, false)).toMatchObject({ scale: 3, res: 1, zoom: 1 });
  });

  it('halves the render scale on 4x screens and upscales exactly', () => {
    expect(computeViewport(360, 780, 4)).toMatchObject({ scale: 4, res: 2, zoom: 0.5 });
  });

  it('keeps the virtual width inside the supported range for extreme shapes', () => {
    for (const [w, h] of [[200, 900], [1200, 900], [360, 360], [1, 1]]) {
      const vp = computeViewport(w, h, 2);
      expect(vp.width).toBeGreaterThanOrEqual(MIN_W);
      expect(vp.width).toBeLessThanOrEqual(MAX_W);
      expect(vp.scale).toBeGreaterThanOrEqual(1);
      expect(vp.res).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('view helpers', () => {
  it('converts canvas pixels to virtual pixels and snaps to device pixels', () => {
    setView({ width: 390, height: 844, scale: 2, res: 2, zoom: 0.5 });
    expect(view).toMatchObject({ w: 390, h: 844, res: 2 });
    expect(vx({ x: 100 })).toBe(50);
    expect(vy({ y: 100 })).toBe(50);
    expect(snapWorld(10.13, 2)).toBe(10.25);
  });
});

describe('saved quality settings', () => {
  it('uses hi-res by default on a normal device', () => {
    stubStorage({});
    expect(savedHiRes()).toBe(true);
    expect(autoQuality()).toBe(true);
    expect(savedTextScale()).toBe(1);
  });

  it('respects an explicit choice over the device check', () => {
    stubStorage({ [SETTINGS_KEY]: JSON.stringify({ quality: 'low' }) }, 8);
    expect(savedHiRes()).toBe(false);
    expect(autoQuality()).toBe(false);
    stubStorage({ [SETTINGS_KEY]: JSON.stringify({ quality: 'high' }) }, 1);
    expect(savedHiRes()).toBe(true);
  });

  it('falls back to low quality on low-memory devices or after a failed frame-rate check', () => {
    stubStorage({}, 2);
    expect(savedHiRes()).toBe(false);
    stubStorage({ [AUTO_LOW_KEY]: '1' }, 8);
    expect(savedHiRes()).toBe(false);
  });

  it('reads the text scale only when it is in range and survives corrupt storage', () => {
    stubStorage({ [SETTINGS_KEY]: JSON.stringify({ textScale: 1.2 }) });
    expect(savedTextScale()).toBe(1.2);
    stubStorage({ [SETTINGS_KEY]: JSON.stringify({ textScale: 3 }) });
    expect(savedTextScale()).toBe(1);
    stubStorage({ [SETTINGS_KEY]: '{broken' });
    expect(savedTextScale()).toBe(1);
    expect(savedHiRes()).toBe(true);
  });
});
