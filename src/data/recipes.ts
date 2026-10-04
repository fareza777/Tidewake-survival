import type { ItemId } from './items';
import type { Station } from './structures';
import type { Cost } from '@/sim/inventory';

export interface Recipe {
  id: string;
  out: ItemId;
  qty: number;
  cost: Cost;
  station: Station;
}

const r = (out: ItemId, qty: number, cost: Cost, station: Station = 'hand'): Recipe => ({ id: out, out, qty, cost, station });

/** The first crafting set. Later plans add armour, weapons, glass, potions and more. */
export const RECIPES: readonly Recipe[] = [
  // By hand
  r('plank', 2, [['wood', 2]]),
  r('rope', 1, [['fiber', 3]]),
  r('axe_wood', 1, [['wood', 3], ['fiber', 2]]),
  r('pickaxe_wood', 1, [['wood', 3], ['fiber', 2]]),
  r('torch', 2, [['wood', 1], ['fiber', 1]]),
  r('campfire', 1, [['wood', 5], ['stone', 3]]),
  r('workbench', 1, [['plank', 6], ['rope', 2]]),
  r('sword_wood', 1, [['wood', 3], ['fiber', 2]]),
  r('bandage', 1, [['fiber', 2], ['gel', 1]]),
  // Workbench
  r('axe_stone', 1, [['plank', 2], ['stone', 3], ['rope', 1]], 'workbench'),
  r('pickaxe_stone', 1, [['plank', 2], ['stone', 3], ['rope', 1]], 'workbench'),
  r('hoe', 1, [['plank', 3], ['rope', 1]], 'workbench'),
  r('watering_can', 1, [['plank', 5], ['rope', 1]], 'workbench'),
  r('furnace', 1, [['stone', 12], ['plank', 4]], 'workbench'),
  r('bed', 1, [['plank', 6], ['fiber', 4]], 'workbench'),
  r('chest', 1, [['plank', 8]], 'workbench'),
  r('fence', 2, [['plank', 2]], 'workbench'),
  r('axe_iron', 1, [['plank', 2], ['iron_ingot', 3], ['rope', 1]], 'workbench'),
  r('pickaxe_iron', 1, [['plank', 2], ['iron_ingot', 3], ['rope', 1]], 'workbench'),
  r('sword_stone', 1, [['plank', 1], ['stone', 3], ['rope', 1]], 'workbench'),
  r('sword_iron', 1, [['plank', 1], ['iron_ingot', 3], ['rope', 1]], 'workbench'),
  r('spear_bone', 1, [['plank', 1], ['bone', 2], ['rope', 1]], 'workbench'),
  r('bow', 1, [['plank', 3], ['rope', 2]], 'workbench'),
  r('armor_bone', 1, [['bone', 8], ['rope', 2]], 'workbench'),
  r('armor_iron', 1, [['iron_ingot', 8], ['rope', 2]], 'workbench'),
  r('arrow', 4, [['wood', 1], ['stone', 1], ['fiber', 1]], 'workbench'),
  // Furnace
  r('iron_ingot', 1, [['iron_ore', 2], ['wood', 1]], 'furnace'),
  // Campfire
  r('roasted_carrot', 1, [['carrot', 1]], 'campfire'),
  r('roasted_corn', 1, [['corn', 1]], 'campfire'),
  r('baked_pumpkin', 1, [['pumpkin', 1]], 'campfire'),
  r('cooked_meat', 1, [['raw_meat', 1]], 'campfire'),
];
