import { Rng, hashString } from '@/core/rng';
import { CREATURES, type CreatureId } from '@/data/creatures';
import { BOTTLES, CAT_FOUND, TABLETS, TREASURE_LOOT } from '@/data/lore';
import { NPCS, type NpcId } from '@/data/npcs';
import { newAchievements } from '@/data/achievements';
import { QUESTS } from '@/data/quests';
import { addItem, removeItem, wearTool } from '@/sim/inventory';
import { bump, settle, startQuest, type Reward } from '@/sim/quests';
import type { Fx, Session, Step } from '@/sim/session';
import { giveItems, say } from '@/sim/sessionKit';
import { pickTopic } from '@/sim/story';
import { spendStamina } from '@/sim/vitals';
import type { Spot } from '@/sim/world/spots';

/**
 * Everything the story does to a session: counters go up when things happen, the quests move along, rewards are paid
 * out (and wait in `quests.owed` when the backpack is full). Rules that other parts of the game apply (building,
 * crafting, eating) hand their result to `withStory` with the counters they raise.
 */
export function story(s: Session, events: readonly string[] = []): Step {
  const raised = events.reduce((q, key) => bump(q, key), s.quests);
  const settled = settle(raised, s.inventory, QUESTS);
  // Deeds that earn a title, checked whenever something has just happened.
  const earned = events.length > 0 || settled.events.length > 0 ? newAchievements({ ...s, quests: settled.q }) : [];
  const marked = earned.reduce((q, a) => bump(q, `ach:${a.id}`), settled.q);
  const incoming: Reward[] = [
    ...settled.events.flatMap((ev) => (ev.t === 'done' ? [...ev.reward] : [])),
    ...earned.map((a): Reward => ({ item: 'gold', qty: a.reward })),
  ];
  const queue = [...s.quests.owed, ...incoming];
  if (events.length === 0 && settled.events.length === 0 && queue.length === 0) return { session: s, fx: [] };
  const fx: Fx[] = [...settled.events.map((ev): Fx => ({ t: 'quest', ev })), ...earned.map((a): Fx => ({ t: 'achievement', id: a.id }))];
  let inv = s.inventory;
  const owed: Reward[] = [];
  for (const r of queue) {
    const { inv: next, left } = addItem(inv, r.item, r.qty);
    inv = next;
    if (r.qty - left > 0) fx.push({ t: 'gain', item: r.item, qty: r.qty - left });
    if (left > 0) owed.push({ item: r.item, qty: left });
  }
  if (events.length === 0 && fx.length === 0 && owed.length === queue.length) return { session: s, fx: [] };
  if (incoming.length > 0 && owed.length > 0) fx.push(say('questOwed'));
  return { session: { ...s, inventory: inv, quests: { ...marked, owed } }, fx };
}

/** A rule's result with the story's counters raised on top. */
export function withStory(step: Step, events: readonly string[]): Step {
  const r = story(step.session, events);
  return { session: r.session, fx: [...step.fx, ...r.fx] };
}

/** Try again to hand over rewards that did not fit the backpack. */
export const claimOwed = (s: Session): Step => story(s);

export function recordKill(s: Session, kind: CreatureId): Step {
  return story(s, [`kill:${kind}`, ...(CREATURES[kind].temper === 'boss' ? [`boss:${kind}`] : [])]);
}

/** The hero came near a landmark (counted once). */
export function reached(s: Session, landmark: string): Step {
  return s.quests.counters[`reach:${landmark}`] ? { session: s, fx: [] } : story(s, [`reach:${landmark}`]);
}

/** The hero has set foot on an island: counted once (it opens the chapter that asks for it). */
export function arrive(s: Session): Step {
  const key = `island:${s.island}`;
  return s.island === 'home' || s.quests.counters[key] ? { session: s, fx: [] } : story(s, [key]);
}

/** A new day began. A night spent awake beside a fire or torch counts as a night watch. */
export function dawn(s: Session, how: { slept: boolean; lit: boolean }): Step {
  return story(s, ['night', ...(!how.slept && how.lit ? ['nightwatch'] : [])]);
}

