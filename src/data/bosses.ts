import type { BossId } from './dungeons';
import type { CreatureId } from './creatures';

/** What a boss can do. A move starts with a warning (`windup`), then happens, then the boss rests. */
export type BossAction = 'charge' | 'slam' | 'fan' | 'ring' | 'summon';

export interface BossMove {
  action: BossAction;
  /** Seconds of warning before the move happens (the boss glows red). */
  windup: number;
  /** Seconds the boss stands still afterwards. */
  rest: number;
  /** The boss starts this move when the hero is between these distances (tiles); otherwise it walks closer or backs off. */
  range: readonly [number, number];
  /** Hit points taken from the hero by a charge or slam that lands, or by each shot. */
  damage: number;
  /** Shots in a fan or ring, creatures in a summon. */
  count: number;
}

export interface BossPhase {
  /** Multiplies the boss's walking speed. */
  speed: number;
  moves: readonly BossMove[];
}

export interface BossDef {
  id: BossId;
  /** The creature summoned by a `summon` move. */
  summon: CreatureId;
  /** The second phase begins when the boss is down to this share of its hit points. */
  phase2Below: number;
  phases: readonly [BossPhase, BossPhase];
}

const move = (action: BossAction, windup: number, rest: number, range: readonly [number, number], damage: number, count = 1): BossMove => ({
  action, windup, rest, range, damage, count,
});

export const BOSSES: Record<BossId, BossDef> = {
  mossback: {
    id: 'mossback', summon: 'mushroom', phase2Below: 0.5,
    phases: [
      { speed: 1, moves: [move('charge', 0.9, 1.4, [3, 9], 14), move('slam', 0.7, 1, [0, 1.9], 12)] },
      { speed: 1.3, moves: [move('charge', 0.6, 1, [3, 10], 16), move('slam', 0.5, 0.8, [0, 2.1], 14), move('summon', 0.8, 1.5, [0, 99], 0, 2)] },
    ],
  },
  ironbones: {
    id: 'ironbones', summon: 'skeleton', phase2Below: 0.5,
    phases: [
      { speed: 1, moves: [move('slam', 0.6, 1, [0, 2.2], 14), move('fan', 0.7, 1.2, [3, 10], 9, 3)] },
      { speed: 1.25, moves: [move('slam', 0.45, 0.8, [0, 2.4], 16), move('fan', 0.55, 1, [3, 10], 10, 5), move('ring', 0.9, 1.2, [0, 12], 9, 8), move('summon', 0.8, 1.5, [0, 99], 0, 2)] },
    ],
  },
  hollowkeeper: {
    id: 'hollowkeeper', summon: 'ghost', phase2Below: 0.5,
    phases: [
      { speed: 1.05, moves: [move('slam', 0.55, 0.9, [0, 2.3], 16), move('fan', 0.65, 1, [3, 11], 10, 5), move('charge', 0.8, 1.2, [3, 9], 16)] },
      { speed: 1.35, moves: [move('slam', 0.4, 0.7, [0, 2.5], 18), move('ring', 0.8, 1, [0, 12], 10, 12), move('fan', 0.5, 0.8, [3, 11], 11, 7), move('summon', 0.7, 1.2, [0, 99], 0, 3)] },
    ],
  },
  mirelord: {
    id: 'mirelord', summon: 'ghost', phase2Below: 0.5,
    phases: [
      { speed: 1, moves: [move('fan', 0.8, 1.1, [4, 12], 9, 5), move('ring', 1, 1.4, [0, 12], 8, 10)] },
      { speed: 1.2, moves: [move('fan', 0.6, 0.9, [4, 12], 10, 7), move('ring', 0.8, 1.1, [0, 12], 9, 14), move('summon', 0.8, 1.5, [0, 99], 0, 2)] },
    ],
  },
};
