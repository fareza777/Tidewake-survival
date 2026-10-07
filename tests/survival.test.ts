import { describe, expect, it } from 'vitest';
import { newSlot } from '@/core/saveData';
import { Rng } from '@/core/rng';
import { CREATURES, isHostileKind } from '@/data/creatures';
import { ITEMS } from '@/data/items';
import { addBuff, applyBuffs, hasBuff, parseBuffs, pruneBuffs, removeBuff } from '@/sim/buffs';
import { climateAt } from '@/sim/climate';
import { DAY_SECONDS } from '@/sim/daynight';
import { emptyEncounters, tickEncounters, type TickContext } from '@/sim/encounters';
import { addItem } from '@/sim/inventory';
import { neutralMods } from '@/sim/mods';
import { campSize, raidFor, spawnRaid } from '@/sim/raids';
import { applyAction, markRaid, rollDay, sessionFromSlot, tickSession, turretFired, type Session } from '@/sim/session';
import { emptyStructures, placeStructure } from '@/sim/structures';
import { fullVitals, tickVitals, VITAL_MAX } from '@/sim/vitals';
import { DAYS_PER_SEASON, SEASONS, WEATHERS, coldOf, dayOfSeason, isWet, seasonOf, weatherAt } from '@/sim/weather';
import { B, T, idx, type World } from '@/sim/world/types';

const slot = () => newSlot(0, 'Ari', 1234, 'normal', { x: 50, y: 50 }, { day: 1, t: 100 }, 1000);
const base = (over: Partial<Session> = {}): Session => ({ ...sessionFromSlot(slot()), ...over });

describe('seasons and weather', () => {
  it('turn every eight days, starting with spring, and loop after a year', () => {
    expect(seasonOf(1)).toBe('spring');
    expect(seasonOf(DAYS_PER_SEASON)).toBe('spring');
    expect(seasonOf(DAYS_PER_SEASON + 1)).toBe('summer');
    expect(seasonOf(DAYS_PER_SEASON * 3 + 1)).toBe('winter');
    expect(seasonOf(DAYS_PER_SEASON * 4 + 1)).toBe('spring');
    expect(dayOfSeason(1)).toBe(1);
    expect(dayOfSeason(DAYS_PER_SEASON)).toBe(DAYS_PER_SEASON);
    expect(dayOfSeason(DAYS_PER_SEASON + 1)).toBe(1);
  });

  it('is the same for the same seed and moment, and varies over a year', () => {
    for (let d = 1; d < 40; d++) expect(weatherAt(7, d, 120)).toBe(weatherAt(7, d, 120));
    const seen = new Set<string>();
    for (let d = 1; d <= 64; d++) for (const t of [10, 250, 450]) seen.add(weatherAt(99, d, t));
    expect(seen.size).toBeGreaterThanOrEqual(4);
    for (const w of seen) expect(WEATHERS as readonly string[]).toContain(w);
  });

  it('brings snow only in winter and never rain then', () => {
    for (let d = 1; d <= 128; d++) {
      const w = weatherAt(5, d, 100);
      if (seasonOf(d) === 'winter') expect(w).not.toBe('rain');
      else expect(w).not.toBe('snow');
    }
  });

  it('makes winter nights on a mountain far colder than a summer noon', () => {
    const hard = coldOf('winter', 'snow', true, B.MOUNTAIN);
    const easy = coldOf('summer', 'clear', false, B.FOREST);
    expect(hard).toBeGreaterThan(2);
    expect(easy).toBeLessThan(0);
    expect(coldOf('winter', 'snow', true, B.FOREST, true)).toBeLessThan(coldOf('winter', 'snow', true, B.FOREST, false));
    expect(isWet('rain')).toBe(true);
    expect(isWet('clear')).toBe(false);
  });
});

