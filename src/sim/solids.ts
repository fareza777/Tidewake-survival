import { LANDMARK_PROPS } from '@/data/landmarkProps';
import type { Farm } from '@/sim/farm';
import { isAlive, type GatherState } from '@/sim/gather';
import { structureSolids, type Structures } from '@/sim/structures';
import { idx, inBounds, type ResourceNode, type World } from '@/sim/world/types';

/** Tile indexes blocked by landmark scenery (huts, columns, statues). */
export function propSolidTiles(world: World): number[] {
  const out: number[] = [];
  for (const l of world.landmarks) {
    for (const prop of LANDMARK_PROPS[l.id]) {
      for (const [bx, by] of prop.blocks ?? []) {
        const x = l.x + bx;
        const y = l.y + by;
        if (inBounds(x, y, world.size)) out.push(idx(x, y, world.size));
      }
    }
  }
  return out;
}

/** Resource nodes keyed by the tile they stand on. */
export function nodesByTile(world: World): Map<number, ResourceNode> {
  return new Map(world.resources.map((n) => [idx(n.x, n.y, world.size), n]));
}

export interface Blocking {
  /** Tiles the hero and the creatures cannot walk through. */
  solids: Set<number>;
  /** Tiles nothing can be built or tilled on: all of the above, plus torches and soil. */
  occupied: Set<number>;
}

/** Living nodes, landmark scenery and solid buildings block walking; every building and every plot blocks building. */
export function blockingTiles(world: World, props: readonly number[], s: { gather: GatherState; structures: Structures; farm: Farm }): Blocking {
  const solids = new Set<number>(props);
  for (const n of world.resources) if (isAlive(s.gather, n.id)) solids.add(idx(n.x, n.y, world.size));
  for (const tile of structureSolids(s.structures, world.size)) solids.add(tile);
  const occupied = new Set<number>(solids);
  for (const p of s.structures.list) occupied.add(idx(p.x, p.y, world.size));
  for (const key of Object.keys(s.farm.plots)) occupied.add(Number(key));
  return { solids, occupied };
}
