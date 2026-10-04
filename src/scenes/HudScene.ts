import Phaser from 'phaser';
import type { GameScene } from './GameScene';
import { t, tr } from '@/core/i18n';
import { services } from '@/core/services';
import { view, vx, vy } from '@/core/viewport';
import { ITEMS } from '@/data/items';
import { controls } from '@/game/input';
import { QUESTS } from '@/data/quests';
import { clockLabel } from '@/sim/daynight';
import { HOTBAR_SIZE, type Inventory } from '@/sim/inventory';
import { progressOf, trackedQuest, type QuestState } from '@/sim/quests';
import type { Difficulty } from '@/sim/vitals';
import { showModal } from '@/ui/modal';
import { itemIcon } from '@/ui/itemIcon';
import { Joystick } from '@/ui/Joystick';
import { nine } from '@/ui/skin';
import { COLORS, FONT } from '@/ui/theme';
import { Bar, Button } from '@/ui/widgets';

const SLOT = 34;
const GAP = 3;
const BAR_W = 78;
const BARS = [
  { key: 'hp', icon: 'ui_heart', color: 0xe0524f },
  { key: 'hunger', icon: 'ui_food', color: 0xff9a3c },
  { key: 'thirst', icon: 'ui_drop', color: 0x5fa8ff },
  { key: 'stamina', icon: 'ui_bolt', color: 0x6bd46b },
] as const;

/** Heads-up display on top of the island: vitals, time, hotbar, joystick and the USE, bag and pause buttons. */
export class HudScene extends Phaser.Scene {
  private world!: GameScene;
  private dayText!: Phaser.GameObjects.BitmapText;
  private bars: { bar: Bar; last: number }[] = [];
  private slotLayer!: Phaser.GameObjects.Container;
  private lastInventory: Inventory | null = null;
  private lastSelected = -1;
  private lastDay = '';
  private menuOpen = false;
  private bossName!: Phaser.GameObjects.BitmapText;
  private bossBar!: Bar;
  private tracker!: Phaser.GameObjects.BitmapText;
  private lastQuests: QuestState | null = null;

  constructor() {
    super('Hud');
  }

  create(data: { game: GameScene }): void {
    this.world = data.game;
    this.menuOpen = false;
    this.lastInventory = null;
    this.lastSelected = -1;
    this.lastDay = '';
    this.lastQuests = null;
    this.bars = [];
    const { w: W, h: H } = view;
    this.dayText = this.add.bitmapText(8, 8, FONT.body, '').setTint(COLORS.text).setDepth(5);
    // The boss's health, across the top of the screen, only while a boss fight is on.
    const bossW = Math.min(180, W - 120);
    this.bossName = this.add.bitmapText(W / 2, 10, FONT.small, '').setOrigin(0.5, 0).setTint(COLORS.gold).setDepth(5).setVisible(false);
    this.bossBar = new Bar(this, W / 2 - bossW / 2, 22, bossW, 8, 0xb04adf).setDepth(5).setVisible(false);
    BARS.forEach((b, i) => {
      const y = 30 + i * 13;
      this.add.image(14, y + 4, 'icons', b.icon).setDisplaySize(12, 12).setDepth(5);
      const bar = new Bar(this, 24, y, BAR_W, 8, b.color);
      bar.setDepth(5);
      this.bars.push({ bar, last: -1 });
    });
    new Button(this, W - 24, 22, 'II', () => this.openMenu(), { w: 34, h: 28 }).setDepth(6);
    new Button(this, W - 24, 54, t('tabBag'), () => this.world.openInventory({ mode: 'bag' }), { w: 34, h: 24, font: FONT.small }).setDepth(6);
    new Button(this, W - 26, 82, t('questShort'), () => this.world.openQuests(), { w: 44, h: 24, font: FONT.small }).setDepth(6);
    this.tracker = this.add.bitmapText(8, 86, FONT.small, '').setTint(COLORS.gold).setDepth(5).setMaxWidth(W - 90);
    new Button(this, W - 52, H - 100, t('useAction'), () => {
      controls.action = true;
    }, { w: 68, h: 68, style: 'primary' }).setDepth(6);
    new Joystick(this, () => services.settings?.joystick ?? 'floating');
    this.slotLayer = this.add.container(0, 0).setDepth(7);
    this.input.on('pointerdown', this.onTap, this);
  }

  private slotX(i: number): number {
    const total = HOTBAR_SIZE * SLOT + (HOTBAR_SIZE - 1) * GAP;
    return Math.round((view.w - total) / 2) + i * (SLOT + GAP);
  }

  private slotY(): number {
    return view.h - SLOT - 8;
  }

