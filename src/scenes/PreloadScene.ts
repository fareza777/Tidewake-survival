import Phaser from 'phaser';
import { t } from '@/core/i18n';
import { services } from '@/core/services';
import { view } from '@/core/viewport';
import { TILES_KEY } from '@/data/terrainTiles';
import { registerAnimations } from '@/gfx/animations';
import { nine } from '@/ui/skin';
import { COLORS, FONT } from '@/ui/theme';

/** Sprite atlases built by tools/pack_assets.py. */
const ATLASES = ['heroes', 'actors', 'monsters', 'props', 'icons'];

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload(): void {
    const { w: W, h: H } = view;
    const barW = Math.min(220, W - 80);
    const y = Math.round(H * 0.55);
    this.add.bitmapText(W / 2, y - 18, FONT.small, t('loading')).setOrigin(0.5).setTint(COLORS.textDim);
    nine(this, W / 2 - barW / 2, y, 'ui_bar_bg', barW, 8).setOrigin(0, 0);
    const fill = this.add.image(W / 2 - barW / 2 + 1, y + 1, 'ui_white').setOrigin(0, 0).setTint(COLORS.gold);
    fill.setDisplaySize(1, 6);
    this.load.on('progress', (p: number) => fill.setDisplaySize(Math.max(1, Math.round((barW - 2) * p)), 6));
    this.load.on('loaderror', (f: Phaser.Loader.File) => console.warn('[preload] failed', f.key));

    for (const a of ATLASES) this.load.atlas(a, `assets/pack/${a}.png`, `assets/pack/${a}.json`);
    this.load.audioSprite('sfx', 'assets/audio/sfx.json', ['assets/audio/sfx.ogg']);
    this.load.spritesheet(TILES_KEY, 'assets/pack/tiles.png', { frameWidth: 16, frameHeight: 16 });
  }

  create(): void {
    registerAnimations(this);
    services.audio?.setMusicUrls({
      day: 'assets/audio/music_day.ogg', night: 'assets/audio/music_night.ogg', battle: 'assets/audio/music_battle.ogg',
    });
    services.audio?.markReady();
    this.scene.launch('Notify');
    void services.platform?.hideSplash();
    this.scene.start('Splash');
  }
}
