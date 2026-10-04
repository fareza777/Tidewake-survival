import { describe, expect, it } from 'vitest';
import { newSlot } from '@/core/saveData';
import { QUESTS } from '@/data/quests';
import { BOTTLES, TABLETS } from '@/data/lore';
import { NPCS } from '@/data/npcs';
import { RECIPES } from '@/data/recipes';
import { INVENTORY_SIZE, addItem, countItem, emptyInventory } from '@/sim/inventory';
import { bump, settle, startQuest, type QuestState } from '@/sim/quests';
import {
  applyAction, chooseEnding, claimOwed, craftRecipe, dawn, reached, recordKill, sessionFromSlot, story, type Session,
} from '@/sim/session';
import { placeStructure } from '@/sim/structures';
import type { Spot } from '@/sim/world/spots';
import type { Action } from '@/sim/actions';
import type { Fx } from '@/sim/session';

type DialogFx = Extract<Fx, { t: 'dialog' }>;

const slot = () => newSlot(0, 'Ari', 1234, 'normal', { x: 50, y: 50 }, { day: 1, t: 100 }, 1000);
const base = (over: Partial<Session> = {}): Session => ({ ...sessionFromSlot(slot()), ...over });
const give = (s: Session, ...pairs: [Parameters<typeof addItem>[1], number][]): Session => ({
  ...s, inventory: pairs.reduce((inv, [item, n]) => addItem(inv, item, n).inv, s.inventory),
});
const withQuests = (s: Session, f: (q: QuestState) => QuestState): Session => ({ ...s, quests: settle(f(s.quests), s.inventory, QUESTS).q });
const afterChapters = (s: Session, n: number): Session => withQuests(s, (q) => ({ ...q, active: {}, done: Array.from({ length: n }, (_, i) => `c${i + 1}`) }));
const full = (s: Session): Session => ({ ...s, inventory: Array.from({ length: INVENTORY_SIZE }, () => ({ item: 'axe_wood' as const, qty: 1, dur: 40 })) });
const pos = { x: 50.5, y: 50.5 };
const fxOf = (r: { fx: { t: string }[] }) => r.fx.map((f) => f.t);

describe('a new game', () => {
  it('starts with the first chapter running', () => {
    expect(Object.keys(base().quests.active)).toEqual(['c1']);
  });
});

describe('story', () => {
  it('moves a chapter along when what it asks for happens, and says so', () => {
    const s = give(base(), ['wood', 5]);
    const r = story(s, ['craft:axe_wood']);
    expect(r.session.quests.active.c1.step).toBe(2);
    expect(r.fx.filter((f) => f.t === 'quest').map((f) => (f as { ev: { t: string } }).ev.t)).toEqual(['step', 'step']);
  });

  it('gives the very same session back when nothing changed', () => {
    const s = base();
    expect(story(s).session).toBe(s);
  });

  it('hands over a finished quest\'s reward, and keeps what does not fit until there is room', () => {
    let s = afterChapters(base(), 1);
    s = withQuests(s, (q) => startQuest(q, QUESTS, 'cat'));
    s = { ...s, quests: { ...s.quests, active: { ...s.quests.active, cat: { step: 1, base: {} } } } };
    const ok = story(s, ['talk:tali']);
    expect(countItem(ok.session.inventory, 'bandage')).toBe(3);
    expect(ok.session.quests.done).toContain('cat');
    expect(ok.session.quests.owed).toEqual([]);

    const tight = story(full(s), ['talk:tali']);
    expect(countItem(tight.session.inventory, 'bandage')).toBe(0);
    expect(tight.session.quests.owed).toEqual([{ item: 'bandage', qty: 3 }]);
    expect(tight.session.quests.done).toContain('cat');
    expect(fxOf(tight)).toContain('say');

    const later = claimOwed({ ...tight.session, inventory: emptyInventory() });
    expect(countItem(later.session.inventory, 'bandage')).toBe(3);
    expect(later.session.quests.owed).toEqual([]);
    expect(claimOwed(tight.session).session.quests.owed).toEqual([{ item: 'bandage', qty: 3 }]);
  });
});

