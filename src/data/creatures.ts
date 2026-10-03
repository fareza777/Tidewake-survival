import { B, type Biome } from '@/sim/world/types';
import type { Drop } from './resources';

export type EnemyId = 'slime' | 'mushroom' | 'wasp' | 'skeleton' | 'zombie' | 'worm' | 'ghost' | 'scorpion' | 'skeleton_warrior';
export type AnimalId = 'rabbit' | 'fox' | 'bird' | 'boar';
export type CreatureId = EnemyId | AnimalId;

/** Chasers hunt the hero on sight, fleeing animals run from him, defenders only fight back once hurt. */
export type Temper = 'chase' | 'flee' | 'defend';

export interface CreatureSprite {
  atlas: 'monsters' | 'actors';
  /** Frames are named "<group>/<dir>/<n>" (down, left, right, up). */
  group: string;
  /** Walk-cycle length. */
  frames: number;
  /** Sheets that only have front-facing rows (the bonus monsters) always show this row. */
  fixedDir?: 'down' | 'left' | 'right' | 'up';
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
const critter = (group: string, frames = 3): CreatureSprite => ({ atlas: 'actors', group, frames });

const enemy = (
  id: EnemyId, hp: number, speed: number, damage: number, sight: number, windup: number, cooldown: number,
  sprite: CreatureSprite, drops: readonly Drop[], spawn: CreatureDef['spawn'],
): CreatureDef => ({ id, temper: 'chase', hp, speed, damage, sight, reach: 0.85, windup, cooldown, radius: 0.3, sprite, drops, spawn });

const { FOREST, MOUNTAIN, SWAMP, DESERT } = B;

export const CREATURES: Record<CreatureId, CreatureDef> = {
  slime: enemy('slime', 8, 1.1, 6, 5, 0.3, 1.2, monster('m01_0'), [{ item: 'gel', min: 1, max: 2, chance: 0.8 }], { biomes: [FOREST, SWAMP], weight: 10, when: 'any' }),
  mushroom: enemy('mushroom', 10, 0.8, 8, 4, 0.45, 1.5, monster('bonus_1', 'down'), [{ item: 'gel', min: 1, max: 1, chance: 0.4 }, { item: 'fiber', min: 1, max: 2 }], { biomes: [FOREST], weight: 6, when: 'any' }),
  wasp: enemy('wasp', 6, 2.4, 7, 7, 0.3, 1, monster('bonus_3', 'down'), [{ item: 'honey', min: 1, max: 1, chance: 0.6 }], { biomes: [FOREST, MOUNTAIN], weight: 5, when: 'day' }),
  skeleton: enemy('skeleton', 14, 1.5, 10, 7, 0.4, 1.2, monster('m05_0'), [{ item: 'bone', min: 1, max: 2 }], { biomes: [MOUNTAIN, DESERT], weight: 8, when: 'night' }),
  zombie: enemy('zombie', 18, 1, 12, 6, 0.5, 1.6, monster('m02_3'), [{ item: 'bone', min: 1, max: 1, chance: 0.6 }, { item: 'fiber', min: 1, max: 2, chance: 0.5 }], { biomes: [MOUNTAIN, SWAMP], weight: 6, when: 'night' }),
  worm: enemy('worm', 12, 0.9, 8, 4, 0.4, 1.3, monster('bonus_2', 'left'), [{ item: 'gel', min: 1, max: 2 }], { biomes: [SWAMP], weight: 8, when: 'any' }),
  ghost: enemy('ghost', 10, 1.3, 9, 7, 0.35, 1.3, monster('m02_4'), [{ item: 'crystal', min: 1, max: 1, chance: 0.2 }, { item: 'gel', min: 1, max: 1, chance: 0.5 }], { biomes: [SWAMP], weight: 5, when: 'night' }),
  scorpion: enemy('scorpion', 16, 1.8, 12, 6, 0.35, 1.2, monster('m04_5'), [{ item: 'raw_meat', min: 1, max: 2 }, { item: 'bone', min: 1, max: 1, chance: 0.5 }], { biomes: [DESERT], weight: 8, when: 'any' }),
  skeleton_warrior: { ...enemy('skeleton_warrior', 24, 1.6, 16, 7, 0.45, 1.3, monster('m05_3'), [{ item: 'bone', min: 1, max: 3 }, { item: 'iron_ore', min: 1, max: 1, chance: 0.3 }], { biomes: [DESERT], weight: 5, when: 'night' }), reach: 1 },

  rabbit: { id: 'rabbit', temper: 'flee', hp: 3, speed: 3, damage: 0, sight: 4, reach: 0, windup: 0, cooldown: 0, radius: 0.2, sprite: critter('bunny1/walk'), drops: [{ item: 'raw_meat', min: 1, max: 1 }], spawn: { biomes: [FOREST], weight: 10, when: 'any' } },
  fox: { id: 'fox', temper: 'flee', hp: 6, speed: 2.9, damage: 0, sight: 5, reach: 0, windup: 0, cooldown: 0, radius: 0.22, sprite: critter('fox1/walk'), drops: [{ item: 'raw_meat', min: 1, max: 2 }], spawn: { biomes: [FOREST, MOUNTAIN, DESERT], weight: 5, when: 'any' } },
  bird: { id: 'bird', temper: 'flee', hp: 2, speed: 3.1, damage: 0, sight: 4, reach: 0, windup: 0, cooldown: 0, radius: 0.18, sprite: critter('bird1/walk'), drops: [{ item: 'raw_meat', min: 1, max: 1, chance: 0.7 }], spawn: { biomes: [FOREST, MOUNTAIN, SWAMP, DESERT], weight: 8, when: 'day' } },
  boar: { id: 'boar', temper: 'defend', hp: 14, speed: 2.3, damage: 8, sight: 6, reach: 0.9, windup: 0.4, cooldown: 1.2, radius: 0.32, sprite: critter('pig2/move', 4), drops: [{ item: 'raw_meat', min: 2, max: 3 }, { item: 'bone', min: 1, max: 1, chance: 0.4 }], spawn: { biomes: [FOREST, SWAMP], weight: 4, when: 'any' } },
};

export const CREATURE_IDS = Object.keys(CREATURES) as CreatureId[];

/** True for creatures that attack the hero without being provoked. */
export const isHostileKind = (id: CreatureId): boolean => CREATURES[id].temper === 'chase';

/** Creatures that may appear in a biome at this time of day, with their spawn weights. */
export function spawnWeights(biome: Biome, night: boolean): (readonly [CreatureId, number])[] {
  return CREATURE_IDS
    .filter((id) => {
      const s = CREATURES[id].spawn;
      return s.biomes.includes(biome) && (s.when === 'any' || (s.when === 'night') === night);
    })
    .map((id) => [id, CREATURES[id].spawn.weight] as const);
}
