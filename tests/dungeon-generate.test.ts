import { describe, expect, it } from 'vitest';
import { DUNGEONS } from '@/data/dungeons';
import { ITEMS } from '@/data/items';
import { CREATURES } from '@/data/creatures';
import { DUNGEON_SIZE, ROOM_H, ROOM_W } from '@/sim/dungeon/layout';
import { DUNGEON_IDS } from '@/sim/dungeon/progress';
import { generateDungeon } from '@/sim/dungeon/generate';
import type { Dungeon } from '@/sim/dungeon/types';
import { T, idx } from '@/sim/world/types';
import { playthrough, reachable } from './helpers/dungeonSolve';

const SEEDS = [1, 2, 3, 4242, 99991, 123456789];
const all = (): [string, Dungeon][] => DUNGEON_IDS.flatMap((id) => SEEDS.map((seed) => [`${id}/${seed}`, generateDungeon(seed, id)] as [string, Dungeon]));

describe('dungeon definitions', () => {
  it('names a theme, a roster of real creatures, a boss, a story item and an armour reward for each dungeon', () => {
    expect(DUNGEON_IDS).toEqual(['grotto', 'deepmine', 'ruin', 'lighthouse']);
    expect(DUNGEONS.grotto.theme).toBe('moss');
    expect(DUNGEONS.deepmine.theme).toBe('mine');
    expect(DUNGEONS.ruin.theme).toBe('ruin');
    for (const id of DUNGEON_IDS) {
      const def = DUNGEONS[id];
      expect(def.roster.length, id).toBeGreaterThanOrEqual(3);
      for (const kind of def.roster) expect(CREATURES[kind], `${id}: ${kind}`).toBeDefined();
      expect(ITEMS[def.story].stack, id).toBe(1);
      expect(ITEMS[def.armor].armor, id).toBeDefined();
    }
    expect(new Set(DUNGEON_IDS.map((id) => DUNGEONS[id].boss)).size).toBe(4);
  });
});

