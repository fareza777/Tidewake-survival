import { describe, expect, it } from 'vitest';
import { newSlot } from '@/core/saveData';
import { addItem } from '@/sim/inventory';
import { equipArmor, sessionFromSlot, sessionToSlot, takeOffArmor, type Session } from '@/sim/session';

const slot = () => newSlot(0, 'Ari', 1234, 'normal', { x: 50, y: 50 }, { day: 1, t: 100 }, 1000);
const base = (over: Partial<Session> = {}): Session => ({ ...sessionFromSlot(slot()), ...over });

describe('session and save slot', () => {
  it('carry the new fields both ways', () => {
    const s = base({ location: 'ruin', equipment: { armor: 'armor_bone' } });
    const out = sessionToSlot(slot(), s, { x: 3.5, y: 4.5 });
    expect(out.location).toBe('ruin');
    expect(out.equipment).toEqual({ armor: 'armor_bone' });
    expect(out.dungeons).toBe(s.dungeons);
    expect(sessionFromSlot(out)).toEqual(s);
  });
});

describe('wearing armour', () => {
  it('puts the armour in a slot on and says so', () => {
    const s = base({ inventory: addItem(base().inventory, 'armor_iron', 1).inv });
    const r = equipArmor(s, 0);
    expect(r.session.equipment).toEqual({ armor: 'armor_iron' });
    expect(r.session.inventory[0]).toBeNull();
    expect(r.fx.map((f) => f.t)).toEqual(['equipped']);
  });

  it('does nothing for a slot that holds no armour', () => {
    const s = base({ inventory: addItem(base().inventory, 'wood', 3).inv });
    const r = equipArmor(s, 0);
    expect(r.session).toBe(s);
    expect(r.fx).toEqual([]);
  });

  it('takes it off again, and tells the player when the backpack is full', () => {
    const worn = base({ equipment: { armor: 'armor_moss' } });
    const off = takeOffArmor(worn);
    expect(off.session.equipment).toEqual({ armor: null });
    expect(off.session.inventory[0]).toEqual({ item: 'armor_moss', qty: 1 });
    let full = base({ equipment: { armor: 'armor_moss' } });
    for (let i = 0; i < 32; i++) full = { ...full, inventory: addItem(full.inventory, 'wood', 99).inv };
    const refused = takeOffArmor(full);
    expect(refused.session).toBe(full);
    expect(refused.fx.map((f) => f.t === 'say' && f.key)).toEqual(['msgFull']);
  });
});