describe('warmth', () => {
  const ctx = { difficulty: 'normal', biome: B.FOREST, busy: false } as const;

  it('falls in the cold, faster the colder it is, and a fire builds it up again', () => {
    const mild = tickVitals(fullVitals(), 10, { ...ctx, cold: 0.5 }).warmth;
    const bitter = tickVitals(fullVitals(), 10, { ...ctx, cold: 2 }).warmth;
    expect(mild).toBeLessThan(VITAL_MAX);
    expect(bitter).toBeLessThan(mild);
    const cold = { ...fullVitals(), warmth: 30 };
    expect(tickVitals(cold, 2, { ...ctx, cold: 2, heated: true }).warmth).toBeGreaterThan(30);
    expect(tickVitals(cold, 2, { ...ctx, cold: -0.5 }).warmth).toBeGreaterThan(30);
  });

  it('is kept by warm clothes and softened by shelter', () => {
    const bare = tickVitals(fullVitals(), 20, { ...ctx, cold: 1.5 }).warmth;
    const dressed = tickVitals(fullVitals(), 20, { ...ctx, cold: 1.5, protect: 60 }).warmth;
    const covered = tickVitals(fullVitals(), 20, { ...ctx, cold: 1.5, sheltered: true }).warmth;
    expect(dressed).toBeGreaterThan(bare);
    expect(covered).toBeGreaterThan(bare);
  });

  it('hurts once it is gone, and not before', () => {
    const frozen = { ...fullVitals(), warmth: 0 };
    expect(tickVitals(frozen, 5, { ...ctx, cold: 1 }).hp).toBeLessThan(VITAL_MAX);
    expect(tickVitals({ ...fullVitals(), warmth: 5 }, 0.5, { ...ctx, cold: 1 }).hp).toBe(VITAL_MAX);
  });

  it('is felt by the session out in the open, near a fire it is not, and never in a dungeon', () => {
    const winter = { day: DAYS_PER_SEASON * 3 + 2, t: DAY_SECONDS * 0.85 };
    const open = tickSession(base({ clock: winter }), 30, B.MOUNTAIN, false, false, { x: 40, y: 40 });
    expect(open.vitals.warmth).toBeLessThan(VITAL_MAX);
    const fire = placeStructure(emptyStructures(), 'campfire', 41, 40);
    const warm = tickSession(base({ clock: winter, structures: fire, vitals: { ...fullVitals(), warmth: 50 } }), 5, B.MOUNTAIN, false, false, { x: 41.5, y: 41.5 });
    expect(warm.vitals.warmth).toBeGreaterThan(50);
    const indoors = tickSession(base({ clock: winter, location: 'grotto' }), 30, B.MOUNTAIN, false, false, { x: 40, y: 40 });
    expect(indoors.vitals.warmth).toBe(VITAL_MAX);
    const noPos = tickSession(base({ clock: winter }), 30, B.MOUNTAIN, false);
    expect(noPos.vitals.warmth).toBe(VITAL_MAX);
  });

  it('reads climate: a bed shelters, a campfire heats', () => {
    const s = placeStructure(placeStructure(emptyStructures(), 'bed', 30, 30), 'campfire', 33, 30);
    const c = climateAt(1, { day: 1, t: 100 }, s, { x: 31.5, y: 30.5 }, B.FOREST);
    expect(c.sheltered).toBe(true);
    expect(c.heated).toBe(true);
    expect(climateAt(1, { day: 1, t: 100 }, s, { x: 10, y: 10 }, B.FOREST)).toMatchObject({ sheltered: false, heated: false });
  });
});

describe('lasting effects', () => {
  it('start, last longer when taken again, and wear off', () => {
    let b = addBuff([], 'swift', 100, 10);
    expect(b).toEqual([{ id: 'swift', until: 110 }]);
    b = addBuff(b, 'swift', 20, 10);
    expect(b[0].until).toBe(110);
    b = addBuff(b, 'swift', 300, 10);
    expect(b[0].until).toBe(310);
    expect(pruneBuffs(b, 200)).toBe(b);
    expect(pruneBuffs(b, 400)).toEqual([]);
    expect(removeBuff(b, 'warm')).toBe(b);
    expect(hasBuff(removeBuff(b, 'swift'), 'swift')).toBe(false);
  });

  it('change the numbers: strength hits harder, a ward takes blows, poison drains', () => {
    const strong = applyBuffs(neutralMods(), [{ id: 'strong', until: 99 }]);
    expect(strong.meleeDamage).toBeGreaterThan(1);
    expect(applyBuffs(neutralMods(), [{ id: 'fortified', until: 99 }]).defense).toBe(3);
    expect(applyBuffs(neutralMods(), [{ id: 'poisoned', until: 99 }]).hpDrain).toBeGreaterThan(0);
    expect(applyBuffs(neutralMods(), [{ id: 'warm', until: 99 }]).warmth).toBeGreaterThan(0);
  });

  it('are read safely from a save', () => {
    expect(parseBuffs([{ id: 'swift', until: 50 }, { id: 'nonsense', until: 5 }, { id: 'warm', until: -3 }, null, { id: 'swift', until: 70 }])).toEqual([{ id: 'swift', until: 50 }]);
    expect(parseBuffs('x')).toEqual([]);
  });

  it('come from food and potions, and a stew warms as well as feeds', () => {
    const eatItem = (item: 'veggie_stew' | 'potion_strength' | 'antidote' | 'raw_meat', over: Partial<Session> = {}) => {
      let s = base({ vitals: { hp: 50, hunger: 20, thirst: 20, stamina: 50, warmth: 20 }, ...over });
      s = { ...s, inventory: addItem(s.inventory, item, 1).inv };
      return applyAction(s, { kind: 'eat', food: ITEMS[item].food! }, { x: 1, y: 1 }).session;
    };
    const stew = eatItem('veggie_stew');
    expect(hasBuff(stew.buffs, 'wellfed')).toBe(true);
    expect(stew.vitals.warmth).toBeGreaterThan(20);
    expect(hasBuff(eatItem('potion_strength').buffs, 'strong')).toBe(true);
    const sick = eatItem('antidote', { buffs: [{ id: 'poisoned', until: 9999 }] });
    expect(hasBuff(sick.buffs, 'poisoned')).toBe(false);
  });

  it('are expired by the clock', () => {
    const s = base({ buffs: [{ id: 'swift', until: 5 }], playTime: 4.9 });
    expect(tickSession(s, 0.5, B.FOREST, false).buffs).toEqual([]);
  });
});

