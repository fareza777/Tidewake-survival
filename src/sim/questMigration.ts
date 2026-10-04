import { DUNGEONS } from '@/data/dungeons';
import { DUNGEON_IDS, type Dungeons } from '@/sim/dungeon/progress';
import { generateDungeon } from '@/sim/dungeon/generate';
import type { QuestState } from '@/sim/quests';

/**
 * A save made before the story knows what the hero already did in the dungeons: bosses that fell can never be fought
 * again, so the story is told about them, and Brock's pickaxe is owed when the chest that holds it was emptied before
 * the pickaxe was put in.
 */
export function migrateQuests(q: QuestState, dungeons: Dungeons, seed: number): QuestState {
  const counters: Record<string, number> = { ...q.counters };
  for (const id of DUNGEON_IDS) {
    if (dungeons[id].boss) counters[`boss:${DUNGEONS[id].boss}`] = 1;
    if (dungeons[id].claimed) counters[`claim:${id}`] = 1;
  }
  const chest = generateDungeon(seed, 'deepmine').chests.find((c) => c.loot.some((l) => l.item === 'lost_pickaxe'));
  const owed = chest && dungeons.deepmine.looted.includes(chest.id) ? [...q.owed, { item: 'lost_pickaxe' as const, qty: 1 }] : q.owed;
  return { ...q, counters, owed };
}
