import Phaser from 'phaser';
import { tr } from '@/core/i18n';
import { NPCS } from '@/data/npcs';
import { TILE } from '@/gfx/TerrainLayer';
import type { QuestState } from '@/sim/quests';
import { visibleSpots, type NpcPlace, type Spot } from '@/sim/world/spots';
import { COLORS, FONT } from '@/ui/theme';

const SPOT_ICON: Record<Exclude<Spot['kind'], 'cat'>, string> = { bottle: 'spot_bottle', tablet: 'spot_tablet', treasure: 'spot_dig' };

/** The islanders standing about, and the finds lying on the ground (bottles, tablets, buried treasure, the lost cat). */
export class StoryLayer {
  private spots = new Map<string, Phaser.GameObjects.Image>();
  private lastFound: QuestState['found'] | null = null;

  constructor(scene: Phaser.Scene, places: readonly NpcPlace[], all: readonly Spot[]) {
    for (const p of places) {
      const def = NPCS[p.id];
      const x = (p.x + 0.5) * TILE;
      const y = (p.y + 1) * TILE - 1;
      scene.add.image(x, y, 'actors', `${def.sprite}/walk/down/0`).setOrigin(0.5, 1).setDepth(y);
      scene.add.bitmapText(x, y - 22, FONT.small, tr(def.name)).setOrigin(0.5, 1).setTint(COLORS.gold).setDepth(y + 1);
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

  /** Hide the finds that have been used up. Cheap when nothing changed. */
  sync(all: readonly Spot[], q: QuestState): void {
    if (q.found === this.lastFound) return;
    this.lastFound = q.found;
    const live = new Set(visibleSpots(all, q).map((s) => s.id));
    for (const [id, img] of this.spots) img.setVisible(live.has(id));
  }
}
