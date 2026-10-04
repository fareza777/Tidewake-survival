import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { t } from '@/core/i18n';
import { services } from '@/core/services';
import { defaultSettings, type Settings } from '@/core/settings';
import { commitSettings } from '@/core/settingsApply';
import { SLOT_COUNT } from '@/core/save';
import { COLORS, FONT } from '@/ui/theme';
import { Button, label, panel, shrinkToFit, toast } from '@/ui/widgets';
import { confirm, showModal } from '@/ui/modal';

const VOLUME_STEP = 0.1;
const TEXT_SIZES: readonly number[] = [1, 1.15, 1.3];
const QUALITIES: readonly Settings['quality'][] = ['auto', 'high', 'low'];

export interface SettingsInit {
  /** Where to go when closed: the main menu, or back into the paused game. */
  back: 'Menu' | 'Game';
}

/** Volumes, switches, language, graphics, text size and deleting saves. Changes apply and are remembered at once. */
export class SettingsScene extends BaseScene {
  private cur!: Settings;
  private back: SettingsInit['back'] = 'Menu';
  private startLang: Settings['lang'] = 'en';
  private ui!: Phaser.GameObjects.Container;

  constructor() {
    super('Settings');
  }

  create(data: SettingsInit): void {
    this.back = data?.back ?? 'Menu';
    this.cur = services.settings ?? defaultSettings();
    this.startLang = this.cur.lang;
    this.transitioning = false;
    this.cameras.main.setBackgroundColor(COLORS.bg0);
    this.ui = this.add.container(0, 0);
    this.handleBack(() => {
      this.close();
      return true;
    });
    this.render();
  }

  private close(): void {
    if (this.back === 'Game') {
      const changed = this.cur.lang !== this.startLang;
      this.scene.stop();
      this.scene.resume('Game');
      // The HUD's own texts were written in the old language.
      if (changed) this.scene.get('Hud').scene.restart({ game: this.scene.get('Game') });
    } else {
      this.goTo('Menu');
    }
  }

  private set(patch: Partial<Settings>, needsRestart = false): void {
    this.cur = { ...this.cur, ...patch };
    commitSettings(this.cur);
    this.render();
    if (needsRestart) {
      showModal(this, t('setRestartTitle'), t('setRestartBody'), [
        { label: t('later') },
        { label: t('setRestartNow'), style: 'primary', onClick: () => window.location.reload() },
      ]);
    }
  }

  private resetSaves(): void {
    for (let i = 0; i < SLOT_COUNT; i++) services.saves?.delete(i);
    toast(this, t('setResetDone'));
  }

  private render(): void {
    this.ui.removeAll(true);
    const { W, H } = this;
    const s = this.cur;
    // (blocks taps from reaching the game's own buttons underneath)
    this.ui.add(this.add.rectangle(0, 0, W, H, COLORS.bg0, 1).setOrigin(0, 0).setInteractive());
    this.ui.add(panel(this, 6, 6, W - 12, H - 12, 'ui_panel_dark'));
    this.ui.add(label(this, 16, 14, t('setTitle'), FONT.head, COLORS.gold));
    const top = 46;
    const rowH = Math.min(34, Math.floor((H - top - 56) / 11));
    let row = 0;
    const y = (): number => top + row++ * rowH + rowH / 2;
    const rightX = W - 18;
    // A caption shrinks to leave room for its control, however long the language or the text size.
    const text = (caption: string, at: number, controlW = 104): void => {
      this.ui.add(shrinkToFit(label(this, 16, at, caption, FONT.body, COLORS.text, 0, 0.5), W - 16 - controlW - 28, 0.6));
    };
    const stepper = (caption: string, value: number, change: (v: number) => void): void => {
      const at = y();
      text(caption, at, 130);
      this.ui.add(new Button(this, rightX - 104, at, '-', () => change(Math.max(0, Math.round((value - VOLUME_STEP) * 10) / 10)), { w: 28, h: 24 }));
      this.ui.add(label(this, rightX - 62, at, `${Math.round(value * 100)}%`, FONT.small, COLORS.text, 0.5, 0.5));
      this.ui.add(new Button(this, rightX - 20, at, '+', () => change(Math.min(1, Math.round((value + VOLUME_STEP) * 10) / 10)), { w: 28, h: 24 }));
    };
    const toggle = (caption: string, on: boolean, change: (v: boolean) => void): void => {
      const at = y();
      text(caption, at, 80);
      this.ui.add(new Button(this, rightX - 40, at, on ? t('on') : t('off'), () => change(!on), { w: 80, h: 24, font: FONT.small, style: on ? 'primary' : 'normal' }));
    };
    const choice = (caption: string, shown: string, next: () => void): void => {
      const at = y();
      text(caption, at);
      this.ui.add(new Button(this, rightX - 52, at, shown, next, { w: 104, h: 24, font: FONT.small }));
    };
    stepper(t('setMusic'), s.musicVol, (v) => this.set({ musicVol: v }));
    stepper(t('setSfx'), s.sfxVol, (v) => this.set({ sfxVol: v }));
    toggle(t('setVibration'), s.vibration, (v) => this.set({ vibration: v }));
    toggle(t('setShake'), s.screenShake, (v) => this.set({ screenShake: v }));
    toggle(t('setDamage'), s.damageNumbers, (v) => this.set({ damageNumbers: v }));
    toggle(t('setAuto'), s.autoAttack, (v) => this.set({ autoAttack: v }));
    choice(t('setJoystick'), s.joystick === 'floating' ? t('joyFloating') : t('joyFixed'), () => this.set({ joystick: s.joystick === 'floating' ? 'fixed' : 'floating' }));
    choice(t('setLang'), s.lang === 'en' ? 'English' : 'Indonesia', () => this.set({ lang: s.lang === 'en' ? 'id' : 'en' }));
    const qName = { auto: t('qAuto'), high: t('qHigh'), low: t('qLow') };
    choice(t('setQuality'), qName[s.quality], () => this.set({ quality: QUALITIES[(QUALITIES.indexOf(s.quality) + 1) % QUALITIES.length] }, true));
    const sizeAt = Math.max(0, TEXT_SIZES.indexOf(s.textScale));
    choice(t('setTextSize'), `${Math.round(s.textScale * 100)}%`, () => this.set({ textScale: TEXT_SIZES[(sizeAt + 1) % TEXT_SIZES.length] }, true));
    // (not while a game runs: it would write its slot again at the next autosave)
    if (this.back === 'Menu') {
      const at = y();
      text(t('setReset'), at, 118);
      this.ui.add(new Button(this, rightX - 40, at, t('setResetBtn'), () => confirm(this, t('setReset'), t('setResetConfirm'), () => this.resetSaves(), true), { w: 80, h: 24, font: FONT.small, style: 'danger' }));
    }
    this.ui.add(new Button(this, W / 2, H - 28, t('back'), () => this.close(), { w: 140, h: 30, style: 'primary' }));
  }
}
