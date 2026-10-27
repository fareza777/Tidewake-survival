import { loseGoods, type Inventory } from '@/sim/inventory';
import type { Difficulty, Vitals } from '@/sim/vitals';

/** How the hero wakes up after collapsing: hurt, hungry and thirsty, but alive. */
export const RESPAWN_VITALS: Vitals = { hp: 60, hunger: 60, thirst: 60, stamina: 100, warmth: 80 };

export interface DeathResult {
  inv: Inventory;
  vitals: Vitals;
  /** Hardcore: the adventure is over and the save must be deleted. */
  wipeSave: boolean;
}

/** Relaxed keeps everything, Normal loses a third of the materials and food it carries (never tools or gear), Hardcore ends the game. */
export function applyDeath(difficulty: Difficulty, inv: Inventory, _roll: () => number = Math.random): DeathResult {
  if (difficulty === 'hardcore') return { inv, vitals: RESPAWN_VITALS, wipeSave: true };
  if (difficulty === 'normal') return { inv: loseGoods(inv), vitals: RESPAWN_VITALS, wipeSave: false };
  return { inv, vitals: RESPAWN_VITALS, wipeSave: false };
}
