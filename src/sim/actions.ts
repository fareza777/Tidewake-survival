import { ITEMS, type ToolType, type WeaponStats } from '@/data/items';
import type { NpcId } from '@/data/npcs';
import type { CropId } from '@/data/crops';
import { STRUCTURES, type StructureId } from '@/data/structures';
import { STAMINA_TOOL } from '@/data/tools';
import { canTill, isRipe, plotAt, type Farm } from '@/sim/farm';
import type { DungeonId } from '@/sim/dungeon/progress';
import type { Target } from '@/sim/dungeon/rules';
import type { Chest, Door } from '@/sim/dungeon/types';
import { countItem, type Inventory } from '@/sim/inventory';
import { meleeFor, type Melee } from '@/sim/melee';
import type { Vec } from '@/sim/movement';
import { canPlace, structureAt, type PlaceResult, type Structure, type Structures } from '@/sim/structures';
import { checkHit } from '@/sim/tools';
import { wouldWaste, type FoodValue, type Vitals } from '@/sim/vitals';
import type { Spot } from '@/sim/world/spots';
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
  /** A creature stands where a blow with the held item (or bare hands) would land. */
  creature: boolean;
  /** The dungeon whose entrance is the tile in front of the hero (on the island). */
  entrance: DungeonId | null;
  /** What the hero can use on the tile in front of him inside a dungeon: a locked door, a chest, the way out. */
  target: Target | null;
  /** The islander standing on the tile in front of the hero. */
  npc?: NpcId | null;
  /** The find (bottle, tablet, cat, treasure) in front of the hero or under his feet. */
  spot?: Spot | null;
}

export type Blocked =
  | { reason: 'needsTool'; tool: ToolType; tier: number }
  | { reason: 'tired' }
  | { reason: 'saltWater' }
  | { reason: 'canEmpty' }
  | { reason: 'chestNotEmpty' }
  | { reason: 'noArrows' }
  | { reason: 'needsKey' }
  | { reason: 'needsBossKey' }
  | { reason: 'needsLighthouseKey' }
  | { reason: 'cannotPlace'; why: Extract<PlaceResult, { ok: false }>['reason'] };

export type Action =
  | { kind: 'none' }
  | ({ kind: 'blocked' } & Blocked)
  | { kind: 'hit'; node: ResourceNode; damage: number; stamina: number; wear: boolean }
  | { kind: 'attack'; melee: Melee }
  | { kind: 'enter'; dungeon: DungeonId }
  | { kind: 'leave' }
  | { kind: 'chest'; chest: Chest }
  | { kind: 'door'; door: Door }
  | { kind: 'talk'; npc: NpcId }
  | { kind: 'inspect'; spot: Spot }
  | { kind: 'dig'; spot: Spot; stamina: number }
  | { kind: 'fish'; x: number; y: number; stamina: number }
  | { kind: 'raft'; structure: Structure }
  | { kind: 'shoot'; stats: WeaponStats }
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
/** The structure in front of the hero that can be taken down with the Pick up button, and what that would do. */
export function dismantleAt(structures: Structures, pos: Vec, facing: Facing): Action | null {
  const { x, y } = frontTile(pos, facing);
  const structure = structureAt(structures, x, y);
  if (!structure || STRUCTURES[structure.type].pickup !== 'tool') return null;
  return structure.inv?.some(Boolean) ? blocked({ reason: 'chestNotEmpty' }) : { kind: 'pickup', structure };
}

