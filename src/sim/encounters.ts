import type { Rng } from '@/core/rng';
import { CREATURES, isHostileKind, type CreatureId } from '@/data/creatures';
import type { WeaponStats } from '@/data/items';
import type { Facing } from '@/sim/actions';
import { enemyDamage, inSwing, knockbackVec, type SwingStats } from '@/sim/combat';
import type { FlyingShot } from '@/sim/boss';
import { flyShots, launch, placeSummons } from '@/sim/bossFight';
import { hurtCreature, stepCreature, type Creature } from '@/sim/creatures';
import type { Inventory } from '@/sim/inventory';
import { moveWithCollision, tileBlocked, type Vec } from '@/sim/movement';
import { ageOut, collect, drift, rollLoot, scatter, type Pickup, type Stack } from '@/sim/pickups';
import { SPAWN_INTERVAL, cull, trySpawn } from '@/sim/spawner';
import type { Structures } from '@/sim/structures';
import type { Difficulty } from '@/sim/vitals';
import type { World } from '@/sim/world/types';

/** An arrow in flight: a unit direction, the distance it can still travel, and what it does on impact. */
export interface Arrow {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly dx: number;
  readonly dy: number;
  readonly left: number;
  readonly damage: number;
  readonly knockback: number;
}

/** Something the hero can strike with a blow or an arrow that is not a creature (a crystal in a dungeon). */
export interface Target {
  readonly id: number;
  readonly x: number;
  readonly y: number;
}

/** Everything that lives on the island besides the hero and the scenery. Not saved: it is rebuilt around the hero. */
export interface Encounters {
  readonly creatures: readonly Creature[];
  readonly pickups: readonly Pickup[];
  readonly arrows: readonly Arrow[];
  /** Bolts fired by bosses. */
  readonly shots: readonly FlyingShot[];
  readonly targets: readonly Target[];
  /** Shared counter for creature, pickup and arrow ids. */
  readonly nextId: number;
  readonly spawnTimer: number;
}

export type EncounterEvent =
  | { t: 'hurtHero'; amount: number; from: Vec; kind: CreatureId }
  | { t: 'hit'; id: number; kind: CreatureId; amount: number; x: number; y: number }
  | { t: 'killed'; id: number; kind: CreatureId; x: number; y: number }
  | { t: 'struck'; id: number };

export interface EncounterStep {
  e: Encounters;
  events: EncounterEvent[];
}

export interface TickContext {
  world: World;
  solids: ReadonlySet<number>;
  structures: Structures;
  hero: Vec;
  heroAlive: boolean;
  night: boolean;
  difficulty: Difficulty;
  /** Armour: points taken off every blow. */
  defense: number;
  rng: Rng;
  /** No creatures appear or fade by themselves (dungeons: the rooms hold what they hold). */
  fixed?: boolean;
}

export const ARROW_SPEED = 9;
const ARROW_REACH = 0.18;
/** How big a target is for blows and arrows. */
const TARGET_RADIUS = 0.45;
/** Arrows move in steps no longer than this, so a fast one cannot skip over a small target. */
const ARROW_SUBSTEP = 0.3;

export const emptyEncounters = (): Encounters => ({
  creatures: [], pickups: [], arrows: [], shots: [], targets: [], nextId: 1, spawnTimer: SPAWN_INTERVAL,
});

/** Deal damage to one creature. A death removes it and leaves its loot on the ground. */
function damageCreature(e: Encounters, id: number, amount: number, push: Vec, rng: Rng): EncounterStep {
  const target = e.creatures.find((c) => c.id === id);
  if (!target) return { e, events: [] };
  const hit: EncounterEvent = { t: 'hit', id, kind: target.kind, amount, x: target.x, y: target.y };
  const r = hurtCreature(target, amount, push);
  if (!r.dead) return { e: { ...e, creatures: e.creatures.map((c) => (c.id === id ? r.creature : c)) }, events: [hit] };
  // A boss's reward is handed over by the level (it must not fade away on the floor); everything else lies where it fell.
  const loot = CREATURES[target.kind].temper === 'boss' ? [] : scatter(rollLoot(target.kind, rng), target, e.nextId, rng);
  return {
    e: { ...e, creatures: e.creatures.filter((c) => c.id !== id), pickups: [...e.pickups, ...loot], nextId: e.nextId + loot.length },
    events: [hit, { t: 'killed', id, kind: target.kind, x: target.x, y: target.y }],
  };
}

