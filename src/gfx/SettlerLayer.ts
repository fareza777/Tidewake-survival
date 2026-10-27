import Phaser from 'phaser';
import { Rng } from '@/core/rng';
import { ITEMS, type ItemId } from '@/data/items';
import type { Job } from '@/data/settlers';
import { dirFromVector, type Dir } from '@/gfx/animations';
import { TILE } from '@/gfx/TerrainLayer';
import { GROUND, idx, inBounds, type World } from '@/sim/world/types';

/** The look of each trade: a villager sprite and the tool shown over their head. */
const LOOK: Record<Job, { sprite: string; tool: ItemId }> = {
  farmer: { sprite: 'npc7', tool: 'hoe' },
  woodcutter: { sprite: 'npc11', tool: 'axe_iron' },
  miner: { sprite: 'npc17', tool: 'pickaxe_iron' },
  cook: { sprite: 'npc21', tool: 'cooked_meat' },
  hunter: { sprite: 'npc3', tool: 'bow' },
};

/** Where around the camp each settler (in order of hiring) likes to stand, in tiles from the camp. */
const SPOTS: readonly (readonly [number, number])[] = [[-2, 2], [2, 2], [-3, -1], [3, -1], [0, 3], [0, -3]];
/** How far a settler strolls from the spot (tiles). */
const ROAM = 2;

interface Walker {
  sprite: Phaser.GameObjects.Sprite;
  bubble: Phaser.GameObjects.Image;
  look: (typeof LOOK)[Job];
  home: { x: number; y: number };
  at: { x: number; y: number };
  dir: Dir;
  wait: number;
}

/** The people who work for the hero, standing about his camp and strolling a step or two now and then. */
export class SettlerLayer {
  private walkers: Walker[] = [];
  private rng = new Rng(4242);

  constructor(private scene: Phaser.Scene, private world: World) {}

  /** Bring the people on screen in line with the settlers the hero has (a new one walks in beside the camp). */
  sync(jobs: readonly Job[], camp: { x: number; y: number }): void {
    if (jobs.length === this.walkers.length) return;
    this.clear();
    jobs.forEach((job, i) => {
      const spot = SPOTS[i % SPOTS.length];
      const home = this.freeNear(Math.floor(camp.x) + spot[0], Math.floor(camp.y) + spot[1]);
      const look = LOOK[job];
      const x = (home.x + 0.5) * TILE;
      const y = (home.y + 1) * TILE - 1;
      const sprite = this.scene.add.sprite(x, y, 'actors', `${look.sprite}/walk/down/1`).setOrigin(0.5, 1).setDepth(y);
      this.walkers.push({ sprite, bubble: this.toolBubble(look.tool, x, y), look, home, at: home, dir: 'down', wait: this.rng.float(1, 4) });
    });
  }

  private toolBubble(tool: ItemId, x: number, y: number): Phaser.GameObjects.Image {
    const art = ITEMS[tool].icon;
    return this.scene.add.image(x, y - 22, art.atlas, art.frame).setDisplaySize(9, 9).setDepth(y + 1).setAlpha(0.9);
  }

  /** The nearest ground tile to (x, y) a person can stand on. */
  private freeNear(x: number, y: number): { x: number; y: number } {
    for (let r = 0; r < 6; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const tx = x + dx;
          const ty = y + dy;
          if (inBounds(tx, ty, this.world.size) && GROUND.has(this.world.terrain[idx(tx, ty, this.world.size)])) return { x: tx, y: ty };
        }
      }
    }
    return { x, y };
  }

  /** Now and then a settler takes a step. `blocked` tells the tiles nobody can stand on (asked only when a step is tried). */
  update(dt: number, blocked: () => ReadonlySet<number>): void {
    for (const w of this.walkers) {
      w.wait -= dt;
      if (w.wait > 0) continue;
      w.wait = this.rng.float(2.5, 6.5);
      const step = this.rng.pick([[1, 0], [-1, 0], [0, 1], [0, -1]] as const);
      const to = { x: w.at.x + step[0], y: w.at.y + step[1] };
      if (Math.abs(to.x - w.home.x) > ROAM || Math.abs(to.y - w.home.y) > ROAM) continue;
      const i = idx(to.x, to.y, this.world.size);
      if (!inBounds(to.x, to.y, this.world.size) || !GROUND.has(this.world.terrain[i]) || blocked().has(i)) continue;
      w.at = to;
      w.dir = dirFromVector(step[0], step[1], w.dir);
      const toX = (to.x + 0.5) * TILE;
      const toY = (to.y + 1) * TILE - 1;
      this.scene.tweens.killTweensOf(w.sprite);
      w.sprite.play(`${w.look.sprite}_walk_${w.dir}`, true);
      this.scene.tweens.add({ targets: [w.sprite], x: toX, y: toY, duration: 520, onUpdate: () => {
        w.sprite.setDepth(w.sprite.y);
        w.bubble.setPosition(w.sprite.x, w.sprite.y - 22).setDepth(w.sprite.y + 1);
      }, onComplete: () => {
        w.sprite.anims.stop();
        w.sprite.setFrame(`${w.look.sprite}/walk/${w.dir}/1`);
      } });
    }
  }

  private clear(): void {
    for (const w of this.walkers) {
      this.scene.tweens.killTweensOf(w.sprite);
      w.sprite.destroy();
      w.bubble.destroy();
    }
    this.walkers = [];
  }
}
