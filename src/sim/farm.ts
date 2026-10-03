import { CROPS, SEED_RETURN_CHANCE, type CropId } from '@/data/crops';
import type { ItemId } from '@/data/items';
import type { Rng } from '@/core/rng';
import { T, idx, inBounds, type World } from '@/sim/world/types';

/** One tilled tile. `crop` is null for bare tilled soil. */
export interface Plot {
  readonly crop: CropId | null;
  /** Watered days the crop has grown. */
  readonly growth: number;
  /** Watered today; cleared when a new day starts. */
  readonly watered: boolean;
}

/** Tilled soil, keyed by tile index. */
export interface Farm {
  readonly plots: Readonly<Record<number, Plot>>;
}

export const emptyFarm = (): Farm => ({ plots: {} });

const BARE: Plot = { crop: null, growth: 0, watered: false };

/** Only grass and bare dirt can be tilled. */
export function canTill(world: World, farm: Farm, occupied: ReadonlySet<number>, x: number, y: number): boolean {
  if (!inBounds(x, y, world.size)) return false;
  const i = idx(x, y, world.size);
  const t = world.terrain[i];
  return (t === T.GRASS || t === T.DIRT) && !occupied.has(i) && !(i in farm.plots);
}

export function till(farm: Farm, tile: number): Farm {
  return tile in farm.plots ? farm : { plots: { ...farm.plots, [tile]: BARE } };
}

export function plotAt(farm: Farm, tile: number): Plot | undefined {
  return farm.plots[tile];
}

/** Sow a seed on empty tilled soil; null when the tile is not tilled or already planted. */
export function plant(farm: Farm, tile: number, crop: CropId): Farm | null {
  const p = farm.plots[tile];
  if (!p || p.crop) return null;
  return { plots: { ...farm.plots, [tile]: { crop, growth: 0, watered: p.watered } } };
}

export function water(farm: Farm, tile: number): Farm {
  const p = farm.plots[tile];
  if (!p || p.watered) return farm;
  return { plots: { ...farm.plots, [tile]: { ...p, watered: true } } };
}

export const isRipe = (p: Plot | undefined): boolean => !!p && p.crop !== null && p.growth >= CROPS[p.crop].growDays;

/** Which sprite stage (0 to ripeStage) to show. */
export function stageOf(p: Plot): number {
  if (!p.crop) return 0;
  const def = CROPS[p.crop];
  return Math.min(def.ripeStage, Math.floor((p.growth / def.growDays) * def.ripeStage));
}

/** A new day: watered crops grow a day, then every plot dries out. */
export function advanceDay(farm: Farm): Farm {
  const plots: Record<number, Plot> = {};
  for (const [key, p] of Object.entries(farm.plots)) {
    const grows = p.crop !== null && p.watered && p.growth < CROPS[p.crop].growDays;
    plots[Number(key)] = { crop: p.crop, growth: grows ? p.growth + 1 : p.growth, watered: false };
  }
  return { plots };
}

export interface Harvest {
  farm: Farm;
  items: { item: ItemId; qty: number }[];
}

/** Pick a ripe crop: the soil stays tilled and bare. Null when nothing is ripe there. */
export function harvest(farm: Farm, tile: number, rng: Rng): Harvest | null {
  const p = farm.plots[tile];
  if (!p || !p.crop || !isRipe(p)) return null;
  const def = CROPS[p.crop];
  const items: Harvest['items'] = [{ item: def.produce, qty: rng.int(def.yield[0], def.yield[1]) }];
  if (rng.chance(SEED_RETURN_CHANCE)) items.push({ item: def.seed, qty: 1 });
  return { farm: { plots: { ...farm.plots, [tile]: BARE } }, items };
}
