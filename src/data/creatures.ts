import { B, type Biome } from '@/sim/world/types';
import type { Drop } from './resources';
import type { BossId } from './dungeons';

export type EnemyId =
  | 'slime' | 'mushroom' | 'wasp' | 'skeleton' | 'zombie' | 'worm' | 'ghost' | 'scorpion' | 'skeleton_warrior'
  | 'frostslime' | 'snowghost' | 'icebone' | 'frostharpy' | 'emberslime' | 'flamewisp' | 'lavacrab' | 'ashimp'
  | 'drowned' | 'bonecrab' | 'pirate' | 'pirate_blue' | 'stormghost' | 'gargoyle';
export type AnimalId = 'rabbit' | 'fox' | 'bird' | 'boar';
export type CreatureId = EnemyId | AnimalId | BossId;

/** Chasers hunt the hero on sight, fleeing animals run from him, defenders only fight back once hurt, bosses follow a script (`src/data/bosses.ts`). */
export type Temper = 'chase' | 'flee' | 'defend' | 'boss';

export interface CreatureSprite {
  atlas: 'monsters' | 'actors';
  /** Frames are named "<group>/<dir>/<n>" (down, left, right, up). */
  group: string;
  /** Walk-cycle length. */
  frames: number;
  /** Sheets that only have front-facing rows (the bonus monsters) always show this row. */
  fixedDir?: 'down' | 'left' | 'right' | 'up';
  /** Drawn this many times bigger than the sheet (bosses). */
  scale?: number;
  /** Colour the sprite is tinted with (the same picture serves several creatures). */
  tint?: number;
}

export interface CreatureDef {
  id: CreatureId;
  temper: Temper;
  hp: number;
  /** Tiles per second when it moves in earnest (hunting or running away). */
  speed: number;
  /** Hit points taken from the hero by one strike; 0 for animals that never fight. */
  damage: number;
  /** Tiles at which it notices the hero. */
  sight: number;
  /** Tiles from its centre at which a strike lands. */
  reach: number;
  /** Seconds of warning before a strike lands, and the pause after it. */
  windup: number;
  cooldown: number;
  /** Half of its collision box, in tiles. */
  radius: number;
  sprite: CreatureSprite;
  drops: readonly Drop[];
  spawn: { biomes: readonly Biome[]; weight: number; when: 'day' | 'night' | 'any' };
}

const monster = (group: string, fixedDir?: CreatureSprite['fixedDir']): CreatureSprite => ({ atlas: 'monsters', group, frames: 3, fixedDir });
const boss = (id: BossId, hp: number, speed: number, damage: number, group: string, drops: readonly Drop[]): CreatureDef => ({
  id, temper: 'boss', hp, speed, damage, sight: 14, reach: 1.4, windup: 0.7, cooldown: 1, radius: 0.7, sprite: { ...monster(group), scale: 1.5 }, drops,
  spawn: { biomes: [], weight: 1, when: 'any' },
});
const critter = (group: string, frames = 3): CreatureSprite => ({ atlas: 'actors', group, frames });

const enemy = (
  id: EnemyId, hp: number, speed: number, damage: number, sight: number, windup: number, cooldown: number,
  sprite: CreatureSprite, drops: readonly Drop[], spawn: CreatureDef['spawn'],
): CreatureDef => ({ id, temper: 'chase', hp, speed, damage, sight, reach: 0.85, windup, cooldown, radius: 0.3, sprite, drops, spawn });

const { FOREST, MOUNTAIN, SWAMP, DESERT, FROST, VOLCANO, WRECK, SKY } = B;

