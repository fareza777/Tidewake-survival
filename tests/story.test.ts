import { describe, expect, it } from 'vitest';
import { NPCS, NPC_IDS } from '@/data/npcs';
import { QUESTS } from '@/data/quests';
import { TABLETS, BOTTLES } from '@/data/lore';
import { pickTopic } from '@/sim/story';
import { bump, emptyQuests, settle, startQuest, type QuestState } from '@/sim/quests';
import { emptyInventory } from '@/sim/inventory';
import { npcAt, npcPlaces, spotAt, spotsOf, visibleSpots } from '@/sim/world/spots';
import { propSolidTiles, nodesByTile } from '@/sim/solids';
import { generateWorld } from '@/sim/world/generate';
import { T, idx, isWater } from '@/sim/world/types';

const q0 = () => settle(emptyQuests(), emptyInventory(), QUESTS).q;
const advanceTo = (id: string, step: number): QuestState => {
  let q: QuestState = q0();
  // Make the chapters before `id` done, and `id` stand at `step`.
  const order = Object.keys(QUESTS).filter((k) => QUESTS[k].kind === 'main');
  const upto = order.indexOf(id);
  q = { ...q, active: {}, done: order.slice(0, upto) };
  q = settle(q, emptyInventory(), QUESTS).q;
  const run = q.active[id];
  return { ...q, active: { ...q.active, [id]: { ...run, step } } };
};

describe('what an islander says', () => {
  it('falls back to idle talk when nothing applies', () => {
    expect(pickTopic(NPCS.odo, q0(), QUESTS).start).toBeUndefined();
    expect(NPCS.odo.idle).toContain(pickTopic(NPCS.odo, emptyQuests(), QUESTS).lines[0]);
  });

  it('offers a side quest once it is unlocked, and starts it with that talk', () => {
    const early = pickTopic(NPCS.tali, q0(), QUESTS);
    expect(early.start).toBeUndefined();
    const q = { ...q0(), done: ['c1'] };
    const t = pickTopic(NPCS.tali, q, QUESTS);
    expect(t.start).toBe('cat');
  });

  it('reminds the player while a quest runs and takes the hand-in when the last step is reached', () => {
    let q: QuestState = { ...q0(), done: ['c1', 'c2'] };
    q = startQuest(q, QUESTS, 'cat');
    const withBoars = startQuest(startQuest(startQuest(q, QUESTS, 'boars'), QUESTS, 'harvest'), QUESTS, 'cat');
    expect(pickTopic(NPCS.tali, withBoars, QUESTS).start).toBeUndefined();
    const handIn = { ...withBoars, active: { ...withBoars.active, cat: { ...withBoars.active.cat, step: 1 } } };
    const t = pickTopic(NPCS.tali, handIn, QUESTS);
    expect(t.lines[0]).toEqual(NPCS.tali.topics[0].lines[0]);
  });

  it('tells the main story at the right chapter and step', () => {
    const intro = pickTopic(NPCS.marlo, advanceTo('c3', 1), QUESTS);
    expect(JSON.stringify(intro.lines)).toContain('compass');
    const nia = pickTopic(NPCS.nia, advanceTo('c7', 1), QUESTS);
    expect(JSON.stringify(nia.lines)).toContain('antidote');
  });

  it('refers only to quests, items and NPCs that exist, and has text in both languages', () => {
    const checkText = (t: unknown) => {
      if (typeof t === 'string') return;
      const v = t as { en: string; id: string };
      expect(v.en.trim()).not.toBe('');
      expect(v.id.trim()).not.toBe('');
    };
    const quests = (c: unknown): string[] => {
      const x = c as Record<string, unknown>;
      if ('all' in x) return (x.all as unknown[]).flatMap(quests);
      return [String('quest' in x ? x.quest : x.at)];
    };
    for (const id of NPC_IDS) {
      const npc = NPCS[id];
      expect(npc.id).toBe(id);
      for (const line of npc.idle) checkText(line);
      for (const topic of npc.topics) {
        for (const line of topic.lines) checkText(line);
        for (const quest of quests(topic.when)) expect(QUESTS[quest], `${id}: quest ${quest}`).toBeDefined();
        if (topic.start) {
          expect(QUESTS[topic.start].giver, `${id} starts ${topic.start}`).toBe(id);
          expect(QUESTS[topic.start].kind).toBe('side');
        }
      }
    }
  });

  it('gives every side quest a giver who offers it, and every quest an on-screen text in both languages', () => {
    for (const def of Object.values(QUESTS)) {
      checkTextBoth(def.title);
      for (const s of def.steps) checkTextBoth(s.text);
      if (def.kind === 'side') {
        const giver = NPCS[def.giver as keyof typeof NPCS];
        expect(giver, def.id).toBeDefined();
        expect(giver.topics.some((t) => t.start === def.id), `${def.id} is offered`).toBe(true);
        const last = def.steps.length - 1;
        expect(giver.topics.some((t) => 'at' in t.when && t.when.at === def.id && t.when.step === last), `${def.id} has a hand-in`).toBe(true);
      }
    }
  });
});

