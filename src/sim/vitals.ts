import { B, type Biome } from '@/sim/world/types';

export type Difficulty = 'relaxed' | 'normal' | 'hardcore';

export const VITAL_MAX = 100;

export interface Vitals {
  readonly hp: number;
  readonly hunger: number;
  readonly thirst: number;
  readonly stamina: number;
}

export const fullVitals = (): Vitals => ({ hp: VITAL_MAX, hunger: VITAL_MAX, thirst: VITAL_MAX, stamina: VITAL_MAX });

/** Hunger lasts about two in-game days (a day is 600 s), thirst a little over one. Values are per second. */
export const HUNGER_RATE = VITAL_MAX / 1200;
export const THIRST_RATE = VITAL_MAX / 800;
/** Hit points lost per second for each empty meter. */
export const STARVE_DAMAGE = 0.6;
/** Hit points regained per second while both meters are above REGEN_THRESHOLD. */
export const REGEN_RATE = 0.4;
export const REGEN_THRESHOLD = 40;
export const STAMINA_REGEN = 10;
export const STAMINA_REGEN_BUSY = 2;
/** Stamina a second that running costs (nothing recovers meanwhile), how much is needed to break into a run, and how fast it is. */
export const RUN_DRAIN = 9;
export const RUN_START = 12;
export const RUN_SPEED = 1.6;
/** Thirst multiplier in the desert. */
export const DESERT_THIRST = 1.6;

const DIFFICULTY_DRAIN: Record<Difficulty, number> = { relaxed: 0.6, normal: 1, hardcore: 1.4 };

export interface VitalsContext {
  difficulty: Difficulty;
  /** Biome under the hero. */
  biome: Biome;
  /** True when the hero acted (swung a tool, etc.) in the last moment, which slows stamina recovery. */
  busy: boolean;
  /** True while the hero runs: stamina drains instead of recovering. */
  running?: boolean;
}

const clamp = (v: number): number => Math.min(VITAL_MAX, Math.max(0, v));

export function tickVitals(v: Vitals, dt: number, ctx: VitalsContext): Vitals {
  if (dt <= 0) return v;
  const drain = DIFFICULTY_DRAIN[ctx.difficulty];
  const hunger = clamp(v.hunger - HUNGER_RATE * drain * dt);
  const thirst = clamp(v.thirst - THIRST_RATE * drain * (ctx.biome === B.DESERT ? DESERT_THIRST : 1) * dt);
  let hp = v.hp;
  const empty = (hunger <= 0 ? 1 : 0) + (thirst <= 0 ? 1 : 0);
  if (empty > 0) hp -= STARVE_DAMAGE * drain * empty * dt;
  else if (hp > 0 && hunger >= REGEN_THRESHOLD && thirst >= REGEN_THRESHOLD) hp += REGEN_RATE * dt;
  const stamina = v.stamina + (ctx.running ? -RUN_DRAIN : ctx.busy ? STAMINA_REGEN_BUSY : STAMINA_REGEN) * dt;
  return { hp: clamp(hp), hunger, thirst, stamina: clamp(stamina) };
}

export interface FoodValue {
  hunger: number;
  thirst: number;
  hp: number;
  /** Tonics give stamina back. */
  stamina?: number;
}

export function eat(v: Vitals, food: FoodValue): Vitals {
  return { ...v, hunger: clamp(v.hunger + food.hunger), thirst: clamp(v.thirst + food.thirst), hp: clamp(v.hp + food.hp), stamina: clamp(v.stamina + (food.stamina ?? 0)) };
}

/** True when eating this would change nothing (all three affected meters are already full). */
export function wouldWaste(v: Vitals, food: FoodValue): boolean {
  return (food.hunger <= 0 || v.hunger >= VITAL_MAX) && (food.thirst <= 0 || v.thirst >= VITAL_MAX) && (food.hp <= 0 || v.hp >= VITAL_MAX)
    && ((food.stamina ?? 0) <= 0 || v.stamina >= VITAL_MAX);
}

/** Lose hit points to a blow; the other meters are untouched. */
export function takeDamage(v: Vitals, amount: number): Vitals {
  return amount > 0 ? { ...v, hp: clamp(v.hp - amount) } : v;
}

/** Pay a stamina cost, or null when the hero is too tired. */
export function spendStamina(v: Vitals, cost: number): Vitals | null {
  if (v.stamina < cost) return null;
  return { ...v, stamina: v.stamina - cost };
}

export const isDead = (v: Vitals): boolean => v.hp <= 0;

/** A night's sleep: rest and heal, at the price of some food and water. */
export function sleepRecovery(v: Vitals): Vitals {
  return { hp: clamp(v.hp + 40), hunger: clamp(v.hunger - 15), thirst: clamp(v.thirst - 15), stamina: VITAL_MAX };
}
