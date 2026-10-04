import type { Station } from '@/data/structures';
import type { Level, LevelView, Lit } from '@/game/Level';
import { FarmLayer } from '@/gfx/FarmLayer';
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
import type { ResourceKind, ResourceNode, World } from '@/sim/world/types';

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

  constructor(scene: GameScene, readonly world: World, session: Session) {
    this.nodes = nodesByTile(world);
    this.propTiles = propSolidTiles(world);
    new TerrainLayer(scene, world);
    this.objects = new WorldObjects(scene, world);
    for (const n of world.resources) if (!isAlive(session.gather, n.id)) this.objects.setAlive(n.id, false, false);
    this.structureLayer = new StructureLayer(scene, session.structures);
    this.farmLayer = new FarmLayer(scene, session.farm);
  }

  place(saved: Vec): Vec {
    return saved;
  }

  start(): Encounters | null {
    return null;
  }

  blocking(session: Session): Blocking {
    return blockingTiles(this.world, this.propTiles, session);
  }

  view(session: Session, hero: Vec, front: { x: number; y: number }): LevelView {
    return {
      structures: session.structures, farm: session.farm, target: null, entrance: entranceAt(this.world, front.x, front.y),
      node: nearestNode(this.nodes, this.world.size, hero, HIT_REACH, (id) => isAlive(session.gather, id)),
    };
  }

  lit(session: Session): Lit {
    const light = lighting(session.clock);
    return { color: light.color, alpha: light.alpha, sources: this.structureLayer.lights(session.structures), hero: HERO_LIGHT };
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

  update(): void {
    // The island has no moving parts of its own.
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
