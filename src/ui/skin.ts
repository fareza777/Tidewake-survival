import Phaser from 'phaser';
import { view } from '@/core/viewport';

/**
 * Hi-res UI skin: panels, buttons, slots and tabs painted with smooth gradients, rounded corners and bevels at the
 * render scale, used as 9-slices scaled back to virtual size. On Low quality (res 1) the pixel skins in theme.ts
 * are kept, and nine() simply creates a normal 9-slice.
 */

/** Corner size (virtual px) of each 9-slice texture. */
const CORNER: Record<string, number> = { ui_bar_bg: 2 };
const DEFAULT_CORNER = 6;
/** Texture size in virtual px (square). */
const SIZE = 24;

export function corner(key: string): number {
  if (view.res <= 1) return key === 'ui_bar_bg' ? 2 : 5;
  return CORNER[key] ?? DEFAULT_CORNER;
}

/** Create a 9-slice in virtual units, using the hi-res skin when rendering at more than 1x. */
export function nine(
  scene: Phaser.Scene, x: number, y: number, key: string, w: number, h: number,
): Phaser.GameObjects.NineSlice {
  const k = view.res;
  const c = corner(key);
  if (k <= 1) return scene.add.nineslice(x, y, key, undefined, w, h, c, c, c, c);
  const n = scene.add.nineslice(x, y, key, undefined, Math.max(c * 2, w) * k, Math.max(c * 2, h) * k, c * k, c * k, c * k, c * k);
  return n.setScale(1 / k);
}

type Ctx = CanvasRenderingContext2D;

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

const css = (c: number, a = 1): string => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;

interface Look {
  top: number;
  bottom: number;
  border: number;
  /** Inner highlight line colour (top edge). */
  shine: number;
  shineA: number;
  /** Height of the darker 3D lip at the bottom (virtual px); 0 for flat panels. */
  lip?: number;
  lipColor?: number;
  gloss?: number;
  trim?: number;
  radius?: number;
}

function paint(scene: Phaser.Scene, key: string, look: Look): void {
  const k = view.res;
  const s = SIZE * k;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, s, s);
  if (!tex) return;
  const ctx = tex.getContext();
  const u = k; // one virtual pixel
  const r = (look.radius ?? 4) * u;
  // Outer dark outline / drop edge
  ctx.fillStyle = 'rgba(5,4,10,0.9)';
  rr(ctx, 0, 0, s, s, r + u);
  ctx.fill();
  // Border
  ctx.fillStyle = css(look.border);
  rr(ctx, u, u, s - 2 * u, s - 2 * u, r);
  ctx.fill();
  // Body gradient (minus the lip)
  const lip = (look.lip ?? 0) * u;
  const g = ctx.createLinearGradient(0, 2 * u, 0, s - 2 * u - lip);
  g.addColorStop(0, css(look.top));
  g.addColorStop(1, css(look.bottom));
  ctx.fillStyle = g;
  rr(ctx, 2 * u, 2 * u, s - 4 * u, s - 4 * u - lip, Math.max(u, r - u));
  ctx.fill();
  if (lip > 0) {
    ctx.fillStyle = css(look.lipColor ?? 0x000000, 0.55);
    ctx.fillRect(2 * u + r / 2, s - 2 * u - lip, s - 4 * u - r, lip * 0.6);
  }
  // Gloss band on the upper half
  if (look.gloss) {
    const gl = ctx.createLinearGradient(0, 2 * u, 0, s * 0.5);
    gl.addColorStop(0, `rgba(255,255,255,${look.gloss})`);
    gl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl;
    rr(ctx, 3 * u, 3 * u, s - 6 * u, s * 0.45, Math.max(u, r - 2 * u));
    ctx.fill();
  }
  // Top highlight line
  ctx.fillStyle = css(look.shine, look.shineA);
  ctx.fillRect(2 * u + r * 0.6, 2 * u, s - 4 * u - r * 1.2, Math.max(1, u * 0.67));
  // Gold trim + corner studs for ornate windows
  if (look.trim !== undefined) {
    ctx.strokeStyle = css(look.trim, 0.55);
    ctx.lineWidth = Math.max(1, u * 0.67);
    rr(ctx, 3.5 * u, 3.5 * u, s - 7 * u, s - 7 * u, Math.max(u, r - 2 * u));
    ctx.stroke();
    ctx.fillStyle = css(look.trim);
    for (const [cx, cy] of [[3.5, 3.5], [SIZE - 3.5, 3.5], [3.5, SIZE - 3.5], [SIZE - 3.5, SIZE - 3.5]]) {
      ctx.beginPath();
      ctx.moveTo(cx * u, (cy - 1.5) * u);
      ctx.lineTo((cx + 1.5) * u, cy * u);
      ctx.lineTo(cx * u, (cy + 1.5) * u);
      ctx.lineTo((cx - 1.5) * u, cy * u);
      ctx.closePath();
      ctx.fill();
    }
  }
  tex.refresh();
  tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

