import { describe, expect, it } from 'vitest';
import {
  bump, emptyQuests, parseQuests, progressOf, settle, startQuest, trackedQuest, type QuestDefs, type QuestState,
} from '@/sim/quests';
import { addItem, emptyInventory } from '@/sim/inventory';

const defs: QuestDefs = {
  one: { id: 'one', kind: 'main', title: 'q_one', auto: true, steps: [{ text: 's1', obj: { counter: 'craft:axe_wood', n: 1 } }, { text: 's2', obj: { have: 'wood', n: 5 } }] },
  two: { id: 'two', kind: 'main', title: 'q_two', auto: true, after: 'one', steps: [{ text: 's3', obj: { counter: 'night', n: 2 } }] },
  chore: {
    id: 'chore', kind: 'side', title: 'q_chore', giver: 'tali', reward: [{ item: 'bandage', qty: 2 }],
    steps: [{ text: 'c1', obj: { counter: 'kill:boar', n: 2 }, fresh: true }, { text: 'c2', obj: { counter: 'talk:tali', n: 1 }, fresh: true }],
  },
};
const bag = (n: number) => addItem(emptyInventory(), 'wood', n).inv;
const run = (q: QuestState, inv = emptyInventory()) => settle(q, inv, defs);

describe('starting', () => {
  it('begins the first main chapter by itself and keeps later ones waiting', () => {
    const r = run(emptyQuests());
    expect(Object.keys(r.q.active)).toEqual(['one']);
    expect(r.events).toEqual([{ t: 'started', id: 'one' }]);
    expect(r.q.active.two).toBeUndefined();
  });

  it('never starts a side quest by itself, only when asked, once, and not before its prerequisite', () => {
    expect(run(emptyQuests()).q.active.chore).toBeUndefined();
    const q = startQuest(emptyQuests(), defs, 'chore');
    expect(q.active.chore.step).toBe(0);
    expect(startQuest(q, defs, 'chore')).toBe(q);
    expect(startQuest(emptyQuests(), defs, 'nope')).toEqual(emptyQuests());
    expect(startQuest(emptyQuests(), defs, 'two').active.two).toBeUndefined();
  });
});

describe('progress', () => {
  it('moves through the steps of a chapter and on to the next chapter', () => {
    let q = run(emptyQuests()).q;
    expect(run(q).events).toEqual([]);
    q = run(bump(q, 'craft:axe_wood')).q;
    expect(q.active.one.step).toBe(1);
    const mid = run(q, bag(4));
    expect(mid.q.active.one.step).toBe(1);
    const done = run(q, bag(5));
    expect(done.events).toEqual([{ t: 'done', id: 'one', reward: [] }, { t: 'started', id: 'two' }]);
    expect(done.q.done).toEqual(['one']);
    expect(done.q.active.one).toBeUndefined();
    expect(Object.keys(done.q.active)).toEqual(['two']);
  });

  it('reports a step event for every step that is passed, even several at once', () => {
    const q = bump(run(emptyQuests()).q, 'craft:axe_wood');
    const r = run(q, bag(9));
    expect(r.events.map((e) => e.t)).toEqual(['step', 'done', 'started']);
  });

  it('counts only what happens after the step began when the step is fresh, and everything otherwise', () => {
    let q = bump(bump(emptyQuests(), 'kill:boar', 5), 'night', 1);
    q = startQuest(q, defs, 'chore');
    expect(progressOf(q, defs, 'chore', emptyInventory())).toEqual({ have: 0, need: 2 });
    q = run(q).q;
    q = run(bump(q, 'kill:boar', 2)).q;
    expect(q.active.chore.step).toBe(1);
    q = run(bump(q, 'craft:axe_wood'), bag(5)).q;
    expect(q.active.two.step).toBe(0);
    // The one night slept before the chapter began still counts: that step is not fresh.
    expect(progressOf(q, defs, 'two', bag(5))).toEqual({ have: 1, need: 2 });
  });

  it('hands the reward of a finished side quest over in its done event', () => {
    let q = run(startQuest(emptyQuests(), defs, 'chore')).q;
    q = run(bump(q, 'kill:boar', 2)).q;
    const r = run(bump(q, 'talk:tali'));
    expect(r.events).toContainEqual({ t: 'done', id: 'chore', reward: [{ item: 'bandage', qty: 2 }] });
    expect(r.q.done).toContain('chore');
    expect(startQuest(r.q, defs, 'chore')).toBe(r.q);
  });

  it('does not change the state it was given', () => {
    const q = Object.freeze(run(emptyQuests()).q);
    expect(() => run(bump(q, 'craft:axe_wood'), bag(9))).not.toThrow();
    expect(q.counters).toEqual({});
  });
});

