import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import type { GameScene } from './GameScene';
import { t, tr } from '@/core/i18n';
import { view } from '@/core/viewport';
import type { ItemId } from '@/data/items';
import { NPCS, type NpcId } from '@/data/npcs';
import { SHOPS, sellPrice } from '@/data/shops';
import { goldOf } from '@/sim/shop';
import { itemIcon } from '@/ui/itemIcon';
import { nine } from '@/ui/skin';
import { COLORS, FONT } from '@/ui/theme';
import { Button, label, panel } from '@/ui/widgets';

const ROWS_PER_PAGE = 7;
const ROW_H = 50;
const TOP = 96;

type Tab = 'buy' | 'sell';

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
    (['buy', 'sell'] as const).forEach((tab, i) => {
      this.ui.add(new Button(this, 60 + i * 110, 64, t(tab === 'buy' ? 'shopBuy' : 'shopSell'), () => {
        this.tab = tab;
        this.page = 0;
        this.render();
      }, { w: 100, h: 28, style: this.tab === tab ? 'primary' : 'normal' }));
    });
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

  private turn(delta: number, pages: number): void {
    this.page = Math.min(pages - 1, Math.max(0, this.page + delta));
    this.render();
  }
}
