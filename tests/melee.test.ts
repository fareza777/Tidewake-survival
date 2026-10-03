import { describe, expect, it } from 'vitest';
import { ITEMS } from '@/data/items';
import { STAMINA_HAND, STAMINA_TOOL, TIER_DAMAGE } from '@/data/tools';
import { meleeFor } from '@/sim/melee';

describe('meleeFor', () => {
  it('uses the weapon itself for swords and spears, and wears it down', () => {
    for (const id of ['sword_wood', 'sword_stone', 'sword_iron', 'spear_bone'] as const) {
      const w = ITEMS[id].weapon!;
      expect(meleeFor(id)).toEqual({
        damage: w.damage, reach: w.reach, arc: w.arc, knockback: w.knockback, stamina: w.stamina, cooldown: w.cooldown, wear: true,
      });
    }
  });

  it('lets a tool be swung as a club at its tier damage, without wearing it', () => {
    expect(meleeFor('axe_stone')).toMatchObject({ damage: TIER_DAMAGE[2], stamina: STAMINA_TOOL, wear: false });
    expect(meleeFor('pickaxe_iron')).toMatchObject({ damage: TIER_DAMAGE[3], wear: false });
    expect(meleeFor('axe_wood').damage).toBeLessThan(ITEMS.sword_wood.weapon!.damage);
  });

  it('falls back to fists for empty hands, food, and the bow', () => {
    for (const held of [null, 'carrot', 'bow', 'wood'] as const) {
      expect(meleeFor(held)).toMatchObject({ damage: 1, stamina: STAMINA_HAND, wear: false });
    }
    expect(meleeFor(null).reach).toBeLessThan(ITEMS.sword_wood.weapon!.reach);
  });
});
