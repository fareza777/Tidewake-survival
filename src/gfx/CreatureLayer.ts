import Phaser from 'phaser';
import { snapWorld } from '@/core/viewport';
import { CREATURES, isHostileKind } from '@/data/creatures';
import { ITEMS } from '@/data/items';
import { animKey } from '@/gfx/animations';
import { TILE } from '@/gfx/TerrainLayer';
import type { Creature } from '@/sim/creatures';
import type { FlyingShot } from '@/sim/boss';
import type { Arrow } from '@/sim/encounters';
import type { Vec } from '@/sim/movement';
import type { Pickup } from '@/sim/pickups';

const FLASH_MS = 110;
/** How quickly a creature's picture catches up with where the simulation put it (per second), and how fast a hit's recoil and squash fade. */
const FOLLOW = 26;
const KICK_FADE = 13;
const SQUASH_FADE = 11;
const WINDUP_TINT = 0xff8a8a;
const SHOT_TINT = 0xd070ff;
/** Where the feet are inside a sprite cell: monsters are drawn in 48x48 cells, animals in 16x20. */
const FEET: Record<'monsters' | 'actors', number> = { monsters: 0.8, actors: 0.9 };
const BAR_W = 14;

interface CreatureView {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  bar: [Phaser.GameObjects.Rectangle, Phaser.GameObjects.Rectangle];
  flashUntil: number;
  /** Where the picture is now (world pixels), eased toward the simulation's position. */
  x: number;
  y: number;
  /** Recoil from the last blow (world pixels, fading) and the squash of the impact (1 fading to 0). */
  kickX: number;
  kickY: number;
  squash: number;
}

interface ItemView {
  icon: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
}

/** Sprites for the island's creatures, loose items and arrows, kept in step with the simulation by `sync`. */
export class CreatureLayer {
  private creatures = new Map<number, CreatureView>();
  private items = new Map<number, ItemView>();
  private arrows = new Map<number, Phaser.GameObjects.Image>();
  private shots = new Map<number, Phaser.GameObjects.Image>();

  constructor(private scene: Phaser.Scene) {}

  /** Create, move, animate and remove sprites so they match the given state. */
  sync(creatures: readonly Creature[], pickups: readonly Pickup[], arrows: readonly Arrow[], shots: readonly FlyingShot[]): void {
    this.syncCreatures(creatures);
    this.syncItems(pickups);
    this.syncArrows(arrows);
    this.syncShots(shots);
  }

  private syncCreatures(list: readonly Creature[]): void {
    const now = this.scene.time.now;
    const dt = Math.min(0.05, this.scene.game.loop.delta / 1000);
    const follow = 1 - Math.exp(-dt * FOLLOW);
    const kickFade = Math.exp(-dt * KICK_FADE);
    const squashFade = Math.exp(-dt * SQUASH_FADE);
    const seen = new Set<number>();
    for (const c of list) {
      seen.add(c.id);
      const def = CREATURES[c.kind];
      const view = this.creatures.get(c.id) ?? this.addCreature(c);
      // The picture glides after the simulation instead of jumping with it, so knock-back and charges read as movement.
      const tx = c.x * TILE;
      const ty = c.y * TILE;
      if (Math.hypot(tx - view.x, ty - view.y) > 3 * TILE) {
        view.x = tx;
        view.y = ty;
      } else {
        view.x += (tx - view.x) * follow;
        view.y += (ty - view.y) * follow;
      }
      view.kickX *= kickFade;
      view.kickY *= kickFade;
      view.squash *= squashFade;
      const px = snapWorld(view.x + view.kickX);
      const py = snapWorld(view.y + view.kickY);
      view.sprite.setPosition(px, py).setDepth(py);
      view.shadow.setPosition(px, py - 1).setDepth(py - 1);
      const dir = def.sprite.fixedDir ?? c.facing;
      const moving = c.state === 'wander' || c.state === 'chase' || c.state === 'flee' || c.state === 'charge';
      if (moving) {
        view.sprite.play(animKey(`${def.sprite.group}/${dir}`), true);
      } else {
        view.sprite.anims.stop();
        view.sprite.setFrame(`${def.sprite.group}/${dir}/${Math.min(1, def.sprite.frames - 1)}`);
      }
      if (now < view.flashUntil) view.sprite.setTintFill(0xffffff);
      else if (c.state === 'windup' || c.state === 'charge') view.sprite.setTint(WINDUP_TINT);
      else view.sprite.clearTint();
      const base = (def.sprite.scale ?? 1) * (c.state === 'windup' ? 1.12 : 1);
      view.sprite.setScale(base * (1 + 0.3 * view.squash), base * (1 - 0.22 * view.squash));
      this.updateBar(view, c, px, py);
    }
    for (const [id, view] of this.creatures) {
      if (seen.has(id)) continue;
      view.sprite.destroy();
      view.shadow.destroy();
      view.bar.forEach((b) => b.destroy());
      this.creatures.delete(id);
    }
  }

