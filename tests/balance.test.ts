import { describe, expect, it } from 'vitest';
import { BOSSES } from '@/data/bosses';
import { CREATURES, CREATURE_IDS } from '@/data/creatures';
import type { BossId } from '@/data/dungeons';
import { DUNGEONS } from '@/data/dungeons';
import { ITEMS, ITEM_IDS, type ItemId } from '@/data/items';
import { DAY_SECONDS } from '@/sim/daynight';
import { DIFFICULTY_DAMAGE, enemyDamage } from '@/sim/combat';
import { B } from '@/sim/world/types';
import { HUNGER_RATE, REGEN_RATE, STARVE_DAMAGE, THIRST_RATE, VITAL_MAX } from '@/sim/vitals';

/** Guard rails for the numbers that decide how the game feels. They are loose on purpose: they catch a typo, not a taste. */

const damagePerSecond = (id: ItemId): number => {
  const w = ITEMS[id].weapon!;
  return w.damage / Math.max(w.cooldown, 0.1);
};

describe('survival pace', () => {
  it('lets a hero go a good while without food, and a shorter while without water, and starving hurts but not instantly', () => {
    const hungerMinutes = VITAL_MAX / HUNGER_RATE / 60;
    const thirstMinutes = VITAL_MAX / THIRST_RATE / 60;
    expect(hungerMinutes).toBeGreaterThanOrEqual(12);
    expect(hungerMinutes).toBeLessThanOrEqual(40);
    expect(thirstMinutes).toBeGreaterThanOrEqual(8);
    expect(thirstMinutes).toBeLessThan(hungerMinutes);
    expect(VITAL_MAX / STARVE_DAMAGE / 60).toBeGreaterThanOrEqual(1.5);
    expect(REGEN_RATE).toBeLessThan(1);
    expect(DAY_SECONDS).toBe(600);
  });

  it('makes a bandage, a salve and a potion each worth carrying: stronger ones heal more', () => {
    const hp = (id: ItemId) => ITEMS[id].food!.hp;
    expect(hp('bandage')).toBeLessThan(hp('healing_potion'));
    expect(hp('salve')).toBeLessThan(hp('healing_potion'));
    expect(hp('healing_potion')).toBeLessThan(hp('great_healing_potion'));
    expect(hp('great_healing_potion')).toBeLessThanOrEqual(100);
    expect(ITEMS.cooked_meat.food!.hunger).toBeGreaterThan(ITEMS.raw_meat.food!.hunger);
  });
});

describe('weapons', () => {
  it('get better with every step up in their own family', () => {
    expect(damagePerSecond('sword_wood')).toBeLessThan(damagePerSecond('sword_stone'));
    expect(damagePerSecond('sword_stone')).toBeLessThan(damagePerSecond('sword_iron'));
    expect(damagePerSecond('sword_iron')).toBeLessThan(damagePerSecond('sword_crystal'));
    expect(damagePerSecond('spear_wood')).toBeLessThan(damagePerSecond('spear_bone'));
    expect(damagePerSecond('spear_bone')).toBeLessThan(damagePerSecond('spear_iron'));
    expect(ITEMS.bow.weapon!.damage).toBeLessThan(ITEMS.bow_long.weapon!.damage);
  });

  it('wear out slowly enough to be worth making and fast enough to matter', () => {
    for (const id of ITEM_IDS.filter((i) => ITEMS[i].weapon)) {
      const d = ITEMS[id].tool!.durability;
      expect(d, id).toBeGreaterThanOrEqual(40);
      expect(d, id).toBeLessThanOrEqual(400);
    }
  });
});

