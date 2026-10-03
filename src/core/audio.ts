import Phaser from 'phaser';

/**
 * Music streams through HTMLAudioElement (low memory, loaded on demand, crossfaded) while short SFX are decoded
 * WebAudio buffers (pooled, pitch-varied, rate-limited). Missing keys are ignored so the game never breaks on audio.
 */
export class AudioManager {
  private game: Phaser.Game;
  private music?: HTMLAudioElement;
  private musicKey = '';
  private musicUrls: Record<string, string> = {};
  private lastPlayed = new Map<string, number>();
  private warned = new Set<string>();
  private pendingUnlock = false;
  musicVolume = 0.6;
  sfxVolume = 0.8;
  private duck = 1;
  private paused = false;
  private ready = false;
  private readyCallbacks: (() => void)[] = [];

  constructor(game: Phaser.Game) {
    this.game = game;
  }

  /** Called once the SFX audio sprite has finished decoding. */
  markReady(): void {
    this.ready = true;
    const cbs = this.readyCallbacks;
    this.readyCallbacks = [];
    for (const cb of cbs) cb();
  }

  /** Run now if SFX are loaded, otherwise as soon as they are. */
  onReady(cb: () => void): void {
    if (this.ready) cb();
    else this.readyCallbacks.push(cb);
  }

  setMusicUrls(urls: Record<string, string>): void {
    this.musicUrls = urls;
  }

  private warn(key: string): void {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    console.warn(`[audio] missing ${key}`);
  }

  playMusic(key: string, fadeMs = 800): void {
    if (key === this.musicKey && this.music && !this.music.paused) return;
    const old = this.music;
    this.musicKey = key;
    if (old) this.fade(old, 0, fadeMs, () => {
      old.pause();
      old.src = '';
    });
    this.music = undefined;
    const url = this.musicUrls[key];
    if (!key || !url) {
      if (key) this.warn(key);
      return;
    }
    const el = new Audio(url);
    el.loop = true;
    el.volume = 0;
    el.preload = 'auto';
    this.music = el;
    if (!this.paused) this.start(el, fadeMs);
  }

  private start(el: HTMLAudioElement, fadeMs: number): void {
    el.play().then(() => this.fade(el, this.targetVolume(), fadeMs)).catch(() => {
      // Autoplay blocked until the first user gesture: retry once the player touches the screen.
      if (this.pendingUnlock) return;
      this.pendingUnlock = true;
      const retry = () => {
        this.pendingUnlock = false;
        window.removeEventListener('pointerdown', retry);
        if (this.music === el) this.start(el, 400);
      };
      window.addEventListener('pointerdown', retry);
    });
  }

  private targetVolume(): number {
    return Math.max(0, Math.min(1, this.musicVolume * this.duck));
  }

  stopMusic(fadeMs = 600): void {
    const old = this.music;
    if (old) this.fade(old, 0, fadeMs, () => old.pause());
    this.music = undefined;
    this.musicKey = '';
  }

  /** Pause everything when the app goes to background, resume on return. */
  setPaused(p: boolean): void {
    this.paused = p;
    if (!this.music) return;
    if (p) this.music.pause();
    else this.start(this.music, 300);
  }

  /** Temporarily lower music (dialogue, pause). */
  setDuck(amount: number): void {
    this.duck = amount;
    if (this.music) this.fade(this.music, this.targetVolume(), 250);
  }

  setMusicVolume(v: number): void {
    this.musicVolume = v;
    if (this.music) this.music.volume = this.targetVolume();
  }

  setSfxVolume(v: number): void {
    this.sfxVolume = v;
  }

  /** Plays one of key, key_1, key_2 ... variants, with small random pitch. */
  sfx(key: string, opts: { volume?: number; rate?: number; detune?: number; minGapMs?: number } = {}): void {
    if (this.sfxVolume <= 0 || this.paused) return;
    const now = performance.now();
    const gap = opts.minGapMs ?? 40;
    const last = this.lastPlayed.get(key) ?? 0;
    if (now - last < gap) return;
    if (!this.hasClip(key)) {
      if (this.ready) this.warn(key);
      return;
    }
    this.lastPlayed.set(key, now);
    try {
      this.game.sound.playAudioSprite('sfx', key, {
        volume: this.sfxVolume * (opts.volume ?? 1),
        rate: opts.rate ?? 1,
        detune: opts.detune ?? Phaser.Math.Between(-60, 60),
      });
    } catch (err) {
      console.warn('[audio] sfx failed', key, err);
    }
  }

  /** True if the packed SFX sprite contains this clip (also used for voice lines). */
  hasClip(key: string): boolean {
    const map = (this.game.cache.json.get('sfx') as { spritemap?: Record<string, unknown> } | undefined)?.spritemap;
    return !!map && key in map;
  }

  /** Play a voice line from the audio sprite; returns the sound so callers can stop it. */
  voice(key: string, volume = 1): Phaser.Sound.BaseSound | null {
    if (!this.hasClip(key) || this.paused) return null;
    const snd = this.game.sound.addAudioSprite('sfx');
    snd.play(key, { volume: Math.min(1, this.sfxVolume * volume) });
    snd.once('complete', () => snd.destroy());
    return snd;
  }

  private fade(el: HTMLAudioElement, to: number, ms: number, done?: () => void): void {
    const from = el.volume;
    const start = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / Math.max(1, ms));
      el.volume = Math.max(0, Math.min(1, from + (to - from) * t));
      if (t < 1) requestAnimationFrame(step);
      else done?.();
    };
    step();
  }
}