  private addCreature(c: Creature): CreatureView {
    const def = CREATURES[c.kind];
    const dir = def.sprite.fixedDir ?? c.facing;
    const sprite = this.scene.add.sprite(0, 0, def.sprite.atlas, `${def.sprite.group}/${dir}/1`).setOrigin(0.5, FEET[def.sprite.atlas]);
    const shadow = this.scene.add.image(0, 0, 'fx_shadow').setScale(def.radius * 3.2);
    sprite.setScale(def.sprite.scale ?? 1);
    const color = isHostileKind(c.kind) ? 0xe0524f : 0xff9a3c;
    const back = this.scene.add.rectangle(0, 0, BAR_W, 2, 0x000000, 0.65).setOrigin(0, 0.5).setVisible(false);
    const fill = this.scene.add.rectangle(0, 0, BAR_W, 2, color).setOrigin(0, 0.5).setVisible(false);
    const view: CreatureView = { sprite, shadow, bar: [back, fill], flashUntil: 0, x: c.x * TILE, y: c.y * TILE, kickX: 0, kickY: 0, squash: 0 };
    this.creatures.set(c.id, view);
    return view;
  }

  /** A health bar above a creature that has been hurt. */
  private updateBar(view: CreatureView, c: Creature, px: number, py: number): void {
    const def = CREATURES[c.kind];
    const hurt = c.hp < def.hp;
    const scale = def.sprite.scale ?? 1;
    const top = py - (def.sprite.atlas === 'monsters' ? 26 : 22) * scale;
    const w = BAR_W * scale;
    view.bar[0].setVisible(hurt).setPosition(px - w / 2, top).setDepth(py + 1).setSize(w, 2);
    view.bar[1].setVisible(hurt).setPosition(px - w / 2, top).setDepth(py + 2).setSize(Math.max(1, w * (c.hp / def.hp)), 2);
  }

  private syncItems(list: readonly Pickup[]): void {
    const now = this.scene.time.now;
    const seen = new Set<number>();
    for (const p of list) {
      seen.add(p.id);
      const view = this.items.get(p.id) ?? this.addItem(p);
      const px = snapWorld(p.x * TILE);
      const py = snapWorld(p.y * TILE);
      const bob = Math.sin((now + p.id * 137) / 220) * 1.5;
      view.icon.setPosition(px, py - 6 + bob).setDepth(py).setAlpha(p.age > 100 && Math.floor(now / 200) % 2 === 0 ? 0.35 : 1);
      view.shadow.setPosition(px, py - 1).setDepth(py - 1);
    }
    for (const [id, view] of this.items) {
      if (seen.has(id)) continue;
      view.icon.destroy();
      view.shadow.destroy();
      this.items.delete(id);
    }
  }

  private addItem(p: Pickup): ItemView {
    const icon = ITEMS[p.item].icon;
    const view = {
      icon: this.scene.add.image(0, 0, icon.atlas, icon.frame).setDisplaySize(12, 12),
      shadow: this.scene.add.image(0, 0, 'fx_shadow').setScale(0.5),
    };
    this.items.set(p.id, view);
    return view;
  }

  private syncArrows(list: readonly Arrow[]): void {
    const seen = new Set<number>();
    for (const a of list) {
      seen.add(a.id);
      const dir = a.dx > 0 ? 'right' : a.dx < 0 ? 'left' : a.dy < 0 ? 'up' : 'down';
      const img = this.arrows.get(a.id) ?? this.scene.add.image(0, 0, 'actors', `arrow/idle/${dir}/0`);
      this.arrows.set(a.id, img);
      const py = snapWorld(a.y * TILE);
      img.setPosition(snapWorld(a.x * TILE), py - 8).setDepth(py);
    }
    for (const [id, img] of this.arrows) {
      if (seen.has(id)) continue;
      img.destroy();
      this.arrows.delete(id);
    }
  }

  private syncShots(list: readonly FlyingShot[]): void {
    const seen = new Set<number>();
    for (const s of list) {
      seen.add(s.id);
      const img = this.shots.get(s.id) ?? this.scene.add.image(0, 0, 'fx_light').setTint(SHOT_TINT).setDisplaySize(16, 16).setBlendMode('ADD');
      this.shots.set(s.id, img);
      const py = snapWorld(s.y * TILE);
      img.setPosition(snapWorld(s.x * TILE), py - 8).setDepth(py);
    }
    for (const [id, img] of this.shots) {
      if (seen.has(id)) continue;
      img.destroy();
      this.shots.delete(id);
    }
  }

  /** A creature was just hit: it flashes white, squashes and recoils away from the blow (`dx, dy` is the direction of the blow). */
  flash(id: number, dx = 0, dy = 0): void {
    const view = this.creatures.get(id);
    if (!view) return;
    view.flashUntil = this.scene.time.now + FLASH_MS;
    view.kickX = dx * 5;
    view.kickY = dy * 5;
    view.squash = 1;
  }

  /** Small cloud where a creature died. Positions are in tiles. */
  puff(at: Vec): void {
    const x = at.x * TILE;
    const y = at.y * TILE - 6;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const dot = this.scene.add.image(x, y, 'ui_white').setDisplaySize(3, 3).setDepth(900_000);
      this.scene.tweens.add({
        targets: dot, x: x + Math.cos(angle) * 12, y: y + Math.sin(angle) * 9 - 4, alpha: 0, duration: 320, ease: 'Sine.easeOut',
        onComplete: () => dot.destroy(),
      });
    }
  }

}
