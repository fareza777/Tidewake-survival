import { describe, expect, it } from 'vitest';
import { RESPAWN_VITALS, applyDeath } from '@/sim/death';
import { addItem, countItem, emptyInventory } from '@/sim/inventory';

const inv = addItem(addItem(emptyInventory(), 'wood', 10).inv, 'stone', 4).inv;

describe('applyDeath', () => {
  it('keeps everything on Relaxed', () => {
    const r = applyDeath('relaxed', inv, () => 0.9);
    expect(r.inv).toBe(inv);
    expect(r.wipeSave).toBe(false);
    expect(r.vitals).toEqual(RESPAWN_VITALS);
  });

  it('loses half of the hotbar on Normal and spares the rest of the backpack', () => {
    const r = applyDeath('normal', inv, () => 0.9);
    expect(countItem(r.inv, 'wood')).toBe(5);
    expect(countItem(r.inv, 'stone')).toBe(2);
    expect(r.wipeSave).toBe(false);
    expect(countItem(inv, 'wood')).toBe(10);
  });

  it('never takes keys, story items or boss armour, however the dice fall, so a dungeon can always be finished', () => {
    let bag = addItem(emptyInventory(), 'wood', 10).inv;
    for (const item of ['boss_key', 'small_key', 'compass', 'hull_planks', 'lighthouse_key', 'armor_moss', 'armor_ironbones', 'armor_mire'] as const) bag = addItem(bag, item, 1).inv;
    for (const roll of [0, 0.4, 0.9]) {
      const r = applyDeath('normal', bag, () => roll);
      for (const item of ['boss_key', 'small_key', 'compass', 'hull_planks', 'lighthouse_key', 'armor_moss', 'armor_ironbones', 'armor_mire'] as const) {
        expect(countItem(r.inv, item), `${item} at roll ${roll}`).toBe(1);
      }
      expect(countItem(r.inv, 'wood')).toBe(5);
    }
  });

  it('ends the adventure on Hardcore', () => {
    expect(applyDeath('hardcore', inv, () => 0.9).wipeSave).toBe(true);
  });

  it('wakes the hero up alive but needy so they do not collapse again at once', () => {
    expect(RESPAWN_VITALS.hp).toBeGreaterThan(0);
    expect(RESPAWN_VITALS.hunger).toBeLessThan(100);
    expect(RESPAWN_VITALS.thirst).toBeLessThan(100);
  });
});
