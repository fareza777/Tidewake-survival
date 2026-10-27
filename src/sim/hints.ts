import { countItem } from '@/sim/inventory';
import type { Session } from '@/sim/session';

/** One-time tips for the systems a new player would otherwise never find. Each is shown once, when it first matters. */
export const HINT_IDS = ['thirst', 'hunger', 'cold', 'gold', 'shop', 'boat', 'dock', 'camp', 'depths', 'jobs'] as const;
export type HintId = (typeof HINT_IDS)[number];

const key = (id: HintId): string => `hint:${id}`;

export const hintSeen = (s: Session, id: HintId): boolean => (s.quests.counters[key(id)] ?? 0) > 0;

/** Remember that a tip was shown (it is saved with the quest counters, so it never comes back). */
export const markHint = (s: Session, id: HintId): Session => ({ ...s, quests: { ...s.quests, counters: { ...s.quests.counters, [key(id)]: 1 } } });

/** Does this tip apply to the hero right now? */
const applies: Record<HintId, (s: Session) => boolean> = {
  thirst: (s) => s.location === null && s.vitals.thirst < 35,
  hunger: (s) => s.vitals.hunger < 35,
  cold: (s) => s.location === null && s.vitals.warmth < 65,
  gold: (s) => countItem(s.inventory, 'gold') > 0,
  shop: (s) => countItem(s.inventory, 'gold') >= 20 && s.quests.done.includes('c3'),
  jobs: (s) => (s.quests.counters['talk:marlo'] ?? 0) > 0 && s.quests.done.includes('c3'),
  boat: (s) => s.island === 'home' && s.quests.done.includes('c9') && !s.structures.list.some((b) => b.type === 'boat'),
  dock: (s) => s.island !== 'home' && s.location === null,
  camp: (s) => countItem(s.inventory, 'gold') >= 150 && s.settlers.length === 0,
  depths: (s) => s.quests.done.includes('c9'),
};

/** The first tip that applies and has not been shown yet (null when there is none). */
export function nextHint(s: Session): HintId | null {
  return HINT_IDS.find((id) => !hintSeen(s, id) && applies[id](s)) ?? null;
}
