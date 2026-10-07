import { describe, expect, it } from 'vitest';
import { newSlot } from '@/core/saveData';
import { generateDungeon } from '@/sim/dungeon/generate';
import { emptyProgress } from '@/sim/dungeon/progress';
import { lightCrystal } from '@/sim/dungeon/rules';
import { addItem, countItem } from '@/sim/inventory';
import { applyAction, sessionFromSlot, updateDungeon, type Session } from '@/sim/session';

const slot = () => newSlot(0, 'Ari', 1234, 'normal', { x: 50, y: 50 }, { day: 1, t: 100 }, 1000);
const base = (over: Partial<Session> = {}): Session => ({ ...sessionFromSlot(slot()), ...over });
const give = (s: Session, ...pairs: [Parameters<typeof addItem>[1], number][]): Session => ({
  ...s, inventory: pairs.reduce((inv, [item, n]) => addItem(inv, item, n).inv, s.inventory),
});
const pos = { x: 50.5, y: 50.5 };
const d = generateDungeon(1, 'grotto');
const free = d.chests.find((c) => !c.locked)!;
const locked = d.chests.find((c) => c.locked && c.loot.some((l) => l.item === 'boss_key'))!;
const bossDoor = d.doors.find((x) => x.lock === 'boss')!;
const fxTypes = (r: ReturnType<typeof applyAction>) => r.fx.map((f) => f.t);

describe('travelling', () => {
  it('moves the hero into a dungeon and back out, and tells the scene to change the level', () => {
    const inside = applyAction(base(), { kind: 'enter', dungeon: 'deepmine' }, pos);
    expect(inside.session.location).toBe('deepmine');
    expect(inside.fx).toEqual([{ t: 'travel', to: 'deepmine' }]);
    const out = applyAction(inside.session, { kind: 'leave' }, pos);
    expect(out.session.location).toBeNull();
    expect(out.fx).toEqual([{ t: 'travel', to: null }]);
  });
});

describe('opening a chest', () => {
  it('hands over the loot of a free chest, remembers it, and keeps the keys it gave', () => {
    const s = base({ location: 'grotto' });
    const r = applyAction(s, { kind: 'chest', chest: free }, pos);
    expect(countItem(r.session.inventory, 'small_key')).toBe(2);
    expect(r.session.dungeons.grotto.looted).toEqual([free.id]);
    expect(fxTypes(r)).toEqual(['chestOpened', 'gain', 'gain']);
    expect(s.dungeons.grotto.looted).toEqual([]);
  });

  it('spends one small key on a locked chest', () => {
    const s = give(base({ location: 'grotto' }), ['small_key', 2]);
    const r = applyAction(s, { kind: 'chest', chest: locked }, pos);
    expect(countItem(r.session.inventory, 'small_key')).toBe(1);
    expect(countItem(r.session.inventory, 'boss_key')).toBe(1);
    expect(r.session.dungeons.grotto.looted).toEqual([locked.id]);
  });

  it('keeps the key and the loot where they are when the backpack is full, and says so', () => {
    let s = give(base({ location: 'grotto' }), ['small_key', 1]);
    for (let i = 0; i < 40; i++) s = { ...s, inventory: addItem(s.inventory, 'wood', 99).inv };
    // The treasure holds four kinds of item; spending the key frees only one slot.
    const treasure = d.chests.find((c) => c.locked && c.loot.length === 4)!;
    const r = applyAction(s, { kind: 'chest', chest: treasure }, pos);
    expect(r.session).toBe(s);
    expect(r.fx.map((f) => f.t === 'say' && f.key)).toEqual(['msgFull']);
  });

  it('does nothing without the key it needs, or outside a dungeon', () => {
    const s = base({ location: 'grotto' });
    expect(applyAction(s, { kind: 'chest', chest: locked }, pos).session).toBe(s);
    const island = give(base(), ['small_key', 1]);
    expect(applyAction(island, { kind: 'chest', chest: locked }, pos).session).toBe(island);
  });

  it('turns a blocked key door into the right message', () => {
    expect(applyAction(base(), { kind: 'blocked', reason: 'needsKey' }, pos).fx.map((f) => f.t === 'say' && f.key)).toEqual(['msgNeedsKey']);
    expect(applyAction(base(), { kind: 'blocked', reason: 'needsBossKey' }, pos).fx.map((f) => f.t === 'say' && f.key)).toEqual(['msgNeedsBossKey']);
  });
});

describe('unlocking the boss door', () => {
  it('uses up the boss key and keeps the door open from then on', () => {
    const s = give(base({ location: 'grotto' }), ['boss_key', 1]);
    const r = applyAction(s, { kind: 'door', door: bossDoor }, pos);
    expect(countItem(r.session.inventory, 'boss_key')).toBe(0);
    expect(r.session.dungeons.grotto.opened).toEqual([bossDoor.id]);
    expect(r.fx).toEqual([{ t: 'doorOpened', id: bossDoor.id }]);
  });

  it('does nothing without the key', () => {
    const s = base({ location: 'grotto' });
    expect(applyAction(s, { kind: 'door', door: bossDoor }, pos).session).toBe(s);
  });
});

describe('updateDungeon', () => {
  it('changes the progress of the dungeon the hero is in, and nothing when he is on the island or nothing changed', () => {
    const inside = base({ location: 'ruin' });
    const lit = updateDungeon(inside, (p) => lightCrystal(p, 2));
    expect(lit.dungeons.ruin.lit).toEqual([2]);
    expect(lit.dungeons.grotto).toBe(inside.dungeons.grotto);
    expect(updateDungeon(inside, (p) => p)).toBe(inside);
    expect(updateDungeon(base(), (p) => lightCrystal(p, 2))).toEqual(base());
    expect(emptyProgress().lit).toEqual([]);
  });
});