  private onTap(p: Phaser.Input.Pointer): void {
    if (this.input.hitTestPointer(p).length > 0) return;
    const x = vx(p);
    const y = vy(p);
    if (y < this.slotY() || y > this.slotY() + SLOT) return;
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      if (x >= this.slotX(i) && x <= this.slotX(i) + SLOT) {
        this.world.select(i);
        return;
      }
    }
  }

  /** Redraw the hotbar; only called when the inventory or the selection changed. */
  private drawHotbar(): void {
    this.slotLayer.removeAll(true);
    const inv = this.world.session.inventory;
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const x = this.slotX(i);
      const y = this.slotY();
      const selected = i === this.world.session.selected;
      this.slotLayer.add(nine(this, x, y, selected ? 'ui_tab_on' : 'ui_slot', SLOT, SLOT).setOrigin(0, 0));
      const slot = inv[i];
      if (!slot) continue;
      this.slotLayer.add(itemIcon(this, x + SLOT / 2, y + SLOT / 2 - 1, slot.item, 24));
      if (slot.qty > 1) {
        this.slotLayer.add(this.add.bitmapText(x + SLOT - 3, y + SLOT - 3, FONT.small, String(slot.qty)).setOrigin(1, 1).setTint(COLORS.white));
      }
      const tool = ITEMS[slot.item].tool;
      if (tool && slot.dur !== undefined) {
        const ratio = Math.min(1, slot.dur / tool.durability);
        this.slotLayer.add(this.add.rectangle(x + 4, y + SLOT - 5, SLOT - 8, 2, 0x000000, 0.6).setOrigin(0, 0));
        this.slotLayer.add(this.add.rectangle(x + 4, y + SLOT - 5, Math.round((SLOT - 8) * ratio), 2, tool.type === 'can' ? 0x5fa8ff : 0x6bd46b).setOrigin(0, 0));
      }
    }
  }

  /** Pause dialog: the island stops while it is open. Also used for the Android back button. */
  openMenu(): void {
    if (this.menuOpen || this.scene.isPaused('Game')) return;
    this.menuOpen = true;
    this.world.saveNow();
    this.scene.pause('Game');
    const finish = (): void => {
      this.menuOpen = false;
      unregister?.();
      this.scene.resume('Game');
    };
    const close = showModal(this, t('paused'), '', [
      { label: t('resume'), style: 'primary', onClick: finish },
      {
        label: t('saveQuit'),
        onClick: () => {
          finish();
          this.world.quitToMenu();
        },
      },
    ]);
    // Pressed after the dialog's own handler, so it runs first and also resumes the island.
    const unregister = services.platform?.onBack(() => {
      close();
      finish();
      return true;
    });
  }

  /** The hero collapsed. The dialog cannot be dismissed with Back; only its button continues. */
  showDeath(difficulty: Difficulty, onWake: () => void): void {
    const body = difficulty === 'hardcore' ? t('deathHardcore') : difficulty === 'normal' ? t('deathNormal') : t('deathRelaxed');
    const unregister = services.platform?.onBack(() => true);
    showModal(this, t('deathTitle'), body, [
      {
        label: difficulty === 'hardcore' ? t('deathOver') : t('deathContinue'),
        style: 'primary',
        onClick: () => {
          unregister?.();
          onWake();
        },
      },
    ], 20000, false);
  }

  /** Show or hide the boss's name and health. */
  private updateBoss(): void {
    const boss = this.world.bossBar();
    this.bossName.setVisible(boss !== null);
    this.bossBar.setVisible(boss !== null);
    if (!boss) return;
    this.bossName.setText(t(boss.name));
    this.bossBar.setValue(boss.hp / boss.max);
  }

  /** The running quest and its current step, under the bars; redrawn only when the quests or the backpack change. */
  private updateTracker(): void {
    const s = this.world.session;
    if (s.quests === this.lastQuests && s.inventory === this.lastInventory) return;
    this.lastQuests = s.quests;
    const def = trackedQuest(s.quests, QUESTS);
    if (!def) {
      this.tracker.setText('');
      return;
    }
    const p = progressOf(s.quests, QUESTS, def.id, s.inventory);
    const step = tr(def.steps[s.quests.active[def.id].step].text);
    this.tracker.setText(`${tr(def.title)}\n${step}${p.need > 1 ? ` ${t('questProgress', { have: p.have, need: p.need })}` : ''}`);
  }

  update(): void {
    this.updateBoss();
    this.updateTracker();
    const s = this.world.session;
    const day = `${t('hudDay', { n: s.clock.day })}  ${clockLabel(s.clock)}`;
    if (day !== this.lastDay) {
      this.lastDay = day;
      this.dayText.setText(day);
    }
    const values = [s.vitals.hp, s.vitals.hunger, s.vitals.thirst, s.vitals.stamina];
    this.bars.forEach((b, i) => {
      if (Math.abs(values[i] - b.last) < 0.5) return;
      b.last = values[i];
      b.bar.setValue(values[i] / 100, false);
    });
    if (s.inventory !== this.lastInventory || s.selected !== this.lastSelected) {
      this.lastInventory = s.inventory;
      this.lastSelected = s.selected;
      this.drawHotbar();
    }
  }
}
