import { Rng, hashString } from '@/core/rng';
import { CREATURES, isHostileKind, spawnWeights, type CreatureId } from '@/data/creatures';
import { STRUCTURES, type StructureId } from '@/data/structures';
import { newCreature } from '@/sim/creatures';
import type { Encounters } from '@/sim/encounters';
import { bodyBlocked, type Vec } from '@/sim/movement';
import type { Structures } from '@/sim/structures';
import type { Difficulty } from '@/sim/vitals';
import { GROUND, idx, inBounds, type Biome, type World } from '@/sim/world/types';

/** How much each kind of structure counts toward the size of a camp (floors and signs are decoration). */
const WEIGHT: Partial<Record<StructureId, number>> = {
  bed: 3, tent: 3, chest: 1, workbench: 2, furnace: 2, anvil: 2, alchemy: 2, campfire: 1, wood_wall: 0.4, stone_wall: 0.5, fence: 0.25,
  wood_door: 0.5, turret: 2, table: 0.5, barrel: 0.5, lamp_post: 0.5, torch: 0.2,
};

/** How big a camp the hero has built: a few benches and a bed make a camp; walls and a turret make a stronghold. */
export function campSize(structures: Structures): number {
  return structures.list.reduce((n, s) => n + (WEIGHT[s.type] ?? (STRUCTURES[s.type].floor ? 0 : 0.25)), 0);
}

/** A small camp is left alone. */
export const MIN_CAMP = 6;

const RAID_FROM_DAY: Record<Difficulty, number> = { relaxed: 6, normal: 3, hardcore: 2 };
const RAID_CHANCE: Record<Difficulty, number> = { relaxed: 0.2, normal: 0.38, hardcore: 0.65 };

/**
 * The monsters that come for the camp on the night of `day`, or null when the night is quiet. The same seed and day
 * always give the same answer; no raid follows straight after another, and a small camp is never raided.
 */
export function raidFor(seed: number, day: number, difficulty: Difficulty, camp: number, biome: Biome): CreatureId[] | null {
  if (day < RAID_FROM_DAY[difficulty] || camp < MIN_CAMP) return null;
  const roll = (d: number): boolean => new Rng(hashString(`${seed}:raid:${d}`)).chance(RAID_CHANCE[difficulty] + Math.min(0.2, camp / 120));
  // A raid never follows a raid. Every eighth night is a quiet one, and the count starts again after it, so the answer for a
  // night depends only on the nights since then.
  if (day % 8 === 0) return null;
  let before = false;
  let raided = false;
  for (let d = Math.max(RAID_FROM_DAY[difficulty], day - (day % 8) + 1); d <= day; d++) {
    raided = roll(d) && !before;
    before = raided;
  }
  if (!raided) return null;
  const rng = new Rng(hashString(`${seed}:raid-kinds:${day}`));
  const hostile = spawnWeights(biome, true).filter(([id]) => isHostileKind(id) && CREATURES[id].temper === 'chase');
  if (hostile.length === 0) return null;
  const bonus = difficulty === 'hardcore' ? 2 : difficulty === 'relaxed' ? -1 : 0;
  const count = Math.max(2, Math.min(11, 2 + Math.floor(camp / 8) + Math.floor(day / 5) + bonus));
  return Array.from({ length: count }, () => rng.weighted(hostile));
}

const RING_MIN = 9;
const RING_MAX = 14;

/** Put the raiders on dry ground in a ring around the camp. Kinds that find no room are left out. */
export function spawnRaid(e: Encounters, kinds: readonly CreatureId[], world: World, solids: ReadonlySet<number>, center: Vec, rng: Rng): Encounters {
  const born = [];
  let id = e.nextId;
  for (const kind of kinds) {
    for (let i = 0; i < 24; i++) {
      const angle = rng.float(0, Math.PI * 2);
      const r = rng.float(RING_MIN, RING_MAX);
      const x = center.x + Math.cos(angle) * r;
      const y = center.y + Math.sin(angle) * r;
      const tx = Math.floor(x);
      const ty = Math.floor(y);
      if (!inBounds(tx, ty, world.size) || !GROUND.has(world.terrain[idx(tx, ty, world.size)])) continue;
      if (bodyBlocked(world, solids, x, y, CREATURES[kind].radius)) continue;
      if ([...e.creatures, ...born].some((o) => Math.hypot(o.x - x, o.y - y) < 0.9)) continue;
      born.push({ ...newCreature(id, kind, x, y, rng), state: 'chase' as const, angry: true });
      id += 1;
      break;
    }
  }
  return { ...e, creatures: [...e.creatures, ...born], nextId: id };
}
