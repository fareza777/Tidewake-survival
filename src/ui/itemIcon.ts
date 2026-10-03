import Phaser from 'phaser';
import { ITEMS, type ItemId } from '@/data/items';

/** An item's icon as an image of `size` virtual pixels (icons are drawn on a 16x16 grid). */
export function itemIcon(scene: Phaser.Scene, x: number, y: number, item: ItemId, size = 24): Phaser.GameObjects.Image {
  const icon = ITEMS[item].icon;
  return scene.add.image(x, y, icon.atlas, icon.frame).setDisplaySize(size, size);
}
