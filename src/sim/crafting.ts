import { ITEMS } from '@/data/items';
import { RECIPES, type Recipe } from '@/data/recipes';
import type { Station } from '@/data/structures';
import { addGear, addItem, canAfford, countItem, spend, type Cost, type Inventory } from '@/sim/inventory';

/** Can the hero use this station right now? Crafting by hand is always possible. */
export const hasStation = (station: Station, near: ReadonlySet<Station>): boolean => station === 'hand' || near.has(station);

/** Recipes the hero can attempt here: those whose station is at hand or nearby. */
export function availableRecipes(near: ReadonlySet<Station>): Recipe[] {
  return RECIPES.filter((r) => hasStation(r.station, near));
}

export function canCraft(inv: Inventory, recipe: Recipe, near: ReadonlySet<Station>): boolean {
  return hasStation(recipe.station, near) && canAfford(inv, recipe.cost);
}

/** What is still missing, as (item, amount) pairs; empty when the recipe is affordable. */
export function missingFor(inv: Inventory, recipe: Recipe): Cost {
  return recipe.cost.flatMap(([item, n]) => {
    const short = n - countItem(inv, item);
    return short > 0 ? ([[item, short]] as const) : [];
  });
}

/** How many batches of the recipe the ingredients and the free room in the backpack allow (0 when none), at most `cap`. */
export function maxCrafts(inv: Inventory, recipe: Recipe, near: ReadonlySet<Station>, cap = 99): number {
  if (!hasStation(recipe.station, near)) return 0;
  let n = 0;
  let cur: Inventory | null = inv;
  while (n < cap && cur) {
    cur = craft(cur, recipe, near);
    if (cur) n++;
  }
  return n;
}

/** Craft once. Null when a station or ingredient is missing, or the product would not fit in the backpack. */
export function craft(inv: Inventory, recipe: Recipe, near: ReadonlySet<Station>): Inventory | null {
  if (!hasStation(recipe.station, near)) return null;
  const paid = spend(inv, recipe.cost);
  if (!paid) return null;
  const { inv: out, left } = ITEMS[recipe.out].tool ? addGear(paid, recipe.out, recipe.qty) : addItem(paid, recipe.out, recipe.qty);
  return left > 0 ? null : out;
}
