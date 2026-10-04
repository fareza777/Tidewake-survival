import type { CropId } from './crops';
import type { StructureId } from './structures';

export type ItemId =
  | 'wood' | 'stone' | 'fiber' | 'plank' | 'rope' | 'iron_ore' | 'iron_ingot' | 'crystal'
  | 'coconut' | 'berries' | 'carrot' | 'turnip' | 'pumpkin' | 'corn' | 'roasted_carrot' | 'roasted_corn' | 'baked_pumpkin'
  | 'carrot_seed' | 'turnip_seed' | 'pumpkin_seed' | 'corn_seed'
  | 'axe_wood' | 'axe_stone' | 'axe_iron' | 'pickaxe_wood' | 'pickaxe_stone' | 'pickaxe_iron' | 'hoe' | 'watering_can'
  | 'campfire' | 'workbench' | 'furnace' | 'bed' | 'chest' | 'torch' | 'fence'
  | 'sword_wood' | 'sword_stone' | 'sword_iron' | 'spear_bone' | 'bow' | 'arrow'
  | 'raw_meat' | 'cooked_meat' | 'honey' | 'bandage' | 'gel' | 'bone'
  | 'armor_bone' | 'armor_iron' | 'armor_moss' | 'armor_ironbones' | 'armor_mire'
  | 'small_key' | 'boss_key' | 'compass' | 'hull_planks' | 'lighthouse_key'
  | 'shovel' | 'fishing_rod' | 'raw_fish' | 'cooked_fish' | 'big_fish' | 'sailcloth' | 'antidote' | 'lost_pickaxe'
  | 'beacon_core' | 'armor_hollow' | 'raft'
  | 'veggie_stew' | 'fish_stew' | 'berry_jam' | 'smoked_meat' | 'roasted_turnip' | 'pumpkin_pie' | 'sweet_drink'
  | 'healing_potion' | 'great_healing_potion' | 'stamina_tonic' | 'armor_wood' | 'armor_crystal'
  | 'spear_wood' | 'spear_iron' | 'bow_long' | 'sword_crystal'
  | 'salve' | 'alchemy' | 'sign' | 'table' | 'stool' | 'lamp_post' | 'barrel';

export type ToolType = 'axe' | 'pickaxe' | 'hoe' | 'can' | 'sword' | 'spear' | 'bow' | 'shovel' | 'rod';

/** How a weapon behaves. Melee weapons sweep an arc in front of the hero; the bow shoots an arrow that flies `reach` tiles. */
export interface WeaponStats {
  kind: 'melee' | 'bow';
  damage: number;
  reach: number;
  /** Full width of the swing in degrees (0 for the bow). */
  arc: number;
  /** Seconds before the weapon can be used again. */
  cooldown: number;
  stamina: number;
  /** Tiles a hit pushes the target away. */
  knockback: number;
}

/** A sprite: a frame in the `props` atlas (pack art) or in the generated `icons` atlas. */
export interface IconRef {
  atlas: 'props' | 'icons';
  frame: string;
}

export interface ItemDef {
  id: ItemId;
  /** Maximum stack size; tools are 1. */
  stack: number;
  icon: IconRef;
  /** Tools wear out: `durability` uses. A watering can instead holds `durability` charges of water. */
  tool?: { type: ToolType; tier: 1 | 2 | 3; durability: number };
  weapon?: WeaponStats;
  /** Worn in the armour slot: every blow from a creature is cut by `defense` points. */
  armor?: { defense: number };
  /** Never lost to the death penalty: keys, story items and the armour bosses leave behind. */
  keep?: true;
  food?: { hunger: number; thirst: number; hp: number; stamina?: number };
  place?: StructureId;
  seed?: CropId;
}

const icons = (frame: string): IconRef => ({ atlas: 'icons', frame });
const pack = (frame: string): IconRef => ({ atlas: 'props', frame });

