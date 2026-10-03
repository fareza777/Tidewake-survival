import type { Rng } from '@/core/rng';
import { CREATURES, type CreatureDef, type CreatureId } from '@/data/creatures';
import type { Facing } from '@/sim/actions';
import { facingFromVector } from '@/sim/combat';
import { PLAYER_HALF, moveWithCollision, speedFactor, type Vec } from '@/sim/movement';
import type { World } from '@/sim/world/types';

export type CreatureState = 'idle' | 'wander' | 'chase' | 'windup' | 'recover' | 'flee';

/** One monster or animal in the world. Immutable: every step returns a new value. */
export interface Creature {
  readonly id: number;
  readonly kind: CreatureId;
  readonly x: number;
  readonly y: number;
  readonly hp: number;
  readonly facing: Facing;
  readonly state: CreatureState;
  /** Seconds left in the current state (idle, wander, wind-up, recovery). */
  readonly timer: number;
  /** Heading while wandering (unit vector). */
  readonly headX: number;
  readonly headY: number;
  /** Hurt at some point: animals that fight back do so, and every animal runs longer. */
  readonly angry: boolean;
  /** Knockback still to be travelled, in tiles. */
  readonly pushX: number;
  readonly pushY: number;
  /** Seconds of stagger after a hit, during which it cannot act. */
  readonly stun: number;
}

export interface StepContext {
  world: World;
  solids: ReadonlySet<number>;
  hero: Vec;
  /** A collapsed hero is left alone. */
  heroAlive: boolean;
  rng: Rng;
  dt: number;
}

export interface StepResult {
  creature: Creature;
  /** The blow lands on the hero in this step. */
  strike: boolean;
}

/** Fraction of its speed a creature strolls at. */
const STROLL = 0.4;
/** A hunter keeps following until the hero is this many sights away. */
const GIVE_UP = 1.6;
/** Fleeing animals keep running until the hero is this many sights away. */
const SAFE = 1.6;
/** Seconds a hunter walks sideways around an obstacle before heading for the hero again. */
const DETOUR = 0.9;
/** Extra reach granted to a blow that was already winding up when the hero shuffled a little. */
const STRIKE_SLACK = 0.15;
/** How fast knockback is spent (per second) and how long a hit staggers. */
const PUSH_RATE = 14;
export const HURT_STUN = 0.25;

export function newCreature(id: number, kind: CreatureId, x: number, y: number, rng: Rng): Creature {
  return {
    id, kind, x, y, hp: CREATURES[kind].hp, facing: 'down', state: 'idle', timer: rng.float(0.5, 3),
    headX: 0, headY: 0, angry: false, pushX: 0, pushY: 0, stun: 0,
  };
}

export interface HurtResult {
  creature: Creature;
  dead: boolean;
}

/** Take `amount` hit points and a shove of `push` tiles. A hit interrupts a wind-up and sets off the hunt. */
export function hurtCreature(c: Creature, amount: number, push: Vec): HurtResult {
  const hp = Math.max(0, c.hp - amount);
  if (hp === 0) return { creature: { ...c, hp }, dead: true };
  const state: CreatureState = c.state === 'windup' ? 'recover' : c.state === 'idle' || c.state === 'wander' ? 'chase' : c.state;
  const timer = c.state === 'windup' ? CREATURES[c.kind].cooldown * 0.5 : c.timer;
  return { creature: { ...c, hp, angry: true, state, timer, stun: HURT_STUN, pushX: push.x, pushY: push.y }, dead: false };
}

const heroDistance = (c: Creature, hero: Vec): number => Math.hypot(hero.x - c.x, hero.y - c.y);

/** Walk `step` tiles toward the unit vector (ux, uy); returns the creature moved, with its facing. */
function walk(c: Creature, def: CreatureDef, ctx: StepContext, ux: number, uy: number, step: number): Creature {
  const moved = moveWithCollision(ctx.world, ctx.solids, c, ux * step, uy * step, def.radius);
  return { ...c, x: moved.x, y: moved.y, facing: facingFromVector(ux, uy, c.facing) };
}

function applyPush(c: Creature, def: CreatureDef, ctx: StepContext): Creature {
  if (c.pushX === 0 && c.pushY === 0) return c;
  const k = Math.min(1, PUSH_RATE * ctx.dt);
  const dx = c.pushX * k;
  const dy = c.pushY * k;
  const moved = moveWithCollision(ctx.world, ctx.solids, c, dx, dy, def.radius);
  const left = { x: c.pushX - dx, y: c.pushY - dy };
  const spent = Math.hypot(left.x, left.y) < 0.01;
  return { ...c, x: moved.x, y: moved.y, pushX: spent ? 0 : left.x, pushY: spent ? 0 : left.y };
}

/** Drop out of a hunt or a flight into idling; creatures already idling or strolling carry on as they were. */
function settle(c: Creature, rng: Rng): Creature {
  return c.state === 'idle' || c.state === 'wander' ? c : { ...c, state: 'idle', timer: rng.float(0.8, 2.5) };
}

function stroll(c: Creature, def: CreatureDef, ctx: StepContext): Creature {
  const timer = c.timer - ctx.dt;
  if (c.state === 'wander') {
    const step = def.speed * STROLL * speedFactor(ctx.world, c.x, c.y) * ctx.dt;
    const moved = walk(c, def, ctx, c.headX, c.headY, step);
    const blocked = Math.hypot(moved.x - c.x, moved.y - c.y) < step * 0.25;
    if (timer <= 0 || blocked) return { ...moved, state: 'idle', timer: ctx.rng.float(1, 3) };
    return { ...moved, timer };
  }
  if (c.state === 'idle' && timer > 0) return { ...c, timer };
  const angle = ctx.rng.float(0, Math.PI * 2);
  const hx = Math.cos(angle);
  const hy = Math.sin(angle);
  return { ...c, state: 'wander', timer: ctx.rng.float(1, 2.5), headX: hx, headY: hy, facing: facingFromVector(hx, hy, c.facing) };
}

