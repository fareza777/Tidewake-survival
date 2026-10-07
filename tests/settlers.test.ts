import { describe, expect, it } from 'vitest';
import { newSlot, parseSlot } from '@/core/saveData';
import { JOBS, JOB_DEFS, MAX_SETTLERS, STORE_CAP, hireCost } from '@/data/settlers';
import { ITEMS } from '@/data/items';
import { addItem, countItem } from '@/sim/inventory';
import { collectStore, hire, parseSettlers, parseStore, produceDay } from '@/sim/settlers';
import { sessionFromSlot, sessionToSlot, type Session } from '@/sim/session';

const slot = () => newSlot(0, 'Ari', 1234, 'normal', { x: 50, y: 50 }, { day: 1, t: 100 }, 1000);
const base = (over: Partial<Session> = {}): Session => ({ ...sessionFromSlot(slot()), ...over });
const rich = (n = 2000): Session => ({ ...base(), inventory: addItem(base().inventory, 'gold', n).inv });

describe('settlers', () => {
  it('every trade brings something real to the camp each day', () => {
    for (const job of JOBS) {
      const def = JOB_DEFS[job];
      expect(def.output.length, job).toBeGreaterThanOrEqual(3);
      for (const o of def.output) {
        expect(ITEMS[o.item], `${job} ${o.item}`).toBeDefined();
        expect(o.min, `${job} ${o.item}`).toBeLessThanOrEqual(o.max);
      }
    }
  });

  it('are hired for gold, each one dearer than the last, up to the size of the camp', () => {
    const s = rich(900);
    const first = hire(s, 'farmer');
    expect(first.session.settlers).toEqual(['farmer']);
    expect(countItem(first.session.inventory, 'gold')).toBe(900 - hireCost(0));
    const nearlyFull = { ...rich(900), settlers: JOBS.slice(0, MAX_SETTLERS - 1) as unknown as Session['settlers'] };
    const last = hire(nearlyFull, 'miner');
    expect(last.session.settlers).toHaveLength(MAX_SETTLERS);
    expect(hire(last.session, 'miner').session).toBe(last.session);
    expect(hireCost(1)).toBeGreaterThan(hireCost(0));
  });

  it('cannot be hired without the gold', () => {
    const s = base();
    const r = hire(s, 'cook');
    expect(r.session).toBe(s);
    expect(r.fx.map((f) => f.t === 'say' && f.key)).toEqual(['msgNoGold']);
  });

  it('work every day: the same day always brings the same goods, and a camp of none brings nothing', () => {
    const s = base({ settlers: ['woodcutter', 'miner', 'cook'] });
    const a = produceDay(s);
    expect(produceDay(s).store).toEqual(a.store);
    expect(Object.keys(a.store).length).toBeGreaterThan(0);
    expect(a.store.wood).toBeGreaterThanOrEqual(5);
    const next = produceDay({ ...a, clock: { ...a.clock, day: 2 } });
    expect(next.store.wood).toBeGreaterThan(a.store.wood);
    const alone = base();
    expect(produceDay(alone)).toBe(alone);
  });

  it('never keep more of one thing than the store holds', () => {
    let s = base({ settlers: ['woodcutter', 'woodcutter', 'woodcutter', 'woodcutter', 'woodcutter', 'woodcutter'], store: { wood: STORE_CAP - 3 } });
    for (let d = 1; d < 30; d++) s = produceDay({ ...s, clock: { ...s.clock, day: d } });
    expect(s.store.wood).toBe(STORE_CAP);
  });

  it('are collected into the backpack, and what does not fit stays', () => {
    const s = base({ store: { wood: 40, stone: 5 } });
    const r = collectStore(s);
    expect(countItem(r.session.inventory, 'wood')).toBe(40);
    expect(r.session.store).toEqual({});
    expect(r.fx[0]).toMatchObject({ t: 'say', key: 'msgCollected', vars: { n: 45 } });
    let full = base({ store: { wood: 40 } });
    for (let i = 0; i < 40; i++) full = { ...full, inventory: addItem(full.inventory, 'stone', 99).inv };
    expect(collectStore(full).session).toBe(full);
    expect(collectStore(base()).session.store).toEqual({});
  });

  it('are saved and loaded, and a damaged record loses only what is wrong with it', () => {
    const s = base({ settlers: ['hunter', 'farmer'], store: { wood: 9 } });
    const back = parseSlot(JSON.parse(JSON.stringify(sessionToSlot(slot(), s, { x: 1, y: 1 }))), 0)!;
    expect(back.settlers).toEqual(['hunter', 'farmer']);
    expect(back.store).toEqual({ wood: 9 });
    expect(parseSettlers(['farmer', 'wizard', 4, 'cook'])).toEqual(['farmer', 'cook']);
    expect(parseSettlers('nope')).toEqual([]);
    expect(parseStore({ wood: 5, nothing: 3, stone: -2, iron_ore: 1.5, coal: 99999 })).toEqual({ wood: 5, coal: STORE_CAP });
    expect(parseStore(null)).toEqual({});
  });
});
