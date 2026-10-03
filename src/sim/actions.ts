import { ITEMS, type ToolType } from '@/data/items';
import type { CropId } from '@/data/crops';
import { STRUCTURES, type StructureId } from '@/data/structures';
import { STAMINA_TOOL } from '@/data/tools';
import { canTill, isRipe, plotAt, type Farm } from '@/sim/farm';
import type { Inventory } from '@/sim/inventory';
import type { Vec } from '@/sim/movement';
import { canPlace, structureAt, type PlaceResult, type Structure, type Structures } from '@/sim/structures';
import { checkHit } from '@/sim/tools';
import { wouldWaste, type FoodValue, type Vitals } from '@/sim/vitals';
import { T, idx, inBounds, type ResourceNode, type World } from '@/sim/world/types';

export type Facing = 'down' | 'left' | 'right' | 'up';

const FACING_VEC: Record<Facing, readonly [number, number]> = { down: [0, 1], left: [-1, 0], right: [1, 0], up: [0, -1] };

/** The tile right in front of the hero. */
export function frontTile(pos: Vec, facing: Facing): { x: number; y: number } {
  const [dx, dy] = FACING_VEC[facing];
  return { x: Math.floor(pos.x) + dx, y: Math.floor(pos.y) + dy };
}

export interface ActionContext {
  world: World;
  inv: Inventory;
  /** Selected hotbar slot. */
  selected: number;
  vitals: Vitals;
  pos: Vec;
  facing: Facing;
  structures: Structures;
  farm: Farm;
  /** Tiles taken by solid things: living resource nodes, landmark scenery and structures. */
  occupied: ReadonlySet<number>;
  /** The nearest living resource node in reach, if any. */
  node: ResourceNode | null;
}

export type Blocked =
  | { reason: 'needsTool'; tool: ToolType; tier: number }
  | { reason: 'tired' }
  | { reason: 'saltWater' }
  | { reason: 'canEmpty' }
  | { reason: 'chestNotEmpty' }
  | { reason: 'cannotPlace'; why: Extract<PlaceResult, { ok: false }>['reason'] };

export type Action =
  | { kind: 'none' }
  | ({ kind: 'blocked' } & Blocked)
  | { kind: 'hit'; node: ResourceNode; damage: number; stamina: number; wear: boolean }
  | { kind: 'place'; type: StructureId; x: number; y: number }
  | { kind: 'till'; x: number; y: number; stamina: number }
  | { kind: 'plant'; x: number; y: number; crop: CropId }
  | { kind: 'water'; x: number; y: number }
  | { kind: 'refill'; x: number; y: number }
  | { kind: 'eat'; food: FoodValue }
  | { kind: 'harvest'; x: number; y: number }
  | { kind: 'pickup'; structure: Structure }
  | { kind: 'open'; structure: Structure }
  | { kind: 'sleep'; structure: Structure }
  | { kind: 'drink'; x: number; y: number };

const blocked = (b: Blocked): Action => ({ kind: 'blocked', ...b });
const NONE: Action = { kind: 'none' };

/**
 * Decide what pressing ACTION does. Order: a structure in front, then a ripe crop in front, then whatever the
 * selected item is for, and finally the world itself (chopping, mining, drinking). The scene carries the action out.
 */
export function resolveAction(c: ActionContext): Action {
  const { x, y } = frontTile(c.pos, c.facing);
  const inside = inBounds(x, y, c.world.size);
  const tile = inside ? idx(x, y, c.world.size) : -1;
  const slot = c.inv[c.selected] ?? null;
  const def = slot ? ITEMS[slot.item] : null;

  const structure = inside ? structureAt(c.structures, x, y) : undefined;
  if (structure) {
    const take = STRUCTURES[structure.type].pickup === 'always' || (def?.tool !== undefined && (def.tool.type === 'axe' || def.tool.type === 'pickaxe'));
    if (take) {
      return structure.inv?.some(Boolean) ? blocked({ reason: 'chestNotEmpty' }) : { kind: 'pickup', structure };
    }
    if (structure.type === 'bed') return { kind: 'sleep', structure };
    if (structure.type === 'chest' || STRUCTURES[structure.type].station) return { kind: 'open', structure };
  }
  const plot = tile >= 0 ? plotAt(c.farm, tile) : undefined;
  if (plot && isRipe(plot)) return { kind: 'harvest', x, y };

  const terrain = inside ? c.world.terrain[tile] : T.DEEP;
  if (def?.food) return wouldWaste(c.vitals, def.food) ? NONE : { kind: 'eat', food: def.food };
  if (def?.place) {
    const ok = canPlace(c.world, c.structures, c.occupied, x, y, c.pos, STRUCTURES[def.place].solid);
    return ok.ok ? { kind: 'place', type: def.place, x, y } : blocked({ reason: 'cannotPlace', why: ok.reason });
  }
  if (def?.seed) return plot && !plot.crop ? { kind: 'plant', x, y, crop: def.seed } : NONE;
  if (def?.tool?.type === 'hoe') {
    if (!canTill(c.world, c.farm, c.occupied, x, y)) return NONE;
    return c.vitals.stamina < STAMINA_TOOL ? blocked({ reason: 'tired' }) : { kind: 'till', x, y, stamina: STAMINA_TOOL };
  }
  if (def?.tool?.type === 'can') {
    if (terrain === T.RIVER) return { kind: 'refill', x, y };
    if (terrain === T.SHALLOW) return blocked({ reason: 'saltWater' });
    if (!plot || !plot.crop || plot.watered) return NONE;
    return (slot?.dur ?? 0) > 0 ? { kind: 'water', x, y } : blocked({ reason: 'canEmpty' });
  }

  // Facing fresh water means drinking, even if a bush or tree happens to stand within reach behind the hero.
  if (terrain === T.RIVER) return { kind: 'drink', x, y };
  if (c.node) {
    const check = checkHit(c.node.kind, slot?.item ?? null);
    if (!check.ok) return blocked({ reason: 'needsTool', tool: check.tool, tier: check.tier });
    if (c.vitals.stamina < check.stamina) return blocked({ reason: 'tired' });
    return { kind: 'hit', node: c.node, damage: check.damage, stamina: check.stamina, wear: check.wear };
  }
  if (terrain === T.SHALLOW || terrain === T.DEEP) return blocked({ reason: 'saltWater' });
  return NONE;
}
