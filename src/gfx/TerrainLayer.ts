import Phaser from 'phaser';
import { TILES_KEY } from '@/data/terrainTiles';
import { groundFrame, shoreMask, SHORE_E, SHORE_N, SHORE_S, SHORE_W } from '@/sim/tileView';
import { idx, type World } from '@/sim/world/types';

export const TILE = 16;
const SHORE_KEY = 'shore_ss';

/** A strip of 16 tiles: tile `m` has a foam line on every side whose SHORE_* bit is set in `m`. */
function createShoreTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(SHORE_KEY)) return;
  const tex = scene.textures.createCanvas(SHORE_KEY, TILE * 16, TILE);
  if (!tex) return;
  const ctx = tex.getContext();
  const line = (ox: number, x: number, y: number, w: number, h: number, a: number): void => {
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillRect(ox + x, y, w, h);
  };
  for (let mask = 1; mask < 16; mask++) {
    const ox = mask * TILE;
    if (mask & SHORE_N) {
      line(ox, 0, 0, TILE, 2, 0.7);
      line(ox, 0, 2, TILE, 1, 0.3);
    }
    if (mask & SHORE_E) {
      line(ox, TILE - 2, 0, 2, TILE, 0.7);
      line(ox, TILE - 3, 0, 1, TILE, 0.3);
    }
    if (mask & SHORE_S) {
      line(ox, 0, TILE - 2, TILE, 2, 0.7);
      line(ox, 0, TILE - 3, TILE, 1, 0.3);
    }
    if (mask & SHORE_W) {
      line(ox, 0, 0, 2, TILE, 0.7);
      line(ox, 2, 0, 1, TILE, 0.3);
    }
  }
  tex.refresh();
}

/** Ground and shoreline of the whole island as two culled tilemap layers (only visible tiles are drawn). */
export class TerrainLayer {
  readonly ground: Phaser.Tilemaps.TilemapLayer;
  readonly shore: Phaser.Tilemaps.TilemapLayer;

  constructor(scene: Phaser.Scene, world: World) {
    createShoreTexture(scene);
    const size = world.size;
    const groundData: number[][] = [];
    const shoreData: number[][] = [];
    for (let y = 0; y < size; y++) {
      const g: number[] = [];
      const s: number[] = [];
      for (let x = 0; x < size; x++) {
        g.push(groundFrame(world.terrain[idx(x, y, size)], x, y));
        const mask = shoreMask(world, x, y);
        s.push(mask === 0 ? -1 : mask);
      }
      groundData.push(g);
      shoreData.push(s);
    }
    const groundMap = scene.make.tilemap({ data: groundData, tileWidth: TILE, tileHeight: TILE });
    const groundTiles = groundMap.addTilesetImage('ground', TILES_KEY, TILE, TILE, 0, 0);
    const shoreMap = scene.make.tilemap({ data: shoreData, tileWidth: TILE, tileHeight: TILE });
    const shoreTiles = shoreMap.addTilesetImage('shore', SHORE_KEY, TILE, TILE, 0, 0);
    if (!groundTiles || !shoreTiles) throw new Error('TerrainLayer: tileset textures are not loaded');
    const ground = groundMap.createLayer(0, groundTiles, 0, 0);
    const shore = shoreMap.createLayer(0, shoreTiles, 0, 0);
    if (!ground || !shore) throw new Error('TerrainLayer: could not create tilemap layers');
    this.ground = ground.setDepth(-100);
    this.shore = shore.setDepth(-90);
  }
}
