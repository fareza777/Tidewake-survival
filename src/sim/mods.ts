import { gearStats, type Equipment } from '@/sim/equipment';
import { levelsOf, type Skills } from '@/sim/skills';

/**
 * Everything that makes the hero better than his bare hands: the bonuses of his skills, his gear and (later) his
 * lasting effects, reduced to a few plain numbers the rules multiply by. Pure: the same inputs give the same numbers.
 */
export interface Mods {
  /** Damage multipliers on trees and on rock, ore and crystal. */
  chopDamage: number;
  mineDamage: number;
  /** Damage multiplier on blows and arrows (skill and gear together). */
  meleeDamage: number;
  /** Chance of a critical blow (about three quarters more damage). */
  crit: number;
  /** Multipliers on the stamina a swing costs (below 1 is cheaper). */
  staminaWood: number;
  staminaMine: number;
  staminaFight: number;
  /** Chance of one extra drop from a tree, from rock, and of a doubled crop. */
  yieldWood: number;
  yieldMine: number;
  yieldFarm: number;
  /** Multiplier on what cooked food restores. */
  food: number;
  /** Chance that crafting hands back some of the materials. */
  craftSave: number;
  /** Walking speed multiplier. */
  speed: number;
  /** Stamina recovered a second on top of normal, and luck (a chance bonus on loot). */
  regen: number;
  luck: number;
  /** Warmth against the cold. */
  warmth: number;
}

export const neutralMods = (): Mods => ({
  chopDamage: 1, mineDamage: 1, meleeDamage: 1, crit: 0, staminaWood: 1, staminaMine: 1, staminaFight: 1,
  yieldWood: 0, yieldMine: 0, yieldFarm: 0, food: 1, craftSave: 0, speed: 1, regen: 0, luck: 0, warmth: 0,
});

/** A critical blow's damage multiplier. */
export const CRIT_DAMAGE = 1.75;

/** A bonus that every skill level past the first adds in the same way. */
const perLevel = (level: number, each: number): number => (level - 1) * each;

export function modsOf(skills: Skills, equipment: Equipment, extra: Partial<Mods> = {}): Mods {
  const lv = levelsOf(skills);
  const gear = gearStats(equipment);
  const base: Mods = {
    chopDamage: 1 + perLevel(lv.woodcutting, 0.08),
    mineDamage: 1 + perLevel(lv.mining, 0.08),
    meleeDamage: (1 + perLevel(lv.combat, 0.05)) * (1 + gear.damage),
    crit: perLevel(lv.combat, 0.02) + gear.luck * 0.1,
    staminaWood: 1 - perLevel(lv.woodcutting, 0.03),
    staminaMine: 1 - perLevel(lv.mining, 0.03),
    staminaFight: 1 - perLevel(lv.combat, 0.03),
    yieldWood: perLevel(lv.woodcutting, 0.04) + gear.luck,
    yieldMine: perLevel(lv.mining, 0.04) + gear.luck,
    yieldFarm: perLevel(lv.farming, 0.05) + gear.luck,
    food: 1 + perLevel(lv.cooking, 0.04),
    craftSave: perLevel(lv.crafting, 0.03),
    speed: 1 + gear.speed,
    regen: gear.regen,
    luck: gear.luck,
    warmth: gear.warmth,
  };
  return { ...base, ...extra };
}
