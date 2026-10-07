import type { ItemId } from '@/data/items';
import type { QuestDef, QuestStep, Reward, Text } from '@/sim/quests';

export const L = (en: string, id: string): Text => ({ en, id });
/** Kills are always counted from the step that asks for them, so kills of an earlier game or round never finish a hunt for free. */
export const count = (counter: string, n: number, text: Text, fresh = false): QuestStep => ({
  text, obj: { counter, n }, ...(fresh || counter.startsWith('kill:') ? { fresh: true } : {}),
});
export const have = (item: ItemId, n: number, text: Text): QuestStep => ({ text, obj: { have: item, n } });
export const chapter = (n: number, title: Text, steps: QuestStep[], opts: { after?: string; reward?: readonly Reward[] } = {}): QuestDef => ({
  id: `c${n}`, kind: 'main', title, auto: true, ...(opts.after ? { after: opts.after } : n > 1 ? { after: `c${n - 1}` } : {}),
  ...(opts.reward ? { reward: opts.reward } : {}), steps,
});
export const side = (id: string, giver: string, after: string, title: Text, steps: QuestStep[], reward: Reward[]): QuestDef => ({
  id, kind: 'side', title, giver, after, steps, reward,
});
