import type { Mods } from '@/sim/mods';

/** Lasting effects: food, potions and the wounds of the wild. */
export const BUFFS = ['wellfed', 'energized', 'warm', 'strong', 'swift', 'fortified', 'poisoned'] as const;
export type BuffId = (typeof BUFFS)[number];

/** Whether an effect helps the hero (shown in green) or hurts him (shown in red). */
export const isHarmful = (id: BuffId): boolean => id === 'poisoned';

export interface Buff {
  readonly id: BuffId;
  /** The play time (seconds) at which it wears off. */
  readonly until: number;
}

export const isBuffId = (v: unknown): v is BuffId => typeof v === 'string' && (BUFFS as readonly string[]).includes(v);

/** Start an effect, or lengthen it when it is already running (the longer of the two wins). */
export function addBuff(buffs: readonly Buff[], id: BuffId, seconds: number, now: number): Buff[] {
  const until = now + seconds;
  const has = buffs.find((b) => b.id === id);
  if (!has) return [...buffs, { id, until }];
  return until > has.until ? buffs.map((b) => (b.id === id ? { id, until } : b)) : [...buffs];
}

export const hasBuff = (buffs: readonly Buff[], id: BuffId): boolean => buffs.some((b) => b.id === id);

/** Remove effects that have run out (the same array comes back when none did). */
export function pruneBuffs(buffs: readonly Buff[], now: number): readonly Buff[] {
  return buffs.some((b) => b.until <= now) ? buffs.filter((b) => b.until > now) : buffs;
}

/** Take one effect away (an antidote cures poison). */
export const removeBuff = (buffs: readonly Buff[], id: BuffId): readonly Buff[] => (hasBuff(buffs, id) ? buffs.filter((b) => b.id !== id) : buffs);

/** What each effect does to the hero's numbers. */
export function applyBuffs(m: Mods, buffs: readonly Buff[]): Mods {
  const out = { ...m };
  for (const { id } of buffs) {
    switch (id) {
      case 'wellfed': out.hpRegen += 0.6; break;
      case 'energized': out.regen += 6; break;
      case 'warm': out.warmth += 30; break;
      case 'strong': out.meleeDamage *= 1.15; out.chopDamage *= 1.15; out.mineDamage *= 1.15; break;
      case 'swift': out.speed *= 1.1; break;
      case 'fortified': out.defense += 3; break;
      case 'poisoned': out.hpDrain += 1.2; break;
    }
  }
  return out;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Validate untrusted JSON into effects. */
export function parseBuffs(raw: unknown): Buff[] {
  if (!Array.isArray(raw)) return [];
  const out: Buff[] = [];
  for (const b of raw as unknown[]) {
    if (typeof b !== 'object' || b === null) continue;
    const { id, until } = b as Record<string, unknown>;
    if (isBuffId(id) && isNum(until) && until > 0 && !out.some((x) => x.id === id)) out.push({ id, until });
  }
  return out;
}
