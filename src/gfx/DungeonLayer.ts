import Phaser from 'phaser';
import { DUNGEON_ART } from '@/data/dungeonArt';
import { animKey } from '@/gfx/animations';
import { TILE } from '@/gfx/TerrainLayer';
import type { DungeonProgress } from '@/sim/dungeon/progress';
import { doorIsOpen, pressedSwitches, trapState, type Run } from '@/sim/dungeon/rules';
import type { Dungeon } from '@/sim/dungeon/types';

const BLOCK_SLIDE_MS = 120;

/** Where a sprite stands on a tile: horizontally centred, resting on the tile's lower edge. */
const footX = (x: number): number => (x + 0.5) * TILE;
const footY = (y: number): number => (y + 1) * TILE - 1;

/** The sprites of a dungeon's puzzle pieces. `refresh` brings them in line with the rules; `traps` animates the spikes. */
export class DungeonLayer {
  private doors = new Map<number, { sprite: Phaser.GameObjects.Sprite; open: boolean }>();
  private switches = new Map<number, { sprite: Phaser.GameObjects.Image; on: boolean }>();
  private blocks = new Map<number, Phaser.GameObjects.Image>();
  private chests = new Map<number, { sprite: Phaser.GameObjects.Sprite; open: boolean }>();
  private crystals = new Map<number, { sprite: Phaser.GameObjects.Sprite; lit: boolean }>();
  private traps = new Map<number, { sprite: Phaser.GameObjects.Image; state: string }>();
  private stairs?: Phaser.GameObjects.Sprite;

  constructor(private scene: Phaser.Scene, private dungeon: Dungeon, run: Run, progress: DungeonProgress) {
    const d = dungeon;
    for (const t of d.torches) {
      scene.add.sprite(footX(t.x), footY(t.y), 'props', `${DUNGEON_ART.torch}/0`).setOrigin(0.5, 1).setDepth(footY(t.y) + 1).play(animKey(DUNGEON_ART.torch));
    }
    scene.add.sprite(footX(d.exit.x), footY(d.exit.y), 'props', `${DUNGEON_ART.door.exit}/3`).setOrigin(0.5, 1).setDepth(footY(d.exit.y));
    if (d.stairs) {
      this.stairs = scene.add.sprite(footX(d.stairs.x), footY(d.stairs.y), 'props', `${DUNGEON_ART.door.exit}/0`).setOrigin(0.5, 1).setDepth(footY(d.stairs.y)).setTint(0xffe9a8).setVisible(false);
    }
    for (const door of d.doors) {
      if (door.lock === 'free') continue;
      const group = door.lock === 'boss' ? DUNGEON_ART.door.boss : DUNGEON_ART.door.gate;
      this.doors.set(door.id, { sprite: scene.add.sprite(footX(door.x), footY(door.y), 'props', `${group}/0`).setOrigin(0.5, 1).setDepth(footY(door.y)), open: false });
    }
    for (const s of d.switches) this.switches.set(s.id, { sprite: scene.add.image(footX(s.x), footY(s.y), 'props', DUNGEON_ART.switch.off).setOrigin(0.5, 1).setDepth(footY(s.y) - 8), on: false });
    for (const b of run.blocks) this.blocks.set(b.id, scene.add.image(footX(b.x), footY(b.y), 'props', DUNGEON_ART.block).setOrigin(0.5, 1).setDepth(footY(b.y)));
    for (const c of d.chests) {
      const group = c.locked ? DUNGEON_ART.chest.locked : DUNGEON_ART.chest.free;
      this.chests.set(c.id, { sprite: scene.add.sprite(footX(c.x), footY(c.y), 'props', `${group}/0`).setOrigin(0.5, 1).setDepth(footY(c.y)), open: false });
    }
    for (const c of d.crystals) {
      const sprite = scene.add.sprite(footX(c.x), footY(c.y), 'props', `${DUNGEON_ART.crystal.dull}/0`).setOrigin(0.5, 1).setDepth(footY(c.y)).play(animKey(DUNGEON_ART.crystal.dull));
      this.crystals.set(c.id, { sprite, lit: false });
    }
    for (const t of d.traps) this.traps.set(t.id, { sprite: scene.add.image(footX(t.x), footY(t.y), 'props', `${DUNGEON_ART.trapSheet}/${DUNGEON_ART.trap.down}`).setOrigin(0.5, 1).setDepth(footY(t.y) - 10), state: 'down' });
    this.refresh(run, progress, false);
  }

  /** Show doors, switches, blocks, chests and crystals as the rules have them. `animate` is off for the first draw. */
  refresh(run: Run, progress: DungeonProgress, animate = true): void {
    this.stairs?.setVisible(progress.boss);
    for (const door of this.dungeon.doors) {
      const v = this.doors.get(door.id);
      const open = doorIsOpen(door, progress);
      if (!v || v.open === open) continue;
      v.open = open;
      if (!open) continue;
      const group = door.lock === 'boss' ? DUNGEON_ART.door.boss : DUNGEON_ART.door.gate;
      if (!animate) v.sprite.setVisible(false);
      else v.sprite.play(animKey(group)).once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => v.sprite.setVisible(false));
    }
    const pressed = pressedSwitches(run);
    for (const [id, v] of this.switches) {
      const on = pressed.includes(id);
      if (v.on !== on) v.sprite.setFrame(on ? DUNGEON_ART.switch.on : DUNGEON_ART.switch.off);
      v.on = on;
    }
    for (const b of run.blocks) {
      const sprite = this.blocks.get(b.id);
      if (!sprite) continue;
      const x = footX(b.x);
      const y = footY(b.y);
      if (sprite.x === x && sprite.y === y) continue;
      sprite.setDepth(y);
      if (animate) this.scene.tweens.add({ targets: sprite, x, y, duration: BLOCK_SLIDE_MS });
      else sprite.setPosition(x, y);
    }
    for (const c of this.dungeon.chests) {
      const v = this.chests.get(c.id);
      const open = progress.looted.includes(c.id);
      if (!v || v.open === open) continue;
      v.open = open;
      const group = c.locked ? DUNGEON_ART.chest.locked : DUNGEON_ART.chest.free;
      if (animate) v.sprite.play(animKey(group));
      else v.sprite.setFrame(`${group}/3`);
    }
    for (const c of this.dungeon.crystals) {
      const v = this.crystals.get(c.id);
      const lit = progress.lit.includes(c.id);
      if (!v || v.lit === lit) continue;
      v.lit = lit;
      v.sprite.play(animKey(lit ? DUNGEON_ART.crystal.lit : DUNGEON_ART.crystal.dull));
    }
  }

  /** Move the spikes through their cycle; `t` is the dungeon clock in seconds. */
  updateTraps(t: number): void {
    for (const tr of this.dungeon.traps) {
      const v = this.traps.get(tr.id);
      if (!v) continue;
      const state = trapState(tr, t);
      if (state === v.state) continue;
      v.state = state;
      v.sprite.setFrame(`${DUNGEON_ART.trapSheet}/${DUNGEON_ART.trap[state]}`);
    }
  }
}
