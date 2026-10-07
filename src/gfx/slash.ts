import Phaser from 'phaser';
import type { Facing } from '@/sim/actions';

/**
 * The light a sword leaves in the air: a tapered crescent, thin at the tail and bright and thick at the head, that sweeps
 * round the hero in the blink of an eye. Drawn once as a smooth texture; every blow rotates, tints and fades a copy of it.
 */
export const SLASH_KEY = 'fx_slash';
const W = 128;
/** The arc's centre inside the texture (the hero's hand sits here), its radius, and how far it spans each side of straight ahead (degrees). */
const CX = 8;
const CY = 64;
const RADIUS = 96;
const SPAN = 42;
const FACING_DEG: Record<Facing, number> = { right: 0, down: 90, left: 180, up: 270 };

export function createSlashTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(SLASH_KEY)) return;
  const tex = scene.textures.createCanvas(SLASH_KEY, W, W);
  if (!tex) return;
  const ctx = tex.getContext();
  const steps = 90;
  const layers: readonly { grow: number; alpha: number }[] = [{ grow: 1.7, alpha: 0.28 }, { grow: 1, alpha: 1 }];
  for (const { grow, alpha } of layers) {
    for (let i = 0; i < steps; i++) {
      const u = i / steps;
      const next = (i + 1) / steps;
      const thick = (t: number): number => 3 + 30 * Math.pow(t, 1.1) * (1 - Math.pow(t, 9)) * grow;
      const angle = (t: number): number => ((-SPAN + 2 * SPAN * t) * Math.PI) / 180;
      const quad = (t: number, r: number): [number, number] => [CX + Math.cos(angle(t)) * r, CY + Math.sin(angle(t)) * r];
      ctx.beginPath();
      const a = quad(u, RADIUS + thick(u) / 2);
      const b = quad(next, RADIUS + thick(next) / 2);
      const c = quad(next, RADIUS - thick(next) / 2);
      const d = quad(u, RADIUS - thick(u) / 2);
      ctx.moveTo(...a);
      ctx.lineTo(...b);
      ctx.lineTo(...c);
      ctx.lineTo(...d);
      ctx.closePath();
      ctx.fillStyle = `rgba(255,255,255,${(alpha * Math.pow(u, 1.25)).toFixed(3)})`;
      ctx.fill();
    }
  }
  tex.refresh();
  tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

/** Which way the last blow swept (1 = down-and-through, -1 = back up): blows alternate, so a string of them flows. */
export const slashState = { side: 1 };

export function nextSlashSide(): number {
  slashState.side = -slashState.side;
  return slashState.side;
}

/**
 * Sweep a slash of light in front of the hero. `reach` is the blow's reach in pixels, `x, y` where the arm turns (world
 * pixels), `side` the swing direction from `nextSlashSide`.
 */
export function slashTrail(scene: Phaser.Scene, x: number, y: number, facing: Facing, reach: number, side: number, tint: number, depth: number): void {
  createSlashTexture(scene);
  const base = FACING_DEG[facing];
  const k = Math.max(0.2, (reach * 0.92) / RADIUS);
  const trail = scene.add.image(x, y, SLASH_KEY).setOrigin(CX / W, CY / W).setScale(k * 0.85).setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setDepth(depth).setAlpha(0);
  trail.setFlipY(side < 0);
  trail.setAngle(base - 62 * side);
  scene.tweens.add({ targets: trail, angle: base + 40 * side, scale: k * 1.05, duration: 150, ease: 'Cubic.easeOut' });
  scene.tweens.add({
    targets: trail, alpha: { from: 0, to: 1 }, duration: 45, onComplete: () => {
      scene.tweens.add({ targets: trail, alpha: 0, duration: 130, ease: 'Quad.easeIn', onComplete: () => trail.destroy() });
    },
  });
}
