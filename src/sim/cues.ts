import type { EncounterEvent } from '@/sim/encounters';
import type { Fx } from '@/sim/session';
import type { ResourceKind } from '@/sim/world/types';

/** Names of the sound effects in the audio sprite (tools/gen_sfx.py makes one clip for each). */
export const CUES = [
  'swing', 'hit', 'kill', 'hurt', 'shoot', 'pickup', 'chop', 'mine', 'eat', 'drink', 'craft', 'place', 'break', 'sleep', 'ui_click', 'death',
] as const;
export type Cue = (typeof CUES)[number];

export type Mood = 'day' | 'night' | 'battle';

/** Cutting a tree or a bush chops; rocks, ore and crystal ring. */
export function cueForNode(kind: ResourceKind): Cue {
  return kind === 'tree' || kind === 'palm' || kind === 'swamptree' || kind === 'bush' ? 'chop' : 'mine';
}

/** The sound that goes with an effect of the rules, or null when it is silent. `node` is the kind of node a 'hit' landed on. */
export function cueForFx(fx: Fx, node?: ResourceKind): Cue | null {
  switch (fx.t) {
    case 'swing': return 'swing';
    case 'shot': return 'shoot';
    case 'hit': return node ? cueForNode(node) : 'chop';
    case 'gain': case 'unbuilt': return 'pickup';
    case 'built': return 'place';
    case 'open': return 'ui_click';
    case 'slept': return 'sleep';
    case 'ate': return 'eat';
    case 'say': return fx.key === 'msgToolBroke' ? 'break' : fx.key === 'msgDrank' || fx.key === 'msgFilled' ? 'drink' : null;
    default: return null;
  }
}

/** The sound of something that happened among the creatures. */
export function cueForEncounter(ev: EncounterEvent): Cue {
  return ev.t === 'hit' ? 'hit' : ev.t === 'killed' ? 'kill' : 'hurt';
}

/** Battle music while monsters are on the hero; otherwise the music of the time of day. */
export const musicFor = (night: boolean, fighting: boolean): Mood => (fighting ? 'battle' : night ? 'night' : 'day');
