import { describe, expect, it } from 'vitest';
import { Rng, codeToSeed, hashString, seedToCode } from '@/core/rng';

describe('Rng', () => {
  it('produces the same sequence for the same seed and differs between seeds', () => {
    const a = new Rng(5);
    const b = new Rng(5);
    for (let i = 0; i < 20; i++) expect(a.next()).toBe(b.next());
    expect(new Rng(5).next()).not.toBe(new Rng(6).next());
    expect(new Rng('island').next()).toBe(new Rng('island').next());
  });

  it('keeps next() in [0, 1) and int()/float() in range', () => {
    const r = new Rng(9);
    for (let i = 0; i < 500; i++) {
      const n = r.next();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
      const k = r.int(3, 7);
      expect(k).toBeGreaterThanOrEqual(3);
      expect(k).toBeLessThanOrEqual(7);
      const f = r.float(-2, 2);
      expect(f).toBeGreaterThanOrEqual(-2);
      expect(f).toBeLessThan(2);
    }
  });

  it('hits every value of a small int range', () => {
    const r = new Rng(1);
    const seen = new Set<number>();
    for (let i = 0; i < 300; i++) seen.add(r.int(1, 4));
    expect([...seen].sort()).toEqual([1, 2, 3, 4]);
  });

  it('picks, shuffles and samples without losing elements', () => {
    const r = new Rng(2);
    const arr = [1, 2, 3, 4, 5, 6];
    expect(arr).toContain(r.pick(arr));
    expect(r.shuffle(arr).sort()).toEqual(arr);
    expect(arr).toEqual([1, 2, 3, 4, 5, 6]);
    expect(new Set(r.sample(arr, 4)).size).toBe(4);
    expect(r.sample(arr, 99)).toHaveLength(6);
    expect(() => r.pick([])).toThrow();
  });

  it('respects weights and rejects empty ones', () => {
    const r = new Rng(3);
    let a = 0;
    for (let i = 0; i < 1000; i++) if (r.weighted([['a', 9], ['b', 1]]) === 'a') a++;
    expect(a).toBeGreaterThan(800);
    expect(r.weighted([['x', 0], ['y', 5]])).toBe('y');
    expect(() => r.weighted([['x', 0]])).toThrow();
  });

  it('forks independent but deterministic child streams', () => {
    const a = new Rng(11).fork('terrain');
    const b = new Rng(11).fork('terrain');
    expect(a.next()).toBe(b.next());
    expect(new Rng(11).fork('terrain').next()).not.toBe(new Rng(11).fork('landmarks').next());
  });
});

describe('seed codes', () => {
  it('round-trips seeds through readable codes', () => {
    for (const seed of [0, 1, 4242, 123456789, 4294967295]) expect(codeToSeed(seedToCode(seed))).toBe(seed);
    expect(seedToCode(4242)).toHaveLength(7);
  });

  it('ignores case and punctuation when reading a code', () => {
    const code = seedToCode(98765);
    expect(codeToSeed(code.toLowerCase())).toBe(98765);
    expect(codeToSeed(`${code.slice(0, 3)}-${code.slice(3)}`)).toBe(98765);
  });

  it('hashes strings stably', () => {
    expect(hashString('tidewake')).toBe(hashString('tidewake'));
    expect(hashString('a')).not.toBe(hashString('b'));
  });
});
