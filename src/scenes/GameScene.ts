import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import type { HudScene } from './HudScene';
import { Player } from '@/entities/Player';
import { newSlot, type SaveSlot } from '@/core/save';
import { services } from '@/core/services';
import { t } from '@/core/i18n';
import { worldZoom } from '@/core/viewport';
import type { Recipe } from '@/data/recipes';
import type { Station, StructureId } from '@/data/structures';
import { FarmLayer } from '@/gfx/FarmLayer';
import { NightLight } from '@/gfx/NightLight';
import { StructureLayer, type LightSource } from '@/gfx/StructureLayer';
import { TerrainLayer, TILE } from '@/gfx/TerrainLayer';
import { WorldObjects } from '@/gfx/WorldObjects';
import { controls, resetControls, takeAction } from '@/game/input';
import { frontTile, resolveAction, type Action } from '@/sim/actions';
import { lighting, newClock } from '@/sim/daynight';
import { plotAt } from '@/sim/farm';
import { emptyGather, isAlive, sanitizeGather } from '@/sim/gather';
import { nearestNode } from '@/sim/interact';
import { moveWithCollision, speedFactor, type Vec } from '@/sim/movement';
import {
  applyAction, collapse, craftRecipe, moveInventorySlot, rollDay, selectSlot, sessionFromSlot, sessionToSlot, tickSession,
  transferStack, type Fx, type Session, type Step,
} from '@/sim/session';
import { nodesByTile, propSolidTiles } from '@/sim/solids';
import { nearbyStations, structureSolids } from '@/sim/structures';
import { isDead } from '@/sim/vitals';
import { GENERATOR_VERSION, generateWorld } from '@/sim/world/generate';
import { idx, type Biome, type ResourceNode, type World } from '@/sim/world/types';
import { COLORS, FONT } from '@/ui/theme';

/** Walking speed in tiles per second, how far the hero reaches, and the pause between uses (seconds). */
const PLAYER_SPEED = 3.4;
const HIT_REACH = 1.4;
const ACTION_COOLDOWN = 0.35;
const AUTOSAVE_SECONDS = 15;
const MAX_STEP = 0.05;
/** A destroyed node will not grow back while the hero stands this close (tiles). */
const REGROW_CLEARANCE = 1.5;
/** Stamina recovers slowly for this long after the hero acts (seconds). */
const BUSY_SECONDS = 1.2;
const HERO_LIGHT = 52;

export interface GameInit {
  slot: number;
  /** Present for a New Game; absent when continuing a saved slot. */
  seed?: number;
}

export interface OpenOptions {
  mode: 'bag' | 'craft' | 'chest';
  chestId?: number;
}

type Say = Extract<Fx, { t: 'say' }>;

/** The island: terrain, objects, the hero and the rules that connect them. The HUD runs in its own scene on top. */
export class GameScene extends BaseScene {
  world!: World;
  session!: Session;
  pos: Vec = { x: 0, y: 0 };

  private slotData!: SaveSlot;
  private lastDay = 1;
  private cooldown = 0;
  private idle = 99;
  private saveTimer = 0;
  private dead = false;
  private wiped = false;
  private nodes!: Map<number, ResourceNode>;
  private propTiles: number[] = [];
  private solids = new Set<number>();
  private occupied = new Set<number>();
  private objects!: WorldObjects;
  private structureLayer!: StructureLayer;
  private farmLayer!: FarmLayer;
  private night!: NightLight;
  private player!: Player;
  private cursor!: Phaser.GameObjects.Rectangle;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
  private actionKeys: Phaser.Input.Keyboard.Key[] = [];
  private digitKeys: Phaser.Input.Keyboard.Key[] = [];
  private floatRow = 0;

  constructor() {
    super('Game');
  }

  create(data: GameInit): void {
    this.transitioning = false;
    this.dead = false;
    this.wiped = false;
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

    // Node ids follow the generator; if it changed since this save, the old harvest diff would point at other nodes.
    const gather = this.slotData.worldVersion === GENERATOR_VERSION
      ? sanitizeGather(this.slotData.gather, this.world.resources.length)
      : emptyGather();
    this.session = { ...sessionFromSlot(this.slotData), gather };
    this.pos = { ...this.slotData.player };
    this.lastDay = this.session.clock.day;
    this.cooldown = 0;
    this.saveTimer = 0;
    this.idle = 99;

    this.nodes = nodesByTile(this.world);
    this.propTiles = propSolidTiles(this.world);
    new TerrainLayer(this, this.world);
    this.objects = new WorldObjects(this, this.world);
    for (const n of this.world.resources) if (!isAlive(gather, n.id)) this.objects.setAlive(n.id, false, false);
    this.structureLayer = new StructureLayer(this, this.session.structures);
    this.farmLayer = new FarmLayer(this, this.session.farm);
    this.rebuildBlocking();
    this.player = new Player(this, this.pos);
    this.cursor = this.add.rectangle(0, 0, TILE, TILE).setOrigin(0, 0).setStrokeStyle(1, 0xffffff, 0.9).setFillStyle(0xffffff, 0.12).setDepth(80000).setVisible(false);

    this.setupCamera();
    this.night = new NightLight(this, this.cameras.main);
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
      this.scene.stop('Inventory');
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
    this.digitKeys = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT'].map((k) => kb.addKey(k));
  }

