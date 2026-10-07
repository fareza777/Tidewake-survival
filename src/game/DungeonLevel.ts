import { Rng } from '@/core/rng';
import { services } from '@/core/services';
import { t } from '@/core/i18n';
import { CREATURES } from '@/data/creatures';
import type { Station } from '@/data/structures';
import type { Level, LevelView, Lit } from '@/game/Level';
import { DungeonLayer } from '@/gfx/DungeonLayer';
import { TILE, TerrainLayer } from '@/gfx/TerrainLayer';
import type { GameScene } from '@/scenes/GameScene';
import { frontTile } from '@/sim/actions';
import { isBoss } from '@/sim/boss';
import { claimReward } from '@/sim/dungeon/rewards';
import { story } from '@/sim/session';
import { lightCrystal, newRun, pushBlock, solidTiles, solveRooms, targetAt, trapUnder, type Run } from '@/sim/dungeon/rules';
import { bossOf, creaturesInRoom, startEncounters } from '@/sim/dungeon/start';
import type { DungeonProgress } from '@/sim/dungeon/progress';
import type { Dungeon } from '@/sim/dungeon/types';
import type { Encounters, EncounterEvent } from '@/sim/encounters';
import { emptyFarm } from '@/sim/farm';
import { T, idx, type ResourceKind } from '@/sim/world/types';
import type { Vec } from '@/sim/movement';
import { rollDay, updateDungeon, type Fx, type Session } from '@/sim/session';
import type { Blocking } from '@/sim/solids';
import { emptyStructures } from '@/sim/structures';

/** Hit points a spike trap takes (before difficulty and armour). */
export const TRAP_DAMAGE = 6;
/** The hero must lean on a block this long before it slides, and rests this long after a push (seconds). */
const PUSH_AFTER = 0.3;
const PUSH_REST = 0.45;
/** How often the rooms are checked for being solved (seconds). */
const SOLVE_EVERY = 0.4;
/** How often a boss reward that did not fit the backpack is tried again (seconds). */
const CLAIM_EVERY = 2;
/** The dark of a dungeon, the glow of a wall torch (tiles) and of the hero's own light (world pixels). */
const GLOOM = { color: 0x050a18, alpha: 0.52 };
const TORCH_GLOW = 4;
const HERO_LIGHT = 76;

/** A dungeon: its walls, puzzle pieces, spikes and guards. The hero pushes blocks, strikes crystals and opens doors. */
export class DungeonLevel implements Level {
  readonly world;
  readonly fixed = true;
  private run: Run;
  private layer: DungeonLayer;
  private clock = 0;
  private lean = 0;
  private sinceSolve = 0;
  private sinceClaim = 0;
  private told = false;
  private everyTile: Set<number>;

  constructor(private host: GameScene, readonly dungeon: Dungeon) {
    this.world = dungeon.world;
    this.run = newRun(dungeon);
    new TerrainLayer(host, dungeon.world, dungeon.theme);
    this.layer = new DungeonLayer(host, dungeon, this.run, this.progress(host.session));
    this.everyTile = new Set(Array.from({ length: dungeon.world.size * dungeon.world.size }, (_, i) => i));
  }

  private progress(s: Session): DungeonProgress {
    return s.dungeons[this.dungeon.id];
  }

  /** The saved spot if the hero can stand there, otherwise the doorway he came in by. */
  place(saved: Vec): Vec {
    const x = Math.floor(saved.x);
    const y = Math.floor(saved.y);
    const ok = x >= 0 && y >= 0 && x < this.world.size && y < this.world.size && this.world.terrain[idx(x, y, this.world.size)] === T.FLOOR;
    return ok ? saved : { ...this.dungeon.entry };
  }

  start(): Encounters {
    return startEncounters(this.dungeon, this.progress(this.host.session), new Rng(Rng.seedFromTime()));
  }

  /** Walls are terrain; closed doors, blocks, pillars, crystals and chests are solid. Nothing can be built here. */
  blocking(session: Session): Blocking {
    return { solids: solidTiles(this.run, this.progress(session)), occupied: this.everyTile };
  }

  view(session: Session, _hero: Vec, front: { x: number; y: number }): LevelView {
    return { structures: emptyStructures(), farm: emptyFarm(), node: null, entrance: null, dock: false, npc: null, spot: null, target: targetAt(this.run, this.progress(session), front.x, front.y) };
  }

  lit(): Lit {
    const sources = this.dungeon.torches.map((o) => ({ x: (o.x + 0.5) * TILE, y: (o.y + 0.5) * TILE, radius: TORCH_GLOW * TILE }));
    return { ...GLOOM, sources, hero: HERO_LIGHT };
  }

