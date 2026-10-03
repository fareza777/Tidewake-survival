import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import type { GameScene, OpenOptions } from './GameScene';
import { t } from '@/core/i18n';
import { view, vx, vy } from '@/core/viewport';
import { ITEMS } from '@/data/items';
import type { Recipe } from '@/data/recipes';
import { CHEST_SLOTS } from '@/data/structures';
import { availableRecipes, canCraft, missingFor } from '@/sim/crafting';
import { HOTBAR_SIZE, INVENTORY_SIZE, type Inventory } from '@/sim/inventory';
import { itemIcon } from '@/ui/itemIcon';
import { nine } from '@/ui/skin';
import { COLORS, FONT } from '@/ui/theme';
import { Button, label, panel } from '@/ui/widgets';

const COLS = 8;
const SLOT = 36;
const GAP = 2;
const ROWS_PER_PAGE = 5;
const ROW_H = 54;

type Tab = 'bag' | 'craft';

/** Backpack, hand/station crafting and chest storage in one screen. The island is paused while it is open. */
export class InventoryScene extends BaseScene {
  private world!: GameScene;
  private mode: OpenOptions['mode'] = 'bag';
  private chestId = 0;
  private tab: Tab = 'bag';
  private picked = -1;
  private page = 0;
  private ui!: Phaser.GameObjects.Container;

  constructor() {
    super('Inventory');
  }

  create(data: OpenOptions & { game: GameScene }): void {
    this.world = data.game;
    this.mode = data.mode;
    this.chestId = data.chestId ?? 0;
    this.tab = data.mode === 'craft' ? 'craft' : 'bag';
    this.picked = -1;
    this.page = 0;
    this.transitioning = false;
    this.ui = this.add.container(0, 0);
    this.handleBack(() => {
      this.close();
      return true;
    });
    this.input.on('pointerdown', this.onTap, this);
    this.render();
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume('Game');
  }

  private bagInv(): Inventory {
    return this.world.session.inventory;
  }

  private chestInv(): Inventory | undefined {
    return this.world.session.structures.list.find((s) => s.id === this.chestId)?.inv;
  }

  // ---- layout helpers

  private gridX(): number {
    return Math.round((view.w - (COLS * SLOT + (COLS - 1) * GAP)) / 2);
  }

  private slotPos(i: number, top: number): { x: number; y: number } {
    return { x: this.gridX() + (i % COLS) * (SLOT + GAP), y: top + Math.floor(i / COLS) * (SLOT + GAP) };
  }

  private chestTop(): number {
    return 64;
  }

  private bagTop(): number {
    return this.mode === 'chest' ? this.chestTop() + 3 * (SLOT + GAP) + 34 : 78;
  }

  private onTap(p: Phaser.Input.Pointer): void {
    if (this.tab !== 'bag') return;
    const x = vx(p);
    const y = vy(p);
    const hit = (top: number, count: number): number => {
      for (let i = 0; i < count; i++) {
        const s = this.slotPos(i, top);
        if (x >= s.x && x <= s.x + SLOT && y >= s.y && y <= s.y + SLOT) return i;
      }
      return -1;
    };
    if (this.mode === 'chest') {
      const c = hit(this.chestTop(), CHEST_SLOTS);
      if (c >= 0) {
        this.world.transfer(this.chestId, 'chest', c);
        this.render();
        return;
      }
    }
    const b = hit(this.bagTop(), INVENTORY_SIZE);
    if (b < 0) return;
    if (this.mode === 'chest') {
      this.world.transfer(this.chestId, 'bag', b);
    } else if (this.picked < 0) {
      if (this.bagInv()[b]) this.picked = b;
    } else {
      if (this.picked !== b) this.world.moveSlot(this.picked, b);
      this.picked = -1;
    }
    this.render();
  }

  // ---- drawing

  private render(): void {
    this.ui.removeAll(true);
    const { w: W, h: H } = view;
    this.ui.add(this.add.rectangle(0, 0, W, H, COLORS.bg0, 0.88).setOrigin(0, 0).setInteractive());
    this.ui.add(panel(this, 6, 6, W - 12, H - 12, 'ui_panel_dark'));
    const title = this.mode === 'chest' ? t('chestTitle') : this.tab === 'craft' ? t('craftTitle') : t('invTitle');
    this.ui.add(label(this, 16, 14, title, FONT.head, COLORS.gold));
    this.ui.add(new Button(this, W - 30, 24, 'X', () => this.close(), { w: 34, h: 26, style: 'danger' }));
    if (this.mode !== 'chest') this.drawTabs();
    if (this.tab === 'craft') this.drawCrafting();
    else this.drawBag();
  }

  private drawTabs(): void {
    const w = 62;
    this.ui.add(new Button(this, 218, 24, t('tabBag'), () => this.switchTab('bag'), { w, h: 24, font: FONT.small, style: this.tab === 'bag' ? 'primary' : 'normal' }));
    this.ui.add(new Button(this, 286, 24, t('tabCraft'), () => this.switchTab('craft'), { w, h: 24, font: FONT.small, style: this.tab === 'craft' ? 'primary' : 'normal' }));
  }

  private switchTab(tab: Tab): void {
    this.tab = tab;
    this.picked = -1;
    this.page = 0;
    this.render();
  }