  update(_time: number, delta: number): void {
    if (this.dead) {
      this.followCamera();
      return;
    }
    const dt = Math.min(delta / 1000, MAX_STEP);
    this.idle += dt;
    this.session = tickSession(this.session, dt, this.biomeAt(), this.idle < BUSY_SECONDS);
    if (this.session.clock.day !== this.lastDay) this.onNewDay();
    if (isDead(this.session.vitals)) {
      this.onCollapse();
      return;
    }
    this.digitKeys.forEach((k, i) => {
      if (Phaser.Input.Keyboard.JustDown(k)) this.select(i);
    });

    const move = this.readMove();
    if (move.x !== 0 || move.y !== 0) {
      const speed = PLAYER_SPEED * speedFactor(this.world, this.pos.x, this.pos.y);
      this.pos = moveWithCollision(this.world, this.solids, this.pos, move.x * speed * dt, move.y * speed * dt);
    }
    this.player.update(this.pos, move);

    this.cooldown = Math.max(0, this.cooldown - dt);
    const pressed = this.consumeAction();
    const action = this.computeAction();
    this.showCursor(action);
    if (pressed && this.cooldown === 0) this.perform(action);

    this.followCamera();
    const light = lighting(this.session.clock);
    this.night.update(dt, this.cameras.main, light.color, light.alpha, this.lightSources());
    this.saveTimer += dt;
    if (this.saveTimer >= AUTOSAVE_SECONDS) this.saveNow();
  }

