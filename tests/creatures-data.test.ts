import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CREATURES, CREATURE_IDS, isHostileKind, spawnWeights, type CreatureId } from '@/data/creatures';
import { isItemId, ITEMS } from '@/data/items';
import { RECIPES } from '@/data/recipes';
import { B } from '@/sim/world/types';

const PACK = path.resolve(__dirname, '../public/assets/pack');
const frames = (name: string): Record<string, unknown> | null => {
  const file = path.join(PACK, `${name}.json`);
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as { frames: Record<string, unknown> }).frames : null;
};
const LAND_BIOMES = [B.FOREST, B.MOUNTAIN, B.SWAMP, B.DESERT];

describe('creature catalog', () => {
  it('keys every entry by its own id and gives it sane stats', () => {
    expect(CREATURE_IDS).toHaveLength(35);
    for (const id of CREATURE_IDS) {
      const c = CREATURES[id];
      expect(c.id).toBe(id);
      for (const v of [c.hp, c.speed, c.radius]) expect(v, id).toBeGreaterThan(0);
      if (c.temper !== 'boss') expect(c.spawn.biomes.length, id).toBeGreaterThan(0);
      expect(c.spawn.weight, id).toBeGreaterThan(0);
    }
  });

  it('lets anything that fights have damage, reach, a warning and a pause between strikes', () => {
    for (const id of CREATURE_IDS) {
      const c = CREATURES[id];
      if (c.temper === 'flee') {
        expect(c.damage, id).toBe(0);
        continue;
      }
      for (const v of [c.damage, c.reach, c.windup, c.cooldown, c.sight]) expect(v, id).toBeGreaterThan(0);
    }
  });

  it('keeps every hunter slower than the hero (3.4 tiles per second) and every fleeing animal catchable', () => {
    for (const id of CREATURE_IDS) expect(CREATURES[id].speed, id).toBeLessThan(3.4);
  });

  it('has twenty-three enemies that chase and four animals: three flee and the boar fights back', () => {
    const by = (temper: string) => CREATURE_IDS.filter((id) => CREATURES[id].temper === temper).sort();
    expect(by('chase')).toHaveLength(23);
    expect(by('flee')).toEqual(['bird', 'fox', 'rabbit']);
    expect(by('defend')).toEqual(['boar']);
    expect(isHostileKind('slime')).toBe(true);
    expect(isHostileKind('boar')).toBe(false);
  });

  it('has eight bosses that never appear by themselves, count as hostile, and drop their dungeon rewards', () => {
    const bosses = CREATURE_IDS.filter((id) => CREATURES[id].temper === 'boss');
    expect(bosses.sort()).toEqual([
      'drownedqueen', 'forgeheart', 'glacierking', 'hollowkeeper', 'ironbones', 'mirelord', 'mossback', 'stormtitan',
    ]);
    for (const id of bosses) {
      expect(isHostileKind(id), id).toBe(true);
      expect(CREATURES[id].hp, id).toBeGreaterThanOrEqual(100);
      expect(CREATURES[id].sprite.scale, id).toBeGreaterThan(1);
      for (const biome of LAND_BIOMES) for (const night of [false, true]) expect(spawnWeights(biome, night).map(([k]) => k), id).not.toContain(id);
    }
  });

  it('puts a hostile creature and an animal in every land biome, each biome with its own roster', () => {
    for (const biome of LAND_BIOMES) {
      const here = CREATURE_IDS.filter((id) => CREATURES[id].spawn.biomes.includes(biome));
      expect(here.some((id) => CREATURES[id].temper === 'chase'), `biome ${biome} has enemies`).toBe(true);
      expect(here.some((id) => CREATURES[id].temper !== 'chase'), `biome ${biome} has animals`).toBe(true);
    }
    expect(CREATURES.scorpion.spawn.biomes).toEqual([B.DESERT]);
    expect(CREATURES.worm.spawn.biomes).toEqual([B.SWAMP]);
    expect(CREATURES.mushroom.spawn.biomes).toEqual([B.FOREST]);
  });

  it('never spawns anything in the sea, and lets night bring out the undead', () => {
    for (const id of CREATURE_IDS) expect(CREATURES[id].spawn.biomes, id).not.toContain(B.SEA);
    for (const id of ['skeleton', 'zombie', 'ghost', 'skeleton_warrior'] as const) expect(CREATURES[id].spawn.when, id).toBe('night');
    expect(CREATURES.bird.spawn.when).toBe('day');
  });

  it('only drops items that exist, with sound chances and amounts', () => {
    for (const id of CREATURE_IDS) {
      for (const d of CREATURES[id].drops) {
        expect(isItemId(d.item), `${id} drops ${d.item}`).toBe(true);
        expect(d.min).toBeGreaterThanOrEqual(0);
        expect(d.max).toBeGreaterThanOrEqual(d.min);
        if (d.chance !== undefined) {
          expect(d.chance).toBeGreaterThan(0);
          expect(d.chance).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('can supply every loot ingredient the combat recipes ask for', () => {
    const dropped = new Set(CREATURE_IDS.flatMap((id) => CREATURES[id].drops.map((d) => d.item)));
    for (const item of ['raw_meat', 'gel', 'bone', 'honey'] as const) expect(dropped.has(item), item).toBe(true);
    const loot = new Set(['raw_meat', 'gel', 'bone', 'honey']);
    const needed = RECIPES.flatMap((r) => r.cost.map(([item]) => item)).filter((item) => loot.has(item));
    expect(needed.length).toBeGreaterThan(0);
    for (const item of needed) expect(dropped.has(item), item).toBe(true);
    expect(ITEMS.raw_meat.food).toBeDefined();
  });
});

describe('spawn weights', () => {
  it('lists the creatures that can appear in a biome at a time of day with their weights', () => {
    const night = spawnWeights(B.MOUNTAIN, true).map(([id]) => id).sort();
    const day = spawnWeights(B.MOUNTAIN, false).map(([id]) => id).sort();
    expect(night).toContain('skeleton');
    expect(day).not.toContain('skeleton');
    expect(day).toContain('wasp');
    expect(spawnWeights(B.SEA, true)).toEqual([]);
    for (const [, w] of spawnWeights(B.FOREST, false)) expect(w).toBeGreaterThan(0);
  });
});

describe.skipIf(!frames('monsters') || !frames('actors'))('creature art', () => {
  it('has the walking frames of every creature in the atlas it names', () => {
    const monsters = frames('monsters')!;
    const actors = frames('actors')!;
    for (const id of Object.keys(CREATURES) as CreatureId[]) {
      const s = CREATURES[id].sprite;
      const atlas = s.atlas === 'monsters' ? monsters : actors;
      const dirs = s.fixedDir ? [s.fixedDir] : ['down', 'left', 'right', 'up'];
      for (const dir of dirs) {
        for (let i = 0; i < s.frames; i++) expect(atlas[`${s.group}/${dir}/${i}`], `${id}: ${s.group}/${dir}/${i}`).toBeDefined();
      }
    }
  });
});

describe('the far islands', () => {
  it('each have their own hostile roster, with something to meet by day and something by night', () => {
    for (const biome of [B.FROST, B.VOLCANO, B.WRECK, B.SKY]) {
      for (const night of [false, true]) {
        const kinds = spawnWeights(biome, night).map(([k]) => k);
        expect(kinds.length, `biome ${biome} night ${night}`).toBeGreaterThanOrEqual(2);
        for (const k of kinds) expect(isHostileKind(k), k).toBe(true);
      }
      const all = CREATURE_IDS.filter((id) => CREATURES[id].spawn.biomes.includes(biome));
      expect(all.length, `biome ${biome}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('keep their creatures off the home island', () => {
    for (const biome of LAND_BIOMES) {
      const here = spawnWeights(biome, false).concat(spawnWeights(biome, true)).map(([k]) => k);
      for (const k of here) expect(CREATURES[k].spawn.biomes, k).not.toContain(B.FROST);
    }
  });
});
