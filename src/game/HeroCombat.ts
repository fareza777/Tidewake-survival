import { shakeCamera } from '@/core/viewport';
import { services } from '@/core/services';
import { t } from '@/core/i18n';
import { Wildlife } from '@/game/Wildlife';
import { FloatText } from '@/gfx/FloatText';
import { burst } from '@/gfx/Impact';
import { TILE } from '@/gfx/TerrainLayer';
import type { GameScene } from '@/scenes/GameScene';
import { enemyDamage } from '@/sim/combat';
import { cueForEncounter } from '@/sim/cues';
import { defenseOf } from '@/sim/equipment';
import { hostilesNear, type Encounters, type EncounterEvent } from '@/sim/encounters';
import type { Melee } from '@/sim/melee';
import { hurtHero, type Fx } from '@/sim/session';
import { emptyStructures } from '@/sim/structures';
import { COLORS } from '@/ui/theme';

/** The "backpack full" notice for loot on the ground is shown at most this often (seconds). */
const FULL_NOTICE = 3;
/** Monsters this close that are after the hero make it a fight; the battle music lingers this long after the last one (seconds). */
const FIGHT_RADIUS = 10;
const FIGHT_LINGER = 4;
/** How long the island freezes when a blow lands, and when it kills (seconds). */
const HIT_STOP = 0.045;
const KILL_STOP = 0.09;

/** The island scene's fighting side: runs the creatures, resolves the hero's blows and shots, and shows what happens. */
export class HeroCombat {
  private wildlife: Wildlife;
  private numbers: FloatText;
  private fullTimer = 0;
  private calm = FIGHT_LINGER;
  /** The blow being resolved is a critical one (its numbers are gold). */
  private critNow = false;

  constructor(private host: GameScene) {
    this.wildlife = new Wildlife(host);
    this.numbers = new FloatText(host);
  }

  /** Would a blow with this melee stat block land on a creature right now? */
  reaches(melee: Pick<Melee, 'reach' | 'arc'>): boolean {
    return this.wildlife.inReach(this.host.pos, this.host.player.facing, melee);
  }

  /** Hand the creatures of a dungeon to the simulation. */
  load(e: Encounters): void {
    this.wildlife.load(e);
  }

  /** The creatures, items and bolts as they are now. */
  snapshot(): Encounters {
    return this.wildlife.snapshot();
  }

  /** True while monsters are on the hero, and for a few seconds after. */
  get fighting(): boolean {
    return this.calm < FIGHT_LINGER;
  }

  /** The hero's blow or shot, as chosen by the rules. */
  onFx(fx: Extract<Fx, { t: 'strike' | 'shot' }>): void {
    const { pos, player } = this.host;
    if (fx.t === 'strike') {
      this.critNow = fx.crit === true;
      this.react(this.wildlife.strike(pos, player.facing, fx.melee));
      this.critNow = false;
    }
    else this.wildlife.shoot(pos, player.facing, fx.stats);
  }

  /** Run creatures, loot and arrows for `dt` seconds, then let the hero pick up what he stands next to. */
  tick(dt: number): void {
    const host = this.host;
    host.player.tick(dt);
    this.fullTimer = Math.max(0, this.fullTimer - dt);
    this.calm = hostilesNear(this.wildlife.snapshot(), host.pos, FIGHT_RADIUS) > 0 ? 0 : this.calm + dt;
    const s = host.session;
    const level = host.level;
    this.react(this.wildlife.tick(dt, {
      world: host.world, solids: host.solids, structures: level.dungeon ? emptyStructures() : s.structures, hero: host.pos, heroAlive: !host.dead,
      night: level.isNight(s), difficulty: s.difficulty, defense: defenseOf(s.equipment), fixed: level.fixed,
    }));
    const loot = this.wildlife.take(host.session.inventory, host.pos);
    if (loot.taken.length > 0) {
      host.session = { ...host.session, inventory: loot.inv };
      host.float.newGroup();
      for (const got of loot.taken) host.showGain(`+${got.qty} ${t(`item_${got.item}`)}`);
    }
    if (loot.full && this.fullTimer === 0) {
      this.fullTimer = FULL_NOTICE;
      services.notify?.(t('msgFull'));
    }
  }

  /** The hero's side of an encounter: a blow lands (red flash, shake, buzz), a creature is hurt (damage number). */
  private react(events: EncounterEvent[]): void {
    const { host } = this;
    for (const ev of events) {
      if (ev.t !== 'hurtHero' || host.player.vulnerable) services.audio?.sfx(cueForEncounter(ev));
      if (ev.t === 'killed') {
        host.hitStop = KILL_STOP;
        host.story.kill(ev.kind);
      }
      if (ev.t === 'hit') {
        host.hitStop = HIT_STOP;
        burst(host, ev.x * TILE, ev.y * TILE - 6, 'spark', ev.y * TILE + 4, host.player.facing === 'left' ? -1 : host.player.facing === 'right' ? 1 : 0);
        if (services.settings?.damageNumbers !== false) this.numbers.show(ev.x * TILE, ev.y * TILE - 18, `-${ev.amount}`, this.critNow ? COLORS.gold : COLORS.white);
      } else if (ev.t === 'hurtHero') {
        this.hurt(ev.amount);
      }
    }
    host.level.onEvents(events);
  }

  /** The hero loses hit points to a blow (red flash, shake, buzz), unless he is still safe from the last one. */
  private hurt(amount: number): void {
    const { host } = this;
    if (!host.player.vulnerable) return;
    host.session = hurtHero(host.session, amount);
    host.player.hurt();
    if (services.settings?.screenShake !== false) shakeCamera(host.cameras.main, 140, 0.006);
    services.platform?.haptic('medium');
    this.numbers.show(host.pos.x * TILE, host.pos.y * TILE - 20, `-${amount}`, 0xff5555);
  }

  /** Damage that does not come from a creature (spike traps), with the difficulty and the armour applied. */
  harm(raw: number): void {
    const s = this.host.session;
    if (this.host.player.vulnerable) services.audio?.sfx('hurt');
    this.hurt(enemyDamage(raw, s.difficulty, defenseOf(s.equipment)));
  }

  /** The hero woke up somewhere else: everything that was chasing him is gone. */
  reset(): void {
    this.fullTimer = 0;
    this.calm = FIGHT_LINGER;
    this.host.player.recover();
    this.wildlife.clear();
  }
}
