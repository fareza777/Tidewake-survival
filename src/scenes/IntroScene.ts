import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import type { GameInit } from './GameScene';
import { getLang, t } from '@/core/i18n';
import { services } from '@/core/services';
import { COLORS, FONT } from '@/ui/theme';
import { Button, label } from '@/ui/widgets';

interface Beat {
  line: string;
  /** Slow camera move over the picture: which way it drifts (-1 left, 1 right) and whether it pushes in or pulls back. */
  drift: number;
  push: boolean;
  /** Lightning flashes at the start. */
  storm?: boolean;
}

const BEATS: readonly Beat[] = [
  { line: 'intro1', drift: -1, push: true, storm: true },
  { line: 'intro2', drift: 1, push: true },
  { line: 'intro3', drift: -1, push: false },
  { line: 'intro4', drift: 1, push: true },
  { line: 'intro5', drift: 0, push: false },
];
/** A beat lasts at least this long (seconds) even when its voice is shorter, and keeps this long a pause after the voice. */
const MIN_BEAT = 4.2;
const PAUSE_AFTER_VOICE = 0.9;
const FADE_MS = 700;

/**
 * The opening cinematic: five painted pictures with a slow camera move, the narrator's voice and the words on screen.
 * A tap moves to the next picture, Skip goes straight to the game.
 */
export class IntroScene extends BaseScene {
  private init_!: GameInit;
  private index = -1;
  private pic?: Phaser.GameObjects.Image;
  private subtitle!: Phaser.GameObjects.BitmapText;
  private voice?: Phaser.Sound.BaseSound;
  private timer?: Phaser.Time.TimerEvent;
  private finished = false;
  private musicBefore = 0.6;

  constructor() {
    super('Intro');
  }

  preload(): void {
    const lang = getLang();
    BEATS.forEach((b, i) => {
      if (!this.textures.exists(`cine${i + 1}`)) this.load.image(`cine${i + 1}`, `assets/cinematic/intro${i + 1}.webp`);
      const key = `vo_${lang}_${b.line}`;
      if (!this.cache.audio.exists(key)) this.load.audio(key, `assets/vo/${lang}/${b.line}.mp3`);
    });
  }

  create(data: GameInit): void {
    this.init_ = data;
    this.index = -1;
    this.finished = false;
    this.transitioning = false;
    this.pic = undefined;
    this.cameras.main.setBackgroundColor(0x050810);
    this.fadeIn(500);
    const { W, H } = this;
    const veil = this.add.graphics().setDepth(5);
    veil.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.7, 0.7, 0, 0);
    veil.fillRect(0, 0, W, 70);
    veil.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.85, 0.85);
    veil.fillRect(0, H - 230, W, 230);
    this.add.image(W / 2, H / 2, 'fx_vignette').setDisplaySize(W * 1.2, H * 1.15).setAlpha(0.7).setDepth(6);
    this.subtitle = label(this, W / 2, H - 112, '', FONT.head, COLORS.text, 0.5, 0.5).setMaxWidth(W - 48).setCenterAlign().setAlpha(0).setDepth(8);
    new Button(this, W - 44, 26, t('introSkip'), () => this.finish(), { w: 72, h: 26, font: FONT.small, style: 'ghost' }).setDepth(9);
    this.input.on('pointerup', (_p: unknown, over: unknown[]) => {
      if (over.length === 0) this.next();
    });
    this.handleBack(() => {
      this.finish();
      return true;
    });
    // The music steps back so the voice is clear, and comes back to the player's level afterwards.
    this.musicBefore = services.settings?.musicVol ?? 0.6;
    services.audio?.setMusicVolume(this.musicBefore * 0.4);
    services.audio?.playMusic('night');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.next();
  }

  private next(): void {
    if (this.finished) return;
    this.timer?.remove();
    this.voice?.stop();
    this.voice?.destroy();
    this.voice = undefined;
    this.index += 1;
    if (this.index >= BEATS.length) {
      this.titleCard();
      return;
    }
    const beat = BEATS[this.index];
    this.showPicture(beat);
    this.say(beat);
  }

  /** The next painting fades in over the last one, then drifts slowly for as long as the beat lasts. */
  private showPicture(beat: Beat): void {
    const { W, H } = this;
    const key = `cine${this.index + 1}`;
    const old = this.pic;
    const img = this.add.image(W / 2, H / 2, key).setAlpha(0).setDepth(1 + this.index * 0.1);
    const cover = Math.max(W / img.width, H / img.height) * 1.04;
    const from = beat.push ? cover : cover * 1.14;
    const to = beat.push ? cover * 1.14 : cover;
    img.setScale(from);
    const shift = beat.drift * Math.min(18, W * 0.05);
    this.tweens.add({ targets: img, alpha: 1, duration: FADE_MS, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: img, scale: to, x: W / 2 + shift, duration: 9000, ease: 'Sine.easeInOut' });
    if (old) this.tweens.add({ targets: old, alpha: 0, duration: FADE_MS, onComplete: () => old.destroy() });
    this.pic = img;
    if (beat.storm) {
      this.time.delayedCall(350, () => this.cameras.main.flash(160, 220, 235, 255));
      this.time.delayedCall(700, () => this.cameras.main.flash(260, 200, 220, 255));
    }
  }

  /** The words appear and the narrator speaks; the next picture follows when the voice is done. */
  private say(beat: Beat): void {
    this.subtitle.setText(t(beat.line)).setAlpha(0);
    this.tweens.add({ targets: this.subtitle, alpha: 1, duration: 600, delay: 250 });
    const key = `vo_${getLang()}_${beat.line}`;
    let seconds = MIN_BEAT;
    if (this.cache.audio.exists(key)) {
      const voice = this.sound.add(key, { volume: Math.min(1, (services.settings?.sfxVol ?? 0.8) + 0.2) });
      this.voice = voice;
      this.time.delayedCall(450, () => voice.play());
      seconds = Math.max(MIN_BEAT, 0.45 + voice.duration + PAUSE_AFTER_VOICE);
    }
    this.timer = this.time.delayedCall(seconds * 1000, () => this.next());
  }

  /** After the last picture: the title, then the game. */
  private titleCard(): void {
    const { W, H } = this;
    this.timer?.remove();
    this.subtitle.setAlpha(0);
    const black = this.add.rectangle(0, 0, W, H, 0x050810, 0).setOrigin(0, 0).setDepth(20);
    this.tweens.add({ targets: black, alpha: 1, duration: 900 });
    const title = this.add.bitmapText(W / 2, H / 2, FONT.title, t('gameTitle').toUpperCase()).setOrigin(0.5).setScale(3).setTint(COLORS.gold).setDepth(21).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, scale: 3.3, duration: 1500, delay: 700, ease: 'Sine.easeOut' });
    this.timer = this.time.delayedCall(2800, () => this.finish());
  }

  private cleanup(): void {
    this.voice?.stop();
    this.voice?.destroy();
    this.voice = undefined;
    services.audio?.setMusicVolume(this.musicBefore);
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.timer?.remove();
    this.goTo('Game', this.init_);
  }
}
