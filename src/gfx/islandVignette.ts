import Phaser from 'phaser';
import type { IslandId } from '@/sim/world/types';

export type VignetteId = IslandId | 'depths';

interface Look {
  skyTop: number;
  skyBottom: number;
  sea: number;
}

const LOOKS: Record<VignetteId, Look> = {
  home: { skyTop: 0x2b5f9a, skyBottom: 0x9fd2ee, sea: 0x1f6fa8 },
  frost: { skyTop: 0x3a5a86, skyBottom: 0xcfe6f6, sea: 0x2a6f9a },
  ember: { skyTop: 0x3a1410, skyBottom: 0xe0702a, sea: 0x3a2428 },
  wreck: { skyTop: 0x1c3a3a, skyBottom: 0x7fb7a4, sea: 0x1f4f56 },
  sky: { skyTop: 0x6a4fb0, skyBottom: 0xf0d8ff, sea: 0xcdb6f0 },
  depths: { skyTop: 0x0a0818, skyBottom: 0x2a1a48, sea: 0x120c20 },
};

/**
 * A small painted picture of an island for the sea chart: sky, sea and the island's own landmarks (palms, ice, lava, a
 * wreck, a floating isle, the dark stairs of the Depths), drawn with shapes so it needs no art files.
 */
export function drawVignette(scene: Phaser.Scene, x: number, y: number, w: number, h: number, id: VignetteId): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  const look = LOOKS[id];
  const horizon = Math.round(h * 0.62);
  g.fillGradientStyle(look.skyTop, look.skyTop, look.skyBottom, look.skyBottom, 1);
  g.fillRect(0, 0, w, horizon);
  g.fillStyle(look.sea, 1);
  g.fillRect(0, horizon, w, h - horizon);
  g.fillStyle(0xffffff, 0.18);
  for (let i = 0; i < 4; i++) g.fillRect(4 + i * 16, horizon + 4 + (i % 2) * 6, 9, 1);
  const cx = w / 2;
  switch (id) {
    case 'home':
      g.fillStyle(0x3f8a3a, 1);
      g.fillTriangle(cx - 26, horizon, cx, horizon - 20, cx + 26, horizon);
      g.fillStyle(0xd8bb78, 1);
      g.fillRect(cx - 28, horizon - 2, 56, 3);
      g.fillStyle(0x6b4a2a, 1);
      g.fillRect(cx - 12, horizon - 10, 2, 8);
      g.fillStyle(0x2d6a30, 1);
      g.fillCircle(cx - 11, horizon - 12, 4);
      g.fillStyle(0xe8d8b0, 1);
      g.fillRect(cx + 6, horizon - 9, 8, 6);
      g.fillStyle(0xb04a3a, 1);
      g.fillTriangle(cx + 5, horizon - 9, cx + 10, horizon - 14, cx + 15, horizon - 9);
      break;
    case 'frost':
      g.fillStyle(0xe8f4ff, 1);
      g.fillTriangle(cx - 28, horizon, cx - 4, horizon - 24, cx + 20, horizon);
      g.fillTriangle(cx - 6, horizon, cx + 14, horizon - 17, cx + 30, horizon);
      g.fillStyle(0x9fd0f0, 1);
      g.fillTriangle(cx - 4, horizon - 24, cx - 9, horizon - 10, cx + 1, horizon - 10);
      g.fillStyle(0xffffff, 0.9);
      for (let i = 0; i < 9; i++) g.fillRect(4 + ((i * 29) % (w - 8)), 3 + ((i * 11) % (horizon - 14)), 1, 1);
      break;
    case 'ember':
      g.fillStyle(0x2a2430, 1);
      g.fillTriangle(cx - 30, horizon, cx, horizon - 28, cx + 30, horizon);
      g.fillStyle(0xff7a2a, 1);
      g.fillTriangle(cx - 4, horizon - 28, cx - 7, horizon - 18, cx + 3, horizon - 18);
      g.fillRect(cx - 1, horizon - 18, 3, 18);
      g.fillStyle(0xffc04a, 1);
      g.fillRect(cx, horizon - 14, 1, 14);
      g.fillStyle(0x4a4450, 0.7);
      g.fillCircle(cx + 6, horizon - 36, 5);
      g.fillCircle(cx + 11, horizon - 42, 4);
      break;
    case 'wreck':
      g.fillStyle(0x8a7a52, 1);
      g.fillRect(cx - 30, horizon - 3, 60, 4);
      g.fillStyle(0x5a3a22, 1);
      g.fillTriangle(cx - 12, horizon, cx + 14, horizon, cx + 8, horizon - 9);
      g.fillRect(cx - 2, horizon - 24, 2, 18);
      g.fillStyle(0xcfc6a6, 0.9);
      g.fillTriangle(cx, horizon - 22, cx + 9, horizon - 12, cx, horizon - 12);
      g.fillStyle(0xbfe8d8, 0.25);
      g.fillRect(0, horizon - 10, w, 8);
      break;
    case 'sky':
      g.fillStyle(0xfff2c8, 0.45);
      g.fillCircle(cx + 14, 14, 10);
      g.fillStyle(0x6a5a8a, 1);
      g.fillTriangle(cx - 24, horizon - 8, cx + 24, horizon - 8, cx, horizon + 8);
      g.fillStyle(0xcfc0ff, 1);
      g.fillRect(cx - 26, horizon - 12, 52, 5);
      g.fillStyle(0x9a7ad0, 1);
      g.fillCircle(cx - 8, horizon - 16, 5);
      g.fillCircle(cx + 6, horizon - 18, 6);
      g.fillStyle(0xffffff, 0.85);
      g.fillRect(cx - 34, horizon + 2, 20, 4);
      g.fillRect(cx + 10, horizon + 8, 24, 4);
      break;
    case 'depths':
      g.fillStyle(0x3a2a58, 1);
      for (let i = 0; i < 5; i++) g.fillRect(cx - 24 + i * 5, horizon - 4 - i * 5, 48 - i * 10, 5);
      g.fillStyle(0xffd070, 0.8);
      g.fillRect(cx - 1, horizon - 26, 2, 3);
      g.fillStyle(0x7a5ac8, 0.8);
      for (let i = 0; i < 6; i++) g.fillRect(6 + i * 10, 4 + (i % 3) * 7, 1, 2);
      break;
  }
  g.lineStyle(1, 0x000000, 0.45);
  g.strokeRect(0, 0, w, h);
  return g;
}
