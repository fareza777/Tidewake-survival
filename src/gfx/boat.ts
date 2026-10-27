import Phaser from 'phaser';

export const BOAT_KEY = 'boat_world';
const W = 44;
const H = 32;

/** The boat drawn once, in pixels: a brown hull with planks, a mast, two sails and a red pennant. */
export function createBoatTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(BOAT_KEY)) return;
  const tex = scene.textures.createCanvas(BOAT_KEY, W, H);
  if (!tex) return;
  const ctx = tex.getContext();
  const px = (x: number, y: number, w: number, h: number, color: string): void => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  const poly = (points: readonly (readonly [number, number])[], color: string): void => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fill();
  };
  // Hull
  poly([[3, 19], [41, 19], [36, 28], [9, 28]], '#6b4023');
  poly([[3, 19], [41, 19], [39, 22], [5, 22]], '#b87a40');
  px(5, 22, 34, 1, '#7a4a28');
  px(8, 25, 28, 1, '#5a3319');
  px(3, 18, 38, 1, '#d9a35a');
  px(4, 19, 1, 3, '#8a5a30');
  px(40, 19, 1, 3, '#8a5a30');
  // Mast and rigging
  px(21, 3, 2, 17, '#4a2f1a');
  px(22, 3, 1, 17, '#6b4527');
  ctx.strokeStyle = '#d8cdb0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(22, 3);
  ctx.lineTo(41, 18);
  ctx.moveTo(22, 4);
  ctx.lineTo(4, 18);
  ctx.stroke();
  // Sails
  poly([[24, 5], [39, 17], [24, 17]], '#f4efe0');
  poly([[24, 9], [39, 17], [24, 17]], '#d9d1b6');
  poly([[19, 7], [8, 17], [19, 17]], '#efe8d4');
  poly([[19, 11], [8, 17], [19, 17]], '#cfc6aa');
  // Pennant
  px(22, 1, 6, 3, '#d8453a');
  px(22, 1, 6, 1, '#f0705a');
  // A lantern at the stern
  px(36, 15, 2, 3, '#ffd070');
  tex.refresh();
}

/** A boat sitting on the water at the foot of tile (x, y): it rocks gently and a ring of foam breathes round it. */
export function makeBoat(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  createBoatTexture(scene);
  const foam = scene.add.ellipse(0, -1, 40, 9, 0xffffff, 0.35).setStrokeStyle(1, 0xdff4ff, 0.6);
  const hull = scene.add.image(0, 0, BOAT_KEY).setOrigin(0.5, 1);
  const boat = scene.add.container(x, y, [foam, hull]).setDepth(y + 1);
  scene.tweens.add({ targets: hull, y: -1.2, angle: 1.6, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  scene.tweens.add({ targets: foam, scaleX: 1.12, alpha: 0.18, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return boat;
}