  stations(): Set<Station> {
    return new Set();
  }

  isNight(): boolean {
    return true;
  }

  nodeKind(): ResourceKind | undefined {
    return undefined;
  }

  /** The rules opened a chest or a door: show it. */
  onFx(fx: Fx, session: Session): void {
    if (fx.t !== 'chestOpened' && fx.t !== 'doorOpened') return;
    this.layer.refresh(this.run, this.progress(session));
    this.host.rebuildBlocking();
  }

  /** Crystals struck by the hero light up; a dead boss is written into the progress. */
  onEvents(events: EncounterEvent[]): void {
    const host = this.host;
    for (const ev of events) {
      if (ev.t === 'struck') {
        host.session = updateDungeon(host.session, (p) => lightCrystal(p, ev.id));
        this.layer.refresh(this.run, this.progress(host.session));
      } else if (ev.t === 'killed' && isBoss(ev.kind)) {
        host.session = updateDungeon(host.session, (p) => ({ ...p, boss: true }));
        services.notify?.(t('msgBossDefeated', { name: t(`boss_${ev.kind}`) }));
        this.claim();
      }
    }
  }

  /** Run the dungeon for `dt` seconds: spikes, a block being pushed, rooms being solved. */
  update(dt: number, move: Vec, enc: Encounters): void {
    const host = this.host;
    this.clock += dt;
    this.layer.updateTraps(this.clock);
    if (trapUnder(this.run, host.pos, this.clock)) host.combat.harm(TRAP_DAMAGE);
    this.pushBlocks(dt, move);
    this.sinceClaim += dt;
    if (this.sinceClaim >= CLAIM_EVERY) {
      this.sinceClaim = 0;
      this.claim();
    }
    this.sinceSolve += dt;
    if (this.sinceSolve >= SOLVE_EVERY) {
      this.sinceSolve = 0;
      this.checkRooms(enc);
    }
  }

  /** Hand the dead boss's reward over, once. When the backpack is full it waits (also across visits) and the hero is told. */
  private claim(): void {
    const host = this.host;
    const p = this.progress(host.session);
    if (!p.boss || p.claimed) return;
    const bag = claimReward(host.session.inventory, this.dungeon.boss.kind);
    if (!bag) {
      if (!this.told) services.notify?.(t('msgRewardWaits'));
      this.told = true;
      return;
    }
    this.told = false;
    host.session = { ...host.session, inventory: bag };
    host.session = updateDungeon(host.session, (q) => ({ ...q, claimed: true }));
    host.commitStory(story(host.session, [`claim:${this.dungeon.id}`]));
  }

  /** Lean on the block in front of the hero; after a moment it slides one tile. */
  private pushBlocks(dt: number, move: Vec): void {
    const host = this.host;
    const f = frontTile(host.pos, host.player.facing);
    const block = this.run.blocks.find((b) => b.x === f.x && b.y === f.y);
    const dx = f.x - Math.floor(host.pos.x);
    const dy = f.y - Math.floor(host.pos.y);
    if (!block || move.x * dx + move.y * dy <= 0.3) {
      this.lean = 0;
      return;
    }
    this.lean += dt;
    if (this.lean < PUSH_AFTER) return;
    const moved = pushBlock(this.run, this.progress(host.session), block.id, dx, dy);
    this.lean = -PUSH_REST;
    if (!moved) return;
    this.run = moved;
    this.layer.refresh(this.run, this.progress(host.session));
    host.rebuildBlocking();
    services.audio?.sfx('place');
  }

  private checkRooms(enc: Encounters): void {
    const host = this.host;
    const before = this.progress(host.session);
    const session = updateDungeon(host.session, (p) => solveRooms(this.run, p, (room) => creaturesInRoom(enc, this.dungeon, room)));
    if (this.progress(session) === before) return;
    host.session = session;
    this.layer.refresh(this.run, this.progress(session));
    host.rebuildBlocking();
    services.notify?.(t('msgWayOpens'));
    services.audio?.sfx('craft');
  }

  /** Crops and nodes of the island keep as they are while the hero is below ground. */
  newDay(session: Session): Session {
    return rollDay(session, () => true);
  }

  bossBar(enc: Encounters): { name: string; hp: number; max: number } | null {
    const boss = bossOf(enc, this.dungeon);
    return boss?.angry ? { name: `boss_${boss.kind}`, hp: boss.hp, max: CREATURES[boss.kind].hp } : null;
  }
}
