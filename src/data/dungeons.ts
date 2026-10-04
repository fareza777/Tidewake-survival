import type { ItemId } from './items';
import type { CreatureId } from './creatures';
import type { DungeonTheme } from './terrainTiles';
import type { DungeonId } from '@/sim/dungeon/progress';

export type BossId = 'mossback' | 'ironbones' | 'mirelord';

export interface DungeonDef {
  id: DungeonId;
  theme: DungeonTheme;
  /** Creatures that guard the fight rooms and the vault. */
  roster: readonly CreatureId[];
  boss: BossId;
  /** The story item the boss drops. */
  story: ItemId;
  /** The armour the boss drops. */
  armor: ItemId;
}

export const DUNGEONS: Record<DungeonId, DungeonDef> = {
  grotto: { id: 'grotto', theme: 'moss', roster: ['slime', 'mushroom', 'worm'], boss: 'mossback', story: 'compass', armor: 'armor_moss' },
  deepmine: { id: 'deepmine', theme: 'mine', roster: ['skeleton', 'zombie', 'wasp'], boss: 'ironbones', story: 'hull_planks', armor: 'armor_ironbones' },
  ruin: { id: 'ruin', theme: 'ruin', roster: ['scorpion', 'skeleton_warrior', 'ghost'], boss: 'mirelord', story: 'lighthouse_key', armor: 'armor_mire' },
};