/** A melee swing: every creature inside the arc is hurt and pushed back. */
export function swing(e: Encounters, hero: Vec, facing: Facing, stats: SwingStats, rng: Rng): EncounterStep {
  let cur = e;
  const events: EncounterEvent[] = [];
  for (const c of e.creatures) {
    if (!inSwing(hero, facing, stats.reach, stats.arc, c, CREATURES[c.kind].radius)) continue;
    const r = damageCreature(cur, c.id, stats.damage, knockbackVec(hero, c, stats.knockback), rng);
    cur = r.e;
    events.push(...r.events);
  }
  for (const t of e.targets) {
    if (inSwing(hero, facing, stats.reach, stats.arc, t, TARGET_RADIUS)) events.push({ t: 'struck', id: t.id });
  }
  return { e: cur, events };
}

const FACING: Record<Facing, readonly [number, number]> = { down: [0, 1], left: [-1, 0], right: [1, 0], up: [0, -1] };

/** Loose an arrow from the hero's hands in the direction he faces. */
export function shoot(e: Encounters, hero: Vec, facing: Facing, stats: Pick<WeaponStats, 'damage' | 'reach' | 'knockback'>): Encounters {
  const [dx, dy] = FACING[facing];
  const arrow: Arrow = {
    id: e.nextId, x: hero.x + dx * 0.4, y: hero.y + dy * 0.4, dx, dy, left: stats.reach, damage: stats.damage, knockback: stats.knockback,
  };
  return { ...e, arrows: [...e.arrows, arrow], nextId: e.nextId + 1 };
}

function flyArrows(e: Encounters, c: TickContext, dt: number): EncounterStep {
  let cur: Encounters = { ...e, arrows: [] };
  const events: EncounterEvent[] = [];
  for (const arrow of e.arrows) {
    let { x, y, left } = arrow;
    let alive = true;
    let travel = Math.min(left, ARROW_SPEED * dt);
    while (alive && travel > 1e-9) {
      const step = Math.min(travel, ARROW_SUBSTEP);
      x += arrow.dx * step;
      y += arrow.dy * step;
      travel -= step;
      left -= step;
      // Targets first: crystals stand on solid tiles, so the step that reaches one usually ends inside its tile.
      const target = cur.targets.find((t) => Math.hypot(t.x - x, t.y - y) <= TARGET_RADIUS + ARROW_REACH);
      if (target) {
        events.push({ t: 'struck', id: target.id });
        alive = false;
        break;
      }
      if (tileBlocked(c.world, c.solids, Math.floor(x), Math.floor(y))) {
        alive = false;
        break;
      }
      const victim = cur.creatures.find((cr) => Math.hypot(cr.x - x, cr.y - y) <= CREATURES[cr.kind].radius + ARROW_REACH);
      if (!victim) continue;
      const r = damageCreature(cur, victim.id, arrow.damage, { x: arrow.dx * arrow.knockback, y: arrow.dy * arrow.knockback }, c.rng);
      cur = r.e;
      events.push(...r.events);
      alive = false;
    }
    if (alive && left > 1e-9) cur = { ...cur, arrows: [...cur.arrows, { ...arrow, x, y, left }] };
  }
  return { e: cur, events };
}

/** Creatures that overlap are nudged apart, so a pack of slimes does not stack into one. */
function separate(creatures: readonly Creature[], c: TickContext): Creature[] {
  const out = creatures.slice();
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      const a = out[i];
      const b = out[j];
      const gap = CREATURES[a.kind].radius + CREATURES[b.kind].radius;
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (d >= gap) continue;
      const push = knockbackVec(a, d < 1e-6 ? { x: a.x + 1, y: a.y } : b, (gap - d) / 2 + 0.01);
      const na = moveWithCollision(c.world, c.solids, a, -push.x, -push.y, CREATURES[a.kind].radius);
      const nb = moveWithCollision(c.world, c.solids, b, push.x, push.y, CREATURES[b.kind].radius);
      out[i] = { ...a, x: na.x, y: na.y };
      out[j] = { ...b, x: nb.x, y: nb.y };
    }
  }
  return out;
}

