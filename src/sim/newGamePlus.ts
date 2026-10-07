import { ITEMS } from '@/data/items';
import type { SaveSlot } from '@/core/saveData';
import { newSlot } from '@/core/saveData';
import { newClock } from '@/sim/daynight';
import { emptyInventory, type Inventory } from '@/sim/inventory';
import { emptyQuests } from '@/sim/quests';
import type { Session } from '@/sim/session';
import { sessionToSlot } from '@/sim/session';
import { worldFor } from '@/sim/islands';

/** The story is over when the ending was chosen or the four sigils were shown to Marlo. */
export const canBeginNewGamePlus = (s: Session): boolean => s.quests.ending !== null || s.quests.done.includes('c16');

/** What the hero takes with him: tools, gear and goods stay; keys and sigils stay behind with the old story. */
function carried(inv: Inventory): Inventory {
  const kept = inv.filter((slot) => slot && (slot.item === 'gold' || !ITEMS[slot.item].keep));
  return [...kept, ...emptyInventory(inv.length - kept.length)];
}

/**
 * The next round: a new island and a new story, with the hero's skills, gear, backpack, gold and settlers kept. What he has
 * learnt of the bestiary and the deeds he earned come along too.
 */
export function newGamePlus(live: Session, base: SaveSlot, slot: number, seed: number, now = Date.now()): SaveSlot {
  const home = worldFor(seed, 'home');
  const fresh = newSlot(slot, base.name, seed, live.difficulty, home.start, newClock(), now);
  const old = sessionToSlot(base, live, { x: 0, y: 0 });
  const quests = {
    ...emptyQuests(),
    counters: Object.fromEntries(Object.entries(live.quests.counters).filter(([k]) => k.startsWith('ach:') || k.startsWith('kill:'))),
  };
  return {
    ...fresh, skills: old.skills, equipment: old.equipment, inventory: carried(old.inventory), settlers: old.settlers, store: old.store,
    quests, ng: live.ng + 1,
  };
}
