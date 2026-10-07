import { describe, expect, it } from 'vitest';
import { newSlot, parseSlot } from '@/core/saveData';
import { Rng } from '@/core/rng';
import { ITEMS } from '@/data/items';
import { addItem, countItem } from '@/sim/inventory';
import { bump } from '@/sim/quests';
import { applyAction, sessionFromSlot, type Session } from '@/sim/session';
import { canBeginNewGamePlus, newGamePlus } from '@/sim/newGamePlus';
import { ngScale } from '@/sim/ngScale';
import { enemyDamage } from '@/sim/combat';

const slot = () => newSlot(0, 'Ari', 1234, 'normal', { x: 50, y: 50 }, { day: 40, t: 100 }, 1000);
const base = (over: Partial<Session> = {}): Session => ({ ...sessionFromSlot(slot()), ...over });

describe('New Game+', () => {
  it('opens only once the story is over', () => {
    expect(canBeginNewGamePlus(base())).toBe(false);
    expect(canBeginNewGamePlus(base({ quests: { ...base().quests, ending: 'A' } }))).toBe(true);
    expect(canBeginNewGamePlus(base({ quests: { ...base().quests, done: ['c16'] } }))).toBe(true);
  });

  it('makes creatures hit harder and take blows less, a little more each round', () => {
    expect(ngScale(0)).toBe(1);
    expect(ngScale(2)).toBeGreaterThan(ngScale(1));
    const one = applyAction(base({ ng: 1 }), { kind: 'attack', melee: { damage: 10, reach: 1, arc: 1, cooldown: 0.5, stamina: 1, knockback: 1, wear: false } as never }, { x: 5, y: 5 });
    const strike = one.fx.find((f) => f.t === 'strike');
    expect(strike && strike.t === 'strike' ? strike.melee.damage : 0).toBeLessThan(10);
    expect(enemyDamage(10 * ngScale(2), 'normal', 0)).toBeGreaterThan(enemyDamage(10, 'normal', 0));
  });

  it('starts a new island and a new story but keeps skills, gear, gold and the camp, and drops keys and sigils', () => {
    let s = base({ skills: { woodcutting: 900, mining: 5, combat: 1200, farming: 0, cooking: 0, crafting: 40 }, equipment: { armor: 'armor_iron', helm: null, boots: null, charm: null }, settlers: ['farmer'], store: { wood: 4 } });
    s = { ...s, inventory: ['sword_steel', 'gold', 'boss_key', 'frost_sigil', 'wood'].reduce((inv, item) => addItem(inv, item as 'wood', item === 'gold' ? 300 : 1).inv, s.inventory) };
    s = { ...s, quests: bump(bump({ ...s.quests, done: ['c16'], ending: 'A' }, 'kill:slime', 7), 'ach:first_blood') };
    const next = newGamePlus(s, slot(), 2, 777, 5);
    expect(next.slot).toBe(2);
    expect(next.seed).toBe(777);
    expect(next.ng).toBe(1);
    expect(next.skills).toEqual(s.skills);
    expect(next.equipment.armor).toBe('armor_iron');
    expect(next.settlers).toEqual(['farmer']);
    expect(next.store).toEqual({ wood: 4 });
    expect(next.quests.done).toEqual([]);
    expect(next.quests.ending).toBeNull();
    expect(next.quests.counters).toEqual({ 'kill:slime': 7, 'ach:first_blood': 1 });
    expect(next.clock.day).toBe(1);
    expect(countItem(next.inventory, 'gold')).toBe(300);
    expect(countItem(next.inventory, 'sword_steel')).toBe(1);
    expect(countItem(next.inventory, 'boss_key')).toBe(0);
    expect(countItem(next.inventory, 'frost_sigil')).toBe(0);
    expect(next.inventory.length).toBe(s.inventory.length);
    expect(next.island).toBe('home');
    expect(next.stash).toEqual({});
    expect(parseSlot(JSON.parse(JSON.stringify(next)), 2)!.ng).toBe(1);
    for (const item of next.inventory.flatMap((x) => (x ? [x.item] : []))) expect(item === 'gold' || !ITEMS[item].keep).toBe(true);
  });

  it('counts further rounds, and a seed from the clock is a whole number', () => {
    const second = newGamePlus(base({ ng: 1 }), slot(), 0, Rng.seedFromTime(), 5);
    expect(second.ng).toBe(2);
    expect(Number.isInteger(second.seed)).toBe(true);
  });
});