function checkTextBoth(t: unknown): void {
  const v = t as { en: string; id: string };
  expect(v.en.trim()).not.toBe('');
  expect(v.id.trim()).not.toBe('');
}

describe('islanders and finds on the island', () => {
  const worlds = [11, 2024, 99999].map((s) => generateWorld(s));

  it('puts every islander on dry, walkable ground that is free of trees, scenery and each other, in the same place every time', () => {
    for (const w of worlds) {
      const places = npcPlaces(w);
      expect(places.map((p) => p.id).sort()).toEqual([...NPC_IDS].sort());
      const props = new Set(propSolidTiles(w));
      const nodes = nodesByTile(w);
      const seen = new Set<number>();
      for (const p of places) {
        const i = idx(p.x, p.y, w.size);
        expect(isWater(w.terrain[i]), `${p.id} in water`).toBe(false);
        expect(w.terrain[i]).not.toBe(T.DEEP);
        expect(props.has(i), `${p.id} on scenery`).toBe(false);
        expect(nodes.has(i), `${p.id} on a node`).toBe(false);
        expect(seen.has(i)).toBe(false);
        seen.add(i);
      }
      expect(npcPlaces(w)).toEqual(places);
    }
  });

  it('makes the right number of finds of each kind, all on land and clear of everything, once per world', () => {
    for (const w of worlds) {
      const spots = spotsOf(w);
      const count = (k: string) => spots.filter((s) => s.kind === k).length;
      expect([count('bottle'), count('tablet'), count('treasure'), count('cat')]).toEqual([BOTTLES.length, TABLETS.length, 3, 1]);
      expect(new Set(spots.map((s) => s.id)).size).toBe(spots.length);
      const taken = new Set([...propSolidTiles(w), ...nodesByTile(w).keys(), ...npcPlaces(w).map((p) => idx(p.x, p.y, w.size))]);
      const tiles = new Set<number>();
      for (const s of spots) {
        const i = idx(s.x, s.y, w.size);
        expect(isWater(w.terrain[i]), s.id).toBe(false);
        expect(taken.has(i), `${s.id} is blocked`).toBe(false);
        expect(tiles.has(i), `${s.id} shares a tile`).toBe(false);
        tiles.add(i);
      }
      expect(spotsOf(w)).toBe(spots);
    }
  });

  it('hides what is found, and finds the one in front of the hero or under his feet', () => {
    const w = worlds[0];
    const all = spotsOf(w);
    const first = all[0];
    expect(visibleSpots(all, { ...emptyQuests(), found: [first.id] })).not.toContainEqual(first);
    expect(visibleSpots(all, emptyQuests())).toHaveLength(all.length);
    expect(spotAt(all, { x: first.x, y: first.y }, { x: first.x - 1.5, y: first.y + 0.5 })).toEqual(first);
    expect(spotAt(all, { x: 0, y: 0 }, { x: first.x + 0.5, y: first.y + 0.5 })).toEqual(first);
    expect(spotAt(all, { x: first.x + 9, y: first.y }, { x: first.x + 9, y: first.y })).toBeNull();
  });

  it('finds the islander in front of the hero', () => {
    const w = worlds[0];
    const p = npcPlaces(w)[0];
    expect(npcAt(npcPlaces(w), p.x, p.y)).toBe(p.id);
    expect(npcAt(npcPlaces(w), p.x + 5, p.y + 5)).toBeNull();
  });
});

describe('counters', () => {
  it('count what was done (a sanity check of the helpers the story uses)', () => {
    expect(bump(emptyQuests(), 'dig').counters.dig).toBe(1);
  });
});
