import Phaser from 'phaser';
import { COLORS, FONT } from './theme';
import { services } from '@/core/services';
import { view } from '@/core/viewport';
import { nine } from './skin';

export type FontKey = (typeof FONT)[keyof typeof FONT];

export function label(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  font: FontKey = FONT.body,
  color: number = COLORS.text,
  originX = 0,
  originY = 0,
): Phaser.GameObjects.BitmapText {
  const t = scene.add.bitmapText(Math.round(x), Math.round(y), font, text);
  t.setTint(color);
  t.setOrigin(originX, originY);
  return t;
}

/** Wrapped paragraph. */
export function para(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  maxWidth: number,
  font: FontKey = FONT.body,
  color: number = COLORS.text,
): Phaser.GameObjects.BitmapText {
  const t = label(scene, x, y, text, font, color);
  t.setMaxWidth(maxWidth);
  return t;
}

/** Single line that never overflows: trims characters and appends '..' until it fits maxWidth. */
/** Scale a text down (to at most `minScale`) so it fits a `maxWidth` x `maxHeight` box (for larger accessibility text). */
export function fitBox(t: Phaser.GameObjects.BitmapText, maxWidth: number, maxHeight = Infinity, minScale = 0.75): Phaser.GameObjects.BitmapText {
  t.setScale(1);
  const k = Math.min(1, maxWidth / Math.max(1, t.width), maxHeight / Math.max(1, t.height));
  if (k < 1) t.setScale(Math.max(minScale, k));
  return t;
}

/** Scale a text down (to at most `minScale`) so it fits `maxWidth`; used for tabs whose labels vary by language. */
export function shrinkToFit(t: Phaser.GameObjects.BitmapText, maxWidth: number, minScale = 0.8): Phaser.GameObjects.BitmapText {
  t.setScale(1);
  if (t.width > maxWidth) t.setScale(Math.max(minScale, maxWidth / t.width));
  return t;
}

/** Set `text`, shortened with "…" until it fits `maxWidth`; `suffix` (e.g. progress "3/10") always stays visible. */
export function setTextFit(t: Phaser.GameObjects.BitmapText, text: string, maxWidth: number, suffix = ''): Phaser.GameObjects.BitmapText {
  const tail = suffix ? `  ${suffix}` : '';
  t.setText(text + tail);
  let n = text.length;
  while (t.width > maxWidth && n > 1) {
    n--;
    t.setText(`${text.slice(0, n).trimEnd()}…${tail}`);
  }
  return t;
}

export function fitText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  font: FontKey,
  text: string,
  maxWidth: number,
): Phaser.GameObjects.BitmapText {
  const t = scene.add.bitmapText(Math.round(x), Math.round(y), font, text);
  let n = text.length;
  while (t.width > maxWidth && n > 1) {
    n--;
    t.setText(`${text.slice(0, n).trimEnd()}..`);
  }
  return t;
}

export function panel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  key = 'ui_panel',
): Phaser.GameObjects.NineSlice {
  const p = nine(scene, Math.round(x), Math.round(y), key, Math.round(w), Math.round(h));
  p.setOrigin(0, 0);
  return p;
}

export interface ButtonOpts {
  w?: number;
  h?: number;
  style?: 'normal' | 'primary' | 'danger' | 'ghost';
  font?: FontKey;
  icon?: { atlas: string; frame?: string; scale?: number; tint?: number };
  color?: number;
  sfx?: string;
  disabled?: boolean;
  haptic?: boolean;
}

export class Button extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.NineSlice;
  readonly text: Phaser.GameObjects.BitmapText;
  private icon?: Phaser.GameObjects.Image;
  private upKey: string;
  private downKey: string;
  private enabled = true;
  private pressed = false;
  readonly bw: number;
  readonly bh: number;

  constructor(scene: Phaser.Scene, x: number, y: number, caption: string, private onClick: () => void, opts: ButtonOpts = {}) {
    super(scene, Math.round(x), Math.round(y));
    const style = opts.style ?? 'normal';
    this.upKey = style === 'primary' ? 'ui_btn_primary' : style === 'danger' ? 'ui_btn_danger' : style === 'ghost' ? 'ui_panel_dark' : 'ui_btn';
    this.downKey = style === 'primary' ? 'ui_btn_primary_down' : 'ui_btn_down';
    this.bw = opts.w ?? 140;
    this.bh = opts.h ?? 28;
    this.bg = nine(scene, 0, 0, this.upKey, this.bw, this.bh);
    this.add(this.bg);
    let textX = 0;
    if (opts.icon) {
      const iconScale = opts.icon.scale ?? 1;
      this.icon = scene.add.image(0, 0, opts.icon.atlas, opts.icon.frame).setScale(iconScale);
      if (opts.icon.tint !== undefined) this.icon.setTint(opts.icon.tint);
      this.add(this.icon);
    }
    this.text = scene.add.bitmapText(0, 0, opts.font ?? FONT.head, caption).setOrigin(0.5, 0.5);
    this.text.setTint(opts.color ?? COLORS.text);
    this.fitCaption();
    this.add(this.text);
    if (this.icon) {
      const total = this.icon.displayWidth + 4 + this.text.width;
      this.icon.setPosition(Math.round(-total / 2 + this.icon.displayWidth / 2), 0);
      textX = Math.round(-total / 2 + this.icon.displayWidth + 4 + this.text.width / 2);
    }
    this.text.setPosition(textX, -1);
    this.setSize(this.bw, this.bh);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => {
      if (!this.enabled) return;
      this.pressed = true;
      this.bg.setTexture(this.downKey);
      this.bg.y = 1;
      this.text.y += 1;
      if (this.icon) this.icon.y = 1;
      this.scene.tweens.killTweensOf(this);
      this.scene.tweens.add({ targets: this, scaleX: 0.96, scaleY: 0.94, duration: 60, ease: 'Quad.easeOut' });
    });
    const release = (fire: boolean) => {
      if (!this.pressed) return;
      this.pressed = false;
      this.bg.setTexture(this.upKey);
      this.bg.y = 0;
      this.text.y -= 1;
      if (this.icon) this.icon.y = 0;
      this.scene.tweens.killTweensOf(this);
      this.scene.tweens.add({ targets: this, scaleX: 1, scaleY: 1, duration: 140, ease: 'Back.easeOut' });
      if (fire && this.enabled) {
        services.audio?.sfx(opts.sfx ?? 'ui_click');
        if (opts.haptic !== false) services.platform?.haptic('light');
        this.onClick();
      }
    };
    this.on('pointerup', () => release(true));
    this.on('pointerout', () => release(false));
    if (opts.disabled) this.setEnabled(false);
    scene.add.existing(this);
  }

  setEnabled(on: boolean): this {
    this.enabled = on;
    this.bg.setTexture(on ? this.upKey : 'ui_btn_disabled');
    this.text.setAlpha(on ? 1 : 0.5);
    this.icon?.setAlpha(on ? 1 : 0.5);
    return this;
  }

  setCaption(s: string): this {
    this.text.setText(s);
    this.fitCaption();
    return this;
  }

  /** Long captions (other languages, larger text) shrink to stay inside the button. */
  private fitCaption(): void {
    fitBox(this.text, this.bw - 10 - (this.icon ? this.icon.displayWidth + 4 : 0), this.bh - 2);
  }

  setHandler(fn: () => void): this {
    this.onClick = fn;
    return this;
  }
}

