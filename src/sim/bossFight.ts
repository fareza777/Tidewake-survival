import { CREATURES, type CreatureId } from '@/data/creatures';
import { enemyDamage } from '@/sim/combat';
import type { FlyingShot, Shot } from '@/sim/boss';
import { newCreature, type Creature } from '@/sim/creatures';
import type { Encounters, EncounterEvent, EncounterStep, TickContext } from '@/sim/encounters';
import { bodyBlocked, tileBlocked } from '@/sim/movement';

/** A bolt hits the hero when it passes this close to his centre (tiles). */
const SHOT_HIT = 0.35;
/** Bolts move in steps no longer than this, so a fast one cannot skip over the hero or through a wall. */
const SUBSTEP = 0.3;
/** A boss stops calling helpers while this many of them are alive. */
export const MAX_MINIONS = 6;

/** Add bolts fired by a creature of this kind to the fight. */
export function launch(e: Encounters, kind: CreatureId, shots: readonly Shot[]): Encounters {
  const flying: FlyingShot[] = shots.map((s, i) => ({ ...s, id: e.nextId + i, kind }));
  return { ...e, shots: [...e.shots, ...flying], nextId: e.nextId + flying.length };
}

/** Fly every bolt on: walls and solid things stop them, the hero is hurt by the first one that reaches him. */
export function flyShots(e: Encounters, c: TickContext, dt: number): EncounterStep {
  const events: EncounterEvent[] = [];
  const kept: FlyingShot[] = [];
  for (const shot of e.shots) {
    let { x, y, left } = shot;
    let alive = true;
    let travel = Math.min(left, shot.speed * dt);
    while (alive && travel > 1e-9) {
      const step = Math.min(travel, SUBSTEP);
      x += shot.dx * step;
      y += shot.dy * step;
      travel -= step;
      left -= step;
      if (tileBlocked(c.world, c.solids, Math.floor(x), Math.floor(y))) alive = false;
      else if (c.heroAlive && Math.hypot(c.hero.x - x, c.hero.y - y) <= SHOT_HIT) {
        events.push({ t: 'hurtHero', amount: enemyDamage(shot.damage, c.difficulty, c.defense), from: { x, y }, kind: shot.kind });
        alive = false;
      }
    }
    if (alive && left > 1e-9) kept.push({ ...shot, x, y, left });
  }
  return { e: { ...e, shots: kept }, events };
}

/** Call helpers to stand around a boss, on free ground, unless it already has too many. */
export function placeSummons(e: Encounters, boss: Creature, kinds: readonly CreatureId[], c: TickContext): Encounters {
  let cur = e;
  const bossRadius = CREATURES[boss.kind].radius;
  kinds.forEach((kind, i) => {
    if (cur.creatures.filter((o) => CREATURES[o.kind].temper !== 'boss').length >= MAX_MINIONS) return;
    const radius = CREATURES[kind].radius;
    for (let t = 0; t < 8; t++) {
      const angle = ((i * 3 + t) / 8) * Math.PI * 2 + boss.step;
      const x = boss.x + Math.cos(angle) * (bossRadius + 1);
      const y = boss.y + Math.sin(angle) * (bossRadius + 1);
      if (bodyBlocked(c.world, c.solids, x, y, radius)) continue;
      const minion: Creature = { ...newCreature(cur.nextId, kind, x, y, c.rng), state: 'chase', angry: true };
      cur = { ...cur, creatures: [...cur.creatures, minion], nextId: cur.nextId + 1 };
      return;
    }
  });
  return cur;
}
