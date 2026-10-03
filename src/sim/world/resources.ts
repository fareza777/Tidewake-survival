import type { Rng } from '@/core/rng';
import { RESERVE_RADIUS } from './landmarks';
import { B, T, idx, inBounds, isWater, type Landmark, type ResourceKind, type ResourceNode } from './types';

interface Rule {
  kind: ResourceKind;
  p: number;
}

/** Chance per tile, by biome and ground. Rolls are exclusive: at most one node per tile. */
function rulesFor(biome: number, ground: number): Rule[] {
  switch (biome) {
    case B.FOREST:
      if (ground === T.SAND) return [{ kind: 'palm', p: 0.03 }];
      return [{ kind: 'tree', p: 0.14 }, { kind: 'bush', p: 0.02 }, { kind: 'rock', p: 0.012 }];
    case B.MOUNTAIN:
      if (ground === T.SAND) return [{ kind: 'palm', p: 0.01 }, { kind: 'rock', p: 0.02 }];
      if (ground === T.STONE) return [{ kind: 'rock', p: 0.08 }, { kind: 'ore', p: 0.035 }, { kind: 'crystal', p: 0.007 }];
      return [{ kind: 'tree', p: 0.04 }, { kind: 'rock', p: 0.05 }, { kind: 'ore', p: 0.008 }];
    case B.SWAMP:
      if (ground === T.SAND) return [{ kind: 'palm', p: 0.01 }];
      return [{ kind: 'swamptree', p: 0.1 }, { kind: 'bush', p: 0.02 }, { kind: 'rock', p: 0.008 }];
    case B.DESERT:
      if (ground === T.SAND) return [{ kind: 'palm', p: 0.01 }];
      return [{ kind: 'redrock', p: 0.035 }, { kind: 'rock', p: 0.01 }];
    default:
      return [];
  }
}

/** Scatter harvestable nodes over dry land, keeping landmark surroundings clear and nodes one tile apart. */
export function scatterResources(
  terrain: Uint8Array, biome: Uint8Array, landmarks: Landmark[], size: number, rng: Rng,
): ResourceNode[] {
  const r = rng.fork('resources');
  const blocked = new Uint8Array(size * size);
  for (const l of landmarks) {
    const rad = RESERVE_RADIUS[l.id];
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        if (inBounds(l.x + dx, l.y + dy, size)) blocked[idx(l.x + dx, l.y + dy, size)] = 1;
      }
    }
  }
  const nodes: ResourceNode[] = [];
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = idx(x, y, size);
      if (blocked[i] || isWater(terrain[i])) continue;
      const rules = rulesFor(biome[i], terrain[i]);
      if (!rules.length) continue;
      const roll = r.next();
      let acc = 0;
      let kind: ResourceKind | null = null;
      for (const rule of rules) {
        acc += rule.p;
        if (roll < acc) {
          kind = rule.kind;
          break;
        }
      }
      if (!kind) continue;
      let crowded = false;
      for (let dy = -1; dy <= 1 && !crowded; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (blocked[idx(x + dx, y + dy, size)] === 2) {
            crowded = true;
            break;
          }
        }
      }
      if (crowded) continue;
      blocked[i] = 2;
      nodes.push({ id: nodes.length, kind, x, y, variant: r.int(0, 255) });
    }
  }
  return nodes;
}