describe('talking', () => {
  const talk = (s: Session, npc: Extract<Action, { kind: 'talk' }>['npc']) => applyAction(s, { kind: 'talk', npc }, pos);

  it('shows what the islander says, counts the talk, and begins the side quest they offer', () => {
    const s = afterChapters(base(), 1);
    const r = talk(s, 'tali');
    expect(fxOf(r)).toContain('dialog');
    const dialog = r.fx.find((f) => f.t === 'dialog') as DialogFx;
    expect(dialog.speaker).toEqual(NPCS.tali.name);
    expect(dialog.lines.length).toBeGreaterThan(0);
    expect(r.session.quests.active.cat).toBeDefined();
    expect(r.session.quests.counters['talk:tali']).toBe(1);
    expect(r.fx.some((f) => f.t === 'quest' && (f as { ev: { t: string; id: string } }).ev.id === 'cat')).toBe(true);
  });

  it('moves the main story on: talking to Marlo at the right chapter finishes it', () => {
    let s = afterChapters(base(), 2);
    s = { ...s, quests: { ...s.quests, counters: { ...s.quests.counters, 'reach:sailor': 1 } } };
    s = withQuests(s, (q) => q);
    expect(s.quests.active.c3.step).toBe(1);
    const r = talk(s, 'marlo');
    expect(r.session.quests.done).toContain('c3');
    expect(r.session.quests.active.c4).toBeDefined();
  });

  it('repeats nothing forever: the idle lines take turns', () => {
    const a = talk(base(), 'odo');
    const b = talk(a.session, 'odo');
    const lineOf = (r: ReturnType<typeof talk>) => JSON.stringify((r.fx.find((f) => f.t === 'dialog') as DialogFx).lines);
    expect(lineOf(a)).not.toBe(lineOf(b));
  });
});

describe('finds', () => {
  const bottle: Spot = { id: 'bottle:2', kind: 'bottle', x: 51, y: 50 };
  const tablet: Spot = { id: 'tablet:1', kind: 'tablet', x: 51, y: 50 };
  const cat: Spot = { id: 'cat', kind: 'cat', x: 51, y: 50 };
  const treasure: Spot = { id: 'treasure:1', kind: 'treasure', x: 51, y: 50 };

  it('reads a bottle or a tablet once, showing its words, and counts it', () => {
    const r = applyAction(base(), { kind: 'inspect', spot: bottle }, pos);
    expect(r.session.quests.found).toEqual(['bottle:2']);
    expect(r.session.quests.counters.bottle).toBe(1);
    expect((r.fx.find((f) => f.t === 'dialog') as DialogFx).lines).toEqual([BOTTLES[1]]);
    const t = applyAction(base(), { kind: 'inspect', spot: tablet }, pos);
    expect((t.fx.find((f) => f.t === 'dialog') as DialogFx).lines).toEqual([TABLETS[0]]);
    expect(t.session.quests.counters.tablet).toBe(1);
    expect(applyAction(r.session, { kind: 'inspect', spot: bottle }, pos).session).toBe(r.session);
  });

  it('finds the cat', () => {
    const r = applyAction(base(), { kind: 'inspect', spot: cat }, pos);
    expect(r.session.quests.counters.cat).toBe(1);
    expect(r.session.quests.found).toEqual(['cat']);
  });

  it('digs up treasure with a shovel: loot, wear on the shovel, once, and nothing is lost when the backpack is full', () => {
    const s = give(base(), ['shovel', 1]);
    const r = applyAction(s, { kind: 'dig', spot: treasure, stamina: 2 }, pos);
    expect(r.session.quests.found).toEqual(['treasure:1']);
    expect(r.session.quests.counters.dig).toBe(1);
    expect(r.session.inventory.reduce((n, x) => n + (x ? 1 : 0), 0)).toBeGreaterThan(1);
    expect(r.session.vitals.stamina).toBe(s.vitals.stamina - 2);
    expect(applyAction(r.session, { kind: 'dig', spot: treasure, stamina: 2 }, pos).session).toBe(r.session);
    const tight = applyAction(full(s), { kind: 'dig', spot: treasure, stamina: 2 }, pos);
    expect(tight.session.quests.found).toEqual([]);
    expect(fxOf(tight)).toEqual(['say']);
  });
});

describe('fishing', () => {
  it('catches fish, now and then a rare one, now and then nothing, and counts them', () => {
    const outcomes = new Set<string>();
    let big = 0;
    for (let i = 0; i < 80; i++) {
      const s = give({ ...base(), playTime: i * 1.3 }, ['fishing_rod', 1]);
      const r = applyAction(s, { kind: 'fish', x: 3, y: 3, stamina: 2 }, pos);
      const kinds = r.fx.filter((f) => f.t === 'gain').map((f) => (f as { item: string }).item);
      outcomes.add(kinds[0] ?? 'nothing');
      if (r.session.quests.counters['fish:big']) big++;
      expect(r.session.vitals.stamina).toBe(s.vitals.stamina - 2);
    }
    expect([...outcomes].sort()).toEqual(['big_fish', 'nothing', 'raw_fish']);
    expect(big).toBeGreaterThan(0);
  });

  it('leaves the line alone, and the rod unworn, when the backpack is full', () => {
    const s = full(give(base(), ['fishing_rod', 1]));
    const r = applyAction({ ...s, inventory: [...s.inventory.slice(0, INVENTORY_SIZE - 1), { item: 'fishing_rod', qty: 1, dur: 5 }], selected: 0 }, { kind: 'fish', x: 3, y: 3, stamina: 2 }, pos);
    expect(r.session.inventory.filter((x) => x?.item === 'raw_fish' || x?.item === 'big_fish')).toEqual([]);
  });
});

