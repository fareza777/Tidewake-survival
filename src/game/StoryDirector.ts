import { t, tr } from '@/core/i18n';
import { FLAG_RATE_ASKED, readFlag, setFlag } from '@/core/flags';
import { browserStorage } from '@/core/storage';
import { services } from '@/core/services';
import type { CreatureId } from '@/data/creatures';
import { ENDING_A, ENDING_B, LIGHTHOUSE_SECRET } from '@/data/lore';
import { QUESTS } from '@/data/quests';
import type { DialogueChoice } from '@/scenes/DialogueScene';
import type { GameScene } from '@/scenes/GameScene';
import type { Fx, Step } from '@/sim/session';
import { chooseEnding, claimOwed, dawn, reached, recordKill } from '@/sim/session';
import type { Text } from '@/sim/quests';

/** How often the story looks at where the hero stands and at rewards still owed (seconds), and how close counts as "reached" (tiles). */
const LOOK_EVERY = 0.5;
const REACH_RADIUS = 6;
/** A fire or torch this close to the hero lights his night watch (tiles). */
const LIGHT_RADIUS = 7;

const lines = (texts: readonly Text[]): string[] => texts.map((x) => tr(x));

type Dialog = Extract<Fx, { t: 'dialog' }>;

/** The story on the scene's side: what the quest events look like, the talking, the ending, and what the hero's whereabouts and deeds count for. */
export class StoryDirector {
  private since = 0;
  private slept = false;
  private rateDue = false;

  constructor(private game: GameScene) {}

  /** Show a rule's effect that belongs to the story. */
  play(fx: Fx): void {
    switch (fx.t) {
      case 'quest': this.announce(fx.ev); break;
      case 'dialog': this.say(fx); break;
      case 'ending': this.askEnding(); break;
      case 'theEnd': this.theEnd(fx.which); break;
      case 'slept': this.slept = true; break;
    }
  }

  private announce(ev: Extract<Fx, { t: 'quest' }>['ev']): void {
    const def = QUESTS[ev.id];
    if (!def) return;
    if (ev.t === 'started') services.notify?.(t('questStarted', { name: tr(def.title) }));
    else if (ev.t === 'step') services.notify?.(tr(def.steps[ev.step].text));
    else {
      services.notify?.(t('questComplete', { name: tr(def.title) }));
      // After the old sailor's chapter the player has met the story: a good moment to ask for a rating, once.
      if (ev.id === 'c3' && !readFlag(browserStorage(), FLAG_RATE_ASKED)) this.rateDue = true;
    }
  }

  private open(speaker: string | null, text: readonly string[], choices?: readonly DialogueChoice[]): void {
    const g = this.game;
    if (g.scene.isPaused() || g.scene.isActive('Dialogue')) return;
    g.scene.pause('Game');
    g.scene.launch('Dialogue', { speaker, lines: text, choices });
  }

  private say(fx: Dialog): void {
    this.open(fx.speaker ? tr(fx.speaker) : null, lines(fx.lines));
  }

  /** Run something after a dialogue has closed and the island has woken again (a new dialogue may follow it). */
  private afterClose(fn: () => void): () => void {
    return () => {
      this.game.time.delayedCall(30, fn);
    };
  }

  private choose(which: 'A' | 'B'): void {
    this.apply(chooseEnding(this.game.session, which));
  }

  private askEnding(): void {
    this.open(null, [t('raftPrompt')], [
      { label: t('endingLeave'), style: 'primary', onPick: this.afterClose(() => this.choose('A')) },
      { label: t('endingStay'), style: 'primary', onPick: this.afterClose(() => this.choose('B')) },
      { label: t('later'), onPick: () => undefined },
    ]);
  }

  private theEnd(which: 'A' | 'B'): void {
    this.open(t('endingTheEnd'), lines(which === 'A' ? ENDING_A : ENDING_B), [
      { label: t('endingKeep'), style: 'primary', onPick: () => undefined },
      { label: t('endingMenu'), onPick: () => this.game.quitToMenu() },
    ]);
  }

  private apply(step: Step): void {
    this.game.commitStory(step);
  }

  /** A creature was killed: counts for the kill quests, and the Hollow Keeper's fall reveals the secret. */
  kill(kind: CreatureId): void {
    this.apply(recordKill(this.game.session, kind));
    if (kind === 'hollowkeeper') this.open(null, lines(LIGHTHOUSE_SECRET));
  }

  /** A day began: a night survived, and perhaps a night watched. */
  newDay(): void {
    const g = this.game;
    const lit = g.level.dungeon === null && g.nearLight(LIGHT_RADIUS);
    this.apply(dawn(g.session, { slept: this.slept, lit }));
    this.slept = false;
  }

  /** Ask for a rating, once, when no other dialogue is open. */
  private askRate(): void {
    this.rateDue = false;
    setFlag(browserStorage(), FLAG_RATE_ASKED);
    this.open(t('rateTitle'), [t('rateBody')], [
      { label: t('rateNow'), style: 'primary', onPick: this.afterClose(() => void services.platform?.rate()) },
      { label: t('later'), onPick: () => undefined },
    ]);
  }

  /** Look around now and then: landmarks the hero has come near, rewards that were waiting for room in the backpack. */
  update(dt: number): void {
    if (this.rateDue && !this.game.scene.isActive('Dialogue')) this.askRate();
    this.since += dt;
    if (this.since < LOOK_EVERY) return;
    this.since = 0;
    const g = this.game;
    if (g.level.dungeon) return;
    for (const l of g.world.landmarks) {
      if (Math.hypot(l.x + 0.5 - g.pos.x, l.y + 0.5 - g.pos.y) <= REACH_RADIUS) this.apply(reached(g.session, l.id));
    }
    this.apply(claimOwed(g.session));
  }
}
