import Phaser from 'phaser';
import { services } from '@/core/services';

/**
 * Menu icons drawn as smooth vector shapes (96 px canvases, shown at 16-30 virtual px): cream glyphs with a dark outline,
 * so they stay readable on any background. Textures are named `ui_ico_<name>`; round button plates are `ui_icobtn` and `ui_icobtn_down`.
 */
const SIZE = 96;
const CREAM = '#f7ecd0';
const OUTLINE = '#1a1630';
const DETAIL = '#8f7a52';
const GOLD = '#e8b04b';

type Draw = (ctx: CanvasRenderingContext2D) => void;

/** A shape that is first outlined in dark, then filled, so it reads on light and dark plates alike. */
function glyph(ctx: CanvasRenderingContext2D, path: (c: CanvasRenderingContext2D) => void, fill = CREAM, evenOdd = false): void {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  path(ctx);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 9;
  ctx.stroke();
  ctx.fillStyle = fill;
  if (evenOdd) ctx.fill('evenodd');
  else ctx.fill();
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

const DRAWERS: Record<string, Draw> = {
  pause: (ctx) => {
    glyph(ctx, (c) => { roundRect(c, 26, 22, 17, 52, 6); roundRect(c, 53, 22, 17, 52, 6); });
  },
  gear: (ctx) => {
    glyph(ctx, (c) => {
      const teeth = 8;
      for (let i = 0; i < teeth * 2; i++) {
        const a = (i / (teeth * 2)) * Math.PI * 2 - Math.PI / (teeth * 2);
        const half = Math.PI / (teeth * 4.4);
        const r = i % 2 === 0 ? 39 : 29;
        for (const da of [-half, half]) c.lineTo(48 + Math.cos(a + da) * r, 48 + Math.sin(a + da) * r);
      }
      c.closePath();
      c.moveTo(48 + 12, 48);
      c.arc(48, 48, 12, 0, Math.PI * 2, true);
    }, CREAM, true);
  },
  bag: (ctx) => {
    glyph(ctx, (c) => { c.moveTo(34, 30); c.arc(48, 30, 14, Math.PI, 0); });
    glyph(ctx, (c) => roundRect(c, 24, 28, 48, 54, 14));
    ctx.fillStyle = DETAIL;
    ctx.beginPath();
    roundRect(ctx, 33, 52, 30, 22, 7);
    ctx.fill();
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(48, 62, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = DETAIL;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(30, 44);
    ctx.lineTo(66, 44);
    ctx.stroke();
  },
  quest: (ctx) => {
    glyph(ctx, (c) => roundRect(c, 25, 18, 46, 62, 7));
    glyph(ctx, (c) => { roundRect(c, 19, 12, 58, 14, 7); roundRect(c, 19, 72, 58, 14, 7); }, GOLD);
    ctx.strokeStyle = DETAIL;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    for (const y of [38, 49, 60]) {
      ctx.beginPath();
      ctx.moveTo(34, y);
      ctx.lineTo(62, y);
      ctx.stroke();
    }
  },
  close: (ctx) => {
    glyph(ctx, (c) => { c.moveTo(26, 26); c.lineTo(70, 70); c.moveTo(70, 26); c.lineTo(26, 70); });
    ctx.strokeStyle = CREAM;
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(26, 26);
    ctx.lineTo(70, 70);
    ctx.moveTo(70, 26);
    ctx.lineTo(26, 70);
    ctx.stroke();
  },
  run: (ctx) => {
    for (const dx of [0, 24]) {
      glyph(ctx, (c) => { c.moveTo(16 + dx, 22); c.lineTo(40 + dx, 48); c.lineTo(16 + dx, 74); c.lineTo(28 + dx, 74); c.lineTo(52 + dx, 48); c.lineTo(28 + dx, 22); c.closePath(); }, dx === 0 ? GOLD : CREAM);
    }
  },
  pickup: (ctx) => {
    glyph(ctx, (c) => { c.moveTo(48, 14); c.lineTo(72, 40); c.lineTo(57, 40); c.lineTo(57, 60); c.lineTo(39, 60); c.lineTo(39, 40); c.lineTo(24, 40); c.closePath(); });
    glyph(ctx, (c) => roundRect(c, 20, 68, 56, 14, 6), GOLD);
  },
  info: (ctx) => {
    glyph(ctx, (c) => c.arc(48, 48, 34, 0, Math.PI * 2));
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.arc(48, 31, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    roundRect(ctx, 43, 42, 10, 28, 4);
    ctx.fill();
  },
  share: (ctx) => {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 15;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(68, 26);
    ctx.lineTo(28, 48);
    ctx.lineTo(68, 70);
    ctx.stroke();
    ctx.strokeStyle = CREAM;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(68, 26);
    ctx.lineTo(28, 48);
    ctx.lineTo(68, 70);
    ctx.stroke();
    for (const [x, y] of [[68, 26], [28, 48], [68, 70]]) glyph(ctx, (c) => c.arc(x, y, 12, 0, Math.PI * 2), GOLD);
  },
  star: (ctx) => {
    glyph(ctx, (c) => {
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? 38 : 16;
        c.lineTo(48 + Math.cos(a) * r, 50 + Math.sin(a) * r);
      }
      c.closePath();
    }, GOLD);
  },
  play: (ctx) => {
    glyph(ctx, (c) => { c.moveTo(32, 20); c.lineTo(72, 48); c.lineTo(32, 76); c.closePath(); }, GOLD);
  },
  back: (ctx) => {
    glyph(ctx, (c) => { c.moveTo(60, 18); c.lineTo(30, 48); c.lineTo(60, 78); c.lineTo(68, 70); c.lineTo(46, 48); c.lineTo(68, 26); c.closePath(); });
  },
};

export const ICON_NAMES = Object.keys(DRAWERS);

function canvasTexture(scene: Phaser.Scene, key: string, draw: Draw): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, SIZE, SIZE);
  if (!tex) return;
  const ctx = tex.getContext();
  draw(ctx);
  tex.refresh();
  tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

/** The round plate behind an icon: a navy disc with a gold rim and a soft shine; the pressed one is darker and flatter. */
function plate(pressed: boolean): Draw {
  return (ctx) => {
    const c = SIZE / 2;
    const y = pressed ? c + 2 : c;
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath();
    ctx.arc(c, y + (pressed ? 2 : 5), 42, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createLinearGradient(0, y - 42, 0, y + 42);
    g.addColorStop(0, pressed ? '#2a2552' : '#4a4390');
    g.addColorStop(1, pressed ? '#15122c' : '#231e47');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c, y, 41, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(c, y, 35, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  };
}

export function createIconTextures(scene: Phaser.Scene): void {
  for (const [name, draw] of Object.entries(DRAWERS)) canvasTexture(scene, `ui_ico_${name}`, draw);
  canvasTexture(scene, 'ui_icobtn', plate(false));
  canvasTexture(scene, 'ui_icobtn_down', plate(true));
}

/** The icon texture key and the scale that shows it `size` virtual pixels wide (use as a Button `icon`). */
export function iconOf(name: string, size = 16): { atlas: string; scale: number } {
  return { atlas: `ui_ico_${name}`, scale: size / SIZE };
}

/**
 * A round, finger-sized button with an icon on it. `size` is the plate in virtual pixels; the touch area is a little
 * bigger than what is drawn. Pressing it sinks and brightens, and `setActive` lights it up (a switched-on Run).
 */
export class IconButton extends Phaser.GameObjects.Container {
  private plate: Phaser.GameObjects.Image;
  private glyph: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private pressed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, name: string, private onClick: () => void, readonly size = 46) {
    super(scene, Math.round(x), Math.round(y));
    this.glow = scene.add.image(0, 0, 'fx_light').setTint(0x6bd46b).setAlpha(0).setDisplaySize(size * 1.9, size * 1.9);
    this.plate = scene.add.image(0, 0, 'ui_icobtn').setDisplaySize(size * 1.08, size * 1.08);
    this.glyph = scene.add.image(0, -1, `ui_ico_${name}`).setDisplaySize(size * 0.6, size * 0.6);
    this.add([this.glow, this.plate, this.glyph]);
    const hit = size + 10;
    this.setSize(hit, hit);
    this.setInteractive(new Phaser.Geom.Circle(hit / 2, hit / 2, hit / 2), Phaser.Geom.Circle.Contains);
    this.on('pointerdown', () => {
      this.pressed = true;
      this.plate.setTexture('ui_icobtn_down');
      this.scene.tweens.killTweensOf(this);
      this.scene.tweens.add({ targets: this, scale: 0.9, duration: 60, ease: 'Quad.easeOut' });
    });
    const release = (fire: boolean): void => {
      if (!this.pressed) return;
      this.pressed = false;
      this.plate.setTexture('ui_icobtn');
      this.scene.tweens.killTweensOf(this);
      this.scene.tweens.add({ targets: this, scale: 1, duration: 160, ease: 'Back.easeOut' });
      if (!fire) return;
      services.audio?.sfx('ui_click');
      services.platform?.haptic('light');
      this.onClick();
    };
    this.on('pointerup', () => release(true));
    this.on('pointerout', () => release(false));
    scene.add.existing(this);
  }

  /** Switched on (a green glow behind it) or off. */
  setActive(on: boolean): this {
    this.glow.setAlpha(on ? 0.75 : 0);
    return this;
  }

  setIcon(name: string): this {
    this.glyph.setTexture(`ui_ico_${name}`);
    return this;
  }
}
