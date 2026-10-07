import type { BuffId } from '@/sim/buffs';
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
  | 'salve' | 'alchemy' | 'sign' | 'table' | 'stool' | 'lamp_post' | 'barrel'
  | 'coal' | 'steel_ingot' | 'mithril_ore' | 'mithril_ingot' | 'hide' | 'anvil'
  | 'axe_steel' | 'pickaxe_steel' | 'axe_mithril' | 'pickaxe_mithril' | 'sword_steel' | 'sword_mithril' | 'spear_steel'
  | 'armor_leather' | 'armor_steel' | 'armor_mithril'
  | 'cap_leather' | 'helm_iron' | 'helm_steel' | 'helm_crystal' | 'helm_mithril'
  | 'boots_leather' | 'boots_iron' | 'boots_steel' | 'boots_mithril'
  | 'ring_might' | 'ring_swift' | 'amulet_vigor' | 'amulet_fortune' | 'amulet_warmth'
  | 'wood_wall' | 'stone_wall' | 'wood_door' | 'wood_floor' | 'tent' | 'turret'
  | 'warm_stew' | 'potion_strength' | 'potion_swift' | 'potion_ward' | 'potion_warmth'
  | 'frost_sigil' | 'ember_sigil' | 'tide_sigil' | 'sky_sigil' | 'armor_frost' | 'armor_ember' | 'armor_tide' | 'armor_sky' | 'boat' | 'gold';

/** Where a piece of gear is worn. */
export type GearSlot = 'armor' | 'helm' | 'boots' | 'charm';

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
  tool?: { type: ToolType; tier: Tier; durability: number };
  weapon?: WeaponStats;
  /**
   * Worn gear. `defense` cuts every blow from a creature; `slot` is where it goes (body armour when absent); the rest are small
   * bonuses: walking speed and damage as fractions (0.05 = 5%), warmth against the cold, stamina recovered a second, and luck.
   */
  armor?: { defense: number; slot?: GearSlot; speed?: number; damage?: number; warmth?: number; regen?: number; luck?: number };
  /** Never lost to the death penalty: keys, story items and the armour bosses leave behind. */
  keep?: true;
  food?: {
    hunger: number; thirst: number; hp: number; stamina?: number;
    /** Hot food warms the hero through. */
    warmth?: number;
    /** A lasting effect it gives, for this many seconds. */
    buff?: { id: BuffId; seconds: number };
    /** An effect it cures. */
    cure?: BuffId;
    /** Raw and risky: now and then it makes the hero sick. */
    risky?: true;
  };
  place?: StructureId;
  seed?: CropId;
}

export type Tier = 1 | 2 | 3 | 4 | 5;

const icons = (frame: string): IconRef => ({ atlas: 'icons', frame });
const pack = (frame: string): IconRef => ({ atlas: 'props', frame });

