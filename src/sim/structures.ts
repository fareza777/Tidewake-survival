import { CHEST_SLOTS, STRUCTURES, type Station, type StructureId } from '@/data/structures';
import { emptyInventory, type Inventory } from '@/sim/inventory';
import type { Vec } from '@/sim/movement';
import { idx, inBounds, isWater, type World } from '@/sim/world/types';

export interface Structure {
  readonly id: number;
  readonly type: StructureId;
  readonly x: number;
  readonly y: number;
  /** Contents of a chest. */
  readonly inv?: Inventory;
}

export interface Structures {
  readonly next: number;
  readonly list: readonly Structure[];
}

/** How far (tiles) the hero can place something, and how close a station must be to be used. */
export const PLACE_REACH = 4;
export const STATION_REACH = 3;

export const emptyStructures = (): Structures => ({ next: 1, list: [] });

export type PlaceResult = { ok: true } | { ok: false; reason: 'bounds' | 'water' | 'occupied' | 'far' | 'hero' };

/**
 * Can `type` go on tile (x, y)? `occupied` holds the tiles that are already taken by solid things (resource nodes,
 * landmark scenery, soil, structures); the hero's own tile is never allowed.
 */
export function canPlace(world: World, structures: Structures, occupied: ReadonlySet<number>, x: number, y: number, hero: Vec): PlaceResult {
  if (!inBounds(x, y, world.size)) return { ok: false, reason: 'bounds' };
  const i = idx(x, y, world.size);
  if (isWater(world.terrain[i])) return { ok: false, reason: 'water' };
  if (occupied.has(i) || structureAt(structures, x, y)) return { ok: false, reason: 'occupied' };
  if (Math.floor(hero.x) === x && Math.floor(hero.y) === y) return { ok: false, reason: 'hero' };
  if (Math.hypot(x + 0.5 - hero.x, y + 0.5 - hero.y) > PLACE_REACH) return { ok: false, reason: 'far' };
  return { ok: true };
}

export function placeStructure(s: Structures, type: StructureId, x: number, y: number): Structures {
  const built: Structure = type === 'chest' ? { id: s.next, type, x, y, inv: emptyInventory(CHEST_SLOTS) } : { id: s.next, type, x, y };
  return { next: s.next + 1, list: [...s.list, built] };
}

export function removeStructure(s: Structures, id: number): Structures {
  return { next: s.next, list: s.list.filter((p) => p.id !== id) };
}

export function structureAt(s: Structures, x: number, y: number): Structure | undefined {
  return s.list.find((p) => p.x === x && p.y === y);
}

export function setStructureInventory(s: Structures, id: number, inv: Inventory): Structures {
  return { next: s.next, list: s.list.map((p) => (p.id === id ? { ...p, inv } : p)) };
}

/** Crafting stations within reach of the hero. */
export function nearbyStations(s: Structures, pos: Vec): Set<Station> {
  const near = new Set<Station>();
  for (const p of s.list) {
    const station = STRUCTURES[p.type].station;
    if (station && Math.hypot(p.x + 0.5 - pos.x, p.y + 0.5 - pos.y) <= STATION_REACH) near.add(station);
  }
  return near;
}

/** Tiles structures block (torches do not). */
export function structureSolids(s: Structures, size: number): number[] {
  return s.list.filter((p) => STRUCTURES[p.type].solid).map((p) => idx(p.x, p.y, size));
}