/** Talk to an islander: they speak, a side quest may begin, and the talk is counted (which may finish a quest). */
export function talk(s: Session, npc: NpcId): Step {
  const def = NPCS[npc];
  const topic = pickTopic(def, s.quests, QUESTS);
  const fx: Fx[] = [{ t: 'dialog', speaker: def.name, lines: topic.lines }];
  let quests = s.quests;
  if (topic.start) {
    quests = startQuest(quests, QUESTS, topic.start);
    if (quests !== s.quests) fx.push({ t: 'quest', ev: { t: 'started', id: topic.start } });
  }
  const r = story({ ...s, quests }, [`talk:${npc}`]);
  return { session: r.session, fx: [...fx, ...r.fx] };
}

const found = (s: Session, id: string): Session => ({ ...s, quests: { ...s.quests, found: [...s.quests.found, id] } });
const numberOf = (spot: Spot): number => Number(spot.id.split(':')[1]) - 1;

/** Read a bottle or a tablet, or find the cat. Each find is used up once. */
export function inspect(s: Session, spot: Spot): Step {
  if (s.quests.found.includes(spot.id)) return { session: s, fx: [] };
  const text = spot.kind === 'bottle' ? BOTTLES[numberOf(spot)] : spot.kind === 'tablet' ? TABLETS[numberOf(spot)] : CAT_FOUND;
  const r = story(found(s, spot.id), [spot.kind]);
  return { session: r.session, fx: [{ t: 'dialog', speaker: null, lines: [text] }, ...r.fx] };
}

/** Dig up buried treasure with the shovel in hand. Nothing happens (and nothing is lost) if the loot does not fit. */
export function dig(s: Session, spot: Spot, stamina: number): Step {
  if (s.quests.found.includes(spot.id)) return { session: s, fx: [] };
  const given = giveItems(wearTool(s.inventory, s.selected), TREASURE_LOOT[numberOf(spot) + 1] ?? []);
  if (given.overflow) return { session: s, fx: [say('msgFull')] };
  const dug: Session = { ...found(s, spot.id), inventory: given.inv, vitals: spendStamina(s.vitals, stamina) ?? s.vitals };
  const r = story(dug, ['dig']);
  return { session: r.session, fx: [{ t: 'swing' }, say('msgDugUp'), ...given.fx, ...r.fx] };
}

/** Cast the line: now and then nothing bites, usually a fish, rarely a rare one. */
export function fish(s: Session, stamina: number): Step {
  const roll = new Rng(hashString(`${s.seed}:fish:${s.clock.day}:${Math.floor(s.playTime * 1000)}`)).float(0, 1);
  const tired = spendStamina(s.vitals, stamina) ?? s.vitals;
  if (roll < 0.15) return { session: { ...s, vitals: tired, inventory: wearTool(s.inventory, s.selected) }, fx: [{ t: 'swing' }, say('msgNothingBites')] };
  const rare = roll >= 0.85;
  const given = giveItems(wearTool(s.inventory, s.selected), [{ item: rare ? 'big_fish' : 'raw_fish', qty: 1 }]);
  if (given.overflow) return { session: s, fx: [say('msgFull')] };
  const r = story({ ...s, inventory: given.inv, vitals: tired }, rare ? ['fish', 'fish:big'] : ['fish']);
  return { session: r.session, fx: [{ t: 'swing' }, ...given.fx, ...r.fx] };
}

/** Use the raft: at the last chapter it asks how the story ends. */
export function useRaft(s: Session): Step {
  if (s.quests.ending) return { session: s, fx: [say('raftDone')] };
  return { session: s, fx: s.quests.active.c10?.step === 3 ? [{ t: 'ending' }] : [] };
}

/** End the story: sail home (A), or light the lighthouse again with the beacon core (B). */
export function chooseEnding(s: Session, which: 'A' | 'B'): Step {
  if (s.quests.ending || s.quests.active.c10?.step !== 3) return { session: s, fx: [] };
  let inventory = s.inventory;
  if (which === 'B') {
    const paid = removeItem(inventory, 'beacon_core', 1);
    if (!paid) return { session: s, fx: [say('endingNeedCore')] };
    inventory = paid;
  }
  const r = story({ ...s, inventory, quests: { ...s.quests, ending: which } }, ['ending']);
  return { session: r.session, fx: [...r.fx, { t: 'theEnd', which }] };
}
