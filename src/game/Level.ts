import type { Station } from '@/data/structures';
import type { LightSource } from '@/gfx/StructureLayer';
import type { DungeonId } from '@/sim/dungeon/progress';
import type { Target } from '@/sim/dungeon/rules';
import type { Dungeon } from '@/sim/dungeon/types';
import type { Encounters, EncounterEvent } from '@/sim/encounters';
import type { NpcId } from '@/data/npcs';
import type { Farm } from '@/sim/farm';
import type { Vec } from '@/sim/movement';
import type { Fx, Session } from '@/sim/session';
import type { Blocking } from '@/sim/solids';
import type { Structures } from '@/sim/structures';
import type { Spot } from '@/sim/world/spots';
import type { ResourceKind, ResourceNode, World } from '@/sim/world/types';

/** What the resolver needs to know about the place the hero is standing in. */
export interface LevelView {
  structures: Structures;
  farm: Farm;
  /** The nearest living resource node in reach. */
  node: ResourceNode | null;
  /** The dungeon whose entrance is the tile in front of the hero. */
  entrance: DungeonId | null;
  /** A locked door, a chest or the exit in front of the hero (dungeons). */
  target: Target | null;
  /** The islander on the tile in front of the hero. */
  npc: NpcId | null;
  /** The find in front of the hero or under his feet. */
  spot: Spot | null;
}

/** The darkness laid over the world, and the lights cut out of it (world pixels). */
export interface Lit {
  color: number;
  alpha: number;
  sources: LightSource[];
  /** Radius of the hero's own light. */
  hero: number;
}

/** A place the hero can be: the island, or one of the dungeons. `GameScene` runs whichever one it is given. */
export interface Level {
  readonly world: World;
  readonly dungeon: Dungeon | null;
  /** Creatures neither appear nor fade by themselves. */
  readonly fixed: boolean;
  /** Where the hero stands when the level starts: the saved spot if it is fine, otherwise the way in. */
  place(saved: Vec): Vec;
  /** The creatures and crystals the level starts with, if it sets any. */
  start(): Encounters | null;
  blocking(session: Session): Blocking;
  view(session: Session, hero: Vec, front: { x: number; y: number }): LevelView;
  lit(session: Session): Lit;
  stations(session: Session, hero: Vec): Set<Station>;
  /** The dark hours (the dungeon is always dark): night music, and the creatures of the night. */
  isNight(session: Session): boolean;
  /** The kind of resource node with this id, for the sound of hitting it. */
  nodeKind(id: number): ResourceKind | undefined;
  /** Show an effect of the rules: a node cut down, a building put up, a chest opened. */
  onFx(fx: Fx, session: Session): void;
  /** Things that happened among the creatures: a crystal was struck, the boss died. */
  onEvents(events: EncounterEvent[]): void;
  update(dt: number, move: Vec, enc: Encounters): void;
  /** A new day begins: nodes grow back, crops grow. */
  newDay(session: Session, hero: Vec): Session;
  /** The boss's name key and health while the fight is on. */
  bossBar(enc: Encounters): { name: string; hp: number; max: number } | null;
}
