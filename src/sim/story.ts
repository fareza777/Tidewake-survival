import type { Cond, NpcDef, Topic } from '@/data/npcs';
import type { QuestDefs, QuestState, Text } from '@/sim/quests';

/** What a talk is about: the lines to show, and the side quest it begins (if any). */
export interface Talk {
  lines: readonly Text[];
  start?: string;
}

const unlocked = (q: QuestState, defs: QuestDefs, id: string): boolean => {
  const after = defs[id]?.after;
  return !after || q.done.includes(after);
};

function holds(c: Cond, q: QuestState, defs: QuestDefs): boolean {
  if ('all' in c) return c.all.every((x) => holds(x, q, defs));
  if ('at' in c) return q.active[c.at]?.step === c.step;
  switch (c.is) {
    case 'new': return !(c.quest in q.active) && !q.done.includes(c.quest) && unlocked(q, defs, c.quest);
    case 'active': return c.quest in q.active;
    case 'done': return q.done.includes(c.quest);
  }
}

/** What an islander says now: the first topic whose condition holds, otherwise a line of idle talk (the first one, then the next). */
export function pickTopic(npc: NpcDef, q: QuestState, defs: QuestDefs): Talk {
  const topic: Topic | undefined = npc.topics.find((t) => holds(t.when, q, defs));
  if (topic) return { lines: topic.lines, ...(topic.start ? { start: topic.start } : {}) };
  const spoken = q.counters[`talk:${npc.id}`] ?? 0;
  return { lines: [npc.idle[spoken % npc.idle.length]] };
}