  private biomeAt(): Biome {
    const i = idx(Math.floor(this.pos.x), Math.floor(this.pos.y), this.world.size);
    return this.world.biome[i] as Biome;
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

  /** What ACTION would do right now. */
  private computeAction(): Action {
    const node = nearestNode(this.nodes, this.world.size, this.pos, HIT_REACH, (id) => isAlive(this.session.gather, id));
    const s = this.session;
    return resolveAction({
      world: this.world, inv: s.inventory, selected: s.selected, vitals: s.vitals, pos: this.pos, facing: this.player.facing,
      structures: s.structures, farm: s.farm, occupied: this.occupied, node,
    });
  }

  private showCursor(a: Action): void {
    const targeted = ['place', 'till', 'plant', 'water', 'refill', 'harvest', 'open', 'sleep', 'drink', 'pickup'].includes(a.kind);
    const refused = a.kind === 'blocked' && a.reason === 'cannotPlace';
    this.cursor.setVisible(targeted || refused);
    if (!targeted && !refused) return;
    const f = frontTile(this.pos, this.player.facing);
    this.cursor.setPosition(f.x * TILE, f.y * TILE).setStrokeStyle(1, refused ? 0xff5555 : 0xffffff, 0.9);
  }

  private perform(action: Action): void {
    this.cooldown = ACTION_COOLDOWN;
    if (action.kind === 'none') return;
    if (action.kind === 'hit') this.player.face(action.node.x + 0.5 - this.pos.x, action.node.y + 0.5 - this.pos.y);
    if (action.kind !== 'blocked') this.idle = 0;
    this.commit(applyAction(this.session, action, this.pos));
    services.platform?.haptic('light');
  }

  /** Take a rule result: the new state, and the effects to show. */
  private commit(step: Step): void {
    this.session = step.session;
    this.floatRow = 0;
    for (const fx of step.fx) this.playFx(fx);
    this.rebuildBlocking();
  }

  private playFx(fx: Fx): void {
    switch (fx.t) {
      case 'say': services.notify?.(this.sayText(fx)); break;
      case 'gain': this.showGain(`+${fx.qty} ${t(`item_${fx.item}`)}`); break;
      case 'swing': this.player.punch(); break;
      case 'hit': this.objects.shake(fx.id); break;
      case 'gone': this.objects.setAlive(fx.id, false); break;
      case 'built': this.structureLayer.add(fx.structure); break;
      case 'unbuilt': this.structureLayer.remove(fx.id); break;
      case 'plot': this.farmLayer.refresh(fx.tile, plotAt(this.session.farm, fx.tile)); break;
      case 'open': this.openStructure(fx.structure.type, fx.structure.id); break;
      case 'slept': this.cameras.main.flash(700, 8, 10, 30); break;
    }
  }

  private sayText(fx: Say): string {
    const vars = { ...fx.vars };
    for (const key of fx.translate ?? []) vars[key] = t(String(vars[key]));
    return t(fx.key, vars);
  }

  private showGain(text: string): void {
    if (this.scene.isPaused()) {
      services.notify?.(text);
      return;
    }
    const x = this.pos.x * TILE;
    const y = this.pos.y * TILE - 26 - this.floatRow++ * 8;
    const label = this.add.bitmapText(x, y, FONT.small, text).setOrigin(0.5).setTint(COLORS.gold).setScale(0.5).setDepth(1_000_000);
    this.tweens.add({ targets: label, y: y - 14, alpha: 0, duration: 900, ease: 'Sine.easeOut', onComplete: () => label.destroy() });
  }

  /** Walk-blocking tiles (living nodes, scenery, solid structures) and tiles that cannot be built or tilled on. */
  private rebuildBlocking(): void {
    const s = this.session;
    const solids = new Set<number>(this.propTiles);
    for (const n of this.world.resources) if (isAlive(s.gather, n.id)) solids.add(idx(n.x, n.y, this.world.size));
    for (const tile of structureSolids(s.structures, this.world.size)) solids.add(tile);
    const occupied = new Set<number>(solids);
    for (const p of s.structures.list) occupied.add(idx(p.x, p.y, this.world.size));
    for (const key of Object.keys(s.farm.plots)) occupied.add(Number(key));
    this.solids = solids;
    this.occupied = occupied;
  }

  /** Nodes that were gone may grow back; the ones next to the hero wait for tomorrow. */
  private onNewDay(): void {
    const before = this.session.gather;
    this.lastDay = this.session.clock.day;
    this.session = rollDay(this.session, (id) => this.heroIsNear(id));
    for (const key of Object.keys(before.gone)) {
      const id = Number(key);
      if (isAlive(this.session.gather, id)) this.objects.setAlive(id, true);
    }
    this.farmLayer.rebuild(this.session.farm);
    this.rebuildBlocking();
    services.notify?.(t('hudDay', { n: this.lastDay }));
    this.saveNow();
  }

  private heroIsNear(id: number): boolean {
    const n = this.world.resources[id];
    return Math.hypot(n.x + 0.5 - this.pos.x, n.y + 0.5 - this.pos.y) < REGROW_CLEARANCE;
  }

  private onCollapse(): void {
    this.dead = true;
    (this.scene.get('Hud') as HudScene).showDeath(this.session.difficulty, () => this.wakeUp());
  }

  /** After the death dialog: lose what the difficulty takes and wake at the respawn point, or end a hardcore run. */
  private wakeUp(): void {
    const result = collapse(this.session, Math.random);
    if (result.wipeSave) {
      this.wiped = true;
      services.saves?.delete(this.slotData.slot);
      this.goTo('Menu');
      return;
    }
    this.session = result.session;
    this.pos = { ...this.session.respawn };
    this.player.update(this.pos, { x: 0, y: 0 });
    this.dead = false;
    this.idle = 99;
    this.saveNow();
  }

  private lightSources(): LightSource[] {
    return [
      ...this.structureLayer.lights(this.session.structures),
      { x: this.pos.x * TILE, y: this.pos.y * TILE - 8, radius: HERO_LIGHT },
    ];
  }

  /** Centre on the hero, then snap to whole device pixels so pixel art does not shimmer. */
  private followCamera(): void {
    const cam = this.cameras.main;
    cam.centerOn(this.pos.x * TILE, this.pos.y * TILE);
    const k = worldZoom(2);
    cam.scrollX = Math.round(cam.scrollX * k) / k;
    cam.scrollY = Math.round(cam.scrollY * k) / k;
  }

  // ---- used by the HUD and the inventory screen

  select(index: number): void {
    this.session = selectSlot(this.session, index);
  }

  /** Crafting stations within reach of the hero. */
  stations(): Set<Station> {
    return nearbyStations(this.session.structures, this.pos);
  }

  craft(recipe: Recipe): void {
    this.commit(craftRecipe(this.session, recipe, this.stations()));
  }

  moveSlot(from: number, to: number): void {
    this.session = moveInventorySlot(this.session, from, to);
  }

  transfer(chestId: number, from: 'bag' | 'chest', index: number): void {
    this.commit(transferStack(this.session, chestId, from, index));
  }

  /** Open the backpack, the crafting list of a station, or a chest; the island waits while it is open. */
  openInventory(opts: OpenOptions): void {
    if (this.scene.isPaused()) return;
    this.scene.pause('Game');
    this.scene.launch('Inventory', { game: this, ...opts });
  }

  private openStructure(type: StructureId, id: number): void {
    this.openInventory(type === 'chest' ? { mode: 'chest', chestId: id } : { mode: 'craft' });
  }

  private snapshot(): SaveSlot {
    return { ...sessionToSlot(this.slotData, this.session, this.pos), worldVersion: GENERATOR_VERSION };
  }

  saveNow(): void {
    if (this.wiped || !this.session) return;
    this.saveTimer = 0;
    services.saves?.write(this.snapshot());
  }

  quitToMenu(): void {
    this.saveNow();
    this.goTo('Menu');
  }
}