describe('the fields', () => {
  it('are watered by rain, and rest in winter', () => {
    const farm = { plots: { 5: { crop: 'carrot' as const, growth: 0, watered: false } } };
    let rainy = 0;
    for (let d = 1; d < 60 && !rainy; d++) if (isWet(weatherAt(1234, d, 0)) && seasonOf(d) !== 'winter') rainy = d;
    expect(rainy).toBeGreaterThan(0);
    const wet = rollDay(base({ farm, clock: { day: rainy, t: 0 } }), () => false);
    expect(wet.farm.plots[5].growth).toBe(1);
    const winterDay = DAYS_PER_SEASON * 3 + 2;
    const frost = rollDay(base({ farm: { plots: { 5: { ...farm.plots[5], watered: true } } }, clock: { day: winterDay, t: 0 } }), () => false);
    expect(frost.farm.plots[5].growth).toBe(0);
    expect(frost.farm.plots[5].watered).toBe(false);
  });
});

describe('raids', () => {
  const camp = (n: number) => {
    let s = emptyStructures();
    for (let i = 0; i < n; i++) s = placeStructure(s, 'bed', 20 + i, 20);
    return s;
  };

  it('never come for a small camp or in the first days', () => {
    expect(campSize(emptyStructures())).toBe(0);
    for (let d = 1; d < 40; d++) expect(raidFor(1, d, 'normal', 2, B.FOREST)).toBeNull();
    for (let d = 1; d < 3; d++) expect(raidFor(1, d, 'normal', 40, B.FOREST)).toBeNull();
    expect(campSize(camp(3))).toBeGreaterThanOrEqual(6);
  });

  it('are the same for the same seed and day, never two nights running, and bigger for a bigger camp', () => {
    let nights = 0;
    let streak = false;
    let prevRaid = false;
    let small = 0;
    let large = 0;
    for (let d = 3; d < 120; d++) {
      const raid = raidFor(42, d, 'normal', 20, B.FOREST);
      expect(raidFor(42, d, 'normal', 20, B.FOREST)).toEqual(raid);
      if (raid && prevRaid) streak = true;
      prevRaid = raid !== null;
      if (raid) {
        nights += 1;
        large += raid.length;
        small += (raidFor(42, d, 'normal', 8, B.FOREST) ?? raid).length;
        for (const k of raid) expect(isHostileKind(k)).toBe(true);
      }
    }
    expect(nights).toBeGreaterThan(10);
    expect(streak).toBe(false);
    expect(large).toBeGreaterThanOrEqual(small);
  });

  it('come more often on Hardcore and later on Relaxed', () => {
    const count = (diff: 'relaxed' | 'normal' | 'hardcore') => Array.from({ length: 80 }, (_, d) => raidFor(3, d + 1, diff, 20, B.FOREST)).filter(Boolean).length;
    expect(count('hardcore')).toBeGreaterThan(count('normal'));
    expect(count('normal')).toBeGreaterThan(count('relaxed'));
    for (let d = 1; d < 6; d++) expect(raidFor(3, d, 'relaxed', 40, B.FOREST)).toBeNull();
  });

  it('puts the raiders on dry land around the camp, hunting', () => {
    const size = 60;
    const world = { size, seed: 1, terrain: new Uint8Array(size * size).fill(T.GRASS), biome: new Uint8Array(size * size) } as unknown as World;
    const kinds = Array.from({ length: 6 }, () => 'skeleton' as const);
    const e = spawnRaid(emptyEncounters(), kinds, world, new Set(), { x: 30, y: 30 }, new Rng(5));
    expect(e.creatures).toHaveLength(6);
    for (const c of e.creatures) {
      const d = Math.hypot(c.x - 30, c.y - 30);
      expect(d).toBeGreaterThanOrEqual(8.9);
      expect(d).toBeLessThanOrEqual(14.1);
      expect(c.state).toBe('chase');
      expect(CREATURES[c.kind].temper).toBe('chase');
    }
    expect(world.terrain[idx(1, 1, size)]).toBe(T.GRASS);
    expect(new Set(e.creatures.map((c) => c.id)).size).toBe(6);
  });

  it('are marked as rolled once a day', () => {
    const s = base();
    const marked = markRaid(s, 4);
    expect(marked.raidDay).toBe(4);
    expect(markRaid(marked, 4)).toBe(marked);
  });
});

