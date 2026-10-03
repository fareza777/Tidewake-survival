import Phaser from 'phaser';
import type { LightSource } from '@/gfx/StructureLayer';

/**
 * The night: a dark overlay the size of the camera view, with soft light shapes erased out of it around campfires,
 * torches and the hero. It lives in world space but is moved to the camera every frame, so it stays a small texture
 * (about 200 x 430 world pixels) however big the island is. Linear filtering keeps the light falloff smooth.
 */
export class NightLight {
  private rt: Phaser.GameObjects.RenderTexture;
  private eraser: Phaser.GameObjects.Image;
  private time = 0;

  constructor(scene: Phaser.Scene, cam: Phaser.Cameras.Scene2D.Camera) {
    // The camera's world view is only computed on its first render, so size the overlay from its width and zoom.
    const w = Math.ceil(cam.width / cam.zoom) + 4;
    const h = Math.ceil(cam.height / cam.zoom) + 4;
    this.rt = scene.add.renderTexture(0, 0, w, h).setOrigin(0, 0).setDepth(90000);
    this.rt.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.eraser = scene.make.image({ key: 'fx_light' }, false);
  }

  /** `alpha` is the darkness (0 in daylight); `lights` are in world pixels. */
  update(dt: number, cam: Phaser.Cameras.Scene2D.Camera, color: number, alpha: number, lights: readonly LightSource[]): void {
    this.time += dt;
    this.rt.setVisible(alpha > 0.01);
    if (alpha <= 0.01) return;
    const view = cam.worldView;
    // The overlay starts a little outside the view so rounding never uncovers a pixel row at the edge.
    const ox = Math.floor(view.x) - 2;
    const oy = Math.floor(view.y) - 2;
    this.rt.setPosition(ox, oy);
    this.rt.clear();
    this.rt.fill(color, alpha);
    for (const l of lights) {
      const flicker = 1 + Math.sin(this.time * 9 + l.x) * 0.04 + Math.sin(this.time * 23 + l.y) * 0.03;
      const r = l.radius * flicker;
      if (l.x + r < view.x || l.x - r > view.right || l.y + r < view.y || l.y - r > view.bottom) continue;
      // fx_light fades to nothing at its edge, so it is drawn a little larger than the nominal radius.
      this.eraser.setScale((r * 2.6) / 128).setAlpha(1);
      this.rt.erase(this.eraser, l.x - ox, l.y - oy);
    }
  }
}
