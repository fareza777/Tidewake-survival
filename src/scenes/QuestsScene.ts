import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import type { GameScene } from './GameScene';
import { t, tr } from '@/core/i18n';
import { view } from '@/core/viewport';
import { NPCS, type NpcId } from '@/data/npcs';
import { QUESTS } from '@/data/quests';
import type { QuestDef } from '@/sim/quests';
import { progressOf } from '@/sim/quests';
import { itemIcon } from '@/ui/itemIcon';
import { nine } from '@/ui/skin';
import { COLORS, FONT } from '@/ui/theme';
import { Button, label, panel, para } from '@/ui/widgets';

type Tab = 'main' | 'side' | 'done';

const CARD_GAP = 8;
const TOP = 82;
const GREEN = 0x6bd46b;

/** One quest as a card: what has been done, what to do now with a progress bar, and what it pays. */
interface Card {
  id: string;
  height: number;
  draw: (y: number) => void;
}

/**
 * The quest log in three tabs: the main story (each chapter with all its steps, the finished ones ticked), the side
 * quests (running, and the ones an islander is still waiting to give), and what is done. The island waits while it is open.
 */
export class QuestsScene extends BaseScene {
  private world!: GameScene;
  private ui!: Phaser.GameObjects.Container;
  private tab: Tab = 'main';
  private page = 0;

  constructor() {
    super('Quests');
  }

