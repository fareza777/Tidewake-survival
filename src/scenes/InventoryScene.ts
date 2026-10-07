import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import type { GameScene, OpenOptions } from './GameScene';
import { t } from '@/core/i18n';
import { view, vx, vy } from '@/core/viewport';
import { ITEMS, type ItemId } from '@/data/items';
import type { Recipe } from '@/data/recipes';
import { CHEST_SLOTS } from '@/data/structures';
import { availableRecipes, canCraft, maxCrafts, missingFor } from '@/sim/crafting';
import { GEAR_SLOTS, gearStats } from '@/sim/equipment';
import { HOTBAR_SIZE, INVENTORY_SIZE, canAfford, type Inventory } from '@/sim/inventory';
import { sessionMods } from '@/sim/session';
import { MAX_LEVEL, SKILLS, levelOf, progressOf, rankOf, type SkillId } from '@/sim/skills';
import { canUpgradeItem, maxDurability, repairCost, upgradeCost } from '@/sim/upgrade';
import { itemIcon } from '@/ui/itemIcon';
import { nine } from '@/ui/skin';
import { COLORS, FONT } from '@/ui/theme';
import { Button, label, panel, para } from '@/ui/widgets';

const COLS = 8;
const SLOT = 36;
const GAP = 2;
const ROWS_PER_PAGE = 5;
const ROW_H = 56;
const CONTENT_TOP = 76;

type Tab = 'bag' | 'craft' | 'skills' | 'anvil';

/** The icon each skill shows beside its name. */
const SKILL_ICON: Record<SkillId, ItemId> = {
  woodcutting: 'axe_iron', mining: 'pickaxe_iron', combat: 'sword_iron', farming: 'hoe', cooking: 'cooked_meat', crafting: 'anvil',
};