const material = (id: ItemId, frame: string): ItemDef => ({ id, stack: 99, icon: icons(frame) });
const food = (id: ItemId, icon: IconRef, hunger: number, thirst: number, hp: number): ItemDef => ({
  id, stack: 20, icon, food: { hunger, thirst, hp },
});
const seed = (id: ItemId, crop: CropId): ItemDef => ({ id, stack: 50, icon: icons(id), seed: crop });
const tool = (id: ItemId, type: ToolType, tier: 1 | 2 | 3, durability: number): ItemDef => ({
  id, stack: 1, icon: icons(id), tool: { type, tier, durability },
});
const weapon = (id: ItemId, type: 'sword' | 'spear' | 'bow', tier: 1 | 2 | 3, durability: number, stats: WeaponStats): ItemDef => ({
  ...tool(id, type, tier, durability), weapon: stats,
});
const sword = (damage: number): WeaponStats => ({ kind: 'melee', damage, reach: 1.3, arc: 110, cooldown: 0.42, stamina: 3, knockback: 0.35 });
const armor = (id: ItemId, defense: number): ItemDef => ({ id, stack: 1, icon: icons(id), armor: { defense } });
const keepsake = (id: ItemId, stack = 1): ItemDef => ({ id, stack, icon: icons(id), keep: true });
const placeable = (id: ItemId, place: StructureId, stack = 10): ItemDef => ({ id, stack, icon: icons(`struct_${id}`), place });

