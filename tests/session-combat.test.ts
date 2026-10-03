import { describe, expect, it } from 'vitest';
import { newSlot } from '@/core/saveData';
import { ITEMS } from '@/data/items';
import { STAMINA_HAND } from '@/data/tools';
import type { Action } from '@/sim/actions';
import { addItem, countItem } from '@/sim/inventory';
import { meleeFor } from '@/sim/melee';
import { applyAction, hurtHero, sessionFromSlot, type Session } from '@/sim/session';

const slot = () => newSlot(0, 'Ari', 1234, 'normal', { x: 50, y: 50 }, { day: 1, t: 100 }, 1000);
const base = (over: Partial<Session> = {}): Session => ({ ...sessionFromSlot(slot()), ...over });
const give = (s: Session, ...pairs: [Parameters<typeof addItem>[1], number][]): Session => ({
  ...s, inventory: pairs.reduce((inv, [item, n]) => addItem(inv, item, n).inv, s.inventory),
});
const pos = { x: 50.5, y: 50.5 };
const fxTypes = (r: ReturnType<typeof applyAction>) => r.fx.map((f) => f.t);

describe('melee attacks', () => {
  const attack = (held: Parameters<typeof meleeFor>[0]): Action => ({ kind: 'attack', melee: meleeFor(held) });

  it('swings the weapon: stamina is spent, the weapon wears, and the scene is told to resolve the blow', () => {
    const s = give(base(), ['sword_stone', 1]);
    const r = applyAction(s, attack('sword_stone'), pos);
    expect(fxTypes(r)).toEqual(['swing', 'strike']);
    expect(r.fx[1]).toEqual({ t: 'strike', melee: meleeFor('sword_stone') });
    expect(r.session.vitals.stamina).toBe(100 - ITEMS.sword_stone.weapon!.stamina);
    expect(r.session.inventory[0]!.dur).toBe(ITEMS.sword_stone.tool!.durability - 1);
  });

  it('tells the player when a weapon breaks on the last swing', () => {
    let s = give(base(), ['sword_wood', 1]);
    s = { ...s, inventory: s.inventory.map((x, i) => (i === 0 ? { ...x!, dur: 1 } : x)) };
    const r = applyAction(s, attack('sword_wood'), pos);
    expect(r.session.inventory[0]).toBeNull();
    expect(r.fx.some((f) => f.t === 'say' && f.key === 'msgToolBroke')).toBe(true);
  });

  it('wears nothing when punching with fists or swinging a tool', () => {
    const fists = applyAction(base(), attack(null), pos);
    expect(fists.session.vitals.stamina).toBe(100 - STAMINA_HAND);
    expect(fists.session.inventory).toEqual(base().inventory);
    const s = give(base(), ['axe_stone', 1]);
    const axe = applyAction(s, attack('axe_stone'), pos);
    expect(axe.session.inventory[0]!.dur).toBe(ITEMS.axe_stone.tool!.durability);
  });
});

describe('shooting', () => {
  const bow = ITEMS.bow.weapon!;

  it('uses up one arrow, wears the bow, spends stamina and asks the scene to loose the arrow', () => {
    const s = give(base(), ['bow', 1], ['arrow', 6]);
    const r = applyAction(s, { kind: 'shoot', stats: bow }, pos);
    expect(fxTypes(r)).toEqual(['swing', 'shot']);
    expect(r.fx[1]).toEqual({ t: 'shot', stats: bow });
    expect(countItem(r.session.inventory, 'arrow')).toBe(5);
    expect(r.session.inventory[0]!.dur).toBe(ITEMS.bow.tool!.durability - 1);
    expect(r.session.vitals.stamina).toBe(100 - bow.stamina);
  });

  it('shoots nothing when the arrows ran out meanwhile', () => {
    const s = give(base(), ['bow', 1]);
    const r = applyAction(s, { kind: 'shoot', stats: bow }, pos);
    expect(r.session).toBe(s);
    expect(r.fx.map((f) => f.t === 'say' && f.key)).toEqual(['msgNoArrows']);
  });

  it('explains a blocked shot', () => {
    const r = applyAction(base(), { kind: 'blocked', reason: 'noArrows' }, pos);
    expect(r.fx).toEqual([{ t: 'say', key: 'msgNoArrows', vars: undefined, translate: undefined }]);
  });
});

describe('eating', () => {
  it('tells the scene the hero ate, so it can make the sound', () => {
    const r = applyAction(give(base(), ['cooked_meat', 1]), { kind: 'eat', food: ITEMS.cooked_meat.food! }, pos);
    expect(fxTypes(r)).toEqual(['ate']);
    expect(r.session.vitals.hunger).toBe(100);
  });
});

describe('hurtHero', () => {
  it('lowers hit points and nothing else, and never goes below zero', () => {
    const s = base();
    const hurt = hurtHero(s, 30);
    expect(hurt.vitals).toEqual({ ...s.vitals, hp: s.vitals.hp - 30 });
    expect(hurt.inventory).toBe(s.inventory);
    expect(hurtHero(s, 999).vitals.hp).toBe(0);
    expect(hurtHero(s, 0)).toBe(s);
  });
});
