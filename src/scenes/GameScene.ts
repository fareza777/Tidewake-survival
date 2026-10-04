import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import type { HudScene } from './HudScene';
import { Player } from '@/entities/Player';
import { newSlot, type SaveSlot } from '@/core/save';
import { cleanName } from '@/core/newGame';
import { services } from '@/core/services';
import { t } from '@/core/i18n';
import { worldZoom } from '@/core/viewport';
import type { Recipe } from '@/data/recipes';
import type { Station, StructureId } from '@/data/structures';
import { FloatText } from '@/gfx/FloatText';
import { NightLight } from '@/gfx/NightLight';
import { TILE } from '@/gfx/TerrainLayer';
import { DungeonLevel } from '@/game/DungeonLevel';
import { InputReader } from '@/game/InputReader';
import { StoryDirector } from '@/game/StoryDirector';
import { HeroCombat } from '@/game/HeroCombat';
import { IslandLevel } from '@/game/IslandLevel';
import type { Level } from '@/game/Level';
import { MusicDirector } from '@/game/MusicDirector';
import { resetControls } from '@/game/input';
import { frontTile, resolveAction, type Action } from '@/sim/actions';
import { cueForFx } from '@/sim/cues';
import { newClock } from '@/sim/daynight';
import { generateDungeon } from '@/sim/dungeon/generate';
import { DUNGEON_VERSION, emptyDungeons, type DungeonId } from '@/sim/dungeon/progress';
import { doorwayOutside } from '@/sim/dungeon/rules';
import { emptyGather, sanitizeGather } from '@/sim/gather';
import { meleeFor } from '@/sim/melee';
import { moveWithCollision, speedFactor, type Vec } from '@/sim/movement';
import {
  applyAction, collapse, craftRecipe, story, equipArmor, moveInventorySlot, selectSlot, sessionFromSlot, sessionToSlot, takeOffArmor, tickSession,
  transferStack, type Fx, type Session, type Step,
} from '@/sim/session';
import { isDead, type Difficulty } from '@/sim/vitals';
import { GENERATOR_VERSION, generateWorld } from '@/sim/world/generate';
import { idx, type Biome, type World } from '@/sim/world/types';
import { COLORS } from '@/ui/theme';

/** Walking speed in tiles per second, and the pause between uses (seconds). */
const PLAYER_SPEED = 3.4;
const ACTION_COOLDOWN = 0.35;
const AUTOSAVE_SECONDS = 15;
const MAX_STEP = 0.05;
/** Stamina recovers slowly for this long after the hero acts (seconds). */
const BUSY_SECONDS = 1.2;

export interface GameInit {
  slot: number;
  /** Present for a New Game; absent when continuing a saved slot. */
  seed?: number;
  /** The hero's name and the difficulty chosen in New Game. */
  name?: string;
  difficulty?: Difficulty;
}

export interface OpenOptions {
  mode: 'bag' | 'craft' | 'chest';
  chestId?: number;
}

type Say = Extract<Fx, { t: 'say' }>;

/** The place the hero is in (the island or a dungeon), the hero, and the rules that connect them. The HUD runs in its own scene on top. */
export class GameScene extends BaseScene {
  world!: World;
  session!: Session;
  level!: Level;
  combat!: HeroCombat;
  story!: StoryDirector;
  pos: Vec = { x: 0, y: 0 };
  player!: Player;
  float!: FloatText;
  /** Tiles the hero cannot walk through: living nodes, scenery, buildings, closed doors, blocks. */
  solids = new Set<number>();
  /** Seconds the scene stands still after a good hit, to give blows some weight. */
  hitStop = 0;
  /** True while the collapse dialog is up. */
  dead = false;

  private slotData!: SaveSlot;
  private lastDay = 1;
  private cooldown = 0;
  private idle = 99;
  private saveTimer = 0;
  private wiped = false;
  private occupied = new Set<number>();
  private night!: NightLight;
  private cursor!: Phaser.GameObjects.Rectangle;
  private keys!: InputReader;
  private music = new MusicDirector();

