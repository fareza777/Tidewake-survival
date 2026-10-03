import { RECIPES, type Recipe } from '@/data/recipes';
import type { Station } from '@/data/structures';
import { addItem, canAfford, countItem, spend, type Cost, type Inventory } from '@/sim/inventory';

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

/** Craft once. Null when a station or ingredient is missing, or the product would not fit in the backpack. */
export function craft(inv: Inventory, recipe: Recipe, near: ReadonlySet<Station>): Inventory | null {
  if (!hasStation(recipe.station, near)) return null;
  const paid = spend(inv, recipe.cost);
  if (!paid) return null;
  const { inv: out, left } = addItem(paid, recipe.out, recipe.qty);
  return left > 0 ? null : out;
}
