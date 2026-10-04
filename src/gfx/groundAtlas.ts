import Phaser from 'phaser';
import { GROUND_TILES, TILES_KEY } from '@/data/terrainTiles';
import { TILE_FRAMES } from '@/data/tileIndex';
import { GROUND_LAYERS, fieldValue } from '@/sim/blend';
import { T } from '@/sim/world/types';

const TILE = 16;
/** Columns of a blend atlas: tile `mask` (0..15) of a row is the shape that covers the corners set in `mask`. */
const COLS = 16;
/** Rows of partly covered shapes per terrain, each with its own wobble and its own speckle tile. */
export const PARTIAL_ROWS = 3;

export const blendKey = (layer: number): string => `blend_${layer}`;
export const DECOR_KEY = 'decor_ss';
export const SPARKLE_KEY = 'sparkle_ss';

type Rgb = readonly [number, number, number];

/** A soft band drawn just outside a border (foam, haze) and/or a darker band just inside it (a wet or shaded fringe). */
interface Rim {
  outside?: { color: Rgb; alpha: number; width: number };
  inside?: { shade: number; width: number };
}

const FOAM: Rim = { outside: { color: [255, 255, 255], alpha: 0.8, width: 0.15 }, inside: { shade: 0.9, width: 0.07 } };
const SHADED: Rim = { inside: { shade: 0.86, width: 0.08 } };
const RIMS: readonly Rim[] = [
  {},
  { outside: { color: [200, 238, 255], alpha: 0.34, width: 0.11 } },
  FOAM, SHADED, SHADED, SHADED, SHADED, { inside: { shade: 0.78, width: 0.09 } },
];

function tilesPixels(scene: Phaser.Scene): { data: Uint8ClampedArray; width: number } {
  const source = scene.textures.get(TILES_KEY).getSourceImage() as HTMLImageElement;
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('groundAtlas: no 2d canvas');
  ctx.drawImage(source, 0, 0);
  return { data: ctx.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width };
}

function toTexture(scene: Phaser.Scene, key: string, image: ImageData): void {
  const tex = scene.textures.createCanvas(key, image.width, image.height);
  if (!tex) return;
  tex.getContext().putImageData(image, 0, 0);
  tex.refresh();
}

/** Builds the blend atlas of every ground layer (once per game). Row `PARTIAL_ROWS + i` is the plain tile of the layer's i-th ground tile. */
export function createBlendAtlases(scene: Phaser.Scene): void {
  if (scene.textures.exists(blendKey(0))) return;
  const sheet = tilesPixels(scene);
  const frame = (name: keyof typeof TILE_FRAMES): { x: number; y: number } => {
    const f = scene.textures.get(TILES_KEY).get(TILE_FRAMES[name]);
    return { x: f.cutX, y: f.cutY };
  };
  GROUND_LAYERS.forEach((terrain, layer) => {
    const names = GROUND_TILES[terrain].map(([n]) => n);
    const rows = PARTIAL_ROWS + names.length;
    const image = new ImageData(COLS * TILE, rows * TILE);
    const rim = RIMS[layer];
    const put = (x: number, y: number, r: number, g: number, b: number, a: number): void => {
      const o = (y * image.width + x) * 4;
      image.data[o] = r;
      image.data[o + 1] = g;
      image.data[o + 2] = b;
      image.data[o + 3] = a;
    };
    for (let row = 0; row < rows; row++) {
      const full = row >= PARTIAL_ROWS;
      const from = frame(names[full ? row - PARTIAL_ROWS : row % names.length]);
      for (let mask = 0; mask < COLS; mask++) {
        if (full && mask !== 15) continue;
        for (let py = 0; py < TILE; py++) {
          for (let px = 0; px < TILE; px++) {
            const s = ((from.y + py) * sheet.width + from.x + px) * 4;
            const g = full ? 1 : fieldValue(mask, px, py, row + 1);
            const x = mask * TILE + px;
            const y = row * TILE + py;
            if (g >= 0.5) {
              const shade = rim.inside && g < 0.5 + rim.inside.width ? rim.inside.shade : 1;
              put(x, y, sheet.data[s] * shade, sheet.data[s + 1] * shade, sheet.data[s + 2] * shade, 255);
            } else if (rim.outside && g > 0.5 - rim.outside.width) {
              const k = (g - (0.5 - rim.outside.width)) / rim.outside.width;
              const [r, gg, b] = rim.outside.color;
              put(x, y, r, gg, b, Math.round(255 * rim.outside.alpha * Math.pow(k, 0.8)));
            }
          }
        }
      }
    }
    toTexture(scene, blendKey(layer), image);
  });
}

/** Tiny pictures: '.' is empty, every other letter is looked up in the palette. */
type Stamp = readonly string[];