function paintBar(scene: Phaser.Scene): void {
  const k = view.res;
  const s = 8 * k;
  if (scene.textures.exists('ui_bar_bg')) scene.textures.remove('ui_bar_bg');
  const tex = scene.textures.createCanvas('ui_bar_bg', s, s);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.fillStyle = 'rgba(5,4,10,0.95)';
  rr(ctx, 0, 0, s, s, 2 * k);
  ctx.fill();
  ctx.fillStyle = '#231f38';
  rr(ctx, k, k, s - 2 * k, s - 2 * k, k);
  ctx.fill();
  tex.refresh();
  tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

/** Replace the pixel skins with hi-res ones (called after theme.createUiTextures when res > 1). */
export function createHiResSkin(scene: Phaser.Scene): void {
  if (view.res <= 1) return;
  paint(scene, 'ui_panel', { top: 0x2a2549, bottom: 0x1a1631, border: 0x4a4274, shine: 0xffffff, shineA: 0.1 });
  paint(scene, 'ui_panel_dark', { top: 0x1a172f, bottom: 0x100e20, border: 0x353052, shine: 0xffffff, shineA: 0.06 });
  paint(scene, 'ui_panel_ornate', { top: 0x2a2549, bottom: 0x16132b, border: 0xb78336, shine: 0xffe2a0, shineA: 0.25, trim: 0xe8b04b });
  paint(scene, 'ui_btn', { top: 0x4c4480, bottom: 0x2c2650, border: 0x8a80c8, shine: 0xffffff, shineA: 0.3, lip: 2, gloss: 0.12 });
  paint(scene, 'ui_btn_down', { top: 0x241f40, bottom: 0x2e2852, border: 0x5a5189, shine: 0xffffff, shineA: 0.05 });
  paint(scene, 'ui_btn_primary', { top: 0xf2913f, bottom: 0xb34f17, border: 0xffd27a, shine: 0xfff1c8, shineA: 0.55, lip: 2, lipColor: 0x3a1606, gloss: 0.18 });
  paint(scene, 'ui_btn_primary_down', { top: 0xa9481a, bottom: 0xc45f22, border: 0xd29a45, shine: 0xffffff, shineA: 0.08 });
  paint(scene, 'ui_btn_danger', { top: 0xc23a4a, bottom: 0x7e1e2c, border: 0xff8a8a, shine: 0xffd0d0, shineA: 0.45, lip: 2, lipColor: 0x2a0610, gloss: 0.14 });
  paint(scene, 'ui_btn_disabled', { top: 0x2c2a3a, bottom: 0x22202e, border: 0x444058, shine: 0xffffff, shineA: 0.04 });
  paint(scene, 'ui_slot', { top: 0x0d0b1a, bottom: 0x17142b, border: 0x3a3458, shine: 0x000000, shineA: 0.4, radius: 3 });
  paint(scene, 'ui_tab', { top: 0x1c1932, bottom: 0x131126, border: 0x3a3458, shine: 0xffffff, shineA: 0.05, radius: 3 });
  paint(scene, 'ui_tab_on', { top: 0x3a3366, bottom: 0x28234a, border: 0xe8b04b, shine: 0xffe2a0, shineA: 0.35, radius: 3, gloss: 0.1 });
  paintBar(scene);
}
