import { describe, expect, it } from 'vitest';
import { generateDungeon } from '@/sim/dungeon/generate';
import { emptyProgress, type DungeonProgress } from '@/sim/dungeon/progress';
import {
  TRAP_CYCLE, doorIsOpen, doorwayOutside, entranceAt, lightCrystal, lootChest, newRun, pressedSwitches, pushBlock, solidTiles, solveRooms, targetAt, trapState,
  trapUnder, unlockDoor,
} from '@/sim/dungeon/rules';
import type { Dungeon, Room } from '@/sim/dungeon/types';
import { generateWorld } from '@/sim/world/generate';
import { propSolidTiles } from '@/sim/solids';
import { T, idx, isWater } from '@/sim/world/types';

const dungeon = (): Dungeon => generateDungeon(1, 'grotto');
const room = (d: Dungeon, kind: Room['kind']): Room => d.rooms.find((r) => r.kind === kind)!;
const fresh = (): DungeonProgress => emptyProgress();

describe('doors', () => {
  it('are open when free, when their room is solved, or once unlocked, and closed otherwise', () => {
    const d = dungeon();
    const free = d.doors.find((x) => x.lock === 'free')!;
    const gated = d.doors.find((x) => x.lock === 'room')!;
    const boss = d.doors.find((x) => x.lock === 'boss')!;
    expect(doorIsOpen(free, fresh())).toBe(true);
    expect(doorIsOpen(gated, fresh())).toBe(false);
    expect(doorIsOpen(gated, { ...fresh(), solved: [gated.room!] })).toBe(true);
    expect(doorIsOpen(boss, fresh())).toBe(false);
    expect(doorIsOpen(boss, unlockDoor(fresh(), boss.id))).toBe(true);
  });

  it('remember an unlock without changing the old progress, and only once', () => {
    const p = fresh();
    const a = unlockDoor(p, 3);
    expect(a.opened).toEqual([3]);
    expect(p.opened).toEqual([]);
    expect(unlockDoor(a, 3)).toBe(a);
  });
});

describe('solid tiles', () => {
  it('include closed doors, pillars, crystals, chests and blocks, but not open doors, switches or traps', () => {
    const d = dungeon();
    const run = newRun(d);
    const solid = solidTiles(run, fresh());
    const at = (o: { x: number; y: number }): boolean => solid.has(idx(o.x, o.y, d.world.size));
    for (const o of [...d.pillars, ...d.crystals, ...d.chests, ...d.blocks]) expect(at(o)).toBe(true);
    for (const door of d.doors) expect(at(door), `door ${door.id}`).toBe(door.lock !== 'free');
    for (const o of [...d.switches, ...d.traps]) expect(at(o)).toBe(false);
    const open = solidTiles(run, { ...fresh(), solved: d.doors.filter((x) => x.room !== null).map((x) => x.room!) });
    for (const door of d.doors.filter((x) => x.lock === 'room')) expect(open.has(idx(door.x, door.y, d.world.size))).toBe(false);
  });
});

describe('pushing blocks', () => {
  const setup = () => {
    const d = dungeon();
    return { d, run: newRun(d), block: d.blocks[0], sw: d.switches[0] };
  };

  it('slides a block one tile along its lane, onto the switch, and no further', () => {
    const { run, block, sw } = setup();
    let cur = run;
    for (let x = block.x; x < sw.x; x++) {
      const next = pushBlock(cur, fresh(), block.id, 1, 0);
      expect(next, `push from ${x}`).not.toBeNull();
      cur = next!;
    }
    expect(cur.blocks[0]).toMatchObject({ x: sw.x, y: sw.y });
    expect(pressedSwitches(cur)).toEqual([sw.id]);
    expect(pushBlock(cur, fresh(), block.id, 1, 0)).toBeNull();
    expect(pressedSwitches(run)).toEqual([]);
  });

  it('refuses to push into a wall, a pillar, another block, a diagonal, or nowhere', () => {
    const { run, block } = setup();
    expect(pushBlock(run, fresh(), block.id, 0, -1)).toBeNull();
    expect(pushBlock(run, fresh(), block.id, 0, 1)).toBeNull();
    expect(pushBlock(run, fresh(), block.id, -1, 0)).not.toBeNull();
    expect(pushBlock(run, fresh(), block.id, 1, 1)).toBeNull();
    expect(pushBlock(run, fresh(), block.id, 0, 0)).toBeNull();
    expect(pushBlock(run, fresh(), 99, 1, 0)).toBeNull();
    const crowded = { ...run, blocks: [block, { id: 5, x: block.x + 1, y: block.y, room: block.room }] };
    expect(pushBlock(crowded, fresh(), block.id, 1, 0)).toBeNull();
  });

  it('never changes the run it was given', () => {
    const { run, block } = setup();
    const before = JSON.stringify(run.blocks);
    pushBlock(run, fresh(), block.id, 1, 0);
    expect(JSON.stringify(run.blocks)).toBe(before);
  });
});