const material = (id: ItemId, frame: string): ItemDef => ({ id, stack: 99, icon: icons(frame) });
const food = (id: ItemId, icon: IconRef, hunger: number, thirst: number, hp: number): ItemDef => ({
  id, stack: 20, icon, food: { hunger, thirst, hp },
});
type FoodExtra = Partial<NonNullable<ItemDef['food']>>;
/** A food with more to it than hunger and thirst: warmth, a lasting effect, a cure. */
const dish = (id: ItemId, icon: IconRef, hunger: number, thirst: number, hp: number, extra: FoodExtra): ItemDef => ({
  id, stack: 20, icon, food: { hunger, thirst, hp, ...extra },
});
const seed = (id: ItemId, crop: CropId): ItemDef => ({ id, stack: 50, icon: icons(id), seed: crop });
const tool = (id: ItemId, type: ToolType, tier: Tier, durability: number): ItemDef => ({
  id, stack: 1, icon: icons(id), tool: { type, tier, durability },
});
const weapon = (id: ItemId, type: 'sword' | 'spear' | 'bow', tier: Tier, durability: number, stats: WeaponStats): ItemDef => ({
  ...tool(id, type, tier, durability), weapon: stats,
});
const sword = (damage: number): WeaponStats => ({ kind: 'melee', damage, reach: 1.7, arc: 130, cooldown: 0.42, stamina: 3, knockback: 0.35 });
const armor = (id: ItemId, defense: number): ItemDef => ({ id, stack: 1, icon: icons(id), armor: { defense } });
const gear = (id: ItemId, slot: GearSlot, defense: number, extra: Omit<NonNullable<ItemDef['armor']>, 'defense' | 'slot'> = {}): ItemDef => ({
  id, stack: 1, icon: icons(id), armor: { defense, slot, ...extra },
});
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
  roasted_carrot: dish('roasted_carrot', icons('roasted_carrot'), 22, 2, 3, { warmth: 8 }),
  roasted_corn: dish('roasted_corn', icons('roasted_corn'), 28, 0, 4, { warmth: 8 }),
  baked_pumpkin: dish('baked_pumpkin', icons('baked_pumpkin'), 40, 4, 6, { warmth: 12 }),

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

  raw_meat: dish('raw_meat', icons('raw_meat'), 8, 0, 0, { risky: true }),
  cooked_meat: dish('cooked_meat', icons('cooked_meat'), 35, 0, 4, { buff: { id: 'wellfed', seconds: 150 } }),
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
  raw_fish: dish('raw_fish', icons('raw_fish'), 9, 0, 0, { risky: true }),
  cooked_fish: dish('cooked_fish', icons('cooked_fish'), 32, 0, 4, { buff: { id: 'wellfed', seconds: 150 } }),
  big_fish: material('big_fish', 'big_fish'),
  sailcloth: material('sailcloth', 'sailcloth'),
  antidote: dish('antidote', icons('antidote'), 0, 8, 30, { cure: 'poisoned' }),

  campfire: placeable('campfire', 'campfire'),
  workbench: placeable('workbench', 'workbench'),
  furnace: placeable('furnace', 'furnace'),
  bed: placeable('bed', 'bed'),
  chest: placeable('chest', 'chest'),
  torch: placeable('torch', 'torch', 20),
  fence: placeable('fence', 'fence', 50),
  raft: placeable('raft', 'raft', 1),

  veggie_stew: dish('veggie_stew', icons('veggie_stew'), 45, 8, 6, { warmth: 15, buff: { id: 'wellfed', seconds: 300 } }),
  fish_stew: dish('fish_stew', icons('fish_stew'), 48, 6, 8, { warmth: 15, buff: { id: 'energized', seconds: 240 } }),
  berry_jam: dish('berry_jam', icons('berry_jam'), 20, 4, 5, { buff: { id: 'swift', seconds: 180 } }),
  smoked_meat: dish('smoked_meat', icons('smoked_meat'), 50, 0, 4, { buff: { id: 'fortified', seconds: 300 } }),
  roasted_turnip: dish('roasted_turnip', icons('roasted_turnip'), 24, 2, 3, { warmth: 8 }),
  pumpkin_pie: dish('pumpkin_pie', icons('pumpkin_pie'), 52, 4, 10, { buff: { id: 'strong', seconds: 240 } }),
  sweet_drink: dish('sweet_drink', icons('sweet_drink'), 10, 45, 0, { buff: { id: 'energized', seconds: 120 } }),
  healing_potion: { ...food('healing_potion', icons('healing_potion'), 0, 0, 60), stack: 10 },
  great_healing_potion: { ...food('great_healing_potion', icons('great_healing_potion'), 0, 0, 100), stack: 5 },
  stamina_tonic: { id: 'stamina_tonic', stack: 10, icon: icons('stamina_tonic'), food: { hunger: 0, thirst: 0, hp: 0, stamina: 100, buff: { id: 'energized', seconds: 90 } } },

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

  coal: material('coal', 'coal'),
  steel_ingot: material('steel_ingot', 'steel_ingot'),
  mithril_ore: material('mithril_ore', 'mithril_ore'),
  mithril_ingot: material('mithril_ingot', 'mithril_ingot'),
  hide: material('hide', 'hide'),
  anvil: placeable('anvil', 'anvil', 5),

  axe_steel: tool('axe_steel', 'axe', 4, 260),
  pickaxe_steel: tool('pickaxe_steel', 'pickaxe', 4, 260),
  axe_mithril: tool('axe_mithril', 'axe', 5, 400),
  pickaxe_mithril: tool('pickaxe_mithril', 'pickaxe', 5, 400),
  sword_steel: weapon('sword_steel', 'sword', 4, 260, sword(14)),
  sword_mithril: weapon('sword_mithril', 'sword', 5, 380, sword(19)),
  spear_steel: weapon('spear_steel', 'spear', 4, 220, { kind: 'melee', damage: 12, reach: 1.9, arc: 30, cooldown: 0.52, stamina: 4, knockback: 0.6 }),

  armor_leather: armor('armor_leather', 2),
  armor_steel: armor('armor_steel', 8),
  armor_mithril: armor('armor_mithril', 12),
  cap_leather: gear('cap_leather', 'helm', 1),
  helm_iron: gear('helm_iron', 'helm', 2),
  helm_steel: gear('helm_steel', 'helm', 3),
  helm_crystal: gear('helm_crystal', 'helm', 3, { luck: 0.08 }),
  helm_mithril: gear('helm_mithril', 'helm', 5),
  boots_leather: gear('boots_leather', 'boots', 1, { speed: 0.04 }),
  boots_iron: gear('boots_iron', 'boots', 2),
  boots_steel: gear('boots_steel', 'boots', 3, { speed: 0.03 }),
  boots_mithril: gear('boots_mithril', 'boots', 4, { speed: 0.08 }),
  ring_might: gear('ring_might', 'charm', 0, { damage: 0.12 }),
  ring_swift: gear('ring_swift', 'charm', 0, { speed: 0.08 }),
  amulet_vigor: gear('amulet_vigor', 'charm', 0, { regen: 4 }),
  amulet_fortune: gear('amulet_fortune', 'charm', 1, { luck: 0.15 }),
  amulet_warmth: gear('amulet_warmth', 'charm', 0, { warmth: 25 }),

  frost_sigil: keepsake('frost_sigil'),
  ember_sigil: keepsake('ember_sigil'),
  tide_sigil: keepsake('tide_sigil'),
  sky_sigil: keepsake('sky_sigil'),
  armor_frost: { ...gear('armor_frost', 'armor', 11, { warmth: 25 }), keep: true },
  armor_ember: { ...gear('armor_ember', 'armor', 12, { damage: 0.06 }), keep: true },
  armor_tide: { ...gear('armor_tide', 'armor', 13, { regen: 3 }), keep: true },
  armor_sky: { ...gear('armor_sky', 'armor', 15, { speed: 0.05, luck: 0.05 }), keep: true },
  boat: placeable('boat', 'boat', 1),
  gold: { ...material('gold', 'gold'), stack: 999, keep: true },

  wood_wall: placeable('wood_wall', 'wood_wall', 50),
  stone_wall: placeable('stone_wall', 'stone_wall', 50),
  wood_door: placeable('wood_door', 'wood_door', 10),
  wood_floor: placeable('wood_floor', 'wood_floor', 99),
  tent: placeable('tent', 'tent', 5),
  turret: placeable('turret', 'turret', 5),

  warm_stew: dish('warm_stew', icons('warm_stew'), 55, 10, 8, { warmth: 40, buff: { id: 'warm', seconds: 600 } }),
  potion_strength: { ...dish('potion_strength', icons('potion_strength'), 0, 0, 0, { buff: { id: 'strong', seconds: 300 } }), stack: 10 },
  potion_swift: { ...dish('potion_swift', icons('potion_swift'), 0, 0, 0, { buff: { id: 'swift', seconds: 300 } }), stack: 10 },
  potion_ward: { ...dish('potion_ward', icons('potion_ward'), 0, 0, 0, { buff: { id: 'fortified', seconds: 300 } }), stack: 10 },
  potion_warmth: { ...dish('potion_warmth', icons('potion_warmth'), 0, 0, 0, { warmth: 30, buff: { id: 'warm', seconds: 600 } }), stack: 10 },
};

/** Foods that count as a cooked meal for the story. */
export const COOKED_FOODS: readonly ItemId[] = [
  'cooked_meat', 'roasted_carrot', 'roasted_corn', 'baked_pumpkin', 'cooked_fish', 'veggie_stew', 'fish_stew', 'berry_jam', 'smoked_meat',
  'roasted_turnip', 'pumpkin_pie', 'warm_stew',
];

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];

export const isItemId = (v: unknown): v is ItemId => typeof v === 'string' && Object.prototype.hasOwnProperty.call(ITEMS, v);
