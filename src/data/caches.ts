import type { ItemId } from '@/data/items';
import type { IslandId } from '@/sim/world/types';

export interface CacheLoot {
  item: ItemId;
  qty: number;
}

/** How many hidden chests lie scattered over each far island (beside its dock and its dungeon). */
export const CACHES_PER_ISLAND = 4;

/**
 * What each hidden chest of a far island holds. The first of them keeps a piece of rare gear that cannot be bought; the
 * others hold gold and the goods of that island.
 */
const LOOT: Partial<Record<IslandId, readonly (readonly CacheLoot[])[]>> = {
  frost: [
    [{ item: 'amulet_warmth', qty: 1 }, { item: 'gold', qty: 60 }],
    [{ item: 'gold', qty: 70 }, { item: 'hide', qty: 4 }, { item: 'coal', qty: 6 }],
    [{ item: 'gold', qty: 90 }, { item: 'steel_ingot', qty: 1 }, { item: 'potion_warmth', qty: 1 }],
    [{ item: 'gold', qty: 80 }, { item: 'crystal', qty: 2 }, { item: 'warm_stew', qty: 2 }],
  ],
  ember: [
    [{ item: 'ring_might', qty: 1 }, { item: 'gold', qty: 80 }],
    [{ item: 'gold', qty: 90 }, { item: 'coal', qty: 10 }, { item: 'iron_ore', qty: 4 }],
    [{ item: 'gold', qty: 110 }, { item: 'mithril_ore', qty: 1 }, { item: 'potion_ward', qty: 1 }],
    [{ item: 'gold', qty: 100 }, { item: 'steel_ingot', qty: 2 }, { item: 'great_healing_potion', qty: 1 }],
  ],
  wreck: [
    [{ item: 'ring_swift', qty: 1 }, { item: 'gold', qty: 100 }],
    [{ item: 'gold', qty: 110 }, { item: 'bone', qty: 8 }, { item: 'rope', qty: 6 }],
    [{ item: 'gold', qty: 130 }, { item: 'crystal', qty: 3 }, { item: 'antidote', qty: 2 }],
    [{ item: 'gold', qty: 120 }, { item: 'mithril_ore', qty: 1 }, { item: 'sailcloth', qty: 2 }],
  ],
  sky: [
    [{ item: 'amulet_fortune', qty: 1 }, { item: 'gold', qty: 120 }],
    [{ item: 'gold', qty: 130 }, { item: 'crystal', qty: 4 }, { item: 'stamina_tonic', qty: 2 }],
    [{ item: 'gold', qty: 150 }, { item: 'mithril_ore', qty: 2 }, { item: 'potion_swift', qty: 1 }],
    [{ item: 'gold', qty: 140 }, { item: 'mithril_ingot', qty: 1 }, { item: 'great_healing_potion', qty: 1 }],
  ],
};

/** The contents of hidden chest number `n` (1 to CACHES_PER_ISLAND) of an island. */
export function cacheLoot(island: IslandId, n: number): readonly CacheLoot[] {
  return LOOT[island]?.[n - 1] ?? [];
}