describe('turrets', () => {
  const size = 40;
  const world = { size, seed: 1, terrain: new Uint8Array(size * size).fill(T.GRASS), biome: new Uint8Array(size * size) } as unknown as World;
  const ctx = (turrets: TickContext['turrets'], solids: ReadonlySet<number> = new Set()): TickContext => ({
    world, solids, structures: emptyStructures(), hero: { x: 2, y: 2 }, heroAlive: true, night: false, difficulty: 'normal', defense: 0,
    rng: new Rng(1), fixed: true, turrets,
  });
  const withSkeleton = (x: number, y: number) => ({
    ...emptyEncounters(),
    creatures: [{ id: 1, kind: 'skeleton' as const, x, y, hp: 14, facing: 'down' as const, state: 'idle' as const, timer: 9, headX: 0, headY: 0, angry: false, pushX: 0, pushY: 0, stun: 0, step: 0 }],
    nextId: 2,
  });

  it('shoot the nearest monster in range, and only with arrows', () => {
    const turret = { id: 7, x: 20, y: 20, ammo: 5 };
    const fired = tickEncounters(withSkeleton(24.5, 20.5), ctx([turret]), 0.05);
    expect(fired.events.some((ev) => ev.t === 'turretShot' && ev.id === 7)).toBe(true);
    expect(fired.e.arrows.length).toBeGreaterThan(0);
    const dry = tickEncounters(withSkeleton(24.5, 20.5), ctx([{ ...turret, ammo: 0 }]), 0.05);
    expect(dry.events.some((ev) => ev.t === 'turretShot')).toBe(false);
    const far = tickEncounters(withSkeleton(36, 20.5), ctx([turret]), 0.05);
    expect(far.events.some((ev) => ev.t === 'turretShot')).toBe(false);
  });

  it('wait between shots, and cannot see through a wall', () => {
    const turret = { id: 7, x: 20, y: 20, ammo: 5 };
    const first = tickEncounters(withSkeleton(24.5, 20.5), ctx([turret]), 0.05);
    const again = tickEncounters(first.e, ctx([turret]), 0.05);
    expect(again.events.some((ev) => ev.t === 'turretShot')).toBe(false);
    const wall = new Set([idx(22, 20, size)]);
    const blocked = tickEncounters(withSkeleton(24.5, 20.5), ctx([turret], wall), 0.05);
    expect(blocked.events.some((ev) => ev.t === 'turretShot')).toBe(false);
  });

  it('are loaded with the hero\'s arrows and use them up', () => {
    let s = base();
    s = { ...s, inventory: addItem(s.inventory, 'arrow', 30).inv, structures: placeStructure(s.structures, 'turret', 40, 40) };
    const turret = s.structures.list[0];
    const loaded = applyAction(s, { kind: 'reload', structure: turret }, { x: 1, y: 1 });
    expect(loaded.session.structures.list[0].ammo).toBe(30);
    expect(loaded.session.inventory.every((x) => x?.item !== 'arrow')).toBe(true);
    expect(turretFired(loaded.session, turret.id).structures.list[0].ammo).toBe(29);
    const empty = applyAction(base({ structures: s.structures }), { kind: 'reload', structure: turret }, { x: 1, y: 1 });
    expect(empty.fx.map((f) => f.t)).toEqual(['say']);
    // Taking it down gives the arrows back.
    const down = applyAction(loaded.session, { kind: 'pickup', structure: loaded.session.structures.list[0] }, { x: 1, y: 1 });
    expect(down.session.inventory.find((x) => x?.item === 'arrow')?.qty).toBe(30);
  });
});

describe('the seasons list', () => {
  it('has four seasons', () => {
    expect(SEASONS).toHaveLength(4);
  });
});
