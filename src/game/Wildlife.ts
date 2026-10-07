import type Phaser from 'phaser';
import { Rng } from '@/core/rng';
import type { CreatureId } from '@/data/creatures';
import { CreatureLayer } from '@/gfx/CreatureLayer';
import { spawnRaid } from '@/sim/raids';
import type { World } from '@/sim/world/types';
import type { Facing } from '@/sim/actions';
import type { SwingStats } from '@/sim/combat';
import {
  creatureInReach, emptyEncounters, shoot, swing, takePickups, tickEncounters, type Encounters, type EncounterEvent, type Taken, type TickContext,
} from '@/sim/encounters';
import type { WeaponStats } from '@/data/items';
import type { Inventory } from '@/sim/inventory';
import type { Melee } from '@/sim/melee';
import type { Vec } from '@/sim/movement';

/**
 * The island's creatures, loose items and arrows: runs the simulation, keeps the sprites in step with it, and hands the
 * scene the events it has to react to (the hero was hit, a creature was hurt or killed). Nothing here is saved.
 */
export class Wildlife {
  private state = emptyEncounters();
  private rng = new Rng(Rng.seedFromTime());
  private layer: CreatureLayer;
  /** Where the hero stood at his last blow: creatures recoil away from it. */
  private lastBlow: Vec | null = null;

  constructor(scene: Phaser.Scene) {
    this.layer = new CreatureLayer(scene);
  }

  /** The current state of creatures, items and arrows (read-only). */
  snapshot(): Encounters {
    return this.state;
  }

  /** Replace everything with the given state (a dungeon starts with its guards in place). */
  load(e: Encounters): void {
    this.apply(e, []);
  }

  /** Advance everything by `dt` seconds. */
  tick(dt: number, c: Omit<TickContext, 'rng'>): EncounterEvent[] {
    const r = tickEncounters(this.state, { ...c, rng: this.rng }, dt);
    return this.apply(r.e, r.events);
  }

  /** The hero swings: creatures in the arc are hurt. */
  strike(hero: Vec, facing: Facing, stats: SwingStats): EncounterEvent[] {
    this.lastBlow = hero;
    const r = swing(this.state, hero, facing, stats, this.rng);
    return this.apply(r.e, r.events);
  }

  /** A raid: monsters appear in a ring around the camp and come for it. */
  raid(kinds: readonly CreatureId[], world: World, solids: ReadonlySet<number>, center: Vec): void {
    this.apply(spawnRaid(this.state, kinds, world, solids, center, this.rng), []);
  }

  /** The hero looses an arrow. */
  shoot(hero: Vec, facing: Facing, stats: WeaponStats): void {
    this.state = shoot(this.state, hero, facing, stats);
    this.layer.sync(this.state.creatures, this.state.pickups, this.state.arrows, this.state.shots);
  }

  /** Would a blow with this weapon land on a creature right now? */
  inReach(hero: Vec, facing: Facing, melee: Pick<Melee, 'reach' | 'arc'>): boolean {
    return creatureInReach(this.state, hero, facing, melee.reach, melee.arc);
  }

  /** Pick up loot within reach of the hero. */
  take(inv: Inventory, hero: Vec): Taken {
    const r = takePickups(this.state, inv, hero);
    if (r.e !== this.state) this.apply(r.e, []);
    return r;
  }

  /** Remove every creature, item and arrow (after the hero wakes up somewhere else). */
  clear(): void {
    this.state = emptyEncounters();
    this.layer.sync([], [], [], []);
  }

  private apply(next: Encounters, events: EncounterEvent[]): EncounterEvent[] {
    this.state = next;
    for (const ev of events) {
      if (ev.t === 'hit') {
        const dx = this.lastBlow ? ev.x - this.lastBlow.x : 0;
        const dy = this.lastBlow ? ev.y - this.lastBlow.y : 0;
        const len = Math.hypot(dx, dy) || 1;
        this.layer.flash(ev.id, dx / len, dy / len);
      }
      if (ev.t === 'killed') this.layer.puff(ev);
    }
    this.layer.sync(next.creatures, next.pickups, next.arrows, next.shots);
    return events;
  }
}
