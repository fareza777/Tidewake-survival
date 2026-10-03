import Phaser from 'phaser';
import { COLORS, FONT } from './theme';
import { Button, dimmer, panel } from './widgets';
import { t } from '@/core/i18n';
import { services } from '@/core/services';
import { view } from '@/core/viewport';

export interface ModalButton {
  label: string;
  style?: 'normal' | 'primary' | 'danger';
  onClick?: () => void;
}

/** Centered modal with a title, wrapped body text and up to 3 buttons. Returns a close function. */
export function showModal(
  scene: Phaser.Scene,
  title: string,
  body: string,
  buttons: ModalButton[],
  depth = 20000,
): () => void {
  const W = view.w;
  const H = view.h;
  const container = scene.add.container(0, 0).setDepth(depth).setScrollFactor(0);
  const close = () => {
    unregister?.();
    scene.tweens.add({ targets: container, alpha: 0, duration: 120, onComplete: () => container.destroy() });
  };
  const dim = dimmer(scene, 0.72);
  const pw = Math.min(W - 32, 300);
  const bodyText = scene.add.bitmapText(0, 0, FONT.body, body).setMaxWidth(pw - 28).setTint(COLORS.text);
  const titleText = scene.add.bitmapText(0, 0, FONT.head, title).setTint(COLORS.gold).setOrigin(0.5, 0);
  const btnH = 28;
  const ph = 18 + titleText.height + 10 + bodyText.height + 16 + btnH + 16;
  const px = Math.round((W - pw) / 2);
  const py = Math.round((H - ph) / 2);
  const bg = panel(scene, px, py, pw, ph, 'ui_panel_ornate');
  titleText.setPosition(W / 2, py + 14);
  bodyText.setPosition(px + 14, py + 18 + titleText.height + 8);
  container.add([dim, bg, titleText, bodyText]);
  const n = buttons.length;
  const gap = 8;
  const bw = Math.floor((pw - 28 - gap * (n - 1)) / n);
  buttons.forEach((b, i) => {
    const bx = px + 14 + i * (bw + gap) + bw / 2;
    const by = py + ph - 16 - btnH / 2;
    const btn = new Button(scene, bx, by, b.label, () => {
      close();
      b.onClick?.();
    }, { w: bw, h: btnH, style: b.style ?? 'normal' });
    container.add(btn);
  });
  container.setAlpha(0);
  scene.tweens.add({ targets: container, alpha: 1, duration: 150 });
  const unregister = services.platform?.onBack(() => {
    close();
    return true;
  });
  return close;
}

export function confirm(scene: Phaser.Scene, title: string, body: string, onYes: () => void, danger = false): void {
  showModal(scene, title, body, [
    { label: t('cancel') },
    { label: t('confirm'), style: danger ? 'danger' : 'primary', onClick: onYes },
  ]);
}
