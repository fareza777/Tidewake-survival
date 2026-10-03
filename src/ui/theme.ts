import Phaser from 'phaser';

export const COLORS = {
  bg0: 0x0b0a14,
  bg1: 0x15132a,
  panel: 0x1d1a33,
  panel2: 0x262243,
  border: 0x3c3563,
  borderLight: 0x5a5189,
  gold: 0xe8b04b,
  goldDark: 0x9c6b2a,
  text: 0xf4ecd8,
  textDim: 0xa79fc2,
  red: 0xe0524f,
  green: 0x6bd46b,
  blue: 0x5fa8ff,
  purple: 0xb77cff,
  orange: 0xff9a3c,
  cyan: 0x5ee2e2,
  ember: 0xff7a2f,
  black: 0x000000,
  white: 0xffffff,
} as const;

export const RARITY_COLORS = [0xd8d4e6, 0x5fa8ff, 0xffd84a, 0xb77cff, 0xff9a3c, 0xff4f6d] as const;

export const FONT = {
  body: 'body',
  bodyPlain: 'bodyplain',
  head: 'head',
  title: 'title',
  small: 'small',
  smallPlain: 'smallplain',
} as const;

/** Logical (virtual-pixel) size of each font. Hi-res atlases allow in-between sizes; 1x atlases use native sizes. */
let textScale = 1;

/** Accessibility: enlarge body and small text (hi-res atlases only; 1x atlases have fixed pixel sizes). */
export function setTextScale(k: number): void {
  textScale = k;
}

export function fontSize(key: string, res: number): number {
  const hi = res > 1;
  const sizes: Record<string, number> = hi
    ? { body: 16, bodyplain: 16, head: 18, title: 22, small: 12, smallplain: 12 }
    : { body: 15, bodyplain: 15, head: 20, title: 20, small: 8, smallplain: 8 };
  const size = sizes[key] ?? sizes.body;
  const scalable = key === 'body' || key === 'bodyplain' || key === 'small' || key === 'smallplain';
  return hi && scalable ? Math.round(size * textScale) : size;
}

/** Atlas suffix for the render scale: hi-res atlases put every glyph exactly on device pixels. */
export function fontSuffix(res: number): string {
  return res > 1 ? `@${Math.min(4, res)}x` : '';
}

/**
 * BitmapText normally renders at its atlas size. Atlases are baked at the render scale, so default every text to its
 * logical size; setMaxWidth, width and positions then stay in virtual pixels everywhere.
 */
export function installBitmapTextDefaults(res: number): void {
  const Factory = Phaser.GameObjects.GameObjectFactory;
  Factory.remove('bitmapText');
  Factory.register('bitmapText', function (
    this: Phaser.GameObjects.GameObjectFactory, x: number, y: number, font: string, text?: string | string[], size?: number, align?: number,
  ) {
    return this.displayList.add(new Phaser.GameObjects.BitmapText(this.scene, x, y, font, text, size ?? fontSize(font, res), align));
  });
}

function hex(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}

type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

function makeTexture(scene: Phaser.Scene, key: string, w: number, h: number, paint: Painter): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  paint(ctx, w, h);
  tex.refresh();
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: number, a = 1): void {
  ctx.globalAlpha = a;
  ctx.fillStyle = hex(c);
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
}

/** Framed pixel panel: dark outline, coloured border, bevel highlight. Used as a 9-slice with 6px corners. */
function panelPainter(fill: number, border: number, light: number, shadow: number = COLORS.bg0): Painter {
  return (ctx, w, h) => {
    rect(ctx, 1, 0, w - 2, h, shadow);
    rect(ctx, 0, 1, w, h - 2, shadow);
    rect(ctx, 1, 1, w - 2, h - 2, border);
    rect(ctx, 2, 2, w - 4, h - 4, fill);
    rect(ctx, 2, 2, w - 4, 1, light);
    rect(ctx, 2, 2, 1, h - 4, light, 0.6);
    rect(ctx, 2, h - 3, w - 4, 1, shadow, 0.5);
    rect(ctx, 1, 1, 1, 1, shadow);
    rect(ctx, w - 2, 1, 1, 1, shadow);
    rect(ctx, 1, h - 2, 1, 1, shadow);
    rect(ctx, w - 2, h - 2, 1, 1, shadow);
  };
}

