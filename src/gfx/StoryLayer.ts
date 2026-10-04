import Phaser from 'phaser';
import { NPCS } from '@/data/npcs';
import { dirFromVector, type Dir } from '@/gfx/animations';
import { TILE } from '@/gfx/TerrainLayer';
import type { NpcId } from '@/data/npcs';
import type { QuestState } from '@/sim/quests';
import { visibleSpots, type NpcPlace, type Spot } from '@/sim/world/spots';

const SPOT_ICON: Record<Exclude<Spot['kind'], 'cat'>, string> = { bottle: 'spot_bottle', tablet: 'spot_tablet', treasure: 'spot_dig' };

/** The islanders standing about, and the finds lying on the ground (bottles, tablets, buried treasure, the lost cat). */
export class StoryLayer {
  private spots = new Map<string, Phaser.GameObjects.Image>();
  private npcs = new Map<NpcId, Phaser.GameObjects.Sprite>();
  private facing = new Map<NpcId, Dir>();
  private lastFound: QuestState['found'] | null = null;

  constructor(scene: Phaser.Scene, places: readonly NpcPlace[], all: readonly Spot[]) {
    for (const p of places) {
      const def = NPCS[p.id];
      const x = (p.x + 0.5) * TILE;
      const y = (p.y + 1) * TILE - 1;
      this.npcs.set(p.id, scene.add.sprite(x, y, 'actors', `${def.sprite}/walk/down/1`).setOrigin(0.5, 1).setDepth(y));
      this.facing.set(p.id, 'down');
    }
    for (const s of all) {
      const x = (s.x + 0.5) * TILE;
      const y = (s.y + 1) * TILE - 1;
      const img = s.kind === 'cat'
        ? scene.add.image(x, y, 'actors', 'cat1/walk/down/0').setOrigin(0.5, 1).setDepth(y)
        : scene.add.image(x, y, 'icons', SPOT_ICON[s.kind]).setOrigin(0.5, 1).setDepth(s.kind === 'treasure' ? y - 40 : y);
      this.spots.set(s.id, img);
    }
  }

  private sprite(id: NpcId): { s: Phaser.GameObjects.Sprite; group: string } | null {
    const s = this.npcs.get(id);
    return s ? { s, group: NPCS[id].sprite } : null;
  }

  /** An islander takes a step to a neighbouring tile: they walk there and stand still again. */
  walk(id: NpcId, tx: number, ty: number): void {
    const n = this.sprite(id);
    if (!n) return;
    const { s, group } = n;
    const dir = dirFromVector(tx + 0.5 - s.x / TILE, ty + 1 - s.y / TILE, this.facing.get(id) ?? 'down');
    this.facing.set(id, dir);
    const toX = (tx + 0.5) * TILE;
    const toY = (ty + 1) * TILE - 1;
    s.scene.tweens.killTweensOf(s);
    s.play(`${group}_walk_${dir}`, true);
    s.scene.tweens.add({
      targets: s, x: toX, y: toY, duration: 520, ease: 'Linear',
      onUpdate: () => s.setDepth(s.y),
      onComplete: () => {
        s.anims.stop();
        s.setFrame(`${group}/walk/${dir}/1`).setDepth(toY);
      },
    });
  }

  /** An islander turns to look toward a point (tiles), standing where they are. */
  look(id: NpcId, x: number, y: number): void {
    const n = this.sprite(id);
    if (!n || n.s.anims.isPlaying) return;
    const dir = dirFromVector(x - n.s.x / TILE, y - n.s.y / TILE, this.facing.get(id) ?? 'down');
    this.facing.set(id, dir);
    n.s.setFrame(`${n.group}/walk/${dir}/1`);
  }

  /** Hide the finds that have been used up. Cheap when nothing changed. */
  sync(all: readonly Spot[], q: QuestState): void {
    if (q.found === this.lastFound) return;
    this.lastFound = q.found;
    const live = new Set(visibleSpots(all, q).map((s) => s.id));
    for (const [id, img] of this.spots) img.setVisible(live.has(id));
  }
}
