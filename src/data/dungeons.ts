import type { ItemId } from './items';
import type { CreatureId } from './creatures';
import type { DungeonTheme } from './terrainTiles';
import type { DungeonId } from '@/sim/dungeon/progress';

export type BossId = 'mossback' | 'ironbones' | 'mirelord' | 'hollowkeeper' | 'glacierking' | 'forgeheart' | 'drownedqueen' | 'stormtitan';

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
  lighthouse: { id: 'lighthouse', theme: 'ruin', roster: ['ghost', 'skeleton_warrior', 'scorpion'], boss: 'hollowkeeper', story: 'beacon_core', armor: 'armor_hollow' },
  frostcave: { id: 'frostcave', theme: 'ice', roster: ['frostslime', 'snowghost', 'icebone'], boss: 'glacierking', story: 'frost_sigil', armor: 'armor_frost' },
  magmaforge: { id: 'magmaforge', theme: 'magma', roster: ['emberslime', 'flamewisp', 'lavacrab'], boss: 'forgeheart', story: 'ember_sigil', armor: 'armor_ember' },
  drownedcrypt: { id: 'drownedcrypt', theme: 'bone', roster: ['drowned', 'bonecrab', 'pirate'], boss: 'drownedqueen', story: 'tide_sigil', armor: 'armor_tide' },
  skyspire: { id: 'skyspire', theme: 'void', roster: ['stormghost', 'gargoyle', 'pirate_blue'], boss: 'stormtitan', story: 'sky_sigil', armor: 'armor_sky' },
  depths: { id: 'depths', theme: 'moss', roster: ['slime', 'mushroom', 'worm', 'wasp'], boss: 'mossback', story: 'compass', armor: 'armor_moss' },
};

const DEPTH_THEMES: readonly DungeonTheme[] = ['moss', 'mine', 'ruin', 'ice', 'magma', 'bone', 'void'];
const DEPTH_TIERS: readonly { roster: readonly CreatureId[]; bosses: readonly BossId[] }[] = [
  { roster: ['slime', 'mushroom', 'worm', 'wasp'], bosses: ['mossback'] },
  { roster: ['skeleton', 'zombie', 'scorpion', 'ghost'], bosses: ['ironbones', 'mirelord'] },
  { roster: ['skeleton_warrior', 'frostslime', 'icebone', 'emberslime', 'flamewisp'], bosses: ['hollowkeeper', 'glacierking', 'forgeheart'] },
  { roster: ['lavacrab', 'drowned', 'bonecrab', 'pirate', 'stormghost', 'gargoyle'], bosses: ['drownedqueen', 'stormtitan'] },
];

/** The Endless Depths: each floor is a fresh dungeon whose look, guards and boss grow with the floor number. */
export function depthDef(floor: number): DungeonDef {
  const tier = DEPTH_TIERS[floor <= 3 ? 0 : floor <= 6 ? 1 : floor <= 10 ? 2 : 3];
  return { ...DUNGEONS.depths, theme: DEPTH_THEMES[(floor - 1) % DEPTH_THEMES.length], roster: tier.roster, boss: tier.bosses[(floor - 1) % tier.bosses.length] };
}
