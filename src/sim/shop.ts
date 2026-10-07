import { SHOPS, sellPrice } from '@/data/shops';
import type { NpcId } from '@/data/npcs';
import { addItem, countItem, removeItem, setSlot } from '@/sim/inventory';
import type { Session, Step } from '@/sim/session';
import { say } from '@/sim/sessionKit';
import { withStory } from '@/sim/storySession';

/** The gold in the hero's backpack. */
export const goldOf = (s: Session): number => countItem(s.inventory, 'gold');

/** Buy offer number `index` of a trader's shelf. Nothing changes when he cannot pay or the goods would not fit. */
export function buyOffer(s: Session, npc: NpcId, index: number): Step {
  const offer = SHOPS[npc]?.[index];
  if (!offer) return { session: s, fx: [] };
  const paid = removeItem(s.inventory, 'gold', offer.price);
  if (!paid) return { session: s, fx: [say('msgNoGold')] };
  const qty = offer.qty ?? 1;
  const got = addItem(paid, offer.item, qty);
  if (got.left > 0) return { session: s, fx: [say('msgFull')] };
  return withStory(
    { session: { ...s, inventory: got.inv }, fx: [{ t: 'gain', item: offer.item, qty }] },
    [`buy:${offer.item}`],
  );
}

/** Sell `qty` (at most the slot holds) of what lies in backpack slot `index`. */
export function sellSlot(s: Session, index: number, qty = 1): Step {
  const slot = s.inventory[index];
  if (!slot) return { session: s, fx: [] };
  const price = sellPrice(slot);
  if (price <= 0) return { session: s, fx: [] };
  const n = Math.min(qty, slot.qty);
  const rest = n >= slot.qty ? setSlot(s.inventory, index, null) : setSlot(s.inventory, index, { ...slot, qty: slot.qty - n });
  const paid = addItem(rest, 'gold', price * n);
  if (paid.left > 0) return { session: s, fx: [say('msgFull')] };
  return withStory({ session: { ...s, inventory: paid.inv }, fx: [{ t: 'gain', item: 'gold', qty: price * n }] }, ['sell']);
}