/** Advance the island's creatures, arrows, bolts and loose items by `dt` seconds. */
export function tickEncounters(e: Encounters, c: TickContext, dt: number): EncounterStep {
  const events: EncounterEvent[] = [];
  const stepped: Creature[] = [];
  const fired: { kind: CreatureId; shots: NonNullable<ReturnType<typeof stepCreature>['shots']> }[] = [];
  const called: { boss: Creature; kinds: CreatureId[] }[] = [];
  for (const cr of e.creatures) {
    const r = stepCreature(cr, { world: c.world, solids: c.solids, hero: c.hero, heroAlive: c.heroAlive, rng: c.rng, dt });
    if (r.strike) {
      const amount = enemyDamage(r.damage ?? CREATURES[cr.kind].damage, c.difficulty, c.defense);
      events.push({ t: 'hurtHero', amount, from: { x: cr.x, y: cr.y }, kind: cr.kind });
    }
    if (r.shots) fired.push({ kind: cr.kind, shots: r.shots });
    if (r.summons) called.push({ boss: r.creature, kinds: r.summons });
    stepped.push(r.creature);
  }
  let cur: Encounters = { ...e, creatures: separate(stepped, c) };
  for (const f of fired) cur = launch(cur, f.kind, f.shots);
  for (const s of called) cur = placeSummons(cur, s.boss, s.kinds, c);
  const arrows = flyArrows(cur, c, dt);
  const bolts = flyShots(arrows.e, c, dt);
  events.push(...arrows.events, ...bolts.events);
  cur = { ...bolts.e, pickups: ageOut(drift(bolts.e.pickups, c.hero, dt), dt) };
  if (c.fixed) return { e: cur, events };
  const timer = cur.spawnTimer - dt;
  if (timer > 0) return { e: { ...cur, spawnTimer: timer }, events };
  const born = trySpawn({
    world: c.world, solids: c.solids, structures: c.structures, hero: c.hero, night: c.night, creatures: cur.creatures,
    nextId: cur.nextId, rng: c.rng,
  });
  cur = { ...cur, creatures: born ? [...cur.creatures, born] : cur.creatures, nextId: born ? cur.nextId + 1 : cur.nextId, spawnTimer: SPAWN_INTERVAL };
  return { e: { ...cur, creatures: cull(cur.creatures, c.hero, c.night) }, events };
}

export interface Taken {
  e: Encounters;
  inv: Inventory;
  taken: Stack[];
  full: boolean;
}

/** The hero picks up what lies within reach; whatever does not fit stays on the ground. */
export function takePickups(e: Encounters, inv: Inventory, hero: Vec): Taken {
  const r = collect(inv, e.pickups, hero);
  return { e: r.taken.length === 0 && !r.full ? e : { ...e, pickups: r.pickups }, inv: r.inv, taken: r.taken, full: r.full };
}

/** How many monsters within `radius` tiles of the hero are hunting him (chasing, winding up or recovering from a blow). */
export function hostilesNear(e: Encounters, hero: Vec, radius: number): number {
  return e.creatures.filter((c) => {
    if (!isHostileKind(c.kind)) return false;
    return (c.state === 'chase' || c.state === 'windup' || c.state === 'recover' || c.state === 'charge') && Math.hypot(c.x - hero.x, c.y - hero.y) <= radius;
  }).length;
}

/** Would a blow of this reach and width land on a creature or a target? Used to decide what ACTION does. */
export function creatureInReach(e: Encounters, hero: Vec, facing: Facing, reach: number, arc: number): boolean {
  return e.creatures.some((c) => inSwing(hero, facing, reach, arc, c, CREATURES[c.kind].radius))
    || e.targets.some((t) => inSwing(hero, facing, reach, arc, t, TARGET_RADIUS));
}