  private drawGrid(inv: Inventory, count: number, top: number, mark: (i: number) => boolean): void {
    for (let i = 0; i < count; i++) {
      const { x, y } = this.slotPos(i, top);
      this.ui.add(nine(this, x, y, mark(i) ? 'ui_tab_on' : 'ui_slot', SLOT, SLOT).setOrigin(0, 0));
      const slot = inv[i];
      if (!slot) continue;
      this.ui.add(itemIcon(this, x + SLOT / 2, y + SLOT / 2 - 1, slot.item, 26));
      if (slot.qty > 1) this.ui.add(this.add.bitmapText(x + SLOT - 3, y + SLOT - 3, FONT.small, String(slot.qty)).setOrigin(1, 1).setTint(COLORS.white));
    }
  }

  private drawBag(): void {
    const inv = this.bagInv();
    if (this.mode === 'chest') {
      this.ui.add(label(this, this.gridX(), this.chestTop() - 14, t('chestTitle'), FONT.small, COLORS.textDim));
      this.drawGrid(this.chestInv() ?? [], CHEST_SLOTS, this.chestTop(), () => false);
      this.ui.add(label(this, this.gridX(), this.bagTop() - 14, t('invTitle'), FONT.small, COLORS.textDim));
    }
    const top = this.bagTop();
    this.drawGrid(inv, INVENTORY_SIZE, top, (i) => i === this.picked || (this.mode === 'bag' && i < HOTBAR_SIZE && i === this.world.session.selected));
    const infoY = top + 4 * (SLOT + GAP) + 6;
    const slot = this.picked >= 0 ? inv[this.picked] : null;
    if (this.mode === 'chest') {
      this.ui.add(label(this, this.gridX(), infoY, t('chestHint'), FONT.small, COLORS.textDim));
      return;
    }
    if (!slot) return;
    const def = ITEMS[slot.item];
    this.ui.add(label(this, this.gridX(), infoY, t(`item_${slot.item}`), FONT.body, COLORS.text));
    if (def.tool && slot.dur !== undefined) {
      this.ui.add(label(this, this.gridX(), infoY + 18, t(def.tool.type === 'can' ? 'waterLeft' : 'durability', { n: slot.dur }), FONT.small, COLORS.textDim));
    }
  }

  private costText(recipe: Recipe): string {
    return recipe.cost.map(([item, n]) => `${n} ${t(`item_${item}`)}`).join(', ');
  }

  private drawCrafting(): void {
    const near = this.world.stations();
    const list = availableRecipes(near);
    const inv = this.bagInv();
    const pages = Math.max(1, Math.ceil(list.length / ROWS_PER_PAGE));
    this.page = Math.min(this.page, pages - 1);
    const stations = ['hand', ...near].map((s) => t(`station_${s}`)).join(', ');
    this.ui.add(label(this, 16, 52, t('craftAt', { station: stations }), FONT.small, COLORS.textDim));
    if (list.length === 0) {
      this.ui.add(label(this, 16, 80, t('craftNothing'), FONT.body, COLORS.textDim));
      return;
    }
    const rows = list.slice(this.page * ROWS_PER_PAGE, (this.page + 1) * ROWS_PER_PAGE);
    rows.forEach((recipe, i) => {
      const y = 72 + i * ROW_H;
      const ok = canCraft(inv, recipe, near);
      this.ui.add(nine(this, 12, y, 'ui_panel', view.w - 24, ROW_H - 4).setOrigin(0, 0));
      this.ui.add(itemIcon(this, 32, y + 24, recipe.out, 28));
      const qty = recipe.qty > 1 ? ` x${recipe.qty}` : '';
      this.ui.add(label(this, 52, y + 6, t(`item_${recipe.out}`) + qty, FONT.body, COLORS.text));
      const missing = missingFor(inv, recipe);
      const need = missing.length ? `${t('craftNeeds')}: ${missing.map(([item, n]) => `${n} ${t(`item_${item}`)}`).join(', ')}` : this.costText(recipe);
      this.ui.add(label(this, 52, y + 26, need, FONT.small, missing.length ? 0xe0824f : COLORS.textDim));
      const btn = new Button(this, view.w - 52, y + 22, t('craftBtn'), () => {
        this.world.craft(recipe);
        this.render();
      }, { w: 60, h: 28, style: ok ? 'primary' : 'normal', disabled: !ok });
      this.ui.add(btn);
    });
    if (pages > 1) this.drawPager(pages);
  }

  private drawPager(pages: number): void {
    const y = 72 + ROWS_PER_PAGE * ROW_H + 8;
    const cx = view.w / 2;
    this.ui.add(new Button(this, cx - 80, y + 12, '<', () => this.turn(-1, pages), { w: 40, h: 26, disabled: this.page === 0 }));
    this.ui.add(label(this, cx, y + 12, t('craftPage', { n: this.page + 1, m: pages }), FONT.small, COLORS.text, 0.5, 0.5));
    this.ui.add(new Button(this, cx + 80, y + 12, '>', () => this.turn(1, pages), { w: 40, h: 26, disabled: this.page >= pages - 1 }));
  }

  private turn(delta: number, pages: number): void {
    this.page = Math.min(pages - 1, Math.max(0, this.page + delta));
    this.render();
  }
}