describe('generateDungeon', () => {
  it('is the same dungeon for the same seed and a different one for another seed', () => {
    const a = generateDungeon(7, 'grotto');
    const b = generateDungeon(7, 'grotto');
    expect(Array.from(a.world.terrain)).toEqual(Array.from(b.world.terrain));
    expect(a.spawns).toEqual(b.spawns);
    expect(a.rooms.map((r) => r.kind)).toEqual(b.rooms.map((r) => r.kind));
    const kinds = new Set(SEEDS.map((s) => generateDungeon(s, 'grotto').rooms.map((r) => r.kind).join(',')));
    expect(kinds.size).toBeGreaterThan(2);
  });

  it('makes a 48 by 48 world with a fixed chain of eight rooms: entrance, four puzzles, a vault, the boss and a side room', () => {
    for (const [name, d] of all()) {
      expect(d.world.size, name).toBe(DUNGEON_SIZE);
      expect(d.rooms.map((r) => r.id), name).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
      const kinds = d.rooms.map((r) => r.kind);
      expect([kinds[0], kinds[5], kinds[6], kinds[7]], name).toEqual(['entrance', 'vault', 'boss', 'side']);
      expect([...kinds.slice(1, 5)].sort(), name).toEqual(['block', 'crystal', 'fight', 'trap']);
      expect(d.doors, name).toHaveLength(7);
    }
  });

  it('puts every floor, door, object and creature on a floor tile, and no two solid things on the same tile', () => {
    for (const [name, d] of all()) {
      const size = d.world.size;
      const taken = new Map<number, string>();
      const put = (x: number, y: number, what: string, solid = true): void => {
        expect(d.world.terrain[idx(x, y, size)], `${name}: ${what} at ${x},${y}`).toBe(T.FLOOR);
        if (!solid) return;
        const key = idx(x, y, size);
        expect(taken.get(key), `${name}: ${what} overlaps ${taken.get(key)} at ${x},${y}`).toBeUndefined();
        taken.set(key, what);
      };
      d.doors.forEach((o) => put(o.x, o.y, 'door'));
      d.switches.forEach((o) => put(o.x, o.y, 'switch', false));
      d.blocks.forEach((o) => put(o.x, o.y, 'block'));
      d.pillars.forEach((o) => expect(d.world.terrain[idx(o.x, o.y, size)], `${name}: pillar at ${o.x},${o.y} is wall`).toBe(T.WALL));
      d.crystals.forEach((o) => put(o.x, o.y, 'crystal'));
      d.chests.forEach((o) => put(o.x, o.y, 'chest'));
      d.traps.forEach((o) => put(o.x, o.y, 'trap', false));
      d.spawns.forEach((o) => put(o.x, o.y, 'spawn', false));
      put(d.boss.x, d.boss.y, 'boss', false);
      put(Math.floor(d.entry.x), Math.floor(d.entry.y), 'entry', false);
      put(d.exit.x, d.exit.y, 'exit');
      d.torches.forEach((t) => expect(d.world.terrain[idx(t.x, t.y, size)], `${name}: torch`).toBe(T.WALL));
    }
  });

  it('joins rooms through doorways that are floor between two wall tiles, and walls everything else in', () => {
    for (const [name, d] of all()) {
      const size = d.world.size;
      for (const door of d.doors) {
        // A doorway in a vertical wall (rooms side by side) has wall above and below it; in a horizontal wall, left and right.
        const wallsOnSides = door.vertical
          ? [d.world.terrain[idx(door.x, door.y - 1, size)], d.world.terrain[idx(door.x, door.y + 1, size)]]
          : [d.world.terrain[idx(door.x - 1, door.y, size)], d.world.terrain[idx(door.x + 1, door.y, size)]];
        expect(wallsOnSides, `${name}: door ${door.id}`).toEqual([T.WALL, T.WALL]);
      }
      for (let i = 0; i < size; i++) {
        for (const [x, y] of [[i, 0], [i, size - 1], [0, i], [size - 1, i]] as const) expect(d.world.terrain[idx(x, y, size)], name).toBe(T.WALL);
      }
      const pillar = new Set(d.pillars.map((p) => idx(p.x, p.y, size)));
      for (const r of d.rooms) {
        for (let y = r.y0; y < r.y0 + ROOM_H; y++) {
          for (let x = r.x0; x < r.x0 + ROOM_W; x++) expect(d.world.terrain[idx(x, y, size)], `${name}: room ${r.id} at ${x},${y}`).toBe(pillar.has(idx(x, y, size)) ? T.WALL : T.FLOOR);
        }
      }
    }
  });

  it('can always be played through: with two small keys the boss can be reached, and nothing is left locked', () => {
    for (const [name, d] of all()) {
      const p = playthrough(d);
      expect(p.reachedBoss, name).toBe(true);
      expect(p.gotBossKey, name).toBe(true);
      expect(p.openDoors, name).toBe(7);
      expect(p.chestsOpened, name).toBe(d.chests.length);
      expect(p.keysLeft, name).toBe(0);
    }
  });

  it('never leaves the boss or the boss key reachable without passing through the puzzle rooms', () => {
    for (const [name, d] of all()) {
      const start = reachable(d, (door) => door.lock === 'free');
      const size = d.world.size;
      expect(start.has(idx(d.boss.x, d.boss.y, size)), name).toBe(false);
      // Even with every puzzle solved, only the boss key opens the last door.
      expect(d.doors.filter((door) => door.lock === 'boss'), name).toHaveLength(1);
      const solved = reachable(d, (door) => door.lock !== 'boss');
      expect(solved.has(idx(d.boss.x, d.boss.y, size)), name).toBe(false);
      const vault = d.chests.find((c) => c.loot.some((l) => l.item === 'boss_key'))!;
      expect(vault.locked, name).toBe(true);
      expect([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => start.has(idx(vault.x + dx, vault.y + dy, size))), name).toBe(false);
    }
  });

  it('hands out exactly as many small keys as there are locked chests, and puts the free key chest next to the entrance', () => {
    for (const [name, d] of all()) {
      const supply = d.chests.filter((c) => !c.locked).flatMap((c) => c.loot).filter((l) => l.item === 'small_key').reduce((n, l) => n + l.qty, 0);
      expect(d.chests.filter((c) => c.locked).length, name).toBe(supply);
      const free = d.chests.find((c) => !c.locked)!;
      expect(d.rooms[7].kind).toBe('side');
      expect(free.x).toBeGreaterThanOrEqual(d.rooms[7].x0);
      expect(free.x).toBeLessThan(d.rooms[7].x0 + ROOM_W);
      for (const c of d.chests) for (const l of c.loot) expect(ITEMS[l.item], `${name}: ${l.item}`).toBeDefined();
    }
  });

  it('gives each block puzzle a lane the block can only slide along, ending on the switch', () => {
    for (const [name, d] of all()) {
      const room = d.rooms.find((r) => r.kind === 'block')!;
      const block = d.blocks.find((b) => b.room === room.id)!;
      const sw = d.switches.find((s) => s.room === room.id)!;
      expect(sw.y, name).toBe(block.y);
      expect(sw.x, name).toBeGreaterThan(block.x);
      const at = (x: number, y: number): boolean => d.pillars.some((p) => p.x === x && p.y === y);
      for (let x = block.x; x <= sw.x; x++) {
        expect(at(x, block.y - 1), `${name}: wall above ${x}`).toBe(true);
        expect(at(x, block.y + 1), `${name}: wall below ${x}`).toBe(true);
        if (x > block.x) expect(at(x, block.y), `${name}: lane free at ${x}`).toBe(false);
      }
      expect(at(sw.x + 1, sw.y), `${name}: end cap`).toBe(true);
      expect(d.blocks.filter((b) => b.room === room.id)).toHaveLength(1);
    }
  });

  it('spawns only creatures from the dungeon roster in fight rooms and the vault, away from the doorways, and the boss in its own room', () => {
    for (const id of DUNGEON_IDS) {
      for (const seed of SEEDS) {
        const d = generateDungeon(seed, id);
        const def = DUNGEONS[id];
        expect(d.boss.kind).toBe(def.boss);
        expect(d.boss.room).toBe(6);
        for (const s of d.spawns) {
          expect(def.roster, `${id}/${seed}`).toContain(s.kind);
          expect(['fight', 'vault']).toContain(d.rooms[s.room].kind);
          for (const door of d.doors) expect(Math.hypot(door.x - s.x, door.y - s.y), `${id}/${seed}: spawn near door`).toBeGreaterThanOrEqual(3);
        }
        for (const r of d.rooms) {
          const n = d.spawns.filter((s) => s.room === r.id).length;
          if (r.kind === 'fight') expect(n).toBeGreaterThanOrEqual(3);
          if (r.kind === 'vault') expect(n).toBe(4);
          if (r.kind !== 'fight' && r.kind !== 'vault') expect(n).toBe(0);
        }
      }
    }
  });

  it('puts the hero in the entrance room, one step from an exit doorway in its south wall', () => {
    for (const [name, d] of all()) {
      const room = d.rooms[0];
      expect(Math.floor(d.entry.x), name).toBe(room.x0 + 6);
      expect(d.exit.x, name).toBe(room.x0 + 6);
      expect(d.exit.y, name).toBe(room.y0 + ROOM_H);
      expect(d.world.terrain[idx(d.exit.x, d.exit.y + 1, d.world.size)], name).toBe(T.WALL);
      expect(d.world.start.x).toBe(Math.floor(d.entry.x));
    }
  });

  it('lights the walls with torches and puts crystals, traps and switches only in their own kind of room', () => {
    for (const [name, d] of all()) {
      expect(d.torches.length, name).toBeGreaterThanOrEqual(12);
      expect(d.crystals.length, name).toBe(3);
      for (const c of d.crystals) expect(d.rooms[c.room].kind).toBe('crystal');
      for (const s of d.switches) expect(d.rooms[s.room].kind).toBe('block');
      const trapRoom = d.rooms.find((r) => r.kind === 'trap')!;
      for (const t of d.traps) expect(t.x >= trapRoom.x0 && t.x < trapRoom.x0 + ROOM_W && t.y >= trapRoom.y0 && t.y < trapRoom.y0 + ROOM_H, name).toBe(true);
      expect(new Set(d.traps.map((t) => t.phase))).toEqual(new Set([0, 1]));
    }
  });
});
