import Phaser from 'phaser';
import type { GameScene } from './GameScene';
import { t, tr } from '@/core/i18n';
import { services } from '@/core/services';
import { view, vx, vy } from '@/core/viewport';
import { ITEMS } from '@/data/items';
import { controls } from '@/game/input';
import { QUESTS } from '@/data/quests';
import { WeatherFx } from '@/gfx/WeatherFx';
import { clockLabel } from '@/sim/daynight';
import { isHarmful, type BuffId } from '@/sim/buffs';
import { DAYS_PER_SEASON, dayOfSeason, seasonOf, weatherAt, weatherName } from '@/sim/weather';
import { HOTBAR_SIZE, type Inventory } from '@/sim/inventory';
import { progressOf, trackedQuest, type QuestState } from '@/sim/quests';
import type { Difficulty } from '@/sim/vitals';
import { showModal } from '@/ui/modal';
import { itemIcon } from '@/ui/itemIcon';
import { Joystick } from '@/ui/Joystick';
import { nine } from '@/ui/skin';
import { COLORS, FONT } from '@/ui/theme';
import { maxDurability } from '@/sim/upgrade';
import { IconButton } from '@/ui/icons';
import { Bar, Button, panel } from '@/ui/widgets';

const SLOT = 34;
const GAP = 3;
const BAR_W = 78;
const BARS = [
  { key: 'hp', icon: 'ui_heart', color: 0xe0524f },
  { key: 'hunger', icon: 'ui_food', color: 0xff9a3c },
  { key: 'thirst', icon: 'ui_drop', color: 0x5fa8ff },
  { key: 'stamina', icon: 'ui_bolt', color: 0x6bd46b },
  { key: 'warmth', icon: 'ui_warm', color: 0xff7a3c },
] as const;

/** The picture shown for each lasting effect. */
const BUFF_ICON: Record<BuffId, { atlas: string; frame: string }> = {
  wellfed: { atlas: 'icons', frame: 'cooked_meat' }, energized: { atlas: 'icons', frame: 'ui_bolt' }, warm: { atlas: 'icons', frame: 'ui_warm' },
  strong: { atlas: 'icons', frame: 'sword_iron' }, swift: { atlas: 'icons', frame: 'boots_leather' }, fortified: { atlas: 'icons', frame: 'armor_iron' },
  poisoned: { atlas: 'icons', frame: 'antidote' },
};

