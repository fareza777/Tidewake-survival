import { describe, expect, it } from 'vitest';
import { SAVE_VERSION, newSlot, parseSlot } from '@/core/saveData';
import { newClock } from '@/sim/daynight';
import { DUNGEON_VERSION } from '@/sim/dungeon/progress';
import { GENERATOR_VERSION } from '@/sim/world/generate';

const make = (slot = 0, name = 'Ari') => newSlot(slot, name, 4242, 'normal', { x: 77, y: 147 }, newClock(), 1000);

describe('newSlot', () => {
  it('starts a fresh game with full vitals, an empty backpack and the hero beside the start beach', () => {
    const s = make(1);
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.worldVersion).toBe(GENERATOR_VERSION);
    expect(s.player).toEqual({ x: 77.5, y: 147.5 });
    expect(s.respawn).toEqual(s.player);
    expect(s.respawn).not.toBe(s.player);
    expect(s.vitals).toEqual({ hp: 100, hunger: 100, thirst: 100, stamina: 100 });
    expect(s.inventory).toHaveLength(32);
    expect(s.inventory.every((slot) => slot === null)).toBe(true);
    expect(s.structures).toEqual({ next: 1, list: [] });
    expect(s.farm).toEqual({ plots: {} });
  });
});

describe('save format 3', () => {
  it('starts a new game on the island with nothing worn and no dungeon progress', () => {
    const s = make(0);
    expect(s.location).toBeNull();
    expect(s.equipment).toEqual({ armor: null, helm: null, boots: null, charm: null });
    expect(s.dungeons.grotto).toEqual({ opened: [], looted: [], solved: [], lit: [], boss: false });
  });

  it('records which dungeon generator the progress belongs to, and assumes the current one for saves that have none', () => {
    expect(make(0).dungeonVersion).toBe(DUNGEON_VERSION);
    const old = JSON.parse(JSON.stringify(make(1)));
    delete old.dungeonVersion;
    expect(parseSlot(old, 1)!.dungeonVersion).toBe(DUNGEON_VERSION);
    expect(parseSlot({ ...old, dungeonVersion: 0 }, 1)!.dungeonVersion).toBe(0);
    expect(parseSlot({ ...old, dungeonVersion: 'x' }, 1)!.dungeonVersion).toBe(DUNGEON_VERSION);
  });

  it('upgrades a version 2 save without losing anything', () => {
    const old = JSON.parse(JSON.stringify(make(2)));
    delete old.location;
    delete old.equipment;
    delete old.dungeons;
    old.version = 2;
    old.inventory[0] = { item: 'wood', qty: 7 };
    const up = parseSlot(old, 2)!;
    expect(up.version).toBe(SAVE_VERSION);
    expect(up.inventory[0]).toEqual({ item: 'wood', qty: 7 });
    expect(up.location).toBeNull();
    expect(up.equipment).toEqual({ armor: null, helm: null, boots: null, charm: null });
    expect(up.dungeons.ruin.boss).toBe(false);
  });

  it('keeps worn armour, a dungeon location and progress, and drops what is not real', () => {
    const raw = JSON.parse(JSON.stringify(make(0)));
    raw.location = 'deepmine';
    raw.equipment = { armor: 'armor_iron' };
    raw.dungeons = { deepmine: { opened: [1, 4], looted: [2], solved: [0], lit: [], boss: true } };
    const s = parseSlot(raw, 0)!;
    expect(s.location).toBe('deepmine');
    expect(s.equipment).toEqual({ armor: 'armor_iron', helm: null, boots: null, charm: null });
    expect(s.dungeons.deepmine).toEqual({ opened: [1, 4], looted: [2], solved: [0], lit: [], boss: true });
    expect(parseSlot({ ...raw, location: 'atlantis' }, 0)!.location).toBeNull();
    expect(parseSlot({ ...raw, equipment: { armor: 'wood' } }, 0)!.equipment).toEqual({ armor: null, helm: null, boots: null, charm: null });
  });
});