describe('bosses', () => {
  const bosses = Object.keys(BOSSES) as BossId[];
  /** The best weapon a hero has when he reaches each boss, in the order the story leads him there. */
  const BEST: Record<BossId, ItemId> = { mossback: 'sword_stone', ironbones: 'sword_iron', mirelord: 'sword_iron', hollowkeeper: 'sword_iron',
    glacierking: 'sword_steel', forgeheart: 'sword_steel', drownedqueen: 'sword_mithril', stormtitan: 'sword_mithril',
  };
  const ARMOUR: Record<BossId, number> = { mossback: 0, ironbones: 3, mirelord: 5, hollowkeeper: 7, glacierking: 17, forgeheart: 18, drownedqueen: 22, stormtitan: 24 };

  it('fall to continuous blows in half a minute at most and no faster than a few seconds, even before dodging is counted', () => {
    for (const id of bosses) {
      const seconds = CREATURES[id].hp / damagePerSecond(BEST[id]);
      expect(seconds, id).toBeGreaterThanOrEqual(5);
      expect(seconds, id).toBeLessThanOrEqual(30);
    }
  });

  it('grow tougher along the story', () => {
    const hp = (id: BossId) => CREATURES[id].hp;
    expect(hp('mossback')).toBeLessThan(hp('ironbones'));
    expect(hp('ironbones')).toBeLessThan(hp('mirelord'));
    expect(hp('mirelord')).toBeLessThan(hp('hollowkeeper'));
  });

  it('never kill a full-health hero in fewer than five blows, with the armour he has by then, on Normal', () => {
    for (const id of bosses) {
      const hits = BOSSES[id].phases.flatMap((p) => p.moves.map((m) => m.damage)).filter((d) => d > 0);
      const worst = Math.max(...hits);
      const taken = enemyDamage(worst, 'normal', ARMOUR[id]);
      expect(Math.ceil(VITAL_MAX / taken), id).toBeGreaterThanOrEqual(5);
    }
  });

  it('warn before every move, and give the second phase a faster pace', () => {
    for (const id of bosses) {
      for (const phase of BOSSES[id].phases) for (const m of phase.moves) expect(m.windup, `${id} ${m.action}`).toBeGreaterThanOrEqual(0.4);
      expect(BOSSES[id].phases[1].speed).toBeGreaterThan(BOSSES[id].phases[0].speed);
    }
  });

  it('drop an armour that is better than anything the hero can make at that point', () => {
    expect(ITEMS[DUNGEONS.ruin.armor].armor!.defense).toBeGreaterThan(ITEMS.armor_iron.armor!.defense);
    expect(ITEMS.armor_hollow.armor!.defense).toBeGreaterThanOrEqual(ITEMS.armor_crystal.armor!.defense);
  });
});

describe('difficulty', () => {
  it('makes Relaxed gentler and Hardcore harsher than Normal for hits and hunger alike', () => {
    expect(DIFFICULTY_DAMAGE.relaxed).toBeLessThan(DIFFICULTY_DAMAGE.normal);
    expect(DIFFICULTY_DAMAGE.normal).toBeLessThan(DIFFICULTY_DAMAGE.hardcore);
    expect(enemyDamage(10, 'relaxed')).toBeLessThan(enemyDamage(10, 'hardcore'));
  });
});

describe('far island creatures', () => {
  /** The armour the hero has when he sails there (a steel set, the frost plate, a mithril set, the tide plate and mithril). */
  const ARMOUR_BY_BIOME: Record<number, number> = { [B.FROST]: 14, [B.VOLCANO]: 17, [B.WRECK]: 21, [B.SKY]: 24 };

  it('hurt a hero in the armour that is meant for the island enough to matter, but never to end him in three blows', () => {
    for (const [biome, defense] of Object.entries(ARMOUR_BY_BIOME)) {
      for (const id of CREATURE_IDS) {
        const c = CREATURES[id];
        if (c.temper === 'boss' || !c.spawn.biomes.includes(Number(biome) as never)) continue;
        const taken = enemyDamage(c.damage, 'normal', defense);
        expect(taken, `${id} on biome ${biome}`).toBeGreaterThanOrEqual(6);
        expect(Math.ceil(VITAL_MAX / taken), `${id} on biome ${biome}`).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('are tougher than anything the home island has', () => {
    const home = Math.max(...CREATURE_IDS.filter((id) => CREATURES[id].temper === 'chase' && CREATURES[id].spawn.biomes.some((b) => b <= B.DESERT)).map((id) => CREATURES[id].damage));
    for (const id of ['frostslime', 'emberslime', 'drowned', 'stormghost'] as const) expect(CREATURES[id].damage, id).toBeGreaterThan(home);
  });
});