/** Heads-up display on top of the island: vitals, time, hotbar, joystick and the USE, bag and pause buttons. */
export class HudScene extends Phaser.Scene {
  private world!: GameScene;
  private dayText!: Phaser.GameObjects.BitmapText;
  private bars: { bar: Bar; last: number }[] = [];
  private slotLayer!: Phaser.GameObjects.Container;
  private lastInventory: Inventory | null = null;
  private lastSelected = -1;
  private lastDay = '';
  private seasonText!: Phaser.GameObjects.BitmapText;
  private weatherFx!: WeatherFx;
  private buffLayer!: Phaser.GameObjects.Container;
  private lastBuffs: unknown = null;
  private menuOpen = false;
  private bossName!: Phaser.GameObjects.BitmapText;
  private bossBar!: Bar;
  private tracker!: Phaser.GameObjects.BitmapText;
  private runButton!: IconButton;
  private pickUpButton!: IconButton;
  private pickUpCaption!: Phaser.GameObjects.BitmapText;
  private bagButton!: IconButton;
  private useButton!: Button;
  private hint?: Phaser.GameObjects.Container;
  private pulsing?: Phaser.Tweens.Tween;
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
    this.seasonText = this.add.bitmapText(8, 124, FONT.small, '').setTint(0xbfe6ff).setDepth(5);
    this.buffLayer = this.add.container(0, 0).setDepth(5);
    this.weatherFx = new WeatherFx(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.weatherFx.destroy());
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
    // Big round icon buttons down the right edge (finger-sized), each with a small caption under it.
    const cx = W - 32;
    new IconButton(this, cx, 34, 'pause', () => this.openMenu(), 48).setDepth(6);
    this.bagButton = new IconButton(this, cx, 100, 'bag', () => this.world.openInventory({ mode: 'bag' }), 48).setDepth(6);
    this.caption(cx, 100, t('tabBag'));
    new IconButton(this, cx, 170, 'quest', () => this.world.openQuests(), 48).setDepth(6);
    this.caption(cx, 170, t('questShort'));
    this.tracker = this.add.bitmapText(8, 144, FONT.small, '').setTint(COLORS.gold).setDepth(5).setMaxWidth(W - 100);
    this.useButton = new Button(this, W - 58, H - 108, t('useAction'), () => {
      controls.action = true;
    }, { w: 80, h: 80, style: 'primary' }).setDepth(6);
    this.runButton = new IconButton(this, W - 58, H - 204, 'run', () => {
      controls.run = !controls.run;
    }, 50).setDepth(6);
    this.caption(W - 58, H - 204, t('runAction'));
    this.pickUpButton = new IconButton(this, W - 58, H - 272, 'pickup', () => this.world.dismantle(), 50).setDepth(6).setVisible(false);
    this.pickUpCaption = this.caption(W - 58, H - 272, t('dismantle')).setVisible(false);
    new Joystick(this, () => services.settings?.joystick ?? 'floating');
    this.slotLayer = this.add.container(0, 0).setDepth(7);
    this.input.on('pointerdown', this.onTap, this);
  }

  /** A small label under a round button. */
  private caption(x: number, y: number, text: string): Phaser.GameObjects.BitmapText {
    const label = this.add.bitmapText(x, y + 31, FONT.small, text).setOrigin(0.5, 0).setTint(COLORS.text).setDepth(6);
    label.setDropShadow(1, 1, 0x000000, 0.9);
    return label;
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
        const ratio = Math.min(1, slot.dur / maxDurability(slot.item, slot.plus));
        this.slotLayer.add(this.add.rectangle(x + 4, y + SLOT - 5, SLOT - 8, 2, 0x000000, 0.6).setOrigin(0, 0));
        this.slotLayer.add(this.add.rectangle(x + 4, y + SLOT - 5, Math.round((SLOT - 8) * ratio), 2, tool.type === 'can' ? 0x5fa8ff : 0x6bd46b).setOrigin(0, 0));
      }
    }
  }

  /**
   * A coaching hint in a banner over the world, with the button it is about pulsing; null clears it. `onSkip` is what the
   * "Skip tips" link does.
   */
  setHint(text: string | null, point: 'bag' | 'run' | 'use' | null, onSkip?: () => void): void {
    this.hint?.destroy();
    this.hint = undefined;
    this.pulsing?.stop();
    for (const b of [this.bagButton, this.runButton, this.useButton]) b.setScale(1);
    if (!text) return;
    const { w: W, h: H } = view;
    const boxW = Math.min(W - 84, 300);
    const body = this.add.bitmapText(0, 0, FONT.body, text).setTint(COLORS.text).setMaxWidth(boxW - 28);
    const boxH = Math.round(body.height) + 54;
    const top = Math.round(H * 0.2);
    const bg = panel(this, 0, 0, boxW, boxH, 'ui_panel_ornate');
    body.setPosition(14, 12);
    const skip = this.add.bitmapText(boxW - 14, boxH - 10, FONT.small, t('tutSkip')).setOrigin(1, 1).setTint(COLORS.textDim).setInteractive({ useHandCursor: true });
    skip.on('pointerup', () => onSkip?.());
    this.hint = this.add.container(10, top, [bg, body, skip]).setDepth(8).setAlpha(0);
    this.tweens.add({ targets: this.hint, alpha: 1, y: top + 4, duration: 260, ease: 'Sine.easeOut' });
    const target = point === 'bag' ? this.bagButton : point === 'run' ? this.runButton : point === 'use' ? this.useButton : null;
    if (target) this.pulsing = this.tweens.add({ targets: target, scale: 1.14, duration: 480, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** The lasting effects as little pictures under the bars (green for good, red for bad). */
  private drawBuffs(): void {
    this.buffLayer.removeAll(true);
    this.world.session.buffs.forEach((b, i) => {
      const x = 14 + i * 20;
      const y = 104;
      const art = BUFF_ICON[b.id];
      this.buffLayer.add(this.add.rectangle(x, y, 18, 18, isHarmful(b.id) ? 0x7a1f1f : 0x1f5a2a, 0.85).setStrokeStyle(1, isHarmful(b.id) ? 0xff6b6b : 0x6bd46b));
      this.buffLayer.add(this.add.image(x, y, art.atlas, art.frame).setDisplaySize(14, 14));
    });
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
        label: t('journalBtn'),
        onClick: () => {
          // The island stays paused while the journal is open; closing it resumes it.
          this.menuOpen = false;
          unregister?.();
          this.scene.launch('Journal', { game: this.world });
        },
      },
      {
        label: t('menuSettings'),
        onClick: () => {
          // The island stays paused while the settings are open; closing them resumes it.
          this.menuOpen = false;
          unregister?.();
          this.scene.launch('Settings', { back: 'Game' });
        },
      },
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
    // The Run button glows green while running is switched on (it switches itself off when the breath runs out).
    this.runButton.setActive(controls.run);
    this.pickUpButton.setVisible(this.world.canDismantle);
    this.pickUpCaption.setVisible(this.world.canDismantle);
    this.updateBoss();
    this.updateTracker();
    const s = this.world.session;
    const day = `${t('hudDay', { n: s.clock.day })}  ${clockLabel(s.clock)}`;
    if (day !== this.lastDay) {
      this.lastDay = day;
      this.dayText.setText(day);
    }
    const clock = s.clock;
    const season = seasonOf(clock.day);
    const weather = weatherAt(s.seed, clock.day, clock.t);
    const label = `${t(`season_${season}`)} ${dayOfSeason(clock.day)}/${DAYS_PER_SEASON}  ${t(`weather_${weatherName(season, weather)}`)}`;
    if (this.seasonText.text !== label) this.seasonText.setText(label);
    this.weatherFx.set(this.world.level.dungeon ? 'clear' : weather, season);
    this.weatherFx.update(this.game.loop.delta / 1000);
    if (s.buffs !== this.lastBuffs) {
      this.lastBuffs = s.buffs;
      this.drawBuffs();
    }
    const values = [s.vitals.hp, s.vitals.hunger, s.vitals.thirst, s.vitals.stamina, s.vitals.warmth];
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
