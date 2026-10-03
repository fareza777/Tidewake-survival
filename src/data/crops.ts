import type { ItemId } from './items';

export type CropId = 'carrot' | 'turnip' | 'pumpkin' | 'corn';

export interface CropDef {
  id: CropId;
  seed: ItemId;
  produce: ItemId;
  /** Watered days needed to ripen. */
  growDays: number;
  /** Which `plant/<sheet>/<stage>` sprite strip in the props atlas shows this crop. */
  sheet: number;
  /** Last growth stage of the strip; the plant is ripe at this stage. */
  ripeStage: number;
  yield: readonly [number, number];
}

export const CROPS: Record<CropId, CropDef> = {
  carrot: { id: 'carrot', seed: 'carrot_seed', produce: 'carrot', growDays: 3, sheet: 5, ripeStage: 3, yield: [1, 2] },
  turnip: { id: 'turnip', seed: 'turnip_seed', produce: 'turnip', growDays: 3, sheet: 6, ripeStage: 3, yield: [1, 2] },
  pumpkin: { id: 'pumpkin', seed: 'pumpkin_seed', produce: 'pumpkin', growDays: 5, sheet: 7, ripeStage: 4, yield: [1, 1] },
  corn: { id: 'corn', seed: 'corn_seed', produce: 'corn', growDays: 4, sheet: 8, ripeStage: 4, yield: [1, 2] },
};

/** Chance that harvesting a crop also returns one seed of the same kind. */
export const SEED_RETURN_CHANCE = 0.5;
