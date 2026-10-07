import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import type { GameScene } from './GameScene';
import { t, tr } from '@/core/i18n';
import { view } from '@/core/viewport';
import { isItemId } from '@/data/items';
import { JOBS, JOB_DEFS, MAX_SETTLERS, hireCost, type Job } from '@/data/settlers';
import { goldOf } from '@/sim/shop';
import { itemIcon } from '@/ui/itemIcon';
import { nine } from '@/ui/skin';
import { COLORS, FONT } from '@/ui/theme';
import { Button, label, panel } from '@/ui/widgets';

/** The camp ledger: the settlers who work for the hero, what they bring in each day, and who else can be hired. */
export class CampScene extends BaseScene {
  private world!: GameScene;
  private ui!: Phaser.GameObjects.Container;

  constructor() {
    super('Camp');
  }

  create(data: { game: GameScene }): void {
    this.world = data.game;
    this.transitioning = false;
    this.ui = this.add.container(0, 0);
    this.handleBack(() => {
      this.close();
      return true;
    });
    this.render();
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume('Game');
  }

  private hireRow(job: Job, y: number, cost: number, canHire: boolean): void {
    const { w: W } = view;
    const def = JOB_DEFS[job];
    this.ui.add(nine(this, 12, y, 'ui_panel', W - 24, 40).setOrigin(0, 0));
    this.ui.add(label(this, 20, y + 5, tr(def.name), FONT.body, COLORS.text));
    this.ui.add(label(this, 20, y + 22, tr(def.about), FONT.small, COLORS.textDim));
    const ok = canHire && goldOf(this.world.session) >= cost;
    this.ui.add(new Button(this, W - 60, y + 20, `${cost}`, () => {
      this.world.hireSettler(job);
      this.render();
    }, { w: 80, h: 26, font: FONT.small, style: ok ? 'primary' : 'normal', disabled: !ok, icon: { atlas: 'icons', frame: 'gold', scale: 0.8 } }));
  }

  private render(): void {
    this.ui.removeAll(true);
    const { w: W, h: H } = view;
    const s = this.world.session;
    this.ui.add(this.add.rectangle(0, 0, W, H, COLORS.bg0, 0.92).setOrigin(0, 0).setInteractive());
    this.ui.add(panel(this, 6, 6, W - 12, H - 12, 'ui_panel_dark'));
    this.ui.add(label(this, 16, 14, t('campTitle'), FONT.head, COLORS.gold));
    this.ui.add(new Button(this, W - 30, 24, 'X', () => this.close(), { w: 34, h: 26, style: 'danger' }));
    this.ui.add(label(this, 16, 50, t('campSettlers', { n: s.settlers.length, m: MAX_SETTLERS }), FONT.small, COLORS.textDim));
    const names = s.settlers.length === 0 ? t('campNobody') : s.settlers.map((j) => tr(JOB_DEFS[j].name)).join(', ');
    this.ui.add(label(this, 16, 66, names, FONT.body, COLORS.text));

    this.ui.add(label(this, 16, 96, t('campStore'), FONT.small, COLORS.textDim));
    const items = Object.entries(s.store).filter(([k, n]) => isItemId(k) && n > 0);
    if (items.length === 0) this.ui.add(label(this, 16, 114, t('campEmpty'), FONT.small, COLORS.textDim));
    items.slice(0, 12).forEach(([item, qty], i) => {
      const x = 28 + (i % 6) * 54;
      const y = 124 + Math.floor(i / 6) * 34;
      if (!isItemId(item)) return;
      this.ui.add(itemIcon(this, x, y, item, 22));
      this.ui.add(label(this, x + 12, y + 8, String(qty), FONT.small, COLORS.white, 1, 1));
    });
    this.ui.add(new Button(this, W / 2, 200, t('campCollect'), () => {
      this.world.collectStore();
      this.render();
    }, { w: 150, h: 28, style: items.length > 0 ? 'primary' : 'normal', disabled: items.length === 0 }));

    this.ui.add(label(this, 16, 236, t('campHire'), FONT.small, COLORS.textDim));
    const cost = hireCost(s.settlers.length);
    JOBS.forEach((job, i) => this.hireRow(job, 254 + i * 46, cost, s.settlers.length < MAX_SETTLERS));
    this.ui.add(itemIcon(this, W - 124, 24, 'gold', 20));
    this.ui.add(label(this, W - 110, 24, String(goldOf(s)), FONT.head, COLORS.gold, 0, 0.5));
  }
}