  constructor() {
    super('Game');
  }

  create(data: GameInit): void {
    this.transitioning = false;
    this.dead = false;
    this.wiped = false;
    resetControls();
    const loaded = data.seed === undefined ? services.saves?.load(data.slot) ?? null : null;
    if (data.seed === undefined && !loaded) {
      this.scene.start('Menu');
      return;
    }
    const seed = data.seed ?? loaded!.seed;
    const island = loaded?.location && loaded.dungeonVersion === DUNGEON_VERSION ? null : generateWorld(seed);
    this.slotData = loaded ?? newSlot(data.slot, cleanName(data.name), seed, data.difficulty ?? 'normal', island!.start, newClock());
    if (!loaded) services.saves?.write(this.slotData);

    const where = island ? null : this.slotData.location;
    this.session = this.startSession(island, where);
    this.level = where ? new DungeonLevel(this, generateDungeon(seed, where)) : new IslandLevel(this, island!, this.session);
    this.world = this.level.world;
    // (a save from a dungeon this game can no longer build wakes the hero at his bed)
    this.pos = this.level.place(this.slotData.location && !where ? { ...this.slotData.respawn } : { ...this.slotData.player });
    this.lastDay = this.session.clock.day;
    this.cooldown = 0;
    this.saveTimer = 0;
    this.idle = 99;

    this.rebuildBlocking();
    this.player = new Player(this, this.pos);
    this.story = new StoryDirector(this);
    this.combat = new HeroCombat(this);
    const start = this.level.start();
    if (start) this.combat.load(start);
    this.music = new MusicDirector();
    this.float = new FloatText(this);
    this.cursor = this.add.rectangle(0, 0, TILE, TILE).setOrigin(0, 0).setStrokeStyle(1, 0xffffff, 0.9).setFillStyle(0xffffff, 0.12).setDepth(80000).setVisible(false);

    this.setupCamera();
    this.night = new NightLight(this, this.cameras.main);
    this.keys = new InputReader(this);
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
    // Start the chapters that are due (the first one in a new game), with their toasts.
    this.commitStory(story(this.session));
    if (where) services.notify?.(t(`dungeon_${where}`));
  }

  /** The session from the save; a changed island generator drops the harvest diff, a changed dungeon generator the dungeon progress. */
  private startSession(island: World | null, where: DungeonId | null): Session {
    const s = sessionFromSlot(this.slotData);
    const current = this.slotData.dungeonVersion === DUNGEON_VERSION;
    const gather = !island ? s.gather : this.slotData.worldVersion === GENERATOR_VERSION ? sanitizeGather(s.gather, island.resources.length) : emptyGather();
    return { ...s, gather, location: where, dungeons: current ? s.dungeons : emptyDungeons() };
  }

  private setupCamera(): void {
    const cam = this.cameras.main;
    // The shared HiResCamera plugin anchors cameras at the top-left; the world camera zooms around its centre.
    cam.setOrigin(0.5, 0.5).setZoom(worldZoom(2)).setBackgroundColor(this.level.dungeon ? 0x05070d : 0x0a2a4a);
    cam.setBounds(0, 0, this.world.size * TILE, this.world.size * TILE);
  }

