import Phaser from 'phaser';
import { CROPS } from '@/data/crops';
import { TILE_FRAMES } from '@/data/tileIndex';
import { TILES_KEY } from '@/data/terrainTiles';
import { TILE } from '@/gfx/TerrainLayer';
import { stageOf, type Farm, type Plot } from '@/sim/farm';
import { WORLD_SIZE } from '@/sim/world/types';

/** Tilled soil (darker when watered) and the crops growing on it. */
export class FarmLayer {
  private soil = new Map<number, Phaser.GameObjects.Image>();
  private crops = new Map<number, Phaser.GameObjects.Image>();

  constructor(private scene: Phaser.Scene, farm: Farm) {
    this.rebuild(farm);
  }

  /** Redraw every plot (used after loading and when a new day changes the growth stages). */
  rebuild(farm: Farm): void {
    for (const [key, plot] of Object.entries(farm.plots)) this.refresh(Number(key), plot);
  }

  /** Redraw one tile; pass undefined when the plot is gone. */
  refresh(tile: number, plot: Plot | undefined): void {
    const x = tile % WORLD_SIZE;
    const y = Math.floor(tile / WORLD_SIZE);
    this.soil.get(tile)?.destroy();
    this.crops.get(tile)?.destroy();
    this.soil.delete(tile);
    this.crops.delete(tile);
    if (!plot) return;
    const frame = TILE_FRAMES[plot.watered ? 'soil.wet' : 'soil.dry'];
    this.soil.set(tile, this.scene.add.image(x * TILE, y * TILE, TILES_KEY, frame).setOrigin(0, 0).setDepth(-80));
    if (!plot.crop) return;
    const base = (y + 1) * TILE - 1;
    const sprite = this.scene.add.image((x + 0.5) * TILE, base, 'props', `plant/${CROPS[plot.crop].sheet}/${stageOf(plot)}`);
    this.crops.set(tile, sprite.setOrigin(0.5, 1).setDepth(base));
  }
}