describe('parseSlot', () => {
  const valid = () => JSON.parse(JSON.stringify(make(0)));

  it('rejects non-objects and missing fields', () => {
    expect(parseSlot(null, 0)).toBeNull();
    expect(parseSlot('x', 0)).toBeNull();
    expect(parseSlot({}, 0)).toBeNull();
    expect(parseSlot({ ...valid(), seed: 'abc' }, 0)).toBeNull();
    expect(parseSlot({ ...valid(), player: { x: NaN, y: 1 } }, 0)).toBeNull();
    expect(parseSlot({ ...valid(), clock: { day: 0, t: 1 } }, 0)).toBeNull();
  });

  it('rejects a clock that cannot belong to a real save (a huge time of day would hang the game)', () => {
    expect(parseSlot({ ...valid(), clock: { day: 1, t: 1e300 } }, 0)).toBeNull();
    expect(parseSlot({ ...valid(), clock: { day: 1, t: 600 } }, 0)).toBeNull();
    expect(parseSlot({ ...valid(), clock: { day: 1e7, t: 10 } }, 0)).toBeNull();
    expect(parseSlot({ ...valid(), clock: { day: 3, t: 599.9 } }, 0)?.clock).toEqual({ day: 3, t: 599.9 });
  });

  it('rejects a save from a newer game version', () => {
    expect(parseSlot({ ...valid(), version: 99 }, 0)).toBeNull();
  });

  it('rejects saves whose version is not one this game understands', () => {
    for (const version of [0, -5, 6, 1.5, '2', null]) expect(parseSlot({ ...valid(), version }, 0), String(version)).toBeNull();
  });

  it('drops unreadable inventory slots instead of failing the whole save', () => {
    const raw = valid();
    raw.inventory[0] = { item: 'unobtainium', qty: 3 };
    raw.inventory[1] = { item: 'wood', qty: -4 };
    raw.inventory[2] = { item: 'wood', qty: 5000 };
    raw.inventory[3] = { item: 'axe_wood', qty: 7, dur: 9999 };
    raw.inventory[4] = { item: 'axe_wood', qty: 1, dur: 0 };
    raw.inventory[5] = { item: 'watering_can', qty: 1, dur: 0 };
    raw.inventory[6] = 'junk';
    const inv = parseSlot(raw, 0)!.inventory;
    expect(inv).toHaveLength(32);
    expect(inv[0]).toBeNull();
    expect(inv[1]).toBeNull();
    expect(inv[2]).toEqual({ item: 'wood', qty: 99 });
    expect(inv[3]).toEqual({ item: 'axe_wood', qty: 1, dur: 40 });
    expect(inv[4]).toBeNull();
    expect(inv[5]).toEqual({ item: 'watering_can', qty: 1, dur: 0 });
    expect(inv[6]).toBeNull();
  });

  it('clamps vitals and the hotbar selection', () => {
    const s = parseSlot({ ...valid(), vitals: { hp: 500, hunger: -3, thirst: 'x' }, selected: 99 }, 0)!;
    expect(s.vitals).toEqual({ hp: 100, hunger: 0, thirst: 100, stamina: 100 });
    expect(s.selected).toBe(0);
  });

  it('keeps only sound structures and farm plots', () => {
    const raw = valid();
    raw.structures = {
      next: 1,
      list: [
        { id: 4, type: 'chest', x: 3, y: 3, inv: [{ item: 'wood', qty: 2 }] },
        { id: 5, type: 'castle', x: 4, y: 4 },
        { id: 6, type: 'bed', x: -1, y: 4 },
        { id: 7, type: 'bed', x: 3, y: 3 },
        { id: 4, type: 'fence', x: 9, y: 9 },
        { id: 8, type: 'fence', x: 1.5, y: 9 },
      ],
    };
    raw.farm = { plots: { 10: { crop: 'carrot', growth: 99, watered: true }, 11: { crop: 'weeds', growth: 5 }, '-4': {}, abc: {} } };
    const s = parseSlot(raw, 0)!;
    expect(s.structures.list).toHaveLength(1);
    expect(s.structures.list[0]).toMatchObject({ id: 4, type: 'chest', x: 3, y: 3 });
    expect(s.structures.list[0].inv?.[0]).toEqual({ item: 'wood', qty: 2 });
    expect(s.structures.next).toBe(5);
    expect(s.farm.plots[10]).toEqual({ crop: 'carrot', growth: 3, watered: true });
    expect(s.farm.plots[11]).toEqual({ crop: null, growth: 0, watered: false });
    expect(Object.keys(s.farm.plots)).toEqual(['10', '11']);
  });

  it('upgrades a phase 1 save: loose materials become inventory items, the rest gets defaults', () => {
    const old = { version: 1, slot: 0, name: 'Ari', seed: 7, difficulty: 'normal', player: { x: 5, y: 6 }, clock: { day: 3, t: 10 }, gather: { hp: {}, gone: { 4: 1 } }, bag: { wood: 7, stone: 2, mystery: 4 } };
    const s = parseSlot(old, 1)!;
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.inventory[0]).toEqual({ item: 'wood', qty: 7 });
    expect(s.inventory[1]).toEqual({ item: 'stone', qty: 2 });
    expect(s.inventory.filter(Boolean)).toHaveLength(2);
    expect(s.vitals).toEqual({ hp: 100, hunger: 100, thirst: 100, stamina: 100 });
    expect(s.respawn).toEqual({ x: 5, y: 6 });
    expect(s.worldVersion).toBe(1);
    expect(s.gather.gone).toEqual({ 4: 1 });
    expect(s.structures).toEqual({ next: 1, list: [] });
  });

  it('fills defaults for missing optional fields and cleans the name', () => {
    const raw = valid();
    delete raw.inventory;
    delete raw.vitals;
    delete raw.gather;
    raw.name = '   ';
    raw.difficulty = 'impossible';
    const s = parseSlot(raw, 2)!;
    expect(s.inventory.every((slot) => slot === null)).toBe(true);
    expect(s.worldVersion).toBeGreaterThan(0);
    expect(s.gather).toEqual({ hp: {}, gone: {} });
    expect(s.name).toBe('Castaway');
    expect(s.difficulty).toBe('normal');
    expect(s.slot).toBe(2);
  });

  it('truncates very long names', () => {
    expect(parseSlot({ ...valid(), name: 'x'.repeat(100) }, 0)!.name).toHaveLength(16);
  });
});
