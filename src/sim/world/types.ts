export const WORLD_SIZE = 160;

/** Island terrain, plus the floor and walls of dungeon interiors (FLOOR and WALL only occur in dungeons). */
export const T = { DEEP: 0, SHALLOW: 1, SAND: 2, GRASS: 3, SWAMP: 4, DIRT: 5, STONE: 6, DESERT: 7, RIVER: 8, FLOOR: 9, WALL: 10 } as const;
export type Terrain = (typeof T)[keyof typeof T];

export const B = { SEA: 0, FOREST: 1, MOUNTAIN: 2, SWAMP: 3, DESERT: 4 } as const;
export type Biome = (typeof B)[keyof typeof B];

export const isWater = (t: number): boolean => t === T.DEEP || t === T.SHALLOW || t === T.RIVER;
/** The player can wade through shallow water and rivers; only deep water and dungeon walls block. */
export const isWalkable = (t: number): boolean => t !== T.DEEP && t !== T.WALL;

export type LandmarkId =
  | 'start' | 'camp' | 'sailor' | 'herbalist' | 'miner' | 'grotto' | 'deepmine' | 'ruin'
  | 'lighthouse' | 'tablets' | 'treasure1' | 'treasure2' | 'treasure3';

export interface Landmark {
  id: LandmarkId;
  x: number;
  y: number;
  biome: Biome;
}

export type ResourceKind = 'tree' | 'palm' | 'bush' | 'rock' | 'ore' | 'crystal' | 'swamptree' | 'redrock' | 'mithril';

export interface ResourceNode {
  id: number;
  kind: ResourceKind;
  x: number;
  y: number;
  /** Random 0..255; the renderer picks a sprite as variant % frames.length. */
  variant: number;
}

export interface World {
  seed: number;
  size: number;
  terrain: Uint8Array;
  biome: Uint8Array;
  landmarks: Landmark[];
  resources: ResourceNode[];
  start: { x: number; y: number };
}

export const idx = (x: number, y: number, size = WORLD_SIZE): number => y * size + x;
export const inBounds = (x: number, y: number, size = WORLD_SIZE): boolean => x >= 0 && y >= 0 && x < size && y < size;