/** Ornate gold-trimmed panel for important windows (dialogue, rewards). */
const ornatePainter: Painter = (ctx, w, h) => {
  panelPainter(COLORS.panel, COLORS.goldDark, COLORS.gold)(ctx, w, h);
  rect(ctx, 3, 3, w - 6, 1, COLORS.border);
  rect(ctx, 3, h - 4, w - 6, 1, COLORS.border);
  for (const [x, y] of [[3, 3], [w - 5, 3], [3, h - 5], [w - 5, h - 5]]) {
    rect(ctx, x, y, 2, 2, COLORS.gold);
  }
};

/** Soft gradients are filtered linearly so they stay smooth when stretched (pixel art stays NEAREST). */
const SMOOTH_TEXTURES = ['fx_light', 'fx_edge', 'fx_vignette'];

export function createUiTextures(scene: Phaser.Scene): void {
  makeTexture(scene, 'ui_panel', 16, 16, panelPainter(COLORS.panel, COLORS.border, COLORS.borderLight));
  makeTexture(scene, 'ui_panel_dark', 16, 16, panelPainter(COLORS.bg1, COLORS.border, COLORS.panel2));
  makeTexture(scene, 'ui_panel_ornate', 16, 16, ornatePainter);
  makeTexture(scene, 'ui_btn', 16, 16, panelPainter(COLORS.panel2, COLORS.borderLight, 0x7d73b8));
  makeTexture(scene, 'ui_btn_down', 16, 16, panelPainter(COLORS.bg1, COLORS.border, COLORS.panel));
  makeTexture(scene, 'ui_btn_primary', 16, 16, panelPainter(0xb8561d, COLORS.gold, 0xffc27a, 0x3a1606));
  makeTexture(scene, 'ui_btn_primary_down', 16, 16, panelPainter(0x8a3d12, COLORS.goldDark, 0xb8561d, 0x3a1606));
  makeTexture(scene, 'ui_btn_danger', 16, 16, panelPainter(0x8f2a3a, 0xe0524f, 0xff8a8a, 0x2a0610));
  makeTexture(scene, 'ui_btn_disabled', 16, 16, panelPainter(0x2a2838, 0x44405a, 0x3a3650));
  makeTexture(scene, 'ui_slot', 16, 16, panelPainter(0x120f22, COLORS.border, 0x1d1a33));
  makeTexture(scene, 'ui_tab', 16, 16, panelPainter(COLORS.bg1, COLORS.border, COLORS.panel2));
  makeTexture(scene, 'ui_tab_on', 16, 16, panelPainter(COLORS.panel2, COLORS.gold, 0x7d73b8));
  makeTexture(scene, 'ui_bar_bg', 8, 8, (ctx, w, h) => {
    rect(ctx, 0, 0, w, h, COLORS.bg0);
    rect(ctx, 1, 1, w - 2, h - 2, 0x2b2540);
  });
  makeTexture(scene, 'ui_white', 4, 4, (ctx, w, h) => rect(ctx, 0, 0, w, h, COLORS.white));
  makeTexture(scene, 'ui_pixel', 1, 1, (ctx) => rect(ctx, 0, 0, 1, 1, COLORS.white));

  // Soft radial light used for additive glows and for carving the darkness mask.
  makeTexture(scene, 'fx_light', 128, 128, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.65)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  });
  // Stepped (posterized) light keeps the pixel-art look when drawn at low resolution.
  makeTexture(scene, 'fx_light_px', 64, 64, (ctx, w) => {
    const c = w / 2;
    for (let y = 0; y < w; y++) {
      for (let x = 0; x < w; x++) {
        const d = Math.hypot(x + 0.5 - c, y + 0.5 - c) / c;
        if (d >= 1) continue;
        const a = d < 0.45 ? 1 : d < 0.65 ? 0.7 : d < 0.82 ? 0.42 : 0.18;
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });
  makeTexture(scene, 'fx_dot', 3, 3, (ctx) => {
    rect(ctx, 1, 0, 1, 3, COLORS.white);
    rect(ctx, 0, 1, 3, 1, COLORS.white);
  });
  makeTexture(scene, 'fx_px2', 2, 2, (ctx) => rect(ctx, 0, 0, 2, 2, COLORS.white));
  makeTexture(scene, 'fx_ring', 32, 32, (ctx, w) => {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w / 2, w / 2, w / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
  });
  makeTexture(scene, 'fx_shadow', 16, 6, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(8, 3, 7, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  // White screen-edge glow: tint it (e.g. red when hurt). fx_vignette is black and would stay black when tinted.
  makeTexture(scene, 'fx_edge', 64, 64, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, w * 0.3, w / 2, w / 2, w * 0.72);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,0.9)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  });
  makeTexture(scene, 'fx_vignette', 64, 64, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, w * 0.25, w / 2, w / 2, w * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  });
  for (const key of SMOOTH_TEXTURES) scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
}
