import Phaser from 'phaser';
import { GROUND_TILES, TILES_KEY, type DungeonTheme } from '@/data/terrainTiles';
import { FULL, GROUND_LAYERS, layerMasks } from '@/sim/blend';
import { dungeonFrame, tileHash } from '@/sim/tileView';
import { idx, inBounds, isWater, type Terrain, type World } from '@/sim/world/types';
import {
  DECOR_KEY, DECOR_SETS, DECOR_VARIANTS, PARTIAL_ROWS, SPARKLE_KEY, blendKey, createBlendAtlases, createDecorTexture, createSparkleTexture,
  decorBase,
} from './groundAtlas';

export const TILE = 16;
/** Ground of the whole level as culled tilemap layers (only visible tiles are drawn). */
export class TerrainLayer {
  /** `theme` draws a dungeon's flagstones and brick; without it the island is drawn with soft, curving borders between terrains. */
  constructor(scene: Phaser.Scene, world: World, theme?: DungeonTheme) {
    if (theme) this.buildDungeon(scene, world, theme);
    else this.buildIsland(scene, world);
  }

  private buildDungeon(scene: Phaser.Scene, world: World, theme: DungeonTheme): void {
    const size = world.size;
    const groundData: number[][] = [];
    for (let y = 0; y < size; y++) {
      const g: number[] = [];
      for (let x = 0; x < size; x++) g.push(dungeonFrame(world, x, y, theme));
      groundData.push(g);
    }
    const groundMap = scene.make.tilemap({ data: groundData, tileWidth: TILE, tileHeight: TILE });
    const groundTiles = groundMap.addTilesetImage('ground', TILES_KEY, TILE, TILE, 0, 0);
    if (!groundTiles) throw new Error('TerrainLayer: tileset textures are not loaded');
    // Extra tiles are kept drawn beyond the screen edge, so a camera shake never uncovers a strip of bare background.
    groundMap.createLayer(0, groundTiles, 0, 0)?.setDepth(-100).setCullPadding(4, 4);
  }

  private buildIsland(scene: Phaser.Scene, world: World): void {
    createBlendAtlases(scene);
    createDecorTexture(scene);
    createSparkleTexture(scene);
    // Dual grid: tile (a, b) sits on the corner of cells (a-1, b-1)..(a, b), half a tile up and left of cell (a, b).
    const n = world.size + 1;
    const data = GROUND_LAYERS.map(() => Array.from({ length: n }, () => new Array<number>(n).fill(-1)));
    for (let b = 0; b < n; b++) {
      for (let a = 0; a < n; a++) {
        const masks = layerMasks(world, a, b);
        masks.forEach((mask, k) => {
          if (mask === 0) return;
          const row = mask === FULL ? PARTIAL_ROWS + plainRow(GROUND_LAYERS[k], a, b) : Math.floor(tileHash(a, b, 31 + k) * PARTIAL_ROWS);
          data[k][b][a] = row * 16 + mask;
        });
      }
    }
    data.forEach((layer, k) => {
      const map = scene.make.tilemap({ data: layer, tileWidth: TILE, tileHeight: TILE });
      const tiles = map.addTilesetImage(blendKey(k), blendKey(k), TILE, TILE, 0, 0);
      if (!tiles) throw new Error('TerrainLayer: blend atlas is missing');
      map.createLayer(0, tiles, -TILE / 2, -TILE / 2)?.setDepth(-100 + k * 0.1).setCullPadding(4, 4);
    });
    this.addDecor(scene, world);
    this.addSparkles(scene, world);
  }

  /** Flowers, tufts, pebbles and shells scattered over cells that sit well inside their terrain. */
  private addDecor(scene: Phaser.Scene, world: World): void {
    const size = world.size;
    const data = Array.from({ length: size }, () => new Array<number>(size).fill(-1));
    const same = (x: number, y: number, t: number): boolean => inBounds(x, y, size) && world.terrain[idx(x, y, size)] === t;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const t = world.terrain[idx(x, y, size)];
        const setIndex = DECOR_SETS.findIndex((s) => s.terrain === t);
        if (setIndex < 0) continue;
        const set = DECOR_SETS[setIndex];
        if (tileHash(x, y, 911) >= set.chance) continue;
        if (!same(x - 1, y, t) || !same(x + 1, y, t) || !same(x, y - 1, t) || !same(x, y + 1, t)) continue;
        const pick = Math.floor(tileHash(x, y, 5) * set.stamps.length * DECOR_VARIANTS);
        data[y][x] = decorBase[setIndex] + pick;
      }
    }
    const map = scene.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
    const tiles = map.addTilesetImage(DECOR_KEY, DECOR_KEY, TILE, TILE, 0, 0);
    if (tiles) map.createLayer(0, tiles, 0, 0)?.setDepth(-85);
  }

  /** Glints on the water: two sparse layers that fade in and out in turn. */
  private addSparkles(scene: Phaser.Scene, world: World): void {
    const size = world.size;
    const a = Array.from({ length: size }, () => new Array<number>(size).fill(-1));
    const b = Array.from({ length: size }, () => new Array<number>(size).fill(-1));
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!isWater(world.terrain[idx(x, y, size)]) || tileHash(x, y, 77) >= 0.14) continue;
        (tileHash(x, y, 78) < 0.5 ? a : b)[y][x] = tileHash(x, y, 79) < 0.5 ? 0 : 1;
      }
    }
    [a, b].forEach((data, i) => {
      const map = scene.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
      const tiles = map.addTilesetImage(SPARKLE_KEY, SPARKLE_KEY, TILE, TILE, 0, 0);
      const layer = tiles ? map.createLayer(0, tiles, 0, 0) : null;
      if (!layer) return;
      layer.setDepth(-84).setAlpha(i === 0 ? 1 : 0);
      scene.tweens.add({ targets: layer, alpha: i === 0 ? 0 : 1, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
  }
}

/** Which plain tile of a terrain to show at a spot, by the same weights as before. */
function plainRow(terrain: number, x: number, y: number): number {
  const list = GROUND_TILES[terrain as Terrain];
  const total = list.reduce((s, [, w]) => s + w, 0);
  let roll = tileHash(x, y) * total;
  for (let i = 0; i < list.length; i++) {
    roll -= list[i][1];
    if (roll < 0) return i;
  }
  return list.length - 1;
}
