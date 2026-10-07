import { describe, expect, it } from 'vitest';
import { newSlot, parseSlot } from '@/core/saveData';
import { depthDef } from '@/data/dungeons';
import { CREATURES } from '@/data/creatures';
import { generateDungeon } from '@/sim/dungeon/generate';
import { emptyProgress } from '@/sim/dungeon/progress';
import { claimDepthsReward } from '@/sim/dungeon/rewards';
import { newRun, solidTiles, targetAt } from '@/sim/dungeon/rules';
import { addItem, countItem, emptyInventory } from '@/sim/inventory';
import { pressureOf } from '@/sim/ngScale';
import { applyAction, sessionFromSlot, sessionToSlot, type Session } from '@/sim/session';
import { reachable } from '@/sim/world/generate';
import { T, idx } from '@/sim/world/types';

const slot = () => newSlot(0, 'Ari', 1234, 'normal', { x: 50, y: 50 }, { day: 1, t: 100 }, 1000);
const base = (over: Partial<Session> = {}): Session => ({ ...sessionFromSlot(slot()), ...over });

describe('the Endless Depths', () => {
  it('make a different dungeon on every floor, and the same one when the floor is the same', () => {
    const a = generateDungeon(1234, 'depths', 1);
    expect(generateDungeon(1234, 'depths', 1).world.terrain).toEqual(a.world.terrain);
    expect(generateDungeon(1234, 'depths', 2).rooms.map((r) => r.kind)).not.toEqual(a.rooms.map((r) => r.kind));
    expect(generateDungeon(1234, 'grotto').world.terrain).toEqual(generateDungeon(1234, 'grotto', 7).world.terrain);
  });

  it('grow in guards, boss and look with the floor, and every guard is a real creature', () => {
    const bosses = new Set<string>();
    const themes = new Set<string>();
    for (let floor = 1; floor <= 14; floor++) {
      const def = depthDef(floor);
      for (const kind of def.roster) expect(CREATURES[kind], `${floor} ${kind}`).toBeDefined();
      expect(CREATURES[def.boss].temper).toBe('boss');
      bosses.add(def.boss);
      themes.add(def.theme);
      const d = generateDungeon(99, 'depths', floor);
      expect(d.boss.kind).toBe(def.boss);
      expect(d.theme).toBe(def.theme);
    }
    expect(bosses.size).toBeGreaterThanOrEqual(6);
    expect(themes.size).toBe(7);
    expect(depthDef(1).boss).toBe('mossback');
    expect(depthDef(14).roster).toContain('gargoyle');
  });

  it('put stairs down in the boss room, on the floor, that only appear once the boss is dead', () => {
    for (let floor = 1; floor <= 8; floor++) {
      const d = generateDungeon(7, 'depths', floor);
      expect(d.stairs, `${floor}`).toBeDefined();
      const { x, y } = d.stairs!;
      expect(d.world.terrain[idx(x, y, d.world.size)]).toBe(T.FLOOR);
      const room = d.rooms[6];
      expect(x >= room.x0 && x < room.x0 + 13 && y >= room.y0 && y < room.y0 + 11, `${floor} inside boss room`).toBe(true);
      const run = newRun(d);
      expect(targetAt(run, emptyProgress(), x, y)).toBeNull();
      expect(targetAt(run, { ...emptyProgress(), boss: true }, x, y)).toEqual({ kind: 'stairs' });
      expect(solidTiles(run, emptyProgress()).has(idx(x, y, d.world.size))).toBe(true);
      const seen = reachable(d.world.terrain, d.world.size, d.world.start);
      expect(seen[idx(d.boss.x, d.boss.y, d.world.size)]).toBe(1);
    }
    expect(generateDungeon(7, 'grotto').stairs).toBeUndefined();
  });

  it('pay more gold in the chests the lower they go', () => {
    const gold = (floor: number) => generateDungeon(5, 'depths', floor).chests.flatMap((c) => c.loot).filter((l) => l.item === 'gold').reduce((n, l) => n + l.qty, 0);
    expect(gold(9)).toBeGreaterThan(gold(1));
  });

  it('go down a floor with the stairs: a clean slate below, one more floor, counted', () => {
    const here = base({ location: 'depths', floor: 3, dungeons: { ...base().dungeons, depths: { ...emptyProgress(), boss: true, solved: [1, 2] } } });
    const r = applyAction(here, { kind: 'descend' }, { x: 5, y: 5 });
    expect(r.session.floor).toBe(4);
    expect(r.session.dungeons.depths).toEqual(emptyProgress());
    expect(r.session.location).toBe('depths');
    expect(r.fx[0]).toEqual({ t: 'travel', to: 'depths' });
    expect(r.session.quests.counters.depth).toBe(1);
  });

  it('hit harder the deeper they are, on top of New Game+', () => {
    expect(pressureOf({ ng: 0, location: null, floor: 9 })).toBe(1);
    expect(pressureOf({ ng: 0, location: 'depths', floor: 1 })).toBe(1);
    expect(pressureOf({ ng: 0, location: 'depths', floor: 5 })).toBeGreaterThan(pressureOf({ ng: 0, location: 'depths', floor: 2 }));
    expect(pressureOf({ ng: 1, location: 'depths', floor: 5 })).toBeGreaterThan(pressureOf({ ng: 0, location: 'depths', floor: 5 }));
  });

  it('pay a purse and a material for the boss, all or nothing', () => {
    const inv = claimDepthsReward(emptyInventory(), 4)!;
    expect(countItem(inv, 'gold')).toBe(50 + 35 * 4);
    expect(countItem(inv, 'steel_ingot')).toBe(2);
    expect(countItem(claimDepthsReward(emptyInventory(), 3)!, 'crystal')).toBe(1);
    let full = emptyInventory();
    for (let i = 0; i < 40; i++) full = addItem(full, 'wood', 99).inv;
    expect(claimDepthsReward(full, 4)).toBeNull();
  });

  it('save the floor, and fall back to the first for a damaged one', () => {
    const s = base({ floor: 6 });
    expect(parseSlot(JSON.parse(JSON.stringify(sessionToSlot(slot(), s, { x: 1, y: 1 }))), 0)!.floor).toBe(6);
    const raw = JSON.parse(JSON.stringify(slot())) as Record<string, unknown>;
    for (const bad of [0, -3, 1.5, 'x', 99999]) expect(parseSlot({ ...raw, floor: bad }, 0)!.floor).toBe(1);
  });
});
