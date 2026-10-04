import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import type { GameScene } from './GameScene';
import { t, tr } from '@/core/i18n';
import { view } from '@/core/viewport';
import { QUESTS } from '@/data/quests';
import { progressOf } from '@/sim/quests';
import { COLORS, FONT } from '@/ui/theme';
import { Button, label, panel, para } from '@/ui/widgets';

/** The quest log: the main chapter, the side quests that are running, and the ones that are done. The island waits while it is open. */
export class QuestsScene extends BaseScene {
  private world!: GameScene;
  private ui!: Phaser.GameObjects.Container;

  constructor() {
    super('Quests');
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

  /** One running quest: its title, what to do now, and how far along that is. */
  private entry(id: string, y: number): number {
    const s = this.world.session;
    const def = QUESTS[id];
    const run = s.quests.active[id];
    const p = progressOf(s.quests, QUESTS, id, s.inventory);
    const step = tr(def.steps[run.step].text);
    const count = p.need > 1 ? `  ${t('questProgress', { have: p.have, need: p.need })}` : '';
    this.ui.add(label(this, 18, y, tr(def.title), FONT.body, def.kind === 'main' ? COLORS.gold : COLORS.text));
    const body = para(this, 26, y + 16, `${step}${count}`, view.w - 52, FONT.small, COLORS.textDim);
    this.ui.add(body);
    return y + 16 + body.height + 10;
  }

  private render(): void {
    this.ui.removeAll(true);
    const { w: W, h: H } = view;
    const q = this.world.session.quests;
    this.ui.add(this.add.rectangle(0, 0, W, H, COLORS.bg0, 0.9).setOrigin(0, 0).setInteractive());
    this.ui.add(panel(this, 6, 6, W - 12, H - 12, 'ui_panel_dark'));
    this.ui.add(label(this, 16, 14, t('questLog'), FONT.head, COLORS.gold));
    this.ui.add(new Button(this, W - 30, 24, 'X', () => this.close(), { w: 34, h: 26, style: 'danger' }));
    let y = 54;
    const main = Object.keys(q.active).filter((id) => QUESTS[id]?.kind === 'main');
    const side = Object.keys(q.active).filter((id) => QUESTS[id]?.kind === 'side');
    if (main.length + side.length === 0) {
      this.ui.add(para(this, 18, y, t('questNone'), W - 36, FONT.body, COLORS.textDim));
    }
    if (main.length > 0) {
      this.ui.add(label(this, 16, y, t('questMain'), FONT.small, COLORS.textDim));
      y += 16;
      for (const id of main) y = this.entry(id, y);
    }
    if (side.length > 0) {
      this.ui.add(label(this, 16, y, t('questSide'), FONT.small, COLORS.textDim));
      y += 16;
      for (const id of side) y = this.entry(id, y);
    }
    if (q.done.length > 0) {
      this.ui.add(label(this, 16, y + 4, t('questDoneHeader'), FONT.small, COLORS.textDim));
      this.ui.add(para(this, 18, y + 20, q.done.map((id) => tr(QUESTS[id].title)).join(', '), W - 36, FONT.small, COLORS.textDim));
    }
  }
}
