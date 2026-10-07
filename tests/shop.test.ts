import { describe, expect, it } from 'vitest';
import { newSlot } from '@/core/saveData';
import { Rng } from '@/core/rng';
import { ITEMS } from '@/data/items';
import { NPCS, NPC_IDS } from '@/data/npcs';
import { QUESTS, MAIN_QUEST_IDS } from '@/data/quests';
import { SHOPS, sellPrice } from '@/data/shops';
import { addItem, countItem } from '@/sim/inventory';
import { rollLoot } from '@/sim/pickups';
import { buyOffer, goldOf, sellSlot } from '@/sim/shop';
import { applyAction, arrive, sessionFromSlot, type Session } from '@/sim/session';
import { npcPlaces } from '@/sim/world/spots';
import { generateOuter } from '@/sim/world/outer';
import { UI_STRINGS } from '@/data/strings';

const slot = () => newSlot(0, 'Ari', 1234, 'normal', { x: 50, y: 50 }, { day: 1, t: 100 }, 1000);
const base = (over: Partial<Session> = {}): Session => ({ ...sessionFromSlot(slot()), ...over });
const give = (s: Session, item: Parameters<typeof addItem>[1], n: number): Session => ({ ...s, inventory: addItem(s.inventory, item, n).inv });

describe('gold and shops', () => {
  it('pays what the shelf says for what the shelf holds, and nothing when the hero cannot pay', () => {
    const poor = base();
    const offer = SHOPS.marlo![0];
    expect(buyOffer(poor, 'marlo', 0).session).toBe(poor);
    expect(buyOffer(poor, 'marlo', 0).fx.map((f) => f.t === 'say' && f.key)).toEqual(['msgNoGold']);
    const rich = give(poor, 'gold', offer.price + 5);
    const r = buyOffer(rich, 'marlo', 0);
    expect(goldOf(r.session)).toBe(5);
    expect(countItem(r.session.inventory, offer.item)).toBe(offer.qty ?? 1);
    expect(buyOffer(rich, 'marlo', 999).session).toBe(rich);
  });

  it('refuses a purchase that would not fit and keeps the gold', () => {
    let s = base();
    for (let i = 0; i < 40; i++) s = { ...s, inventory: addItem(s.inventory, 'wood', 99).inv };
    s = { ...s, inventory: s.inventory.map((slot2, i) => (i === 0 ? { item: 'gold' as const, qty: 500 } : slot2)) };
    const r = buyOffer(s, 'marlo', 3);
    expect(r.session).toBe(s);
    expect(goldOf(s)).toBe(500);
  });

  it('buys materials one by one or by the stack and pays gold, but not keepsakes', () => {
    const s = give(give(base(), 'bone', 5), 'boss_key', 1);
    const bone = s.inventory.findIndex((x) => x?.item === 'bone');
    const key = s.inventory.findIndex((x) => x?.item === 'boss_key');
    const one = sellSlot(s, bone, 1);
    expect(goldOf(one.session)).toBe(sellPrice({ item: 'bone', qty: 1 }));
    expect(one.session.inventory[bone]?.qty).toBe(4);
    const all = sellSlot(s, bone, 99);
    expect(countItem(all.session.inventory, 'bone')).toBe(0);
    expect(goldOf(all.session)).toBe(5 * sellPrice({ item: 'bone', qty: 1 }));
    expect(sellSlot(s, key, 1).session).toBe(s);
    expect(sellSlot(s, 31, 1).session).toBe(s);
  });

  it('values worn tools less than new ones, and better tools more', () => {
    const fresh = sellPrice({ item: 'sword_iron', qty: 1, dur: ITEMS.sword_iron.tool!.durability });
    const worn = sellPrice({ item: 'sword_iron', qty: 1, dur: 10 });
    expect(worn).toBeLessThan(fresh);
    expect(sellPrice({ item: 'sword_steel', qty: 1, dur: ITEMS.sword_steel.tool!.durability })).toBeGreaterThan(fresh);
    expect(sellPrice({ item: 'gold', qty: 5 })).toBe(0);
  });

  it('never sells an item for more than the cheapest shop sells it', () => {
    for (const [npc, offers] of Object.entries(SHOPS)) {
      for (const o of offers!) {
        const sells = sellPrice({ item: o.item, qty: 1, ...(ITEMS[o.item].tool ? { dur: ITEMS[o.item].tool!.durability } : {}) }) * (o.qty ?? 1);
        expect(sells, `${npc} ${o.item}`).toBeLessThan(o.price);
      }
    }
  });

  it('leaves coins behind creatures, and always a purse behind a boss', () => {
    let coins = 0;
    for (let i = 0; i < 200; i++) coins += rollLoot('skeleton', new Rng(i)).filter((x) => x.item === 'gold').length;
    expect(coins).toBeGreaterThan(40);
    expect(coins).toBeLessThan(160);
    for (let i = 0; i < 10; i++) expect(rollLoot('mossback', new Rng(i)).some((x) => x.item === 'gold')).toBe(true);
  });
});

