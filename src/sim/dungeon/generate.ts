import { Rng, hashString } from '@/core/rng';
import { DUNGEONS } from '@/data/dungeons';
import { T, idx, type World } from '@/sim/world/types';
import { CELLS, DUNGEON_SIZE, LINKS, ROOM_H, ROOM_W, doorwayBetween, roomOrigin } from './layout';
import type { DungeonId } from './progress';
import type { Block, Chest, Crystal, Door, Dungeon, Pillar, Room, RoomKind, Spawn, Switch, Torch, Trap } from './types';

const PUZZLES: readonly RoomKind[] = ['fight', 'block', 'crystal', 'trap'];
/** Creatures stay at least this far from every doorway when a room is populated. */
const DOOR_CLEARANCE = 3;

/** Everything one room adds to the dungeon. Positions are given relative to the room and shifted by `place`. */
interface Contents {
  switches: Switch[];
  blocks: Block[];
  pillars: Pillar[];
  crystals: Crystal[];
  traps: Trap[];
  chests: Chest[];
  spawns: Spawn[];
}

const emptyContents = (): Contents => ({ switches: [], blocks: [], pillars: [], crystals: [], traps: [], chests: [], spawns: [] });

/** A lane two pillars wide, closed at the far end: a block can only slide along it, onto the switch. */
function blockPuzzle(room: Room, out: Contents): void {
  const at = (x: number, y: number) => ({ x: room.x0 + x, y: room.y0 + y });
  for (let x = 4; x <= 10; x++) {
    out.pillars.push(at(x, 2), at(x, 4));
  }
  out.pillars.push(at(10, 3));
  out.blocks.push({ id: 0, ...at(4, 3), room: room.id });
  out.switches.push({ id: 0, ...at(9, 3), room: room.id });
}

function crystalPuzzle(room: Room, out: Contents): void {
  [[2, 2], [10, 2], [6, 8]].forEach(([x, y], i) => out.crystals.push({ id: i, x: room.x0 + x, y: room.y0 + y, room: room.id }));
}

/** A field of spikes where neighbouring columns take turns: crossing it takes timing. */
function trapField(room: Room, out: Contents, firstId: number): void {
  let id = firstId;
  for (let y = 3; y <= 7; y++) {
    for (let x = 3; x <= 9; x++) out.traps.push({ id: id++, x: room.x0 + x, y: room.y0 + y, phase: (x % 2) as 0 | 1 });
  }
}

/** Creatures standing where they do not block a doorway. */
function populate(room: Room, count: number, roster: readonly string[], doors: readonly Door[], taken: ReadonlySet<string>, rng: Rng, out: Contents): void {
  const spots: { x: number; y: number }[] = [];
  for (let y = room.y0 + 2; y <= room.y0 + 8; y++) {
    for (let x = room.x0 + 2; x <= room.x0 + 10; x++) {
      if (taken.has(`${x},${y}`)) continue;
      if (doors.some((d) => Math.hypot(d.x - x, d.y - y) < DOOR_CLEARANCE)) continue;
      spots.push({ x, y });
    }
  }
  for (const spot of rng.sample(spots, count)) {
    out.spawns.push({ kind: rng.pick(roster) as Spawn['kind'], x: spot.x, y: spot.y, room: room.id });
  }
}

function carve(terrain: Uint8Array, x0: number, y0: number, w: number, h: number): void {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) terrain[idx(x, y, DUNGEON_SIZE)] = T.FLOOR;
}

/** Build a dungeon from the world seed. The same seed and dungeon always give the same result. */
export function generateDungeon(seed: number, id: DungeonId): Dungeon {
  const def = DUNGEONS[id];
  const rng = new Rng(hashString(`${seed}:dungeon:${id}`));
  const kinds: RoomKind[] = ['entrance', ...rng.shuffle(PUZZLES), 'vault', 'boss', 'side'];
  const rooms: Room[] = CELLS.map(([col, row], i) => ({ id: i, kind: kinds[i], col, row, ...roomOrigin(col, row) }));

  const terrain = new Uint8Array(DUNGEON_SIZE * DUNGEON_SIZE).fill(T.WALL);
  for (const r of rooms) carve(terrain, r.x0, r.y0, ROOM_W, ROOM_H);

  const doors: Door[] = LINKS.map(([a, b], i) => {
    const w = doorwayBetween(CELLS[a], CELLS[b]);
    terrain[idx(w.x, w.y, DUNGEON_SIZE)] = T.FLOOR;
    const puzzle = a >= 1 && a <= 4 && rooms[a].kind !== 'trap';
    const lock = b === 6 ? 'boss' : puzzle ? 'room' : 'free';
    return { id: i, x: w.x, y: w.y, lock, room: lock === 'room' ? a : null, vertical: w.vertical };
  });

  const entrance = rooms[0];
  const exit = { x: entrance.x0 + (ROOM_W >> 1), y: entrance.y0 + ROOM_H };
  terrain[idx(exit.x, exit.y, DUNGEON_SIZE)] = T.FLOOR;

  const out = emptyContents();
  const at = (r: Room, x: number, y: number) => ({ x: r.x0 + x, y: r.y0 + y });
  let chestId = 0;
  for (const room of rooms) {
    if (room.kind === 'block') blockPuzzle(room, out);
    if (room.kind === 'crystal') crystalPuzzle(room, out);
    if (room.kind === 'trap') {
      trapField(room, out, out.traps.length);
      out.chests.push({ id: chestId++, ...at(room, 11, 1), locked: true, loot: [{ item: 'bandage', qty: 3 }, { item: 'honey', qty: 2 }, { item: 'arrow', qty: 12 }, { item: 'gold', qty: 25 }] });
    }
    if (room.kind === 'side') out.chests.push({ id: chestId++, ...at(room, 6, 2), locked: false, loot: [{ item: 'small_key', qty: 2 }, { item: 'gold', qty: 12 }, ...(def.id === 'deepmine' ? [{ item: 'lost_pickaxe' as const, qty: 1 }] : [])] });
    if (room.kind === 'vault') out.chests.push({ id: chestId++, ...at(room, 3, 2), locked: true, loot: [{ item: 'boss_key', qty: 1 }] });
  }
  for (const p of out.pillars) terrain[idx(p.x, p.y, DUNGEON_SIZE)] = T.WALL;
  for (const room of rooms) {
    if (room.kind !== 'fight' && room.kind !== 'vault') continue;
    const taken = new Set(out.chests.map((c) => `${c.x},${c.y}`));
    populate(room, room.kind === 'vault' ? 4 : 3 + (room.id % 2), def.roster, doors, taken, rng, out);
  }

  const torches: Torch[] = rooms.flatMap((r) => [at(r, 2, -1), at(r, 10, -1)]);
  const bossRoom = rooms[6];
  const world: World = {
    seed, size: DUNGEON_SIZE, terrain, biome: new Uint8Array(DUNGEON_SIZE * DUNGEON_SIZE), landmarks: [], resources: [],
    start: { x: entrance.x0 + (ROOM_W >> 1), y: entrance.y0 + 8 },
  };
  return {
    id, seed, theme: def.theme, world, rooms, doors, ...out, torches,
    boss: { kind: def.boss, ...at(bossRoom, 9, 5), room: bossRoom.id },
    entry: { x: world.start.x + 0.5, y: world.start.y + 0.5 },
    exit,
  };
}