describe('solving rooms', () => {
  it('solves a block room when its switch is pressed, a crystal room when all crystals are lit, a fight room when its monsters are dead', () => {
    const d = dungeon();
    const blockRoom = room(d, 'block');
    const crystalRoom = room(d, 'crystal');
    const fightRoom = room(d, 'fight');
    let run = newRun(d);
    const vaultRoom = room(d, 'vault');
    const alive = (id: number): number => (id === fightRoom.id || id === vaultRoom.id ? 2 : 0);
    expect(solveRooms(run, fresh(), alive).solved).toEqual([]);

    for (let x = d.blocks[0].x; x < d.switches[0].x; x++) run = pushBlock(run, fresh(), 0, 1, 0)!;
    expect(solveRooms(run, fresh(), alive).solved).toContain(blockRoom.id);

    let p = fresh();
    for (const c of d.crystals.slice(0, 2)) p = lightCrystal(p, c.id);
    expect(solveRooms(newRun(d), p, alive).solved).not.toContain(crystalRoom.id);
    p = lightCrystal(p, d.crystals[2].id);
    expect(solveRooms(newRun(d), p, alive).solved).toContain(crystalRoom.id);

    expect(solveRooms(newRun(d), fresh(), () => 0).solved).toContain(fightRoom.id);
    expect(solveRooms(newRun(d), fresh(), () => 0).solved).toContain(room(d, 'vault').id);
  });

  it('keeps a room solved once it is, hands back the same object when nothing changed, and never touches rooms with nothing to solve', () => {
    const d = dungeon();
    const done = { ...fresh(), solved: [room(d, 'block').id] };
    expect(solveRooms(newRun(d), done, () => 1)).toBe(done);
    const all = solveRooms(newRun(d), fresh(), () => 0);
    for (const kind of ['entrance', 'trap', 'boss', 'side'] as const) expect(all.solved).not.toContain(room(d, kind).id);
  });

  it('lights a crystal once without changing the old progress', () => {
    const p = fresh();
    const a = lightCrystal(p, 1);
    expect(a.lit).toEqual([1]);
    expect(p.lit).toEqual([]);
    expect(lightCrystal(a, 1)).toBe(a);
  });
});

