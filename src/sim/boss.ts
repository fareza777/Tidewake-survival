import { BOSSES, type BossDef, type BossMove } from '@/data/bosses';
import type { CreatureDef, CreatureId } from '@/data/creatures';
import { facingFromVector } from '@/sim/combat';
import type { Creature, StepContext, StepResult } from '@/sim/creatures';
import { PLAYER_HALF, moveWithCollision } from '@/sim/movement';
import type { BossId } from '@/data/dungeons';

/** A bolt of the boss's, flying straight. Tile units. */
export interface Shot {
  x: number;
  y: number;
  dx: number;
  dy: number;
  /** Tiles per second. */
  speed: number;
  /** Tiles it can still travel. */
  left: number;
  damage: number;
}

/** A bolt in flight: a shot with an id and the kind of creature that fired it. */
export interface FlyingShot extends Shot {
  id: number;
  kind: CreatureId;
}

export const CHARGE_SPEED = 8;
export const CHARGE_TIME = 1;
/** Seconds a boss is left standing after it runs into a wall, and after a charge that hit. */
export const CRASH_REST = 1.4;
export const HIT_REST = 0.8;
export const SHOT_SPEED = 5;
export const SHOT_RANGE = 14;
/** Angle between neighbouring shots of a fan. */
const FAN_STEP = 0.28;

export const isBoss = (kind: CreatureId): kind is BossId => kind in BOSSES;

/** Which of the boss's two phases it is in. */
export const phaseOf = (c: Creature, def: CreatureDef, boss: BossDef): 0 | 1 => (c.hp / def.hp <= boss.phase2Below ? 1 : 0);

function aimed(c: Creature, angle: number, damage: number): Shot {
  return { x: c.x, y: c.y, dx: Math.cos(angle), dy: Math.sin(angle), speed: SHOT_SPEED, left: SHOT_RANGE, damage };
}

/** Shots for a move: a fan aimed at the hero, or a ring that turns a little each time. */
function shotsFor(c: Creature, move: BossMove, aim: number): Shot[] {
  const out: Shot[] = [];
  for (let i = 0; i < move.count; i++) {
    const angle = move.action === 'fan' ? aim + (i - (move.count - 1) / 2) * FAN_STEP : (i / move.count) * Math.PI * 2 + c.step * 0.2;
    out.push(aimed(c, angle, move.damage));
  }
  return out;
}

const rest = (c: Creature, seconds: number, extra: Partial<Creature> = {}): Creature => ({ ...c, state: 'recover', timer: seconds, ...extra });

/** The move happens: damage, shots, a summons, or the start of a charge. It goes where the boss aimed when the warning began. */
function perform(c: Creature, boss: BossDef, move: BossMove, ctx: StepContext): StepResult {
  const dist = Math.hypot(ctx.hero.x - c.x, ctx.hero.y - c.y);
  const next = { step: c.step + 1 };
  switch (move.action) {
    case 'slam': {
      const hit = dist <= move.range[1] + PLAYER_HALF;
      return { creature: rest(c, move.rest, next), strike: hit, damage: move.damage };
    }
    case 'charge': {
      return { creature: { ...c, ...next, state: 'charge', timer: CHARGE_TIME }, strike: false };
    }
    case 'summon':
      return { creature: rest(c, move.rest, next), strike: false, summons: Array.from({ length: move.count }, () => boss.summon) };
    default:
      return { creature: rest(c, move.rest, next), strike: false, shots: shotsFor(c, move, Math.atan2(c.headY, c.headX)) };
  }
}

function charge(c: Creature, def: CreatureDef, boss: BossDef, ctx: StepContext): StepResult {
  const phase = boss.phases[phaseOf(c, def, boss)];
  const damage = phase.moves.find((m) => m.action === 'charge')?.damage ?? def.damage;
  const timer = c.timer - ctx.dt;
  const step = CHARGE_SPEED * ctx.dt;
  const moved = moveWithCollision(ctx.world, ctx.solids, c, c.headX * step, c.headY * step, def.radius);
  const travelled = Math.hypot(moved.x - c.x, moved.y - c.y);
  const body = { ...c, x: moved.x, y: moved.y, timer };
  if (Math.hypot(ctx.hero.x - moved.x, ctx.hero.y - moved.y) <= def.reach + def.radius + PLAYER_HALF) {
    return { creature: rest(body, HIT_REST), strike: true, damage };
  }
  if (travelled < step * 0.4) return { creature: rest(body, CRASH_REST), strike: false };
  return { creature: timer > 0 ? body : rest(body, HIT_REST), strike: false };
}

/** Walk toward (or away from, when `away`) the hero. */
function walkAt(c: Creature, def: CreatureDef, ctx: StepContext, speed: number, away: boolean): Creature {
  const dx = ctx.hero.x - c.x;
  const dy = ctx.hero.y - c.y;
  const len = Math.max(1e-6, Math.hypot(dx, dy));
  const sign = away ? -1 : 1;
  const step = speed * ctx.dt;
  const moved = moveWithCollision(ctx.world, ctx.solids, c, (sign * dx * step) / len, (sign * dy * step) / len, def.radius);
  return { ...c, x: moved.x, y: moved.y, state: 'chase', facing: facingFromVector(dx, dy, c.facing) };
}

/** Advance a boss by `ctx.dt` seconds: wait until the hero comes near, then run through its moves in order. */
export function stepBoss(c: Creature, def: CreatureDef, boss: BossDef, ctx: StepContext): StepResult {
  const dx = ctx.hero.x - c.x;
  const dy = ctx.hero.y - c.y;
  const dist = Math.hypot(dx, dy);
  if (!ctx.heroAlive) return { creature: c.state === 'idle' ? c : { ...c, state: 'idle', timer: 0, angry: false }, strike: false };
  if (!c.angry && dist > def.sight) return { creature: c, strike: false };
  const here: Creature = { ...c, angry: true };
  const face = facingFromVector(dx, dy, c.facing);
  if (c.state === 'charge') return charge(here, def, boss, ctx);
  if (c.state === 'recover') {
    const timer = c.timer - ctx.dt;
    return { creature: timer > 0 ? { ...here, timer } : { ...here, state: 'chase', timer: 0 }, strike: false };
  }
  const phase = boss.phases[phaseOf(c, def, boss)];
  const move = phase.moves[c.step % phase.moves.length];
  if (c.state === 'windup') {
    const timer = c.timer - ctx.dt;
    return timer > 0 ? { creature: { ...here, timer, facing: face }, strike: false } : perform(here, boss, move, ctx);
  }
  const [min, max] = move.range;
  if (dist < min) return { creature: walkAt(here, def, ctx, def.speed * phase.speed * 0.8, true), strike: false };
  if (dist > max) return { creature: walkAt(here, def, ctx, def.speed * phase.speed, false), strike: false };
  // The aim is fixed now, so a hero who moves during the warning can get out of the way.
  const len = Math.max(1e-6, dist);
  return { creature: { ...here, state: 'windup', timer: move.windup, facing: face, headX: dx / len, headY: dy / len }, strike: false };
}
