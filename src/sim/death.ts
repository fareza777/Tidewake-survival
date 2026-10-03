import { loseHalfOfHotbar, type Inventory } from '@/sim/inventory';
import type { Difficulty, Vitals } from '@/sim/vitals';

/** How the hero wakes up after collapsing: hurt, hungry and thirsty, but alive. */
export const RESPAWN_VITALS: Vitals = { hp: 60, hunger: 60, thirst: 60, stamina: 100 };

export interface DeathResult {
  inv: Inventory;
  vitals: Vitals;
  /** Hardcore: the adventure is over and the save must be deleted. */
  wipeSave: boolean;
}

/** Relaxed keeps everything, Normal loses half of the hotbar, Hardcore ends the game. */
export function applyDeath(difficulty: Difficulty, inv: Inventory, roll: () => number): DeathResult {
  if (difficulty === 'hardcore') return { inv, vitals: RESPAWN_VITALS, wipeSave: true };
  if (difficulty === 'normal') return { inv: loseHalfOfHotbar(inv, roll), vitals: RESPAWN_VITALS, wipeSave: false };
  return { inv, vitals: RESPAWN_VITALS, wipeSave: false };
}