export function resolveAction(c: ActionContext): Action {
  const { x, y } = frontTile(c.pos, c.facing);
  const inside = inBounds(x, y, c.world.size);
  const tile = inside ? idx(x, y, c.world.size) : -1;
  // A hero with no hit points left does nothing: no action may heal him before the death check runs.
  if (c.vitals.hp <= 0) return NONE;
  const slot = c.inv[c.selected] ?? null;
  const def = slot ? ITEMS[slot.item] : null;
  // What a blow with the held item would be, offered whenever the item has nothing else to do and a creature is in reach.
  const melee = meleeFor(slot?.item ?? null);
  const fight: Action = c.vitals.stamina < melee.stamina ? blocked({ reason: 'tired' }) : { kind: 'attack', melee };
  const orFight = c.creature ? fight : NONE;

  const structure = inside ? structureAt(c.structures, x, y) : undefined;
  if (structure) {
    // A plain USE takes down fences, torches and furniture, but not when a blow would land on something, or when the hero
    // holds something to place or eat (a second sign must not take the first back).
    const plain = STRUCTURES[structure.type].pickup === 'always' && !c.creature && !def?.place && !def?.food && !def?.seed;
    // Chests, benches, beds and the like are always USED (a hero with an axe in hand must still be able to open a chest);
    // taking one down is its own button, see `dismantleAt`.
    if (plain) return structure.inv?.some(Boolean) ? blocked({ reason: 'chestNotEmpty' }) : { kind: 'pickup', structure };
    if (structure.type === 'bed') return { kind: 'sleep', structure };
    if (structure.type === 'raft') return { kind: 'raft', structure };
    if (structure.type === 'chest' || STRUCTURES[structure.type].station) return { kind: 'open', structure };
  }
  const plot = tile >= 0 ? plotAt(c.farm, tile) : undefined;
  if (plot && isRipe(plot)) return { kind: 'harvest', x, y };
  if (c.npc) return { kind: 'talk', npc: c.npc };
  if (c.entrance === 'lighthouse' && countItem(c.inv, 'lighthouse_key') === 0) return blocked({ reason: 'needsLighthouseKey' });
  if (c.entrance) return { kind: 'enter', dungeon: c.entrance };
  if (c.spot && c.spot.kind !== 'treasure') return { kind: 'inspect', spot: c.spot };
  if (c.spot && def?.tool?.type === 'shovel') {
    return c.vitals.stamina < STAMINA_TOOL ? blocked({ reason: 'tired' }) : { kind: 'dig', spot: c.spot, stamina: STAMINA_TOOL };
  }
  const use = c.target;
  if (use) {
    if (use.kind === 'exit') return { kind: 'leave' };
    if (use.kind === 'chest') return use.chest.locked && countItem(c.inv, 'small_key') === 0 ? blocked({ reason: 'needsKey' }) : { kind: 'chest', chest: use.chest };
    return countItem(c.inv, 'boss_key') === 0 ? blocked({ reason: 'needsBossKey' }) : { kind: 'door', door: use.door };
  }

  const terrain = inside ? c.world.terrain[tile] : T.DEEP;
  if (def?.food) return wouldWaste(c.vitals, def.food) ? orFight : { kind: 'eat', food: def.food };
  if (def?.place) {
    const ok = canPlace(c.world, c.structures, c.occupied, x, y, c.pos, STRUCTURES[def.place].solid);
    return ok.ok ? { kind: 'place', type: def.place, x, y } : blocked({ reason: 'cannotPlace', why: ok.reason });
  }
  if (def?.seed) return plot && !plot.crop ? { kind: 'plant', x, y, crop: def.seed } : orFight;
  if (def?.tool?.type === 'hoe') {
    if (!canTill(c.world, c.farm, c.occupied, x, y)) return orFight;
    return c.vitals.stamina < STAMINA_TOOL ? blocked({ reason: 'tired' }) : { kind: 'till', x, y, stamina: STAMINA_TOOL };
  }
  if (def?.tool?.type === 'can') {
    if (terrain === T.RIVER) return { kind: 'refill', x, y };
    if (terrain === T.SHALLOW) return blocked({ reason: 'saltWater' });
    if (!plot || !plot.crop || plot.watered) return orFight;
    return (slot?.dur ?? 0) > 0 ? { kind: 'water', x, y } : blocked({ reason: 'canEmpty' });
  }

  if (def?.tool?.type === 'rod' && (terrain === T.SHALLOW || terrain === T.DEEP || terrain === T.RIVER)) {
    return c.vitals.stamina < STAMINA_TOOL ? blocked({ reason: 'tired' }) : { kind: 'fish', x, y, stamina: STAMINA_TOOL };
  }

  if (def?.weapon?.kind === 'bow') {
    if (countItem(c.inv, 'arrow') === 0) return blocked({ reason: 'noArrows' });
    if (c.vitals.stamina < def.weapon.stamina) return blocked({ reason: 'tired' });
    return { kind: 'shoot', stats: def.weapon };
  }
  if (c.creature) return fight;

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