describe('the tracked quest', () => {
  it('is the active main chapter, or else a side quest, or nothing', () => {
    expect(trackedQuest(emptyQuests(), defs)).toBeNull();
    const q = startQuest(run(emptyQuests()).q, defs, 'chore');
    expect(trackedQuest(q, defs)?.id).toBe('one');
    const side = startQuest(emptyQuests(), defs, 'chore');
    expect(trackedQuest(side, defs)?.id).toBe('chore');
  });
});

describe('parseQuests against hostile data', () => {
  it('ignores quest ids that are built-in object properties, and keeps the rest of the save', () => {
    const raw = JSON.parse('{"active":{"constructor":{"step":0,"base":{}},"__proto__":{"step":0},"toString":{"step":0},"one":{"step":0,"base":{}}},"done":["constructor","toString","two"],"counters":{"__proto__":5,"constructor":3,"night":1}}');
    const q = parseQuests(raw, defs);
    expect(Object.keys(q.active)).toEqual(['one']);
    expect(q.done).toEqual(['two']);
    expect(Object.keys(q.counters)).toEqual(['night']);
  });

  it('pays back only rewards that a quest can really give, and no more than it gives', () => {
    const q = parseQuests({ owed: [{ item: 'bandage', qty: 2 }, { item: 'bandage', qty: 50 }, { item: 'beacon_core', qty: 1 }, { item: 'lost_pickaxe', qty: 1 }, { item: 'nope', qty: 1 }] }, defs);
    expect(q.owed).toEqual([{ item: 'bandage', qty: 2 }, { item: 'lost_pickaxe', qty: 1 }]);
  });
});

describe('parseQuests', () => {
  it('gives an empty state for anything that is not a record', () => {
    for (const raw of [null, undefined, 5, 'x', [], true]) expect(parseQuests(raw, defs), String(raw)).toEqual(emptyQuests());
  });

  it('keeps what is sound and drops what is not', () => {
    const q = parseQuests({
      active: { one: { step: 1, base: { 'craft:axe_wood': 2, bad: 'x' } }, ghost: { step: 0, base: {} }, chore: { step: 9, base: {} } },
      done: ['two', 'two', 'ghost', 5],
      counters: { night: 3, 'kill:boar': -2, 'bad key!': 1, big: 1e12, frac: 1.5 },
      found: ['bottle:1', 'bottle:1', 7, 'x'.repeat(100)],
      ending: 'B',
    }, defs);
    expect(Object.keys(q.active)).toEqual(['one']);
    expect(q.active.one).toEqual({ step: 1, base: { 'craft:axe_wood': 2 } });
    expect(q.done).toEqual(['two']);
    expect(q.counters).toEqual({ night: 3 });
    expect(q.found).toEqual(['bottle:1']);
    expect(q.ending).toBe('B');
    expect(parseQuests({ ending: 'C' }, defs).ending).toBeNull();
  });

  it('does not let a quest be both done and active', () => {
    const q = parseQuests({ active: { one: { step: 0, base: {} } }, done: ['one'] }, defs);
    expect(q.active.one).toBeUndefined();
    expect(q.done).toEqual(['one']);
  });

  it('caps how many counters and found spots it will hold', () => {
    const counters = Object.fromEntries(Array.from({ length: 500 }, (_, i) => [`k${i}`, 1]));
    const found = Array.from({ length: 500 }, (_, i) => `s${i}`);
    const q = parseQuests({ counters, found }, defs);
    expect(Object.keys(q.counters).length).toBeLessThanOrEqual(120);
    expect(q.found.length).toBeLessThanOrEqual(120);
  });
});