/** Backpack with equipment, crafting, skills, the anvil and chest storage in one screen. The island is paused while it is open. */
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
    return this.mode === 'chest' ? this.chestTop() + 3 * (SLOT + GAP) + 34 : CONTENT_TOP;
  }

  /** The row of the four gear slots under the backpack. */
  private gearPos(i: number): { x: number; y: number } {
    return { x: this.gridX() + i * (SLOT + 12), y: this.bagTop() + 4 * (SLOT + GAP) + 24 };
  }

  private tabs(): Tab[] {
    return this.world.stations().has('anvil') ? ['bag', 'craft', 'skills', 'anvil'] : ['bag', 'craft', 'skills'];
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
    } else {
      for (let i = 0; i < GEAR_SLOTS.length; i++) {
        const g = this.gearPos(i);
        if (x >= g.x && x <= g.x + SLOT && y >= g.y && y <= g.y + SLOT && this.world.session.equipment[GEAR_SLOTS[i]]) {
          this.world.takeOff(GEAR_SLOTS[i]);
          this.render();
          return;
        }
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
    this.ui.add(this.add.rectangle(0, 0, W, H, COLORS.bg0, 0.9).setOrigin(0, 0).setInteractive());
    this.ui.add(panel(this, 6, 6, W - 12, H - 12, 'ui_panel_dark'));
    const titles: Record<Tab, string> = { bag: t('invTitle'), craft: t('craftTitle'), skills: t('skillsTitle'), anvil: t('anvilTitle') };
    this.ui.add(label(this, 16, 14, this.mode === 'chest' ? t('chestTitle') : titles[this.tab], FONT.head, COLORS.gold));
    this.ui.add(new Button(this, W - 30, 24, 'X', () => this.close(), { w: 34, h: 26, style: 'danger' }));
    if (this.mode !== 'chest') this.drawTabs();
    if (this.tab === 'craft') this.drawCrafting();
    else if (this.tab === 'skills') this.drawSkills();
    else if (this.tab === 'anvil') this.drawAnvil();
    else this.drawBag();
  }

  private drawTabs(): void {
    const tabs = this.tabs();
    const total = view.w - 24;
    const gap = 4;
    const w = Math.floor((total - gap * (tabs.length - 1)) / tabs.length);
    const names: Record<Tab, string> = { bag: t('tabBag'), craft: t('tabCraft'), skills: t('tabSkills'), anvil: t('tabAnvil') };
    tabs.forEach((tab, i) => {
      const x = 12 + i * (w + gap) + w / 2;
      this.ui.add(new Button(this, x, 54, names[tab], () => this.switchTab(tab), { w, h: 26, font: FONT.small, style: this.tab === tab ? 'primary' : 'normal' }));
    });
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
      if (slot.plus) this.ui.add(this.add.bitmapText(x + 3, y + 2, FONT.small, t('itemPlus', { n: slot.plus })).setTint(COLORS.gold));
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
    if (this.mode === 'chest') {
      this.ui.add(label(this, this.gridX(), top + 4 * (SLOT + GAP) + 6, t('chestHint'), FONT.small, COLORS.textDim));
      return;
    }
    this.drawGear();
    this.drawPicked();
  }

  /** What the hero wears: four slots (tap one to take it off) and what they add up to. */
  private drawGear(): void {
    const eq = this.world.session.equipment;
    const y0 = this.gearPos(0).y;
    this.ui.add(label(this, this.gridX(), y0 - 16, t('gearTitle'), FONT.small, COLORS.textDim));
    GEAR_SLOTS.forEach((place, i) => {
      const { x, y } = this.gearPos(i);
      this.ui.add(nine(this, x, y, eq[place] ? 'ui_tab_on' : 'ui_slot', SLOT, SLOT).setOrigin(0, 0));
      if (eq[place]) this.ui.add(itemIcon(this, x + SLOT / 2, y + SLOT / 2 - 1, eq[place] as ItemId, 26));
      this.ui.add(label(this, x + SLOT / 2, y + SLOT + 2, t(`gearSlot_${place}`), FONT.small, COLORS.textDim, 0.5, 0));
    });
    const g = gearStats(eq);
    const lines = [t('gearStats', { d: g.defense })];
    if (g.speed) lines.push(t('gearBonusSpeed', { n: Math.round(g.speed * 100) }));
    if (g.damage) lines.push(t('gearBonusDamage', { n: Math.round(g.damage * 100) }));
    if (g.regen) lines.push(t('gearBonusRegen', { n: g.regen }));
    if (g.luck) lines.push(t('gearBonusLuck', { n: Math.round(g.luck * 100) }));
    if (g.warmth) lines.push(t('gearBonusWarmth', { n: g.warmth }));
    const x = this.gearPos(GEAR_SLOTS.length - 1).x + SLOT + 12;
    this.ui.add(para(this, x, y0, lines.join('\n'), view.w - x - 10, FONT.small, COLORS.text));
  }

  /** The item picked in the backpack: its name, what it does and a button to wear it. */
  private drawPicked(): void {
    const slot = this.picked >= 0 ? this.bagInv()[this.picked] : null;
    if (!slot) return;
    const def = ITEMS[slot.item];
    const x = this.gridX();
    const y = this.gearPos(0).y + SLOT + 26;
    const plus = slot.plus ? ` ${t('itemPlus', { n: slot.plus })}` : '';
    this.ui.add(label(this, x, y, t(`item_${slot.item}`) + plus, FONT.body, COLORS.text));
    let line = y + 20;
    if (def.tool && slot.dur !== undefined) {
      const text = def.tool.type === 'can' ? t('waterLeft', { n: slot.dur }) : `${t('durability', { n: slot.dur })} / ${maxDurability(slot.item, slot.plus)}`;
      this.ui.add(label(this, x, line, text, FONT.small, COLORS.textDim));
      line += 16;
    }
    if (def.weapon) {
      const dmg = Math.round(def.weapon.damage * (1 + 0.12 * (slot.plus ?? 0)));
      this.ui.add(label(this, x, line, t('weaponDamage', { n: dmg }), FONT.small, COLORS.textDim));
      line += 16;
    }
    if (def.armor) {
      this.ui.add(label(this, x, line, t('armorDefense', { n: def.armor.defense }), FONT.small, COLORS.textDim));
      this.ui.add(new Button(this, view.w - 62, y + 18, t('wearArmor'), () => {
        this.world.wear(this.picked);
        this.picked = -1;
        this.render();
      }, { w: 84, h: 28, font: FONT.small, style: 'primary' }));
    }
  }

  private costText(recipe: Recipe): string {
    return recipe.cost.map(([item, n]) => `${n} ${t(`item_${item}`)}`).join(', ');
  }

  private drawCrafting(): void {
    const near = this.world.stations();
    const list = availableRecipes(near);
    const inv = this.bagInv();
    const crafting = levelOf(this.world.session.skills.crafting);
    const pages = Math.max(1, Math.ceil(list.length / ROWS_PER_PAGE));
    this.page = Math.min(this.page, pages - 1);
    const stations = ['hand', ...near].map((s) => t(`station_${s}`)).join(', ');
    this.ui.add(label(this, 16, CONTENT_TOP - 4, t('craftAt', { station: stations }), FONT.small, COLORS.textDim));
    if (list.length === 0) {
      this.ui.add(label(this, 16, CONTENT_TOP + 24, t('craftNothing'), FONT.body, COLORS.textDim));
      return;
    }
    const rows = list.slice(this.page * ROWS_PER_PAGE, (this.page + 1) * ROWS_PER_PAGE);
    rows.forEach((recipe, i) => {
      const y = CONTENT_TOP + 14 + i * ROW_H;
      const locked = crafting < (recipe.lvl ?? 1);
      const ok = !locked && canCraft(inv, recipe, near);
      this.ui.add(nine(this, 12, y, 'ui_panel', view.w - 24, ROW_H - 4).setOrigin(0, 0));
      this.ui.add(itemIcon(this, 32, y + 24, recipe.out, 28));
      const qty = recipe.qty > 1 ? ` x${recipe.qty}` : '';
      this.ui.add(label(this, 52, y + 6, t(`item_${recipe.out}`) + qty, FONT.body, locked ? COLORS.textDim : COLORS.text));
      const missing = missingFor(inv, recipe);
      const need = locked ? t('craftLocked', { n: recipe.lvl ?? 1 })
        : missing.length ? `${t('craftNeeds')}: ${missing.map(([item, n]) => `${n} ${t(`item_${item}`)}`).join(', ')}` : this.costText(recipe);
      this.ui.add(label(this, 52, y + 28, need, FONT.small, locked || missing.length ? 0xe0824f : COLORS.textDim));
      const many = ok ? maxCrafts(inv, recipe, near, 25) : 0;
      this.ui.add(new Button(this, view.w - 52, y + (many > 1 ? 14 : 24), t('craftBtn'), () => {
        this.world.craft(recipe);
        this.render();
      }, { w: 60, h: many > 1 ? 22 : 30, font: many > 1 ? FONT.small : undefined, style: ok ? 'primary' : 'normal', disabled: !ok }));
      if (many > 1) {
        this.ui.add(new Button(this, view.w - 52, y + 38, `x${many}`, () => {
          this.world.craft(recipe, many);
          this.render();
        }, { w: 60, h: 22, font: FONT.small }));
      }
    });
    if (pages > 1) this.drawPager(pages, CONTENT_TOP + 14 + ROWS_PER_PAGE * ROW_H + 6);
  }

  /** The six skills: level, progress to the next one, and what the level does for the hero now. */
  private drawSkills(): void {
    const s = this.world.session;
    const mods = sessionMods(s);
    this.ui.add(label(this, view.w - 52, 16, t('rankLabel', { n: rankOf(s.skills) }), FONT.body, COLORS.gold, 1, 0));
    const pct = (v: number): number => Math.round(v * 100);
    const values: Record<SkillId, { a: number; b: number }> = {
      woodcutting: { a: pct(mods.chopDamage - 1), b: pct(mods.yieldWood) },
      mining: { a: pct(mods.mineDamage - 1), b: pct(mods.yieldMine) },
      combat: { a: pct(mods.meleeDamage - 1), b: pct(mods.crit) },
      farming: { a: 0, b: pct(mods.yieldFarm) },
      cooking: { a: pct(mods.food - 1), b: 0 },
      crafting: { a: 0, b: pct(mods.craftSave) },
    };
    SKILLS.forEach((id, i) => {
      const y = CONTENT_TOP + 4 + i * 60;
      const p = progressOf(s.skills[id]);
      this.ui.add(nine(this, 12, y, 'ui_panel', view.w - 24, 56).setOrigin(0, 0));
      this.ui.add(itemIcon(this, 32, y + 20, SKILL_ICON[id], 28));
      this.ui.add(label(this, 54, y + 5, t(`skill_${id}`), FONT.body, COLORS.text));
      this.ui.add(label(this, view.w - 20, y + 6, p.level >= MAX_LEVEL ? t('maxLevel') : t('levelShort', { n: p.level }), FONT.body, COLORS.gold, 1, 0));
      const barW = view.w - 84;
      this.ui.add(this.add.rectangle(54, y + 26, barW, 6, 0x000000, 0.6).setOrigin(0, 0));
      const ratio = p.need > 0 ? p.into / p.need : 1;
      this.ui.add(this.add.rectangle(54, y + 26, Math.max(2, Math.round(barW * ratio)), 6, 0x6bd46b).setOrigin(0, 0));
      this.ui.add(para(this, 54, y + 35, t(`perk_${id}`, values[id]), view.w - 72, FONT.small, COLORS.textDim));
    });
  }

  /** At an anvil: upgrade or repair the tools in the backpack. */
  private drawAnvil(): void {
    const inv = this.bagInv();
    const entries = inv.flatMap((slot, index) => (slot && canUpgradeItem(slot.item) ? [{ slot, index }] : []));
    this.ui.add(para(this, 16, CONTENT_TOP - 6, t('anvilHint'), view.w - 32, FONT.small, COLORS.textDim));
    if (entries.length === 0) {
      this.ui.add(label(this, 16, CONTENT_TOP + 40, t('anvilNothing'), FONT.body, COLORS.textDim));
      return;
    }
    const top = CONTENT_TOP + 30;
    const pages = Math.max(1, Math.ceil(entries.length / ROWS_PER_PAGE));
    this.page = Math.min(this.page, pages - 1);
    entries.slice(this.page * ROWS_PER_PAGE, (this.page + 1) * ROWS_PER_PAGE).forEach(({ slot, index }, i) => {
      const y = top + i * ROW_H;
      const up = upgradeCost(slot);
      const fix = repairCost(slot);
      this.ui.add(nine(this, 12, y, 'ui_panel', view.w - 24, ROW_H - 4).setOrigin(0, 0));
      this.ui.add(itemIcon(this, 32, y + 24, slot.item, 28));
      const plus = slot.plus ? ` ${t('itemPlus', { n: slot.plus })}` : '';
      this.ui.add(label(this, 52, y + 6, t(`item_${slot.item}`) + plus, FONT.body, COLORS.text));
      const dur = slot.dur ?? 0;
      this.ui.add(label(this, 52, y + 26, `${dur}/${maxDurability(slot.item, slot.plus)}  ${up ? up.map(([item, n]) => `${n} ${t(`item_${item}`)}`).join(', ') : t('upgradeMaxed')}`, FONT.small, up && canAfford(inv, up) ? COLORS.textDim : 0xe0824f));
      this.ui.add(new Button(this, view.w - 52, y + 14, t('upgradeBtn'), () => {
        this.world.upgrade(index);
        this.render();
      }, { w: 72, h: 22, font: FONT.small, style: up && canAfford(inv, up) ? 'primary' : 'normal', disabled: !up || !canAfford(inv, up) }));
      this.ui.add(new Button(this, view.w - 52, y + 38, t('repairBtn'), () => {
        this.world.repair(index);
        this.render();
      }, { w: 72, h: 20, font: FONT.small, disabled: !fix || !canAfford(inv, fix) }));
    });
    if (pages > 1) this.drawPager(pages, top + ROWS_PER_PAGE * ROW_H + 4);
  }

  private drawPager(pages: number, y: number): void {
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