/** Horizontal bar (HP, XP, boss). Fill is a tinted white image so any colour works. */
export class Bar extends Phaser.GameObjects.Container {
  private fill: Phaser.GameObjects.Image;
  private ghost: Phaser.GameObjects.Image;
  private innerW: number;
  private value = 1;

  constructor(scene: Phaser.Scene, x: number, y: number, readonly barW: number, private barH: number, color: number) {
    super(scene, Math.round(x), Math.round(y));
    const bg = nine(scene, 0, 0, 'ui_bar_bg', barW, barH).setOrigin(0, 0);
    this.innerW = barW - 2;
    this.ghost = scene.add.image(1, 1, 'ui_white').setOrigin(0, 0).setTint(0xffffff).setAlpha(0.6);
    this.fill = scene.add.image(1, 1, 'ui_white').setOrigin(0, 0).setTint(color);
    this.ghost.setDisplaySize(this.innerW, barH - 2);
    this.fill.setDisplaySize(this.innerW, barH - 2);
    const shine = scene.add.image(1, 1, 'ui_white').setOrigin(0, 0).setAlpha(0.25).setDisplaySize(this.innerW, 1);
    this.add([bg, this.ghost, this.fill, shine]);
    scene.add.existing(this);
  }

  setColor(c: number): this {
    this.fill.setTint(c);
    return this;
  }

  setValue(ratio: number, animate = true): this {
    const r = Phaser.Math.Clamp(ratio, 0, 1);
    const prev = this.value;
    this.value = r;
    this.fill.setDisplaySize(Math.max(0, Math.round(this.innerW * r)), this.barH - 2);
    if (!animate || r >= prev) {
      this.ghost.setDisplaySize(Math.round(this.innerW * r), this.barH - 2);
      return this;
    }
    this.scene.tweens.killTweensOf(this.ghost);
    this.scene.tweens.add({
      targets: this.ghost,
      displayWidth: Math.round(this.innerW * r),
      duration: 400,
      delay: 180,
      ease: 'Quad.easeOut',
    });
    return this;
  }

}

/** Short floating message at the top of the screen. */
export function toast(scene: Phaser.Scene, message: string, color: number = COLORS.text, y = 60): void {
  const w = view.w;
  const t = scene.add.bitmapText(w / 2, y, FONT.body, message).setOrigin(0.5).setTint(color).setDepth(10000);
  t.setMaxWidth(w - 40);
  const bg = nine(scene, w / 2, y, 'ui_panel_dark', Math.min(w - 20, t.width + 20), t.height + 10)
    .setDepth(9999)
    .setAlpha(0.92);
  t.setScrollFactor(0);
  bg.setScrollFactor(0);
  const items = [bg, t];
  for (const o of items) o.setAlpha(0);
  scene.tweens.add({ targets: items, alpha: 1, y: y + 4, duration: 180 });
  scene.tweens.add({
    targets: items,
    alpha: 0,
    y: y - 10,
    delay: 1800,
    duration: 300,
    onComplete: () => items.forEach((o) => o.destroy()),
  });
}

/** Fullscreen dimmer that blocks input beneath an overlay. */
export function dimmer(scene: Phaser.Scene, alpha = 0.7, onTap?: () => void): Phaser.GameObjects.Rectangle {
  const r = scene.add.rectangle(0, 0, view.w, view.h, COLORS.bg0, alpha).setOrigin(0, 0);
  r.setInteractive();
  if (onTap) r.on('pointerup', onTap);
  return r;
}