  create(data: { game: GameScene }): void {
    this.world = data.game;
    this.transitioning = false;
    this.tab = 'main';
    this.page = 0;
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

  private rewardText(def: QuestDef): string {
    return (def.reward ?? []).map((r) => `${r.qty} ${t(`item_${r.item}`)}`).join(', ');
  }

  /** A running quest: every step in order, with the current one lit and counted. */
  private activeCard(id: string): Card {
    const s = this.world.session;
    const def = QUESTS[id];
    const run = s.quests.active[id];
    const width = view.w - 52;
    const steps = def.steps.map((step, i) => {
      const text = tr(step.text);
      const lines = Math.max(1, Math.ceil((text.length * 5.2) / width));
      return { i, text, h: lines * 11 + 4 };
    });
    const reward = this.rewardText(def);
    const height = 34 + steps.reduce((n, st) => n + st.h, 0) + 16 + (reward ? 16 : 0);
    return {
      id, height,
      draw: (y0) => {
        const p = progressOf(s.quests, QUESTS, id, s.inventory);
        this.ui.add(nine(this, 12, y0, 'ui_panel', view.w - 24, height).setOrigin(0, 0));
        this.ui.add(this.add.rectangle(18, y0 + 8, 4, 18, def.kind === 'main' ? COLORS.gold : 0x6bb8ff).setOrigin(0, 0));
        this.ui.add(label(this, 28, y0 + 8, tr(def.title), FONT.body, def.kind === 'main' ? COLORS.gold : COLORS.text));
        let y = y0 + 32;
        for (const st of steps) {
          const state = st.i < run.step ? 'done' : st.i === run.step ? 'now' : 'next';
          const mark = state === 'done' ? '+' : state === 'now' ? '>' : '-';
          const color = state === 'done' ? GREEN : state === 'now' ? COLORS.text : COLORS.textDim;
          this.ui.add(label(this, 20, y, mark, FONT.small, color));
          this.ui.add(para(this, 32, y, st.text, width, FONT.small, color));
          if (state === 'now' && p.need > 1) {
            const bar = 60;
            this.ui.add(this.add.rectangle(view.w - 18 - bar, y + 2, bar, 5, 0x000000, 0.6).setOrigin(0, 0));
            this.ui.add(this.add.rectangle(view.w - 18 - bar, y + 2, Math.max(2, Math.round((bar * p.have) / p.need)), 5, GREEN).setOrigin(0, 0));
          }
          y += st.h;
        }
        if (reward) this.ui.add(label(this, 20, y + 6, `${t('questReward')}: ${reward}`, FONT.small, COLORS.gold));
      },
    };
  }

  /** A side quest an islander has not given yet. */
  private offerCard(def: QuestDef): Card {
    const giver = def.giver ? tr(NPCS[def.giver as NpcId]?.name ?? def.giver) : '';
    const reward = this.rewardText(def);
    const height = 50 + (reward ? 14 : 0);
    return {
      id: def.id, height,
      draw: (y0) => {
        this.ui.add(nine(this, 12, y0, 'ui_panel_dark', view.w - 24, height).setOrigin(0, 0));
        this.ui.add(label(this, 28, y0 + 8, tr(def.title), FONT.body, COLORS.textDim));
        this.ui.add(label(this, 28, y0 + 28, t('questAvailable', { name: giver }), FONT.small, COLORS.textDim));
        if (reward) this.ui.add(label(this, 28, y0 + 42, `${t('questReward')}: ${reward}`, FONT.small, COLORS.gold));
      },
    };
  }

  private doneCard(id: string): Card {
    const def = QUESTS[id];
    return {
      id, height: 26,
      draw: (y0) => {
        this.ui.add(nine(this, 12, y0, 'ui_panel_dark', view.w - 24, 26).setOrigin(0, 0));
        this.ui.add(label(this, 22, y0 + 7, '+', FONT.small, GREEN));
        this.ui.add(label(this, 36, y0 + 7, tr(def.title), FONT.small, COLORS.textDim));
        this.ui.add(itemIcon(this, view.w - 28, y0 + 13, def.kind === 'main' ? 'compass' : 'honey', 14).setAlpha(0.7));
      },
    };
  }

  private cards(): Card[] {
    const q = this.world.session.quests;
    const ids = Object.keys(q.active).filter((id) => QUESTS[id]);
    if (this.tab === 'main') return ids.filter((id) => QUESTS[id].kind === 'main').map((id) => this.activeCard(id));
    if (this.tab === 'side') {
      const running = ids.filter((id) => QUESTS[id].kind === 'side').map((id) => this.activeCard(id));
      const offers = Object.values(QUESTS)
        .filter((d) => d.kind === 'side' && !(d.id in q.active) && !q.done.includes(d.id) && (!d.after || q.done.includes(d.after)))
        .map((d) => this.offerCard(d));
      return [...running, ...offers];
    }
    return [...q.done].reverse().filter((id) => QUESTS[id]).map((id) => this.doneCard(id));
  }

  private render(): void {
    this.ui.removeAll(true);
    const { w: W, h: H } = view;
    const q = this.world.session.quests;
    this.ui.add(this.add.rectangle(0, 0, W, H, COLORS.bg0, 0.92).setOrigin(0, 0).setInteractive());
    this.ui.add(panel(this, 6, 6, W - 12, H - 12, 'ui_panel_dark'));
    this.ui.add(label(this, 16, 14, t('questLog'), FONT.head, COLORS.gold));
    this.ui.add(new Button(this, W - 30, 24, 'X', () => this.close(), { w: 34, h: 26, style: 'danger' }));
    const counts: Record<Tab, number> = {
      main: Object.keys(q.active).filter((id) => QUESTS[id]?.kind === 'main').length,
      side: Object.keys(q.active).filter((id) => QUESTS[id]?.kind === 'side').length,
      done: q.done.length,
    };
    (['main', 'side', 'done'] as const).forEach((tab, i) => {
      const name = tab === 'main' ? t('questMain') : tab === 'side' ? t('questSide') : t('questDoneHeader');
      this.ui.add(new Button(this, 58 + i * 106, 56, `${name} ${counts[tab]}`, () => {
        this.tab = tab;
        this.page = 0;
        this.render();
      }, { w: 100, h: 24, font: FONT.small, style: this.tab === tab ? 'primary' : 'normal' }));
    });

    const all = this.cards();
    if (all.length === 0) {
      this.ui.add(para(this, 18, TOP + 8, t(this.tab === 'done' ? 'questNoneDone' : 'questNone'), W - 36, FONT.body, COLORS.textDim));
      return;
    }
    // Fill each page with as many cards as fit above the pager.
    const room = H - TOP - 52;
    const pages: Card[][] = [[]];
    let used = 0;
    for (const card of all) {
      if (used + card.height > room && pages[pages.length - 1].length > 0) {
        pages.push([]);
        used = 0;
      }
      pages[pages.length - 1].push(card);
      used += card.height + CARD_GAP;
    }
    this.page = Math.min(this.page, pages.length - 1);
    let y = TOP;
    for (const card of pages[this.page]) {
      card.draw(y);
      y += card.height + CARD_GAP;
    }
    if (pages.length > 1) {
      const py = H - 36;
      const cx = W / 2;
      this.ui.add(new Button(this, cx - 80, py, '<', () => this.turn(-1, pages.length), { w: 40, h: 26, disabled: this.page === 0 }));
      this.ui.add(label(this, cx, py, t('craftPage', { n: this.page + 1, m: pages.length }), FONT.small, COLORS.text, 0.5, 0.5));
      this.ui.add(new Button(this, cx + 80, py, '>', () => this.turn(1, pages.length), { w: 40, h: 26, disabled: this.page >= pages.length - 1 }));
    }
  }

  private turn(delta: number, pages: number): void {
    this.page = Math.min(pages - 1, Math.max(0, this.page + delta));
    this.render();
  }
}