export const ITEMS: Record<ItemId, ItemDef> = {
  wood: material('wood', 'wood'),
  stone: material('stone', 'stone'),
  fiber: material('fiber', 'fiber'),
  plank: material('plank', 'plank'),
  rope: material('rope', 'rope'),
  iron_ore: material('iron_ore', 'iron_ore'),
  iron_ingot: material('iron_ingot', 'iron_ingot'),
  crystal: material('crystal', 'crystal'),

  coconut: food('coconut', icons('coconut'), 8, 22, 0),
  berries: food('berries', pack('farmicon1/1'), 8, 3, 0),
  carrot: food('carrot', pack('farmicon1/4'), 10, 2, 0),
  turnip: food('turnip', pack('farmicon1/9'), 9, 2, 0),
  pumpkin: food('pumpkin', pack('farmicon1/50'), 14, 3, 0),
  corn: food('corn', pack('farmicon1/58'), 14, 0, 0),
  roasted_carrot: food('roasted_carrot', icons('roasted_carrot'), 22, 2, 3),
  roasted_corn: food('roasted_corn', icons('roasted_corn'), 28, 0, 4),
  baked_pumpkin: food('baked_pumpkin', icons('baked_pumpkin'), 40, 4, 6),

  carrot_seed: seed('carrot_seed', 'carrot'),
  turnip_seed: seed('turnip_seed', 'turnip'),
  pumpkin_seed: seed('pumpkin_seed', 'pumpkin'),
  corn_seed: seed('corn_seed', 'corn'),

  axe_wood: tool('axe_wood', 'axe', 1, 40),
  axe_stone: tool('axe_stone', 'axe', 2, 80),
  axe_iron: tool('axe_iron', 'axe', 3, 160),
  pickaxe_wood: tool('pickaxe_wood', 'pickaxe', 1, 40),
  pickaxe_stone: tool('pickaxe_stone', 'pickaxe', 2, 80),
  pickaxe_iron: tool('pickaxe_iron', 'pickaxe', 3, 160),
  hoe: tool('hoe', 'hoe', 1, 60),
  watering_can: tool('watering_can', 'can', 1, 40),

  sword_wood: weapon('sword_wood', 'sword', 1, 40, sword(3)),
  sword_stone: weapon('sword_stone', 'sword', 2, 80, sword(5)),
  sword_iron: weapon('sword_iron', 'sword', 3, 160, sword(8)),
  spear_bone: weapon('spear_bone', 'spear', 2, 70, { kind: 'melee', damage: 5, reach: 1.9, arc: 30, cooldown: 0.6, stamina: 4, knockback: 0.5 }),
  bow: weapon('bow', 'bow', 1, 80, { kind: 'bow', damage: 4, reach: 7, arc: 0, cooldown: 0.7, stamina: 3, knockback: 0.25 }),
  arrow: { id: 'arrow', stack: 50, icon: icons('arrow') },

  raw_meat: food('raw_meat', icons('raw_meat'), 8, 0, 0),
  cooked_meat: food('cooked_meat', icons('cooked_meat'), 35, 0, 4),
  honey: food('honey', icons('honey'), 12, 0, 6),
  bandage: food('bandage', icons('bandage'), 0, 0, 30),
  gel: material('gel', 'gel'),
  bone: material('bone', 'bone'),

  armor_bone: armor('armor_bone', 2),
  armor_iron: armor('armor_iron', 4),
  armor_moss: { ...armor('armor_moss', 3), keep: true },
  armor_ironbones: { ...armor('armor_ironbones', 5), keep: true },
  armor_mire: { ...armor('armor_mire', 7), keep: true },

  small_key: keepsake('small_key', 9),
  boss_key: keepsake('boss_key'),
  compass: keepsake('compass'),
  hull_planks: keepsake('hull_planks'),
  lighthouse_key: keepsake('lighthouse_key'),
  beacon_core: keepsake('beacon_core'),
  lost_pickaxe: keepsake('lost_pickaxe'),
  armor_hollow: { ...armor('armor_hollow', 9), keep: true },

  shovel: tool('shovel', 'shovel', 1, 60),
  fishing_rod: tool('fishing_rod', 'rod', 1, 60),
  raw_fish: food('raw_fish', icons('raw_fish'), 9, 0, 0),
  cooked_fish: food('cooked_fish', icons('cooked_fish'), 32, 0, 4),
  big_fish: material('big_fish', 'big_fish'),
  sailcloth: material('sailcloth', 'sailcloth'),
  antidote: food('antidote', icons('antidote'), 0, 8, 30),

  campfire: placeable('campfire', 'campfire'),
  workbench: placeable('workbench', 'workbench'),
  furnace: placeable('furnace', 'furnace'),
  bed: placeable('bed', 'bed'),
  chest: placeable('chest', 'chest'),
  torch: placeable('torch', 'torch', 20),
  fence: placeable('fence', 'fence', 50),
  raft: placeable('raft', 'raft', 1),

  veggie_stew: food('veggie_stew', icons('veggie_stew'), 45, 8, 6),
  fish_stew: food('fish_stew', icons('fish_stew'), 48, 6, 8),
  berry_jam: food('berry_jam', icons('berry_jam'), 20, 4, 5),
  smoked_meat: food('smoked_meat', icons('smoked_meat'), 50, 0, 4),
  roasted_turnip: food('roasted_turnip', icons('roasted_turnip'), 24, 2, 3),
  pumpkin_pie: food('pumpkin_pie', icons('pumpkin_pie'), 52, 4, 10),
  sweet_drink: food('sweet_drink', icons('sweet_drink'), 10, 45, 0),
  healing_potion: { ...food('healing_potion', icons('healing_potion'), 0, 0, 60), stack: 10 },
  great_healing_potion: { ...food('great_healing_potion', icons('great_healing_potion'), 0, 0, 100), stack: 5 },
  stamina_tonic: { id: 'stamina_tonic', stack: 10, icon: icons('stamina_tonic'), food: { hunger: 0, thirst: 10, hp: 0, stamina: 100 } },

  armor_wood: armor('armor_wood', 1),
  armor_crystal: armor('armor_crystal', 6),
  spear_wood: weapon('spear_wood', 'spear', 1, 50, { kind: 'melee', damage: 4, reach: 1.9, arc: 30, cooldown: 0.6, stamina: 4, knockback: 0.5 }),
  spear_iron: weapon('spear_iron', 'spear', 3, 140, { kind: 'melee', damage: 9, reach: 1.9, arc: 30, cooldown: 0.55, stamina: 4, knockback: 0.55 }),
  bow_long: weapon('bow_long', 'bow', 2, 120, { kind: 'bow', damage: 6, reach: 9, arc: 0, cooldown: 0.75, stamina: 3, knockback: 0.3 }),
  sword_crystal: weapon('sword_crystal', 'sword', 3, 200, sword(11)),

  salve: food('salve', icons('salve'), 0, 0, 40),
  alchemy: placeable('alchemy', 'alchemy'),
  sign: placeable('sign', 'sign', 10),
  table: placeable('table', 'table', 10),
  stool: placeable('stool', 'stool', 10),
  lamp_post: placeable('lamp_post', 'lamp_post', 10),
  barrel: placeable('barrel', 'barrel', 10),
};

/** Foods that count as a cooked meal for the story. */
export const COOKED_FOODS: readonly ItemId[] = [
  'cooked_meat', 'roasted_carrot', 'roasted_corn', 'baked_pumpkin', 'cooked_fish', 'veggie_stew', 'fish_stew', 'berry_jam', 'smoked_meat',
  'roasted_turnip', 'pumpkin_pie',
];

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];

export const isItemId = (v: unknown): v is ItemId => typeof v === 'string' && Object.prototype.hasOwnProperty.call(ITEMS, v);
