import type { BossId } from '@/data/dungeons';
import type { CreatureId } from '@/data/creatures';
import type { ItemId } from '@/data/items';
import type { DungeonTheme } from '@/data/terrainTiles';
import type { Vec } from '@/sim/movement';
import type { World } from '@/sim/world/types';
import type { DungeonId } from './progress';

export type RoomKind = 'entrance' | 'fight' | 'block' | 'crystal' | 'trap' | 'vault' | 'boss' | 'side';

/** One room; (x0, y0) is the top-left tile of its interior, which is ROOM_W by ROOM_H. */
export interface Room {
  id: number;
  kind: RoomKind;
  col: number;
  row: number;
  x0: number;
  y0: number;
}

/**
 * `free` doors are always open, `room` doors open once the puzzle of room `room` is solved (monsters dead, switch pressed,
 * crystals lit), `boss` doors need the boss key.
 */
export type DoorLock = 'free' | 'room' | 'boss';

export interface Door {
  id: number;
  x: number;
  y: number;
  lock: DoorLock;
  room: number | null;
  /** The doorway is in a vertical wall (it joins rooms side by side). */
  vertical: boolean;
}

export interface Switch {
  id: number;
  x: number;
  y: number;
  room: number;
}

export interface Block {
  id: number;
  x: number;
  y: number;
  room: number;
}

/** A short stretch of wall inside a room (the walls of a block lane). The terrain draws it; it is listed so the rules know where it is. */
export interface Pillar {
  x: number;
  y: number;
}

export interface Crystal {
  id: number;
  x: number;
  y: number;
  room: number;
}

/** A spike trap; the two phases take turns, so half the traps are up at any moment. */
export interface Trap {
  id: number;
  x: number;
  y: number;
  phase: 0 | 1;
}

export interface Chest {
  id: number;
  x: number;
  y: number;
  /** Needs a small key. */
  locked: boolean;
  loot: readonly { item: ItemId; qty: number }[];
}

export interface Spawn {
  kind: CreatureId;
  x: number;
  y: number;
  room: number;
}

export interface Torch {
  x: number;
  y: number;
}

/** A generated dungeon: the walls and floor as a World, and everything standing in it. All positions are tile coordinates. */
export interface Dungeon {
  id: DungeonId;
  seed: number;
  theme: DungeonTheme;
  world: World;
  rooms: Room[];
  doors: Door[];
  switches: Switch[];
  blocks: Block[];
  pillars: Pillar[];
  crystals: Crystal[];
  traps: Trap[];
  chests: Chest[];
  spawns: Spawn[];
  boss: { kind: BossId; x: number; y: number; room: number };
  torches: Torch[];
  /** Where the hero appears (tile centre). */
  entry: Vec;
  /** The doorway out, in the south wall of the entrance room. */
  exit: { x: number; y: number };
}
