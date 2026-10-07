import type { Station } from '@/data/structures';
import type { Level, LevelView, Lit } from '@/game/Level';
import { FarmLayer } from '@/gfx/FarmLayer';
import { Rng } from '@/core/rng';
import { WEATHER_DARKNESS, weatherAt } from '@/sim/weather';
import { StoryLayer } from '@/gfx/StoryLayer';
import { StructureLayer } from '@/gfx/StructureLayer';
import { TerrainLayer } from '@/gfx/TerrainLayer';
import { WorldObjects } from '@/gfx/WorldObjects';
import type { GameScene } from '@/scenes/GameScene';
import { entranceAt } from '@/sim/dungeon/rules';
import type { Encounters, EncounterEvent } from '@/sim/encounters';
import { isNight, lighting } from '@/sim/daynight';
import { plotAt } from '@/sim/farm';
import { isAlive } from '@/sim/gather';
import { nearestNode } from '@/sim/interact';
import type { Vec } from '@/sim/movement';
import { blocksRegrowth, rollDay, type Fx, type Session } from '@/sim/session';
import { blockingTiles, nodesByTile, propSolidTiles, type Blocking } from '@/sim/solids';
import { nearbyStations } from '@/sim/structures';
import { npcAt, npcPlaces, spotAt, spotsOf, visibleSpots, type NpcPlace, type Spot } from '@/sim/world/spots';
import { wanderStep } from '@/sim/world/wander';
import { idx, type ResourceKind, type ResourceNode, type World } from '@/sim/world/types';

/** How far the hero reaches for trees, rocks and bushes, and how close he may stand to a node that would grow back (tiles). */
const HIT_REACH = 1.4;
const REGROW_CLEARANCE = 1.5;
/** Radius of the hero's own light at night (world pixels). */
const HERO_LIGHT = 52;

/** The island: terrain, trees and rocks, the camp the hero builds, his fields, and the rhythm of day and night. */
export class IslandLevel implements Level {
  readonly dungeon = null;
  readonly fixed = false;
  private nodes: Map<number, ResourceNode>;
  private propTiles: number[];
  private objects: WorldObjects;
  private structureLayer: StructureLayer;
  private farmLayer: FarmLayer;
  private storyLayer: StoryLayer;
  /** Where each islander stands now; they stroll a step or two around `homes`. */
  private places: NpcPlace[];
  private homes: NpcPlace[];
  private nextStep: number[];
  private rng: Rng;
  private hero: Vec = { x: 0, y: 0 };
  private session: Session;
  private finds: Spot[];

  constructor(scene: GameScene, readonly world: World, session: Session) {
    this.nodes = nodesByTile(world);
    this.propTiles = propSolidTiles(world);
    new TerrainLayer(scene, world);
    this.objects = new WorldObjects(scene, world);
    for (const n of world.resources) if (!isAlive(session.gather, n.id)) this.objects.setAlive(n.id, false, false);
    this.structureLayer = new StructureLayer(scene, session.structures);
    this.farmLayer = new FarmLayer(scene, session.farm);
    this.homes = npcPlaces(world);
    this.places = this.homes.map((p) => ({ ...p }));
    this.rng = new Rng(world.seed).fork('islanders');
    this.nextStep = this.places.map(() => this.rng.float(1, 5));
    this.session = session;
    this.finds = spotsOf(world);
    this.storyLayer = new StoryLayer(scene, this.places, this.finds);
  }

  place(saved: Vec): Vec {
    return saved;
  }

  start(): Encounters | null {
    return null;
  }

  /** Islanders stand in the way like scenery does. */
  blocking(session: Session): Blocking {
    const b = blockingTiles(this.world, this.propTiles, session);
    for (const p of this.places) {
      const tile = idx(p.x, p.y, this.world.size);
      b.solids.add(tile);
      b.occupied.add(tile);
    }
    return b;
  }

  view(session: Session, hero: Vec, front: { x: number; y: number }): LevelView {
    this.hero = hero;
    this.session = session;
    this.storyLayer.sync(this.finds, session.quests);
    return {
      npc: npcAt(this.places, front.x, front.y), spot: spotAt(visibleSpots(this.finds, session.quests), front, hero),
      structures: session.structures, farm: session.farm, target: null, entrance: entranceAt(this.world, front.x, front.y),
      dock: this.world.landmarks.some((l) => l.id === 'dock' && l.x === front.x && l.y === front.y),
      node: nearestNode(this.nodes, this.world.size, hero, HIT_REACH, (id) => isAlive(session.gather, id)),
    };
  }

  lit(session: Session): Lit {
    const light = lighting(session.clock);
    // Grey weather dims the day.
    const gloom = WEATHER_DARKNESS[weatherAt(session.seed, session.clock.day, session.clock.t)];
    return { color: light.color, alpha: Math.min(0.92, light.alpha + gloom), sources: this.structureLayer.lights(session.structures), hero: HERO_LIGHT };
  }

  stations(session: Session, hero: Vec): Set<Station> {
    return nearbyStations(session.structures, hero);
  }

  isNight(session: Session): boolean {
    return isNight(session.clock);
  }

  nodeKind(id: number): ResourceKind | undefined {
    return this.world.resources[id]?.kind;
  }

  onFx(fx: Fx, session: Session): void {
    switch (fx.t) {
      case 'hit': this.objects.shake(fx.id); break;
      case 'gone': this.objects.setAlive(fx.id, false); break;
      case 'built': this.structureLayer.add(fx.structure); break;
      case 'unbuilt': this.structureLayer.remove(fx.id); break;
      case 'plot': this.farmLayer.refresh(fx.tile, plotAt(session.farm, fx.tile)); break;
    }
  }

  onEvents(_events: EncounterEvent[]): void {
    // Nothing on the island reacts to what happens among the creatures.
  }

  /** The islanders stroll about now and then, and glance at the hero when he is near. */
  update(dt: number): void {
    this.places.forEach((p, i) => {
      this.nextStep[i] -= dt;
      if (this.nextStep[i] > 0) return;
      this.nextStep[i] = this.rng.float(2.5, 7);
      const near = Math.hypot(p.x + 0.5 - this.hero.x, p.y + 0.5 - this.hero.y) < 4;
      if (near && this.rng.chance(0.5)) {
        this.storyLayer.look(p.id, this.hero.x, this.hero.y);
        return;
      }
      const taken = blockingTiles(this.world, this.propTiles, this.session).occupied;
      for (const s of this.finds) taken.add(idx(s.x, s.y, this.world.size));
      const to = wanderStep(this.world, taken, this.places, this.homes, i, this.hero, this.rng);
      if (!to) return;
      this.places[i] = { id: p.id, x: to.x, y: to.y };
      this.storyLayer.walk(p.id, to.x, to.y);
    });
  }

  /** Nodes that were gone may grow back (those next to the hero wait for tomorrow), and watered crops grow. */
  newDay(session: Session, hero: Vec): Session {
    const before = session.gather;
    const next = rollDay(session, (id) => {
      const n = this.world.resources[id];
      return Math.hypot(n.x + 0.5 - hero.x, n.y + 0.5 - hero.y) < REGROW_CLEARANCE || blocksRegrowth(session, n, this.world.size);
    });
    for (const key of Object.keys(before.gone)) {
      const id = Number(key);
      if (isAlive(next.gather, id)) this.objects.setAlive(id, true);
    }
    this.farmLayer.rebuild(next.farm);
    return next;
  }

  bossBar(): null {
    return null;
  }
}
