import { describe, expect, it } from 'vitest';
import { DUNGEON_IDS, DUNGEON_VERSION, addUnique, emptyDungeons, emptyProgress, isDungeonId, parseDungeons } from '@/sim/dungeon/progress';

describe('claimed reward', () => {
  it('is read back only when it is exactly true, and is absent from a fresh record', () => {
    expect('claimed' in emptyProgress()).toBe(false);
    expect(parseDungeons({ grotto: { boss: true, claimed: true } }).grotto.claimed).toBe(true);
    expect(parseDungeons({ grotto: { boss: true, claimed: 'yes' } }).grotto.claimed).toBeUndefined();
    expect(parseDungeons({ grotto: { boss: true } }).grotto.claimed).toBeUndefined();
  });
});

describe('dungeon progress', () => {
  it('knows the nine dungeons and starts each with nothing done', () => {
    expect(DUNGEON_IDS).toEqual(['grotto', 'deepmine', 'ruin', 'lighthouse', 'frostcave', 'magmaforge', 'drownedcrypt', 'skyspire', 'depths']);
    for (const id of DUNGEON_IDS) expect(emptyDungeons()[id]).toEqual({ opened: [], looted: [], solved: [], lit: [], boss: false });
    expect(emptyProgress()).not.toBe(emptyProgress());
  });

  it('has a version that is bumped whenever the generator changes, so old progress is never applied to a new layout', () => {
    expect(Number.isInteger(DUNGEON_VERSION)).toBe(true);
    expect(DUNGEON_VERSION).toBeGreaterThanOrEqual(1);
  });

  it('recognises dungeon ids safely', () => {
    expect(isDungeonId('ruin')).toBe(true);
    expect(isDungeonId('toString')).toBe(false);
    expect(isDungeonId(null)).toBe(false);
  });

  it('adds a number to a list once, without changing the original', () => {
    const list = [1, 2] as const;
    expect(addUnique(list, 3)).toEqual([1, 2, 3]);
    expect(addUnique(list, 2)).toBe(list);
    expect(list).toEqual([1, 2]);
  });

  it('keeps only sound progress from an untrusted save', () => {
    const parsed = parseDungeons({
      grotto: { opened: [1, 2, 2, -4, 'x', 3.5, 7], looted: [0], solved: 'no', lit: [4, 1e12], boss: true },
      deepmine: 'junk',
      toString: { boss: true },
    });
    expect(parsed.grotto).toEqual({ opened: [1, 2, 7], looted: [0], solved: [], lit: [4], boss: true });
    expect(parsed.deepmine).toEqual(emptyProgress());
    expect(parsed.ruin).toEqual(emptyProgress());
    expect(parseDungeons(undefined)).toEqual(emptyDungeons());
    expect(parseDungeons({ grotto: { boss: 'yes' } }).grotto.boss).toBe(false);
  });

  it('caps the length of a list so a hand-edited save cannot bloat memory', () => {
    const huge = Array.from({ length: 5000 }, (_, i) => i);
    expect(parseDungeons({ ruin: { opened: huge } }).ruin.opened.length).toBeLessThanOrEqual(200);
  });
});
