import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import type { HudScene } from './HudScene';
import { Player } from '@/entities/Player';
import { newSlot, type SaveSlot } from '@/core/save';
import { cleanName } from '@/core/newGame';
import { services } from '@/core/services';
import { t, tr } from '@/core/i18n';
import { ACHIEVEMENTS } from '@/data/achievements';
import { worldZoom } from '@/core/viewport';
import type { Recipe } from '@/data/recipes';
import type { Station, StructureId } from '@/data/structures';
import { FloatText } from '@/gfx/FloatText';
import { NightLight } from '@/gfx/NightLight';
import { ITEMS, type GearSlot, type ItemId } from '@/data/items';
import type { SkillId } from '@/sim/skills';
import { burst, impactOf } from '@/gfx/Impact';
import { TILE } from '@/gfx/TerrainLayer';
import { DungeonLevel } from '@/game/DungeonLevel';
import { InputReader } from '@/game/InputReader';
import { StoryDirector } from '@/game/StoryDirector';
import { TutorialDirector } from '@/game/TutorialDirector';
import { HeroCombat } from '@/game/HeroCombat';
import { IslandLevel } from '@/game/IslandLevel';
import type { Level } from '@/game/Level';
import { MusicDirector } from '@/game/MusicDirector';
import { controls, resetControls } from '@/game/input';
import { dismantleAt, frontTile, resolveAction, type Action } from '@/sim/actions';
import { phaseOf } from '@/sim/daynight';
import { campSize, raidFor } from '@/sim/raids';
import { cueForFx } from '@/sim/cues';
import { newClock } from '@/sim/daynight';
import { generateDungeon } from '@/sim/dungeon/generate';
import { DUNGEON_VERSION, emptyDungeons, emptyProgress, type DungeonId } from '@/sim/dungeon/progress';
import { doorwayOutside } from '@/sim/dungeon/rules';
import { emptyGather, sanitizeGather } from '@/sim/gather';
import { meleeFor } from '@/sim/melee';
import { moveWithCollision, speedFactor, type Vec } from '@/sim/movement';
import {
  applyAction, collapse, craftRecipe, story, equipArmor, markRaid, moveInventorySlot, selectSlot, sessionFromSlot, sessionMods, sessionToSlot, takeOffGear, tickSession,
  arrive, sailTo, turretFired,
  upgradeItem, repairItem,
  transferStack, type Fx, type Session, type Step,
} from '@/sim/session';
import { RUN_SPEED, RUN_START, isDead, type Difficulty } from '@/sim/vitals';
import { GENERATOR_VERSION } from '@/sim/world/generate';
import { worldFor } from '@/sim/islands';
import type { NpcId } from '@/data/npcs';
import { buyOffer, sellSlot } from '@/sim/shop';
import { canBeginNewGamePlus, newGamePlus } from '@/sim/newGamePlus';
import { Rng } from '@/core/rng';
import type { Job } from '@/data/settlers';
import { collectStore, hire, produceDay } from '@/sim/settlers';
import { acceptBounty, dropBounty, turnInBounty } from '@/sim/bounty';
import { idx, type Biome, type IslandId, type World } from '@/sim/world/types';
import { COLORS } from '@/ui/theme';

