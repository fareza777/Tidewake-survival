import { ITEMS, type ItemId } from '@/data/items';
import type { NpcId } from '@/data/npcs';
import type { Slot } from '@/sim/inventory';
import { maxDurability, plusMult } from '@/sim/upgrade';

/** What one of a thing fetches from a trader. Anything not listed is worked out from what it is (see `sellPrice`). */
const SELL: Partial<Record<ItemId, number>> = {
  wood: 1, stone: 1, fiber: 1, plank: 2, rope: 3, iron_ore: 4, iron_ingot: 10, crystal: 14, coconut: 2, berries: 2, carrot: 3, turnip: 3,
  pumpkin: 5, corn: 4, gel: 2, bone: 3, hide: 6, coal: 3, steel_ingot: 28, mithril_ore: 32, mithril_ingot: 80, raw_meat: 3, cooked_meat: 7,
  honey: 6, raw_fish: 3, cooked_fish: 7, big_fish: 24, arrow: 1, bandage: 4, antidote: 12, healing_potion: 18, great_healing_potion: 40,
  stamina_tonic: 16, sailcloth: 14, torch: 1,
};

/** How much a hero pays for a trader's goods: a list of what each trader has on the shelf. */
export interface Offer {
  item: ItemId;
  /** Gold for one purchase. */
  price: number;
  /** How many come in one purchase. */
  qty?: number;
}

export const SHOPS: Partial<Record<NpcId, readonly Offer[]>> = {
  marlo: [
    { item: 'arrow', price: 14, qty: 10 }, { item: 'rope', price: 8 }, { item: 'torch', price: 10, qty: 5 }, { item: 'bandage', price: 12 },
    { item: 'sailcloth', price: 40 }, { item: 'carrot_seed', price: 5 }, { item: 'turnip_seed', price: 5 }, { item: 'pumpkin_seed', price: 8 },
    { item: 'corn_seed', price: 8 }, { item: 'small_key', price: 60 },
  ],
  rhea: [
    { item: 'steel_ingot', price: 80 }, { item: 'coal', price: 20, qty: 5 }, { item: 'hide', price: 14, qty: 2 }, { item: 'warm_stew', price: 20 },
    { item: 'potion_warmth', price: 50 }, { item: 'cap_leather', price: 55 }, { item: 'boots_leather', price: 60 }, { item: 'amulet_warmth', price: 240 },
  ],
  kael: [
    { item: 'steel_ingot', price: 80 }, { item: 'mithril_ore', price: 120 }, { item: 'potion_strength', price: 60 }, { item: 'potion_ward', price: 60 },
    { item: 'great_healing_potion', price: 70 }, { item: 'ring_might', price: 280 }, { item: 'anvil', price: 150 },
  ],
  sable: [
    { item: 'crystal', price: 45 }, { item: 'antidote', price: 28 }, { item: 'healing_potion', price: 34 }, { item: 'ring_swift', price: 280 },
    { item: 'amulet_vigor', price: 280 }, { item: 'boss_key', price: 400 },
  ],
  aero: [
    { item: 'mithril_ingot', price: 280 }, { item: 'amulet_fortune', price: 320 }, { item: 'potion_swift', price: 60 }, { item: 'stamina_tonic', price: 45 },
    { item: 'great_healing_potion', price: 70 }, { item: 'helm_mithril', price: 520 },
  ],
};

/** What a trader pays for a stack slot per unit, or 0 when it cannot be sold (keepsakes, gold, tools nearly worn out). */
export function sellPrice(slot: Slot): number {
  const def = ITEMS[slot.item];
  if (def.keep || slot.item === 'gold') return 0;
  const fixed = SELL[slot.item];
  if (fixed !== undefined) return fixed;
  if (def.tool || def.armor) {
    const tier = def.tool?.tier ?? Math.min(5, Math.ceil((def.armor?.defense ?? 1) / 3));
    const base = [4, 10, 24, 60, 120, 260][Math.min(5, tier)];
    const worn = def.tool && slot.dur !== undefined ? Math.max(0.2, slot.dur / maxDurability(slot.item, slot.plus)) : 1;
    return Math.max(1, Math.round(base * worn * plusMult(slot.plus)));
  }
  if (def.food) return Math.max(2, Math.round((def.food.hunger + def.food.thirst + def.food.hp) / 5));
  if (def.place) return 4;
  return 1;
}