export const CREATURES: Record<CreatureId, CreatureDef> = {
  slime: enemy('slime', 8, 1.1, 6, 5, 0.3, 1.2, monster('m01_0'), [{ item: 'gel', min: 1, max: 2, chance: 0.8 }], { biomes: [FOREST, SWAMP], weight: 10, when: 'any' }),
  mushroom: enemy('mushroom', 10, 0.8, 8, 4, 0.45, 1.5, monster('bonus_1', 'down'), [{ item: 'gel', min: 1, max: 1, chance: 0.4 }, { item: 'fiber', min: 1, max: 2 }], { biomes: [FOREST], weight: 6, when: 'any' }),
  wasp: enemy('wasp', 6, 2.4, 7, 7, 0.3, 1, monster('bonus_3', 'down'), [{ item: 'honey', min: 1, max: 1, chance: 0.6 }], { biomes: [FOREST, MOUNTAIN], weight: 5, when: 'day' }),
  skeleton: enemy('skeleton', 14, 1.5, 10, 7, 0.4, 1.2, monster('m05_0'), [{ item: 'bone', min: 1, max: 2 }], { biomes: [MOUNTAIN, DESERT], weight: 8, when: 'night' }),
  zombie: enemy('zombie', 18, 1, 12, 6, 0.5, 1.6, monster('m02_3'), [{ item: 'bone', min: 1, max: 1, chance: 0.6 }, { item: 'fiber', min: 1, max: 2, chance: 0.5 }], { biomes: [MOUNTAIN, SWAMP], weight: 6, when: 'night' }),
  worm: enemy('worm', 12, 0.9, 8, 4, 0.4, 1.3, monster('bonus_2', 'left'), [{ item: 'gel', min: 1, max: 2 }], { biomes: [SWAMP], weight: 8, when: 'any' }),
  ghost: enemy('ghost', 10, 1.3, 9, 7, 0.35, 1.3, monster('m02_4'), [{ item: 'crystal', min: 1, max: 1, chance: 0.2 }, { item: 'gel', min: 1, max: 1, chance: 0.5 }], { biomes: [SWAMP], weight: 5, when: 'night' }),
  scorpion: enemy('scorpion', 16, 1.8, 12, 6, 0.35, 1.2, monster('m04_5'), [{ item: 'raw_meat', min: 1, max: 2 }, { item: 'hide', min: 1, max: 1, chance: 0.4 }, { item: 'bone', min: 1, max: 1, chance: 0.5 }], { biomes: [DESERT], weight: 8, when: 'any' }),
  skeleton_warrior: { ...enemy('skeleton_warrior', 24, 1.6, 16, 7, 0.45, 1.3, monster('m05_3'), [{ item: 'bone', min: 1, max: 3 }, { item: 'iron_ore', min: 1, max: 1, chance: 0.3 }], { biomes: [DESERT], weight: 5, when: 'night' }), reach: 1 },

  // Frostfang
  frostslime: enemy('frostslime', 24, 1.2, 14, 5, 0.3, 1.2, monster('m01_7'), [{ item: 'gel', min: 1, max: 2 }, { item: 'crystal', min: 1, max: 1, chance: 0.08 }], { biomes: [FROST], weight: 10, when: 'any' }),
  snowghost: enemy('snowghost', 26, 1.5, 17, 7, 0.35, 1.3, monster('m02_5'), [{ item: 'crystal', min: 1, max: 1, chance: 0.2 }, { item: 'gel', min: 1, max: 1, chance: 0.4 }], { biomes: [FROST], weight: 6, when: 'night' }),
  icebone: enemy('icebone', 32, 1.6, 18, 7, 0.4, 1.2, monster('m05_1'), [{ item: 'bone', min: 1, max: 3 }, { item: 'steel_ingot', min: 1, max: 1, chance: 0.08 }], { biomes: [FROST], weight: 7, when: 'any' }),
  frostharpy: enemy('frostharpy', 20, 2.4, 15, 8, 0.3, 1, monster('bonus_4', 'down'), [{ item: 'hide', min: 1, max: 1, chance: 0.5 }, { item: 'raw_meat', min: 1, max: 1, chance: 0.5 }], { biomes: [FROST], weight: 5, when: 'day' }),
  // Emberhold
  emberslime: enemy('emberslime', 26, 1.2, 16, 5, 0.3, 1.2, monster('m01_2'), [{ item: 'gel', min: 1, max: 2 }, { item: 'coal', min: 1, max: 2, chance: 0.5 }], { biomes: [VOLCANO], weight: 10, when: 'any' }),
  flamewisp: enemy('flamewisp', 22, 1.9, 19, 7, 0.3, 1.2, monster('m02_7'), [{ item: 'coal', min: 1, max: 1, chance: 0.6 }, { item: 'crystal', min: 1, max: 1, chance: 0.12 }], { biomes: [VOLCANO], weight: 6, when: 'any' }),
  lavacrab: { ...enemy('lavacrab', 40, 1.4, 22, 6, 0.5, 1.5, monster('m04_6'), [{ item: 'coal', min: 1, max: 3 }, { item: 'iron_ore', min: 1, max: 1, chance: 0.4 }, { item: 'mithril_ore', min: 1, max: 1, chance: 0.1 }], { biomes: [VOLCANO], weight: 6, when: 'any' }), radius: 0.4 },
  ashimp: enemy('ashimp', 28, 2, 19, 7, 0.3, 1.1, monster('bonus_0', 'down'), [{ item: 'coal', min: 1, max: 1, chance: 0.5 }, { item: 'bone', min: 1, max: 1, chance: 0.4 }], { biomes: [VOLCANO], weight: 5, when: 'night' }),
  // Bonepool
  drowned: enemy('drowned', 42, 1.1, 22, 6, 0.5, 1.5, monster('m02_1'), [{ item: 'bone', min: 1, max: 2 }, { item: 'fiber', min: 1, max: 2, chance: 0.5 }], { biomes: [WRECK], weight: 9, when: 'any' }),
  bonecrab: { ...enemy('bonecrab', 44, 1.7, 24, 6, 0.4, 1.3, monster('m04_4'), [{ item: 'raw_meat', min: 1, max: 2 }, { item: 'bone', min: 1, max: 2 }, { item: 'mithril_ore', min: 1, max: 1, chance: 0.12 }], { biomes: [WRECK], weight: 7, when: 'any' }), radius: 0.4 },
  pirate: { ...enemy('pirate', 48, 1.6, 26, 7, 0.45, 1.3, monster('m05_4'), [{ item: 'bone', min: 1, max: 2 }, { item: 'steel_ingot', min: 1, max: 1, chance: 0.12 }, { item: 'rope', min: 1, max: 2, chance: 0.5 }], { biomes: [WRECK], weight: 6, when: 'night' }), reach: 1 },
  pirate_blue: { ...enemy('pirate_blue', 44, 1.7, 28, 7, 0.4, 1.2, monster('m05_5'), [{ item: 'bone', min: 1, max: 2 }, { item: 'crystal', min: 1, max: 1, chance: 0.2 }], { biomes: [WRECK, SKY], weight: 4, when: 'night' }), reach: 1 },
  // Skyreach
  stormghost: enemy('stormghost', 52, 1.7, 28, 8, 0.35, 1.2, monster('m02_6'), [{ item: 'crystal', min: 1, max: 1, chance: 0.3 }, { item: 'mithril_ore', min: 1, max: 1, chance: 0.1 }], { biomes: [SKY], weight: 8, when: 'any' }),
  gargoyle: { ...enemy('gargoyle', 80, 1.2, 34, 7, 0.6, 1.6, monster('m04_1'), [{ item: 'stone', min: 2, max: 4 }, { item: 'crystal', min: 1, max: 2, chance: 0.4 }, { item: 'mithril_ore', min: 1, max: 1, chance: 0.2 }], { biomes: [SKY], weight: 5, when: 'any' }), radius: 0.45 },

  mossback: boss('mossback', 140, 1.6, 12, 'm04_2', [{ item: 'compass', min: 1, max: 1 }, { item: 'armor_moss', min: 1, max: 1 }]),
  ironbones: boss('ironbones', 160, 1.7, 14, 'm04_3', [{ item: 'hull_planks', min: 1, max: 1 }, { item: 'armor_ironbones', min: 1, max: 1 }]),
  mirelord: boss('mirelord', 180, 1.5, 9, 'm04_0', [{ item: 'lighthouse_key', min: 1, max: 1 }, { item: 'armor_mire', min: 1, max: 1 }]),
  glacierking: {
    ...boss('glacierking', 320, 1.5, 20, 'm04_1', [{ item: 'frost_sigil', min: 1, max: 1 }, { item: 'armor_frost', min: 1, max: 1 }]),
    sprite: { ...monster('m04_1'), scale: 1.7, tint: 0x9fe0ff }, radius: 0.75,
  },
  forgeheart: {
    ...boss('forgeheart', 360, 1.5, 22, 'm04_6', [{ item: 'ember_sigil', min: 1, max: 1 }, { item: 'armor_ember', min: 1, max: 1 }]),
    sprite: { ...monster('m04_6'), scale: 1.9 }, radius: 0.8,
  },
  drownedqueen: {
    ...boss('drownedqueen', 400, 1.5, 24, 'm04_4', [{ item: 'tide_sigil', min: 1, max: 1 }, { item: 'armor_tide', min: 1, max: 1 }]),
    sprite: { ...monster('m04_4'), scale: 1.8, tint: 0x8ff0d0 }, radius: 0.8,
  },
  stormtitan: {
    ...boss('stormtitan', 520, 1.6, 28, 'm04_1', [{ item: 'sky_sigil', min: 1, max: 1 }, { item: 'armor_sky', min: 1, max: 1 }]),
    sprite: { ...monster('m04_1'), scale: 2, tint: 0xffe08a }, radius: 0.9,
  },
  hollowkeeper: {
    ...boss('hollowkeeper', 260, 1.6, 16, 'bonus_5', [{ item: 'beacon_core', min: 1, max: 1 }, { item: 'armor_hollow', min: 1, max: 1 }]),
    sprite: { ...monster('bonus_5', 'down'), scale: 1.8 },
    radius: 0.8,
  },

  rabbit: { id: 'rabbit', temper: 'flee', hp: 3, speed: 3, damage: 0, sight: 4, reach: 0, windup: 0, cooldown: 0, radius: 0.2, sprite: critter('bunny1/walk'), drops: [{ item: 'raw_meat', min: 1, max: 1 }], spawn: { biomes: [FOREST], weight: 10, when: 'any' } },
  fox: { id: 'fox', temper: 'flee', hp: 6, speed: 2.9, damage: 0, sight: 5, reach: 0, windup: 0, cooldown: 0, radius: 0.22, sprite: critter('fox1/walk'), drops: [{ item: 'raw_meat', min: 1, max: 2 }, { item: 'hide', min: 1, max: 1, chance: 0.6 }], spawn: { biomes: [FOREST, MOUNTAIN, DESERT], weight: 5, when: 'any' } },
  bird: { id: 'bird', temper: 'flee', hp: 2, speed: 3.1, damage: 0, sight: 4, reach: 0, windup: 0, cooldown: 0, radius: 0.18, sprite: critter('bird1/walk'), drops: [{ item: 'raw_meat', min: 1, max: 1, chance: 0.7 }], spawn: { biomes: [FOREST, MOUNTAIN, SWAMP, DESERT], weight: 8, when: 'day' } },
  boar: { id: 'boar', temper: 'defend', hp: 14, speed: 2.3, damage: 8, sight: 6, reach: 0.9, windup: 0.4, cooldown: 1.2, radius: 0.32, sprite: critter('pig2/move', 4), drops: [{ item: 'raw_meat', min: 2, max: 3 }, { item: 'hide', min: 1, max: 2, chance: 0.8 }, { item: 'bone', min: 1, max: 1, chance: 0.4 }], spawn: { biomes: [FOREST, SWAMP], weight: 4, when: 'any' } },
};

export const CREATURE_IDS = Object.keys(CREATURES) as CreatureId[];

/** True for creatures that attack the hero without being provoked (monsters and bosses). */
export const isHostileKind = (id: CreatureId): boolean => CREATURES[id].temper === 'chase' || CREATURES[id].temper === 'boss';

/** Creatures that may appear in a biome at this time of day, with their spawn weights. */
export function spawnWeights(biome: Biome, night: boolean): (readonly [CreatureId, number])[] {
  return CREATURE_IDS
    .filter((id) => {
      const s = CREATURES[id].spawn;
      return s.biomes.includes(biome) && (s.when === 'any' || (s.when === 'night') === night);
    })
    .map((id) => [id, CREATURES[id].spawn.weight] as const);
}
