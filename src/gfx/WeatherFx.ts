import Phaser from 'phaser';
import { view } from '@/core/viewport';
import type { Season, Weather } from '@/sim/weather';

/** Rain, snow, drifting fog and the flash of lightning, drawn over the world (and under the buttons). */
export class WeatherFx {
  private rain: Phaser.GameObjects.Particles.ParticleEmitter;
  private snow: Phaser.GameObjects.Particles.ParticleEmitter;
  private fog: Phaser.GameObjects.Image[] = [];
  private flash: Phaser.GameObjects.Rectangle;
  private current: { weather: Weather; season: Season } | null = null;
  private nextBolt = 0;

  constructor(private scene: Phaser.Scene) {
    const { w: W, h: H } = view;
    // A drop must live long enough to fall the whole height of the screen (it starts above it and drifts sideways).
    const fall = (speed: number): number => Math.ceil(((H + 40) / speed) * 1000);
    this.rain = scene.add.particles(0, 0, 'ui_white', {
      x: { min: -30, max: W + 140 }, y: -16, lifespan: fall(430), speedY: { min: 430, max: 540 }, speedX: { min: -110, max: -80 },
      scaleX: 0.7, scaleY: 8, alpha: { start: 0.55, end: 0.3 }, tint: 0xb4d4ff, frequency: 13, emitting: false,
    }).setDepth(2);
    this.snow = scene.add.particles(0, 0, 'ui_white', {
      x: { min: -20, max: W + 60 }, y: -8, lifespan: fall(49), speedY: { min: 34, max: 64 }, speedX: { min: -24, max: 14 },
      scale: { min: 1.3, max: 2.6 }, alpha: { start: 0.9, end: 0.7 }, tint: 0xffffff, frequency: 80, emitting: false,
    }).setDepth(2);
    for (let i = 0; i < 4; i++) {
      const cloud = scene.add.image(W * (0.1 + i * 0.3), H * (0.25 + i * 0.16), 'fx_light').setTint(0xdfe6ee).setAlpha(0).setDisplaySize(W * 1.5, H * 0.5).setDepth(1);
      scene.tweens.add({ targets: cloud, x: cloud.x + (i % 2 === 0 ? 70 : -70), duration: 9000 + i * 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.fog.push(cloud);
    }
    this.flash = scene.add.rectangle(0, 0, W, H, 0xe6f0ff, 0).setOrigin(0, 0).setDepth(900);
  }

  /** Switch to this weather (nothing happens when it is already showing). */
  set(weather: Weather, season: Season): void {
    if (this.current && this.current.weather === weather && this.current.season === season) return;
    this.current = { weather, season };
    const heavy = weather === 'storm';
    const snowing = weather === 'snow' || (weather === 'storm' && season === 'winter');
    const raining = (weather === 'rain' || weather === 'storm') && season !== 'winter';
    if (raining) {
      this.rain.frequency = heavy ? 5 : 13;
      this.rain.start();
    } else this.rain.stop();
    if (snowing) {
      this.snow.frequency = heavy ? 25 : 80;
      this.snow.start();
    } else this.snow.stop();
    const fogAlpha = weather === 'fog' ? 0.2 : weather === 'cloudy' ? 0.05 : snowing || raining ? 0.07 : 0;
    this.fog.forEach((f) => this.scene.tweens.add({ targets: f, alpha: fogAlpha, duration: 1500 }));
    this.nextBolt = heavy ? 4 + Math.random() * 5 : 0;
  }

  /** Lightning in a storm. */
  update(dt: number): void {
    if (this.nextBolt <= 0) return;
    this.nextBolt -= dt;
    if (this.nextBolt > 0) return;
    this.nextBolt = 6 + Math.random() * 9;
    const hit = (delay: number, peak: number): void => {
      this.scene.tweens.add({ targets: this.flash, alpha: peak, duration: 50, delay, yoyo: true, hold: 30, ease: 'Quad.easeOut' });
    };
    hit(0, 0.55);
    hit(190, 0.35);
  }

  destroy(): void {
    this.rain.destroy();
    this.snow.destroy();
    this.fog.forEach((f) => f.destroy());
    this.flash.destroy();
  }
}
