import type { Vec } from '@/sim/movement';
import { idx, inBounds, type ResourceNode } from '@/sim/world/types';

/** The closest living node within `radius` tiles of `pos` (positions in tile units), or null. */
export function nearestNode(
  nodes: ReadonlyMap<number, ResourceNode>, size: number, pos: Vec, radius: number, alive: (id: number) => boolean,
): ResourceNode | null {
  const reach = Math.ceil(radius);
  const cx = Math.floor(pos.x);
  const cy = Math.floor(pos.y);
  let best: ResourceNode | null = null;
  let bestDist = Infinity;
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (!inBounds(x, y, size)) continue;
      const node = nodes.get(idx(x, y, size));
      if (!node || !alive(node.id)) continue;
      const d = Math.hypot(node.x + 0.5 - pos.x, node.y + 0.5 - pos.y);
      if (d <= radius && d < bestDist) {
        best = node;
        bestDist = d;
      }
    }
  }
  return best;
}
