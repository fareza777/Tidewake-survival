import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import type { GameScene } from './GameScene';
import { t, tr } from '@/core/i18n';
import { view } from '@/core/viewport';
import { ACHIEVEMENTS, isEarned } from '@/data/achievements';
import { CREATURES, CREATURE_IDS, type CreatureId } from '@/data/creatures';
import { ISLAND_IDS } from '@/sim/islands';
import { itemIcon } from '@/ui/itemIcon';
import { nine } from '@/ui/skin';
import { COLORS, FONT } from '@/ui/theme';
import { Button, label, panel } from '@/ui/widgets';
import { confirm } from '@/ui/modal';
import { canBeginNewGamePlus } from '@/sim/newGamePlus';

const ROWS_PER_PAGE = 8;
const ROW_H = 46;
const TOP = 76;

type Tab = 'deeds' | 'beasts' | 'stats';

/** The hero's journal: titles earned, every creature met, and a few numbers about the voyage. The island waits while it is open. */
export class JournalScene extends BaseScene {
  private world!: GameScene;
  private tab: Tab = 'deeds';
  private page = 0;
  private ui!: Phaser.GameObjects.Container;

  constructor() {
    super('Journal');
  }

  create(data: { game: GameScene; back?: string }): void {
    this.world = data.game;
    this.tab = 'deeds';
    this.page = 0;
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

  private kills(id: CreatureId): number {
    return this.world.session.quests.counters[`kill:${id}`] ?? 0;
  }

  private row(y: number, title: string, line: string, done: boolean, icon?: { atlas: string; frame: string }): void {
    const { w: W } = view;
    this.ui.add(nine(this, 12, y, done ? 'ui_panel' : 'ui_panel_dark', W - 24, ROW_H - 4).setOrigin(0, 0));
    if (icon) this.ui.add(this.add.image(34, y + 21, icon.atlas, icon.frame).setDisplaySize(28, 28));
    else this.ui.add(itemIcon(this, 34, y + 21, done ? 'gold' : 'stone', 22).setAlpha(done ? 1 : 0.35));
    this.ui.add(label(this, 56, y + 6, title, FONT.body, done ? COLORS.gold : COLORS.textDim));
    this.ui.add(label(this, 56, y + 24, line, FONT.small, COLORS.textDim));
  }

  private deeds(): number {
    const s = this.world.session;
    ACHIEVEMENTS.forEach((a, i) => {
      if (i < this.page * ROWS_PER_PAGE || i >= (this.page + 1) * ROWS_PER_PAGE) return;
      const y = TOP + (i - this.page * ROWS_PER_PAGE) * ROW_H;
      const done = isEarned(s, a);
      const p = a.progress?.(s);
      this.row(y, tr(a.title), done ? tr(a.about) : `${tr(a.about)}${p ? `  ${p[0]}/${p[1]}` : ''}`, done);
    });
    return ACHIEVEMENTS.length;
  }

  private beasts(): number {
    CREATURE_IDS.forEach((id, i) => {
      if (i < this.page * ROWS_PER_PAGE || i >= (this.page + 1) * ROWS_PER_PAGE) return;
      const y = TOP + (i - this.page * ROWS_PER_PAGE) * ROW_H;
      const def = CREATURES[id];
      const n = this.kills(id);
      const frame = `${def.sprite.group}/down/1`;
      const sprite = { atlas: def.sprite.atlas, frame: def.sprite.atlas === 'actors' ? `${def.sprite.group}/down/0` : frame };
      if (n === 0) {
        this.row(y, '???', t('beastUnknown'), false);
        return;
      }
      this.row(y, t(`creature_${id}`), t('beastLine', { n, hp: def.hp, dmg: def.damage }), true, sprite);
    });
    return CREATURE_IDS.length;
  }

  private stats(): number {
    const s = this.world.session;
    const c = s.quests.counters;
    const kills = Object.entries(c).reduce((n, [k, v]) => (k.startsWith('kill:') ? n + v : n), 0);
    const earned = ACHIEVEMENTS.filter((a) => isEarned(s, a)).length;
    const seen = CREATURE_IDS.filter((id) => this.kills(id) > 0).length;
    const islands = ISLAND_IDS.filter((id) => id === 'home' || (c[`island:${id}`] ?? 0) > 0).length;
    const lines: [string, string][] = [
      [t('statDay'), String(s.clock.day)],
      [t('statTime'), `${Math.floor(s.playTime / 3600)}h ${Math.floor((s.playTime % 3600) / 60)}m`],
      [t('statKills'), String(kills)],
      [t('statBeasts'), `${seen}/${CREATURE_IDS.length}`],
      [t('statDeeds'), `${earned}/${ACHIEVEMENTS.length}`],
      [t('statIslands'), `${islands}/${ISLAND_IDS.length}`],
      [t('statNights'), String(c.night ?? 0)],
      [t('statBuilt'), String(Object.entries(c).reduce((n, [k, v]) => (k.startsWith('build:') ? n + v : n), 0))],
    ];
    lines.forEach(([name, value], i) => {
      const y = TOP + i * 34;
      this.ui.add(label(this, 20, y, name, FONT.body, COLORS.textDim));
      this.ui.add(label(this, view.w - 20, y, value, FONT.body, COLORS.gold, 1, 0));
    });
    const s2 = this.world.session;
    if (s2.ng > 0) this.ui.add(label(this, 20, TOP + lines.length * 34, t('statNg', { n: s2.ng }), FONT.body, COLORS.gold));
    if (canBeginNewGamePlus(s2)) {
      this.ui.add(new Button(this, view.w / 2, TOP + lines.length * 34 + 56, t('ngPlusBtn'), () => {
        confirm(this, t('ngPlusTitle'), t('ngPlusBody'), () => {
          this.scene.stop();
          this.scene.resume('Game');
          this.world.beginNewGamePlus();
        }, false);
      }, { w: 240, h: 34, style: 'primary' }));
    }
    return 0;
  }

  private render(): void {
    this.ui.removeAll(true);
    const { w: W, h: H } = view;
    this.ui.add(this.add.rectangle(0, 0, W, H, COLORS.bg0, 0.92).setOrigin(0, 0).setInteractive());
    this.ui.add(panel(this, 6, 6, W - 12, H - 12, 'ui_panel_dark'));
    this.ui.add(label(this, 16, 14, t('journalTitle'), FONT.head, COLORS.gold));
    this.ui.add(new Button(this, W - 30, 24, 'X', () => this.close(), { w: 34, h: 26, style: 'danger' }));
    (['deeds', 'beasts', 'stats'] as const).forEach((tab, i) => {
      this.ui.add(new Button(this, 56 + i * 104, 54, t(`journal_${tab}`), () => {
        this.tab = tab;
        this.page = 0;
        this.render();
      }, { w: 98, h: 22, font: FONT.small, style: this.tab === tab ? 'primary' : 'normal' }));
    });
    const total = this.tab === 'deeds' ? this.deeds() : this.tab === 'beasts' ? this.beasts() : this.stats();
    const pages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
    if (pages > 1) {
      const y = TOP + ROWS_PER_PAGE * ROW_H + 6;
      const cx = W / 2;
      this.ui.add(new Button(this, cx - 80, y + 12, '<', () => this.turn(-1, pages), { w: 40, h: 26, disabled: this.page === 0 }));
      this.ui.add(label(this, cx, y + 12, t('craftPage', { n: this.page + 1, m: pages }), FONT.small, COLORS.text, 0.5, 0.5));
      this.ui.add(new Button(this, cx + 80, y + 12, '>', () => this.turn(1, pages), { w: 40, h: 26, disabled: this.page >= pages - 1 }));
    }
  }

  private turn(delta: number, pages: number): void {
    this.page = Math.min(pages - 1, Math.max(0, this.page + delta));
    this.render();
  }
}