describe('spike traps', () => {
  it('warn, spring up, and fall back, with the two phases taking turns so they are never up together', () => {
    const d = dungeon();
    const t0 = d.traps.find((t) => t.phase === 0)!;
    const t1 = d.traps.find((t) => t.phase === 1)!;
    const seen = new Set<string>();
    for (let t = 0; t < TRAP_CYCLE * 3; t += 0.05) {
      seen.add(trapState(t0, t));
      expect(trapState(t0, t) === 'up' && trapState(t1, t) === 'up', `t=${t}`).toBe(false);
    }
    expect([...seen].sort()).toEqual(['down', 'up', 'warn']);
  });

  it('always warns before a trap springs up', () => {
    const d = dungeon();
    const trap = d.traps[0];
    let prev = trapState(trap, 0);
    for (let t = 0.01; t < TRAP_CYCLE * 2; t += 0.01) {
      const cur = trapState(trap, t);
      if (cur === 'up') expect(prev === 'warn' || prev === 'up', `t=${t}`).toBe(true);
      prev = cur;
    }
  });

  it('hurt only a hero standing on a trap that is up', () => {
    const d = dungeon();
    const run = newRun(d);
    const trap = d.traps[0];
    let upAt = -1;
    let downAt = -1;
    for (let t = 0; t < TRAP_CYCLE && (upAt < 0 || downAt < 0); t += 0.02) {
      if (trapState(trap, t) === 'up' && upAt < 0) upAt = t;
      if (trapState(trap, t) === 'down' && downAt < 0) downAt = t;
    }
    const on = { x: trap.x + 0.5, y: trap.y + 0.5 };
    expect(trapUnder(run, on, upAt)).toMatchObject({ id: trap.id });
    expect(trapUnder(run, on, downAt)).toBeNull();
    expect(trapUnder(run, { x: trap.x + 0.5, y: d.rooms[0].y0 + 2.5 }, upAt)).toBeNull();
  });
});

describe('what ACTION can reach', () => {
  it('finds a closed boss door, an unopened chest, and the exit, but nothing at an open door, an emptied chest or bare floor', () => {
    const d = dungeon();
    const run = newRun(d);
    const boss = d.doors.find((x) => x.lock === 'boss')!;
    const chest = d.chests[0];
    expect(targetAt(run, fresh(), boss.x, boss.y)).toEqual({ kind: 'door', door: boss });
    expect(targetAt(run, unlockDoor(fresh(), boss.id), boss.x, boss.y)).toBeNull();
    expect(targetAt(run, fresh(), chest.x, chest.y)).toEqual({ kind: 'chest', chest });
    expect(targetAt(run, lootChest(fresh(), chest.id), chest.x, chest.y)).toBeNull();
    expect(targetAt(run, fresh(), d.exit.x, d.exit.y)).toEqual({ kind: 'exit' });
    expect(targetAt(run, fresh(), Math.floor(d.entry.x), Math.floor(d.entry.y))).toBeNull();
    const gated = d.doors.find((x) => x.lock === 'room')!;
    expect(targetAt(run, fresh(), gated.x, gated.y)).toBeNull();
  });

  it('remembers a looted chest without changing the old progress', () => {
    const p = fresh();
    expect(lootChest(p, 2).looted).toEqual([2]);
    expect(p.looted).toEqual([]);
    expect(lootChest(lootChest(p, 2), 2).looted).toEqual([2]);
  });
});

describe('dungeon entrances on the island', () => {
  it('are the landmark tiles of the grotto, the deep mine and the ruin, and nothing else', () => {
    const world = generateWorld(1234);
    for (const l of world.landmarks) {
      const found = entranceAt(world, l.x, l.y);
      expect(found, l.id).toBe(l.id === 'grotto' || l.id === 'deepmine' || l.id === 'ruin' ? l.id : null);
      expect(entranceAt(world, l.x + 1, l.y), l.id).toBeNull();
    }
    expect(entranceAt(world, -1, 5)).toBeNull();
  });
});

describe('coming back out', () => {
  it('puts the hero on open ground just south of the entrance of that dungeon, on every island', () => {
    for (const seed of [1, 2, 3, 1234, 99991]) {
      const world = generateWorld(seed);
      const blocked = new Set(propSolidTiles(world));
      for (const id of ['grotto', 'deepmine', 'ruin'] as const) {
        const door = world.landmarks.find((l) => l.id === id)!;
        const out = doorwayOutside(world, id);
        expect(out, `${seed}/${id}`).toEqual({ x: door.x + 0.5, y: door.y + 1.5 });
        const tile = idx(door.x, door.y + 1, world.size);
        expect(isWater(world.terrain[tile]) || world.terrain[tile] === T.DEEP, `${seed}/${id} water`).toBe(false);
        expect(blocked.has(tile), `${seed}/${id} blocked`).toBe(false);
      }
    }
  });
});
