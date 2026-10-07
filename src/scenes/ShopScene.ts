import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import type { GameScene } from './GameScene';
import { t, tr } from '@/core/i18n';
import { view } from '@/core/viewport';
import type { ItemId } from '@/data/items';
import { NPCS, type NpcId } from '@/data/npcs';
import { SHOPS, sellPrice } from '@/data/shops';
import { bountyProgress, offerFor, wantedName } from '@/sim/bounty';
import { goldOf } from '@/sim/shop';
import { itemIcon } from '@/ui/itemIcon';
import { nine } from '@/ui/skin';
import { COLORS, FONT } from '@/ui/theme';
import { Button, label, panel } from '@/ui/widgets';

const ROWS_PER_PAGE = 7;
const ROW_H = 50;
const TOP = 96;

type Tab = 'buy' | 'sell' | 'jobs';

/** A trader's counter: what they sell, what they will buy from the backpack, and the gold the hero holds. */
export class ShopScene extends BaseScene {
  private world!: GameScene;
  private npc!: NpcId;
  private tab: Tab = 'buy';
  private page = 0;
  private ui!: Phaser.GameObjects.Container;

  constructor() {
    super('Shop');
  }

  create(data: { game: GameScene; npc: NpcId }): void {
    this.world = data.game;
    this.npc = data.npc;
    this.tab = 'buy';
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

  private rows(): { icon: ItemId; name: string; note: string; price: number; act: () => void; ok: boolean }[] {
    const s = this.world.session;
    if (this.tab === 'buy') {
      return (SHOPS[this.npc] ?? []).map((o, i) => ({
        icon: o.item, name: t(`item_${o.item}`) + (o.qty && o.qty > 1 ? ` x${o.qty}` : ''), note: '', price: o.price,
        act: () => this.world.buy(this.npc, i), ok: goldOf(s) >= o.price,
      }));
    }
    return s.inventory.flatMap((slot, index) => {
      if (!slot) return [];
      const price = sellPrice(slot);
      if (price <= 0) return [];
      const plus = slot.plus ? ` +${slot.plus}` : '';
      return [{
        icon: slot.item, name: t(`item_${slot.item}`) + plus, note: slot.qty > 1 ? `x${slot.qty}` : '', price,
        act: () => this.world.sell(index, 1), ok: true,
      }];
    });
  }

  private render(): void {
    this.ui.removeAll(true);
    const { w: W, h: H } = view;
    const npcDef = NPCS[this.npc];
    this.ui.add(this.add.rectangle(0, 0, W, H, COLORS.bg0, 0.92).setOrigin(0, 0).setInteractive());
    this.ui.add(panel(this, 6, 6, W - 12, H - 12, 'ui_panel_dark'));
    this.ui.add(label(this, 16, 14, tr(npcDef.name), FONT.head, COLORS.gold));
    this.ui.add(new Button(this, W - 30, 24, 'X', () => this.close(), { w: 34, h: 26, style: 'danger' }));
    this.ui.add(itemIcon(this, W - 118, 24, 'gold', 20));
    this.ui.add(label(this, W - 104, 24, String(goldOf(this.world.session)), FONT.head, COLORS.gold, 0, 0.5));
    (['buy', 'sell', 'jobs'] as const).forEach((tab, i) => {
      this.ui.add(new Button(this, 52 + i * 100, 64, t(tab === 'buy' ? 'shopBuy' : tab === 'sell' ? 'shopSell' : 'shopJobs'), () => {
        this.tab = tab;
        this.page = 0;
        this.render();
      }, { w: 92, h: 28, style: this.tab === tab ? 'primary' : 'normal' }));
    });
    if (this.tab === 'jobs') {
      this.drawJobs();
      return;
    }
    const rows = this.rows();
    if (rows.length === 0) this.ui.add(label(this, 16, TOP + 20, t(this.tab === 'buy' ? 'shopEmpty' : 'shopNothing'), FONT.body, COLORS.textDim));
    const pages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
    this.page = Math.min(this.page, pages - 1);
    rows.slice(this.page * ROWS_PER_PAGE, (this.page + 1) * ROWS_PER_PAGE).forEach((row, i) => {
      const y = TOP + i * ROW_H;
      this.ui.add(nine(this, 12, y, 'ui_panel', W - 24, ROW_H - 4).setOrigin(0, 0));
      this.ui.add(itemIcon(this, 32, y + 22, row.icon, 28));
      this.ui.add(label(this, 54, y + 8, row.name, FONT.body, COLORS.text));
      this.ui.add(label(this, 54, y + 26, row.note, FONT.small, COLORS.textDim));
      this.ui.add(new Button(this, W - 56, y + 21, `${row.price}`, () => {
        row.act();
        this.render();
      }, { w: 76, h: 28, font: FONT.small, style: row.ok ? 'primary' : 'normal', disabled: !row.ok, icon: { atlas: 'icons', frame: 'gold', scale: 0.8 } }));
    });
    if (pages > 1) {
      const y = TOP + ROWS_PER_PAGE * ROW_H + 8;
      const cx = W / 2;
      this.ui.add(new Button(this, cx - 80, y + 12, '<', () => this.turn(-1, pages), { w: 40, h: 26, disabled: this.page === 0 }));
      this.ui.add(label(this, cx, y + 12, t('craftPage', { n: this.page + 1, m: pages }), FONT.small, COLORS.text, 0.5, 0.5));
      this.ui.add(new Button(this, cx + 80, y + 12, '>', () => this.turn(1, pages), { w: 40, h: 26, disabled: this.page >= pages - 1 }));
    }
  }

  /** The board: the job on offer today, or the one the hero has taken. */
  private drawJobs(): void {
    const { w: W } = view;
    const s = this.world.session;
    const mine = s.bounty;
    const offer = mine ? null : offerFor(s.seed, this.npc, s.clock.day);
    const job = mine ?? offer;
    if (!job) {
      this.ui.add(label(this, 16, TOP + 20, t('jobsNone'), FONT.body, COLORS.textDim));
      return;
    }
    const done = (s.quests.counters[`bountyday:${this.npc}`] ?? 0) === s.clock.day;
    const verb = job.kind === 'hunt' ? t('jobHunt') : t('jobFetch');
    this.ui.add(nine(this, 12, TOP, 'ui_panel', W - 24, 110).setOrigin(0, 0));
    this.ui.add(label(this, 22, TOP + 8, `${verb} ${job.n} ${t(wantedName(job))}`, FONT.body, COLORS.gold));
    this.ui.add(label(this, 22, TOP + 30, t('jobFrom', { name: tr(NPCS[job.npc].name) }), FONT.small, COLORS.textDim));
    this.ui.add(itemIcon(this, 32, TOP + 74, 'gold', 22));
    this.ui.add(label(this, 48, TOP + 66, `${job.reward}`, FONT.head, COLORS.gold));
    if (mine) {
      const p = bountyProgress(s) ?? [0, mine.n];
      this.ui.add(label(this, W - 24, TOP + 8, `${p[0]}/${p[1]}`, FONT.head, p[0] >= p[1] ? COLORS.gold : COLORS.text, 1, 0));
      const mineHere = mine.npc === this.npc;
      this.ui.add(new Button(this, W - 150, TOP + 82, t('jobHandIn'), () => {
        this.world.handInBounty();
        this.render();
      }, { w: 100, h: 28, style: p[0] >= p[1] && mineHere ? 'primary' : 'normal', disabled: p[0] < p[1] || !mineHere }));
      this.ui.add(new Button(this, W - 56, TOP + 82, t('jobDrop'), () => {
        this.world.giveUpBounty();
        this.render();
      }, { w: 76, h: 28, style: 'danger' }));
    } else if (done) {
      this.ui.add(label(this, W - 24, TOP + 70, t('jobDoneToday'), FONT.small, COLORS.textDim, 1, 0));
    } else {
      this.ui.add(new Button(this, W - 70, TOP + 82, t('jobTake'), () => {
        this.world.takeBounty(this.npc);
        this.render();
      }, { w: 110, h: 28, style: 'primary' }));
    }
  }

  private turn(delta: number, pages: number): void {
    this.page = Math.min(pages - 1, Math.max(0, this.page + delta));
    this.render();
  }
}