  update(_time: number, delta: number): void {
    if (this.dead || this.hitStop > 0 || this.transitioning) {
      this.hitStop = Math.max(0, this.hitStop - delta / 1000);
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
    const slot = this.keys.slotPressed();
    if (slot >= 0) this.select(slot);

    const move = this.keys.move();
    if (move.x !== 0 || move.y !== 0) {
      const speed = PLAYER_SPEED * speedFactor(this.world, this.pos.x, this.pos.y);
      this.pos = moveWithCollision(this.world, this.solids, this.pos, move.x * speed * dt, move.y * speed * dt);
    }
    this.player.update(this.pos, move);
    this.combat.tick(dt);
    this.level.update(dt, move, this.combat.snapshot());
    this.story.update(dt);
    this.music.update(this.level.isNight(this.session), this.combat.fighting);

    this.cooldown = Math.max(0, this.cooldown - dt);
    const pressed = this.keys.actionPressed();
    const action = this.computeAction();
    this.showCursor(action);
    // With auto-attack on, a blow follows by itself whenever one would land on something.
    const auto = services.settings?.autoAttack === true && action.kind === 'attack';
    if ((pressed || auto) && this.cooldown === 0) this.perform(action);

    this.followCamera();
    const lit = this.level.lit(this.session);
    const hero = { x: this.pos.x * TILE, y: this.pos.y * TILE - 8, radius: lit.hero };
    this.night.update(dt, this.cameras.main, lit.color, lit.alpha, [...lit.sources, hero]);
    this.saveTimer += dt;
    if (this.saveTimer >= AUTOSAVE_SECONDS) this.saveNow();
  }

  private biomeAt(): Biome {
    return this.world.biome[idx(Math.floor(this.pos.x), Math.floor(this.pos.y), this.world.size)] as Biome;
  }

  /** What ACTION would do right now. */
  private computeAction(): Action {
    const s = this.session;
    const view = this.level.view(s, this.pos, frontTile(this.pos, this.player.facing));
    const melee = meleeFor(s.inventory[s.selected]?.item ?? null);
    return resolveAction({
      world: this.world, inv: s.inventory, selected: s.selected, vitals: s.vitals, pos: this.pos, facing: this.player.facing,
      structures: view.structures, farm: view.farm, occupied: this.occupied, node: view.node, creature: this.combat.reaches(melee),
      entrance: view.entrance, target: view.target, npc: view.npc, spot: view.spot,
    });
  }

  private showCursor(a: Action): void {
    const targeted = ['place', 'till', 'plant', 'water', 'refill', 'harvest', 'open', 'sleep', 'drink', 'pickup', 'enter', 'leave', 'chest', 'door', 'talk', 'inspect', 'dig', 'raft', 'fish'].includes(a.kind);
    const refused = a.kind === 'blocked' && a.reason === 'cannotPlace';
    this.cursor.setVisible(targeted || refused);
    if (!targeted && !refused) return;
    const f = frontTile(this.pos, this.player.facing);
    this.cursor.setPosition(f.x * TILE, f.y * TILE).setStrokeStyle(1, refused ? 0xff5555 : 0xffffff, 0.9);
  }

  private perform(action: Action): void {
    this.cooldown = action.kind === 'attack' ? action.melee.cooldown : action.kind === 'shoot' ? action.stats.cooldown : ACTION_COOLDOWN;
    if (action.kind === 'none' || this.transitioning) return;
    if (action.kind === 'hit') this.player.face(action.node.x + 0.5 - this.pos.x, action.node.y + 0.5 - this.pos.y);
    if (action.kind !== 'blocked') this.idle = 0;
    this.commit(applyAction(this.session, action, this.pos));
    services.platform?.haptic('light');
  }

  /** Take a rule result: the new state, and the effects to show. */
  private commit(step: Step, quiet = false): void {
    this.session = step.session;
    this.float.newGroup();
    for (const fx of step.fx) this.playFx(fx, quiet);
    this.rebuildBlocking();
  }

  private playFx(fx: Fx, quiet: boolean): void {
    const cue = quiet ? null : cueForFx(fx, fx.t === 'hit' ? this.level.nodeKind(fx.id) : undefined);
    if (cue) services.audio?.sfx(cue);
    this.level.onFx(fx, this.session);
    switch (fx.t) {
      case 'say': services.notify?.(this.sayText(fx)); break;
      case 'gain': this.showGain(`+${fx.qty} ${t(`item_${fx.item}`)}`); break;
      case 'swing': this.player.punch(); break;
      case 'strike':
      case 'shot': this.combat.onFx(fx); break;
      case 'open': this.openStructure(fx.structure.type, fx.structure.id); break;
      case 'slept': this.cameras.main.flash(700, 8, 10, 30); this.story.play(fx); break;
      case 'quest':
      case 'dialog':
      case 'ending':
      case 'theEnd': this.story.play(fx); break;
      case 'travel': this.travel(fx.to); break;
    }
  }

  /** Go through a dungeon door, either way: save, then start the scene again in the other place. */
  private travel(to: DungeonId | null): void {
    const from = this.level.dungeon?.id;
    const seed = this.session.seed;
    this.pos = to ? generateDungeon(seed, to).entry : doorwayOutside(generateWorld(seed), from!);
    this.saveNow();
    this.goTo('Game', { slot: this.slotData.slot });
  }

  private sayText(fx: Say): string {
    const vars = { ...fx.vars };
    for (const key of fx.translate ?? []) vars[key] = t(String(vars[key]));
    return t(fx.key, vars);
  }

  /** Floating "+2 Wood" text above the hero (or a toast while a screen covers the island). */
  showGain(text: string): void {
    if (this.scene.isPaused()) {
      services.notify?.(text);
      return;
    }
    this.float.show(this.pos.x * TILE, this.pos.y * TILE - 26, text, COLORS.gold, true);
  }

  /** Hand the story's result (a quest moved on, a reward paid) to the game; nothing happens when nothing changed. */
  commitStory(step: Step): void {
    if (step.session === this.session && step.fx.length === 0) return;
    this.commit(step, true);
  }

  /** Is a fire or a torch within `radius` tiles of the hero? */
  nearLight(radius: number): boolean {
    return this.session.structures.list.some((s) => (s.type === 'campfire' || s.type === 'torch') && Math.hypot(s.x + 0.5 - this.pos.x, s.y + 0.5 - this.pos.y) <= radius);
  }

  /** Walk-blocking tiles and the tiles nothing can be built or tilled on, as the level has them now. */
  rebuildBlocking(): void {
    const { solids, occupied } = this.level.blocking(this.session);
    this.solids = solids;
    this.occupied = occupied;
  }

  private onNewDay(): void {
    this.lastDay = this.session.clock.day;
    this.session = this.level.newDay(this.session, this.pos);
    this.story.newDay();
    this.rebuildBlocking();
    services.notify?.(t('hudDay', { n: this.lastDay }));
    this.saveNow();
  }

  private onCollapse(): void {
    this.dead = true;
    services.audio?.sfx('death');
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
    if (this.level.dungeon) {
      // Dying below ground: wake on the island, with the dungeon as it was.
      this.session = { ...this.session, location: null };
      this.saveNow();
      this.goTo('Game', { slot: this.slotData.slot });
      return;
    }
    this.player.update(this.pos, { x: 0, y: 0 });
    this.dead = false;
    this.idle = 99;
    this.combat.reset();
    this.saveNow();
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
    return this.level.stations(this.session, this.pos);
  }

  craft(recipe: Recipe): void {
    const step = craftRecipe(this.session, recipe, this.stations());
    if (step.fx.length > 0) services.audio?.sfx('craft');
    this.commit(step, true);
  }

  moveSlot(from: number, to: number): void {
    this.session = moveInventorySlot(this.session, from, to);
  }

  transfer(chestId: number, from: 'bag' | 'chest', index: number): void {
    this.commit(transferStack(this.session, chestId, from, index));
  }

  /** Put on the armour in a backpack slot, or take the worn armour off (null). */
  wear(index: number | null): void {
    this.commit(index === null ? takeOffArmor(this.session) : equipArmor(this.session, index));
  }

  /** The boss's name key and health while the fight is on, for the health bar. */
  bossBar(): { name: string; hp: number; max: number } | null {
    return this.level.bossBar(this.combat.snapshot());
  }

  /** Open the quest log; the island waits while it is open. */
  openQuests(): void {
    if (this.scene.isPaused()) return;
    this.scene.pause('Game');
    this.scene.launch('Quests', { game: this });
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
    return { ...sessionToSlot(this.slotData, this.session, this.pos), worldVersion: GENERATOR_VERSION, dungeonVersion: DUNGEON_VERSION };
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