const GRASS_PALETTE: Record<string, string> = {
  g: '#3f8a3a', d: '#2d6a30', l: '#74c45a', w: '#f6f3e8', y: '#f2c94c', Y: '#f7dc62', o: '#e08a2a', p: '#ee86ab', b: '#7ab0ee', s: '#c9d9f0',
};
const SAND_PALETTE: Record<string, string> = {
  s: '#c7b27f', S: '#97834f', h: '#e6d8aa', w: '#fbf3e4', p: '#f0b8b0', o: '#e88a3c', g: '#8a9a4a',
};
const DIRT_PALETTE: Record<string, string> = { s: '#8c6a48', S: '#5f432c', h: '#b79670', g: '#5a7a38' };
const SWAMP_PALETTE: Record<string, string> = { g: '#4f7a3c', d: '#385a30', l: '#7aa65a', p: '#e6a0c0', w: '#cfe0b0', b: '#2f4a38' };
const DESERT_PALETTE: Record<string, string> = { s: '#b8845a', S: '#8c5f3c', h: '#dcb287', g: '#5d8a4a', G: '#3f6a38', w: '#efe3cf' };
const STONE_PALETTE: Record<string, string> = { s: '#8d8c97', S: '#62616f', h: '#b9b8c4', g: '#5f8a54' };

interface DecorSet {
  terrain: number;
  palette: Record<string, string>;
  /** Chance that a cell deep inside the terrain gets a decoration. */
  chance: number;
  stamps: readonly Stamp[];
}

export const DECOR_SETS: readonly DecorSet[] = [
  {
    terrain: T.GRASS, palette: GRASS_PALETTE, chance: 0.2,
    stamps: [
      ['.l.l.', '.gdg.', 'gd.dg'], ['..l..', '.ldl.', '.gdg.'], ['l..l', 'gl.g', 'dgdg'], ['.l.', 'gdg'],
      ['.w.', 'wyw', '.w.', '.d.'], ['.Y.', 'YoY', '.Y.', '.d.'], ['.p.', 'pyp', '.p.', '.d.'], ['.b.', 'bwb', '.b.', '.d.'],
      ['w'], ['y'], ['gg.', '.gg'],
    ],
  },
  {
    terrain: T.SAND, palette: SAND_PALETTE, chance: 0.1,
    stamps: [['hs', 'sS'], ['.w.', 'wpw'], ['.o.', 'ooo', 'o.o'], ['g.g', '.g.', '.g.'], ['s'], ['S'], ['hh']],
  },
  { terrain: T.DIRT, palette: DIRT_PALETTE, chance: 0.12, stamps: [['hs', 'sS'], ['s'], ['S.', '.s'], ['g.g', '.g.']] },
  {
    terrain: T.SWAMP, palette: SWAMP_PALETTE, chance: 0.14,
    stamps: [['.d.', '.d.', 'gd.'], ['d.d', 'dgd', '.d.'], ['.ggg.', 'gglgg', '.ggg.'], ['.p.', 'ggg'], ['w.', '.w'], ['b']],
  },
  { terrain: T.DESERT, palette: DESERT_PALETTE, chance: 0.08, stamps: [['hs', 'sS'], ['.g.', 'gGg', '.G.'], ['w.w', '.w.'], ['S'], ['s.']] },
  { terrain: T.STONE, palette: STONE_PALETTE, chance: 0.1, stamps: [['hs', 'sS'], ['g.g', '.g.'], ['s'], ['S.', '.h']] },
];

/** Decoration tiles flattened into one strip; `decorBase[i]` is the first tile of DECOR_SETS[i]. Each stamp has two positions. */
export const DECOR_VARIANTS = 2;
export const decorBase = DECOR_SETS.map((_, i) => DECOR_SETS.slice(0, i).reduce((n, s) => n + s.stamps.length * DECOR_VARIANTS, 0));
const DECOR_TOTAL = DECOR_SETS.reduce((n, s) => n + s.stamps.length * DECOR_VARIANTS, 0);

export function createDecorTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(DECOR_KEY)) return;
  const tex = scene.textures.createCanvas(DECOR_KEY, DECOR_TOTAL * TILE, TILE);
  if (!tex) return;
  const ctx = tex.getContext();
  let n = 0;
  for (const set of DECOR_SETS) {
    for (const stamp of set.stamps) {
      for (let v = 0; v < DECOR_VARIANTS; v++) {
        const w = Math.max(...stamp.map((r) => r.length));
        const ox = v === 0 ? 3 : TILE - w - 3;
        const oy = v === 0 ? TILE - stamp.length - 3 : 3;
        stamp.forEach((row, y) => {
          [...row].forEach((ch, x) => {
            if (ch === '.') return;
            ctx.fillStyle = set.palette[ch];
            ctx.fillRect(n * TILE + ox + x, oy + y, 1, 1);
          });
        });
        n++;
      }
    }
  }
  tex.refresh();
}

/** Two glints for the water: tile 0 is a pair of dots, tile 1 a short streak. */
export function createSparkleTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(SPARKLE_KEY)) return;
  const tex = scene.textures.createCanvas(SPARKLE_KEY, TILE * 2, TILE);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(4, 5, 1, 1);
  ctx.fillRect(11, 10, 1, 1);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(5, 5, 1, 1);
  ctx.fillRect(TILE + 5, 8, 4, 1);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillRect(TILE + 6, 8, 2, 1);
  tex.refresh();
}
