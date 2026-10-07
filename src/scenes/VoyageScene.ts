import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import type { GameScene } from './GameScene';
import { t } from '@/core/i18n';
import { view } from '@/core/viewport';
import { ISLAND_IDS, islandNeeds } from '@/sim/islands';
import { dungeonOf } from '@/data/islands';
import type { IslandId } from '@/sim/world/types';
import { COLORS, FONT } from '@/ui/theme';
import { Button, label, panel, para } from '@/ui/widgets';

/** The sea chart: every island, which of them the boat can reach, and a button to set sail. The island waits while it is open. */
export class VoyageScene extends BaseScene {
  private world!: GameScene;
  private ui!: Phaser.GameObjects.Container;

  constructor() {
    super('Voyage');
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

  private go(id: IslandId): void {
    this.scene.stop();
    this.scene.resume('Game');
    this.world.setSail(id);
  }

  private card(id: IslandId, y: number, h: number): void {
    const { w: W } = view;
    const s = this.world.session;
    const needs = islandNeeds(s.dungeons, id);
    const here = s.island === id;
    const done = dungeonOf(id) !== null && s.dungeons[dungeonOf(id)!].boss;
    this.ui.add(panel(this, 12, y, W - 24, h, here ? 'ui_panel' : 'ui_panel_dark'));
    this.ui.add(this.add.rectangle(20, y + 8, 6, h - 16, ISLAND_COLOR[id]).setOrigin(0, 0));
    this.ui.add(label(this, 36, y + 8, t(`island_${id}`), FONT.head, needs ? COLORS.textDim : COLORS.gold));
    this.ui.add(para(this, 36, y + 28, t(needs ?? `island_${id}_about`), W - 36 - 100, FONT.small, COLORS.textDim));
    if (done) this.ui.add(label(this, 36, y + h - 18, t('islandConquered'), FONT.small, COLORS.gold));
    if (here) this.ui.add(label(this, W - 24, y + h / 2, t('islandHere'), FONT.small, COLORS.textDim).setOrigin(1, 0.5));
    else if (!needs) this.ui.add(new Button(this, W - 62, y + h / 2, t('setSail'), () => this.go(id), { w: 84, h: 30, style: 'primary' }));
  }

  private render(): void {
    this.ui.removeAll(true);
    const { w: W, h: H } = view;
    this.ui.add(this.add.rectangle(0, 0, W, H, COLORS.bg0, 0.92).setOrigin(0, 0).setInteractive());
    this.ui.add(panel(this, 6, 6, W - 12, H - 12, 'ui_panel_dark'));
    this.ui.add(label(this, 16, 14, t('voyageTitle'), FONT.head, COLORS.gold));
    this.ui.add(new Button(this, W - 30, 24, 'X', () => this.close(), { w: 34, h: 26, style: 'danger' }));
    const gap = 8;
    const h = Math.min(92, Math.floor((H - 70 - gap * (ISLAND_IDS.length - 1)) / ISLAND_IDS.length));
    ISLAND_IDS.forEach((id, i) => this.card(id, 50 + i * (h + gap), h));
  }
}

const ISLAND_COLOR: Record<IslandId, number> = { home: 0x4f9a52, frost: 0xbfe4ff, ember: 0xe0602a, wreck: 0x4f8f86, sky: 0xb7a2ff };
