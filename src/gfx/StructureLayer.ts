import Phaser from 'phaser';
import { STRUCTURES } from '@/data/structures';
import { TILE } from '@/gfx/TerrainLayer';
import type { Structure, Structures } from '@/sim/structures';

/** A light source in world pixels. */
export interface LightSource {
  x: number;
  y: number;
  radius: number;
}

/** Sprites for everything the player has built. Depth follows the base line, like trees, so the hero walks around them. */
export class StructureLayer {
  private sprites = new Map<number, Phaser.GameObjects.Image>();

  constructor(private scene: Phaser.Scene, structures: Structures) {
    for (const s of structures.list) this.add(s);
  }

  add(s: Structure): void {
    const def = STRUCTURES[s.type];
    if (def.floor) {
      // Laid flat: it fills its tile and lies under everything else.
      this.sprites.set(s.id, this.scene.add.image(s.x * TILE, s.y * TILE, 'icons', def.frame).setOrigin(0, 0).setDepth(-79));
      return;
    }
    const x = (s.x + 0.5) * TILE;
    const y = (s.y + 1) * TILE - 1;
    const obj = def.world
      ? this.scene.add.sprite(x, y, 'props', def.world.frame).play(def.world.anim)
      : this.scene.add.image(x, y, 'icons', def.frame);
    obj.setOrigin(0.5, 1).setDepth(y);
    this.sprites.set(s.id, obj);
  }

  remove(id: number): void {
    this.sprites.get(id)?.destroy();
    this.sprites.delete(id);
  }

  /** Campfires, torches and furnaces light up the night. */
  lights(structures: Structures): LightSource[] {
    return structures.list
      .filter((s) => STRUCTURES[s.type].light > 0)
      .map((s) => ({ x: (s.x + 0.5) * TILE, y: (s.y + 0.5) * TILE, radius: STRUCTURES[s.type].light * TILE }));
  }
}
