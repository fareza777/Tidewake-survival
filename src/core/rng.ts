/** Deterministic, seedable RNG (sfc32) so runs can be replayed from a seed (daily runs, shared seeds). */

export function hashString(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: number | string) {
    const s = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
    this.a = s ^ 0x9e3779b9;
    this.b = s ^ 0x243f6a88;
    this.c = s ^ 0xb7e15162;
    this.d = s;
    for (let i = 0; i < 12; i++) this.next();
  }

  /** Float in [0, 1). */
  next(): number {
    this.a >>>= 0; this.b >>>= 0; this.c >>>= 0; this.d >>>= 0;
    let t = (this.a + this.b) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0;
    t = (t + this.d) | 0;
    this.c = (this.c + t) | 0;
    return (t >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('Rng.pick on empty array');
    return arr[Math.floor(this.next() * arr.length)];
  }

  weighted<T>(entries: readonly (readonly [T, number])[]): T {
    const total = entries.reduce((s, [, w]) => s + Math.max(0, w), 0);
    if (total <= 0) throw new Error('Rng.weighted with no positive weights');
    let roll = this.next() * total;
    for (const [value, w] of entries) {
      roll -= Math.max(0, w);
      if (roll < 0) return value;
    }
    return entries[entries.length - 1][0];
  }

  shuffle<T>(arr: readonly T[]): T[] {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /** Pick n distinct elements. */
  sample<T>(arr: readonly T[], n: number): T[] {
    return this.shuffle(arr).slice(0, Math.min(n, arr.length));
  }

  /** Derive an independent child stream (e.g. per floor / per room) so generation order doesn't leak across systems. */
  fork(label: string): Rng {
    return new Rng(hashString(label + ':' + Math.floor(this.next() * 4294967296)));
  }

  static seedFromTime(): number {
    return (Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0;
  }
}

export function seedToCode(seed: number): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let n = seed >>> 0;
  let s = '';
  for (let i = 0; i < 7; i++) {
    s += alphabet[n % alphabet.length];
    n = Math.floor(n / alphabet.length);
  }
  return s;
}

export function codeToSeed(code: string): number {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  let n = 0;
  for (let i = clean.length - 1; i >= 0; i--) {
    const idx = alphabet.indexOf(clean[i]);
    n = n * alphabet.length + (idx < 0 ? 0 : idx);
  }
  return n >>> 0;
}
