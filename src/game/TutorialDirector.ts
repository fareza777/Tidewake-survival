import { t } from '@/core/i18n';
import { FLAG_TUTORIAL, readFlag, setFlag } from '@/core/flags';
import { browserStorage } from '@/core/storage';
import { controls } from '@/game/input';
import type { GameScene } from '@/scenes/GameScene';
import type { HudScene } from '@/scenes/HudScene';
import { countItem } from '@/sim/inventory';

/** What the coach asks of the new hero, in order. */
type Step = 'move' | 'chop' | 'bag' | 'craft' | 'run' | 'done';
const ORDER: readonly Step[] = ['move', 'chop', 'bag', 'craft', 'run', 'done'];

/** The hero must walk this far (tiles) from where he woke up before the first lesson is passed. */
const WALK_GOAL = 5;
/** The closing words stay up this long (seconds). */
const FAREWELL = 5;

/** Which part of the HUD each lesson points at (it pulses), and the text key of its hint. */
const LESSONS: Record<Step, { hint: string; point: 'bag' | 'run' | 'use' | null }> = {
  move: { hint: 'tutMove', point: null },
  chop: { hint: 'tutChop', point: 'use' },
  bag: { hint: 'tutBag', point: 'bag' },
  craft: { hint: 'tutCraft', point: null },
  run: { hint: 'tutRun', point: 'run' },
  done: { hint: 'tutDone', point: null },
};

/**
 * A short guided start for a brand-new hero: walk, chop a tree, open the bag, craft, run. A hint sits on the screen and the
 * button it is about pulses; each lesson ends when the hero does the thing. It runs once per install and can be skipped.
 */
export class TutorialDirector {
  private step: Step = 'move';
  private active: boolean;
  private start: { x: number; y: number };
  private bagOpened = false;
  private farewell = 0;
  private shown: Step | null = null;

  constructor(private game: GameScene, isNewGame: boolean) {
    this.active = isNewGame && !readFlag(browserStorage(), FLAG_TUTORIAL);
    this.start = { ...game.pos };
  }

  /** The bag was opened (the Bag button, or by a station). */
  bagWasOpened(): void {
    this.bagOpened = true;
  }

  /** Called every frame while the island runs. */
  update(dt: number): void {
    if (!this.active) return;
    const hud = this.game.scene.get('Hud') as HudScene | undefined;
    if (!hud || !hud.sys.isActive()) return;
    if (this.step === 'done') {
      this.farewell -= dt;
      if (this.farewell <= 0) this.finish(hud);
      return;
    }
    if (this.passed()) {
      this.step = ORDER[ORDER.indexOf(this.step) + 1];
      if (this.step === 'done') this.farewell = FAREWELL;
    }
    if (this.shown !== this.step) {
      this.shown = this.step;
      hud.setHint(t(LESSONS[this.step].hint), LESSONS[this.step].point, () => this.finish(hud));
    }
  }

  private passed(): boolean {
    const g = this.game;
    switch (this.step) {
      case 'move': return Math.hypot(g.pos.x - this.start.x, g.pos.y - this.start.y) >= WALK_GOAL;
      case 'chop': return countItem(g.session.inventory, 'wood') > 0;
      case 'bag': return this.bagOpened;
      case 'craft': return Object.keys(g.session.quests.counters).some((k) => k.startsWith('craft:'));
      case 'run': return controls.run;
      default: return false;
    }
  }

  private finish(hud: HudScene): void {
    this.active = false;
    setFlag(browserStorage(), FLAG_TUTORIAL);
    hud.setHint(null, null);
  }
}
