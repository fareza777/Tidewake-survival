import { LANDMARK_PROPS } from '@/data/landmarkProps';
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
