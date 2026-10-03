import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import type { HudScene } from './HudScene';
import { Player } from '@/entities/Player';
import { Rng, hashString } from '@/core/rng';
import { newSlot, type SaveSlot } from '@/core/save';
import { services } from '@/core/services';
import { worldZoom } from '@/core/viewport';
import { t } from '@/core/i18n';
import { TerrainLayer, TILE } from '@/gfx/TerrainLayer';
import { WorldObjects } from '@/gfx/WorldObjects';
import { controls, resetControls, takeAction } from '@/game/input';
import { advance, newClock, type Clock } from '@/sim/daynight';
import { hitNode, isAlive, startNewDay, type GatherState } from '@/sim/gather';
import { nearestNode } from '@/sim/interact';
import { moveWithCollision, speedFactor, type Vec } from '@/sim/movement';
import { nodesByTile, propSolidTiles } from '@/sim/solids';
import { generateWorld } from '@/sim/world/generate';
import { idx, type ResourceNode, type World } from '@/sim/world/types';
import { COLORS, FONT } from '@/ui/theme';

/** Walking speed in tiles per second. */
const PLAYER_SPEED = 3.4;
/** How far (tiles) the hero can reach to hit a resource, and the pause between hits (seconds). */
const HIT_REACH = 1.4;
const HIT_COOLDOWN = 0.35;
const AUTOSAVE_SECONDS = 15;
const MAX_STEP = 0.05;
/** A destroyed node will not grow back while the hero stands this close (tiles). */
const REGROW_CLEARANCE = 1.5;

export interface GameInit {
  slot: number;
  /** Present for a New Game; absent when continuing a saved slot. */
  seed?: number;
}

/** The island: terrain, resources, the hero, time of day and saving. The HUD runs in its own scene on top. */
export class GameScene extends BaseScene {
  world!: World;
  clock: Clock = newClock();
  bag: Record<string, number> = {};
  pos: Vec = { x: 0, y: 0 };

  private slotData!: SaveSlot;
  private gather!: GatherState;
  private playTime = 0;
  private lastDay = 1;
  private cooldown = 0;
  private saveTimer = 0;
  private nodes!: Map<number, ResourceNode>;
  private solids = new Set<number>();
  private objects!: WorldObjects;
  private player!: Player;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
  private actionKeys: Phaser.Input.Keyboard.Key[] = [];

  constructor() {
    super('Game');
  }

