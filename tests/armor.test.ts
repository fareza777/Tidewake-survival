import { describe, expect, it } from 'vitest';
import { ITEMS, ITEM_IDS, type ItemId } from '@/data/items';
import { RECIPES } from '@/data/recipes';
import { UI_STRINGS } from '@/data/strings';
import { defenseOf, equipFromSlot, noEquipment, parseEquipment, unequipArmor } from '@/sim/equipment';
import { addItem, emptyInventory } from '@/sim/inventory';

const ARMORS: ItemId[] = [
  'armor_bone', 'armor_iron', 'armor_moss', 'armor_ironbones', 'armor_mire', 'armor_hollow', 'armor_wood', 'armor_crystal',
  'armor_leather', 'armor_steel', 'armor_mithril', 'armor_frost', 'armor_ember', 'armor_tide', 'armor_sky',
];
const GEAR: ItemId[] = [
  'cap_leather', 'helm_iron', 'helm_steel', 'helm_crystal', 'helm_mithril', 'boots_leather', 'boots_iron', 'boots_steel', 'boots_mithril',
  'ring_might', 'ring_swift', 'amulet_vigor', 'amulet_fortune', 'amulet_warmth',
];

describe('armour items', () => {
  it('are the body pieces and the helms, boots and charms, never stack, never wear out, and name a defence', () => {
    expect(ITEM_IDS.filter((id) => ITEMS[id].armor).sort()).toEqual([...ARMORS, ...GEAR].sort());
    for (const id of GEAR) {
      expect(ITEMS[id].stack, id).toBe(1);
      expect(ITEMS[id].armor!.slot, id).toBeDefined();
      expect(UI_STRINGS[`item_${id}`], id).toBeDefined();
    }
    for (const id of ARMORS) {
      expect(ITEMS[id].stack, id).toBe(1);
      expect(ITEMS[id].tool, id).toBeUndefined();
      expect(ITEMS[id].armor!.defense, id).toBeGreaterThan(0);
      expect(UI_STRINGS[`item_${id}`], id).toBeDefined();
    }
  });

  it('give more defence the further the player gets: crafted pieces first, boss rewards after', () => {
    const d = (id: ItemId) => ITEMS[id].armor!.defense;
    expect(d('armor_bone')).toBeLessThan(d('armor_iron'));
    expect(d('armor_moss')).toBeLessThan(d('armor_ironbones'));
    expect(d('armor_ironbones')).toBeLessThan(d('armor_mire'));
    expect(d('armor_wood')).toBeLessThan(d('armor_bone'));
    expect(d('armor_iron')).toBeLessThan(d('armor_crystal'));
  });

  it('can be crafted from bones and iron at the workbench, while the boss pieces are rewards only', () => {
    const make = (out: ItemId) => RECIPES.find((r) => r.out === out);
    expect(make('armor_bone')).toMatchObject({ station: 'workbench', cost: [['bone', 8], ['rope', 2]] });
    expect(make('armor_iron')).toMatchObject({ station: 'workbench', cost: [['iron_ingot', 8], ['rope', 2]] });
    for (const id of ['armor_moss', 'armor_ironbones', 'armor_mire', 'armor_hollow'] as const) expect(make(id), id).toBeUndefined();
  });
});

describe('equipment', () => {
  it('starts with nothing worn and no defence', () => {
    expect(noEquipment()).toEqual({ armor: null, helm: null, boots: null, charm: null });
    expect(defenseOf(noEquipment())).toBe(0);
    expect(defenseOf({ ...noEquipment(), armor: 'armor_iron' })).toBe(ITEMS.armor_iron.armor!.defense);
  });

  it('wears the armour in a slot and puts what was worn back in that slot', () => {
    let inv = addItem(emptyInventory(), 'armor_bone', 1).inv;
    inv = addItem(inv, 'armor_iron', 1).inv;
    const first = equipFromSlot(inv, noEquipment(), 0)!;
    expect(first.equipment).toEqual({ ...noEquipment(), armor: 'armor_bone' });
    expect(first.inv[0]).toBeNull();
    const swapped = equipFromSlot(first.inv, first.equipment, 1)!;
    expect(swapped.equipment).toEqual({ ...noEquipment(), armor: 'armor_iron' });
    expect(swapped.inv[1]).toEqual({ item: 'armor_bone', qty: 1 });
  });

  it('refuses anything that is not armour, and an empty slot', () => {
    const inv = addItem(emptyInventory(), 'wood', 5).inv;
    expect(equipFromSlot(inv, noEquipment(), 0)).toBeNull();
    expect(equipFromSlot(inv, noEquipment(), 9)).toBeNull();
    expect(equipFromSlot(inv, noEquipment(), -1)).toBeNull();
  });

  it('takes armour off into the first free slot, or refuses when the backpack is full', () => {
    const worn = { ...noEquipment(), armor: 'armor_moss' } as const;
    const off = unequipArmor(emptyInventory(), worn)!;
    expect(off.equipment).toEqual({ armor: null, helm: null, boots: null, charm: null });
    expect(off.inv[0]).toEqual({ item: 'armor_moss', qty: 1 });
    const full = addItem(emptyInventory(1), 'wood', 99).inv;
    expect(unequipArmor(full, worn)).toBeNull();
    expect(unequipArmor(emptyInventory(), noEquipment())).toBeNull();
  });

  it('keeps only real armour from an untrusted save', () => {
    expect(parseEquipment({ armor: 'armor_mire' })).toEqual({ ...noEquipment(), armor: 'armor_mire' });
    expect(parseEquipment({ armor: 'wood' })).toEqual({ armor: null, helm: null, boots: null, charm: null });
    expect(parseEquipment({ armor: 'nonsense' })).toEqual({ armor: null, helm: null, boots: null, charm: null });
    expect(parseEquipment(null)).toEqual({ armor: null, helm: null, boots: null, charm: null });
    // Gear only goes in its own slot.
    expect(parseEquipment({ helm: 'armor_iron', boots: 'boots_iron' })).toEqual({ ...noEquipment(), boots: 'boots_iron' });
  });
});