/** Headings to try, in order, when the straight way is blocked: radians to turn away from the wanted direction. */
const TURNS = [0, 0.9, -0.9, 1.6, -1.6, 2.3, -2.3];

/** Move along the wanted direction, or the least-turned one that actually gets somewhere (walls, trees, water). */
function steer(c: Creature, def: CreatureDef, ctx: StepContext, ux: number, uy: number, step: number, turns: readonly number[]): Creature {
  let best = c;
  let bestMoved = -1;
  for (const turn of turns) {
    const vx = ux * Math.cos(turn) - uy * Math.sin(turn);
    const vy = ux * Math.sin(turn) + uy * Math.cos(turn);
    const tried = walk(c, def, ctx, vx, vy, step);
    const moved = Math.hypot(tried.x - c.x, tried.y - c.y);
    if (moved > bestMoved) {
      best = tried;
      bestMoved = moved;
    }
    if (moved >= step * 0.7) break;
  }
  return best;
}

/** Hunting: close in, wind up, strike, recover. Used by monsters and by angry boars. */
function hunt(c: Creature, def: CreatureDef, ctx: StepContext): StepResult {
  const dist = heroDistance(c, ctx.hero);
  const face = facingFromVector(ctx.hero.x - c.x, ctx.hero.y - c.y, c.facing);
  if (c.state === 'windup') {
    const timer = c.timer - ctx.dt;
    if (timer > 0) return { creature: { ...c, timer, facing: face }, strike: false };
    const hit = dist <= def.reach + def.radius + PLAYER_HALF + STRIKE_SLACK;
    return { creature: { ...c, state: 'recover', timer: def.cooldown, facing: face }, strike: hit };
  }
  if (c.state === 'recover') {
    const timer = c.timer - ctx.dt;
    return { creature: timer > 0 ? { ...c, timer } : { ...c, state: 'chase', timer: 0 }, strike: false };
  }
  const sees = c.state === 'chase' ? def.sight * GIVE_UP : def.sight;
  if (dist > sees && !c.angry) return { creature: stroll(settle(c, ctx.rng), def, ctx), strike: false };
  if (dist > def.sight * 2) return { creature: stroll(settle({ ...c, angry: false }, ctx.rng), def, ctx), strike: false };
  if (dist <= def.reach + def.radius + PLAYER_HALF) {
    return { creature: { ...c, state: 'windup', timer: def.windup, facing: face }, strike: false };
  }
  const step = def.speed * speedFactor(ctx.world, c.x, c.y) * ctx.dt;
  if (c.state === 'chase' && c.timer > 0) {
    const around = walk(c, def, ctx, c.headX, c.headY, step);
    return { creature: { ...around, timer: c.timer - ctx.dt }, strike: false };
  }
  return { creature: pursue(c, def, ctx, (ctx.hero.x - c.x) / dist, (ctx.hero.y - c.y) / dist, step), strike: false };
}

/** A straight line to the hero, or, when something is in the way, a committed detour along the freer side. */
function pursue(c: Creature, def: CreatureDef, ctx: StepContext, ux: number, uy: number, step: number): Creature {
  const direct = walk(c, def, ctx, ux, uy, step);
  if (Math.hypot(direct.x - c.x, direct.y - c.y) >= step * 0.5) return { ...direct, state: 'chase', timer: 0, headX: 0, headY: 0 };
  const left = walk(c, def, ctx, -uy, ux, step);
  const right = walk(c, def, ctx, uy, -ux, step);
  const goLeft = Math.hypot(left.x - c.x, left.y - c.y) >= Math.hypot(right.x - c.x, right.y - c.y);
  const side = goLeft ? left : right;
  return { ...side, state: 'chase', timer: DETOUR, headX: goLeft ? -uy : uy, headY: goLeft ? ux : -ux };
}

function flee(c: Creature, def: CreatureDef, ctx: StepContext): Creature {
  const dist = heroDistance(c, ctx.hero);
  const reach = def.sight * (c.state === 'flee' ? SAFE : 1);
  if (dist > reach) return stroll(settle(c, ctx.rng), def, ctx);
  const ax = dist < 1e-6 ? 1 : (c.x - ctx.hero.x) / dist;
  const ay = dist < 1e-6 ? 0 : (c.y - ctx.hero.y) / dist;
  const step = def.speed * speedFactor(ctx.world, c.x, c.y) * ctx.dt;
  const best = steer(c, def, ctx, ax, ay, step, TURNS);
  return { ...best, state: 'flee' };
}

/** Advance one creature by `ctx.dt` seconds. Pure: the same inputs and random stream give the same result. */
export function stepCreature(c: Creature, ctx: StepContext): StepResult {
  const def = CREATURES[c.kind];
  const pushed = applyPush(c, def, ctx);
  if (pushed.stun > 0) return { creature: { ...pushed, stun: Math.max(0, pushed.stun - ctx.dt) }, strike: false };
  if (def.temper === 'flee') return { creature: ctx.heroAlive ? flee(pushed, def, ctx) : stroll(settle(pushed, ctx.rng), def, ctx), strike: false };
  const hunting = def.temper === 'chase' || pushed.angry;
  if (hunting && ctx.heroAlive) return hunt(pushed, def, ctx);
  const calm = pushed.angry ? { ...pushed, angry: false } : pushed;
  return { creature: stroll(settle(calm, ctx.rng), def, ctx), strike: false };
}