/** Walking speed in tiles per second, and the pause between uses (seconds). */
const PLAYER_SPEED = 3.4;
/** How quickly the hero gets up to speed and comes to rest (per second): a short ease instead of an instant start and stop. */
const ACCELERATE = 13;
const BRAKE = 17;
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
  /** Tiles creatures cannot enter: the solid ones, and the gates the hero walks through. */
  monsterSolids = new Set<number>();
  /** Seconds the scene stands still after a good hit, to give blows some weight. */
  hitStop = 0;
  /** True while the collapse dialog is up. */
  dead = false;

  private slotData!: SaveSlot;
  private lastDay = 1;
  private cooldown = 0;
  private idle = 99;
  /** Where the hero is heading, in tiles a second: it eases toward the stick instead of jumping. */
  private vel: Vec = { x: 0, y: 0 };
  /** Where the camera looks (world pixels): it glides after the hero and leans a little the way he runs. */
  private look = { x: 0, y: 0, ready: false };
  private lastDt = 0.016;
  private coldHush = 0;
  private running = false;
  /** True while the hero faces something he built that can be taken down (a chest, a bench, a bed...). */
  canDismantle = false;
  private tutorial?: TutorialDirector;
  /** What the hero held when he used it (the stack may be gone, or changed, by the time the effect plays). */
  private swingItem: ItemId | null = null;
  private saveTimer = 0;
  private wiped = false;
  private occupied = new Set<number>();
  private night!: NightLight;
  private cursor!: Phaser.GameObjects.Rectangle;
  /** A soft glowing ring on the ground for things you talk to or look at (a square would cut through the character). */
  private ring!: Phaser.GameObjects.Ellipse;
  private keys!: InputReader;
  private music = new MusicDirector();

  constructor() {
    super('Game');
  }

  create(data: GameInit): void {
    this.transitioning = false;
    this.dead = false;
    this.wiped = false;
    this.look.ready = false;
    this.vel = { x: 0, y: 0 };
    resetControls();
    const loaded = data.seed === undefined ? services.saves?.load(data.slot) ?? null : null;
    if (data.seed === undefined && !loaded) {
      this.scene.start('Menu');
      return;
    }
    const seed = data.seed ?? loaded!.seed;
    const island = loaded?.location && loaded.dungeonVersion === DUNGEON_VERSION ? null : worldFor(seed, loaded?.island ?? 'home');
    this.slotData = loaded ?? newSlot(data.slot, cleanName(data.name), seed, data.difficulty ?? 'normal', island!.start, newClock());
    if (!loaded) services.saves?.write(this.slotData);

    const where = island ? null : this.slotData.location;
    this.session = this.startSession(island, where);
    this.level = where ? new DungeonLevel(this, generateDungeon(seed, where, this.session.floor)) : new IslandLevel(this, island!, this.session);
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
    this.tutorial = new TutorialDirector(this, data.seed !== undefined && !this.level.dungeon);
    this.combat = new HeroCombat(this);
    const start = this.level.start();
    if (start) this.combat.load(start);
    this.music = new MusicDirector();
    this.float = new FloatText(this);
    this.cursor = this.add.rectangle(0, 0, TILE, TILE).setOrigin(0, 0).setStrokeStyle(1, 0xffffff, 0.9).setFillStyle(0xffffff, 0.12).setDepth(80000).setVisible(false);
    this.ring = this.add.ellipse(0, 0, TILE * 1.05, TILE * 0.6).setStrokeStyle(1, 0xffe9a8, 0.95).setFillStyle(0xffe9a8, 0.18).setDepth(-50).setVisible(false);
    this.tweens.add({ targets: this.ring, scaleX: 1.18, scaleY: 1.18, alpha: 0.55, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

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
    if (!where) this.commitStory(arrive(this.session));
    if (where) services.notify?.(where === 'depths' ? t('floorN', { n: this.session.floor }) : t(`dungeon_${where}`));
  }

  /** The session from the save; a changed island generator drops the harvest diff, a changed dungeon generator the dungeon progress. */
  private startSession(island: World | null, where: DungeonId | null): Session {
    const s = sessionFromSlot(this.slotData);
    const current = this.slotData.dungeonVersion === DUNGEON_VERSION;
    const fits = !island || island.island !== undefined || this.slotData.worldVersion === GENERATOR_VERSION;
    const gather = !island ? s.gather : fits ? sanitizeGather(s.gather, island.resources.length) : emptyGather();
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
    this.lastDt = dt;
    this.idle += dt;
    const move = this.keys.move();
    const moving = move.x !== 0 || move.y !== 0;
    // Running needs a little breath to start and lasts until the breath runs out; the Run button switches itself off then.
    const wants = this.keys.running() && moving;
    const stamina = this.session.vitals.stamina;
    this.running = wants && (this.running ? stamina > 0.5 : stamina >= RUN_START);
    if (this.keys.running() && !this.running && wants && controls.run) controls.run = false;
    this.session = tickSession(this.session, dt, this.biomeAt(), this.idle < BUSY_SECONDS, this.running, this.pos);
    if (this.session.clock.day !== this.lastDay) this.onNewDay();
    this.checkRaid();
    this.warnCold(dt);
    if (isDead(this.session.vitals)) {
      this.onCollapse();
      return;
    }
    const slot = this.keys.slotPressed();
    if (slot >= 0) this.select(slot);

    const top = PLAYER_SPEED * speedFactor(this.world, this.pos.x, this.pos.y) * (this.running ? RUN_SPEED : 1) * sessionMods(this.session).speed;
    const ease = 1 - Math.exp(-dt * (moving ? ACCELERATE : BRAKE));
    this.vel = { x: this.vel.x + (move.x * top - this.vel.x) * ease, y: this.vel.y + (move.y * top - this.vel.y) * ease };
    if (!moving && Math.hypot(this.vel.x, this.vel.y) < 0.08) this.vel = { x: 0, y: 0 };
    if (this.vel.x !== 0 || this.vel.y !== 0) {
      const before = this.pos;
      this.pos = moveWithCollision(this.world, this.solids, this.pos, this.vel.x * dt, this.vel.y * dt);
      // Pressing into a wall must not keep the legs pumping at full pace.
      if (this.pos.x === before.x) this.vel = { ...this.vel, x: 0 };
      if (this.pos.y === before.y) this.vel = { ...this.vel, y: 0 };
    }
    this.player.update(this.pos, move, { pace: Math.hypot(this.vel.x, this.vel.y) / PLAYER_SPEED, running: this.running }, dt);
    this.combat.tick(dt);
    this.level.update(dt, move, this.combat.snapshot());
    this.story.update(dt);
    this.tutorial?.update(dt);
    this.music.update(this.level.isNight(this.session), this.combat.fighting);

    this.cooldown = Math.max(0, this.cooldown - dt);
    const pressed = this.keys.actionPressed();
    const action = this.computeAction();
    this.canDismantle = !this.level.dungeon && dismantleAt(this.session.structures, this.pos, this.player.facing) !== null;
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

  /** At dusk, once a day: a camp that has grown big enough may be raided in the night. */
  private checkRaid(): void {
    this.combat.checkRaidOver();
    const c = this.session.clock;
    if (this.level.dungeon || this.level.fixed || phaseOf(c) !== 'dusk' || this.session.raidDay === c.day) return;
    this.session = markRaid(this.session, c.day);
    const kinds = raidFor(this.session.seed, c.day, this.session.difficulty, campSize(this.session.structures), this.biomeAt());
    if (kinds) this.combat.startRaid(kinds);
  }

  /** A word of warning when the cold is getting to the hero (not more than every so often). */
  private warnCold(dt: number): void {
    this.coldHush = Math.max(0, this.coldHush - dt);
    const w = this.session.vitals.warmth;
    if (this.coldHush > 0 || w > 40) return;
    this.coldHush = w <= 15 ? 18 : 40;
    services.notify?.(t(w <= 15 ? 'msgFreezing' : 'msgShivering'));
  }

  /** A turret loosed an arrow. */
  turretFired(id: number): void {
    this.session = turretFired(this.session, id);
  }

  /** What ACTION would do right now. */
  private computeAction(): Action {
    const s = this.session;
    const view = this.level.view(s, this.pos, frontTile(this.pos, this.player.facing));
    const melee = meleeFor(s.inventory[s.selected]?.item ?? null);
    return resolveAction({
      world: this.world, inv: s.inventory, selected: s.selected, vitals: s.vitals, pos: this.pos, facing: this.player.facing,
      structures: view.structures, farm: view.farm, occupied: this.occupied, node: view.node, creature: this.combat.reaches(melee),
      entrance: view.entrance, dock: view.dock, target: view.target, npc: view.npc, spot: view.spot, mods: sessionMods(s),
    });
  }

  /** The Pick up button: take down what the hero faces (a chest must be empty first). */
  dismantle(): void {
    const action = dismantleAt(this.session.structures, this.pos, this.player.facing);
    if (action && !this.dead && !this.transitioning) this.perform(action);
  }

  private showCursor(a: Action): void {
    const onGrid = ['place', 'till', 'plant', 'water', 'refill', 'harvest', 'open', 'drink', 'pickup', 'dig', 'fish'].includes(a.kind);
    const onThing = ['sleep', 'enter', 'leave', 'chest', 'door', 'talk', 'inspect', 'raft', 'reload', 'boat', 'descend'].includes(a.kind);
    const refused = a.kind === 'blocked' && a.reason === 'cannotPlace';
    this.cursor.setVisible(onGrid || refused);
    this.ring.setVisible(onThing);
    if (!onGrid && !onThing && !refused) return;
    const f = frontTile(this.pos, this.player.facing);
    this.cursor.setPosition(f.x * TILE, f.y * TILE).setStrokeStyle(1, refused ? 0xff5555 : 0xffffff, 0.9);
    this.ring.setPosition((f.x + 0.5) * TILE, (f.y + 0.85) * TILE);
  }

  private perform(action: Action): void {
    this.cooldown = action.kind === 'attack' ? action.melee.cooldown : action.kind === 'shoot' ? action.stats.cooldown : ACTION_COOLDOWN;
    if (action.kind === 'none' && !this.transitioning && !this.dead) {
      // Nothing to hit: a sword, spear, axe or pickaxe still swings through the air (no cost), so the hero always answers USE.
      const held = this.session.inventory[this.session.selected]?.item ?? null;
      const type = held ? ITEMS[held].tool?.type : undefined;
      if (held && (type === 'sword' || type === 'spear' || type === 'axe' || type === 'pickaxe')) {
        this.cooldown = 0.45;
        this.player.swing(held);
        services.audio?.sfx('swing');
      }
      return;
    }
    if (action.kind === 'none' || this.transitioning) return;
    if (action.kind === 'hit') this.player.face(action.node.x + 0.5 - this.pos.x, action.node.y + 0.5 - this.pos.y);
    if (action.kind !== 'blocked') this.idle = 0;
    this.swingItem = this.session.inventory[this.session.selected]?.item ?? null;
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
      case 'swing': this.player.swing(this.swingItem); break;
      case 'levelUp': this.levelUp(fx.skill, fx.level); break;
      case 'achievement': services.notify?.(t('achievementEarned', { name: tr(ACHIEVEMENTS.find((a) => a.id === fx.id)?.title ?? fx.id) })); services.audio?.sfx('craft'); break;
      case 'upgraded': services.notify?.(t('upgraded', { item: t(`item_${fx.item}`), n: fx.plus })); services.audio?.sfx('craft'); break;
      case 'hit': this.chips(fx.id); break;
      case 'strike':
      case 'shot': this.combat.onFx(fx); break;
      case 'open': this.openStructure(fx.structure.type, fx.structure.id); break;
      case 'slept': this.cameras.main.flash(700, 8, 10, 30); this.story.play(fx); break;
      case 'quest':
      case 'dialog':
      case 'ending':
      case 'theEnd': this.story.play(fx); break;
      case 'travel': this.travel(fx.to); break;
      case 'voyage': this.openVoyage(); break;
      case 'sail': this.sail(fx.to); break;
    }
  }

  /** A skill rose a level: a toast, a chime and a ring of gold sparks around the hero. */
  private levelUp(skill: SkillId, level: number): void {
    services.notify?.(t('levelUp', { skill: t(`skill_${skill}`), n: level }));
    services.audio?.sfx('craft');
    services.platform?.haptic('success');
    const x = this.pos.x * TILE;
    const y = this.pos.y * TILE - 10;
    for (let i = 0; i < 10; i++) burst(this, x, y, 'spark', y + 40, i % 2 === 0 ? -1 : 1);
  }

  /** Chips, leaves or sparks fly off the thing the tool just struck, as the blow lands. */
  private chips(id: number): void {
    const node = this.world.resources[id];
    if (!node) return;
    const at = this.player.strikePoint();
    const kind = impactOf(node.kind);
    this.time.delayedCall(120, () => burst(this, (node.x + 0.5) * TILE + (at.x - (node.x + 0.5) * TILE) * 0.2, (node.y + 0.6) * TILE - 6, kind, (node.y + 1) * TILE + 2));
  }

  /** Go through a dungeon door, either way: save, then start the scene again in the other place. */
  private travel(to: DungeonId | null): void {
    const from = this.level.dungeon?.id;
    const seed = this.session.seed;
    this.pos = to ? generateDungeon(seed, to, this.session.floor).entry : doorwayOutside(worldFor(seed, this.session.island), from!);
    this.saveNow();
    this.goTo('Game', { slot: this.slotData.slot });
  }

  /** The hero goes aboard: he sails to `to` and lands on its beach, or by his boat when he returns home. */
  sail(to: IslandId): void {
    const arrival = worldFor(this.session.seed, to);
    const boat = this.session.structures.list.find((b) => b.type === 'boat');
    this.pos = to === 'home' && boat ? { x: boat.x + 0.5, y: boat.y + 1.5 } : { x: arrival.start.x + 0.5, y: arrival.start.y + 0.5 };
    this.saveNow();
    this.goTo('Game', { slot: this.slotData.slot });
  }

  /** The map was used: a place chosen (the session is switched to that island's own things first). */
  setSail(to: IslandId): void {
    const step = sailTo(this.session, to);
    if (step.session === this.session) return;
    this.session = step.session;
    this.sail(to);
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
    const { solids, occupied, gates } = this.level.blocking(this.session);
    this.solids = solids;
    this.monsterSolids = gates && gates.size > 0 ? new Set([...solids, ...gates]) : solids;
    this.occupied = occupied;
  }

  private onNewDay(): void {
    this.lastDay = this.session.clock.day;
    this.session = produceDay(this.level.newDay(this.session, this.pos));
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
    this.vel = { x: 0, y: 0 };
    this.running = false;
    this.look.ready = false;
    this.player.update(this.pos, { x: 0, y: 0 }, { pace: 0, running: false }, 0);
    this.dead = false;
    this.idle = 99;
    this.combat.reset();
    this.saveNow();
  }

  /** Centre on the hero, then snap to whole device pixels so pixel art does not shimmer. */
  private followCamera(): void {
    const cam = this.cameras.main;
    const tx = this.pos.x * TILE + this.vel.x * TILE * 0.12;
    const ty = this.pos.y * TILE + this.vel.y * TILE * 0.12;
    if (!this.look.ready) {
      this.look = { x: this.pos.x * TILE, y: this.pos.y * TILE, ready: true };
    } else {
      const ease = 1 - Math.exp(-this.lastDt * 9);
      this.look.x += (tx - this.look.x) * ease;
      this.look.y += (ty - this.look.y) * ease;
    }
    cam.centerOn(this.look.x, this.look.y);
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

  /** Put on the gear in a backpack slot. */
  wear(index: number): void {
    this.commit(equipArmor(this.session, index));
  }

  /** Take off what is worn in a gear slot. */
  takeOff(place: GearSlot): void {
    this.commit(takeOffGear(this.session, place));
  }

  /** At an anvil: upgrade or repair the tool in a backpack slot. */
  upgrade(index: number): void {
    this.commit(upgradeItem(this.session, index, this.stations()));
  }

  repair(index: number): void {
    this.commit(repairItem(this.session, index, this.stations()));
  }

  /** The boss's name key and health while the fight is on, for the health bar. */
  bossBar(): { name: string; hp: number; max: number } | null {
    return this.level.bossBar(this.combat.snapshot());
  }

  /** Open the quest log; the island waits while it is open. */
  /** A trader's counter opens; the island waits. */
  openShop(npc: NpcId): void {
    if (this.scene.isPaused()) return;
    this.scene.pause('Game');
    this.scene.launch('Shop', { game: this, npc });
  }

  buy(npc: NpcId, index: number): void {
    this.commit(buyOffer(this.session, npc, index));
  }

  sell(index: number, qty: number): void {
    this.commit(sellSlot(this.session, index, qty));
  }

  /** The story is done: a new island and a new story, with the hero's skills, gear and gold kept. */
  beginNewGamePlus(): void {
    if (!canBeginNewGamePlus(this.session) || this.transitioning) return;
    this.saveNow();
    const free = services.saves?.slotForNewGame();
    const target = free && !free.overwrites ? free.slot : this.slotData.slot;
    services.saves?.write(newGamePlus(this.session, this.slotData, target, Rng.seedFromTime()));
    // The old game must not be written back over the new one when this scene shuts down.
    this.wiped = true;
    this.goTo('Game', { slot: target });
  }

  /** Go down into the Endless Depths from the first floor. */
  enterDepths(): void {
    if (this.transitioning) return;
    this.session = { ...this.session, location: 'depths', floor: 1, dungeons: { ...this.session.dungeons, depths: emptyProgress() } };
    this.travel('depths');
  }

  openCamp(): void {
    if (this.scene.isPaused()) return;
    this.scene.pause('Game');
    this.scene.launch('Camp', { game: this });
  }

  takeBounty(npc: NpcId): void {
    this.commit(acceptBounty(this.session, npc));
  }

  handInBounty(): void {
    this.commit(turnInBounty(this.session));
  }

  giveUpBounty(): void {
    this.session = dropBounty(this.session);
  }

  hireSettler(job: Job): void {
    this.commit(hire(this.session, job));
  }

  collectStore(): void {
    this.commit(collectStore(this.session));
  }

  openJournal(): void {
    if (this.scene.isPaused()) return;
    this.scene.pause('Game');
    this.scene.launch('Journal', { game: this });
  }

  openVoyage(): void {
    if (this.scene.isPaused()) return;
    this.scene.pause('Game');
    this.scene.launch('Voyage', { game: this });
  }

  openQuests(): void {
    if (this.scene.isPaused()) return;
    this.scene.pause('Game');
    this.scene.launch('Quests', { game: this });
  }

  /** Open the backpack, the crafting list of a station, or a chest; the island waits while it is open. */
  openInventory(opts: OpenOptions): void {
    this.tutorial?.bagWasOpened();
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
