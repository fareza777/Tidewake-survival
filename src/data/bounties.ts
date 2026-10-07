import type { CreatureId } from '@/data/creatures';
import type { ItemId } from '@/data/items';
import type { NpcId } from '@/data/npcs';

/** One thing a trader may ask for. `unit` is the gold paid for each creature slain or item delivered. */
export type Wanted =
  | { kind: 'hunt'; target: CreatureId; min: number; max: number; unit: number }
  | { kind: 'fetch'; target: ItemId; min: number; max: number; unit: number };

const hunt = (target: CreatureId, min: number, max: number, unit: number): Wanted => ({ kind: 'hunt', target, min, max, unit });
const fetch = (target: ItemId, min: number, max: number, unit: number): Wanted => ({ kind: 'fetch', target, min, max, unit });

/** What each trader posts on the board; one of these is offered each day. */
export const BOUNTIES: Partial<Record<NpcId, readonly Wanted[]>> = {
  marlo: [
    hunt('slime', 6, 12, 5), hunt('wasp', 4, 8, 7), hunt('skeleton', 4, 8, 9), hunt('zombie', 3, 6, 12), hunt('scorpion', 3, 6, 12), hunt('boar', 2, 4, 14),
    fetch('wood', 30, 60, 1), fetch('stone', 30, 60, 1), fetch('fiber', 20, 40, 2), fetch('iron_ore', 6, 12, 5), fetch('bone', 8, 16, 3), fetch('honey', 3, 6, 8),
  ],
  rhea: [
    hunt('frostslime', 5, 10, 9), hunt('snowghost', 3, 6, 14), hunt('icebone', 3, 6, 15), hunt('frostharpy', 3, 6, 14),
    fetch('hide', 4, 8, 9), fetch('coal', 8, 16, 5), fetch('crystal', 2, 4, 22), fetch('steel_ingot', 1, 2, 45),
  ],
  kael: [
    hunt('emberslime', 5, 10, 10), hunt('flamewisp', 3, 6, 15), hunt('lavacrab', 3, 5, 20), hunt('ashimp', 3, 6, 15),
    fetch('coal', 10, 20, 5), fetch('iron_ore', 6, 12, 6), fetch('mithril_ore', 1, 3, 55), fetch('steel_ingot', 1, 3, 45),
  ],
  sable: [
    hunt('drowned', 4, 8, 14), hunt('bonecrab', 3, 6, 17), hunt('pirate', 3, 5, 20), hunt('pirate_blue', 2, 4, 22),
    fetch('bone', 10, 20, 4), fetch('crystal', 3, 5, 24), fetch('rope', 6, 12, 5), fetch('mithril_ore', 1, 3, 60),
  ],
  aero: [
    hunt('stormghost', 3, 6, 22), hunt('gargoyle', 2, 4, 32), hunt('pirate_blue', 2, 4, 24),
    fetch('crystal', 4, 8, 26), fetch('mithril_ore', 2, 4, 62), fetch('mithril_ingot', 1, 2, 120),
  ],
};