  create(data: GameInit): void {
    this.transitioning = false;
    resetControls();
    const saves = services.saves;
    const loaded = data.seed === undefined ? saves?.load(data.slot) ?? null : null;
    if (data.seed === undefined && !loaded) {
      this.scene.start('Menu');
      return;
    }
    this.world = generateWorld(data.seed ?? loaded!.seed);
    this.slotData = loaded ?? newSlot(data.slot, 'Castaway', data.seed!, 'normal', this.world.start, newClock());
    if (!loaded) saves?.write(this.slotData);

    this.clock = this.slotData.clock;
    this.gather = this.slotData.gather;
    this.bag = this.slotData.bag;
    this.playTime = this.slotData.playTimeSec;
    this.pos = { ...this.slotData.player };
    this.lastDay = this.clock.day;
    this.cooldown = 0;
    this.saveTimer = 0;

    this.nodes = nodesByTile(this.world);
    this.solids = new Set(propSolidTiles(this.world));
    new TerrainLayer(this, this.world);
    this.objects = new WorldObjects(this, this.world);
    for (const n of this.world.resources) {
      if (isAlive(this.gather, n.id)) this.solids.add(idx(n.x, n.y, this.world.size));
      else this.objects.setAlive(n.id, false, false);
    }
    this.player = new Player(this, this.pos);

    this.setupCamera();
    this.setupInput();
    this.handleBack(() => {
      (this.scene.get('Hud') as HudScene).openMenu();
      return true;
    });
    this.scene.launch('Hud', { game: this });
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.saveNow, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.saveNow();
      this.game.events.off(Phaser.Core.Events.HIDDEN, this.saveNow, this);
      this.scene.stop('Hud');
    });
    this.followCamera();
    this.fadeIn(400);
  }

  private setupCamera(): void {
    const cam = this.cameras.main;
    // The shared HiResCamera plugin anchors cameras at the top-left; the world camera zooms around its centre.
    cam.setOrigin(0.5, 0.5).setZoom(worldZoom(2)).setBackgroundColor(0x0a2a4a);
    cam.setBounds(0, 0, this.world.size * TILE, this.world.size * TILE);
  }

  private setupInput(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    this.cursors = kb.createCursorKeys();
    this.wasd = kb.addKeys({ w: 'W', a: 'A', s: 'S', d: 'D' }) as Record<'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
    this.actionKeys = [kb.addKey('SPACE'), kb.addKey('E')];
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, MAX_STEP);
    this.clock = advance(this.clock, dt);
    this.playTime += dt;
    if (this.clock.day !== this.lastDay) this.onNewDay();

    const move = this.readMove();
    if (move.x !== 0 || move.y !== 0) {
      const speed = PLAYER_SPEED * speedFactor(this.world, this.pos.x, this.pos.y);
      this.pos = moveWithCollision(this.world, this.solids, this.pos, move.x * speed * dt, move.y * speed * dt);
    }
    this.player.update(this.pos, move);

    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.consumeAction() && this.cooldown === 0) this.tryHit();

    this.followCamera();
    this.saveTimer += dt;
    if (this.saveTimer >= AUTOSAVE_SECONDS) this.saveNow();
  }

  /** Keyboard (for desktop testing) plus the touch joystick, capped at length 1. */
  private readMove(): Vec {
    let x = controls.moveX;
    let y = controls.moveY;
    if (this.cursors) {
      if (this.cursors.left.isDown || this.wasd.a.isDown) x -= 1;
      if (this.cursors.right.isDown || this.wasd.d.isDown) x += 1;
      if (this.cursors.up.isDown || this.wasd.w.isDown) y -= 1;
      if (this.cursors.down.isDown || this.wasd.s.isDown) y += 1;
    }
    const len = Math.hypot(x, y);
    return len > 1 ? { x: x / len, y: y / len } : { x, y };
  }

  private consumeAction(): boolean {
    const fromKeys = this.actionKeys.some((k) => Phaser.Input.Keyboard.JustDown(k));
    const fromHud = takeAction();
    return fromKeys || fromHud;
  }

  private tryHit(): void {
    this.cooldown = HIT_COOLDOWN;
    const node = nearestNode(this.nodes, this.world.size, this.pos, HIT_REACH, (id) => isAlive(this.gather, id));
    if (node) this.player.face(node.x + 0.5 - this.pos.x, node.y + 0.5 - this.pos.y);
    this.player.punch();
    if (!node) return;
    const rng = new Rng(hashString(`${this.slotData.seed}:${node.id}:${this.gather.hp[node.id] ?? 'full'}`));
    const result = hitNode(this.gather, node, 1, this.clock.day, rng);
    this.gather = result.state;
    this.objects.shake(node.id);
    services.platform?.haptic('light');
    if (result.destroyed) {
      this.solids.delete(idx(node.x, node.y, this.world.size));
      this.objects.setAlive(node.id, false);
    }
    result.drops.forEach((d, i) => {
      this.bag = { ...this.bag, [d.item]: (this.bag[d.item] ?? 0) + d.amount };
      this.floatText(`+${d.amount} ${t(`item_${d.item}`)}`, i);
    });
  }

  /** Nodes that were gone may grow back; the ones next to the hero wait for tomorrow. */
  private onNewDay(): void {
    const day = this.clock.day;
    this.lastDay = day;
    const before = this.gather;
    this.gather = startNewDay(this.gather, day, (id) => this.heroIsNear(id));
    for (const key of Object.keys(before.gone)) {
      const id = Number(key);
      if (!isAlive(this.gather, id)) continue;
      const n = this.world.resources[id];
      this.objects.setAlive(id, true);
      this.solids.add(idx(n.x, n.y, this.world.size));
    }
    services.notify?.(t('hudDay', { n: day }));
    this.saveNow();
  }

  private heroIsNear(id: number): boolean {
    const n = this.world.resources[id];
    return Math.hypot(n.x + 0.5 - this.pos.x, n.y + 0.5 - this.pos.y) < REGROW_CLEARANCE;
  }

  private floatText(text: string, row: number): void {
    const x = this.pos.x * TILE;
    const y = this.pos.y * TILE - 26 - row * 8;
    const label = this.add.bitmapText(x, y, FONT.small, text).setOrigin(0.5).setTint(COLORS.gold).setScale(0.5).setDepth(1_000_000);
    this.tweens.add({ targets: label, y: y - 14, alpha: 0, duration: 900, ease: 'Sine.easeOut', onComplete: () => label.destroy() });
  }

  /** Centre on the hero, then snap to whole device pixels so pixel art does not shimmer. */
  private followCamera(): void {
    const cam = this.cameras.main;
    cam.centerOn(this.pos.x * TILE, this.pos.y * TILE);
    const k = worldZoom(2);
    cam.scrollX = Math.round(cam.scrollX * k) / k;
    cam.scrollY = Math.round(cam.scrollY * k) / k;
  }

  private snapshot(): SaveSlot {
    return {
      ...this.slotData,
      player: { x: this.pos.x, y: this.pos.y },
      bag: this.bag,
      clock: this.clock,
      gather: this.gather,
      playTimeSec: this.playTime,
    };
  }

  saveNow(): void {
    this.saveTimer = 0;
    services.saves?.write(this.snapshot());
  }

  quitToMenu(): void {
    this.saveNow();
    this.goTo('Menu');
  }
}
