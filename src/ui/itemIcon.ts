import Phaser from 'phaser';
import { ITEMS, type ItemId } from '@/data/items';

/** Display the generated item art at the requested virtual size, independent of atlas resolution. */
export function itemIcon(scene: Phaser.Scene, x: number, y: number, item: ItemId, size = 24): Phaser.GameObjects.Image {
  const icon = ITEMS[item].icon;
  return scene.add.image(x, y, icon.atlas, icon.frame).setDisplaySize(size, size);
}
