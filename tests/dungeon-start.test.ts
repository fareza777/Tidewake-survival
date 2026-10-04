import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/rng';
import { CREATURES } from '@/data/creatures';
import { generateDungeon } from '@/sim/dungeon/generate';
import { ROOM_H, ROOM_W } from '@/sim/dungeon/layout';
import { emptyProgress } from '@/sim/dungeon/progress';
import { bossOf, creaturesInRoom, startEncounters } from '@/sim/dungeon/start';

const dungeon = () => generateDungeon(5, 'deepmine');

describe('startEncounters', () => {
  it('puts every guard, the boss and the unlit crystals into a fresh dungeon, standing in the middle of their tiles', () => {
    const d = dungeon();
    const e = startEncounters(d, emptyProgress(), new Rng(1));
    expect(e.creatures).toHaveLength(d.spawns.length + 1);
    const boss = e.creatures.find((c) => c.kind === d.boss.kind)!;
    expect(boss).toMatchObject({ x: d.boss.x + 0.5, y: d.boss.y + 0.5, hp: CREATURES[d.boss.kind].hp });
    d.spawns.forEach((s) => expect(e.creatures.some((c) => c.kind === s.kind && c.x === s.x + 0.5 && c.y === s.y + 0.5)).toBe(true));
    expect(e.targets).toHaveLength(3);
    expect(e.targets[0]).toMatchObject({ x: d.crystals[0].x + 0.5, y: d.crystals[0].y + 0.5 });
    expect(new Set(e.creatures.map((c) => c.id)).size).toBe(e.creatures.length);
    expect(e.targets.map((t) => t.id)).toEqual(d.crystals.map((c) => c.id));
    expect(e.nextId).toBeGreaterThan(Math.max(...e.creatures.map((c) => c.id)));
    expect(e.shots).toEqual([]);
    expect(e.pickups).toEqual([]);
  });

  it('leaves out the guards of rooms already solved, the boss once it is dead, and crystals already struck', () => {
    const d = dungeon();
    const fight = d.rooms.find((r) => r.kind === 'fight')!;
    const p = { ...emptyProgress(), solved: [fight.id], boss: true, lit: [d.crystals[0].id, d.crystals[2].id] };
    const e = startEncounters(d, p, new Rng(1));
    expect(e.creatures.some((c) => c.kind === d.boss.kind)).toBe(false);
    expect(e.creatures).toHaveLength(d.spawns.filter((s) => s.room !== fight.id).length);
    expect(e.targets.map((t) => t.id)).toEqual([d.crystals[1].id]);
  });

  it('is the same for the same random stream', () => {
    const d = dungeon();
    expect(startEncounters(d, emptyProgress(), new Rng(9))).toEqual(startEncounters(d, emptyProgress(), new Rng(9)));
  });
});

describe('creaturesInRoom', () => {
  it('counts the creatures standing inside a room, and none outside it', () => {
    const d = dungeon();
    const e = startEncounters(d, emptyProgress(), new Rng(1));
    for (const r of d.rooms) {
      const expected = d.spawns.filter((s) => s.room === r.id).length + (r.id === d.boss.room ? 1 : 0);
      expect(creaturesInRoom(e, d, r.id), `room ${r.id}`).toBe(expected);
    }
    const r = d.rooms[3];
    const moved = { ...e, creatures: [{ ...e.creatures[0], x: r.x0 + ROOM_W + 0.5, y: r.y0 + ROOM_H / 2 }] };
    expect(creaturesInRoom(moved, d, r.id)).toBe(0);
  });
});

describe('bossOf', () => {
  it('finds the boss while it lives and nothing once it is gone', () => {
    const d = dungeon();
    const e = startEncounters(d, emptyProgress(), new Rng(1));
    expect(bossOf(e, d)?.kind).toBe(d.boss.kind);
    expect(bossOf({ ...e, creatures: e.creatures.filter((c) => c.kind !== d.boss.kind) }, d)).toBeUndefined();
  });
});
