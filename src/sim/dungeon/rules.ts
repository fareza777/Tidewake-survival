import type { Vec } from '@/sim/movement';
import { T, idx, inBounds, type World } from '@/sim/world/types';
import { addUnique, isDungeonId, type DungeonId, type DungeonProgress } from './progress';
import type { Block, Chest, Door, Dungeon, Trap } from './types';

/** A dungeon as it is right now: the generated layout plus the blocks, which the hero moves. Everything else is in the progress. */
export interface Run {
  readonly dungeon: Dungeon;
  readonly blocks: readonly Block[];
}

export const newRun = (dungeon: Dungeon): Run => ({ dungeon, blocks: dungeon.blocks });

/** Free doors are open, a room's door opens when the room is solved, and a locked door once it has been unlocked. */
export function doorIsOpen(door: Door, p: DungeonProgress): boolean {
  if (door.lock === 'free' || p.opened.includes(door.id)) return true;
  return door.lock === 'room' && door.room !== null && p.solved.includes(door.room);
}

export const unlockDoor = (p: DungeonProgress, doorId: number): DungeonProgress => {
  const opened = addUnique(p.opened, doorId);
  return opened === p.opened ? p : { ...p, opened };
};

export const lootChest = (p: DungeonProgress, chestId: number): DungeonProgress => {
  const looted = addUnique(p.looted, chestId);
  return looted === p.looted ? p : { ...p, looted };
};

export const lightCrystal = (p: DungeonProgress, crystalId: number): DungeonProgress => {
  const lit = addUnique(p.lit, crystalId);
  return lit === p.lit ? p : { ...p, lit };
};

/** Tiles nobody can walk through: closed doors, pillars, crystals, chests and blocks (walls are terrain). */
export function solidTiles(run: Run, p: DungeonProgress): Set<number> {
  const d = run.dungeon;
  const size = d.world.size;
  const solid = new Set<number>();
  for (const o of [...d.pillars, ...d.crystals, ...d.chests, ...run.blocks]) solid.add(idx(o.x, o.y, size));
  for (const door of d.doors) if (!doorIsOpen(door, p)) solid.add(idx(door.x, door.y, size));
  if (d.stairs) solid.add(idx(d.stairs.x, d.stairs.y, size));
  return solid;
}

/** Slide a block one tile. Null when the block is not there, the push is not a straight step, or the tile is not free. */
export function pushBlock(run: Run, p: DungeonProgress, blockId: number, dx: number, dy: number): Run | null {
  const block = run.blocks.find((b) => b.id === blockId);
  if (!block || Math.abs(dx) + Math.abs(dy) !== 1) return null;
  const x = block.x + dx;
  const y = block.y + dy;
  const size = run.dungeon.world.size;
  if (!inBounds(x, y, size) || run.dungeon.world.terrain[idx(x, y, size)] !== T.FLOOR) return null;
  if (solidTiles(run, p).has(idx(x, y, size))) return null;
  return { ...run, blocks: run.blocks.map((b) => (b.id === blockId ? { ...b, x, y } : b)) };
}

/** Switches with a block on them. */
export function pressedSwitches(run: Run): number[] {
  return run.dungeon.switches.filter((s) => run.blocks.some((b) => b.x === s.x && b.y === s.y)).map((s) => s.id);
}

/**
 * Add the rooms that are solved right now: a block room whose switch is pressed, a crystal room whose crystals are all lit,
 * and a fight room or vault whose monsters are dead (`alive(room)` counts the living ones). Solved rooms stay solved.
 * Returns the very same object when nothing changed.
 */
export function solveRooms(run: Run, p: DungeonProgress, alive: (room: number) => number): DungeonProgress {
  const d = run.dungeon;
  const pressed = pressedSwitches(run);
  let solved = p.solved;
  for (const room of d.rooms) {
    if (solved.includes(room.id)) continue;
    const done =
      room.kind === 'block' ? d.switches.some((s) => s.room === room.id && pressed.includes(s.id))
      : room.kind === 'crystal' ? d.crystals.filter((c) => c.room === room.id).every((c) => p.lit.includes(c.id))
      : room.kind === 'fight' || room.kind === 'vault' ? alive(room.id) === 0
      : false;
    if (done) solved = addUnique(solved, room.id);
  }
  return solved === p.solved ? p : { ...p, solved };
}

/** A spike trap's cycle: it warns, springs up, and falls back. The two phases are half a cycle apart. */
export const TRAP_CYCLE = 2.4;
const WARN = 0.4;
const UP = 0.6;
export type TrapState = 'down' | 'warn' | 'up';

export function trapState(trap: Trap, t: number): TrapState {
  const u = (((t - trap.phase * (TRAP_CYCLE / 2)) % TRAP_CYCLE) + TRAP_CYCLE) % TRAP_CYCLE;
  return u < WARN ? 'warn' : u < WARN + UP ? 'up' : 'down';
}

/** The spike trap under the hero that is up right now, if any. */
export function trapUnder(run: Run, hero: Vec, t: number): Trap | null {
  const x = Math.floor(hero.x);
  const y = Math.floor(hero.y);
  return run.dungeon.traps.find((tr) => tr.x === x && tr.y === y && trapState(tr, t) === 'up') ?? null;
}

export type Target = { kind: 'door'; door: Door } | { kind: 'chest'; chest: Chest } | { kind: 'exit' } | { kind: 'stairs' };

/** What the hero can use on this tile: a locked door, a chest not yet emptied, or the way out. */
export function targetAt(run: Run, p: DungeonProgress, x: number, y: number): Target | null {
  const d = run.dungeon;
  if (x === d.exit.x && y === d.exit.y) return { kind: 'exit' };
  if (d.stairs && p.boss && x === d.stairs.x && y === d.stairs.y) return { kind: 'stairs' };
  const door = d.doors.find((o) => o.x === x && o.y === y && o.lock === 'boss' && !doorIsOpen(o, p));
  if (door) return { kind: 'door', door };
  const chest = d.chests.find((o) => o.x === x && o.y === y && !p.looted.includes(o.id));
  return chest ? { kind: 'chest', chest } : null;
}

/** Where the hero stands after coming out of a dungeon: the tile just south of its door on the island. */
export function doorwayOutside(world: World, id: DungeonId): Vec {
  const door = world.landmarks.find((l) => l.id === id);
  return door ? { x: door.x + 0.5, y: door.y + 1.5 } : { ...world.start };
}

/** The dungeon whose entrance stands on this island tile (the landmark tile of the grotto, the deep mine or the ruin). */
export function entranceAt(world: World, x: number, y: number): DungeonId | null {
  const l = world.landmarks.find((o) => o.x === x && o.y === y);
  return l && isDungeonId(l.id) ? l.id : null;
}
