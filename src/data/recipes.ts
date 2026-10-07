import type { ItemId } from './items';
import type { Station } from './structures';
import type { Cost } from '@/sim/inventory';

export interface Recipe {
  id: string;
  out: ItemId;
  qty: number;
  cost: Cost;
  station: Station;
  /** Crafting level needed (1 when absent). */
  lvl?: number;
}

const r = (out: ItemId, qty: number, cost: Cost, station: Station = 'hand', lvl?: number): Recipe => (lvl ? { id: out, out, qty, cost, station, lvl } : { id: out, out, qty, cost, station });

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
  r('salve', 1, [['gel', 2], ['fiber', 1], ['honey', 1]]),
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
  r('shovel', 1, [['plank', 2], ['stone', 2], ['rope', 1]], 'workbench'),
  r('fishing_rod', 1, [['wood', 3], ['rope', 2]], 'workbench'),
  r('sailcloth', 1, [['fiber', 10], ['rope', 2]], 'workbench'),
  r('raft', 1, [['plank', 8], ['rope', 3], ['sailcloth', 1], ['hull_planks', 1], ['compass', 1]], 'workbench'),
  r('spear_wood', 1, [['plank', 2], ['stone', 1]], 'workbench'),
  r('spear_iron', 1, [['plank', 1], ['iron_ingot', 2], ['rope', 1]], 'workbench'),
  r('bow_long', 1, [['plank', 3], ['rope', 2], ['iron_ingot', 1]], 'workbench'),
  r('sword_crystal', 1, [['crystal', 4], ['iron_ingot', 3], ['plank', 1], ['rope', 1]], 'workbench'),
  r('armor_wood', 1, [['plank', 10], ['rope', 3]], 'workbench'),
  r('armor_crystal', 1, [['crystal', 6], ['iron_ingot', 4], ['rope', 2]], 'workbench'),
  r('alchemy', 1, [['plank', 6], ['stone', 4], ['crystal', 2]], 'workbench'),
  r('sign', 2, [['plank', 2]], 'workbench'),
  r('table', 1, [['plank', 6]], 'workbench'),
  r('stool', 2, [['plank', 3]], 'workbench'),
  r('lamp_post', 1, [['plank', 2], ['iron_ingot', 1], ['crystal', 1]], 'workbench'),
  r('barrel', 1, [['plank', 6], ['rope', 2]], 'workbench'),
  // Alchemy table
  r('healing_potion', 1, [['gel', 2], ['berries', 3], ['honey', 1]], 'alchemy'),
  r('great_healing_potion', 1, [['healing_potion', 1], ['crystal', 1], ['honey', 2]], 'alchemy'),
  r('stamina_tonic', 1, [['coconut', 2], ['honey', 1], ['berries', 2]], 'alchemy'),
  // Furnace
  r('iron_ingot', 1, [['iron_ore', 2], ['wood', 1]], 'furnace'),
  // Campfire
  r('roasted_carrot', 1, [['carrot', 1]], 'campfire'),
  r('roasted_corn', 1, [['corn', 1]], 'campfire'),
  r('baked_pumpkin', 1, [['pumpkin', 1]], 'campfire'),
  r('cooked_meat', 1, [['raw_meat', 1]], 'campfire'),
  r('cooked_fish', 1, [['raw_fish', 1]], 'campfire'),
  r('roasted_turnip', 1, [['turnip', 1]], 'campfire'),
  r('veggie_stew', 1, [['carrot', 1], ['turnip', 1], ['pumpkin', 1]], 'campfire'),
  r('fish_stew', 1, [['raw_fish', 2], ['carrot', 1]], 'campfire'),
  r('berry_jam', 1, [['berries', 3], ['honey', 1]], 'campfire'),
  r('smoked_meat', 1, [['raw_meat', 2], ['wood', 1]], 'campfire'),
  r('pumpkin_pie', 1, [['pumpkin', 1], ['honey', 1], ['corn', 1]], 'campfire'),
  r('sweet_drink', 1, [['coconut', 2], ['honey', 1]], 'campfire'),
  r('antidote', 1, [['gel', 2], ['fiber', 3], ['berries', 2]], 'campfire'),

  // Leather, from the hides of animals
  r('armor_leather', 1, [['hide', 6], ['rope', 2]], 'workbench'),
  r('cap_leather', 1, [['hide', 3], ['rope', 1]], 'workbench'),
  r('boots_leather', 1, [['hide', 3], ['fiber', 2]], 'workbench'),
  // The anvil and what is worked at it
  r('anvil', 1, [['iron_ingot', 8], ['stone', 10], ['plank', 4]], 'workbench', 3),
  r('steel_ingot', 1, [['iron_ingot', 2], ['coal', 2]], 'furnace', 4),
  r('mithril_ingot', 1, [['mithril_ore', 2], ['coal', 2], ['crystal', 1]], 'furnace', 7),
  r('helm_iron', 1, [['iron_ingot', 5], ['rope', 1]], 'anvil', 3),
  r('boots_iron', 1, [['iron_ingot', 4], ['hide', 2]], 'anvil', 3),
  r('helm_crystal', 1, [['crystal', 5], ['iron_ingot', 3]], 'anvil', 5),
  r('axe_steel', 1, [['plank', 2], ['steel_ingot', 3], ['rope', 1]], 'anvil', 4),
  r('pickaxe_steel', 1, [['plank', 2], ['steel_ingot', 3], ['rope', 1]], 'anvil', 4),
  r('sword_steel', 1, [['steel_ingot', 4], ['plank', 1], ['rope', 1]], 'anvil', 4),
  r('spear_steel', 1, [['steel_ingot', 3], ['plank', 1], ['rope', 1]], 'anvil', 4),
  r('helm_steel', 1, [['steel_ingot', 5], ['rope', 1]], 'anvil', 4),
  r('boots_steel', 1, [['steel_ingot', 4], ['hide', 2]], 'anvil', 4),
  r('armor_steel', 1, [['steel_ingot', 10], ['hide', 2], ['rope', 3]], 'anvil', 5),
  r('axe_mithril', 1, [['plank', 2], ['mithril_ingot', 3], ['rope', 1]], 'anvil', 7),
  r('pickaxe_mithril', 1, [['plank', 2], ['mithril_ingot', 3], ['rope', 1]], 'anvil', 7),
  r('sword_mithril', 1, [['mithril_ingot', 5], ['crystal', 1], ['rope', 1]], 'anvil', 8),
  r('helm_mithril', 1, [['mithril_ingot', 6], ['rope', 1]], 'anvil', 8),
  r('boots_mithril', 1, [['mithril_ingot', 5], ['hide', 2]], 'anvil', 8),
  r('armor_mithril', 1, [['mithril_ingot', 12], ['hide', 3], ['rope', 3]], 'anvil', 9),
  // Building
  r('wood_wall', 2, [['plank', 2]], 'workbench'),
  r('stone_wall', 2, [['stone', 4], ['plank', 1]], 'workbench', 2),
  r('wood_door', 1, [['plank', 4], ['rope', 1]], 'workbench'),
  r('wood_floor', 4, [['plank', 2]], 'workbench'),
  r('tent', 1, [['hide', 6], ['plank', 2], ['rope', 3], ['fiber', 6]], 'workbench', 2),
  r('turret', 1, [['plank', 6], ['iron_ingot', 4], ['rope', 3]], 'workbench', 4),
  // The way to the other islands
  r('boat', 1, [['plank', 16], ['rope', 6], ['sailcloth', 2]], 'workbench', 4),
  // Warm and strong
  r('warm_stew', 1, [['raw_meat', 1], ['carrot', 1], ['pumpkin', 1]], 'campfire'),
  r('potion_strength', 1, [['gel', 2], ['honey', 1], ['crystal', 1]], 'alchemy', 3),
  r('potion_swift', 1, [['berries', 3], ['honey', 2], ['gel', 1]], 'alchemy', 3),
  r('potion_ward', 1, [['bone', 3], ['gel', 2], ['honey', 1]], 'alchemy', 4),
  r('potion_warmth', 1, [['coconut', 1], ['honey', 2], ['berries', 2]], 'alchemy', 2),
  // Charms
  r('ring_might', 1, [['iron_ingot', 2], ['crystal', 2]], 'anvil', 4),
  r('ring_swift', 1, [['steel_ingot', 1], ['crystal', 2], ['fiber', 4]], 'anvil', 5),
  r('amulet_vigor', 1, [['rope', 2], ['crystal', 3], ['honey', 2]], 'anvil', 5),
  r('amulet_fortune', 1, [['rope', 2], ['crystal', 4], ['steel_ingot', 1]], 'anvil', 6),
];