describe('counters from what the hero does', () => {
  it('counts a building he puts up, a cooked meal he eats, and a crop he harvests', () => {
    const placed = applyAction(give(base(), ['campfire', 1]), { kind: 'place', type: 'campfire', x: 52, y: 50 }, pos);
    expect(placed.session.quests.counters['build:campfire']).toBe(1);
    const eaten = applyAction(give({ ...base(), selected: 0 }, ['cooked_meat', 1]), { kind: 'eat', food: { hunger: 35, thirst: 0, hp: 4 } }, pos);
    expect(eaten.session.quests.counters['eat:cooked']).toBe(1);
    const raw = applyAction(give({ ...base(), selected: 0 }, ['raw_meat', 1]), { kind: 'eat', food: { hunger: 8, thirst: 0, hp: 0 } }, pos);
    expect(raw.session.quests.counters['eat:cooked']).toBeUndefined();
  });

  it('counts what he crafts, and a dish cooked at a campfire as a dish', () => {
    const recipe = RECIPES.find((r) => r.out === 'cooked_meat')!;
    const s = give(base(), ['raw_meat', 1]);
    const r = craftRecipe(s, recipe, new Set(['hand', 'campfire']));
    expect(r.session.quests.counters['craft:cooked_meat']).toBe(1);
    expect(r.session.quests.counters.cook).toBe(1);
    const axe = RECIPES.find((x) => x.out === 'axe_wood')!;
    const a = craftRecipe(give(base(), ['wood', 3], ['fiber', 2]), axe, new Set(['hand']));
    expect(a.session.quests.counters['craft:axe_wood']).toBe(1);
    expect(a.session.quests.counters.cook).toBeUndefined();
  });

  it('counts creatures killed, and a boss as a boss as well', () => {
    expect(recordKill(base(), 'boar').session.quests.counters['kill:boar']).toBe(1);
    const b = recordKill(base(), 'mossback').session.quests.counters;
    expect(b['kill:mossback']).toBe(1);
    expect(b['boss:mossback']).toBe(1);
  });

  it('counts landmarks reached once only', () => {
    const r = reached(base(), 'grotto');
    expect(r.session.quests.counters['reach:grotto']).toBe(1);
    expect(reached(r.session, 'grotto').session).toBe(r.session);
  });

  it('counts a night survived, and a night watched awake beside a light', () => {
    expect(dawn(base(), { slept: true, lit: true }).session.quests.counters).toEqual({ night: 1 });
    expect(dawn(base(), { slept: false, lit: true }).session.quests.counters).toEqual({ night: 1, nightwatch: 1 });
    expect(dawn(base(), { slept: false, lit: false }).session.quests.counters).toEqual({ night: 1 });
  });
});

describe('the raft and the ending', () => {
  const ready = () => {
    const s = afterChapters(give(base(), ['beacon_core', 1]), 9);
    return withQuests(s, (q) => ({ ...q, counters: { ...q.counters, 'craft:sailcloth': 1, 'craft:raft': 1, 'build:raft': 1 } }));
  };
  const raft = placeStructure({ next: 1, list: [] }, 'raft', 52, 50).list[0];

  it('opens the choice when the raft is used at the last chapter, and only then', () => {
    expect(ready().quests.active.c10.step).toBe(3);
    const r = applyAction(ready(), { kind: 'raft', structure: raft }, pos);
    expect(fxOf(r)).toEqual(['ending']);
    const early = applyAction(afterChapters(base(), 9), { kind: 'raft', structure: raft }, pos);
    expect(fxOf(early)).toEqual([]);
  });

  it('ends the story either way, and lighting the lighthouse takes the beacon core', () => {
    const a = chooseEnding(ready(), 'A');
    expect(a.session.quests.ending).toBe('A');
    expect(a.session.quests.done).toContain('c10');
    expect(fxOf(a)).toContain('theEnd');
    const b = chooseEnding(ready(), 'B');
    expect(b.session.quests.ending).toBe('B');
    expect(countItem(b.session.inventory, 'beacon_core')).toBe(0);
  });

  it('refuses to light the lighthouse without the core, and to choose twice', () => {
    const noCore = { ...ready(), inventory: emptyInventory() };
    const r = chooseEnding(noCore, 'B');
    expect(r.session).toBe(noCore);
    expect(fxOf(r)).toEqual(['say']);
    const done = chooseEnding(ready(), 'A').session;
    expect(chooseEnding(done, 'B').session).toBe(done);
    expect(fxOf(applyAction(done, { kind: 'raft', structure: raft }, pos))).toEqual(['say']);
  });
});

describe('quests that were already started', () => {
  it('keep their counters when a counter is bumped', () => {
    const q = bump(base().quests, 'x', 2);
    expect(q.counters.x).toBe(2);
  });
});
