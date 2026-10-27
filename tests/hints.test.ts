import { describe, expect, it } from 'vitest';
import { newSlot } from '@/core/saveData';
import { UI_STRINGS } from '@/data/strings';
import { addItem } from '@/sim/inventory';
import { HINT_IDS, hintSeen, markHint, nextHint } from '@/sim/hints';
import { sessionFromSlot, type Session } from '@/sim/session';

const slot = () => newSlot(0, 'Ari', 1234, 'normal', { x: 50, y: 50 }, { day: 1, t: 100 }, 1000);
const base = (over: Partial<Session> = {}): Session => ({ ...sessionFromSlot(slot()), ...over });
const done = (...ids: string[]): Session['quests'] => ({ ...base().quests, done: ids });

describe('one-time tips', () => {
  it('have a text in both languages each', () => {
    for (const id of HINT_IDS) expect(UI_STRINGS[`hint_${id}`], id).toBeDefined();
  });

  it('say nothing to a fresh, well-fed hero', () => {
    expect(nextHint(base())).toBeNull();
  });

  it('come when the need arises, once each, and in order of importance', () => {
    const thirsty = base({ vitals: { ...base().vitals, thirst: 20, hunger: 20 } });
    expect(nextHint(thirsty)).toBe('thirst');
    const after = markHint(thirsty, 'thirst');
    expect(hintSeen(after, 'thirst')).toBe(true);
    expect(nextHint(after)).toBe('hunger');
    expect(nextHint(markHint(after, 'hunger'))).toBeNull();
  });

  it('point to gold, the traders, the boat, the dock, the camp and the Depths when they first matter', () => {
    const rich = base({ inventory: addItem(base().inventory, 'gold', 200).inv, quests: done('c3') });
    expect(nextHint(rich)).toBe('gold');
    expect(nextHint(markHint(rich, 'gold'))).toBe('shop');
    const lit = base({ quests: done('c3', 'c9') });
    expect(nextHint(lit)).toBe('boat');
    expect(nextHint(markHint(lit, 'boat'))).toBe('depths');
    expect(nextHint(base({ island: 'frost' }))).toBe('dock');
    expect(nextHint(markHint(markHint(markHint(markHint(rich, 'gold'), 'shop'), 'depths'), 'boat'))).toBe('camp');
  });

  it('keep quiet underground about the weather', () => {
    expect(nextHint(base({ location: 'grotto', vitals: { ...base().vitals, warmth: 10, thirst: 10 } }))).toBeNull();
  });
});
