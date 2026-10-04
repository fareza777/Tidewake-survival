import { describe, expect, it } from 'vitest';
import { CREATURES } from '@/data/creatures';
import { claimReward } from '@/sim/dungeon/rewards';
import { INVENTORY_SIZE, addItem, countItem, emptyInventory } from '@/sim/inventory';

const full = (free: number) => {
  let bag = emptyInventory();
  for (let i = 0; i < INVENTORY_SIZE - free; i++) bag = addItem(bag, 'axe_wood', 1).inv;
  return bag;
};

describe('claimReward', () => {
  it('puts what a boss leaves, the story item and the armour, straight into the backpack', () => {
    for (const id of ['mossback', 'ironbones', 'mirelord'] as const) {
      const bag = claimReward(emptyInventory(), id);
      expect(bag).not.toBeNull();
      for (const d of CREATURES[id].drops) expect(countItem(bag!, d.item), `${id} ${d.item}`).toBe(d.min);
    }
  });

  it('takes nothing at all when it would not all fit, so it can be tried again later', () => {
    const one = full(1);
    expect(claimReward(one, 'mossback')).toBeNull();
    expect(claimReward(full(0), 'mossback')).toBeNull();
    expect(countItem(one, 'compass')).toBe(0);
    expect(claimReward(full(2), 'mossback')).not.toBeNull();
  });
});