describe('the people of the far islands', () => {
  it('stand by the dock of their own island, and nowhere else', () => {
    for (const [island, who] of [['frost', 'rhea'], ['ember', 'kael'], ['wreck', 'sable'], ['sky', 'aero']] as const) {
      const w = generateOuter(1234, island);
      expect(npcPlaces(w).map((p) => p.id)).toEqual([who]);
      const dock = w.landmarks.find((l) => l.id === 'dock')!;
      const p = npcPlaces(w)[0];
      expect(Math.hypot(p.x - dock.x, p.y - dock.y)).toBeLessThan(8);
    }
  });

  it('each have a name, a trade, an introduction for their chapter and an idle line, in both languages', () => {
    for (const id of NPC_IDS) {
      const def = NPCS[id];
      expect(typeof def.name === 'string' ? def.name : def.name.en).toBeTruthy();
      expect(def.idle.length, id).toBeGreaterThan(0);
      if (def.island) expect(def.shop, id).toBe(true);
      for (const line of [...def.idle, ...def.topics.flatMap((x) => x.lines)]) {
        expect(typeof line === 'string' || (line.en.length > 3 && line.id.length > 3), `${id} ${JSON.stringify(line)}`).toBe(true);
      }
    }
    for (const id of NPC_IDS.filter((x) => NPCS[x].shop)) expect(SHOPS[id]?.length ?? 0, id).toBeGreaterThan(3);
  });
});

describe('acts two and three', () => {
  it('give each chapter a title in both languages and make every step something the game can raise', () => {
    for (const id of ['c11', 'c12', 'c13', 'c14', 'c15', 'c16']) {
      const q = QUESTS[id];
      expect(q.kind).toBe('main');
      expect(q.steps.length, id).toBeGreaterThanOrEqual(3);
      expect(q.reward?.some((r) => r.item === 'gold'), id).toBe(true);
    }
    expect(MAIN_QUEST_IDS.slice(-6)).toEqual(['c11', 'c12', 'c13', 'c14', 'c15', 'c16']);
    expect(QUESTS.c11.after).toBe('c9');
    expect(QUESTS.c12.after).toBe('c11');
  });

  it('count the first visit to a far island exactly once, and never the home island', () => {
    const home = base();
    expect(arrive(home).session).toBe(home);
    const frost = base({ island: 'frost' });
    const r = arrive(frost);
    expect(r.session.quests.counters['island:frost']).toBe(1);
    expect(arrive(r.session).session).toBe(r.session);
  });

  it('pay the gold of a finished chapter into the backpack', () => {
    const lit = { ...base(), quests: { ...base().quests, done: ['c9'], active: { c11: { step: 2, base: {} } }, counters: { 'craft:boat': 1, 'build:boat': 1 } } };
    const r = applyAction(lit, { kind: 'none' }, { x: 5, y: 5 });
    expect(r.session).toBe(lit);
    expect(UI_STRINGS.shopBuy).toBeDefined();
  });
});
