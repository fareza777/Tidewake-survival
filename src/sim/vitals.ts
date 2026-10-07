import { B, type Biome } from '@/sim/world/types';

export type Difficulty = 'relaxed' | 'normal' | 'hardcore';

export const VITAL_MAX = 100;

export interface Vitals {
  readonly hp: number;
  readonly hunger: number;
  readonly thirst: number;
  readonly stamina: number;
  /** How warm the hero is; the cold wears it down, fires and warm clothes build it up. */
  readonly warmth: number;
}

export const fullVitals = (): Vitals => ({ hp: VITAL_MAX, hunger: VITAL_MAX, thirst: VITAL_MAX, stamina: VITAL_MAX, warmth: VITAL_MAX });

/** Hunger lasts about two in-game days (a day is 600 s), thirst a little over one. Values are per second. */
export const HUNGER_RATE = VITAL_MAX / 1200;
export const THIRST_RATE = VITAL_MAX / 800;
/** Hit points lost per second for each empty meter. */
export const STARVE_DAMAGE = 0.6;
/** Hit points regained per second while both meters are above REGEN_THRESHOLD. */
export const REGEN_RATE = 0.4;
export const REGEN_THRESHOLD = 40;
export const STAMINA_REGEN = 8;
export const STAMINA_REGEN_BUSY = 1;
/** Below this much hunger or thirst the body recovers its breath at half speed. */
export const WEAK_BELOW = 25;
/** Stamina a second that running costs (nothing recovers meanwhile), how much is needed to break into a run, and how fast it is. */
export const RUN_DRAIN = 9;
export const RUN_START = 12;
export const RUN_SPEED = 1.6;
/** Warmth lost a second for each point of cold, gained a second by a fire, and regained in mild weather. */
export const COLD_RATE = 0.25;
export const FIRE_WARMTH = 8;
export const MILD_WARMTH = 2;
/** Protection (from gear and effects) that makes the hero all but immune to the cold, and how much a shelter softens it. */
export const PROTECT_FULL = 70;
export const SHELTER_CHILL = 0.4;
/** Hit points lost a second while frozen. */
export const FREEZE_DAMAGE = 0.8;
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
  /** Extra stamina recovered a second (from gear). */
  regen?: number;
  /** The cold (0 is mild; below 0 is warm), whether a fire warms the hero, whether he stands in shelter, and his protection. */
  cold?: number;
  heated?: boolean;
  sheltered?: boolean;
  protect?: number;
  /** Extra hit points regained a second, and hit points lost a second to poison. */
  hpRegen?: number;
  hpDrain?: number;
  /** What the weather does: it makes him thirstier and slower to catch his breath (1 = nothing). */
  thirstMul?: number;
  regenMul?: number;
}

const clamp = (v: number): number => Math.min(VITAL_MAX, Math.max(0, v));

export function tickVitals(v: Vitals, dt: number, ctx: VitalsContext): Vitals {
  if (dt <= 0) return v;
  const drain = DIFFICULTY_DRAIN[ctx.difficulty];
  const hunger = clamp(v.hunger - HUNGER_RATE * drain * dt);
  const thirst = clamp(v.thirst - THIRST_RATE * drain * (ctx.biome === B.DESERT || ctx.biome === B.VOLCANO ? DESERT_THIRST : 1) * (ctx.thirstMul ?? 1) * dt);
  const cold = ctx.cold ?? 0;
  let warmth = v.warmth;
  if (ctx.heated) warmth += FIRE_WARMTH * dt;
  else if (cold > 0) {
    const exposure = ctx.sheltered ? SHELTER_CHILL : 1;
    warmth -= COLD_RATE * cold * drain * exposure * Math.max(0.08, 1 - (ctx.protect ?? 0) / PROTECT_FULL) * dt;
  } else warmth += MILD_WARMTH * dt;
  warmth = clamp(warmth);
  let hp = v.hp;
  const empty = (hunger <= 0 ? 1 : 0) + (thirst <= 0 ? 1 : 0) + (warmth <= 0 ? 1 : 0);
  if (empty > 0) hp -= (warmth <= 0 && hunger > 0 && thirst > 0 ? FREEZE_DAMAGE : STARVE_DAMAGE) * drain * empty * dt;
  else if (hp > 0 && hunger >= REGEN_THRESHOLD && thirst >= REGEN_THRESHOLD) hp += (REGEN_RATE + (ctx.hpRegen ?? 0)) * dt;
  if (ctx.hpDrain) hp -= ctx.hpDrain * dt;
  const weak = hunger < WEAK_BELOW || thirst < WEAK_BELOW ? 0.5 : 1;
  const recover = ((ctx.busy ? STAMINA_REGEN_BUSY : STAMINA_REGEN) + (ctx.regen ?? 0)) * weak * (ctx.regenMul ?? 1);
  const stamina = v.stamina + (ctx.running ? -RUN_DRAIN : recover) * dt;
  return { hp: clamp(hp), hunger, thirst, stamina: clamp(stamina), warmth };
}

export interface FoodValue {
  hunger: number;
  thirst: number;
  hp: number;
  /** Tonics give stamina back. */
  stamina?: number;
  /** Hot food warms the hero through. */
  warmth?: number;
}

export function eat(v: Vitals, food: FoodValue): Vitals {
  return { ...v, hunger: clamp(v.hunger + food.hunger), thirst: clamp(v.thirst + food.thirst), hp: clamp(v.hp + food.hp), stamina: clamp(v.stamina + (food.stamina ?? 0)), warmth: clamp(v.warmth + (food.warmth ?? 0)) };
}

/** True when eating this would change nothing (all three affected meters are already full). */
export function wouldWaste(v: Vitals, food: FoodValue): boolean {
  return (food.hunger <= 0 || v.hunger >= VITAL_MAX) && (food.thirst <= 0 || v.thirst >= VITAL_MAX) && (food.hp <= 0 || v.hp >= VITAL_MAX)
    && ((food.stamina ?? 0) <= 0 || v.stamina >= VITAL_MAX) && ((food.warmth ?? 0) <= 0 || v.warmth >= VITAL_MAX);
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
export function sleepRecovery(v: Vitals, sheltered = true): Vitals {
  return {
    hp: clamp(v.hp + 40), hunger: clamp(v.hunger - 15), thirst: clamp(v.thirst - 15), stamina: VITAL_MAX,
    warmth: sheltered ? VITAL_MAX : clamp(v.warmth + 30),
  };
}
