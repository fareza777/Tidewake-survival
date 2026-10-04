import { describe, expect, it } from 'vitest';
import { newSlot, parseSlot } from '@/core/saveData';
import { QUESTS } from '@/data/quests';
import { generateDungeon } from '@/sim/dungeon/generate';
import { settle } from '@/sim/quests';

const v3 = (dungeons: unknown, seed = 1234): unknown => {
  const { quests: _unused, ...old } = newSlot(0, 'Ari', seed, 'normal', { x: 50, y: 50 }, { day: 3, t: 100 }, 1000);
  return JSON.parse(JSON.stringify({ ...old, version: 3, dungeons }));
};
const progress = (over: object) => ({ opened: [], looted: [], solved: [], lit: [], boss: false, ...over });

describe('a save from before the story', () => {
  it('starts at chapter one with nothing counted when no boss had fallen', () => {
    const s = parseSlot(v3({}), 0)!;
    // (the scene starts the first chapter when the game loads)
    expect(Object.keys(settle(s.quests, s.inventory, QUESTS).q.active)).toEqual(['c1']);
    expect(s.quests.counters).toEqual({});
    expect(s.quests.owed).toEqual([]);
  });

  it('remembers the bosses that already fell and the rewards already taken, so the chapters about them can finish', () => {
    const s = parseSlot(v3({ grotto: progress({ boss: true, claimed: true }), ruin: progress({ boss: true }) }), 0)!;
    expect(s.quests.counters).toEqual({ 'boss:mossback': 1, 'claim:grotto': 1, 'boss:mirelord': 1 });
  });

  it('hands over the lost pickaxe when the Deepmine chest that holds it was emptied before it was put there', () => {
    const side = generateDungeon(1234, 'deepmine').chests.find((c) => c.loot.some((l) => l.item === 'lost_pickaxe'))!;
    const s = parseSlot(v3({ deepmine: progress({ looted: [side.id] }) }), 0)!;
    expect(s.quests.owed).toEqual([{ item: 'lost_pickaxe', qty: 1 }]);
    expect(parseSlot(v3({ deepmine: progress({}) }), 0)!.quests.owed).toEqual([]);
  });

  it('leaves a save made with this story alone', () => {
    const fresh = JSON.parse(JSON.stringify(newSlot(0, 'Ari', 1234, 'normal', { x: 50, y: 50 }, { day: 1, t: 0 }, 1000)));
    fresh.dungeons.grotto = progress({ boss: true });
    expect(parseSlot(fresh, 0)!.quests.counters).toEqual({});
  });
});
