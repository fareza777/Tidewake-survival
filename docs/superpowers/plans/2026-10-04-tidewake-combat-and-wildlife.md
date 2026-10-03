# Tidewake Combat and Wildlife Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the island dangerous and alive: nine monsters and four animals that appear by biome and time of day, swords, a bone spear and a bow with arrows, knockback, hit-stop and damage numbers, loot that lies on the ground, raw and cooked meat, honey and bandages, sound effects, and day, night and battle music.

**Architecture:** Same split as plans 1 and 2. All rules are pure, immutable and unit-tested: a creature catalog, combat maths, a creature behaviour step, a spawner, loose-item pickups, and an `Encounters` state (creatures, items, arrows) with `tickEncounters`, `swing` and `shoot`. The action resolver learns two new actions (`attack`, `shoot`); the session applies their cost and tells the scene what to resolve. The Phaser side is thin: `HeroCombat` runs the simulation and shows what happens, `CreatureLayer` draws sprites, `MusicDirector` picks the track. `GameScene` is split (input reading, blocking tiles and combat move out) and ends under 400 lines. Sound is synthesized offline by Python code, so nothing is downloaded or paid for.

**Tech Stack:** unchanged (Phaser 3.90, TypeScript 5.9, Vite 7, Vitest 3, Capacitor 8 plugins, Python + Pillow for art, plus numpy, scipy and the ffmpeg that ships with imageio-ffmpeg for audio, Playwright + Edge for browser smoke tests).

**Spec:** `docs/superpowers/specs/2026-10-03-tidewake-design.md` (this plan implements phase 3 of section 11, plus the combat, animals and hunting parts of section 4, the enemy roster by biome, and the audio gap in section 9).

**Builds on:** tag `phase-2` of this repository (`docs/superpowers/plans/2026-10-03-tidewake-survival-systems.md`).

## Scope of this plan

Delivered: everything in the goal above; 12 new items (3 swords, a bone spear, a bow, arrows, raw and cooked meat, honey, bandage, slime gel, bone) and 8 new recipes; a creature catalog with 9 monsters (slime, mushroom, wasp, skeleton, zombie, worm, ghost, scorpion, skeleton warrior) and 4 animals (rabbit, fox, bird, boar); a spawner with per-biome rosters, day and night rosters and population caps; an item icon set for all of it (drawn in code); a `monsters` sprite atlas from the Unity pack; 16 sound effects and 3 music loops; a pause-safe, save-safe island (creatures and loose items are never saved).

Deferred on purpose:
- Armour, shields and the damage reduction they give (plan 4 adds the items; `HERO_DEFENSE` is the single place that will change).
- The lamia, bosses, dungeon monsters and monsters that shoot or cast (plan 4).
- Chickens and pigs that can be fed, followed and give eggs or milk (a later plan; the spec lists them under farming).
- Auto-attack, the settings screen and its sliders (plan 6; the sound and vibration settings that already exist are honoured).
- Mixing and mastering the audio by ear, and generated or composed final music (plan 6). The tracks here are procedural chiptune placeholders of reasonable quality.
- Balance numbers for damage, health, spawn caps and drops (plan 7).

## Global Constraints

- Phaser `^3.90.0`, TypeScript `5.9`, Vite `^7.3.6`, Vitest `^3.2.7`, Capacitor `^8.5.2` plugins; Node 22 or newer. No new npm dependencies. Python 3 with Pillow, numpy and scipy; `imageio-ffmpeg` or `ffmpeg` on the PATH for `npm run audio`.
- Android package id `com.fajar.tidewake`. Portrait; 16x16 tiles; world camera zoom `worldZoom(2)`; layout in virtual pixels (`view.w`, `view.h`).
- The save format stays **version 2**. Creatures, loose items and arrows are never saved; they are rebuilt around the hero.
- Languages: English and Bahasa Indonesia; every UI string is in `src/data/strings.ts` with matching `{placeholders}`.
- Hero hit points are 100 and a collapse works as in plan 2 (Relaxed keeps everything, Normal loses half of the hotbar, Hardcore deletes the save). Monster damage is scaled by difficulty: Relaxed x0.6, Normal x1, Hardcore x1.4; armour takes whole points off every blow and a blow always hurts at least 1.
- After a blow the hero is safe for 0.7 s (`HERO_IFRAMES`). A collapsed hero is never hit again, and waking up removes every creature.
- Monsters never spawn within 10 tiles of the shipwreck, inside the glow of a campfire, torch or furnace, or in the sea; creatures spawn 12 to 18 tiles from the hero and are removed beyond 30 tiles. Population caps: by day 4 monsters and 8 animals, at night 9 monsters and 3 animals.
- Weapons: swords 3, 5 and 8 damage (wood, stone, iron); bone spear 5 damage, reach 1.9 and a 30 degree cone; bow 4 damage, 7 tiles, one arrow per shot. Weapons wear out like tools; arrows are used up.
- Loot that does not fit in the backpack stays on the ground; nothing is ever deleted. Loose items fade after 120 s.
- `src/sim/` and `src/data/` never import Phaser; `src/sim/` functions never mutate their arguments and return new values.
- Files stay at most 400 lines (hard limit 800); functions under 50 lines.
- Coverage of `src/sim/**`, `src/data/**` and the testable `src/core/` files stays at least 80% lines (`npm run test:cov`).
- The Unity pack at `E:\Pixel Games Asset Master` is read-only. API keys from `E:\Game Dev Tools.txt` are never copied into the repo, and this plan needs none: all audio is generated locally.
- Commits use `<type>: <description>` with no attribution trailer; commit locally, never push.
- The dev server runs on port **5199** (`strictPort`); ports 5173 and 5188 belong to another project of the owner. Never stop processes you did not start.

## Review Focus

Inputs and conditions the spec implies but that are easy to miss. Each has tests or a scripted scenario in the task that owns it.

1. **A fatal blow must kill.** Hit points regenerate while fed and watered; a hero at exactly zero must not be healed back above zero before the death check runs, or monsters could never kill a well-fed hero. Tests: Task 7. Scenario: `monster-death.json` (Task 10).
2. **A full backpack with loot on the ground, and a bow with no arrows.** Loot that does not fit stays where it lies and nothing is lost; the "backpack full" notice is rate-limited; shooting without arrows says so instead of doing nothing. Tests: Tasks 5, 6 and 7.
3. **Creatures in the wrong places:** walking into deep water or solid tiles, stacking on each other, spawning on the beach start, on water, in the glow of a campfire or beyond the caps, getting stuck behind a single tree while hunting, and arrows that skip over small targets or fly through walls. Tests: Tasks 4, 5 and 6. Scenario: `spawn.json`.
4. **Dying in a crowd.** The collapse dialog opens once, no further blows land while it is open, waking up clears the creatures, and the hero does not wake up blinking or tinted. Tests: Tasks 6 and 7. Scenario: `monster-death.json`.
5. **What ACTION does when something is in reach.** A structure or ripe crop in front still wins; food and building items keep their own use; a sword by a tree or a river does not swing at nothing (it chops by hand or drinks); bare hands and tools fight back; too little stamina says so. Tests: Task 7.

---

## File Structure

```
src/data/    items, recipes, strings (changed); creatures (new)
src/sim/     combat, creatures, spawner, pickups, encounters, melee, cues (new)
             actions, session, vitals, movement, daynight, solids (changed)
src/game/    InputReader, HeroCombat, Wildlife, MusicDirector (new)
src/gfx/     CreatureLayer, FloatText (new); animations (changed)
src/entities/Player.ts, src/scenes/{GameScene, PreloadScene, BootScene, MenuScene, InventoryScene} (changed)
tools/       icon_kit, make_combat_icons, audio_kit, gen_sfx, gen_music, gen_audio (new); make_icons, pack_assets (changed);
             scripts/{fight, hunt, monster-death, spawn, audio, perf-fight, zoo}.json (new smoke scenarios)
public/assets/pack/{monsters,icons}.{png,json}   generated, committed
public/assets/audio/   sfx.ogg + sfx.json (audio sprite), music_{day,night,battle}.ogg   generated, committed
tests/       one file per module group (see tasks)
```

## Pre-flight

Run once. Expected: after committing this plan file the working tree is clean, the tag exists, 251 tests pass, and port 5199 is free.

```bash
cd "E:/RPG Survival Sprite Sonnet 55"
git add docs && git commit -m "docs: add plan 3 for combat and wildlife"
git status --short && git tag --list phase-2
npm test 2>&1 | tail -4
curl -s -o /dev/null -w "port 5199 answers: %{http_code}\n" http://localhost:5199/ || echo "port 5199 is free"
python -c "import numpy, scipy, PIL, imageio_ffmpeg; print('python audio tools ok')"
```

---

### Task 1: Weapons, loot items, recipes and icons

**Files:**
- Replace: `src/data/items.ts`, `src/data/recipes.ts`, `src/data/strings.ts`, `tools/make_icons.py`
- Create: `tools/icon_kit.py`, `tools/make_combat_icons.py`
- Modify: `src/scenes/InventoryScene.ts` (one block)
- Generated: `public/assets/pack/icons.png`, `public/assets/pack/icons.json`
- Test: `tests/weapons.test.ts` (new)

**Interfaces:**
- Produces: `ItemId` grows by `sword_wood`, `sword_stone`, `sword_iron`, `spear_bone`, `bow`, `arrow`, `raw_meat`, `cooked_meat`, `honey`, `bandage`, `gel`, `bone`; `ToolType` grows by `'sword' | 'spear' | 'bow'`; `WeaponStats {kind: 'melee' | 'bow', damage, reach, arc, cooldown, stamina, knockback}`; `ItemDef.weapon?: WeaponStats` (weapons also keep a `tool` entry so they wear out like tools); 8 more `RECIPES`; strings `msgNoArrows` and `weaponDamage`.

- [ ] **Step 1: Write the failing test**

`tests/weapons.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { ITEMS, ITEM_IDS, type ItemId } from '@/data/items';
import { RECIPES } from '@/data/recipes';
import { UI_STRINGS } from '@/data/strings';
import { eat, fullVitals, wouldWaste } from '@/sim/vitals';

const weapons = ITEM_IDS.filter((id) => ITEMS[id].weapon);
const recipe = (out: ItemId) => RECIPES.find((r) => r.out === out)!;

describe('weapons', () => {
  it('are the three swords, the bone spear and the bow', () => {
    expect(weapons).toEqual(['sword_wood', 'sword_stone', 'sword_iron', 'spear_bone', 'bow']);
  });

  it('never stack, wear out, and have positive stats', () => {
    for (const id of weapons) {
      const def = ITEMS[id];
      const w = def.weapon!;
      expect(def.stack, id).toBe(1);
      expect(def.tool?.durability, id).toBeGreaterThan(0);
      for (const v of [w.damage, w.reach, w.cooldown, w.stamina]) expect(v, id).toBeGreaterThan(0);
      expect(w.knockback, id).toBeGreaterThanOrEqual(0);
    }
  });

  it('hit harder with every sword tier, and keep tiers matching the name', () => {
    const dmg = (id: ItemId) => ITEMS[id].weapon!.damage;
    expect(dmg('sword_wood')).toBeLessThan(dmg('sword_stone'));
    expect(dmg('sword_stone')).toBeLessThan(dmg('sword_iron'));
    expect([1, 2, 3]).toEqual(['sword_wood', 'sword_stone', 'sword_iron'].map((id) => ITEMS[id as ItemId].tool!.tier));
  });

  it('give melee weapons an arc and the bow none, and let the spear reach furthest of the melee set', () => {
    for (const id of weapons) {
      const w = ITEMS[id].weapon!;
      if (w.kind === 'melee') expect(w.arc, id).toBeGreaterThan(0);
      else expect(w.arc, id).toBe(0);
    }
    expect(ITEMS.spear_bone.weapon!.reach).toBeGreaterThan(ITEMS.sword_iron.weapon!.reach);
    expect(ITEMS.spear_bone.weapon!.arc).toBeLessThan(ITEMS.sword_iron.weapon!.arc);
    expect(ITEMS.bow.weapon!.kind).toBe('bow');
  });
});

describe('meat and healing items', () => {
  it('makes cooked meat much better than raw meat, and honey and bandages heal', () => {
    expect(ITEMS.cooked_meat.food!.hunger).toBeGreaterThan(ITEMS.raw_meat.food!.hunger * 3);
    expect(ITEMS.honey.food!.hp).toBeGreaterThan(0);
    expect(ITEMS.bandage.food).toEqual({ hunger: 0, thirst: 0, hp: 30 });
  });

  it('lets a bandage heal a hurt hero but is wasted at full health', () => {
    const hurt = { ...fullVitals(), hp: 40 };
    expect(wouldWaste(hurt, ITEMS.bandage.food!)).toBe(false);
    expect(eat(hurt, ITEMS.bandage.food!).hp).toBe(70);
    expect(wouldWaste(fullVitals(), ITEMS.bandage.food!)).toBe(true);
  });

  it('stacks the loot and arrows', () => {
    for (const id of ['arrow', 'raw_meat', 'cooked_meat', 'honey', 'bandage', 'gel', 'bone'] as const) {
      expect(ITEMS[id].stack, id).toBeGreaterThan(1);
    }
  });
});

describe('combat recipes', () => {
  it('lets a castaway make a wooden sword by hand but needs a workbench for the rest', () => {
    expect(recipe('sword_wood').station).toBe('hand');
    for (const id of ['sword_stone', 'sword_iron', 'spear_bone', 'bow', 'arrow'] as const) expect(recipe(id).station, id).toBe('workbench');
  });

  it('cooks meat at a campfire and makes bandages by hand', () => {
    expect(recipe('cooked_meat')).toMatchObject({ station: 'campfire', qty: 1, cost: [['raw_meat', 1]] });
    expect(recipe('bandage')).toMatchObject({ station: 'hand', cost: [['fiber', 2], ['gel', 1]] });
  });

  it('gives four arrows per batch', () => {
    expect(recipe('arrow').qty).toBe(4);
  });
});

describe('names', () => {
  it('has English and Indonesian names for every weapon, loot item and the combat messages', () => {
    for (const id of ['sword_wood', 'sword_stone', 'sword_iron', 'spear_bone', 'bow', 'arrow', 'raw_meat', 'cooked_meat', 'honey', 'bandage', 'gel', 'bone']) {
      expect(UI_STRINGS[`item_${id}`], id).toBeDefined();
    }
    for (const key of ['msgNoArrows', 'weaponDamage']) expect(UI_STRINGS[key], key).toBeDefined();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/weapons.test.ts`
Expected: FAIL, 10 of 11 tests fail (the one that passes only loops over the weapon list, which is still empty).

- [ ] **Step 3: Replace the item catalog, the recipes and the strings**

Weapons reuse the tool machinery (`tool` gives durability and tier), so wear, the hotbar durability bar and crafting need no changes:

`src/data/items.ts`:

```typescript
import type { CropId } from './crops';
import type { StructureId } from './structures';

export type ItemId =
  | 'wood' | 'stone' | 'fiber' | 'plank' | 'rope' | 'iron_ore' | 'iron_ingot' | 'crystal'
  | 'coconut' | 'berries' | 'carrot' | 'turnip' | 'pumpkin' | 'corn' | 'roasted_carrot' | 'roasted_corn' | 'baked_pumpkin'
  | 'carrot_seed' | 'turnip_seed' | 'pumpkin_seed' | 'corn_seed'
  | 'axe_wood' | 'axe_stone' | 'axe_iron' | 'pickaxe_wood' | 'pickaxe_stone' | 'pickaxe_iron' | 'hoe' | 'watering_can'
  | 'campfire' | 'workbench' | 'furnace' | 'bed' | 'chest' | 'torch' | 'fence'
  | 'sword_wood' | 'sword_stone' | 'sword_iron' | 'spear_bone' | 'bow' | 'arrow'
  | 'raw_meat' | 'cooked_meat' | 'honey' | 'bandage' | 'gel' | 'bone';

export type ToolType = 'axe' | 'pickaxe' | 'hoe' | 'can' | 'sword' | 'spear' | 'bow';

/** How a weapon behaves. Melee weapons sweep an arc in front of the hero; the bow shoots an arrow that flies `reach` tiles. */
export interface WeaponStats {
  kind: 'melee' | 'bow';
  damage: number;
  reach: number;
  /** Full width of the swing in degrees (0 for the bow). */
  arc: number;
  /** Seconds before the weapon can be used again. */
  cooldown: number;
  stamina: number;
  /** Tiles a hit pushes the target away. */
  knockback: number;
}

/** A sprite: a frame in the `props` atlas (pack art) or in the generated `icons` atlas. */
export interface IconRef {
  atlas: 'props' | 'icons';
  frame: string;
}

export interface ItemDef {
  id: ItemId;
  /** Maximum stack size; tools are 1. */
  stack: number;
  icon: IconRef;
  /** Tools wear out: `durability` uses. A watering can instead holds `durability` charges of water. */
  tool?: { type: ToolType; tier: 1 | 2 | 3; durability: number };
  weapon?: WeaponStats;
  food?: { hunger: number; thirst: number; hp: number };
  place?: StructureId;
  seed?: CropId;
}

const icons = (frame: string): IconRef => ({ atlas: 'icons', frame });
const pack = (frame: string): IconRef => ({ atlas: 'props', frame });

const material = (id: ItemId, frame: string): ItemDef => ({ id, stack: 99, icon: icons(frame) });
const food = (id: ItemId, icon: IconRef, hunger: number, thirst: number, hp: number): ItemDef => ({
  id, stack: 20, icon, food: { hunger, thirst, hp },
});
const seed = (id: ItemId, crop: CropId): ItemDef => ({ id, stack: 50, icon: icons(id), seed: crop });
const tool = (id: ItemId, type: ToolType, tier: 1 | 2 | 3, durability: number): ItemDef => ({
  id, stack: 1, icon: icons(id), tool: { type, tier, durability },
});
const weapon = (id: ItemId, type: 'sword' | 'spear' | 'bow', tier: 1 | 2 | 3, durability: number, stats: WeaponStats): ItemDef => ({
  ...tool(id, type, tier, durability), weapon: stats,
});
const sword = (damage: number): WeaponStats => ({ kind: 'melee', damage, reach: 1.3, arc: 110, cooldown: 0.42, stamina: 3, knockback: 0.35 });
const placeable = (id: ItemId, place: StructureId, stack = 10): ItemDef => ({ id, stack, icon: icons(`struct_${id}`), place });

export const ITEMS: Record<ItemId, ItemDef> = {
  wood: material('wood', 'wood'),
  stone: material('stone', 'stone'),
  fiber: material('fiber', 'fiber'),
  plank: material('plank', 'plank'),
  rope: material('rope', 'rope'),
  iron_ore: material('iron_ore', 'iron_ore'),
  iron_ingot: material('iron_ingot', 'iron_ingot'),
  crystal: material('crystal', 'crystal'),

  coconut: food('coconut', icons('coconut'), 8, 22, 0),
  berries: food('berries', pack('farmicon1/1'), 8, 3, 0),
  carrot: food('carrot', pack('farmicon1/4'), 10, 2, 0),
  turnip: food('turnip', pack('farmicon1/9'), 9, 2, 0),
  pumpkin: food('pumpkin', pack('farmicon1/50'), 14, 3, 0),
  corn: food('corn', pack('farmicon1/58'), 14, 0, 0),
  roasted_carrot: food('roasted_carrot', icons('roasted_carrot'), 22, 2, 3),
  roasted_corn: food('roasted_corn', icons('roasted_corn'), 28, 0, 4),
  baked_pumpkin: food('baked_pumpkin', icons('baked_pumpkin'), 40, 4, 6),

  carrot_seed: seed('carrot_seed', 'carrot'),
  turnip_seed: seed('turnip_seed', 'turnip'),
  pumpkin_seed: seed('pumpkin_seed', 'pumpkin'),
  corn_seed: seed('corn_seed', 'corn'),

  axe_wood: tool('axe_wood', 'axe', 1, 40),
  axe_stone: tool('axe_stone', 'axe', 2, 80),
  axe_iron: tool('axe_iron', 'axe', 3, 160),
  pickaxe_wood: tool('pickaxe_wood', 'pickaxe', 1, 40),
  pickaxe_stone: tool('pickaxe_stone', 'pickaxe', 2, 80),
  pickaxe_iron: tool('pickaxe_iron', 'pickaxe', 3, 160),
  hoe: tool('hoe', 'hoe', 1, 60),
  watering_can: tool('watering_can', 'can', 1, 40),

  sword_wood: weapon('sword_wood', 'sword', 1, 40, sword(3)),
  sword_stone: weapon('sword_stone', 'sword', 2, 80, sword(5)),
  sword_iron: weapon('sword_iron', 'sword', 3, 160, sword(8)),
  spear_bone: weapon('spear_bone', 'spear', 2, 70, { kind: 'melee', damage: 5, reach: 1.9, arc: 30, cooldown: 0.6, stamina: 4, knockback: 0.5 }),
  bow: weapon('bow', 'bow', 1, 80, { kind: 'bow', damage: 4, reach: 7, arc: 0, cooldown: 0.7, stamina: 3, knockback: 0.25 }),
  arrow: { id: 'arrow', stack: 50, icon: icons('arrow') },

  raw_meat: food('raw_meat', icons('raw_meat'), 8, 0, 0),
  cooked_meat: food('cooked_meat', icons('cooked_meat'), 35, 0, 4),
  honey: food('honey', icons('honey'), 12, 0, 6),
  bandage: food('bandage', icons('bandage'), 0, 0, 30),
  gel: material('gel', 'gel'),
  bone: material('bone', 'bone'),

  campfire: placeable('campfire', 'campfire'),
  workbench: placeable('workbench', 'workbench'),
  furnace: placeable('furnace', 'furnace'),
  bed: placeable('bed', 'bed'),
  chest: placeable('chest', 'chest'),
  torch: placeable('torch', 'torch', 20),
  fence: placeable('fence', 'fence', 50),
};

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];

export const isItemId = (v: unknown): v is ItemId => typeof v === 'string' && Object.prototype.hasOwnProperty.call(ITEMS, v);
```

Eight new recipes: a wooden sword and bandages by hand, stone and iron swords, the bone spear, the bow and arrows at the workbench, cooked meat at the campfire:

`src/data/recipes.ts`:

```typescript
import type { ItemId } from './items';
import type { Station } from './structures';
import type { Cost } from '@/sim/inventory';

export interface Recipe {
  id: string;
  out: ItemId;
  qty: number;
  cost: Cost;
  station: Station;
}

const r = (out: ItemId, qty: number, cost: Cost, station: Station = 'hand'): Recipe => ({ id: out, out, qty, cost, station });

/** The first crafting set. Later plans add armour, weapons, glass, potions and more. */
export const RECIPES: readonly Recipe[] = [
  // By hand
  r('plank', 2, [['wood', 2]]),
  r('rope', 1, [['fiber', 3]]),
  r('axe_wood', 1, [['wood', 3], ['fiber', 2]]),
  r('pickaxe_wood', 1, [['wood', 3], ['fiber', 2]]),
  r('torch', 2, [['wood', 1], ['fiber', 1]]),
  r('campfire', 1, [['wood', 5], ['stone', 3]]),
  r('workbench', 1, [['plank', 6], ['rope', 2]]),
  r('sword_wood', 1, [['wood', 3], ['fiber', 2]]),
  r('bandage', 1, [['fiber', 2], ['gel', 1]]),
  // Workbench
  r('axe_stone', 1, [['plank', 2], ['stone', 3], ['rope', 1]], 'workbench'),
  r('pickaxe_stone', 1, [['plank', 2], ['stone', 3], ['rope', 1]], 'workbench'),
  r('hoe', 1, [['plank', 3], ['rope', 1]], 'workbench'),
  r('watering_can', 1, [['plank', 5], ['rope', 1]], 'workbench'),
  r('furnace', 1, [['stone', 12], ['plank', 4]], 'workbench'),
  r('bed', 1, [['plank', 6], ['fiber', 4]], 'workbench'),
  r('chest', 1, [['plank', 8]], 'workbench'),
  r('fence', 2, [['plank', 2]], 'workbench'),
  r('axe_iron', 1, [['plank', 2], ['iron_ingot', 3], ['rope', 1]], 'workbench'),
  r('pickaxe_iron', 1, [['plank', 2], ['iron_ingot', 3], ['rope', 1]], 'workbench'),
  r('sword_stone', 1, [['plank', 1], ['stone', 3], ['rope', 1]], 'workbench'),
  r('sword_iron', 1, [['plank', 1], ['iron_ingot', 3], ['rope', 1]], 'workbench'),
  r('spear_bone', 1, [['plank', 1], ['bone', 2], ['rope', 1]], 'workbench'),
  r('bow', 1, [['plank', 3], ['rope', 2]], 'workbench'),
  r('arrow', 4, [['wood', 1], ['stone', 1], ['fiber', 1]], 'workbench'),
  // Furnace
  r('iron_ingot', 1, [['iron_ore', 2], ['wood', 1]], 'furnace'),
  // Campfire
  r('roasted_carrot', 1, [['carrot', 1]], 'campfire'),
  r('roasted_corn', 1, [['corn', 1]], 'campfire'),
  r('baked_pumpkin', 1, [['pumpkin', 1]], 'campfire'),
  r('cooked_meat', 1, [['raw_meat', 1]], 'campfire'),
];
```

All new text in both languages:

`src/data/strings.ts`:

```typescript
import type { L10n } from '@/core/i18n';

/** UI strings by key. Every entry needs both languages; tests/i18n.test.ts enforces parity and matching {placeholders}. */
export const UI_STRINGS: Record<string, L10n> = {
  gameTitle: { en: 'Tidewake', id: 'Tidewake' },
  subtitle: { en: 'Island Survival', id: 'Bertahan di Pulau' },
  loading: { en: 'Loading...', id: 'Memuat...' },
  menuContinue: { en: 'Continue', id: 'Lanjutkan' },
  menuNewGame: { en: 'New Game', id: 'Game Baru' },
  menuShare: { en: 'Share', id: 'Bagikan' },
  menuRate: { en: 'Rate', id: 'Beri Nilai' },
  version: { en: 'v{v}', id: 'v{v}' },
  newGameConfirm: {
    en: 'All save slots are full. A new game replaces the oldest save ({name}, Day {day}). Continue?',
    id: 'Semua slot penuh. Game baru akan menimpa simpanan terlama ({name}, Hari {day}). Lanjutkan?',
  },
  cancel: { en: 'Cancel', id: 'Batal' },
  confirm: { en: 'Confirm', id: 'Konfirmasi' },
  yes: { en: 'Yes', id: 'Ya' },
  no: { en: 'No', id: 'Tidak' },
  ok: { en: 'OK', id: 'OK' },
  close: { en: 'Close', id: 'Tutup' },
  later: { en: 'Later', id: 'Nanti' },
  shareText: {
    en: 'I am surviving a mysterious island in Tidewake. Come join me!',
    id: 'Aku sedang bertahan hidup di pulau misterius dalam Tidewake. Ayo ikut main!',
  },
  rateTitle: { en: 'Enjoying Tidewake?', id: 'Suka dengan Tidewake?' },
  rateBody: {
    en: 'A rating on Google Play helps a lot. It only takes a moment.',
    id: 'Penilaian di Google Play sangat membantu. Hanya sebentar.',
  },
  rateNow: { en: 'Rate now', id: 'Nilai sekarang' },
  quitConfirm: { en: 'Quit the game?', id: 'Keluar dari game?' },
  hudDay: { en: 'Day {n}', id: 'Hari {n}' },
  useAction: { en: 'USE', id: 'PAKAI' },
  saved: { en: 'Game saved', id: 'Game tersimpan' },
  paused: { en: 'Paused', id: 'Jeda' },
  resume: { en: 'Resume', id: 'Lanjut' },
  saveQuit: { en: 'Save & Quit', id: 'Simpan & Keluar' },
  item_wood: { en: 'Wood', id: 'Kayu' },
  item_stone: { en: 'Stone', id: 'Batu' },
  item_coconut: { en: 'Coconut', id: 'Kelapa' },
  item_berries: { en: 'Berries', id: 'Beri' },
  item_fiber: { en: 'Fiber', id: 'Serat' },
  item_iron_ore: { en: 'Iron ore', id: 'Bijih besi' },
  item_crystal: { en: 'Crystal', id: 'Kristal' },
  item_plank: { en: 'Plank', id: 'Papan' },
  item_rope: { en: 'Rope', id: 'Tali' },
  item_iron_ingot: { en: 'Iron ingot', id: 'Besi batang' },
  item_carrot: { en: 'Carrot', id: 'Wortel' },
  item_turnip: { en: 'Turnip', id: 'Lobak' },
  item_pumpkin: { en: 'Pumpkin', id: 'Labu' },
  item_corn: { en: 'Corn', id: 'Jagung' },
  item_roasted_carrot: { en: 'Roasted carrot', id: 'Wortel panggang' },
  item_roasted_corn: { en: 'Roasted corn', id: 'Jagung bakar' },
  item_baked_pumpkin: { en: 'Baked pumpkin', id: 'Labu panggang' },
  item_carrot_seed: { en: 'Carrot seeds', id: 'Bibit wortel' },
  item_turnip_seed: { en: 'Turnip seeds', id: 'Bibit lobak' },
  item_pumpkin_seed: { en: 'Pumpkin seeds', id: 'Bibit labu' },
  item_corn_seed: { en: 'Corn seeds', id: 'Bibit jagung' },
  item_axe_wood: { en: 'Wooden axe', id: 'Kapak kayu' },
  item_axe_stone: { en: 'Stone axe', id: 'Kapak batu' },
  item_axe_iron: { en: 'Iron axe', id: 'Kapak besi' },
  item_pickaxe_wood: { en: 'Wooden pickaxe', id: 'Beliung kayu' },
  item_pickaxe_stone: { en: 'Stone pickaxe', id: 'Beliung batu' },
  item_pickaxe_iron: { en: 'Iron pickaxe', id: 'Beliung besi' },
  item_hoe: { en: 'Hoe', id: 'Cangkul' },
  item_watering_can: { en: 'Watering can', id: 'Penyiram' },
  item_campfire: { en: 'Campfire', id: 'Api unggun' },
  item_workbench: { en: 'Workbench', id: 'Meja kerja' },
  item_furnace: { en: 'Furnace', id: 'Tungku' },
  item_bed: { en: 'Bed', id: 'Tempat tidur' },
  item_chest: { en: 'Chest', id: 'Peti' },
  item_torch: { en: 'Torch', id: 'Obor' },
  item_fence: { en: 'Fence', id: 'Pagar' },
  item_sword_wood: { en: 'Wooden sword', id: 'Pedang kayu' },
  item_sword_stone: { en: 'Stone sword', id: 'Pedang batu' },
  item_sword_iron: { en: 'Iron sword', id: 'Pedang besi' },
  item_spear_bone: { en: 'Bone spear', id: 'Tombak tulang' },
  item_bow: { en: 'Bow', id: 'Busur' },
  item_arrow: { en: 'Arrow', id: 'Anak panah' },
  item_raw_meat: { en: 'Raw meat', id: 'Daging mentah' },
  item_cooked_meat: { en: 'Cooked meat', id: 'Daging matang' },
  item_honey: { en: 'Honey', id: 'Madu' },
  item_bandage: { en: 'Bandage', id: 'Perban' },
  item_gel: { en: 'Slime gel', id: 'Lendir slime' },
  item_bone: { en: 'Bone', id: 'Tulang' },
  tool_axe: { en: 'axe', id: 'kapak' },
  tool_pickaxe: { en: 'pickaxe', id: 'beliung' },
  tool_hoe: { en: 'hoe', id: 'cangkul' },
  tool_can: { en: 'watering can', id: 'penyiram' },
  msgNeedsTool: { en: 'You need a better {tool} (tier {tier})', id: 'Butuh {tool} yang lebih baik (tingkat {tier})' },
  msgTired: { en: 'Too tired. Rest a moment', id: 'Terlalu lelah. Istirahat sebentar' },
  msgSaltWater: { en: 'Salt water. Find a river to drink', id: 'Air asin. Cari sungai untuk minum' },
  msgCanEmpty: { en: 'The watering can is empty. Fill it at a river', id: 'Penyiram kosong. Isi di sungai' },
  msgToolBroke: { en: 'Your {item} broke', id: '{item} kamu rusak' },
  msgChestNotEmpty: { en: 'Empty the chest first', id: 'Kosongkan peti dulu' },
  msgNoArrows: { en: 'No arrows. Craft some at a workbench', id: 'Tidak ada anak panah. Buat di meja kerja' },
  msgFull: { en: 'Backpack full', id: 'Ransel penuh' },
  msgDrank: { en: 'You drink the cool water', id: 'Kamu minum air sejuk' },
  msgFilled: { en: 'Watering can filled', id: 'Penyiram terisi' },
  msgSleepDay: { en: 'Respawn point set. You can sleep once night falls', id: 'Titik bangun diatur. Kamu bisa tidur saat malam' },
  msgSleepNight: { en: 'You sleep until dawn', id: 'Kamu tidur sampai pagi' },
  msgPlace_bounds: { en: 'Cannot build at the edge of the world', id: 'Tidak bisa membangun di tepi dunia' },
  msgPlace_water: { en: 'Cannot build on water', id: 'Tidak bisa membangun di atas air' },
  msgPlace_occupied: { en: 'Something is already there', id: 'Sudah ada sesuatu di sana' },
  msgPlace_far: { en: 'Too far away', id: 'Terlalu jauh' },
  msgPlace_hero: { en: 'Step aside first', id: 'Geser dulu' },
  invTitle: { en: 'Backpack', id: 'Ransel' },
  craftTitle: { en: 'Crafting', id: 'Membuat' },
  chestTitle: { en: 'Chest', id: 'Peti' },
  craftBtn: { en: 'Craft', id: 'Buat' },
  craftNeeds: { en: 'Needs', id: 'Butuh' },
  craftAt: { en: 'At: {station}', id: 'Di: {station}' },
  station_hand: { en: 'by hand', id: 'dengan tangan' },
  station_campfire: { en: 'campfire', id: 'api unggun' },
  station_workbench: { en: 'workbench', id: 'meja kerja' },
  station_furnace: { en: 'furnace', id: 'tungku' },
  deathTitle: { en: 'You collapsed', id: 'Kamu pingsan' },
  deathRelaxed: { en: 'You wake at your camp with everything you carried.', id: 'Kamu terbangun di kemah dengan semua barangmu.' },
  deathNormal: { en: 'You wake at your camp, but half of your hotbar is lost.', id: 'Kamu terbangun di kemah, tapi separuh hotbar hilang.' },
  deathHardcore: { en: 'Your adventure ends here.', id: 'Petualanganmu berakhir di sini.' },
  deathContinue: { en: 'Wake up', id: 'Bangun' },
  deathOver: { en: 'Main menu', id: 'Menu utama' },
  hotbarEmpty: { en: 'Empty hands', id: 'Tangan kosong' },
  tabBag: { en: 'Bag', id: 'Ransel' },
  tabCraft: { en: 'Craft', id: 'Buat' },
  craftPage: { en: 'Page {n}/{m}', id: 'Halaman {n}/{m}' },
  craftNothing: { en: 'Nothing to craft here', id: 'Tidak ada yang bisa dibuat di sini' },
  chestHint: { en: 'Tap an item to move it', id: 'Ketuk barang untuk memindahkannya' },
  durability: { en: 'Durability {n}', id: 'Ketahanan {n}' },
  weaponDamage: { en: 'Damage {n}', id: 'Serangan {n}' },
  waterLeft: { en: 'Water {n}', id: 'Air {n}' },
};
```

- [ ] **Step 4: Show a weapon's damage in the backpack**

In `src/scenes/InventoryScene.ts`, find the block that prints the durability line:

```ts
    if (def.tool && slot.dur !== undefined) {
      this.ui.add(label(this, this.gridX(), infoY + 18, t(def.tool.type === 'can' ? 'waterLeft' : 'durability', { n: slot.dur }), FONT.small, COLORS.textDim));
    }
```

and add this directly after its closing brace:

```ts
    if (def.weapon) {
      this.ui.add(label(this, this.gridX(), infoY + 30, t('weaponDamage', { n: def.weapon.damage }), FONT.small, COLORS.textDim));
    }
```

- [ ] **Step 5: Draw the icons**

The shared drawing kit (palette, canvas, outline, handle) moves out of `make_icons.py` into `icon_kit.py` so the new weapon and loot icons can use it. `make_icons.py` shrinks and merges the new icons; its output for the old 35 icons is pixel-identical.

`tools/icon_kit.py`:

```python
"""Palette and drawing helpers shared by the icon scripts (make_icons.py and make_combat_icons.py)."""
from PIL import Image, ImageDraw

S = 16

OUT = (44, 32, 38, 255)  # outline
WOOD = (150, 98, 52, 255)
WOOD_L = (200, 146, 84, 255)
WOOD_D = (104, 64, 36, 255)
STONE = (146, 148, 160, 255)
STONE_L = (196, 198, 208, 255)
STONE_D = (96, 98, 112, 255)
FIBER = (190, 200, 110, 255)
FIBER_L = (230, 232, 150, 255)
FIBER_D = (120, 146, 70, 255)
ROPE = (206, 170, 118, 255)
ROPE_D = (150, 112, 74, 255)
IRON = (176, 190, 206, 255)
IRON_L = (226, 234, 242, 255)
IRON_D = (110, 122, 142, 255)
RUST = (214, 118, 56, 255)
CRYSTAL = (96, 196, 240, 255)
CRYSTAL_L = (180, 236, 255, 255)
CRYSTAL_D = (52, 120, 190, 255)
BROWN = (120, 78, 48, 255)
BROWN_D = (78, 48, 32, 255)
PAPER = (238, 226, 190, 255)
FLAME = (255, 168, 48, 255)
FLAME_L = (255, 232, 110, 255)
FLAME_D = (226, 84, 40, 255)
WHITE = (246, 244, 236, 255)
RED = (200, 70, 70, 255)
GOLD = (240, 196, 72, 255)
BLUE = (96, 140, 200, 255)
BLUE_D = (60, 92, 150, 255)
DARK = (30, 24, 30, 255)

TIER_HEAD = {1: (WOOD_L, WOOD_D), 2: (STONE_L, STONE_D), 3: (IRON_L, IRON_D)}


def canvas():
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def outlined(img):
    """Add a 1px dark outline around every non-transparent pixel."""
    src = img.load()
    out = img.copy()
    o = out.load()
    for y in range(S):
        for x in range(S):
            if src[x, y][3] > 0:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < S and 0 <= ny < S and src[nx, ny][3] > 0:
                    o[x, y] = OUT
                    break
    return out


def handle(d, x0, y0, x1, y1):
    d.line([(x0, y0), (x1, y1)], fill=WOOD, width=2)
    d.line([(x0 + 1, y0), (x1 + 1, y1)], fill=WOOD_D)
```

`tools/make_combat_icons.py`:

```python
"""Item icons for weapons, ammunition, meat and loot (16x16, drawn with the shared kit in icon_kit.py)."""
from PIL import ImageDraw

from icon_kit import FIBER_L, GOLD, RED, STONE_L, TIER_HEAD, WHITE, WOOD, WOOD_D, WOOD_L, canvas, handle, outlined

BONE = (232, 224, 200, 255)
BONE_D = (176, 164, 138, 255)
RAW = (214, 96, 104, 255)
RAW_L = (240, 150, 150, 255)
RAW_D = (160, 60, 72, 255)
COOKED = (156, 92, 52, 255)
COOKED_L = (206, 134, 78, 255)
COOKED_D = (104, 58, 36, 255)
HONEY = (240, 176, 48, 255)
HONEY_L = (255, 222, 110, 255)
HONEY_D = (196, 120, 32, 255)
GEL = (104, 206, 118, 255)
GEL_L = (190, 246, 190, 255)
GEL_D = (58, 140, 82, 255)


def sword(tier):
    light, dark = TIER_HEAD[tier]
    img, d = canvas()
    d.line([(5, 10), (12, 3)], fill=light, width=3)
    d.line([(6, 11), (13, 4)], fill=dark)
    d.polygon([(12, 2), (14, 1), (15, 2), (14, 4)], fill=light)
    if tier == 3:
        d.line([(6, 9), (12, 3)], fill=(255, 255, 255, 255))
    d.line([(4, 8), (8, 12)], fill=GOLD, width=2)
    handle(d, 5, 11, 2, 14)
    return outlined(img)


def spear_bone():
    img, d = canvas()
    handle(d, 2, 14, 10, 6)
    d.polygon([(9, 7), (11, 3), (14, 1), (15, 2), (13, 5), (10, 8)], fill=BONE)
    d.line([(10, 6), (14, 2)], fill=WHITE)
    d.polygon([(10, 8), (13, 5), (12, 7)], fill=BONE_D)
    d.line([(8, 8), (10, 10)], fill=FIBER_L)
    return outlined(img)


def bow():
    img, d = canvas()
    d.arc([2, 1, 14, 15], 100, 260, fill=WOOD, width=2)
    d.arc([3, 1, 15, 15], 100, 260, fill=WOOD_D)
    d.line([(7, 2), (7, 14)], fill=FIBER_L)
    d.point([4, 8], fill=WOOD_L)
    return outlined(img)


def arrow():
    img, d = canvas()
    d.line([(3, 13), (11, 5)], fill=WOOD, width=2)
    d.polygon([(11, 3), (15, 1), (13, 6)], fill=STONE_L)
    d.polygon([(2, 12), (1, 8), (4, 11)], fill=RED)
    d.polygon([(4, 14), (8, 15), (5, 11)], fill=RED)
    return outlined(img)


def meat(body, light, dark):
    img, d = canvas()
    d.ellipse([4, 4, 14, 12], fill=body)
    d.ellipse([5, 5, 10, 8], fill=light)
    d.arc([5, 6, 13, 12], 20, 160, fill=dark)
    d.line([(4, 10), (1, 14)], fill=BONE, width=2)
    d.point([1, 14], fill=BONE_D)
    return outlined(img)


def raw_meat():
    return meat(RAW, RAW_L, RAW_D)


def cooked_meat():
    img = meat(COOKED, COOKED_L, COOKED_D)
    d = ImageDraw.Draw(img)
    d.line([(7, 8), (11, 6)], fill=COOKED_D)
    d.line([(8, 10), (12, 8)], fill=COOKED_D)
    return img


def honey():
    img, d = canvas()
    d.rectangle([4, 6, 12, 14], fill=HONEY)
    d.rectangle([4, 6, 6, 14], fill=HONEY_L)
    d.rectangle([4, 13, 12, 14], fill=HONEY_D)
    d.rectangle([3, 3, 13, 6], fill=WOOD)
    d.rectangle([3, 3, 13, 4], fill=WOOD_L)
    d.line([(9, 7), (9, 10)], fill=HONEY_L)
    return outlined(img)


def bandage():
    img, d = canvas()
    d.ellipse([2, 4, 14, 13], fill=WHITE)
    d.ellipse([2, 4, 14, 13], outline=BONE_D)
    d.rectangle([7, 6, 9, 11], fill=RED)
    d.rectangle([5, 8, 11, 9], fill=RED)
    return outlined(img)


def gel():
    img, d = canvas()
    d.polygon([(2, 13), (3, 8), (6, 4), (10, 4), (13, 8), (14, 13)], fill=GEL)
    d.polygon([(3, 12), (4, 9), (7, 5), (9, 5)], fill=GEL_L)
    d.line([(3, 13), (14, 13)], fill=GEL_D)
    d.point([10, 8], fill=GEL_D)
    d.point([6, 9], fill=GEL_D)
    return outlined(img)


def bone():
    img, d = canvas()
    d.line([(4, 12), (12, 4)], fill=BONE, width=3)
    for cx, cy in ((3, 11), (5, 13), (11, 3), (13, 5)):
        d.ellipse([cx - 1, cy - 1, cx + 1, cy + 1], fill=BONE)
    d.line([(5, 12), (12, 5)], fill=BONE_D)
    return outlined(img)


def combat_icons():
    return {
        "sword_wood": sword(1), "sword_stone": sword(2), "sword_iron": sword(3), "spear_bone": spear_bone(),
        "bow": bow(), "arrow": arrow(), "raw_meat": raw_meat(), "cooked_meat": cooked_meat(), "honey": honey(),
        "bandage": bandage(), "gel": gel(), "bone": bone(),
    }
```

`tools/make_icons.py`:

```python
"""Draw the 16x16 item and structure icons the Unity pack does not have, and write them as an atlas.

The pack only ships farm and food icons, so materials, tools, seed packets and buildable structures are drawn here
with plain shapes plus an automatic dark outline, in the same 16x16 pixel style. Roasted and baked foods are tinted
copies of the pack's own food icons (read from the props atlas that pack_assets.py wrote).

Run after pack_assets.py:  python tools/make_icons.py
Output: public/assets/pack/icons.png and icons.json (a Phaser JSON-hash atlas).
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw

from icon_kit import *  # noqa: F401,F403  (palette, canvas, outlined, handle)
from icon_kit import S
from make_combat_icons import combat_icons

ROOT = Path(__file__).resolve().parent.parent
PACK = ROOT / "public" / "assets" / "pack"
def wood():
    img, d = canvas()
    d.rectangle([4, 8, 13, 12], fill=WOOD)
    d.rectangle([4, 8, 13, 9], fill=WOOD_L)
    d.rectangle([4, 12, 13, 12], fill=WOOD_D)
    d.ellipse([2, 7, 6, 13], fill=WOOD_L)
    d.ellipse([3, 9, 5, 11], outline=WOOD_D)
    d.rectangle([5, 3, 12, 6], fill=WOOD)
    d.rectangle([5, 3, 12, 3], fill=WOOD_L)
    d.rectangle([5, 6, 12, 6], fill=WOOD_D)
    d.ellipse([3, 2, 7, 7], fill=WOOD_L)
    d.point([5, 4], fill=WOOD_D)
    return outlined(img)


def stone():
    img, d = canvas()
    d.polygon([(3, 11), (4, 6), (8, 3), (12, 5), (13, 10), (10, 13), (5, 13)], fill=STONE)
    d.polygon([(4, 7), (8, 4), (10, 5), (6, 8)], fill=STONE_L)
    d.polygon([(8, 13), (13, 10), (12, 12), (10, 13)], fill=STONE_D)
    d.line([(6, 10), (8, 11)], fill=STONE_D)
    return outlined(img)


def fiber():
    img, d = canvas()
    for (x0, y0, x1, y1, c) in [(4, 13, 3, 3, FIBER_D), (6, 13, 6, 2, FIBER), (8, 13, 9, 2, FIBER_L), (10, 13, 12, 3, FIBER), (12, 13, 13, 5, FIBER_D)]:
        d.line([(x0, y0), (x1, y1)], fill=c, width=2)
    d.rectangle([3, 9, 13, 10], fill=ROPE)
    d.line([(3, 10), (13, 10)], fill=ROPE_D)
    return outlined(img)


def plank():
    img, d = canvas()
    d.rectangle([2, 3, 13, 7], fill=WOOD_L)
    d.line([(2, 7), (13, 7)], fill=WOOD)
    d.line([(4, 5), (9, 5)], fill=WOOD)
    d.point([3, 4], fill=WOOD_D)
    d.point([12, 6], fill=WOOD_D)
    d.rectangle([3, 8, 14, 12], fill=WOOD_L)
    d.line([(3, 12), (14, 12)], fill=WOOD)
    d.line([(6, 10), (12, 10)], fill=WOOD)
    d.point([4, 9], fill=WOOD_D)
    d.point([13, 11], fill=WOOD_D)
    return outlined(img)


def rope():
    img, d = canvas()
    d.ellipse([2, 3, 13, 13], fill=ROPE)
    d.ellipse([5, 6, 10, 10], fill=(0, 0, 0, 0))
    d.ellipse([2, 3, 13, 13], outline=ROPE_D)
    d.ellipse([4, 5, 11, 11], outline=ROPE_D)
    for p in [(4, 4), (11, 5), (12, 9), (8, 12), (3, 9)]:
        d.point(p, fill=ROPE_D)
    d.line([(10, 12), (14, 14)], fill=ROPE, width=1)
    return outlined(img)


def iron_ore():
    img = stone()
    d = ImageDraw.Draw(img)
    for p in [(6, 6), (9, 5), (8, 9), (11, 8), (5, 10), (10, 11)]:
        d.rectangle([p[0], p[1], p[0] + 1, p[1] + 1], fill=RUST)
    return img


def iron_ingot():
    img, d = canvas()
    d.polygon([(2, 10), (5, 5), (14, 5), (11, 10)], fill=IRON)
    d.polygon([(5, 5), (14, 5), (13, 6), (5, 6)], fill=IRON_L)
    d.rectangle([2, 10, 11, 12], fill=IRON_D)
    d.line([(11, 10), (14, 5)], fill=IRON_D)
    d.line([(11, 11), (14, 6)], fill=IRON_D)
    return outlined(img)


def crystal():
    img, d = canvas()
    d.polygon([(8, 1), (12, 5), (11, 12), (8, 14), (5, 12), (4, 5)], fill=CRYSTAL)
    d.polygon([(8, 1), (4, 5), (6, 6), (8, 3)], fill=CRYSTAL_L)
    d.polygon([(8, 14), (11, 12), (12, 5), (9, 8)], fill=CRYSTAL_D)
    d.line([(8, 3), (8, 12)], fill=CRYSTAL_L)
    return outlined(img)


def coconut():
    img, d = canvas()
    d.ellipse([2, 3, 13, 14], fill=BROWN)
    d.ellipse([3, 4, 8, 8], fill=(160, 108, 70, 255))
    d.ellipse([2, 3, 13, 14], outline=BROWN_D)
    for p in [(6, 8), (9, 8), (7, 11)]:
        d.rectangle([p[0], p[1], p[0] + 1, p[1] + 1], fill=BROWN_D)
    return outlined(img)


def seed_packet(color, seed_color):
    img, d = canvas()
    d.rectangle([3, 2, 12, 14], fill=PAPER)
    d.rectangle([3, 2, 12, 5], fill=color)
    d.line([(3, 6), (12, 6)], fill=WOOD_D)
    d.line([(3, 14), (12, 14)], fill=(200, 188, 150, 255))
    for p in [(6, 9), (9, 8), (7, 11), (10, 11)]:
        d.rectangle([p[0], p[1], p[0] + 1, p[1] + 1], fill=seed_color)
    return outlined(img)


def axe(tier):
    light, dark = TIER_HEAD[tier]
    img, d = canvas()
    handle(d, 3, 14, 10, 5)
    d.polygon([(7, 2), (13, 2), (14, 8), (11, 8), (9, 6)], fill=light)
    d.polygon([(11, 8), (14, 8), (14, 6), (12, 5)], fill=dark)
    d.line([(8, 3), (12, 3)], fill=(255, 255, 255, 255) if tier == 3 else light)
    return outlined(img)


def pickaxe(tier):
    light, dark = TIER_HEAD[tier]
    img, d = canvas()
    handle(d, 4, 14, 9, 5)
    d.polygon([(1, 5), (5, 2), (9, 2), (13, 4), (14, 7), (11, 5), (8, 4), (5, 5), (3, 7)], fill=light)
    d.polygon([(11, 5), (14, 7), (13, 4)], fill=dark)
    d.point([6, 3], fill=(255, 255, 255, 255) if tier == 3 else light)
    return outlined(img)


def hoe():
    img, d = canvas()
    handle(d, 4, 14, 10, 4)
    d.polygon([(8, 2), (14, 3), (13, 7), (9, 5)], fill=STONE)
    d.polygon([(9, 5), (13, 7), (13, 5)], fill=STONE_D)
    d.line([(9, 3), (13, 4)], fill=STONE_L)
    return outlined(img)


def watering_can():
    img, d = canvas()
    d.rectangle([3, 6, 10, 13], fill=BLUE)
    d.rectangle([3, 6, 10, 7], fill=(150, 190, 240, 255))
    d.rectangle([3, 12, 10, 13], fill=BLUE_D)
    d.line([(10, 9), (14, 4)], fill=BLUE_D, width=2)
    d.rectangle([13, 2, 14, 4], fill=BLUE)
    d.arc([0, 5, 6, 12], 90, 270, fill=BLUE_D, width=2)
    d.line([(4, 5), (9, 5)], fill=BLUE_D)
    return outlined(img)


def s_campfire():
    img, d = canvas()
    d.line([(2, 14), (13, 10)], fill=WOOD, width=3)
    d.line([(2, 10), (13, 14)], fill=WOOD_D, width=3)
    d.polygon([(8, 1), (12, 8), (10, 11), (6, 11), (4, 8)], fill=FLAME)
    d.polygon([(8, 4), (10, 8), (9, 10), (7, 10), (6, 8)], fill=FLAME_L)
    d.polygon([(5, 8), (4, 8), (6, 11)], fill=FLAME_D)
    return outlined(img)


def s_workbench():
    img, d = canvas()
    d.rectangle([1, 5, 14, 8], fill=WOOD_L)
    d.rectangle([1, 8, 14, 9], fill=WOOD_D)
    d.rectangle([2, 9, 4, 14], fill=WOOD)
    d.rectangle([11, 9, 13, 14], fill=WOOD)
    d.line([(1, 6), (14, 6)], fill=WOOD)
    d.rectangle([9, 2, 12, 5], fill=IRON_D)
    d.rectangle([9, 2, 12, 3], fill=IRON)
    d.rectangle([3, 3, 6, 5], fill=BROWN_D)
    return outlined(img)


def s_furnace():
    img, d = canvas()
    d.rectangle([2, 4, 13, 14], fill=STONE)
    d.rectangle([2, 4, 13, 5], fill=STONE_L)
    d.rectangle([2, 13, 13, 14], fill=STONE_D)
    d.rectangle([9, 1, 12, 4], fill=STONE_D)
    d.rectangle([5, 8, 10, 13], fill=DARK)
    d.rectangle([6, 10, 9, 13], fill=FLAME_D)
    d.rectangle([7, 11, 8, 13], fill=FLAME_L)
    for p in [(3, 6), (12, 7), (3, 11), (12, 11)]:
        d.point(p, fill=STONE_D)
    return outlined(img)


def s_bed():
    img, d = canvas()
    d.rectangle([2, 2, 13, 14], fill=WOOD)
    d.rectangle([3, 3, 12, 13], fill=WHITE)
    d.rectangle([3, 3, 12, 5], fill=(226, 232, 244, 255))
    d.rectangle([3, 7, 12, 13], fill=RED)
    d.line([(3, 7), (12, 7)], fill=(150, 44, 52, 255))
    d.line([(3, 13), (12, 13)], fill=(150, 44, 52, 255))
    return outlined(img)


def s_chest():
    img, d = canvas()
    d.rectangle([2, 7, 13, 14], fill=WOOD)
    d.rectangle([2, 3, 13, 7], fill=WOOD_L)
    d.rectangle([2, 7, 13, 8], fill=WOOD_D)
    d.rectangle([2, 10, 13, 10], fill=WOOD_D)
    d.rectangle([2, 3, 3, 14], fill=IRON_D)
    d.rectangle([12, 3, 13, 14], fill=IRON_D)
    d.rectangle([7, 7, 8, 10], fill=GOLD)
    return outlined(img)


def s_torch():
    img, d = canvas()
    d.rectangle([7, 7, 8, 14], fill=WOOD)
    d.line([(8, 7), (8, 14)], fill=WOOD_D)
    d.polygon([(7, 1), (10, 5), (9, 8), (6, 8), (5, 5)], fill=FLAME)
    d.polygon([(7, 3), (9, 6), (8, 8), (7, 8), (6, 6)], fill=FLAME_L)
    return outlined(img)


def s_fence():
    img, d = canvas()
    d.rectangle([2, 4, 4, 14], fill=WOOD)
    d.rectangle([11, 4, 13, 14], fill=WOOD)
    d.rectangle([2, 4, 4, 5], fill=WOOD_L)
    d.rectangle([11, 4, 13, 5], fill=WOOD_L)
    d.rectangle([4, 6, 11, 7], fill=WOOD_L)
    d.rectangle([4, 10, 11, 11], fill=WOOD_L)
    d.line([(4, 8), (11, 8)], fill=WOOD_D)
    d.line([(4, 12), (11, 12)], fill=WOOD_D)
    return outlined(img)


def ui_heart():
    img, d = canvas()
    d.ellipse([2, 3, 8, 9], fill=RED)
    d.ellipse([7, 3, 13, 9], fill=RED)
    d.polygon([(2, 7), (13, 7), (8, 14)], fill=RED)
    d.polygon([(4, 4), (6, 4), (4, 6)], fill=(255, 170, 170, 255))
    return outlined(img)


def ui_food():
    img, d = canvas()
    d.ellipse([2, 3, 10, 11], fill=(214, 120, 70, 255))
    d.ellipse([3, 4, 6, 7], fill=(240, 170, 110, 255))
    d.line([(9, 9), (13, 13)], fill=PAPER, width=2)
    d.ellipse([11, 11, 14, 14], fill=PAPER)
    return outlined(img)


def ui_drop():
    img, d = canvas()
    d.polygon([(8, 1), (12, 8), (12, 11), (10, 14), (6, 14), (4, 11), (4, 8)], fill=CRYSTAL)
    d.polygon([(8, 1), (4, 8), (4, 11), (6, 9), (7, 4)], fill=CRYSTAL_L)
    d.polygon([(12, 8), (12, 11), (10, 14), (9, 13)], fill=CRYSTAL_D)
    return outlined(img)


def ui_bolt():
    img, d = canvas()
    d.polygon([(9, 1), (3, 9), (7, 9), (6, 15), (13, 6), (9, 6)], fill=GOLD)
    d.polygon([(9, 1), (3, 9), (5, 9), (9, 3)], fill=FLAME_L)
    return outlined(img)


def tinted(frame, mul):
    """A copy of a food icon from the props atlas, darkened and warmed to look cooked."""
    atlas = json.loads((PACK / "props.json").read_text(encoding="utf-8"))["frames"]
    sheet = Image.open(PACK / "props.png").convert("RGBA")
    f = atlas[frame]["frame"]
    tile = sheet.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"]))
    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    out.paste(tile, ((S - tile.width) // 2, (S - tile.height) // 2))
    px = out.load()
    for y in range(S):
        for x in range(S):
            r, g, b, a = px[x, y]
            if a:
                px[x, y] = (int(r * mul[0]), int(g * mul[1]), int(b * mul[2]), a)
    return out


def build():
    icons = {
        "wood": wood(), "stone": stone(), "fiber": fiber(), "plank": plank(), "rope": rope(), "iron_ore": iron_ore(),
        "iron_ingot": iron_ingot(), "crystal": crystal(), "coconut": coconut(),
        "carrot_seed": seed_packet((232, 128, 40, 255), (232, 128, 40, 255)),
        "turnip_seed": seed_packet((178, 96, 170, 255), (140, 70, 130, 255)),
        "pumpkin_seed": seed_packet((236, 160, 40, 255), (200, 120, 30, 255)),
        "corn_seed": seed_packet((236, 210, 70, 255), (200, 170, 40, 255)),
        "axe_wood": axe(1), "axe_stone": axe(2), "axe_iron": axe(3),
        "pickaxe_wood": pickaxe(1), "pickaxe_stone": pickaxe(2), "pickaxe_iron": pickaxe(3),
        "hoe": hoe(), "watering_can": watering_can(),
        "struct_campfire": s_campfire(), "struct_workbench": s_workbench(), "struct_furnace": s_furnace(),
        "struct_bed": s_bed(), "struct_chest": s_chest(), "struct_torch": s_torch(), "struct_fence": s_fence(),
        "ui_heart": ui_heart(), "ui_food": ui_food(), "ui_drop": ui_drop(), "ui_bolt": ui_bolt(),
        "roasted_carrot": tinted("farmicon1/4", (0.86, 0.66, 0.42)),
        "roasted_corn": tinted("farmicon1/58", (0.92, 0.72, 0.4)),
        "baked_pumpkin": tinted("farmicon1/50", (0.82, 0.58, 0.36)),
    }
    icons.update(combat_icons())
    return icons


def main():
    icons = build()
    cols = 8
    rows = (len(icons) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * S, rows * S), (0, 0, 0, 0))
    frames = {}
    for n, (name, img) in enumerate(icons.items()):
        x, y = (n % cols) * S, (n // cols) * S
        sheet.paste(img, (x, y))
        frames[name] = {
            "frame": {"x": x, "y": y, "w": S, "h": S}, "rotated": False, "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": S, "h": S}, "sourceSize": {"w": S, "h": S},
        }
    PACK.mkdir(parents=True, exist_ok=True)
    sheet.save(PACK / "icons.png", optimize=True)
    meta = {"image": "icons.png", "size": {"w": sheet.width, "h": sheet.height}, "scale": "1"}
    (PACK / "icons.json").write_text(json.dumps({"frames": frames, "meta": meta}), encoding="utf-8")
    print(f"icons: {len(frames)} frames -> {sheet.width}x{sheet.height}")


if __name__ == "__main__":
    main()
```

Run: `python tools/make_icons.py`
Expected: prints `icons: 47 frames -> 128x96`. Open `public/assets/pack/icons.png`: the new icons (swords, spear, bow, arrow, two meats, honey jar, bandage roll, green gel, bone) sit after the old ones.

- [ ] **Step 6: Run the tests, the typecheck and the whole suite**

Run: `npx vitest run tests/weapons.test.ts && npm run typecheck && npm test`
Expected: weapons 11 tests PASS; typecheck exits 0; the whole suite passes (262 tests; `tests/assets.test.ts` now also checks that all 48 items have an icon in the atlas).

- [ ] **Step 7: Commit**

```bash
git add src/data tools/icon_kit.py tools/make_combat_icons.py tools/make_icons.py src/scenes/InventoryScene.ts public/assets/pack/icons.png public/assets/pack/icons.json tests/weapons.test.ts
git commit -m "feat: add weapons, loot items, meat and healing recipes with icons"
```

---

### Task 2: Creature catalog and the monsters atlas

**Files:**
- Create: `src/data/creatures.ts`
- Modify: `tools/pack_assets.py` (one line)
- Generated: `public/assets/pack/monsters.png`, `public/assets/pack/monsters.json`
- Test: `tests/creatures-data.test.ts` (new)

**Interfaces:**
- Consumes: `Drop` (`src/data/resources.ts`), `ItemId`, the `Biome` constants, the `monsters` atlas from the Unity pack.
- Produces: `EnemyId`, `AnimalId`, `CreatureId`, `Temper = 'chase' | 'flee' | 'defend'`, `CreatureSprite {atlas, group, frames, fixedDir?}`, `CreatureDef {id, temper, hp, speed, damage, sight, reach, windup, cooldown, radius, sprite, drops, spawn: {biomes, weight, when}}`, `CREATURES`, `CREATURE_IDS`, `isHostileKind(id)`, `spawnWeights(biome, night) -> [CreatureId, number][]`.

- [ ] **Step 1: Write the failing test**

`tests/creatures-data.test.ts`:

```typescript
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
    expect(CREATURE_IDS).toHaveLength(13);
    for (const id of CREATURE_IDS) {
      const c = CREATURES[id];
      expect(c.id).toBe(id);
      for (const v of [c.hp, c.speed, c.radius]) expect(v, id).toBeGreaterThan(0);
      expect(c.spawn.biomes.length, id).toBeGreaterThan(0);
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

  it('has nine enemies that chase and four animals: three flee and the boar fights back', () => {
    const by = (temper: string) => CREATURE_IDS.filter((id) => CREATURES[id].temper === temper).sort();
    expect(by('chase')).toHaveLength(9);
    expect(by('flee')).toEqual(['bird', 'fox', 'rabbit']);
    expect(by('defend')).toEqual(['boar']);
    expect(isHostileKind('slime')).toBe(true);
    expect(isHostileKind('boar')).toBe(false);
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/creatures-data.test.ts`
Expected: FAIL, "Failed to resolve import "@/data/creatures"".

- [ ] **Step 3: Write the catalog**

`src/data/creatures.ts`:

```typescript
import { B, type Biome } from '@/sim/world/types';
import type { Drop } from './resources';

export type EnemyId = 'slime' | 'mushroom' | 'wasp' | 'skeleton' | 'zombie' | 'worm' | 'ghost' | 'scorpion' | 'skeleton_warrior';
export type AnimalId = 'rabbit' | 'fox' | 'bird' | 'boar';
export type CreatureId = EnemyId | AnimalId;

/** Chasers hunt the hero on sight, fleeing animals run from him, defenders only fight back once hurt. */
export type Temper = 'chase' | 'flee' | 'defend';

export interface CreatureSprite {
  atlas: 'monsters' | 'actors';
  /** Frames are named "<group>/<dir>/<n>" (down, left, right, up). */
  group: string;
  /** Walk-cycle length. */
  frames: number;
  /** Sheets that only have front-facing rows (the bonus monsters) always show this row. */
  fixedDir?: 'down' | 'left' | 'right' | 'up';
}

export interface CreatureDef {
  id: CreatureId;
  temper: Temper;
  hp: number;
  /** Tiles per second when it moves in earnest (hunting or running away). */
  speed: number;
  /** Hit points taken from the hero by one strike; 0 for animals that never fight. */
  damage: number;
  /** Tiles at which it notices the hero. */
  sight: number;
  /** Tiles from its centre at which a strike lands. */
  reach: number;
  /** Seconds of warning before a strike lands, and the pause after it. */
  windup: number;
  cooldown: number;
  /** Half of its collision box, in tiles. */
  radius: number;
  sprite: CreatureSprite;
  drops: readonly Drop[];
  spawn: { biomes: readonly Biome[]; weight: number; when: 'day' | 'night' | 'any' };
}

const monster = (group: string, fixedDir?: CreatureSprite['fixedDir']): CreatureSprite => ({ atlas: 'monsters', group, frames: 3, fixedDir });
const critter = (group: string, frames = 3): CreatureSprite => ({ atlas: 'actors', group, frames });

const enemy = (
  id: EnemyId, hp: number, speed: number, damage: number, sight: number, windup: number, cooldown: number,
  sprite: CreatureSprite, drops: readonly Drop[], spawn: CreatureDef['spawn'],
): CreatureDef => ({ id, temper: 'chase', hp, speed, damage, sight, reach: 0.85, windup, cooldown, radius: 0.3, sprite, drops, spawn });

const { FOREST, MOUNTAIN, SWAMP, DESERT } = B;

export const CREATURES: Record<CreatureId, CreatureDef> = {
  slime: enemy('slime', 8, 1.1, 6, 5, 0.3, 1.2, monster('m01_0'), [{ item: 'gel', min: 1, max: 2, chance: 0.8 }], { biomes: [FOREST, SWAMP], weight: 10, when: 'any' }),
  mushroom: enemy('mushroom', 10, 0.8, 8, 4, 0.45, 1.5, monster('bonus_1', 'down'), [{ item: 'gel', min: 1, max: 1, chance: 0.4 }, { item: 'fiber', min: 1, max: 2 }], { biomes: [FOREST], weight: 6, when: 'any' }),
  wasp: enemy('wasp', 6, 2.4, 7, 7, 0.3, 1, monster('bonus_3', 'down'), [{ item: 'honey', min: 1, max: 1, chance: 0.6 }], { biomes: [FOREST, MOUNTAIN], weight: 5, when: 'day' }),
  skeleton: enemy('skeleton', 14, 1.5, 10, 7, 0.4, 1.2, monster('m05_0'), [{ item: 'bone', min: 1, max: 2 }], { biomes: [MOUNTAIN, DESERT], weight: 8, when: 'night' }),
  zombie: enemy('zombie', 18, 1, 12, 6, 0.5, 1.6, monster('m02_3'), [{ item: 'bone', min: 1, max: 1, chance: 0.6 }, { item: 'fiber', min: 1, max: 2, chance: 0.5 }], { biomes: [MOUNTAIN, SWAMP], weight: 6, when: 'night' }),
  worm: enemy('worm', 12, 0.9, 8, 4, 0.4, 1.3, monster('bonus_2', 'left'), [{ item: 'gel', min: 1, max: 2 }], { biomes: [SWAMP], weight: 8, when: 'any' }),
  ghost: enemy('ghost', 10, 1.3, 9, 7, 0.35, 1.3, monster('m02_4'), [{ item: 'crystal', min: 1, max: 1, chance: 0.2 }, { item: 'gel', min: 1, max: 1, chance: 0.5 }], { biomes: [SWAMP], weight: 5, when: 'night' }),
  scorpion: enemy('scorpion', 16, 1.8, 12, 6, 0.35, 1.2, monster('m04_5'), [{ item: 'raw_meat', min: 1, max: 2 }, { item: 'bone', min: 1, max: 1, chance: 0.5 }], { biomes: [DESERT], weight: 8, when: 'any' }),
  skeleton_warrior: { ...enemy('skeleton_warrior', 24, 1.6, 16, 7, 0.45, 1.3, monster('m05_3'), [{ item: 'bone', min: 1, max: 3 }, { item: 'iron_ore', min: 1, max: 1, chance: 0.3 }], { biomes: [DESERT], weight: 5, when: 'night' }), reach: 1 },

  rabbit: { id: 'rabbit', temper: 'flee', hp: 3, speed: 3, damage: 0, sight: 4, reach: 0, windup: 0, cooldown: 0, radius: 0.2, sprite: critter('bunny1/walk'), drops: [{ item: 'raw_meat', min: 1, max: 1 }], spawn: { biomes: [FOREST], weight: 10, when: 'any' } },
  fox: { id: 'fox', temper: 'flee', hp: 6, speed: 2.9, damage: 0, sight: 5, reach: 0, windup: 0, cooldown: 0, radius: 0.22, sprite: critter('fox1/walk'), drops: [{ item: 'raw_meat', min: 1, max: 2 }], spawn: { biomes: [FOREST, MOUNTAIN, DESERT], weight: 5, when: 'any' } },
  bird: { id: 'bird', temper: 'flee', hp: 2, speed: 3.1, damage: 0, sight: 4, reach: 0, windup: 0, cooldown: 0, radius: 0.18, sprite: critter('bird1/walk'), drops: [{ item: 'raw_meat', min: 1, max: 1, chance: 0.7 }], spawn: { biomes: [FOREST, MOUNTAIN, SWAMP, DESERT], weight: 8, when: 'day' } },
  boar: { id: 'boar', temper: 'defend', hp: 14, speed: 2.3, damage: 8, sight: 6, reach: 0.9, windup: 0.4, cooldown: 1.2, radius: 0.32, sprite: critter('pig2/move', 4), drops: [{ item: 'raw_meat', min: 2, max: 3 }, { item: 'bone', min: 1, max: 1, chance: 0.4 }], spawn: { biomes: [FOREST, SWAMP], weight: 4, when: 'any' } },
};

export const CREATURE_IDS = Object.keys(CREATURES) as CreatureId[];

/** True for creatures that attack the hero without being provoked. */
export const isHostileKind = (id: CreatureId): boolean => CREATURES[id].temper === 'chase';

/** Creatures that may appear in a biome at this time of day, with their spawn weights. */
export function spawnWeights(biome: Biome, night: boolean): (readonly [CreatureId, number])[] {
  return CREATURE_IDS
    .filter((id) => {
      const s = CREATURES[id].spawn;
      return s.biomes.includes(biome) && (s.when === 'any' || (s.when === 'night') === night);
    })
    .map((id) => [id, CREATURES[id].spawn.weight] as const);
}
```

- [ ] **Step 4: Pack the monsters atlas**

`tools/pack_assets.py` already defines `build_monsters()` (a 3-column by 4-row grid of 48x48 cells per monster sheet) but its main block never ran it. In the `if __name__ == "__main__":` block, add one line so it reads:

```python
if __name__ == "__main__":
    build_heroes()
    build_actors()
    build_monsters()
    build_props()
```

Build only the monsters atlas (the others are already committed and unchanged):

```bash
cd tools && python -c "import pack_assets; pack_assets.build_monsters()" && cd ..
```

Expected: prints `atlas monsters: 516 frames -> 2048x256`. One thing to know about the sheets: the `bonus_*` monsters (mushroom, worm, wasp) have colour variants in their rows instead of directions, which is why the catalog gives them a `fixedDir`.

- [ ] **Step 5: Run the tests, the typecheck and the whole suite**

Run: `npx vitest run tests/creatures-data.test.ts && npm run typecheck && npm test`
Expected: creatures-data 10 tests PASS (the "creature art" test now runs because the atlas exists); typecheck exits 0; whole suite passes (272 tests).

- [ ] **Step 6: Commit**

```bash
git add src/data/creatures.ts tools/pack_assets.py public/assets/pack/monsters.png public/assets/pack/monsters.json tests/creatures-data.test.ts
git commit -m "feat: add creature catalog (9 monsters, 4 animals) and the monsters atlas"
```

---

### Task 3: Combat rules

**Files:**
- Create: `src/sim/combat.ts`
- Test: `tests/combat.test.ts` (new)

**Interfaces:**
- Consumes: `WeaponStats` (Task 1), `Facing` (`src/sim/actions.ts`), `Vec`, `Difficulty`.
- Produces: `SwingStats = Pick<WeaponStats, 'damage' | 'reach' | 'arc' | 'knockback'>`, `HERO_DEFENSE = 0`, `HERO_IFRAMES = 0.7`, `DIFFICULTY_DAMAGE`, `enemyDamage(base, difficulty, defense?) -> number` (at least 1), `inSwing(origin, facing, reach, arcDegrees, target, targetRadius) -> boolean`, `knockbackVec(from, to, tiles) -> Vec`, `facingFromVector(x, y, previous) -> Facing`.

- [ ] **Step 1: Write the failing test**

`tests/combat.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { DIFFICULTY_DAMAGE, HERO_DEFENSE, HERO_IFRAMES, enemyDamage, facingFromVector, inSwing, knockbackVec } from '@/sim/combat';

const hero = { x: 10.5, y: 10.5 };

describe('enemyDamage', () => {
  it('scales with the difficulty and rounds to whole hit points', () => {
    expect(enemyDamage(10, 'normal')).toBe(10);
    expect(enemyDamage(10, 'relaxed')).toBe(6);
    expect(enemyDamage(10, 'hardcore')).toBe(14);
    expect(DIFFICULTY_DAMAGE.relaxed).toBeLessThan(DIFFICULTY_DAMAGE.normal);
    expect(DIFFICULTY_DAMAGE.normal).toBeLessThan(DIFFICULTY_DAMAGE.hardcore);
  });

  it('lets armour take points off but always leaves at least one', () => {
    expect(enemyDamage(10, 'normal', 4)).toBe(6);
    expect(enemyDamage(10, 'normal', 50)).toBe(1);
    expect(enemyDamage(1, 'relaxed', 0)).toBe(1);
  });
});

describe('inSwing', () => {
  const sword = (facing: 'down' | 'left' | 'right' | 'up', target: { x: number; y: number }, radius = 0.3) =>
    inSwing(hero, facing, 1.3, 110, target, radius);

  it('hits what is in front of the hero in all four directions', () => {
    expect(sword('right', { x: 11.5, y: 10.5 })).toBe(true);
    expect(sword('left', { x: 9.5, y: 10.5 })).toBe(true);
    expect(sword('down', { x: 10.5, y: 11.5 })).toBe(true);
    expect(sword('up', { x: 10.5, y: 9.5 })).toBe(true);
  });

  it('misses what is behind the hero or to the side outside the arc', () => {
    expect(sword('right', { x: 9.5, y: 10.5 })).toBe(false);
    expect(sword('right', { x: 10.5, y: 11.5 })).toBe(false);
    expect(sword('up', { x: 10.5, y: 11.5 })).toBe(false);
  });

  it('misses what is too far away but counts the size of the target', () => {
    expect(sword('right', { x: 12.2, y: 10.5 })).toBe(false);
    expect(sword('right', { x: 12.2, y: 10.5 }, 0.5)).toBe(true);
    expect(sword('right', { x: 13, y: 10.5 }, 0.5)).toBe(false);
  });

  it('always hits something touching the hero, whichever way the hero faces', () => {
    expect(sword('left', { x: 10.6, y: 10.5 })).toBe(true);
  });

  it('gives a narrow spear a narrow cone but a long reach', () => {
    const spear = (target: { x: number; y: number }) => inSwing(hero, 'right', 1.9, 30, target, 0.3);
    expect(spear({ x: 12.3, y: 10.5 })).toBe(true);
    expect(spear({ x: 12.3, y: 11.4 })).toBe(false);
    expect(sword('right', { x: 12.3, y: 10.5 })).toBe(false);
  });

  it('counts a target whose edge is inside the arc', () => {
    expect(inSwing(hero, 'right', 1.5, 20, { x: 11.5, y: 11.1 }, 0.45)).toBe(true);
    expect(inSwing(hero, 'right', 1.5, 20, { x: 11.5, y: 11.1 }, 0.05)).toBe(false);
  });
});

describe('knockbackVec', () => {
  it('pushes away from the source by the given distance', () => {
    const v = knockbackVec({ x: 0, y: 0 }, { x: 3, y: 4 }, 1);
    expect(v.x).toBeCloseTo(0.6);
    expect(v.y).toBeCloseTo(0.8);
  });

  it('still pushes somewhere when both are on the same spot', () => {
    const v = knockbackVec({ x: 2, y: 2 }, { x: 2, y: 2 }, 0.5);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(0.5);
  });
});

describe('facingFromVector', () => {
  it('picks the dominant axis and keeps the old facing when standing still', () => {
    expect(facingFromVector(1, 0.2, 'down')).toBe('right');
    expect(facingFromVector(-1, 0.2, 'down')).toBe('left');
    expect(facingFromVector(0.1, -1, 'down')).toBe('up');
    expect(facingFromVector(0.1, 1, 'up')).toBe('down');
    expect(facingFromVector(0, 0, 'left')).toBe('left');
  });
});

describe('hero constants', () => {
  it('gives the hero a short moment of safety after a hit, and no armour yet', () => {
    expect(HERO_IFRAMES).toBeGreaterThan(0.3);
    expect(HERO_IFRAMES).toBeLessThan(1.5);
    expect(HERO_DEFENSE).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/combat.test.ts`
Expected: FAIL, "Failed to resolve import "@/sim/combat"".

- [ ] **Step 3: Write the combat rules**

`src/sim/combat.ts`:

```typescript
import type { WeaponStats } from '@/data/items';
import type { Facing } from '@/sim/actions';
import type { Vec } from '@/sim/movement';
import type { Difficulty } from '@/sim/vitals';

/** The part of a weapon that decides what a swing hits and how hard. */
export type SwingStats = Pick<WeaponStats, 'damage' | 'reach' | 'arc' | 'knockback'>;

/** Armour points the hero wears: every blow is cut by this much. Armour items raise it later. */
export const HERO_DEFENSE = 0;

/** Seconds after a hit during which the hero cannot be hurt again. */
export const HERO_IFRAMES = 0.7;

/** What the difficulty does to the damage monsters deal. */
export const DIFFICULTY_DAMAGE: Record<Difficulty, number> = { relaxed: 0.6, normal: 1, hardcore: 1.4 };

/** Hit points a strike of `base` takes from the hero; `defense` is armour, and a hit always hurts at least one point. */
export function enemyDamage(base: number, difficulty: Difficulty, defense = 0): number {
  return Math.max(1, Math.round(base * DIFFICULTY_DAMAGE[difficulty]) - defense);
}

const FACING: Record<Facing, readonly [number, number]> = { down: [0, 1], left: [-1, 0], right: [1, 0], up: [0, -1] };
const DEG = 180 / Math.PI;

/**
 * Does a swing from `origin` (facing `facing`, `reach` tiles long, `arc` degrees wide) hit a round target?
 * A target touching the hero is always hit, and a big target counts when any edge of it is inside the arc.
 */
export function inSwing(origin: Vec, facing: Facing, reach: number, arc: number, target: Vec, targetRadius: number): boolean {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const d = Math.hypot(dx, dy);
  if (d > reach + targetRadius) return false;
  if (d <= targetRadius) return true;
  const [fx, fy] = FACING[facing];
  const cos = Math.min(1, Math.max(-1, (dx * fx + dy * fy) / d));
  const slack = Math.asin(Math.min(1, targetRadius / d)) * DEG;
  return Math.acos(cos) * DEG <= arc / 2 + slack;
}

/** How far to push `to` away from `from`: a vector of length `tiles`. */
export function knockbackVec(from: Vec, to: Vec, tiles: number): Vec {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) return { x: tiles, y: 0 };
  return { x: (dx / d) * tiles, y: (dy / d) * tiles };
}

/** The way a movement vector points: the stronger axis wins; standing still keeps the old facing. */
export function facingFromVector(x: number, y: number, previous: Facing): Facing {
  if (Math.abs(x) < 0.01 && Math.abs(y) < 0.01) return previous;
  if (Math.abs(x) > Math.abs(y) * 1.05) return x < 0 ? 'left' : 'right';
  return y < 0 ? 'up' : 'down';
}
```

- [ ] **Step 4: Run the test and the typecheck**

Run: `npx vitest run tests/combat.test.ts && npm run typecheck`
Expected: 12 tests PASS; typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/sim/combat.ts tests/combat.test.ts
git commit -m "feat: add combat rules (damage scaling, swing arc, knockback)"
```

---

### Task 4: Creature behaviour

**Files:**
- Replace: `src/sim/movement.ts`, `tests/movement.test.ts`
- Create: `src/sim/creatures.ts`
- Test: `tests/creatures.test.ts` (new)

**Interfaces:**
- Consumes: `CREATURES`, `CreatureDef`, `CreatureId` (Task 2), `facingFromVector` (Task 3), `moveWithCollision`, `speedFactor`, `PLAYER_HALF`, `Vec`, `Rng`, `World`.
- Produces: `moveWithCollision(world, solids, pos, dx, dy, half = PLAYER_HALF)` (the new last argument is the half-width of the moving body); `CreatureState = 'idle' | 'wander' | 'chase' | 'windup' | 'recover' | 'flee'`, `Creature {id, kind, x, y, hp, facing, state, timer, headX, headY, angry, pushX, pushY, stun}`, `StepContext {world, solids, hero, heroAlive, rng, dt}`, `StepResult {creature, strike}`, `newCreature(id, kind, x, y, rng)`, `stepCreature(c, ctx) -> StepResult`, `hurtCreature(c, amount, push) -> {creature, dead}`, `HURT_STUN`.

- [ ] **Step 1: Write the failing tests**

Replace `tests/movement.test.ts` (adds a test for bodies smaller than the hero):

`tests/movement.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { PLAYER_HALF, WADE_SPEED, moveWithCollision, speedFactor, tileBlocked } from '@/sim/movement';
import { T, WORLD_SIZE, idx, type World } from '@/sim/world/types';

/** A tiny all-grass world with a deep-water column at x = 8 and a river tile at (3, 3). */
function makeWorld(): World {
  const size = WORLD_SIZE;
  const terrain = new Uint8Array(size * size).fill(T.GRASS);
  for (let y = 0; y < size; y++) terrain[idx(8, y)] = T.DEEP;
  terrain[idx(3, 3)] = T.RIVER;
  terrain[idx(4, 3)] = T.SHALLOW;
  return { seed: 0, size, terrain, biome: new Uint8Array(size * size), landmarks: [], resources: [], start: { x: 1, y: 1 } };
}

const none: ReadonlySet<number> = new Set();

describe('moveWithCollision', () => {
  it('moves freely over open ground', () => {
    expect(moveWithCollision(makeWorld(), none, { x: 5.5, y: 5.5 }, 0.1, -0.05)).toEqual({ x: 5.6, y: 5.45 });
  });

  it('is stopped by deep water', () => {
    const p = moveWithCollision(makeWorld(), none, { x: 7.5, y: 5.5 }, 0.5, 0);
    expect(p.x).toBe(7.5);
  });

  it('slides along a wall instead of sticking', () => {
    const p = moveWithCollision(makeWorld(), none, { x: 7.5, y: 5.5 }, 0.5, 0.2);
    expect(p.x).toBe(7.5);
    expect(p.y).toBeCloseTo(5.7);
  });

  it('is blocked by solid resource tiles', () => {
    const solids = new Set([idx(6, 5)]);
    expect(moveWithCollision(makeWorld(), solids, { x: 5.5, y: 5.5 }, 0.5, 0).x).toBe(5.5);
  });

  it('cannot leave the map', () => {
    const w = makeWorld();
    expect(moveWithCollision(w, none, { x: PLAYER_HALF + 0.01, y: 5.5 }, -1, 0).x).toBeCloseTo(PLAYER_HALF + 0.01);
    expect(moveWithCollision(w, none, { x: 5.5, y: WORLD_SIZE - PLAYER_HALF - 0.01 }, 0, 1).y).toBeCloseTo(WORLD_SIZE - PLAYER_HALF - 0.01);
  });

  it('lets a player who is stuck inside a solid tile walk out, but never off the map', () => {
    const solids = new Set([idx(5, 5)]);
    expect(moveWithCollision(makeWorld(), solids, { x: 5.5, y: 5.5 }, 0.1, 0)).toEqual({ x: 5.6, y: 5.5 });
    expect(moveWithCollision(makeWorld(), new Set([idx(0, 0)]), { x: 0.2, y: 0.2 }, -5, -5)).toEqual({ x: 0.01, y: 0.01 });
  });

  it('lets a smaller body get closer to a wall than the hero can', () => {
    const w = makeWorld();
    expect(moveWithCollision(w, none, { x: 7.7, y: 5.5 }, 0.05, 0).x).toBe(7.7);
    expect(moveWithCollision(w, none, { x: 7.7, y: 5.5 }, 0.05, 0, 0.1).x).toBeCloseTo(7.75);
    expect(moveWithCollision(w, none, { x: 7.7, y: 5.5 }, 0.3, 0, 0.1).x).toBe(7.7);
  });

  it('allows wading into shallow water and rivers', () => {
    const p = moveWithCollision(makeWorld(), none, { x: 2.7, y: 3.5 }, 0.5, 0);
    expect(p.x).toBeCloseTo(3.2);
  });
});

describe('tileBlocked / speedFactor', () => {
  it('blocks deep water, solids and out-of-bounds only', () => {
    const w = makeWorld();
    expect(tileBlocked(w, none, 8, 0)).toBe(true);
    expect(tileBlocked(w, none, -1, 0)).toBe(true);
    expect(tileBlocked(w, none, 0, WORLD_SIZE)).toBe(true);
    expect(tileBlocked(w, new Set([idx(2, 2)]), 2, 2)).toBe(true);
    expect(tileBlocked(w, none, 3, 3)).toBe(false);
  });

  it('slows the player in shallow water and rivers', () => {
    const w = makeWorld();
    expect(speedFactor(w, 5.5, 5.5)).toBe(1);
    expect(speedFactor(w, 3.5, 3.5)).toBe(WADE_SPEED);
    expect(speedFactor(w, 4.5, 3.5)).toBe(WADE_SPEED);
    expect(speedFactor(w, -4, -4)).toBe(1);
  });
});
```

`tests/creatures.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/rng';
import { CREATURES } from '@/data/creatures';
import { hurtCreature, newCreature, stepCreature, type Creature, type StepContext } from '@/sim/creatures';
import { T, WORLD_SIZE, idx, type World } from '@/sim/world/types';

/** All grass, with a deep-water column at x = 30. */
function makeWorld(): World {
  const size = WORLD_SIZE;
  const terrain = new Uint8Array(size * size).fill(T.GRASS);
  for (let y = 0; y < size; y++) terrain[idx(30, y)] = T.DEEP;
  return { seed: 0, size, terrain, biome: new Uint8Array(size * size), landmarks: [], resources: [], start: { x: 1, y: 1 } };
}

const world = makeWorld();
const none: ReadonlySet<number> = new Set();
const at = (kind: Parameters<typeof newCreature>[1], x: number, y: number, over: Partial<Creature> = {}): Creature =>
  ({ ...newCreature(1, kind, x, y, new Rng(1)), ...over });
const ctx = (hero: { x: number; y: number }, over: Partial<StepContext> = {}): StepContext =>
  ({ world, solids: none, hero, heroAlive: true, rng: new Rng(7), dt: 0.05, ...over });

/** Step repeatedly for `seconds`, collecting how many blows landed. */
function run(start: Creature, hero: { x: number; y: number }, seconds: number, over: Partial<StepContext> = {}) {
  let c = start;
  let strikes = 0;
  const trail: Creature[] = [];
  const rng = new Rng(7);
  for (let t = 0; t < seconds; t += 0.05) {
    const r = stepCreature(c, ctx(hero, { rng, ...over }));
    c = r.creature;
    if (r.strike) strikes++;
    trail.push(c);
  }
  return { c, strikes, trail };
}

describe('newCreature', () => {
  it('starts idle at full health, standing where it was put', () => {
    const c = newCreature(4, 'boar', 20.5, 21.5, new Rng(3));
    expect(c).toMatchObject({ id: 4, kind: 'boar', x: 20.5, y: 21.5, hp: CREATURES.boar.hp, state: 'idle', angry: false, stun: 0 });
    expect(c.timer).toBeGreaterThan(0);
  });
});

describe('strolling', () => {
  it('idles, then wanders a short way, and stays on solid ground', () => {
    const start = at('slime', 20.5, 20.5);
    const { trail } = run(start, { x: 100, y: 100 }, 20);
    expect(trail.some((c) => c.state === 'wander')).toBe(true);
    const far = trail.reduce((m, c) => Math.max(m, Math.hypot(c.x - 20.5, c.y - 20.5)), 0);
    expect(far).toBeGreaterThan(0.2);
    expect(far).toBeLessThan(15);
    expect(trail.every((c) => world.terrain[idx(Math.floor(c.x), Math.floor(c.y))] === T.GRASS)).toBe(true);
  });

  it('never walks into deep water or a solid tile, however long it wanders', () => {
    const solids = new Set([idx(26, 20), idx(26, 21), idx(26, 19)]);
    for (const seed of [1, 2, 3]) {
      let c = at('boar', 28.5, 20.5);
      const rng = new Rng(seed);
      for (let t = 0; t < 60; t += 0.05) {
        c = stepCreature(c, ctx({ x: 100, y: 100 }, { rng, solids })).creature;
        expect(c.x, `seed ${seed}`).toBeLessThan(30);
        expect(solids.has(idx(Math.floor(c.x), Math.floor(c.y)))).toBe(false);
      }
    }
  });
});

describe('a hunter', () => {
  it('notices the hero inside its sight and closes in', () => {
    const { c } = run(at('slime', 20.5, 20.5), { x: 24.5, y: 20.5 }, 1);
    expect(c.state === 'chase' || c.state === 'windup').toBe(true);
    expect(c.x).toBeGreaterThan(21);
    expect(c.facing).toBe('right');
  });

  it('ignores a hero outside its sight', () => {
    const { trail } = run(at('slime', 20.5, 20.5), { x: 30 - 2, y: 20.5 - 9 }, 0.5);
    expect(trail.every((c) => c.state !== 'chase')).toBe(true);
  });

  it('loses track of a hero who gets far enough away', () => {
    let c = at('slime', 20.5, 20.5, { state: 'chase' });
    c = run(c, { x: 20.5, y: 20.5 + CREATURES.slime.sight * 1.7 }, 0.2).c;
    expect(c.state).not.toBe('chase');
  });

  it('winds up, then lands a blow, then pauses before the next one', () => {
    const def = CREATURES.slime;
    const hero = { x: 21.2, y: 20.5 };
    let c = at('slime', 20.5, 20.5);
    const events: string[] = [];
    const rng = new Rng(9);
    for (let t = 0; t < 4; t += 0.05) {
      const r = stepCreature(c, ctx(hero, { rng }));
      if (r.strike) events.push('STRIKE');
      if (r.creature.state !== c.state) events.push(r.creature.state);
      c = r.creature;
    }
    expect(events.slice(0, 3)).toEqual(['windup', 'STRIKE', 'recover']);
    const strikes = events.filter((e) => e === 'STRIKE').length;
    expect(strikes).toBeGreaterThanOrEqual(2);
    expect(strikes).toBeLessThanOrEqual(Math.ceil(4 / (def.windup + def.cooldown)));
  });

  it('does not hit a hero who steps out of reach during the warning', () => {
    let c = at('slime', 20.5, 20.5, { state: 'windup', timer: 0.2 });
    c = { ...c, facing: 'right' };
    const r = run(c, { x: 24, y: 20.5 }, 0.3);
    expect(r.strikes).toBe(0);
    expect(r.c.state).toBe('recover');
  });

  it('stops hunting a hero who has collapsed, and never strikes him', () => {
    const r = run(at('skeleton', 20.5, 20.5, { state: 'windup', timer: 0.05 }), { x: 21, y: 20.5 }, 1, { heroAlive: false });
    expect(r.strikes).toBe(0);
    expect(r.trail.at(-1)!.state === 'idle' || r.trail.at(-1)!.state === 'wander').toBe(true);
  });

  it('slides around an obstacle instead of freezing', () => {
    const solids = new Set([idx(22, 20)]);
    const { c } = run(at('slime', 21.4, 20.5), { x: 25.5, y: 20.5 }, 6, { solids });
    expect(c.x).toBeGreaterThan(22.9);
  });
});

describe('animals', () => {
  it('a rabbit runs away from a hero who comes close, and settles once he is far', () => {
    const start = at('rabbit', 20.5, 20.5);
    const { trail } = run(start, { x: 18.5, y: 20.5 }, 2);
    const last = trail.at(-1)!;
    expect(last.x).toBeGreaterThan(22);
    expect(trail.some((c) => c.state === 'flee')).toBe(true);
    const calm = run({ ...last, state: 'flee' }, { x: 5, y: 20.5 }, 3).c;
    expect(calm.state === 'idle' || calm.state === 'wander').toBe(true);
  });

  it('a rabbit pinned against deep water slides along it instead of standing still', () => {
    const { c } = run(at('rabbit', 29.3, 20.5), { x: 27.5, y: 20.5 }, 1.2);
    expect(c.x).toBeLessThan(30);
    expect(Math.abs(c.y - 20.5)).toBeGreaterThan(0.5);
  });

  it('a boar ignores the hero until it is hurt, then goes for him', () => {
    const calm = run(at('boar', 20.5, 20.5), { x: 23, y: 20.5 }, 1);
    expect(calm.trail.every((c) => c.state !== 'chase' && c.state !== 'windup')).toBe(true);
    expect(calm.strikes).toBe(0);
    const hurt = hurtCreature(at('boar', 20.5, 20.5), 2, { x: 0, y: 0 }).creature;
    const angry = run({ ...hurt, stun: 0 }, { x: 23, y: 20.5 }, 3);
    expect(angry.trail.some((c) => c.state === 'chase')).toBe(true);
    expect(angry.strikes).toBeGreaterThan(0);
  });

  it('an angry boar calms down when the hero gets far away', () => {
    const angry = at('boar', 20.5, 20.5, { angry: true, state: 'chase' });
    const { c } = run(angry, { x: 20.5, y: 20.5 + CREATURES.boar.sight * 2.5 }, 0.2);
    expect(c.angry).toBe(false);
  });
});

describe('hurtCreature', () => {
  it('takes hit points, reports death at zero, and never goes below zero', () => {
    const c = at('slime', 20.5, 20.5);
    expect(hurtCreature(c, 3, { x: 0, y: 0 })).toMatchObject({ dead: false, creature: { hp: CREATURES.slime.hp - 3 } });
    expect(hurtCreature(c, 99, { x: 0, y: 0 })).toMatchObject({ dead: true, creature: { hp: 0 } });
  });

  it('staggers it, makes it angry, interrupts a wind-up and starts the hunt', () => {
    const winding = at('slime', 20.5, 20.5, { state: 'windup', timer: 0.2 });
    const hit = hurtCreature(winding, 1, { x: 0.3, y: 0 }).creature;
    expect(hit.stun).toBeGreaterThan(0);
    expect(hit.angry).toBe(true);
    expect(hit.state).toBe('recover');
    const idle = hurtCreature(at('slime', 20.5, 20.5), 1, { x: 0, y: 0 }).creature;
    expect(idle.state).toBe('chase');
  });

  it('pushes it back, stopped by walls, and does nothing else while staggered', () => {
    const hit = hurtCreature(at('slime', 28.5, 20.5), 1, { x: 1.5, y: 0 }).creature;
    const r = run(hit, { x: 100, y: 100 }, 0.2);
    expect(r.c.x).toBeGreaterThan(28.5);
    expect(r.c.x).toBeLessThan(30);
    const back = hurtCreature(at('slime', 20.5, 20.5), 1, { x: -1, y: 0 }).creature;
    const b = run(back, { x: 25, y: 20.5 }, 0.15);
    expect(b.c.x).toBeLessThan(20);
    expect(b.strikes).toBe(0);
  });
});

describe('determinism', () => {
  it('replays the same way from the same random stream', () => {
    const a = run(at('wasp', 20.5, 20.5), { x: 60, y: 60 }, 8).c;
    const b = run(at('wasp', 20.5, 20.5), { x: 60, y: 60 }, 8).c;
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/movement.test.ts tests/creatures.test.ts`
Expected: FAIL. The new movement test fails with "expected 7.7 to be close to 7.75" (the extra argument is ignored); `creatures.test.ts` cannot resolve `@/sim/creatures`.

- [ ] **Step 3: Write the code**

`moveWithCollision` gets an optional body size, so creatures use their own collision box:

`src/sim/movement.ts`:

```typescript
import { T, idx, inBounds, type World } from '@/sim/world/types';

/** Positions are in tile units: tile (n, m) covers [n, n+1) x [m, m+1). */
export interface Vec {
  x: number;
  y: number;
}

/** Half the player's collision box, in tiles. */
export const PLAYER_HALF = 0.28;
/** Walking speed multiplier while wading through shallow water or a river. */
export const WADE_SPEED = 0.6;

export function tileBlocked(world: World, solids: ReadonlySet<number>, tx: number, ty: number): boolean {
  if (!inBounds(tx, ty, world.size)) return true;
  const i = idx(tx, ty, world.size);
  return world.terrain[i] === T.DEEP || solids.has(i);
}

function boxBlocked(world: World, solids: ReadonlySet<number>, x: number, y: number, half: number): boolean {
  const x0 = Math.floor(x - half);
  const x1 = Math.floor(x + half);
  const y0 = Math.floor(y - half);
  const y1 = Math.floor(y + half);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (tileBlocked(world, solids, tx, ty)) return true;
    }
  }
  return false;
}

/**
 * Move by (dx, dy), one axis at a time, so the body slides along walls instead of sticking to them.
 * `half` is half the width of the body in tiles (the hero by default; creatures pass their own).
 */
export function moveWithCollision(
  world: World, solids: ReadonlySet<number>, pos: Vec, dx: number, dy: number, half = PLAYER_HALF,
): Vec {
  let { x, y } = pos;
  // Already inside something solid (it should not happen, but a stuck player must always be able to walk out).
  if (boxBlocked(world, solids, x, y, half)) {
    const max = world.size - 0.01;
    return { x: Math.min(max, Math.max(0.01, x + dx)), y: Math.min(max, Math.max(0.01, y + dy)) };
  }
  if (dx !== 0 && !boxBlocked(world, solids, x + dx, y, half)) x += dx;
  if (dy !== 0 && !boxBlocked(world, solids, x, y + dy, half)) y += dy;
  return { x, y };
}

export function speedFactor(world: World, x: number, y: number): number {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (!inBounds(tx, ty, world.size)) return 1;
  const t = world.terrain[idx(tx, ty, world.size)];
  return t === T.SHALLOW || t === T.RIVER ? WADE_SPEED : 1;
}
```

Creature behaviour. Hunters walk straight at the hero and, when blocked, commit to a 0.9 s detour along the freer side (a plain "turn a bit" rule oscillated in front of a single tree); fleeing animals try headings further and further from straight; a hit staggers a creature, sets it off and pushes it back:

`src/sim/creatures.ts`:

```typescript
import type { Rng } from '@/core/rng';
import { CREATURES, type CreatureDef, type CreatureId } from '@/data/creatures';
import type { Facing } from '@/sim/actions';
import { facingFromVector } from '@/sim/combat';
import { PLAYER_HALF, moveWithCollision, speedFactor, type Vec } from '@/sim/movement';
import type { World } from '@/sim/world/types';

export type CreatureState = 'idle' | 'wander' | 'chase' | 'windup' | 'recover' | 'flee';

/** One monster or animal in the world. Immutable: every step returns a new value. */
export interface Creature {
  readonly id: number;
  readonly kind: CreatureId;
  readonly x: number;
  readonly y: number;
  readonly hp: number;
  readonly facing: Facing;
  readonly state: CreatureState;
  /** Seconds left in the current state (idle, wander, wind-up, recovery). */
  readonly timer: number;
  /** Heading while wandering (unit vector). */
  readonly headX: number;
  readonly headY: number;
  /** Hurt at some point: animals that fight back do so, and every animal runs longer. */
  readonly angry: boolean;
  /** Knockback still to be travelled, in tiles. */
  readonly pushX: number;
  readonly pushY: number;
  /** Seconds of stagger after a hit, during which it cannot act. */
  readonly stun: number;
}

export interface StepContext {
  world: World;
  solids: ReadonlySet<number>;
  hero: Vec;
  /** A collapsed hero is left alone. */
  heroAlive: boolean;
  rng: Rng;
  dt: number;
}

export interface StepResult {
  creature: Creature;
  /** The blow lands on the hero in this step. */
  strike: boolean;
}

/** Fraction of its speed a creature strolls at. */
const STROLL = 0.4;
/** A hunter keeps following until the hero is this many sights away. */
const GIVE_UP = 1.6;
/** Fleeing animals keep running until the hero is this many sights away. */
const SAFE = 1.6;
/** Seconds a hunter walks sideways around an obstacle before heading for the hero again. */
const DETOUR = 0.9;
/** Extra reach granted to a blow that was already winding up when the hero shuffled a little. */
const STRIKE_SLACK = 0.15;
/** How fast knockback is spent (per second) and how long a hit staggers. */
const PUSH_RATE = 14;
export const HURT_STUN = 0.25;

export function newCreature(id: number, kind: CreatureId, x: number, y: number, rng: Rng): Creature {
  return {
    id, kind, x, y, hp: CREATURES[kind].hp, facing: 'down', state: 'idle', timer: rng.float(0.5, 3),
    headX: 0, headY: 0, angry: false, pushX: 0, pushY: 0, stun: 0,
  };
}

export interface HurtResult {
  creature: Creature;
  dead: boolean;
}

/** Take `amount` hit points and a shove of `push` tiles. A hit interrupts a wind-up and sets off the hunt. */
export function hurtCreature(c: Creature, amount: number, push: Vec): HurtResult {
  const hp = Math.max(0, c.hp - amount);
  if (hp === 0) return { creature: { ...c, hp }, dead: true };
  const state: CreatureState = c.state === 'windup' ? 'recover' : c.state === 'idle' || c.state === 'wander' ? 'chase' : c.state;
  const timer = c.state === 'windup' ? CREATURES[c.kind].cooldown * 0.5 : c.timer;
  return { creature: { ...c, hp, angry: true, state, timer, stun: HURT_STUN, pushX: push.x, pushY: push.y }, dead: false };
}

const heroDistance = (c: Creature, hero: Vec): number => Math.hypot(hero.x - c.x, hero.y - c.y);

/** Walk `step` tiles toward the unit vector (ux, uy); returns the creature moved, with its facing. */
function walk(c: Creature, def: CreatureDef, ctx: StepContext, ux: number, uy: number, step: number): Creature {
  const moved = moveWithCollision(ctx.world, ctx.solids, c, ux * step, uy * step, def.radius);
  return { ...c, x: moved.x, y: moved.y, facing: facingFromVector(ux, uy, c.facing) };
}

function applyPush(c: Creature, def: CreatureDef, ctx: StepContext): Creature {
  if (c.pushX === 0 && c.pushY === 0) return c;
  const k = Math.min(1, PUSH_RATE * ctx.dt);
  const dx = c.pushX * k;
  const dy = c.pushY * k;
  const moved = moveWithCollision(ctx.world, ctx.solids, c, dx, dy, def.radius);
  const left = { x: c.pushX - dx, y: c.pushY - dy };
  const spent = Math.hypot(left.x, left.y) < 0.01;
  return { ...c, x: moved.x, y: moved.y, pushX: spent ? 0 : left.x, pushY: spent ? 0 : left.y };
}

/** Drop out of a hunt or a flight into idling; creatures already idling or strolling carry on as they were. */
function settle(c: Creature, rng: Rng): Creature {
  return c.state === 'idle' || c.state === 'wander' ? c : { ...c, state: 'idle', timer: rng.float(0.8, 2.5) };
}

function stroll(c: Creature, def: CreatureDef, ctx: StepContext): Creature {
  const timer = c.timer - ctx.dt;
  if (c.state === 'wander') {
    const step = def.speed * STROLL * speedFactor(ctx.world, c.x, c.y) * ctx.dt;
    const moved = walk(c, def, ctx, c.headX, c.headY, step);
    const blocked = Math.hypot(moved.x - c.x, moved.y - c.y) < step * 0.25;
    if (timer <= 0 || blocked) return { ...moved, state: 'idle', timer: ctx.rng.float(1, 3) };
    return { ...moved, timer };
  }
  if (c.state === 'idle' && timer > 0) return { ...c, timer };
  const angle = ctx.rng.float(0, Math.PI * 2);
  const hx = Math.cos(angle);
  const hy = Math.sin(angle);
  return { ...c, state: 'wander', timer: ctx.rng.float(1, 2.5), headX: hx, headY: hy, facing: facingFromVector(hx, hy, c.facing) };
}

/** Headings to try, in order, when the straight way is blocked: radians to turn away from the wanted direction. */
const TURNS = [0, 0.9, -0.9, 1.6, -1.6, 2.3, -2.3];

/** Move along the wanted direction, or the least-turned one that actually gets somewhere (walls, trees, water). */
function steer(c: Creature, def: CreatureDef, ctx: StepContext, ux: number, uy: number, step: number, turns: readonly number[]): Creature {
  let best = c;
  let bestMoved = -1;
  for (const turn of turns) {
    const vx = ux * Math.cos(turn) - uy * Math.sin(turn);
    const vy = ux * Math.sin(turn) + uy * Math.cos(turn);
    const tried = walk(c, def, ctx, vx, vy, step);
    const moved = Math.hypot(tried.x - c.x, tried.y - c.y);
    if (moved > bestMoved) {
      best = tried;
      bestMoved = moved;
    }
    if (moved >= step * 0.7) break;
  }
  return best;
}

/** Hunting: close in, wind up, strike, recover. Used by monsters and by angry boars. */
function hunt(c: Creature, def: CreatureDef, ctx: StepContext): StepResult {
  const dist = heroDistance(c, ctx.hero);
  const face = facingFromVector(ctx.hero.x - c.x, ctx.hero.y - c.y, c.facing);
  if (c.state === 'windup') {
    const timer = c.timer - ctx.dt;
    if (timer > 0) return { creature: { ...c, timer, facing: face }, strike: false };
    const hit = dist <= def.reach + def.radius + PLAYER_HALF + STRIKE_SLACK;
    return { creature: { ...c, state: 'recover', timer: def.cooldown, facing: face }, strike: hit };
  }
  if (c.state === 'recover') {
    const timer = c.timer - ctx.dt;
    return { creature: timer > 0 ? { ...c, timer } : { ...c, state: 'chase', timer: 0 }, strike: false };
  }
  const sees = c.state === 'chase' ? def.sight * GIVE_UP : def.sight;
  if (dist > sees && !c.angry) return { creature: stroll(settle(c, ctx.rng), def, ctx), strike: false };
  if (dist > def.sight * 2) return { creature: stroll(settle({ ...c, angry: false }, ctx.rng), def, ctx), strike: false };
  if (dist <= def.reach + def.radius + PLAYER_HALF) {
    return { creature: { ...c, state: 'windup', timer: def.windup, facing: face }, strike: false };
  }
  const step = def.speed * speedFactor(ctx.world, c.x, c.y) * ctx.dt;
  if (c.state === 'chase' && c.timer > 0) {
    const around = walk(c, def, ctx, c.headX, c.headY, step);
    return { creature: { ...around, timer: c.timer - ctx.dt }, strike: false };
  }
  return { creature: pursue(c, def, ctx, (ctx.hero.x - c.x) / dist, (ctx.hero.y - c.y) / dist, step), strike: false };
}

/** A straight line to the hero, or, when something is in the way, a committed detour along the freer side. */
function pursue(c: Creature, def: CreatureDef, ctx: StepContext, ux: number, uy: number, step: number): Creature {
  const direct = walk(c, def, ctx, ux, uy, step);
  if (Math.hypot(direct.x - c.x, direct.y - c.y) >= step * 0.5) return { ...direct, state: 'chase', timer: 0, headX: 0, headY: 0 };
  const left = walk(c, def, ctx, -uy, ux, step);
  const right = walk(c, def, ctx, uy, -ux, step);
  const goLeft = Math.hypot(left.x - c.x, left.y - c.y) >= Math.hypot(right.x - c.x, right.y - c.y);
  const side = goLeft ? left : right;
  return { ...side, state: 'chase', timer: DETOUR, headX: goLeft ? -uy : uy, headY: goLeft ? ux : -ux };
}

function flee(c: Creature, def: CreatureDef, ctx: StepContext): Creature {
  const dist = heroDistance(c, ctx.hero);
  const reach = def.sight * (c.state === 'flee' ? SAFE : 1);
  if (dist > reach) return stroll(settle(c, ctx.rng), def, ctx);
  const ax = dist < 1e-6 ? 1 : (c.x - ctx.hero.x) / dist;
  const ay = dist < 1e-6 ? 0 : (c.y - ctx.hero.y) / dist;
  const step = def.speed * speedFactor(ctx.world, c.x, c.y) * ctx.dt;
  const best = steer(c, def, ctx, ax, ay, step, TURNS);
  return { ...best, state: 'flee' };
}

/** Advance one creature by `ctx.dt` seconds. Pure: the same inputs and random stream give the same result. */
export function stepCreature(c: Creature, ctx: StepContext): StepResult {
  const def = CREATURES[c.kind];
  const pushed = applyPush(c, def, ctx);
  if (pushed.stun > 0) return { creature: { ...pushed, stun: Math.max(0, pushed.stun - ctx.dt) }, strike: false };
  if (def.temper === 'flee') return { creature: ctx.heroAlive ? flee(pushed, def, ctx) : stroll(settle(pushed, ctx.rng), def, ctx), strike: false };
  const hunting = def.temper === 'chase' || pushed.angry;
  if (hunting && ctx.heroAlive) return hunt(pushed, def, ctx);
  const calm = pushed.angry ? { ...pushed, angry: false } : pushed;
  return { creature: stroll(settle(calm, ctx.rng), def, ctx), strike: false };
}
```

- [ ] **Step 4: Run the tests and the typecheck**

Run: `npx vitest run tests/movement.test.ts tests/creatures.test.ts && npm run typecheck && npm test`
Expected: movement 10, creatures 18 tests PASS; typecheck exits 0; whole suite passes (303 tests).

- [ ] **Step 5: Commit**

```bash
git add src/sim/movement.ts src/sim/creatures.ts tests/movement.test.ts tests/creatures.test.ts
git commit -m "feat: add creature behaviour (stroll, hunt, flee, hurt) with their own collision boxes"
```

---

### Task 5: Spawner and loose items

**Files:**
- Create: `src/sim/spawner.ts`, `src/sim/pickups.ts`
- Test: `tests/spawner.test.ts`, `tests/pickups.test.ts` (new)

**Interfaces:**
- Consumes: `CREATURES`, `isHostileKind`, `spawnWeights` (Task 2), `newCreature`, `Creature` (Task 4), `STRUCTURES`, `Structures`, `addItem`, `Inventory`, `Vec`, `World`, `Rng`.
- Produces: `SPAWN_MIN = 12`, `SPAWN_MAX = 18`, `DESPAWN_RADIUS = 30`, `SPAWN_INTERVAL = 1.5`, `START_SAFE_RADIUS = 10`, `capsFor(night) -> {hostile, animals}`, `SpawnContext`, `hostileSpotOk(world, structures, x, y)`, `trySpawn(ctx) -> Creature | null`, `cull(creatures, hero, night)`; `Pickup {id, item, qty, x, y, age}`, `Stack {item, qty}`, `PICKUP_LIFETIME = 120`, `PICKUP_RADIUS = 0.9`, `MAGNET_RADIUS = 2.2`, `rollLoot(kind, rng) -> Stack[]`, `scatter(stacks, at, nextId, rng) -> Pickup[]`, `collect(inv, pickups, hero) -> {inv, pickups, taken, full}` (what does not fit stays on the ground), `ageOut`, `drift`.

- [ ] **Step 1: Write the failing tests**

`tests/spawner.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/rng';
import { CREATURES, isHostileKind } from '@/data/creatures';
import { newCreature, type Creature } from '@/sim/creatures';
import {
  DESPAWN_RADIUS, SPAWN_MAX, SPAWN_MIN, START_SAFE_RADIUS, capsFor, cull, hostileSpotOk, trySpawn, type SpawnContext,
} from '@/sim/spawner';
import { emptyStructures, placeStructure } from '@/sim/structures';
import { B, T, WORLD_SIZE, idx, type Biome, type World } from '@/sim/world/types';

function makeWorld(biome: Biome = B.FOREST, start = { x: 5, y: 5 }): World {
  const size = WORLD_SIZE;
  const terrain = new Uint8Array(size * size).fill(T.GRASS);
  return { seed: 0, size, terrain, biome: new Uint8Array(size * size).fill(biome), landmarks: [], resources: [], start };
}

const hero = { x: 80.5, y: 80.5 };
const ctx = (over: Partial<SpawnContext> = {}): SpawnContext => ({
  world: makeWorld(), solids: new Set(), structures: emptyStructures(), hero, night: false, creatures: [], nextId: 1, rng: new Rng(5), ...over,
});
const kinds = (list: readonly Creature[]) => list.map((c) => c.kind);
const many = (n: number, kind: Creature['kind'], base = 0): Creature[] =>
  Array.from({ length: n }, (_, i) => newCreature(base + i, kind, 70 + i, 70, new Rng(i)));

describe('capsFor', () => {
  it('allows more monsters and fewer animals at night', () => {
    expect(capsFor(true).hostile).toBeGreaterThan(capsFor(false).hostile);
    expect(capsFor(true).animals).toBeLessThan(capsFor(false).animals);
  });
});

describe('trySpawn', () => {
  it('puts a creature on land in the ring around the hero, out of sight and not too far', () => {
    let spawned = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const c = trySpawn(ctx({ rng: new Rng(seed), nextId: 7 }));
      if (!c) continue;
      spawned++;
      const d = Math.hypot(c.x - hero.x, c.y - hero.y);
      expect(d).toBeGreaterThanOrEqual(SPAWN_MIN - 0.01);
      expect(d).toBeLessThanOrEqual(SPAWN_MAX + 0.01);
      expect(c.id).toBe(7);
      expect(c.hp).toBe(CREATURES[c.kind].hp);
    }
    expect(spawned).toBeGreaterThan(30);
  });

  it('only picks creatures that belong to the biome and the time of day', () => {
    const forestDay = new Set<string>();
    const mountainNight = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const a = trySpawn(ctx({ rng: new Rng(seed) }));
      if (a) forestDay.add(a.kind);
      const b = trySpawn(ctx({ rng: new Rng(seed), world: makeWorld(B.MOUNTAIN), night: true }));
      if (b) mountainNight.add(b.kind);
    }
    expect([...forestDay].sort()).toEqual(['bird', 'boar', 'fox', 'mushroom', 'rabbit', 'slime', 'wasp']);
    expect([...mountainNight].sort()).toEqual(['fox', 'skeleton', 'zombie']);
  });

  it('never spawns on water, deep or shallow, rivers, or a solid tile', () => {
    const world = makeWorld();
    for (let y = 0; y < WORLD_SIZE; y++) {
      for (let x = 0; x < WORLD_SIZE; x++) {
        const dx = x - 80;
        if (dx > 5) world.terrain[idx(x, y)] = T.SHALLOW;
        else if (dx < -5) world.terrain[idx(x, y)] = T.RIVER;
        else if (y > 85) world.terrain[idx(x, y)] = T.DEEP;
      }
    }
    const solids = new Set<number>();
    for (let x = 70; x < 90; x++) solids.add(idx(x, 70));
    for (let seed = 1; seed <= 200; seed++) {
      const c = trySpawn(ctx({ world, solids, rng: new Rng(seed) }));
      if (!c) continue;
      const tile = idx(Math.floor(c.x), Math.floor(c.y));
      expect(world.terrain[tile]).toBe(T.GRASS);
      expect(solids.has(tile)).toBe(false);
    }
  });

  it('spawns nothing on an island with no land in the ring, and nothing in the sea biome', () => {
    const sea = makeWorld();
    sea.terrain.fill(T.DEEP);
    expect(trySpawn(ctx({ world: sea }))).toBeNull();
    expect(trySpawn(ctx({ world: makeWorld(B.SEA) }))).toBeNull();
  });

  it('stops at the cap for monsters, and at the cap for animals, independently', () => {
    const hostileDay = capsFor(false).hostile;
    const animalDay = capsFor(false).animals;
    const full = [...many(hostileDay, 'slime'), ...many(animalDay, 'rabbit', 100)];
    for (let seed = 1; seed <= 30; seed++) expect(trySpawn(ctx({ creatures: full, rng: new Rng(seed) }))).toBeNull();
    const noMonsters = many(animalDay, 'rabbit', 100);
    const picks = new Set<string>();
    for (let seed = 1; seed <= 100; seed++) {
      const c = trySpawn(ctx({ creatures: noMonsters, rng: new Rng(seed) }));
      if (c) picks.add(isHostileKind(c.kind) ? 'hostile' : 'animal');
    }
    expect([...picks]).toEqual(['hostile']);
  });

  it('keeps monsters away from the starting beach and out of the glow of a fire or torch', () => {
    const near = { x: 85, y: 85 };
    const fire = placeStructure(emptyStructures(), 'campfire', 85, 85);
    expect(hostileSpotOk(makeWorld(B.FOREST, near), emptyStructures(), 87, 87)).toBe(false);
    expect(hostileSpotOk(makeWorld(B.FOREST, near), emptyStructures(), 85 + START_SAFE_RADIUS + 2, 85)).toBe(true);
    expect(hostileSpotOk(makeWorld(), fire, 85 + 5, 85)).toBe(false);
    expect(hostileSpotOk(makeWorld(), fire, 85 + 8, 85)).toBe(true);
    const world = makeWorld(B.FOREST, hero);
    const seen = new Set<string>();
    for (let seed = 1; seed <= 100; seed++) {
      const c = trySpawn(ctx({ world, rng: new Rng(seed) }));
      if (c) seen.add(isHostileKind(c.kind) ? 'hostile' : 'animal');
    }
    expect(seen.has('hostile')).toBe(true);
  });

  it('does not stack a new creature on one that is already there', () => {
    const existing = Array.from({ length: 360 }, (_, i) => {
      const a = (i / 360) * Math.PI * 2;
      return newCreature(i, 'rabbit', hero.x + Math.cos(a) * 15, hero.y + Math.sin(a) * 15, new Rng(i));
    }).slice(0, capsFor(false).animals);
    for (let seed = 1; seed <= 50; seed++) {
      const c = trySpawn(ctx({ creatures: existing, rng: new Rng(seed) }));
      if (c) for (const e of existing) expect(Math.hypot(c.x - e.x, c.y - e.y)).toBeGreaterThan(0.8);
    }
  });

  it('is deterministic for the same random stream', () => {
    expect(trySpawn(ctx({ rng: new Rng(11) }))).toEqual(trySpawn(ctx({ rng: new Rng(11) })));
  });
});

describe('cull', () => {
  const at = (kind: Creature['kind'], dx: number, dy = 0) => newCreature(1, kind, hero.x + dx, hero.y + dy, new Rng(1));

  it('removes creatures that are far from the hero and keeps the near ones', () => {
    const list = [at('rabbit', 3), at('rabbit', DESPAWN_RADIUS + 1), at('slime', 0, -(DESPAWN_RADIUS + 5))];
    expect(kinds(cull(list, hero, false))).toEqual(['rabbit']);
  });

  it('lets the creatures of the night fade at dawn unless the hero is close to them', () => {
    const list = [at('skeleton', SPAWN_MIN + 3), at('skeleton', 3), at('slime', SPAWN_MIN + 3)];
    expect(kinds(cull(list, hero, true))).toEqual(['skeleton', 'skeleton', 'slime']);
    expect(kinds(cull(list, hero, false))).toEqual(['skeleton', 'slime']);
  });
});
```

`tests/pickups.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/rng';
import { addItem, countItem, emptyInventory } from '@/sim/inventory';
import {
  MAGNET_RADIUS, PICKUP_LIFETIME, PICKUP_RADIUS, ageOut, collect, drift, rollLoot, scatter, type Pickup,
} from '@/sim/pickups';

const hero = { x: 10.5, y: 10.5 };
const pickup = (over: Partial<Pickup> = {}): Pickup => ({ id: 1, item: 'raw_meat', qty: 2, x: 10.5, y: 10.8, age: 0, ...over });

describe('rollLoot', () => {
  it('gives a boar its meat every time and its bone only now and then', () => {
    let bones = 0;
    for (let i = 0; i < 400; i++) {
      const loot = rollLoot('boar', new Rng(i));
      const meat = loot.find((l) => l.item === 'raw_meat')!;
      expect(meat.qty).toBeGreaterThanOrEqual(2);
      expect(meat.qty).toBeLessThanOrEqual(3);
      if (loot.some((l) => l.item === 'bone')) bones++;
    }
    expect(bones).toBeGreaterThan(110);
    expect(bones).toBeLessThan(210);
  });

  it('never returns an empty stack', () => {
    for (let i = 0; i < 200; i++) for (const l of rollLoot('ghost', new Rng(i))) expect(l.qty).toBeGreaterThan(0);
  });

  it('is repeatable for the same random stream', () => {
    expect(rollLoot('skeleton_warrior', new Rng(3))).toEqual(rollLoot('skeleton_warrior', new Rng(3)));
  });
});

describe('scatter', () => {
  it('drops each stack near the spot, with its own id, spread apart', () => {
    const out = scatter([{ item: 'bone', qty: 2 }, { item: 'gel', qty: 1 }, { item: 'raw_meat', qty: 3 }], { x: 5, y: 5 }, 40, new Rng(2));
    expect(out.map((p) => p.id)).toEqual([40, 41, 42]);
    for (const p of out) {
      expect(Math.hypot(p.x - 5, p.y - 5)).toBeLessThanOrEqual(0.7);
      expect(p.age).toBe(0);
    }
    expect(new Set(out.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)).size).toBe(3);
  });
});

describe('collect', () => {
  it('puts what is within reach into the backpack and leaves the rest', () => {
    const near = pickup();
    const far = pickup({ id: 2, item: 'bone', x: 10.5 + PICKUP_RADIUS + 1, y: 10.5 });
    const r = collect(emptyInventory(), [near, far], hero);
    expect(countItem(r.inv, 'raw_meat')).toBe(2);
    expect(r.taken).toEqual([{ item: 'raw_meat', qty: 2 }]);
    expect(r.pickups).toEqual([far]);
    expect(r.full).toBe(false);
  });

  it('keeps what does not fit lying on the ground and says the backpack is full', () => {
    let inv = emptyInventory(1);
    inv = addItem(inv, 'raw_meat', 19).inv;
    const r = collect(inv, [pickup({ qty: 5 })], hero);
    expect(countItem(r.inv, 'raw_meat')).toBe(20);
    expect(r.pickups).toEqual([pickup({ qty: 4 })]);
    expect(r.taken).toEqual([{ item: 'raw_meat', qty: 1 }]);
    expect(r.full).toBe(true);
  });

  it('never loses anything when the backpack is completely full', () => {
    let inv = emptyInventory(1);
    inv = addItem(inv, 'wood', 99).inv;
    const r = collect(inv, [pickup()], hero);
    expect(r.inv).toEqual(inv);
    expect(r.pickups).toEqual([pickup()]);
    expect(r.taken).toEqual([]);
    expect(r.full).toBe(true);
  });
});

describe('ageOut', () => {
  it('ages items and removes them after two minutes', () => {
    const [a] = ageOut([pickup()], 10);
    expect(a.age).toBe(10);
    expect(ageOut([pickup({ age: PICKUP_LIFETIME - 1 })], 0.5)).toHaveLength(1);
    expect(ageOut([pickup({ age: PICKUP_LIFETIME - 1 })], 1.5)).toEqual([]);
  });
});

describe('drift', () => {
  it('pulls items that are close toward the hero, and leaves distant ones alone', () => {
    const close = pickup({ x: 10.5 + MAGNET_RADIUS - 0.2, y: 10.5 });
    const far = pickup({ id: 2, x: 10.5 + MAGNET_RADIUS + 3, y: 10.5 });
    const [c, f] = drift([close, far], hero, 0.1);
    expect(c.x).toBeLessThan(close.x);
    expect(c.y).toBeCloseTo(10.5);
    expect(f).toEqual(far);
  });

  it('never overshoots the hero', () => {
    const [p] = drift([pickup({ x: 10.6, y: 10.5 })], hero, 5);
    expect(p.x).toBeCloseTo(10.5);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/spawner.test.ts tests/pickups.test.ts`
Expected: FAIL, "Failed to resolve import "@/sim/spawner"" (and `@/sim/pickups`).

- [ ] **Step 3: Write the modules**

`src/sim/spawner.ts`:

```typescript
import type { Rng } from '@/core/rng';
import { CREATURES, isHostileKind, spawnWeights } from '@/data/creatures';
import { STRUCTURES } from '@/data/structures';
import { newCreature, type Creature } from '@/sim/creatures';
import type { Vec } from '@/sim/movement';
import type { Structures } from '@/sim/structures';
import { T, idx, inBounds, type Biome, type World } from '@/sim/world/types';

/** New creatures appear this far from the hero (tiles): beyond the edge of a portrait screen, but not far away. */
export const SPAWN_MIN = 12;
export const SPAWN_MAX = 18;
/** Creatures farther than this from the hero are removed. */
export const DESPAWN_RADIUS = 30;
/** Seconds between attempts to add a creature. */
export const SPAWN_INTERVAL = 1.5;
/** No monster appears within this many tiles of the shipwreck, and the glow of a fire adds a little extra. */
export const START_SAFE_RADIUS = 10;
const GLOW_MARGIN = 1.5;
const TRIES = 12;
const MIN_GAP = 0.8;

export interface Caps {
  hostile: number;
  animals: number;
}

export const capsFor = (night: boolean): Caps => (night ? { hostile: 9, animals: 3 } : { hostile: 4, animals: 8 });

export interface SpawnContext {
  world: World;
  solids: ReadonlySet<number>;
  structures: Structures;
  hero: Vec;
  night: boolean;
  creatures: readonly Creature[];
  nextId: number;
  rng: Rng;
}

const GROUND: ReadonlySet<number> = new Set([T.SAND, T.GRASS, T.SWAMP, T.DIRT, T.STONE, T.DESERT]);

/** Monsters keep away from the starting beach and from anything that gives light (campfires, torches, furnaces). */
export function hostileSpotOk(world: World, structures: Structures, x: number, y: number): boolean {
  if (Math.hypot(x + 0.5 - world.start.x, y + 0.5 - world.start.y) < START_SAFE_RADIUS) return false;
  return structures.list.every((s) => {
    const glow = STRUCTURES[s.type].light;
    return glow <= 0 || Math.hypot(x - s.x, y - s.y) > glow + GLOW_MARGIN;
  });
}

function spotFree(c: SpawnContext, x: number, y: number): boolean {
  if (!inBounds(Math.floor(x), Math.floor(y), c.world.size)) return false;
  const tile = idx(Math.floor(x), Math.floor(y), c.world.size);
  if (!GROUND.has(c.world.terrain[tile]) || c.solids.has(tile)) return false;
  return c.creatures.every((o) => Math.hypot(o.x - x, o.y - y) > MIN_GAP);
}

/** Try to add one creature in the ring around the hero, or return null (nothing fits, or the caps are reached). */
export function trySpawn(c: SpawnContext): Creature | null {
  const caps = capsFor(c.night);
  const hostile = c.creatures.filter((o) => isHostileKind(o.kind)).length;
  const animals = c.creatures.length - hostile;
  for (let i = 0; i < TRIES; i++) {
    const angle = c.rng.float(0, Math.PI * 2);
    const radius = c.rng.float(SPAWN_MIN, SPAWN_MAX);
    const x = c.hero.x + Math.cos(angle) * radius;
    const y = c.hero.y + Math.sin(angle) * radius;
    if (!spotFree(c, x, y)) continue;
    const biome = c.world.biome[idx(Math.floor(x), Math.floor(y), c.world.size)] as Biome;
    const roster = spawnWeights(biome, c.night).filter(([id]) => (isHostileKind(id) ? hostile < caps.hostile : animals < caps.animals));
    if (roster.length === 0) continue;
    const kind = c.rng.weighted(roster);
    if (isHostileKind(kind) && !hostileSpotOk(c.world, c.structures, Math.floor(x), Math.floor(y))) continue;
    return newCreature(c.nextId, kind, x, y, c.rng);
  }
  return null;
}

/** Drop creatures that are far away, and let the night's creatures fade at dawn once they are out of the hero's sight. */
export function cull(creatures: readonly Creature[], hero: Vec, night: boolean): Creature[] {
  return creatures.filter((c) => {
    const d = Math.hypot(c.x - hero.x, c.y - hero.y);
    if (d > DESPAWN_RADIUS) return false;
    return night || CREATURES[c.kind].spawn.when !== 'night' || d <= SPAWN_MIN;
  });
}
```

`src/sim/pickups.ts`:

```typescript
import type { Rng } from '@/core/rng';
import { CREATURES, type CreatureId } from '@/data/creatures';
import type { ItemId } from '@/data/items';
import { addItem, type Inventory } from '@/sim/inventory';
import type { Vec } from '@/sim/movement';

/** An item lying on the ground. Not saved: it fades after PICKUP_LIFETIME seconds. */
export interface Pickup {
  readonly id: number;
  readonly item: ItemId;
  readonly qty: number;
  readonly x: number;
  readonly y: number;
  readonly age: number;
}

export interface Stack {
  item: ItemId;
  qty: number;
}

/** Seconds an item stays on the ground, how close the hero must be to take it, and where it starts to drift toward him. */
export const PICKUP_LIFETIME = 120;
export const PICKUP_RADIUS = 0.9;
export const MAGNET_RADIUS = 2.2;
const MAGNET_SPEED = 5;
const SPREAD = 0.6;

/** What a creature leaves behind, rolled from its drop table. */
export function rollLoot(kind: CreatureId, rng: Rng): Stack[] {
  return CREATURES[kind].drops
    .filter((d) => d.chance === undefined || rng.chance(d.chance))
    .map((d) => ({ item: d.item, qty: rng.int(d.min, d.max) }))
    .filter((s) => s.qty > 0);
}

/** Lay stacks on the ground around a spot, numbering them from `nextId`. */
export function scatter(stacks: readonly Stack[], at: Vec, nextId: number, rng: Rng): Pickup[] {
  return stacks.map((s, i) => {
    const angle = rng.float(0, Math.PI * 2) + i * 2.1;
    const r = rng.float(0.25, SPREAD);
    return { id: nextId + i, item: s.item, qty: s.qty, x: at.x + Math.cos(angle) * r, y: at.y + Math.sin(angle) * r, age: 0 };
  });
}

export interface Collected {
  inv: Inventory;
  pickups: Pickup[];
  taken: Stack[];
  /** Something within reach did not fit. */
  full: boolean;
}

/** The hero takes what lies within reach. What does not fit stays on the ground; nothing is ever thrown away. */
export function collect(inv: Inventory, pickups: readonly Pickup[], hero: Vec): Collected {
  let cur = inv;
  let full = false;
  const taken: Stack[] = [];
  const left: Pickup[] = [];
  for (const p of pickups) {
    if (Math.hypot(p.x - hero.x, p.y - hero.y) > PICKUP_RADIUS) {
      left.push(p);
      continue;
    }
    const r = addItem(cur, p.item, p.qty);
    cur = r.inv;
    if (p.qty - r.left > 0) taken.push({ item: p.item, qty: p.qty - r.left });
    if (r.left > 0) {
      full = true;
      left.push({ ...p, qty: r.left });
    }
  }
  return { inv: cur, pickups: left, taken, full };
}

export function ageOut(pickups: readonly Pickup[], dt: number): Pickup[] {
  return pickups.map((p) => ({ ...p, age: p.age + dt })).filter((p) => p.age < PICKUP_LIFETIME);
}

/** Items close to the hero slide toward him so nothing has to be picked up pixel by pixel. */
export function drift(pickups: readonly Pickup[], hero: Vec, dt: number): Pickup[] {
  return pickups.map((p) => {
    const d = Math.hypot(hero.x - p.x, hero.y - p.y);
    if (d > MAGNET_RADIUS || d < 1e-6) return p;
    const step = Math.min(d, MAGNET_SPEED * dt);
    return { ...p, x: p.x + ((hero.x - p.x) / d) * step, y: p.y + ((hero.y - p.y) / d) * step };
  });
}
```

- [ ] **Step 4: Run the tests and the typecheck**

Run: `npx vitest run tests/spawner.test.ts tests/pickups.test.ts && npm run typecheck`
Expected: spawner 11, pickups 10 tests PASS; typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/sim/spawner.ts src/sim/pickups.ts tests/spawner.test.ts tests/pickups.test.ts
git commit -m "feat: add the creature spawner and loose-item pickups"
```

---

### Task 6: Encounters and night detection

**Files:**
- Create: `src/sim/encounters.ts`
- Replace: `src/sim/daynight.ts`, `tests/daynight.test.ts`
- Test: `tests/encounters.test.ts` (new)

**Interfaces:**
- Consumes: Tasks 2 to 5, `WeaponStats` (Task 1), `Difficulty`, `Structures`, `World`, `tileBlocked`, `moveWithCollision`.
- Produces: `isNight(clock)` (dusk or night; `canSleep` is now the same function); `Arrow {id, x, y, dx, dy, left, damage, knockback}`, `Encounters {creatures, pickups, arrows, nextId, spawnTimer}`, `EncounterEvent` (`hurtHero {amount, from, kind}`, `hit {id, kind, amount, x, y}`, `killed {id, kind, x, y}`), `EncounterStep {e, events}`, `TickContext {world, solids, structures, hero, heroAlive, night, difficulty, defense, rng}`, `ARROW_SPEED = 9`, `emptyEncounters()`, `swing(e, hero, facing, stats, rng)`, `shoot(e, hero, facing, stats) -> Encounters`, `tickEncounters(e, ctx, dt)`, `takePickups(e, inv, hero) -> {e, inv, taken, full}`, `creatureInReach(e, hero, facing, reach, arc) -> boolean`, `hostilesNear(e, hero, radius) -> number`.

- [ ] **Step 1: Write the failing tests**

Replace `tests/daynight.test.ts` (adds the `isNight` rule):

`tests/daynight.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { DAY_SECONDS, NIGHT_DARKNESS, advance, canSleep, clockLabel, darkness, isNight, lighting, newClock, phaseOf, wakeUp, type Clock } from '@/sim/daynight';

const at = (f: number, day = 1): Clock => ({ day, t: f * DAY_SECONDS });

describe('daynight', () => {
  it('starts on day 1 in the morning', () => {
    const c = newClock();
    expect(c.day).toBe(1);
    expect(phaseOf(c)).toBe('day');
    expect(darkness(c)).toBe(0);
  });

  it('advances time without mutating the input', () => {
    const c = newClock();
    const next = advance(c, 30);
    expect(next.t).toBeCloseTo(c.t + 30);
    expect(c).toEqual(newClock());
  });

  it('rolls over to the next day, even across several days at once', () => {
    expect(advance(at(0.95), DAY_SECONDS * 0.1)).toEqual({ day: 2, t: expect.closeTo(DAY_SECONDS * 0.05, 5) });
    expect(advance({ day: 1, t: 0 }, DAY_SECONDS * 3 + 5)).toEqual({ day: 4, t: 5 });
  });

  it('ignores negative time steps', () => {
    expect(advance(at(0.3), -50)).toEqual(at(0.3));
  });

  it('reports the four phases at the right times', () => {
    expect(phaseOf(at(0.05))).toBe('dawn');
    expect(phaseOf(at(0.3))).toBe('day');
    expect(phaseOf(at(0.65))).toBe('dusk');
    expect(phaseOf(at(0.9))).toBe('night');
  });

  it('is dark at night, bright at noon and ramps smoothly in between', () => {
    expect(darkness(at(0.3))).toBe(0);
    expect(darkness(at(0.9))).toBe(NIGHT_DARKNESS);
    let prev = darkness(at(0.6));
    for (let f = 0.61; f <= 0.7; f += 0.01) {
      const d = darkness(at(f));
      expect(d).toBeGreaterThanOrEqual(prev);
      prev = d;
    }
    expect(darkness(at(0))).toBeCloseTo(NIGHT_DARKNESS);
    expect(darkness(at(0.1))).toBeCloseTo(0);
  });

  it('gives a transparent overlay by day and a strong one at night', () => {
    expect(lighting(at(0.3)).alpha).toBe(0);
    expect(lighting(at(0.9)).alpha).toBeGreaterThan(0.6);
    expect(lighting(at(0.9)).color).toBe(0x0a1030);
  });

  it('formats the time of day, with 06:00 at dawn', () => {
    expect(clockLabel(at(0))).toBe('06:00');
    expect(clockLabel(at(0.25))).toBe('12:00');
    expect(clockLabel(at(0.5))).toBe('18:00');
    expect(clockLabel(at(0.9999))).toBe('05:59');
  });

  it('counts dusk and the night, not dawn or the day, as night time for the creatures that come out in the dark', () => {
    expect(isNight(at(0.3))).toBe(false);
    expect(isNight(at(0.05))).toBe(false);
    expect(isNight(at(0.65))).toBe(true);
    expect(isNight(at(0.95))).toBe(true);
  });

  it('lets the hero sleep only in the evening and at night, and wakes at the next dawn', () => {
    expect(canSleep(at(0.3))).toBe(false);
    expect(canSleep(at(0.05))).toBe(false);
    expect(canSleep(at(0.65))).toBe(true);
    expect(canSleep(at(0.95))).toBe(true);
    expect(wakeUp(at(0.95, 3))).toEqual({ day: 4, t: 0 });
    expect(phaseOf(wakeUp(at(0.7)))).toBe('dawn');
  });
});
```

`tests/encounters.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/rng';
import { CREATURES, isHostileKind } from '@/data/creatures';
import { ITEMS } from '@/data/items';
import { newCreature, type Creature } from '@/sim/creatures';
import {
  ARROW_SPEED, creatureInReach, emptyEncounters, hostilesNear, shoot, swing, takePickups, tickEncounters,
  type Encounters, type TickContext,
} from '@/sim/encounters';
import { addItem, countItem, emptyInventory } from '@/sim/inventory';
import { capsFor } from '@/sim/spawner';
import { emptyStructures } from '@/sim/structures';
import { B, T, WORLD_SIZE, idx, type World } from '@/sim/world/types';

function makeWorld(): World {
  const size = WORLD_SIZE;
  const terrain = new Uint8Array(size * size).fill(T.GRASS);
  return { seed: 0, size, terrain, biome: new Uint8Array(size * size).fill(B.FOREST), landmarks: [], resources: [], start: { x: 3, y: 3 } };
}

const hero = { x: 80.5, y: 80.5 };
const world = makeWorld();
const tctx = (over: Partial<TickContext> = {}): TickContext => ({
  world, solids: new Set(), structures: emptyStructures(), hero, heroAlive: true, night: false, difficulty: 'normal', defense: 0, rng: new Rng(4), ...over,
});
const mk = (kind: Creature['kind'], x: number, y: number, id: number, over: Partial<Creature> = {}): Creature =>
  ({ ...newCreature(id, kind, x, y, new Rng(id)), ...over });
const withCreatures = (...creatures: Creature[]): Encounters => ({ ...emptyEncounters(), creatures, nextId: 100 });
const sword = { damage: 5, reach: 1.3, arc: 110, knockback: 0.35 };
const spear = { damage: 5, reach: 1.9, arc: 30, knockback: 0.5 };

describe('swing', () => {
  it('hurts every creature inside the arc, pushes it away, and spares the ones outside', () => {
    const e = withCreatures(mk('slime', 81.5, 80.5, 1), mk('mushroom', 81.3, 80.9, 2), mk('slime', 79, 80.5, 3));
    const r = swing(e, hero, 'right', sword, new Rng(1));
    expect(r.events.map((ev) => ev.t === 'hit' && ev.id)).toEqual([1, 2]);
    expect(r.e.creatures.find((c) => c.id === 1)!.hp).toBe(CREATURES.slime.hp - 5);
    expect(r.e.creatures.find((c) => c.id === 1)!.pushX).toBeGreaterThan(0);
    expect(r.e.creatures.find((c) => c.id === 3)!.hp).toBe(CREATURES.slime.hp);
  });

  it('kills what runs out of hit points, removes it, and leaves its loot lying around', () => {
    const e = withCreatures(mk('rabbit', 81.2, 80.5, 7));
    const r = swing(e, hero, 'right', sword, new Rng(1));
    expect(r.e.creatures).toEqual([]);
    expect(r.events.map((ev) => ev.t)).toEqual(['hit', 'killed']);
    expect(r.e.pickups.map((p) => p.item)).toEqual(['raw_meat']);
    expect(r.e.nextId).toBe(101);
    expect(Math.hypot(r.e.pickups[0].x - 81.2, r.e.pickups[0].y - 80.5)).toBeLessThan(0.8);
  });

  it('lets a spear reach a target a sword cannot, but only straight ahead', () => {
    const e = withCreatures(mk('slime', 82.3, 80.5, 1), mk('slime', 82.3, 81.6, 2));
    expect(swing(e, hero, 'right', sword, new Rng(1)).events).toEqual([]);
    expect(swing(e, hero, 'right', spear, new Rng(1)).events.map((ev) => ev.t === 'hit' && ev.id)).toEqual([1]);
  });

  it('does nothing in an empty field', () => {
    const r = swing(emptyEncounters(), hero, 'up', sword, new Rng(1));
    expect(r.events).toEqual([]);
  });
});

describe('creatureInReach', () => {
  it('says whether a blow in that direction would land on something', () => {
    const e = withCreatures(mk('slime', 81.4, 80.5, 1));
    expect(creatureInReach(e, hero, 'right', 1.0, 90)).toBe(true);
    expect(creatureInReach(e, hero, 'left', 1.0, 90)).toBe(false);
    expect(creatureInReach(emptyEncounters(), hero, 'right', 1.0, 90)).toBe(false);
  });
});

describe('hostilesNear', () => {
  const heroAt = { x: 50, y: 50 };
  const at = (kind: Parameters<typeof newCreature>[1], dx: number, state: 'idle' | 'chase' | 'windup' | 'flee' = 'chase') =>
    ({ ...newCreature(1, kind, heroAt.x + dx, heroAt.y, new Rng(1)), state });

  it('counts monsters that are hunting the hero within the radius, and nothing else', () => {
    const e = {
      ...emptyEncounters(),
      creatures: [at('slime', 4), at('skeleton', 6, 'windup'), at('slime', 30), at('rabbit', 2, 'flee'), at('boar', 2, 'chase'), at('worm', 3, 'idle')],
    };
    expect(hostilesNear(e, heroAt, 10)).toBe(2);
    expect(hostilesNear(emptyEncounters(), heroAt, 10)).toBe(0);
  });
});

describe('arrows', () => {
  const bow = ITEMS.bow.weapon!;

  it('fly in the facing direction at a steady speed and fall at the end of their range', () => {
    let e = shoot(emptyEncounters(), hero, 'right', bow);
    expect(e.arrows).toHaveLength(1);
    expect(e.arrows[0]).toMatchObject({ dx: 1, dy: 0, damage: bow.damage, left: bow.reach });
    const x0 = e.arrows[0].x;
    e = tickEncounters(e, tctx(), 0.1).e;
    expect(e.arrows[0].x).toBeCloseTo(x0 + ARROW_SPEED * 0.1, 3);
    for (let i = 0; i < 40; i++) e = tickEncounters(e, tctx(), 0.05).e;
    expect(e.arrows).toEqual([]);
  });

  it('hit the first creature in their path, once, and are used up', () => {
    const e0 = { ...withCreatures(mk('slime', 83.5, 80.5, 1), mk('slime', 85.5, 80.5, 2)), spawnTimer: 99 };
    let e = shoot(e0, hero, 'right', bow);
    const events: string[] = [];
    for (let i = 0; i < 20; i++) {
      const r = tickEncounters(e, tctx(), 0.05);
      e = r.e;
      for (const ev of r.events) if (ev.t === 'hit') events.push(`${ev.id}:${ev.amount}`);
    }
    expect(events).toEqual([`1:${bow.damage}`]);
    expect(e.arrows).toEqual([]);
    expect(e.creatures.find((c) => c.id === 2)!.hp).toBe(CREATURES.slime.hp);
  });

  it('cannot hit a small fast target by skipping over it', () => {
    const e0 = { ...withCreatures(mk('bird', 83.4, 80.55, 1, { state: 'idle', timer: 99 })), spawnTimer: 99 };
    let e = shoot(e0, hero, 'right', bow);
    let hits = 0;
    for (let i = 0; i < 6; i++) {
      const r = tickEncounters(e, tctx(), 0.5);
      e = r.e;
      hits += r.events.filter((ev) => ev.t === 'hit').length;
    }
    expect(hits).toBe(1);
  });

  it('stop at a solid tile and never hit what stands behind it', () => {
    const solids = new Set([idx(82, 80)]);
    const e0 = { ...withCreatures(mk('slime', 84.5, 80.5, 1, { state: 'idle', timer: 99 })), spawnTimer: 99 };
    let e = shoot(e0, hero, 'right', bow);
    let hits = 0;
    for (let i = 0; i < 20; i++) {
      const r = tickEncounters(e, tctx({ solids }), 0.05);
      e = r.e;
      hits += r.events.filter((ev) => ev.t === 'hit').length;
    }
    expect(hits).toBe(0);
    expect(e.arrows).toEqual([]);
  });

  it('can kill, and the kill leaves loot', () => {
    const e0 = { ...withCreatures(mk('rabbit', 83.5, 80.5, 1, { state: 'idle', timer: 99 })), spawnTimer: 99 };
    let e = shoot(e0, hero, 'right', bow);
    const kinds: string[] = [];
    for (let i = 0; i < 20; i++) {
      const r = tickEncounters(e, tctx(), 0.05);
      e = r.e;
      kinds.push(...r.events.map((ev) => ev.t));
    }
    expect(kinds).toEqual(['hit', 'killed']);
    expect(e.pickups[0].item).toBe('raw_meat');
  });
});

describe('tickEncounters', () => {
  it('reports a blow on the hero scaled by the difficulty and reduced by armour', () => {
    const run = (over: Partial<TickContext>) => {
      let e: Encounters = { ...withCreatures(mk('slime', 81.1, 80.5, 1)), spawnTimer: 99 };
      const hits: number[] = [];
      for (let i = 0; i < 40; i++) {
        const r = tickEncounters(e, tctx(over), 0.05);
        e = r.e;
        for (const ev of r.events) if (ev.t === 'hurtHero') hits.push(ev.amount);
      }
      return hits;
    };
    expect(run({})[0]).toBe(CREATURES.slime.damage);
    expect(run({ difficulty: 'relaxed' })[0]).toBe(4);
    expect(run({ difficulty: 'hardcore' })[0]).toBe(8);
    expect(run({ defense: 4 })[0]).toBe(2);
    expect(run({ heroAlive: false })).toEqual([]);
  });

  it('adds creatures over time, never beyond the caps, and keeps both kinds around', () => {
    let e = emptyEncounters();
    const rng = new Rng(8);
    for (let t = 0; t < 120; t += 0.1) {
      e = tickEncounters(e, tctx({ rng }), 0.1).e;
      const hostile = e.creatures.filter((c) => isHostileKind(c.kind)).length;
      expect(hostile).toBeLessThanOrEqual(capsFor(false).hostile);
      expect(e.creatures.length - hostile).toBeLessThanOrEqual(capsFor(false).animals);
    }
    expect(e.creatures.length).toBeGreaterThan(5);
  });

  it('removes creatures the hero has left far behind', () => {
    let e: Encounters = { ...withCreatures(mk('rabbit', 20.5, 20.5, 1)), spawnTimer: 0.01 };
    e = tickEncounters(e, tctx(), 0.05).e;
    expect(e.creatures.find((c) => c.id === 1)).toBeUndefined();
  });

  it('pushes creatures that stand on each other apart', () => {
    const e = { ...withCreatures(mk('slime', 60.5, 60.5, 1, { state: 'idle', timer: 99 }), mk('slime', 60.5, 60.5, 2, { state: 'idle', timer: 99 })), spawnTimer: 99 };
    const r = tickEncounters(e, tctx(), 0.05).e;
    const [a, b] = r.creatures;
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(CREATURES.slime.radius * 2 - 0.02);
  });

  it('ages loose items, drifts the near ones toward the hero and drops them after two minutes', () => {
    const near = { id: 1, item: 'bone' as const, qty: 1, x: 81.5, y: 80.5, age: 0 };
    const old = { id: 2, item: 'bone' as const, qty: 1, x: 50, y: 50, age: 119.95 };
    const e = { ...emptyEncounters(), pickups: [near, old], spawnTimer: 99 };
    const r = tickEncounters(e, tctx(), 0.1).e;
    expect(r.pickups).toHaveLength(1);
    expect(r.pickups[0].x).toBeLessThan(81.5);
  });
});

describe('takePickups', () => {
  it('moves loot into the backpack and keeps the rest on the ground', () => {
    const e = { ...emptyEncounters(), pickups: [{ id: 1, item: 'gel' as const, qty: 2, x: 80.6, y: 80.5, age: 0 }, { id: 2, item: 'gel' as const, qty: 2, x: 70, y: 70, age: 0 }] };
    const r = takePickups(e, emptyInventory(), hero);
    expect(countItem(r.inv, 'gel')).toBe(2);
    expect(r.taken).toEqual([{ item: 'gel', qty: 2 }]);
    expect(r.e.pickups.map((p) => p.id)).toEqual([2]);
  });

  it('returns the same state when there is nothing to take, and flags a full backpack', () => {
    const e = { ...emptyEncounters(), pickups: [{ id: 1, item: 'gel' as const, qty: 2, x: 50, y: 50, age: 0 }] };
    expect(takePickups(e, emptyInventory(), hero).e).toBe(e);
    const full = addItem(emptyInventory(1), 'wood', 99).inv;
    const here = { ...emptyEncounters(), pickups: [{ id: 1, item: 'gel' as const, qty: 2, x: 80.6, y: 80.5, age: 0 }] };
    const r = takePickups(here, full, hero);
    expect(r.full).toBe(true);
    expect(r.e.pickups).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/daynight.test.ts tests/encounters.test.ts`
Expected: FAIL. The new daynight test fails with `isNight is not a function`; `encounters.test.ts` cannot resolve `@/sim/encounters`.

- [ ] **Step 3: Write the code**

`isNight` is the single definition of the dark hours; `canSleep` reuses it:

`src/sim/daynight.ts`:

```typescript
/** Day/night clock. Pure: every function returns a new value and never mutates its input. */

/** Real seconds in one in-game day. */
export const DAY_SECONDS = 600;
/** The first morning starts a fifth of the way through the day (about 10:48). */
export const START_FRACTION = 0.2;
/** Peak darkness of the night overlay (0..1). */
export const NIGHT_DARKNESS = 0.85;

const DAWN_END = 0.1;
const DUSK_START = 0.6;
const NIGHT_START = 0.7;

export type Phase = 'dawn' | 'day' | 'dusk' | 'night';

export interface Clock {
  /** 1-based day counter. */
  readonly day: number;
  /** Seconds since dawn of the current day, in [0, DAY_SECONDS). */
  readonly t: number;
}

export const newClock = (): Clock => ({ day: 1, t: DAY_SECONDS * START_FRACTION });

export function advance(c: Clock, dt: number): Clock {
  let t = c.t + Math.max(0, dt);
  let day = c.day;
  while (t >= DAY_SECONDS) {
    t -= DAY_SECONDS;
    day += 1;
  }
  return { day, t };
}

const fraction = (c: Clock): number => c.t / DAY_SECONDS;

export function phaseOf(c: Clock): Phase {
  const f = fraction(c);
  if (f < DAWN_END) return 'dawn';
  if (f < DUSK_START) return 'day';
  if (f < NIGHT_START) return 'dusk';
  return 'night';
}

/** 0 in full daylight, rising through dusk to NIGHT_DARKNESS, falling back to 0 through dawn. */
export function darkness(c: Clock): number {
  const f = fraction(c);
  if (f < DAWN_END) return NIGHT_DARKNESS * (1 - f / DAWN_END);
  if (f < DUSK_START) return 0;
  if (f < NIGHT_START) return NIGHT_DARKNESS * ((f - DUSK_START) / (NIGHT_START - DUSK_START));
  return NIGHT_DARKNESS;
}

function lerpColor(a: number, b: number, k: number): number {
  const ch = (shift: number) => Math.round(((a >> shift) & 255) * (1 - k) + ((b >> shift) & 255) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Overlay for the world: a colour and an alpha to draw over everything except the HUD. */
export function lighting(c: Clock): { color: number; alpha: number } {
  const d = darkness(c);
  // Warm purple glow at the middle of dawn and dusk, deep blue at night.
  const warmth = d > 0 && d < NIGHT_DARKNESS ? 1 - Math.abs(d / NIGHT_DARKNESS - 0.5) * 2 : 0;
  return { color: lerpColor(0x0a1030, 0x7a3a50, warmth), alpha: d * 0.78 };
}

/** Dusk and the night itself: the hours when the creatures of the dark are about. */
export const isNight = (c: Clock): boolean => phaseOf(c) === 'dusk' || phaseOf(c) === 'night';

/** The hero can only sleep once evening has come. */
export const canSleep = isNight;

/** Wake up at dawn of the next day. */
export const wakeUp = (c: Clock): Clock => ({ day: c.day + 1, t: 0 });

/** "HH:MM" time of day; the day starts at 06:00 with dawn. */
export function clockLabel(c: Clock): string {
  const minutes = Math.floor((6 * 60 + fraction(c) * 24 * 60) % (24 * 60));
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}
```

`Encounters` is one immutable value holding everything that moves. A death removes the creature and leaves its loot on the ground. Arrows fly in sub-steps of at most 0.3 tiles so they cannot skip over a small target, and they stop at solid tiles. Creatures that overlap are nudged apart.

`src/sim/encounters.ts`:

```typescript
import type { Rng } from '@/core/rng';
import { CREATURES, type CreatureId } from '@/data/creatures';
import type { WeaponStats } from '@/data/items';
import type { Facing } from '@/sim/actions';
import { enemyDamage, inSwing, knockbackVec, type SwingStats } from '@/sim/combat';
import { hurtCreature, stepCreature, type Creature } from '@/sim/creatures';
import type { Inventory } from '@/sim/inventory';
import { moveWithCollision, tileBlocked, type Vec } from '@/sim/movement';
import { ageOut, collect, drift, rollLoot, scatter, type Pickup, type Stack } from '@/sim/pickups';
import { SPAWN_INTERVAL, cull, trySpawn } from '@/sim/spawner';
import type { Structures } from '@/sim/structures';
import type { Difficulty } from '@/sim/vitals';
import type { World } from '@/sim/world/types';

/** An arrow in flight: a unit direction, the distance it can still travel, and what it does on impact. */
export interface Arrow {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly dx: number;
  readonly dy: number;
  readonly left: number;
  readonly damage: number;
  readonly knockback: number;
}

/** Everything that lives on the island besides the hero and the scenery. Not saved: it is rebuilt around the hero. */
export interface Encounters {
  readonly creatures: readonly Creature[];
  readonly pickups: readonly Pickup[];
  readonly arrows: readonly Arrow[];
  /** Shared counter for creature, pickup and arrow ids. */
  readonly nextId: number;
  readonly spawnTimer: number;
}

export type EncounterEvent =
  | { t: 'hurtHero'; amount: number; from: Vec; kind: CreatureId }
  | { t: 'hit'; id: number; kind: CreatureId; amount: number; x: number; y: number }
  | { t: 'killed'; id: number; kind: CreatureId; x: number; y: number };

export interface EncounterStep {
  e: Encounters;
  events: EncounterEvent[];
}

export interface TickContext {
  world: World;
  solids: ReadonlySet<number>;
  structures: Structures;
  hero: Vec;
  heroAlive: boolean;
  night: boolean;
  difficulty: Difficulty;
  /** Armour: points taken off every blow. */
  defense: number;
  rng: Rng;
}

export const ARROW_SPEED = 9;
const ARROW_REACH = 0.18;
/** Arrows move in steps no longer than this, so a fast one cannot skip over a small target. */
const ARROW_SUBSTEP = 0.3;

export const emptyEncounters = (): Encounters => ({ creatures: [], pickups: [], arrows: [], nextId: 1, spawnTimer: SPAWN_INTERVAL });

/** Deal damage to one creature. A death removes it and leaves its loot on the ground. */
function damageCreature(e: Encounters, id: number, amount: number, push: Vec, rng: Rng): EncounterStep {
  const target = e.creatures.find((c) => c.id === id);
  if (!target) return { e, events: [] };
  const hit: EncounterEvent = { t: 'hit', id, kind: target.kind, amount, x: target.x, y: target.y };
  const r = hurtCreature(target, amount, push);
  if (!r.dead) return { e: { ...e, creatures: e.creatures.map((c) => (c.id === id ? r.creature : c)) }, events: [hit] };
  const loot = scatter(rollLoot(target.kind, rng), target, e.nextId, rng);
  return {
    e: { ...e, creatures: e.creatures.filter((c) => c.id !== id), pickups: [...e.pickups, ...loot], nextId: e.nextId + loot.length },
    events: [hit, { t: 'killed', id, kind: target.kind, x: target.x, y: target.y }],
  };
}

/** A melee swing: every creature inside the arc is hurt and pushed back. */
export function swing(e: Encounters, hero: Vec, facing: Facing, stats: SwingStats, rng: Rng): EncounterStep {
  let cur = e;
  const events: EncounterEvent[] = [];
  for (const c of e.creatures) {
    if (!inSwing(hero, facing, stats.reach, stats.arc, c, CREATURES[c.kind].radius)) continue;
    const r = damageCreature(cur, c.id, stats.damage, knockbackVec(hero, c, stats.knockback), rng);
    cur = r.e;
    events.push(...r.events);
  }
  return { e: cur, events };
}

const FACING: Record<Facing, readonly [number, number]> = { down: [0, 1], left: [-1, 0], right: [1, 0], up: [0, -1] };

/** Loose an arrow from the hero's hands in the direction he faces. */
export function shoot(e: Encounters, hero: Vec, facing: Facing, stats: Pick<WeaponStats, 'damage' | 'reach' | 'knockback'>): Encounters {
  const [dx, dy] = FACING[facing];
  const arrow: Arrow = {
    id: e.nextId, x: hero.x + dx * 0.4, y: hero.y + dy * 0.4, dx, dy, left: stats.reach, damage: stats.damage, knockback: stats.knockback,
  };
  return { ...e, arrows: [...e.arrows, arrow], nextId: e.nextId + 1 };
}

function flyArrows(e: Encounters, c: TickContext, dt: number): EncounterStep {
  let cur: Encounters = { ...e, arrows: [] };
  const events: EncounterEvent[] = [];
  for (const arrow of e.arrows) {
    let { x, y, left } = arrow;
    let alive = true;
    let travel = Math.min(left, ARROW_SPEED * dt);
    while (alive && travel > 1e-9) {
      const step = Math.min(travel, ARROW_SUBSTEP);
      x += arrow.dx * step;
      y += arrow.dy * step;
      travel -= step;
      left -= step;
      if (tileBlocked(c.world, c.solids, Math.floor(x), Math.floor(y))) {
        alive = false;
        break;
      }
      const victim = cur.creatures.find((cr) => Math.hypot(cr.x - x, cr.y - y) <= CREATURES[cr.kind].radius + ARROW_REACH);
      if (!victim) continue;
      const r = damageCreature(cur, victim.id, arrow.damage, { x: arrow.dx * arrow.knockback, y: arrow.dy * arrow.knockback }, c.rng);
      cur = r.e;
      events.push(...r.events);
      alive = false;
    }
    if (alive && left > 1e-9) cur = { ...cur, arrows: [...cur.arrows, { ...arrow, x, y, left }] };
  }
  return { e: cur, events };
}

/** Creatures that overlap are nudged apart, so a pack of slimes does not stack into one. */
function separate(creatures: readonly Creature[], c: TickContext): Creature[] {
  const out = creatures.slice();
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      const a = out[i];
      const b = out[j];
      const gap = CREATURES[a.kind].radius + CREATURES[b.kind].radius;
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (d >= gap) continue;
      const push = knockbackVec(a, d < 1e-6 ? { x: a.x + 1, y: a.y } : b, (gap - d) / 2 + 0.01);
      const na = moveWithCollision(c.world, c.solids, a, -push.x, -push.y, CREATURES[a.kind].radius);
      const nb = moveWithCollision(c.world, c.solids, b, push.x, push.y, CREATURES[b.kind].radius);
      out[i] = { ...a, x: na.x, y: na.y };
      out[j] = { ...b, x: nb.x, y: nb.y };
    }
  }
  return out;
}

/** Advance the island's creatures, arrows and loose items by `dt` seconds. */
export function tickEncounters(e: Encounters, c: TickContext, dt: number): EncounterStep {
  const events: EncounterEvent[] = [];
  const stepped = e.creatures.map((cr) => {
    const r = stepCreature(cr, { world: c.world, solids: c.solids, hero: c.hero, heroAlive: c.heroAlive, rng: c.rng, dt });
    if (r.strike) {
      const amount = enemyDamage(CREATURES[cr.kind].damage, c.difficulty, c.defense);
      events.push({ t: 'hurtHero', amount, from: { x: cr.x, y: cr.y }, kind: cr.kind });
    }
    return r.creature;
  });
  const flight = flyArrows({ ...e, creatures: separate(stepped, c) }, c, dt);
  events.push(...flight.events);
  let cur: Encounters = { ...flight.e, pickups: ageOut(drift(flight.e.pickups, c.hero, dt), dt) };
  const timer = cur.spawnTimer - dt;
  if (timer > 0) return { e: { ...cur, spawnTimer: timer }, events };
  const born = trySpawn({
    world: c.world, solids: c.solids, structures: c.structures, hero: c.hero, night: c.night, creatures: cur.creatures,
    nextId: cur.nextId, rng: c.rng,
  });
  cur = { ...cur, creatures: born ? [...cur.creatures, born] : cur.creatures, nextId: born ? cur.nextId + 1 : cur.nextId, spawnTimer: SPAWN_INTERVAL };
  return { e: { ...cur, creatures: cull(cur.creatures, c.hero, c.night) }, events };
}

export interface Taken {
  e: Encounters;
  inv: Inventory;
  taken: Stack[];
  full: boolean;
}

/** The hero picks up what lies within reach; whatever does not fit stays on the ground. */
export function takePickups(e: Encounters, inv: Inventory, hero: Vec): Taken {
  const r = collect(inv, e.pickups, hero);
  return { e: r.taken.length === 0 && !r.full ? e : { ...e, pickups: r.pickups }, inv: r.inv, taken: r.taken, full: r.full };
}

/** How many monsters within `radius` tiles of the hero are hunting him (chasing, winding up or recovering from a blow). */
export function hostilesNear(e: Encounters, hero: Vec, radius: number): number {
  return e.creatures.filter((c) => {
    if (CREATURES[c.kind].temper !== 'chase') return false;
    return (c.state === 'chase' || c.state === 'windup' || c.state === 'recover') && Math.hypot(c.x - hero.x, c.y - hero.y) <= radius;
  }).length;
}

/** Would a blow of this reach and width land on any creature? Used to decide what ACTION does. */
export function creatureInReach(e: Encounters, hero: Vec, facing: Facing, reach: number, arc: number): boolean {
  return e.creatures.some((c) => inSwing(hero, facing, reach, arc, c, CREATURES[c.kind].radius));
}
```

- [ ] **Step 4: Run the tests and the typecheck**

Run: `npx vitest run tests/daynight.test.ts tests/encounters.test.ts && npm run typecheck && npm test`
Expected: daynight 10, encounters 18 tests PASS; typecheck exits 0; whole suite passes (343 tests).

- [ ] **Step 5: Commit**

```bash
git add src/sim/encounters.ts src/sim/daynight.ts tests/encounters.test.ts tests/daynight.test.ts
git commit -m "feat: add encounters (swings, arrows, loot, caps) and night detection"
```

---

### Task 7: Attack and shoot actions, melee stats, hero damage

**Files:**
- Create: `src/sim/melee.ts`
- Replace: `src/sim/actions.ts`, `src/sim/session.ts`, `src/sim/vitals.ts`, `tests/vitals.test.ts`
- Modify: `tests/actions.test.ts` (one line)
- Test: `tests/melee.test.ts`, `tests/actions-combat.test.ts`, `tests/session-combat.test.ts` (new)

**Interfaces:**
- Consumes: `ITEMS`, `WeaponStats` (Task 1), `SwingStats` (Task 3), `STAMINA_HAND`, `STAMINA_TOOL`, `TIER_DAMAGE`, `countItem`, `removeItem`, `wearTool`, `spendStamina`.
- Produces: `Melee = SwingStats & {stamina, cooldown, wear}`, `meleeFor(held: ItemId | null) -> Melee` (weapons use their own stats and wear; a tool is swung as a club at its tier damage without wear; everything else is fists); `ActionContext.creature: boolean`; new actions `{kind: 'attack', melee}` and `{kind: 'shoot', stats}`; `Blocked` gains `{reason: 'noArrows'}`; new effects `{t: 'strike', melee}`, `{t: 'shot', stats}`, `{t: 'ate'}`; `hurtHero(session, amount) -> Session`; `takeDamage(vitals, amount) -> Vitals`; **a hero at zero hit points no longer regenerates** (the fix for Review Focus 1).

- [ ] **Step 1: Write the failing tests**

`tests/melee.test.ts`:

```typescript
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
```

`tests/actions-combat.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import type { ItemId } from '@/data/items';
import { ITEMS } from '@/data/items';
import { emptyFarm } from '@/sim/farm';
import { resolveAction, type Action, type ActionContext, type Facing } from '@/sim/actions';
import { addItem, emptyInventory } from '@/sim/inventory';
import { meleeFor } from '@/sim/melee';
import { emptyStructures, placeStructure } from '@/sim/structures';
import { fullVitals } from '@/sim/vitals';
import { T, WORLD_SIZE, idx, type ResourceNode, type World } from '@/sim/world/types';

function makeWorld(): World {
  const size = WORLD_SIZE;
  const terrain = new Uint8Array(size * size).fill(T.GRASS);
  terrain[idx(10, 12)] = T.RIVER;
  return { seed: 0, size, terrain, biome: new Uint8Array(size * size), landmarks: [], resources: [], start: { x: 10, y: 10 } };
}

const tree: ResourceNode = { id: 1, kind: 'tree', x: 11, y: 10, variant: 0 };

/** Hero at (10.5, 10.5) facing right; `hold` goes in hotbar slot 0 and `arrows` into slot 1. */
function ctx(over: Partial<ActionContext> & { hold?: ItemId; arrows?: number; facing?: Facing } = {}): ActionContext {
  const { hold, arrows, ...rest } = over;
  let inv = emptyInventory();
  if (hold) inv = addItem(inv, hold, 1).inv;
  if (arrows) inv = addItem(inv, 'arrow', arrows).inv;
  return {
    world: makeWorld(), inv, selected: 0, vitals: fullVitals(), pos: { x: 10.5, y: 10.5 }, facing: 'right',
    structures: emptyStructures(), farm: emptyFarm(), occupied: new Set(), node: null, creature: false, ...rest,
  };
}
const kind = (a: Action): string => a.kind;

describe('the bow', () => {
  it('shoots whenever it is held and there are arrows, without needing a target', () => {
    const a = resolveAction(ctx({ hold: 'bow', arrows: 5 }));
    expect(a).toEqual({ kind: 'shoot', stats: ITEMS.bow.weapon });
  });

  it('shoots instead of drinking or chopping while it is held', () => {
    expect(kind(resolveAction(ctx({ hold: 'bow', arrows: 5, facing: 'down', pos: { x: 10.5, y: 11.5 } })))).toBe('shoot');
    expect(kind(resolveAction(ctx({ hold: 'bow', arrows: 5, node: tree })))).toBe('shoot');
  });

  it('says so when there are no arrows, and when the hero is too tired', () => {
    expect(resolveAction(ctx({ hold: 'bow' }))).toEqual({ kind: 'blocked', reason: 'noArrows' });
    const tired = { ...fullVitals(), stamina: 0 };
    expect(resolveAction(ctx({ hold: 'bow', arrows: 5, vitals: tired }))).toEqual({ kind: 'blocked', reason: 'tired' });
  });
});

describe('melee', () => {
  it('swings a sword or spear when something is within reach', () => {
    expect(resolveAction(ctx({ hold: 'sword_iron', creature: true }))).toEqual({ kind: 'attack', melee: meleeFor('sword_iron') });
    expect(resolveAction(ctx({ hold: 'spear_bone', creature: true }))).toEqual({ kind: 'attack', melee: meleeFor('spear_bone') });
  });

  it('does not swing at nothing: a sword by a tree chops by hand, and by the river it drinks', () => {
    expect(resolveAction(ctx({ hold: 'sword_wood', node: tree }))).toMatchObject({ kind: 'hit', wear: false });
    expect(kind(resolveAction(ctx({ hold: 'sword_wood', facing: 'down', pos: { x: 10.5, y: 11.5 } })))).toBe('drink');
    expect(kind(resolveAction(ctx({ hold: 'sword_wood' })))).toBe('none');
  });

  it('lets bare hands and tools fight back, ahead of chopping', () => {
    expect(resolveAction(ctx({ creature: true }))).toEqual({ kind: 'attack', melee: meleeFor(null) });
    expect(resolveAction(ctx({ hold: 'axe_stone', creature: true, node: tree }))).toEqual({ kind: 'attack', melee: meleeFor('axe_stone') });
  });

  it('is blocked when the hero is too tired to swing', () => {
    const tired = { ...fullVitals(), stamina: 0 };
    expect(resolveAction(ctx({ hold: 'sword_wood', creature: true, vitals: tired }))).toEqual({ kind: 'blocked', reason: 'tired' });
    expect(resolveAction(ctx({ creature: true, vitals: tired }))).toEqual({ kind: 'blocked', reason: 'tired' });
  });

  it('still lets a structure in front, or something to eat, come first', () => {
    const structures = placeStructure(emptyStructures(), 'workbench', 11, 10);
    expect(kind(resolveAction(ctx({ hold: 'sword_wood', creature: true, structures })))).toBe('open');
    const hurt = { ...fullVitals(), hp: 20 };
    expect(kind(resolveAction(ctx({ hold: 'cooked_meat', creature: true, vitals: { ...hurt, hunger: 10 } })))).toBe('eat');
  });
});
```

`tests/session-combat.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { newSlot } from '@/core/saveData';
import { ITEMS } from '@/data/items';
import { STAMINA_HAND } from '@/data/tools';
import type { Action } from '@/sim/actions';
import { addItem, countItem } from '@/sim/inventory';
import { meleeFor } from '@/sim/melee';
import { applyAction, hurtHero, sessionFromSlot, type Session } from '@/sim/session';

const slot = () => newSlot(0, 'Ari', 1234, 'normal', { x: 50, y: 50 }, { day: 1, t: 100 }, 1000);
const base = (over: Partial<Session> = {}): Session => ({ ...sessionFromSlot(slot()), ...over });
const give = (s: Session, ...pairs: [Parameters<typeof addItem>[1], number][]): Session => ({
  ...s, inventory: pairs.reduce((inv, [item, n]) => addItem(inv, item, n).inv, s.inventory),
});
const pos = { x: 50.5, y: 50.5 };
const fxTypes = (r: ReturnType<typeof applyAction>) => r.fx.map((f) => f.t);

describe('melee attacks', () => {
  const attack = (held: Parameters<typeof meleeFor>[0]): Action => ({ kind: 'attack', melee: meleeFor(held) });

  it('swings the weapon: stamina is spent, the weapon wears, and the scene is told to resolve the blow', () => {
    const s = give(base(), ['sword_stone', 1]);
    const r = applyAction(s, attack('sword_stone'), pos);
    expect(fxTypes(r)).toEqual(['swing', 'strike']);
    expect(r.fx[1]).toEqual({ t: 'strike', melee: meleeFor('sword_stone') });
    expect(r.session.vitals.stamina).toBe(100 - ITEMS.sword_stone.weapon!.stamina);
    expect(r.session.inventory[0]!.dur).toBe(ITEMS.sword_stone.tool!.durability - 1);
  });

  it('tells the player when a weapon breaks on the last swing', () => {
    let s = give(base(), ['sword_wood', 1]);
    s = { ...s, inventory: s.inventory.map((x, i) => (i === 0 ? { ...x!, dur: 1 } : x)) };
    const r = applyAction(s, attack('sword_wood'), pos);
    expect(r.session.inventory[0]).toBeNull();
    expect(r.fx.some((f) => f.t === 'say' && f.key === 'msgToolBroke')).toBe(true);
  });

  it('wears nothing when punching with fists or swinging a tool', () => {
    const fists = applyAction(base(), attack(null), pos);
    expect(fists.session.vitals.stamina).toBe(100 - STAMINA_HAND);
    expect(fists.session.inventory).toEqual(base().inventory);
    const s = give(base(), ['axe_stone', 1]);
    const axe = applyAction(s, attack('axe_stone'), pos);
    expect(axe.session.inventory[0]!.dur).toBe(ITEMS.axe_stone.tool!.durability);
  });
});

describe('shooting', () => {
  const bow = ITEMS.bow.weapon!;

  it('uses up one arrow, wears the bow, spends stamina and asks the scene to loose the arrow', () => {
    const s = give(base(), ['bow', 1], ['arrow', 6]);
    const r = applyAction(s, { kind: 'shoot', stats: bow }, pos);
    expect(fxTypes(r)).toEqual(['swing', 'shot']);
    expect(r.fx[1]).toEqual({ t: 'shot', stats: bow });
    expect(countItem(r.session.inventory, 'arrow')).toBe(5);
    expect(r.session.inventory[0]!.dur).toBe(ITEMS.bow.tool!.durability - 1);
    expect(r.session.vitals.stamina).toBe(100 - bow.stamina);
  });

  it('shoots nothing when the arrows ran out meanwhile', () => {
    const s = give(base(), ['bow', 1]);
    const r = applyAction(s, { kind: 'shoot', stats: bow }, pos);
    expect(r.session).toBe(s);
    expect(r.fx.map((f) => f.t === 'say' && f.key)).toEqual(['msgNoArrows']);
  });

  it('explains a blocked shot', () => {
    const r = applyAction(base(), { kind: 'blocked', reason: 'noArrows' }, pos);
    expect(r.fx).toEqual([{ t: 'say', key: 'msgNoArrows', vars: undefined, translate: undefined }]);
  });
});

describe('eating', () => {
  it('tells the scene the hero ate, so it can make the sound', () => {
    const r = applyAction(give(base(), ['cooked_meat', 1]), { kind: 'eat', food: ITEMS.cooked_meat.food! }, pos);
    expect(fxTypes(r)).toEqual(['ate']);
    expect(r.session.vitals.hunger).toBe(100);
  });
});

describe('hurtHero', () => {
  it('lowers hit points and nothing else, and never goes below zero', () => {
    const s = base();
    const hurt = hurtHero(s, 30);
    expect(hurt.vitals).toEqual({ ...s.vitals, hp: s.vitals.hp - 30 });
    expect(hurt.inventory).toBe(s.inventory);
    expect(hurtHero(s, 999).vitals.hp).toBe(0);
    expect(hurtHero(s, 0)).toBe(s);
  });
});
```

Replace `tests/vitals.test.ts` (adds the zero-hit-points rule and `takeDamage`):

`tests/vitals.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
  DESERT_THIRST, HUNGER_RATE, STARVE_DAMAGE, THIRST_RATE, VITAL_MAX, eat, fullVitals, isDead, sleepRecovery, spendStamina,
  takeDamage, tickVitals, wouldWaste, type VitalsContext, type Vitals,
} from '@/sim/vitals';
import { B } from '@/sim/world/types';

const ctx = (over: Partial<VitalsContext> = {}): VitalsContext => ({ difficulty: 'normal', biome: B.FOREST, busy: false, ...over });
const v = (over: Partial<Vitals> = {}): Vitals => ({ ...fullVitals(), ...over });

describe('tickVitals', () => {
  it('drains hunger and thirst at the base rates and never mutates the input', () => {
    const start = fullVitals();
    const next = tickVitals(start, 10, ctx());
    expect(next.hunger).toBeCloseTo(VITAL_MAX - HUNGER_RATE * 10);
    expect(next.thirst).toBeCloseTo(VITAL_MAX - THIRST_RATE * 10);
    expect(start).toEqual(fullVitals());
  });

  it('empties hunger in about two days and thirst in a little over one', () => {
    expect(tickVitals(v(), 1200, ctx()).hunger).toBeCloseTo(0);
    expect(tickVitals(v(), 800, ctx()).thirst).toBeCloseTo(0);
  });

  it('makes the desert thirstier and scales drain with difficulty', () => {
    const desert = tickVitals(v(), 10, ctx({ biome: B.DESERT }));
    expect(VITAL_MAX - desert.thirst).toBeCloseTo(THIRST_RATE * 10 * DESERT_THIRST);
    const easy = tickVitals(v(), 10, ctx({ difficulty: 'relaxed' }));
    const hard = tickVitals(v(), 10, ctx({ difficulty: 'hardcore' }));
    expect(VITAL_MAX - easy.hunger).toBeLessThan(VITAL_MAX - hard.hunger);
  });

  it('hurts when a meter is empty and twice as much when both are', () => {
    const one = tickVitals(v({ hunger: 0 }), 10, ctx());
    const both = tickVitals(v({ hunger: 0, thirst: 0 }), 10, ctx());
    expect(VITAL_MAX - one.hp).toBeCloseTo(STARVE_DAMAGE * 10);
    expect(VITAL_MAX - both.hp).toBeCloseTo(STARVE_DAMAGE * 20);
  });

  it('heals only while fed and watered, and never above the maximum', () => {
    const healing = tickVitals(v({ hp: 50 }), 10, ctx());
    expect(healing.hp).toBeGreaterThan(50);
    expect(tickVitals(v({ hp: 50, hunger: 20 }), 10, ctx()).hp).toBe(50);
    expect(tickVitals(v({ hp: 99.9 }), 100, ctx()).hp).toBe(VITAL_MAX);
  });

  it('does not heal a hero who is already at zero hit points, so a fatal blow cannot be undone by the next tick', () => {
    const down = tickVitals(v({ hp: 0 }), 1, ctx());
    expect(down.hp).toBe(0);
    expect(isDead(down)).toBe(true);
    expect(isDead(tickVitals(v({ hp: 0.001 }), 1, ctx()))).toBe(false);
  });

  it('recovers stamina quickly at rest and slowly when busy', () => {
    const rest = tickVitals(v({ stamina: 0 }), 1, ctx());
    const busy = tickVitals(v({ stamina: 0 }), 1, ctx({ busy: true }));
    expect(rest.stamina).toBeGreaterThan(busy.stamina);
    expect(tickVitals(v(), 50, ctx()).stamina).toBe(VITAL_MAX);
  });

  it('ignores zero or negative time', () => {
    const start = v({ hunger: 50 });
    expect(tickVitals(start, 0, ctx())).toBe(start);
    expect(tickVitals(start, -3, ctx())).toBe(start);
  });

  it('keeps every meter inside 0..100 even for a huge time step', () => {
    const out = tickVitals(v(), 1e7, ctx());
    for (const k of ['hp', 'hunger', 'thirst', 'stamina'] as const) {
      expect(out[k]).toBeGreaterThanOrEqual(0);
      expect(out[k]).toBeLessThanOrEqual(VITAL_MAX);
    }
    expect(isDead(out)).toBe(true);
  });
});

describe('takeDamage', () => {
  it('lowers hit points without going below zero and leaves the other meters alone', () => {
    const hurt = takeDamage(fullVitals(), 30);
    expect(hurt).toEqual({ ...fullVitals(), hp: 70 });
    expect(takeDamage(hurt, 500).hp).toBe(0);
    expect(takeDamage(hurt, 0)).toBe(hurt);
    expect(takeDamage(hurt, -5)).toBe(hurt);
  });
});

describe('eating, stamina and sleep', () => {
  it('adds food values with a cap at the maximum', () => {
    expect(eat(v({ hunger: 50 }), { hunger: 20, thirst: 0, hp: 0 }).hunger).toBe(70);
    expect(eat(v({ hunger: 95, hp: 99 }), { hunger: 20, thirst: 0, hp: 5 })).toMatchObject({ hunger: 100, hp: 100 });
  });

  it('knows when food would be wasted', () => {
    expect(wouldWaste(fullVitals(), { hunger: 10, thirst: 0, hp: 0 })).toBe(true);
    expect(wouldWaste(v({ hunger: 90 }), { hunger: 10, thirst: 0, hp: 0 })).toBe(false);
    expect(wouldWaste(v({ thirst: 10 }), { hunger: 10, thirst: 20, hp: 0 })).toBe(false);
  });

  it('charges stamina or refuses when too tired', () => {
    expect(spendStamina(v({ stamina: 10 }), 3)?.stamina).toBe(7);
    expect(spendStamina(v({ stamina: 2 }), 3)).toBeNull();
  });

  it('sleeping heals and rests but costs food and water', () => {
    const out = sleepRecovery(v({ hp: 30, hunger: 60, thirst: 60, stamina: 5 }));
    expect(out).toEqual({ hp: 70, hunger: 45, thirst: 45, stamina: VITAL_MAX });
    expect(sleepRecovery(v({ hunger: 5, thirst: 5 }))).toMatchObject({ hunger: 0, thirst: 0 });
  });
});
```

The shared action-test helper must supply the new context field. In `tests/actions.test.ts`, change this line inside `ctx()`:

```ts
    structures: emptyStructures(), farm: emptyFarm(), occupied: new Set(), node: null, ...rest,
```

to:

```ts
    structures: emptyStructures(), farm: emptyFarm(), occupied: new Set(), node: null, creature: false, ...rest,
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/melee.test.ts tests/actions-combat.test.ts tests/session-combat.test.ts tests/vitals.test.ts`
Expected: FAIL. `melee.test.ts`, `actions-combat.test.ts` and `session-combat.test.ts` cannot resolve `@/sim/melee`; `vitals.test.ts` fails 2 tests: the `takeDamage` one (not a function) and the "zero hit points" one ("expected 0.4 to be +0").

- [ ] **Step 3: Write the code**

`src/sim/melee.ts`:

```typescript
import { ITEMS, type ItemId } from '@/data/items';
import { STAMINA_HAND, STAMINA_TOOL, TIER_DAMAGE } from '@/data/tools';
import type { SwingStats } from '@/sim/combat';

/** How a hand-to-hand blow with whatever is held behaves. */
export interface Melee extends SwingStats {
  stamina: number;
  /** Seconds before the next use. */
  cooldown: number;
  /** The held item takes wear (weapons do; a tool swung as a club does not). */
  wear: boolean;
}

const FISTS: Melee = { damage: 1, reach: 1, arc: 90, knockback: 0.15, stamina: STAMINA_HAND, cooldown: 0.4, wear: false };

/** The blow for the held item: its own stats for swords and spears, a club for tools, fists for the rest. */
export function meleeFor(held: ItemId | null): Melee {
  const def = held ? ITEMS[held] : null;
  const w = def?.weapon;
  if (w && w.kind === 'melee') {
    return { damage: w.damage, reach: w.reach, arc: w.arc, knockback: w.knockback, stamina: w.stamina, cooldown: w.cooldown, wear: true };
  }
  if (def?.tool && !w) return { ...FISTS, damage: TIER_DAMAGE[def.tool.tier], knockback: 0.25, stamina: STAMINA_TOOL, cooldown: 0.45 };
  return FISTS;
}
```

The resolver: a bow always shoots when held (it takes precedence over drinking and chopping, like any item's own use); a melee weapon, a tool or bare hands attack only when something is in reach, so a sword by a tree still chops by hand and by a river still drinks:

`src/sim/actions.ts`:

```typescript
import { ITEMS, type ToolType, type WeaponStats } from '@/data/items';
import type { CropId } from '@/data/crops';
import { STRUCTURES, type StructureId } from '@/data/structures';
import { STAMINA_TOOL } from '@/data/tools';
import { canTill, isRipe, plotAt, type Farm } from '@/sim/farm';
import { countItem, type Inventory } from '@/sim/inventory';
import { meleeFor, type Melee } from '@/sim/melee';
import type { Vec } from '@/sim/movement';
import { canPlace, structureAt, type PlaceResult, type Structure, type Structures } from '@/sim/structures';
import { checkHit } from '@/sim/tools';
import { wouldWaste, type FoodValue, type Vitals } from '@/sim/vitals';
import { T, idx, inBounds, type ResourceNode, type World } from '@/sim/world/types';

export type Facing = 'down' | 'left' | 'right' | 'up';

const FACING_VEC: Record<Facing, readonly [number, number]> = { down: [0, 1], left: [-1, 0], right: [1, 0], up: [0, -1] };

/** The tile right in front of the hero. */
export function frontTile(pos: Vec, facing: Facing): { x: number; y: number } {
  const [dx, dy] = FACING_VEC[facing];
  return { x: Math.floor(pos.x) + dx, y: Math.floor(pos.y) + dy };
}

export interface ActionContext {
  world: World;
  inv: Inventory;
  /** Selected hotbar slot. */
  selected: number;
  vitals: Vitals;
  pos: Vec;
  facing: Facing;
  structures: Structures;
  farm: Farm;
  /** Tiles taken by solid things: living resource nodes, landmark scenery and structures. */
  occupied: ReadonlySet<number>;
  /** The nearest living resource node in reach, if any. */
  node: ResourceNode | null;
  /** A creature stands where a blow with the held item (or bare hands) would land. */
  creature: boolean;
}

export type Blocked =
  | { reason: 'needsTool'; tool: ToolType; tier: number }
  | { reason: 'tired' }
  | { reason: 'saltWater' }
  | { reason: 'canEmpty' }
  | { reason: 'chestNotEmpty' }
  | { reason: 'noArrows' }
  | { reason: 'cannotPlace'; why: Extract<PlaceResult, { ok: false }>['reason'] };

export type Action =
  | { kind: 'none' }
  | ({ kind: 'blocked' } & Blocked)
  | { kind: 'hit'; node: ResourceNode; damage: number; stamina: number; wear: boolean }
  | { kind: 'attack'; melee: Melee }
  | { kind: 'shoot'; stats: WeaponStats }
  | { kind: 'place'; type: StructureId; x: number; y: number }
  | { kind: 'till'; x: number; y: number; stamina: number }
  | { kind: 'plant'; x: number; y: number; crop: CropId }
  | { kind: 'water'; x: number; y: number }
  | { kind: 'refill'; x: number; y: number }
  | { kind: 'eat'; food: FoodValue }
  | { kind: 'harvest'; x: number; y: number }
  | { kind: 'pickup'; structure: Structure }
  | { kind: 'open'; structure: Structure }
  | { kind: 'sleep'; structure: Structure }
  | { kind: 'drink'; x: number; y: number };

const blocked = (b: Blocked): Action => ({ kind: 'blocked', ...b });
const NONE: Action = { kind: 'none' };

/**
 * Decide what pressing ACTION does. Order: a structure in front, then a ripe crop in front, then whatever the
 * selected item is for, and finally the world itself (chopping, mining, drinking). The scene carries the action out.
 */
export function resolveAction(c: ActionContext): Action {
  const { x, y } = frontTile(c.pos, c.facing);
  const inside = inBounds(x, y, c.world.size);
  const tile = inside ? idx(x, y, c.world.size) : -1;
  const slot = c.inv[c.selected] ?? null;
  const def = slot ? ITEMS[slot.item] : null;

  const structure = inside ? structureAt(c.structures, x, y) : undefined;
  if (structure) {
    const take = STRUCTURES[structure.type].pickup === 'always' || (def?.tool !== undefined && (def.tool.type === 'axe' || def.tool.type === 'pickaxe'));
    if (take) {
      return structure.inv?.some(Boolean) ? blocked({ reason: 'chestNotEmpty' }) : { kind: 'pickup', structure };
    }
    if (structure.type === 'bed') return { kind: 'sleep', structure };
    if (structure.type === 'chest' || STRUCTURES[structure.type].station) return { kind: 'open', structure };
  }
  const plot = tile >= 0 ? plotAt(c.farm, tile) : undefined;
  if (plot && isRipe(plot)) return { kind: 'harvest', x, y };

  const terrain = inside ? c.world.terrain[tile] : T.DEEP;
  if (def?.food) return wouldWaste(c.vitals, def.food) ? NONE : { kind: 'eat', food: def.food };
  if (def?.place) {
    const ok = canPlace(c.world, c.structures, c.occupied, x, y, c.pos, STRUCTURES[def.place].solid);
    return ok.ok ? { kind: 'place', type: def.place, x, y } : blocked({ reason: 'cannotPlace', why: ok.reason });
  }
  if (def?.seed) return plot && !plot.crop ? { kind: 'plant', x, y, crop: def.seed } : NONE;
  if (def?.tool?.type === 'hoe') {
    if (!canTill(c.world, c.farm, c.occupied, x, y)) return NONE;
    return c.vitals.stamina < STAMINA_TOOL ? blocked({ reason: 'tired' }) : { kind: 'till', x, y, stamina: STAMINA_TOOL };
  }
  if (def?.tool?.type === 'can') {
    if (terrain === T.RIVER) return { kind: 'refill', x, y };
    if (terrain === T.SHALLOW) return blocked({ reason: 'saltWater' });
    if (!plot || !plot.crop || plot.watered) return NONE;
    return (slot?.dur ?? 0) > 0 ? { kind: 'water', x, y } : blocked({ reason: 'canEmpty' });
  }

  if (def?.weapon?.kind === 'bow') {
    if (countItem(c.inv, 'arrow') === 0) return blocked({ reason: 'noArrows' });
    if (c.vitals.stamina < def.weapon.stamina) return blocked({ reason: 'tired' });
    return { kind: 'shoot', stats: def.weapon };
  }
  if (c.creature) {
    const melee = meleeFor(slot?.item ?? null);
    return c.vitals.stamina < melee.stamina ? blocked({ reason: 'tired' }) : { kind: 'attack', melee };
  }

  // Facing fresh water means drinking, even if a bush or tree happens to stand within reach behind the hero.
  if (terrain === T.RIVER) return { kind: 'drink', x, y };
  if (c.node) {
    const check = checkHit(c.node.kind, slot?.item ?? null);
    if (!check.ok) return blocked({ reason: 'needsTool', tool: check.tool, tier: check.tier });
    if (c.vitals.stamina < check.stamina) return blocked({ reason: 'tired' });
    return { kind: 'hit', node: c.node, damage: check.damage, stamina: check.stamina, wear: check.wear };
  }
  if (terrain === T.SHALLOW || terrain === T.DEEP) return blocked({ reason: 'saltWater' });
  return NONE;
}
```

The session applies the cost of a blow or a shot (stamina, wear, one arrow) and tells the scene what to resolve; `hurtHero` takes hit points; eating reports an effect so the scene can play a sound:

`src/sim/session.ts`:

```typescript
import { Rng, hashString } from '@/core/rng';
import type { SaveSlot } from '@/core/saveData';
import { ITEMS, type ItemId, type WeaponStats } from '@/data/items';
import type { Recipe } from '@/data/recipes';
import type { Station } from '@/data/structures';
import type { Action } from '@/sim/actions';
import { advance, canSleep, wakeUp, type Clock } from '@/sim/daynight';
import { applyDeath } from '@/sim/death';
import * as farmSim from '@/sim/farm';
import { hitNode, startNewDay, type GatherState } from '@/sim/gather';
import {
  addItem, moveSlot, removeItem, setDurability, takeOne, wearTool, type Inventory, type Slot,
} from '@/sim/inventory';
import type { Melee } from '@/sim/melee';
import { craft } from '@/sim/crafting';
import type { Vec } from '@/sim/movement';
import { placeStructure, removeStructure, setStructureInventory, structureAt, type Structure, type Structures } from '@/sim/structures';
import { eat, sleepRecovery, spendStamina, takeDamage, tickVitals, type Difficulty, type Vitals } from '@/sim/vitals';
import { idx, type Biome, type ResourceNode } from '@/sim/world/types';

/** The live game state that changes while playing. Pure data: every function here returns a new Session. */
export interface Session {
  seed: number;
  difficulty: Difficulty;
  clock: Clock;
  gather: GatherState;
  inventory: Inventory;
  selected: number;
  vitals: Vitals;
  structures: Structures;
  farm: farmSim.Farm;
  respawn: Vec;
  playTime: number;
}

/** Something the scene should show or do as a result of a rule: floating text, a sprite change, a dialog. */
export type Fx =
  | { t: 'say'; key: string; vars?: Record<string, string | number>; /** Variables that are i18n keys to translate. */ translate?: string[] }
  | { t: 'gain'; item: ItemId; qty: number }
  | { t: 'swing' }
  | { t: 'strike'; melee: Melee }
  | { t: 'shot'; stats: WeaponStats }
  | { t: 'hit'; id: number }
  | { t: 'gone'; id: number }
  | { t: 'built'; structure: Structure }
  | { t: 'unbuilt'; id: number }
  | { t: 'plot'; tile: number }
  | { t: 'open'; structure: Structure }
  | { t: 'slept' }
  | { t: 'ate' };

export interface Step {
  session: Session;
  fx: Fx[];
}

export function sessionFromSlot(slot: SaveSlot): Session {
  return {
    seed: slot.seed, difficulty: slot.difficulty, clock: slot.clock, gather: slot.gather, inventory: slot.inventory,
    selected: slot.selected, vitals: slot.vitals, structures: slot.structures, farm: slot.farm, respawn: slot.respawn,
    playTime: slot.playTimeSec,
  };
}

/** Merge the live state back into a slot record for saving. */
export function sessionToSlot(base: SaveSlot, s: Session, pos: Vec): SaveSlot {
  return {
    ...base, player: { x: pos.x, y: pos.y }, respawn: s.respawn, clock: s.clock, gather: s.gather, inventory: s.inventory,
    selected: s.selected, vitals: s.vitals, structures: s.structures, farm: s.farm, playTimeSec: s.playTime,
  };
}

/** Advance time: the clock runs and the vital meters drain or recover. */
export function tickSession(s: Session, dt: number, biome: Biome, busy: boolean): Session {
  return {
    ...s,
    clock: advance(s.clock, dt),
    playTime: s.playTime + dt,
    vitals: tickVitals(s.vitals, dt, { difficulty: s.difficulty, biome, busy }),
  };
}

/** A new in-game day: nodes regrow (unless `keepGone` holds them back) and watered crops grow. */
export function rollDay(s: Session, keepGone: (id: number) => boolean): Session {
  return { ...s, gather: startNewDay(s.gather, s.clock.day, keepGone), farm: farmSim.advanceDay(s.farm) };
}

/** A chopped node must not regrow on a tile the player has since built on or tilled. */
export function blocksRegrowth(s: Session, node: ResourceNode, size: number): boolean {
  return structureAt(s.structures, node.x, node.y) !== undefined || idx(node.x, node.y, size) in s.farm.plots;
}

/** A blow from a creature: hit points are lost, nothing else. */
export function hurtHero(s: Session, amount: number): Session {
  return amount > 0 ? { ...s, vitals: takeDamage(s.vitals, amount) } : s;
}

export function selectSlot(s: Session, index: number): Session {
  return index >= 0 && index < 8 ? { ...s, selected: index } : s;
}

const say = (key: string, vars?: Record<string, string | number>, translate?: string[]): Fx => ({ t: 'say', key, vars, translate });

function giveItems(inv: Inventory, items: { item: ItemId; qty: number }[]): { inv: Inventory; fx: Fx[]; overflow: boolean } {
  const fx: Fx[] = [];
  let cur = inv;
  let overflow = false;
  for (const it of items) {
    const { inv: next, left } = addItem(cur, it.item, it.qty);
    cur = next;
    if (it.qty - left > 0) fx.push({ t: 'gain', item: it.item, qty: it.qty - left });
    if (left > 0) overflow = true;
  }
  if (overflow) fx.push(say('msgFull'));
  return { inv: cur, fx, overflow };
}

/** The "your tool broke" message when the held slot emptied by wear. */
function brokeFx(before: Slot | null | undefined, after: Inventory, index: number): Fx[] {
  return before && !after[index] ? [say('msgToolBroke', { item: `item_${before.item}` }, ['item'])] : [];
}

function blockedFx(a: Extract<Action, { kind: 'blocked' }>): Fx[] {
  switch (a.reason) {
    case 'needsTool': return [say('msgNeedsTool', { tool: `tool_${a.tool}`, tier: a.tier }, ['tool'])];
    case 'tired': return [say('msgTired')];
    case 'saltWater': return [say('msgSaltWater')];
    case 'canEmpty': return [say('msgCanEmpty')];
    case 'noArrows': return [say('msgNoArrows')];
    case 'chestNotEmpty': return [say('msgChestNotEmpty')];
    case 'cannotPlace': return [say(`msgPlace_${a.why}`)];
  }
}

/** Carry out an action the resolver chose. `pos` is where the hero stands (used for the respawn point). */
export function applyAction(s: Session, a: Action, pos: Vec): Step {
  const slotBefore = s.inventory[s.selected];
  switch (a.kind) {
    case 'none': return { session: s, fx: [] };
    case 'blocked': return { session: s, fx: blockedFx(a) };
    case 'hit': {
      const rng = new Rng(hashString(`${s.seed}:${a.node.id}:${s.gather.hp[a.node.id] ?? 'full'}`));
      const result = hitNode(s.gather, a.node, a.damage, s.clock.day, rng);
      const worn = a.wear ? wearTool(s.inventory, s.selected) : s.inventory;
      const given = giveItems(worn, result.drops.map((d) => ({ item: d.item, qty: d.amount })));
      // The last blow would throw the drops away: the node stands until there is room.
      if (result.destroyed && given.overflow) return { session: s, fx: [say('msgFull')] };
      const fx: Fx[] = [{ t: 'swing' }, { t: 'hit', id: a.node.id }];
      if (result.destroyed) fx.push({ t: 'gone', id: a.node.id });
      return {
        session: { ...s, gather: result.state, inventory: given.inv, vitals: spendStamina(s.vitals, a.stamina) ?? s.vitals },
        fx: [...fx, ...brokeFx(slotBefore, worn, s.selected), ...given.fx],
      };
    }
    case 'attack': {
      const worn = a.melee.wear ? wearTool(s.inventory, s.selected) : s.inventory;
      return {
        session: { ...s, inventory: worn, vitals: spendStamina(s.vitals, a.melee.stamina) ?? s.vitals },
        fx: [{ t: 'swing' }, { t: 'strike', melee: a.melee }, ...brokeFx(slotBefore, worn, s.selected)],
      };
    }
    case 'shoot': {
      const spent = removeItem(s.inventory, 'arrow', 1);
      if (!spent) return { session: s, fx: [say('msgNoArrows')] };
      const worn = wearTool(spent, s.selected);
      return {
        session: { ...s, inventory: worn, vitals: spendStamina(s.vitals, a.stats.stamina) ?? s.vitals },
        fx: [{ t: 'swing' }, { t: 'shot', stats: a.stats }, ...brokeFx(slotBefore, worn, s.selected)],
      };
    }
    case 'place': {
      const structures = placeStructure(s.structures, a.type, a.x, a.y);
      return {
        session: { ...s, structures, inventory: takeOne(s.inventory, s.selected) },
        fx: [{ t: 'built', structure: structures.list[structures.list.length - 1] }],
      };
    }
    case 'pickup': {
      const { inv, left } = addItem(s.inventory, a.structure.type, 1);
      if (left > 0) return { session: s, fx: [say('msgFull')] };
      return {
        session: { ...s, inventory: inv, structures: removeStructure(s.structures, a.structure.id) },
        fx: [{ t: 'unbuilt', id: a.structure.id }, { t: 'gain', item: a.structure.type, qty: 1 }],
      };
    }
    case 'till': {
      const tile = idx(a.x, a.y);
      return {
        session: { ...s, farm: farmSim.till(s.farm, tile), inventory: wearTool(s.inventory, s.selected), vitals: spendStamina(s.vitals, a.stamina) ?? s.vitals },
        fx: [{ t: 'swing' }, { t: 'plot', tile }],
      };
    }
    case 'plant': {
      const tile = idx(a.x, a.y);
      const farm = farmSim.plant(s.farm, tile, a.crop);
      if (!farm) return { session: s, fx: [] };
      return { session: { ...s, farm, inventory: takeOne(s.inventory, s.selected) }, fx: [{ t: 'plot', tile }] };
    }
    case 'water': {
      const tile = idx(a.x, a.y);
      return { session: { ...s, farm: farmSim.water(s.farm, tile), inventory: wearTool(s.inventory, s.selected) }, fx: [{ t: 'swing' }, { t: 'plot', tile }] };
    }
    case 'refill': {
      const cap = ITEMS.watering_can.tool?.durability ?? 0;
      return { session: { ...s, inventory: setDurability(s.inventory, s.selected, cap) }, fx: [say('msgFilled')] };
    }
    case 'eat':
      return { session: { ...s, inventory: takeOne(s.inventory, s.selected), vitals: eat(s.vitals, a.food) }, fx: [{ t: 'ate' }] };
    case 'harvest': {
      const tile = idx(a.x, a.y);
      const rng = new Rng(hashString(`${s.seed}:farm:${tile}:${s.clock.day}`));
      const result = farmSim.harvest(s.farm, tile, rng);
      if (!result) return { session: s, fx: [] };
      const given = giveItems(s.inventory, result.items);
      if (given.overflow) return { session: s, fx: [say('msgFull')] };
      return { session: { ...s, farm: result.farm, inventory: given.inv }, fx: [{ t: 'plot', tile }, ...given.fx] };
    }
    case 'drink':
      return { session: { ...s, vitals: eat(s.vitals, { hunger: 0, thirst: 25, hp: 0 }) }, fx: [say('msgDrank')] };
    case 'open':
      return { session: s, fx: [{ t: 'open', structure: a.structure }] };
    case 'sleep': {
      const respawn = { x: pos.x, y: pos.y };
      if (!canSleep(s.clock)) return { session: { ...s, respawn }, fx: [say('msgSleepDay')] };
      return {
        session: { ...s, respawn, clock: wakeUp(s.clock), vitals: sleepRecovery(s.vitals) },
        fx: [{ t: 'slept' }, say('msgSleepNight')],
      };
    }
  }
}

/** Craft one batch at the stations in reach. Nothing changes when it is not possible. */
export function craftRecipe(s: Session, recipe: Recipe, near: ReadonlySet<Station>): Step {
  const inv = craft(s.inventory, recipe, near);
  if (!inv) return { session: s, fx: [] };
  return { session: { ...s, inventory: inv }, fx: [{ t: 'gain', item: recipe.out, qty: recipe.qty }] };
}

export function moveInventorySlot(s: Session, from: number, to: number): Session {
  return { ...s, inventory: moveSlot(s.inventory, from, to) };
}

/** Put a stack into an inventory; a tool keeps its wear. `left` is what did not fit. */
function putStack(inv: Inventory, slot: Slot): { inv: Inventory; left: number } {
  if (slot.dur === undefined) return addItem(inv, slot.item, slot.qty);
  const free = inv.indexOf(null);
  if (free < 0) return { inv, left: slot.qty };
  return { inv: inv.map((x, i) => (i === free ? slot : x)), left: 0 };
}

/** Move a whole stack between the backpack and a chest; whatever does not fit stays where it was. */
export function transferStack(s: Session, chestId: number, from: 'bag' | 'chest', index: number): Step {
  const chest = s.structures.list.find((p) => p.id === chestId);
  if (!chest?.inv) return { session: s, fx: [] };
  const source = from === 'bag' ? s.inventory : chest.inv;
  const slot = source[index];
  if (!slot) return { session: s, fx: [] };
  const target = from === 'bag' ? chest.inv : s.inventory;
  const { inv: filled, left } = putStack(target, slot);
  if (left === slot.qty) return { session: s, fx: [say('msgFull')] };
  const emptied = source.map((x, i) => (i === index ? (left > 0 ? { ...slot, qty: left } : null) : x));
  const bag = from === 'bag' ? emptied : filled;
  const chestInv = from === 'bag' ? filled : emptied;
  return { session: { ...s, inventory: bag, structures: setStructureInventory(s.structures, chestId, chestInv) }, fx: [] };
}

export interface Death {
  session: Session;
  /** Hardcore: delete the save and return to the menu. */
  wipeSave: boolean;
}

/** The hero collapsed: apply the difficulty's penalty and wake up at the respawn point. */
export function collapse(s: Session, roll: () => number): Death {
  const result = applyDeath(s.difficulty, s.inventory, roll);
  return { session: { ...s, inventory: result.inv, vitals: result.vitals }, wipeSave: result.wipeSave };
}
```

`takeDamage`, and the one-word fix that stops a hero at zero hit points from regenerating (`hp > 0 &&` in the regeneration branch):

`src/sim/vitals.ts`:

```typescript
import { B, type Biome } from '@/sim/world/types';

export type Difficulty = 'relaxed' | 'normal' | 'hardcore';

export const VITAL_MAX = 100;

export interface Vitals {
  readonly hp: number;
  readonly hunger: number;
  readonly thirst: number;
  readonly stamina: number;
}

export const fullVitals = (): Vitals => ({ hp: VITAL_MAX, hunger: VITAL_MAX, thirst: VITAL_MAX, stamina: VITAL_MAX });

/** Hunger lasts about two in-game days (a day is 600 s), thirst a little over one. Values are per second. */
export const HUNGER_RATE = VITAL_MAX / 1200;
export const THIRST_RATE = VITAL_MAX / 800;
/** Hit points lost per second for each empty meter. */
export const STARVE_DAMAGE = 0.6;
/** Hit points regained per second while both meters are above REGEN_THRESHOLD. */
export const REGEN_RATE = 0.4;
export const REGEN_THRESHOLD = 40;
export const STAMINA_REGEN = 10;
export const STAMINA_REGEN_BUSY = 2;
/** Thirst multiplier in the desert. */
export const DESERT_THIRST = 1.6;

const DIFFICULTY_DRAIN: Record<Difficulty, number> = { relaxed: 0.6, normal: 1, hardcore: 1.4 };

export interface VitalsContext {
  difficulty: Difficulty;
  /** Biome under the hero. */
  biome: Biome;
  /** True when the hero acted (swung a tool, etc.) in the last moment, which slows stamina recovery. */
  busy: boolean;
}

const clamp = (v: number): number => Math.min(VITAL_MAX, Math.max(0, v));

export function tickVitals(v: Vitals, dt: number, ctx: VitalsContext): Vitals {
  if (dt <= 0) return v;
  const drain = DIFFICULTY_DRAIN[ctx.difficulty];
  const hunger = clamp(v.hunger - HUNGER_RATE * drain * dt);
  const thirst = clamp(v.thirst - THIRST_RATE * drain * (ctx.biome === B.DESERT ? DESERT_THIRST : 1) * dt);
  let hp = v.hp;
  const empty = (hunger <= 0 ? 1 : 0) + (thirst <= 0 ? 1 : 0);
  if (empty > 0) hp -= STARVE_DAMAGE * drain * empty * dt;
  else if (hp > 0 && hunger >= REGEN_THRESHOLD && thirst >= REGEN_THRESHOLD) hp += REGEN_RATE * dt;
  const stamina = v.stamina + (ctx.busy ? STAMINA_REGEN_BUSY : STAMINA_REGEN) * dt;
  return { hp: clamp(hp), hunger, thirst, stamina: clamp(stamina) };
}

export interface FoodValue {
  hunger: number;
  thirst: number;
  hp: number;
}

export function eat(v: Vitals, food: FoodValue): Vitals {
  return { ...v, hunger: clamp(v.hunger + food.hunger), thirst: clamp(v.thirst + food.thirst), hp: clamp(v.hp + food.hp) };
}

/** True when eating this would change nothing (all three affected meters are already full). */
export function wouldWaste(v: Vitals, food: FoodValue): boolean {
  return (food.hunger <= 0 || v.hunger >= VITAL_MAX) && (food.thirst <= 0 || v.thirst >= VITAL_MAX) && (food.hp <= 0 || v.hp >= VITAL_MAX);
}

/** Lose hit points to a blow; the other meters are untouched. */
export function takeDamage(v: Vitals, amount: number): Vitals {
  return amount > 0 ? { ...v, hp: clamp(v.hp - amount) } : v;
}

/** Pay a stamina cost, or null when the hero is too tired. */
export function spendStamina(v: Vitals, cost: number): Vitals | null {
  if (v.stamina < cost) return null;
  return { ...v, stamina: v.stamina - cost };
}

export const isDead = (v: Vitals): boolean => v.hp <= 0;

/** A night's sleep: rest and heal, at the price of some food and water. */
export function sleepRecovery(v: Vitals): Vitals {
  return { hp: clamp(v.hp + 40), hunger: clamp(v.hunger - 15), thirst: clamp(v.thirst - 15), stamina: VITAL_MAX };
}
```

- [ ] **Step 4: Run the tests, the typecheck and the whole suite**

Run: `npx vitest run tests/melee.test.ts tests/actions-combat.test.ts tests/session-combat.test.ts tests/vitals.test.ts tests/actions.test.ts tests/session.test.ts && npm run typecheck`
Expected: melee 3, actions-combat 8, session-combat 8, vitals 14, actions 18, session 32 tests PASS; typecheck prints errors only for `src/scenes/GameScene.ts` (the context now needs `creature`); Task 9 fixes that, and the next step commits anyway, because the unit suite is green.

Run: `npx vitest run`
Expected: the whole suite passes (364 tests).

- [ ] **Step 5: Commit**

```bash
git add src/sim/melee.ts src/sim/actions.ts src/sim/session.ts src/sim/vitals.ts tests/melee.test.ts tests/actions-combat.test.ts tests/session-combat.test.ts tests/vitals.test.ts tests/actions.test.ts
git commit -m "feat: add attack and shoot actions and hero damage; fix: no healing at zero hit points"
```

---

### Task 8: Synthesized sound and music

**Files:**
- Create: `tools/audio_kit.py`, `tools/gen_sfx.py`, `tools/gen_music.py`, `tools/gen_audio.py`, `src/sim/cues.ts`
- Modify: `package.json` (one script)
- Generated: `public/assets/audio/sfx.ogg`, `sfx.json`, `music_day.ogg`, `music_night.ogg`, `music_battle.ogg`
- Test: `tests/cues.test.ts` (new)

**Interfaces:**
- Consumes: `Fx`, `EncounterEvent`, `ResourceKind`.
- Produces: `CUES` (16 names), `Cue`, `Mood = 'day' | 'night' | 'battle'`, `cueForNode(kind)`, `cueForFx(fx, nodeKind?) -> Cue | null`, `cueForEncounter(ev) -> Cue`, `musicFor(night, fighting) -> Mood`; the audio sprite `sfx.json` (`spritemap` with a clip for every cue) and the three loops.

- [ ] **Step 1: Write the failing test**

`tests/cues.test.ts`:

```typescript
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CUES, cueForEncounter, cueForFx, cueForNode, musicFor, type Cue } from '@/sim/cues';
import type { Fx } from '@/sim/session';
import type { ResourceKind } from '@/sim/world/types';

describe('cueForFx', () => {
  const cue = (fx: Fx, kind?: ResourceKind): Cue | null => cueForFx(fx, kind);

  it('maps the hero actions to their sounds', () => {
    expect(cue({ t: 'swing' })).toBe('swing');
    expect(cue({ t: 'gain', item: 'wood', qty: 1 })).toBe('pickup');
    expect(cue({ t: 'built', structure: { id: 1, type: 'fence', x: 1, y: 1 } })).toBe('place');
    expect(cue({ t: 'unbuilt', id: 1 })).toBe('pickup');
    expect(cue({ t: 'slept' })).toBe('sleep');
    expect(cue({ t: 'ate' })).toBe('eat');
    expect(cue({ t: 'shot', stats: { kind: 'bow', damage: 1, reach: 1, arc: 0, cooldown: 1, stamina: 1, knockback: 0 } })).toBe('shoot');
    expect(cue({ t: 'open', structure: { id: 1, type: 'chest', x: 1, y: 1 } })).toBe('ui_click');
  });

  it('says what a hit on a node sounds like from the kind of node', () => {
    expect(cue({ t: 'hit', id: 1 }, 'tree')).toBe('chop');
    expect(cue({ t: 'hit', id: 1 }, 'rock')).toBe('mine');
    expect(cue({ t: 'hit', id: 1 })).toBe('chop');
    for (const k of ['tree', 'palm', 'swamptree', 'bush'] as const) expect(cueForNode(k), k).toBe('chop');
    for (const k of ['rock', 'redrock', 'ore', 'crystal'] as const) expect(cueForNode(k), k).toBe('mine');
  });

  it('plays a sound for a broken tool, drinking and filling the can, and stays quiet for other messages', () => {
    const say = (key: string): Fx => ({ t: 'say', key });
    expect(cue(say('msgToolBroke'))).toBe('break');
    expect(cue(say('msgDrank'))).toBe('drink');
    expect(cue(say('msgFilled'))).toBe('drink');
    expect(cue(say('msgFull'))).toBeNull();
    expect(cue({ t: 'strike', melee: { damage: 1, reach: 1, arc: 90, knockback: 0, stamina: 1, cooldown: 1, wear: false } })).toBeNull();
    expect(cue({ t: 'gone', id: 1 })).toBeNull();
  });
});

describe('cueForEncounter', () => {
  it('has a sound for a creature being hit or killed and for the hero being hurt', () => {
    expect(cueForEncounter({ t: 'hit', id: 1, kind: 'slime', amount: 2, x: 0, y: 0 })).toBe('hit');
    expect(cueForEncounter({ t: 'killed', id: 1, kind: 'slime', x: 0, y: 0 })).toBe('kill');
    expect(cueForEncounter({ t: 'hurtHero', amount: 3, from: { x: 0, y: 0 }, kind: 'slime' })).toBe('hurt');
  });
});

describe('musicFor', () => {
  it('plays the battle theme in a fight, otherwise day or night music', () => {
    expect(musicFor(false, false)).toBe('day');
    expect(musicFor(true, false)).toBe('night');
    expect(musicFor(false, true)).toBe('battle');
    expect(musicFor(true, true)).toBe('battle');
  });
});

describe('audio files', () => {
  const dir = path.resolve(__dirname, '../public/assets/audio');
  const ready = fs.existsSync(path.join(dir, 'sfx.json'));

  it.skipIf(!ready)('has a clip in the sound sprite for every cue, none overlapping, inside the file', () => {
    const sprite = JSON.parse(fs.readFileSync(path.join(dir, 'sfx.json'), 'utf8')) as { spritemap: Record<string, { start: number; end: number }> };
    for (const c of CUES) expect(sprite.spritemap[c], c).toBeDefined();
    const clips = Object.values(sprite.spritemap).sort((a, b) => a.start - b.start);
    clips.forEach((clip, i) => {
      expect(clip.end).toBeGreaterThan(clip.start);
      if (i > 0) expect(clip.start).toBeGreaterThanOrEqual(clips[i - 1].end);
    });
    expect(fs.statSync(path.join(dir, 'sfx.ogg')).size).toBeGreaterThan(5_000);
  });

  it.skipIf(!ready)('has a music loop for every mood, and keeps the whole audio folder small', () => {
    for (const mood of ['day', 'night', 'battle']) expect(fs.statSync(path.join(dir, `music_${mood}.ogg`)).size, mood).toBeGreaterThan(50_000);
    const total = fs.readdirSync(dir).reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0);
    expect(total).toBeLessThan(3 * 1024 * 1024);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/cues.test.ts`
Expected: FAIL, "Failed to resolve import "@/sim/cues"".

- [ ] **Step 3: Write the cue rules**

`src/sim/cues.ts`:

```typescript
import type { EncounterEvent } from '@/sim/encounters';
import type { Fx } from '@/sim/session';
import type { ResourceKind } from '@/sim/world/types';

/** Names of the sound effects in the audio sprite (tools/gen_sfx.py makes one clip for each). */
export const CUES = [
  'swing', 'hit', 'kill', 'hurt', 'shoot', 'pickup', 'chop', 'mine', 'eat', 'drink', 'craft', 'place', 'break', 'sleep', 'ui_click', 'death',
] as const;
export type Cue = (typeof CUES)[number];

export type Mood = 'day' | 'night' | 'battle';

/** Cutting a tree or a bush chops; rocks, ore and crystal ring. */
export function cueForNode(kind: ResourceKind): Cue {
  return kind === 'tree' || kind === 'palm' || kind === 'swamptree' || kind === 'bush' ? 'chop' : 'mine';
}

/** The sound that goes with an effect of the rules, or null when it is silent. `node` is the kind of node a 'hit' landed on. */
export function cueForFx(fx: Fx, node?: ResourceKind): Cue | null {
  switch (fx.t) {
    case 'swing': return 'swing';
    case 'shot': return 'shoot';
    case 'hit': return node ? cueForNode(node) : 'chop';
    case 'gain': case 'unbuilt': return 'pickup';
    case 'built': return 'place';
    case 'open': return 'ui_click';
    case 'slept': return 'sleep';
    case 'ate': return 'eat';
    case 'say': return fx.key === 'msgToolBroke' ? 'break' : fx.key === 'msgDrank' || fx.key === 'msgFilled' ? 'drink' : null;
    default: return null;
  }
}

/** The sound of something that happened among the creatures. */
export function cueForEncounter(ev: EncounterEvent): Cue {
  return ev.t === 'hit' ? 'hit' : ev.t === 'killed' ? 'kill' : 'hurt';
}

/** Battle music while monsters are on the hero; otherwise the music of the time of day. */
export const musicFor = (night: boolean, fighting: boolean): Mood => (fighting ? 'battle' : night ? 'night' : 'day');
```

- [ ] **Step 4: Write the audio tools**

A tiny numpy synthesizer (oscillators, noise, envelopes, filters, echo) shared by the effect and music scripts:

`tools/audio_kit.py`:

```python
"""Tiny software synthesizer used by gen_sfx.py and gen_music.py (numpy only, no samples, no network).

Everything is mono float32 in [-1, 1]. Frequencies may be a number or an array (one value per sample) for sweeps.
"""
import wave

import numpy as np
from scipy import signal

SR = 32000


def samples(dur):
    return int(round(SR * dur))


def _freq_array(freq, n):
    return np.full(n, float(freq)) if np.isscalar(freq) else np.asarray(freq, dtype=float)


def sweep(f0, f1, dur, curve=2.0):
    """Frequencies that glide from f0 to f1 (curve > 1 moves fast at first, like a drop in pitch)."""
    n = samples(dur)
    k = (np.arange(n) / max(1, n - 1)) ** curve
    return f0 + (f1 - f0) * k


def osc(kind, freq, dur, duty=0.5):
    n = samples(dur)
    phase = np.cumsum(_freq_array(freq, n)) / SR
    frac = phase % 1.0
    if kind == "sine":
        return np.sin(2 * np.pi * phase)
    if kind == "square":
        return np.where(frac < duty, 1.0, -1.0)
    if kind == "tri":
        return 4 * np.abs(frac - 0.5) - 1
    if kind == "saw":
        return 2 * frac - 1
    raise ValueError(kind)


def noise(dur, seed=1):
    return np.random.default_rng(seed).uniform(-1, 1, samples(dur))


def lowpass(x, cutoff, order=2):
    b, a = signal.butter(order, cutoff / (SR / 2), "low")
    return signal.lfilter(b, a, x)


def highpass(x, cutoff, order=2):
    b, a = signal.butter(order, cutoff / (SR / 2), "high")
    return signal.lfilter(b, a, x)


def decay(n, rate=6.0, attack=0.004):
    """Fast attack, exponential fall: the shape of most plucks, knocks and hits."""
    t = np.arange(n) / SR
    env = np.exp(-rate * t / max(1e-3, n / SR))
    a = max(1, int(attack * SR))
    env[:a] *= np.linspace(0, 1, a)
    return env


def swell(n, attack=0.3, release=0.3):
    """Slow fade in and out for pads."""
    a = max(1, int(attack * n))
    r = max(1, int(release * n))
    env = np.ones(n)
    env[:a] = np.linspace(0, 1, a)
    env[-r:] = np.linspace(1, 0, r)
    return env


def shaped(x, rate=6.0, attack=0.004):
    return x * decay(len(x), rate, attack)


def place(sig, clips):
    """Mix clips into one buffer: clips is a list of (start_seconds, samples)."""
    end = max(int(round(s * SR)) + len(c) for s, c in clips)
    out = np.zeros(max(end, len(sig)))
    out[: len(sig)] += sig
    for start, clip in clips:
        i = int(round(start * SR))
        out[i : i + len(clip)] += clip
    return out


def mix(clips):
    return place(np.zeros(0), clips)


def delay(x, seconds, feedback=0.35, taps=4):
    """A simple echo: copies of the sound, each quieter, appended after it."""
    out = np.concatenate([x, np.zeros(int(SR * seconds * taps))])
    gain = 1.0
    for i in range(1, taps + 1):
        gain *= feedback
        shift = int(SR * seconds * i)
        out[shift : shift + len(x)] += x * gain
    return out


def limit(x, peak=0.85):
    """Gentle saturation, then scale so the loudest sample is exactly `peak`."""
    y = np.tanh(1.4 * x)
    return y * (peak / max(1e-9, np.max(np.abs(y))))


def save_wav(path, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
```

Sixteen effects built from it (knocks, swishes, blips, a chime):

`tools/gen_sfx.py`:

```python
"""The game's sound effects, synthesized from scratch. Each function returns one mono clip; CUES maps names to clips."""
import numpy as np

from audio_kit import SR, decay, highpass, lowpass, mix, noise, osc, shaped, sweep, swell


def note(kind, freq, dur, rate=6.0, duty=0.5, vol=1.0):
    return vol * shaped(osc(kind, freq, dur, duty), rate)


def swing():
    n = highpass(noise(0.16, 3), 900)
    t = np.arange(len(n)) / SR
    return 0.7 * n * np.sin(np.pi * np.minimum(1, t / 0.16)) ** 1.5


def hit():
    thump = note("sine", sweep(190, 55, 0.14), 0.14, 5.0)
    click = shaped(lowpass(noise(0.05, 5), 3200), 7.0, 0.001)
    return mix([(0, 0.9 * thump), (0, 0.6 * click)])


def kill():
    notes = [(i * 0.07, note("square", f, 0.12, 5.0, 0.25, 0.5)) for i, f in enumerate([660, 523, 392, 262])]
    puff = shaped(lowpass(noise(0.25, 9), 1800), 5.0)
    return mix(notes + [(0.02, 0.5 * puff)])


def hurt():
    return note("saw", sweep(340, 90, 0.26, 1.6) * (1 + 0.04 * np.sin(np.arange(int(SR * 0.26)) / 90)), 0.26, 3.5, vol=0.7)


def shoot():
    whoosh = shaped(highpass(lowpass(noise(0.2, 11), 5000), 700), 3.0, 0.02)
    twang = note("sine", sweep(1100, 420, 0.14), 0.14, 6.0, vol=0.6)
    return mix([(0, 0.6 * whoosh), (0, twang)])


def pickup():
    return mix([(0, note("square", 988, 0.07, 6.0, 0.25, 0.5)), (0.06, note("square", 1319, 0.12, 6.0, 0.25, 0.5))])


def chop():
    thunk = note("sine", sweep(210, 80, 0.12), 0.12, 6.0)
    crack = shaped(lowpass(noise(0.04, 13), 4000), 8.0, 0.001)
    return mix([(0, thunk), (0, 0.5 * crack)])


def mine():
    ring = note("sine", 2100, 0.2, 7.0, vol=0.45) + note("sine", 3170, 0.2, 9.0, vol=0.25)
    thunk = note("sine", sweep(160, 70, 0.1), 0.1, 6.0)
    return mix([(0, ring), (0, 0.8 * thunk)])


def eat():
    bites = [(i * 0.09, shaped(lowpass(noise(0.06, 20 + i), 2200), 9.0, 0.002) * 0.9) for i in range(3)]
    return mix(bites)


def drink():
    drops = [(i * 0.08, note("sine", sweep(480 + 80 * i, 900 + 80 * i, 0.06, 1.0), 0.06, 4.0, vol=0.6)) for i in range(3)]
    return mix(drops)


def craft():
    return mix([(0, note("tri", 523, 0.1, 6.0)), (0.09, note("tri", 784, 0.22, 4.5)), (0.09, note("sine", 1568, 0.2, 7.0, vol=0.25))])


def place():
    return mix([(0, note("sine", sweep(150, 85, 0.13), 0.13, 6.0)), (0, 0.4 * shaped(lowpass(noise(0.03, 7), 2500), 8.0, 0.001))])


def break_():
    crack = shaped(lowpass(noise(0.22, 17), 3500), 4.5, 0.001)
    fall = note("square", sweep(420, 110, 0.22), 0.22, 5.0, 0.5, 0.35)
    return mix([(0, 0.8 * crack), (0, fall)])


def sleep():
    chord = sum(osc("sine", f, 0.9) for f in (262, 330, 392)) / 3
    return 0.8 * chord * swell(len(chord), 0.35, 0.5)


def ui_click():
    return note("square", 1250, 0.035, 8.0, 0.5, 0.45)


def death():
    steps = [(i * 0.2, note("tri", f, 0.34, 3.5)) for i, f in enumerate([440, 415, 349, 262])]
    return mix(steps)


CUES = {
    "swing": swing, "hit": hit, "kill": kill, "hurt": hurt, "shoot": shoot, "pickup": pickup, "chop": chop, "mine": mine,
    "eat": eat, "drink": drink, "craft": craft, "place": place, "break": break_, "sleep": sleep, "ui_click": ui_click,
    "death": death,
}

# Loudness of each cue relative to the loudest (1.0); every clip is first scaled to the same peak.
LEVEL = {
    "ui_click": 0.45, "eat": 0.6, "drink": 0.55, "pickup": 0.7, "swing": 0.65, "sleep": 0.55, "place": 0.8, "chop": 0.85, "craft": 0.8,
    "kill": 0.85, "shoot": 0.75,
}
```

Three loops composed by code: chords, a seeded melody and a small drum kit; anything that rings past the end is folded onto the start so the loop has no seam:

`tools/gen_music.py`:

```python
"""Three looping music tracks (day, night, battle), composed by code: chords, a seeded melody and a small drum kit."""
import random

import numpy as np

from audio_kit import SR, delay, highpass, limit, mix, noise, osc, samples, shaped, sweep, swell


def freq(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def lead(m, secs, wave="square", duty=0.25, vol=0.5):
    vib = 1 + 0.006 * np.sin(2 * np.pi * 5.5 * np.arange(samples(secs)) / SR)
    return vol * shaped(osc(wave, freq(m) * vib, secs, duty), 3.0, 0.006)


def bass(m, secs, wave="tri", vol=0.7):
    return vol * shaped(osc(wave, freq(m), secs), 2.2, 0.006)


def pad(chord, secs, vol=0.14):
    x = sum(osc("sine", freq(m), secs) + 0.4 * osc("tri", freq(m) * 2, secs) for m in chord) / len(chord)
    return vol * x * swell(len(x), 0.3, 0.45)


def kick():
    return 0.9 * shaped(osc("sine", sweep(130, 42, 0.2, 3.0), 0.2), 6.0, 0.001)


def snare():
    return mix([(0, 0.5 * shaped(highpass(noise(0.16, 31), 1200), 6.0, 0.001)), (0, 0.3 * shaped(osc("tri", 190, 0.12), 8.0, 0.001))])


def hat(vol=0.18):
    return vol * shaped(highpass(noise(0.05, 37), 6000), 8.0, 0.001)


def melody(rng, scale, chord_tones, bars, per_bar=8, rest=0.35):
    """A seeded random walk over `scale`: returns (eighth_index, length_in_eighths, midi) tuples."""
    out = []
    pos = min(range(len(scale)), key=lambda i: abs(scale[i] - chord_tones[0]))
    i = 0
    total = bars * per_bar
    while i < total:
        length = rng.choice([1, 1, 2, 2, 3])
        length = min(length, total - i)
        if rng.random() > rest or i % per_bar == 0:
            pos = max(0, min(len(scale) - 1, pos + rng.choice([-2, -1, -1, 0, 1, 1, 2])))
            out.append((i, length, scale[pos]))
        i += length
    return out


def render(clips, loop_secs, peak=0.8):
    """Mix the clips and fold anything that rings past the end back onto the start, so the loop has no seam."""
    buf = mix(clips)
    n = samples(loop_secs)
    body = np.zeros(n)
    body += buf[:n] if len(buf) >= n else np.pad(buf, (0, n - len(buf)))
    tail = buf[n:]
    body[: len(tail)] += tail[:n]
    return limit(body, peak)


def day():
    rng = random.Random(7)
    bpm, bars = 92, 16
    spb = 60 / bpm
    chords = [(48, (60, 64, 67)), (45, (57, 60, 64)), (41, (53, 57, 60)), (43, (55, 59, 62))]
    scale = [60, 62, 64, 67, 69, 72, 74, 76, 79]
    clips = []
    for bar in range(bars):
        root, tones = chords[bar % 4]
        t0 = bar * 4 * spb
        clips.append((t0, pad(tones, 4 * spb)))
        for beat, step in ((0, 0), (2, 0), (3, 7)):
            clips.append((t0 + beat * spb, bass(root + step, 1.6 * spb)))
        for e in range(8):
            if e % 2 == 1:
                clips.append((t0 + e * spb / 2, hat(0.1)))
    phrase_a = melody(rng, scale, (64,), 4)
    phrase_b = melody(rng, scale, (67,), 4)
    for cycle in range(4):
        phrase = phrase_a if cycle % 2 == 0 else phrase_b
        for eighth, length, m in phrase:
            start = (cycle * 16 + eighth) * spb / 2
            clips.append((start, lead(m, length * spb / 2 * 0.92)))
    return render(clips, bars * 4 * spb)


def night():
    rng = random.Random(11)
    bpm, bars = 62, 12
    spb = 60 / bpm
    chords = [(45, (57, 60, 64)), (41, (53, 57, 60)), (36, (55, 60, 64)), (43, (55, 59, 62))]
    scale = [69, 72, 74, 76, 79, 81, 84]
    clips = []
    for bar in range(bars):
        root, tones = chords[bar % 4]
        t0 = bar * 4 * spb
        clips.append((t0, pad(tones, 4 * spb, 0.2)))
        clips.append((t0, bass(root - 12, 3.8 * spb, "sine", 0.55)))
    bells = []
    for beat in range(bars * 4):
        if rng.random() < 0.55:
            m = rng.choice(scale)
            bell = 0.3 * shaped(osc("sine", freq(m), 1.4), 3.0, 0.004) + 0.12 * shaped(osc("sine", freq(m) * 2.01, 1.4), 5.0, 0.004)
            bells.append((beat * spb, delay(bell, spb * 1.5, 0.45, 3)))
    clips += bells
    return render(clips, bars * 4 * spb, 0.7)


def battle():
    rng = random.Random(23)
    bpm, bars = 150, 16
    spb = 60 / bpm
    chords = [(40, (64, 67, 71)), (36, (60, 64, 67)), (38, (62, 66, 69)), (35, (59, 62, 66))]
    scale = [64, 67, 69, 71, 74, 76, 79]
    clips = []
    for bar in range(bars):
        root, _ = chords[bar % 4]
        t0 = bar * 4 * spb
        for e in range(8):
            step = 7 if e in (3, 7) else 0
            clips.append((t0 + e * spb / 2, bass(root + step, 0.45 * spb, "square", 0.32)))
        for beat in range(4):
            clips.append((t0 + beat * spb, kick()))
            if beat % 2 == 1:
                clips.append((t0 + beat * spb, snare()))
            clips.append((t0 + (beat + 0.5) * spb, hat(0.16)))
    motif = melody(rng, scale, (71,), 2, 8, 0.2)
    for rep in range(bars // 2):
        for eighth, length, m in motif:
            clips.append(((rep * 8 + eighth) * spb / 2, lead(m + (12 if rep % 4 == 3 else 0), length * spb / 2 * 0.85, "saw", 0.5, 0.32)))
    return render(clips, bars * 4 * spb, 0.8)


TRACKS = {"music_day": day, "music_night": night, "music_battle": battle}
```

The driver: it lays the effects out in one sprite with a gap after each, writes the map, and encodes everything to Ogg Vorbis with ffmpeg:

`tools/gen_audio.py`:

```python
"""Build the game's audio offline: public/assets/audio/sfx.ogg + sfx.json (a Phaser audio sprite) and the music loops.

Everything is synthesized by tools/gen_sfx.py and tools/gen_music.py (no samples, no network, no API keys).
Encoding uses the ffmpeg binary that ships inside the imageio-ffmpeg Python package (or `ffmpeg` on PATH).
Run:  python tools/gen_audio.py
"""
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

import numpy as np

from audio_kit import SR, save_wav
from gen_music import TRACKS
from gen_sfx import CUES, LEVEL

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "assets" / "audio"
GAP = 0.15


def ffmpeg():
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        found = shutil.which("ffmpeg")
        if not found:
            raise SystemExit("ffmpeg not found: pip install imageio-ffmpeg or put ffmpeg on PATH")
        return found


def encode(wav, ogg, quality):
    subprocess.run([ffmpeg(), "-y", "-loglevel", "error", "-i", str(wav), "-c:a", "libvorbis", "-q:a", str(quality), str(ogg)], check=True)


def build_sprite(tmp):
    """All sound effects back to back with a gap between them, plus the map of where each one starts and ends."""
    pieces, spritemap, cursor = [], {}, 0.0
    gap = np.zeros(int(SR * GAP))
    for name, make in CUES.items():
        clip = make()
        peak = float(np.max(np.abs(clip)))
        clip = clip * (0.85 * LEVEL.get(name, 1.0) / peak) if peak > 0 else clip
        spritemap[name] = {"start": round(cursor, 3), "end": round(cursor + len(clip) / SR, 3), "loop": False}
        pieces += [clip, gap]
        cursor += len(clip) / SR + GAP
    wav = tmp / "sfx.wav"
    save_wav(wav, np.concatenate(pieces))
    return wav, spritemap


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as d:
        tmp = Path(d)
        wav, spritemap = build_sprite(tmp)
        encode(wav, OUT / "sfx.ogg", 3)
        (OUT / "sfx.json").write_text(json.dumps({"resources": ["sfx.ogg"], "spritemap": spritemap}, indent=1), encoding="utf-8")
        print(f"sfx: {len(spritemap)} cues, {(OUT / 'sfx.ogg').stat().st_size // 1024} KB")
        for name, make in TRACKS.items():
            wav = tmp / f"{name}.wav"
            track = make()
            save_wav(wav, track)
            encode(wav, OUT / f"{name}.ogg", 3)
            print(f"{name}: {len(track) / SR:.1f} s, {(OUT / f'{name}.ogg').stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
```

In `package.json`, add this line to `"scripts"`, right after the `"assets"` line:

```json
    "audio": "python tools/gen_audio.py",
```

- [ ] **Step 5: Generate the audio**

Run: `npm run audio`
Expected: prints `sfx: 16 cues, 35 KB`, `music_day: 41.7 s, ~330 KB`, `music_night: 46.5 s, ~300 KB`, `music_battle: 25.6 s, ~235 KB`; the five files exist in `public/assets/audio/`. Play them in any player if you like; the tracks are placeholders that the audio pass in plan 6 can replace without code changes.

- [ ] **Step 6: Run the tests, the typecheck and the whole suite**

Run: `npx vitest run tests/cues.test.ts && npm run typecheck && npm test`
Expected: cues 7 tests PASS (the two audio-file tests now run because the files exist); typecheck prints errors only for `src/scenes/GameScene.ts` (fixed in Task 9); the whole suite passes (371 tests).

- [ ] **Step 7: Commit**

```bash
git add tools/audio_kit.py tools/gen_sfx.py tools/gen_music.py tools/gen_audio.py src/sim/cues.ts package.json public/assets/audio tests/cues.test.ts
git commit -m "feat: add synthesized sound effects and music with sound cue rules"
```

---

### Task 9: Creatures, combat feedback, loot and sound on the island

**Files:**
- Create: `src/gfx/FloatText.ts`, `src/gfx/CreatureLayer.ts`, `src/game/InputReader.ts`, `src/game/Wildlife.ts`, `src/game/HeroCombat.ts`, `src/game/MusicDirector.ts`
- Replace: `src/sim/solids.ts`, `src/entities/Player.ts`, `src/scenes/GameScene.ts`, `src/scenes/PreloadScene.ts`
- Modify: `src/gfx/animations.ts`, `src/scenes/BootScene.ts`, `src/scenes/MenuScene.ts` (one block each)
- Test: `tests/blocking.test.ts` (new)

**Interfaces:**
- Consumes: everything from Tasks 1 to 8.
- Produces: `blockingTiles(world, props, {gather, structures, farm}) -> {solids, occupied}` (moved out of the scene); `Player` gains `vulnerable`, `hurt()`, `tick(dt)`, `recover()`; `GameScene` exposes `player`, `float`, `solids`, `dead`, `hitStop`, `showGain(text)`; `Wildlife` (state + sprites), `HeroCombat` (`reaches`, `onFx`, `tick`, `fighting`, `reset`), `CreatureLayer`, `FloatText`, `InputReader`, `MusicDirector`.

- [ ] **Step 1: Write the failing test**

`tests/blocking.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { emptyFarm, till } from '@/sim/farm';
import { emptyGather, hitNode } from '@/sim/gather';
import { Rng } from '@/core/rng';
import { blockingTiles } from '@/sim/solids';
import { emptyStructures, placeStructure } from '@/sim/structures';
import { T, WORLD_SIZE, idx, type ResourceNode, type World } from '@/sim/world/types';

const tree: ResourceNode = { id: 0, kind: 'tree', x: 10, y: 10, variant: 0 };
const rock: ResourceNode = { id: 1, kind: 'rock', x: 12, y: 10, variant: 0 };
const world: World = {
  seed: 0, size: WORLD_SIZE, terrain: new Uint8Array(WORLD_SIZE * WORLD_SIZE).fill(T.GRASS), biome: new Uint8Array(WORLD_SIZE * WORLD_SIZE),
  landmarks: [], resources: [tree, rock], start: { x: 1, y: 1 },
};
const fresh = () => ({ gather: emptyGather(), structures: emptyStructures(), farm: emptyFarm() });

describe('blockingTiles', () => {
  it('blocks living resource nodes and scenery, but not a node that has been cut down', () => {
    const { solids } = blockingTiles(world, [idx(5, 5)], fresh());
    expect([...solids].sort((a, b) => a - b)).toEqual([idx(5, 5), idx(10, 10), idx(12, 10)]);
    const cut = hitNode(emptyGather(), tree, 99, 1, new Rng(1)).state;
    expect(blockingTiles(world, [], { ...fresh(), gather: cut }).solids.has(idx(10, 10))).toBe(false);
  });

  it('blocks solid buildings for walking, and every building and plot for building', () => {
    const structures = placeStructure(placeStructure(emptyStructures(), 'fence', 20, 20), 'torch', 21, 20);
    const { solids, occupied } = blockingTiles(world, [], { ...fresh(), structures, farm: till(emptyFarm(), idx(22, 20)) });
    expect(solids.has(idx(20, 20))).toBe(true);
    expect(solids.has(idx(21, 20))).toBe(false);
    expect(occupied.has(idx(21, 20))).toBe(true);
    expect(occupied.has(idx(22, 20))).toBe(true);
    expect(solids.has(idx(22, 20))).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/blocking.test.ts`
Expected: FAIL, "blockingTiles is not a function" (both tests).

- [ ] **Step 3: Move the blocking-tile rule out of the scene**

`src/sim/solids.ts`:

```typescript
import { LANDMARK_PROPS } from '@/data/landmarkProps';
import type { Farm } from '@/sim/farm';
import { isAlive, type GatherState } from '@/sim/gather';
import { structureSolids, type Structures } from '@/sim/structures';
import { idx, inBounds, type ResourceNode, type World } from '@/sim/world/types';

/** Tile indexes blocked by landmark scenery (huts, columns, statues). */
export function propSolidTiles(world: World): number[] {
  const out: number[] = [];
  for (const l of world.landmarks) {
    for (const prop of LANDMARK_PROPS[l.id]) {
      for (const [bx, by] of prop.blocks ?? []) {
        const x = l.x + bx;
        const y = l.y + by;
        if (inBounds(x, y, world.size)) out.push(idx(x, y, world.size));
      }
    }
  }
  return out;
}

/** Resource nodes keyed by the tile they stand on. */
export function nodesByTile(world: World): Map<number, ResourceNode> {
  return new Map(world.resources.map((n) => [idx(n.x, n.y, world.size), n]));
}

export interface Blocking {
  /** Tiles the hero and the creatures cannot walk through. */
  solids: Set<number>;
  /** Tiles nothing can be built or tilled on: all of the above, plus torches and soil. */
  occupied: Set<number>;
}

/** Living nodes, landmark scenery and solid buildings block walking; every building and every plot blocks building. */
export function blockingTiles(world: World, props: readonly number[], s: { gather: GatherState; structures: Structures; farm: Farm }): Blocking {
  const solids = new Set<number>(props);
  for (const n of world.resources) if (isAlive(s.gather, n.id)) solids.add(idx(n.x, n.y, world.size));
  for (const tile of structureSolids(s.structures, world.size)) solids.add(tile);
  const occupied = new Set<number>(solids);
  for (const p of s.structures.list) occupied.add(idx(p.x, p.y, world.size));
  for (const key of Object.keys(s.farm.plots)) occupied.add(Number(key));
  return { solids, occupied };
}
```

- [ ] **Step 4: Write the island's fighting side**

Floating texts (item gains and damage numbers) and the keyboard and touch reader, both lifted out of `GameScene`:

`src/gfx/FloatText.ts`:

```typescript
import Phaser from 'phaser';
import { COLORS, FONT } from '@/ui/theme';

/** Small texts that rise from a spot in the world and fade: picked-up items, damage numbers. */
export class FloatText {
  private row = 0;

  constructor(private scene: Phaser.Scene) {}

  /** Start a new group of texts: the next `show` calls with `stack` begin at the bottom again. */
  newGroup(): void {
    this.row = 0;
  }

  /** `x` and `y` are world pixels. With `stack`, texts shown in the same group sit on top of each other without overlapping. */
  show(x: number, y: number, text: string, color: number = COLORS.gold, stack = false): void {
    const top = stack ? y - this.row++ * 8 : y;
    const label = this.scene.add.bitmapText(x, top, FONT.small, text).setOrigin(0.5).setTint(color).setScale(0.5).setDepth(1_000_000);
    this.scene.tweens.add({ targets: label, y: top - 14, alpha: 0, duration: 900, ease: 'Sine.easeOut', onComplete: () => label.destroy() });
  }
}
```

`src/game/InputReader.ts`:

```typescript
import Phaser from 'phaser';
import { controls, takeAction } from '@/game/input';
import type { Vec } from '@/sim/movement';

/** Keyboard (for desktop testing) and the touch controls, read once per frame by the island scene. */
export class InputReader {
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: Record<'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
  private actionKeys: Phaser.Input.Keyboard.Key[] = [];
  private digitKeys: Phaser.Input.Keyboard.Key[] = [];

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (!kb) return;
    this.cursors = kb.createCursorKeys();
    this.wasd = kb.addKeys({ w: 'W', a: 'A', s: 'S', d: 'D' }) as Record<'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
    this.actionKeys = [kb.addKey('SPACE'), kb.addKey('E')];
    this.digitKeys = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT'].map((k) => kb.addKey(k));
  }

  /** Walking direction from the keys and the joystick, capped at length 1. */
  move(): Vec {
    let x = controls.moveX;
    let y = controls.moveY;
    if (this.cursors && this.wasd) {
      if (this.cursors.left.isDown || this.wasd.a.isDown) x -= 1;
      if (this.cursors.right.isDown || this.wasd.d.isDown) x += 1;
      if (this.cursors.up.isDown || this.wasd.w.isDown) y -= 1;
      if (this.cursors.down.isDown || this.wasd.s.isDown) y += 1;
    }
    const len = Math.hypot(x, y);
    return len > 1 ? { x: x / len, y: y / len } : { x, y };
  }

  /** True once per press of ACTION (the key or the on-screen button). */
  actionPressed(): boolean {
    const fromKeys = this.actionKeys.some((k) => Phaser.Input.Keyboard.JustDown(k));
    return takeAction() || fromKeys;
  }

  /** The hotbar slot whose number key was just pressed, or -1. */
  slotPressed(): number {
    return this.digitKeys.findIndex((k) => Phaser.Input.Keyboard.JustDown(k));
  }
}
```

Sprites for creatures (with a wind-up tint, a hit flash and a health bar once hurt), loose items and arrows, plus the death puff and the swing wedge. Everything is kept in step with the simulation by one `sync` call:

`src/gfx/CreatureLayer.ts`:

```typescript
import Phaser from 'phaser';
import { snapWorld } from '@/core/viewport';
import { CREATURES, isHostileKind } from '@/data/creatures';
import { ITEMS } from '@/data/items';
import { animKey } from '@/gfx/animations';
import { TILE } from '@/gfx/TerrainLayer';
import type { Facing } from '@/sim/actions';
import type { SwingStats } from '@/sim/combat';
import type { Creature } from '@/sim/creatures';
import type { Arrow } from '@/sim/encounters';
import type { Vec } from '@/sim/movement';
import type { Pickup } from '@/sim/pickups';

const FLASH_MS = 90;
const WINDUP_TINT = 0xff8a8a;
const FACING_DEG: Record<Facing, number> = { right: 0, down: 90, left: 180, up: 270 };
/** Where the feet are inside a sprite cell: monsters are drawn in 48x48 cells, animals in 16x20. */
const FEET: Record<'monsters' | 'actors', number> = { monsters: 0.8, actors: 0.9 };
const BAR_W = 14;

interface CreatureView {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  bar: [Phaser.GameObjects.Rectangle, Phaser.GameObjects.Rectangle];
  flashUntil: number;
}

interface ItemView {
  icon: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
}

/** Sprites for the island's creatures, loose items and arrows, kept in step with the simulation by `sync`. */
export class CreatureLayer {
  private creatures = new Map<number, CreatureView>();
  private items = new Map<number, ItemView>();
  private arrows = new Map<number, Phaser.GameObjects.Image>();

  constructor(private scene: Phaser.Scene) {}

  /** Create, move, animate and remove sprites so they match the given state. */
  sync(creatures: readonly Creature[], pickups: readonly Pickup[], arrows: readonly Arrow[]): void {
    this.syncCreatures(creatures);
    this.syncItems(pickups);
    this.syncArrows(arrows);
  }

  private syncCreatures(list: readonly Creature[]): void {
    const now = this.scene.time.now;
    const seen = new Set<number>();
    for (const c of list) {
      seen.add(c.id);
      const def = CREATURES[c.kind];
      const view = this.creatures.get(c.id) ?? this.addCreature(c);
      const px = snapWorld(c.x * TILE);
      const py = snapWorld(c.y * TILE);
      view.sprite.setPosition(px, py).setDepth(py);
      view.shadow.setPosition(px, py - 1).setDepth(py - 1);
      const dir = def.sprite.fixedDir ?? c.facing;
      const moving = c.state === 'wander' || c.state === 'chase' || c.state === 'flee';
      if (moving) {
        view.sprite.play(animKey(`${def.sprite.group}/${dir}`), true);
      } else {
        view.sprite.anims.stop();
        view.sprite.setFrame(`${def.sprite.group}/${dir}/${Math.min(1, def.sprite.frames - 1)}`);
      }
      if (now < view.flashUntil) view.sprite.setTintFill(0xffffff);
      else if (c.state === 'windup') view.sprite.setTint(WINDUP_TINT);
      else view.sprite.clearTint();
      view.sprite.setScale(c.state === 'windup' ? 1.12 : 1);
      this.updateBar(view, c, px, py);
    }
    for (const [id, view] of this.creatures) {
      if (seen.has(id)) continue;
      view.sprite.destroy();
      view.shadow.destroy();
      view.bar.forEach((b) => b.destroy());
      this.creatures.delete(id);
    }
  }

  private addCreature(c: Creature): CreatureView {
    const def = CREATURES[c.kind];
    const dir = def.sprite.fixedDir ?? c.facing;
    const sprite = this.scene.add.sprite(0, 0, def.sprite.atlas, `${def.sprite.group}/${dir}/1`).setOrigin(0.5, FEET[def.sprite.atlas]);
    const shadow = this.scene.add.image(0, 0, 'fx_shadow').setScale(def.radius * 3.2);
    const color = isHostileKind(c.kind) ? 0xe0524f : 0xff9a3c;
    const back = this.scene.add.rectangle(0, 0, BAR_W, 2, 0x000000, 0.65).setOrigin(0, 0.5).setVisible(false);
    const fill = this.scene.add.rectangle(0, 0, BAR_W, 2, color).setOrigin(0, 0.5).setVisible(false);
    const view: CreatureView = { sprite, shadow, bar: [back, fill], flashUntil: 0 };
    this.creatures.set(c.id, view);
    return view;
  }

  /** A health bar above a creature that has been hurt. */
  private updateBar(view: CreatureView, c: Creature, px: number, py: number): void {
    const def = CREATURES[c.kind];
    const hurt = c.hp < def.hp;
    const top = py - (def.sprite.atlas === 'monsters' ? 26 : 22);
    view.bar[0].setVisible(hurt).setPosition(px - BAR_W / 2, top).setDepth(py + 1);
    view.bar[1].setVisible(hurt).setPosition(px - BAR_W / 2, top).setDepth(py + 2).setSize(Math.max(1, BAR_W * (c.hp / def.hp)), 2);
  }

  private syncItems(list: readonly Pickup[]): void {
    const now = this.scene.time.now;
    const seen = new Set<number>();
    for (const p of list) {
      seen.add(p.id);
      const view = this.items.get(p.id) ?? this.addItem(p);
      const px = snapWorld(p.x * TILE);
      const py = snapWorld(p.y * TILE);
      const bob = Math.sin((now + p.id * 137) / 220) * 1.5;
      view.icon.setPosition(px, py - 6 + bob).setDepth(py).setAlpha(p.age > 100 && Math.floor(now / 200) % 2 === 0 ? 0.35 : 1);
      view.shadow.setPosition(px, py - 1).setDepth(py - 1);
    }
    for (const [id, view] of this.items) {
      if (seen.has(id)) continue;
      view.icon.destroy();
      view.shadow.destroy();
      this.items.delete(id);
    }
  }

  private addItem(p: Pickup): ItemView {
    const icon = ITEMS[p.item].icon;
    const view = {
      icon: this.scene.add.image(0, 0, icon.atlas, icon.frame).setDisplaySize(12, 12),
      shadow: this.scene.add.image(0, 0, 'fx_shadow').setScale(0.5),
    };
    this.items.set(p.id, view);
    return view;
  }

  private syncArrows(list: readonly Arrow[]): void {
    const seen = new Set<number>();
    for (const a of list) {
      seen.add(a.id);
      const dir = a.dx > 0 ? 'right' : a.dx < 0 ? 'left' : a.dy < 0 ? 'up' : 'down';
      const img = this.arrows.get(a.id) ?? this.scene.add.image(0, 0, 'actors', `arrow/idle/${dir}/0`);
      this.arrows.set(a.id, img);
      const py = snapWorld(a.y * TILE);
      img.setPosition(snapWorld(a.x * TILE), py - 8).setDepth(py);
    }
    for (const [id, img] of this.arrows) {
      if (seen.has(id)) continue;
      img.destroy();
      this.arrows.delete(id);
    }
  }

  /** White flash on a creature that was just hit. */
  flash(id: number): void {
    const view = this.creatures.get(id);
    if (view) view.flashUntil = this.scene.time.now + FLASH_MS;
  }

  /** Small cloud where a creature died. Positions are in tiles. */
  puff(at: Vec): void {
    const x = at.x * TILE;
    const y = at.y * TILE - 6;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const dot = this.scene.add.image(x, y, 'ui_white').setDisplaySize(3, 3).setDepth(900_000);
      this.scene.tweens.add({
        targets: dot, x: x + Math.cos(angle) * 12, y: y + Math.sin(angle) * 9 - 4, alpha: 0, duration: 320, ease: 'Sine.easeOut',
        onComplete: () => dot.destroy(),
      });
    }
  }

  /** The sweep of a blow: a wedge in front of the hero that fades at once. */
  swing(hero: Vec, facing: Facing, stats: Pick<SwingStats, 'reach' | 'arc'>): void {
    const mid = FACING_DEG[facing];
    const wedge = this.scene.add
      .arc(hero.x * TILE, hero.y * TILE - 8, stats.reach * TILE, mid - stats.arc / 2, mid + stats.arc / 2, false, 0xffffff, 0.2)
      .setStrokeStyle(1, 0xffffff, 0.7)
      .setDepth(900_000);
    this.scene.tweens.add({ targets: wedge, alpha: 0, duration: 150, onComplete: () => wedge.destroy() });
  }
}
```

`Wildlife` owns the `Encounters` value and its sprites; `HeroCombat` is the scene's fighting side (events become damage numbers, red flash, shake, buzz, hit-stop and sounds; loot is picked up; the battle music lingers 4 s after the last monster); `MusicDirector` only changes the track when the mood changes:

`src/game/Wildlife.ts`:

```typescript
import type Phaser from 'phaser';
import { Rng } from '@/core/rng';
import { CreatureLayer } from '@/gfx/CreatureLayer';
import type { Facing } from '@/sim/actions';
import type { SwingStats } from '@/sim/combat';
import {
  creatureInReach, emptyEncounters, shoot, swing, takePickups, tickEncounters, type Encounters, type EncounterEvent, type Taken, type TickContext,
} from '@/sim/encounters';
import type { WeaponStats } from '@/data/items';
import type { Inventory } from '@/sim/inventory';
import type { Melee } from '@/sim/melee';
import type { Vec } from '@/sim/movement';

/**
 * The island's creatures, loose items and arrows: runs the simulation, keeps the sprites in step with it, and hands the
 * scene the events it has to react to (the hero was hit, a creature was hurt or killed). Nothing here is saved.
 */
export class Wildlife {
  private state = emptyEncounters();
  private rng = new Rng(Rng.seedFromTime());
  private layer: CreatureLayer;

  constructor(scene: Phaser.Scene) {
    this.layer = new CreatureLayer(scene);
  }

  /** The current state of creatures, items and arrows (read-only). */
  snapshot(): Encounters {
    return this.state;
  }

  /** Advance everything by `dt` seconds. */
  tick(dt: number, c: Omit<TickContext, 'rng'>): EncounterEvent[] {
    const r = tickEncounters(this.state, { ...c, rng: this.rng }, dt);
    return this.apply(r.e, r.events);
  }

  /** The hero swings: creatures in the arc are hurt. */
  strike(hero: Vec, facing: Facing, stats: SwingStats): EncounterEvent[] {
    this.layer.swing(hero, facing, stats);
    const r = swing(this.state, hero, facing, stats, this.rng);
    return this.apply(r.e, r.events);
  }

  /** The hero looses an arrow. */
  shoot(hero: Vec, facing: Facing, stats: WeaponStats): void {
    this.state = shoot(this.state, hero, facing, stats);
    this.layer.sync(this.state.creatures, this.state.pickups, this.state.arrows);
  }

  /** Would a blow with this weapon land on a creature right now? */
  inReach(hero: Vec, facing: Facing, melee: Pick<Melee, 'reach' | 'arc'>): boolean {
    return creatureInReach(this.state, hero, facing, melee.reach, melee.arc);
  }

  /** Pick up loot within reach of the hero. */
  take(inv: Inventory, hero: Vec): Taken {
    const r = takePickups(this.state, inv, hero);
    if (r.e !== this.state) this.apply(r.e, []);
    return r;
  }

  /** Remove every creature, item and arrow (after the hero wakes up somewhere else). */
  clear(): void {
    this.state = emptyEncounters();
    this.layer.sync([], [], []);
  }

  private apply(next: Encounters, events: EncounterEvent[]): EncounterEvent[] {
    this.state = next;
    for (const ev of events) {
      if (ev.t === 'hit') this.layer.flash(ev.id);
      if (ev.t === 'killed') this.layer.puff(ev);
    }
    this.layer.sync(next.creatures, next.pickups, next.arrows);
    return events;
  }
}
```

`src/game/HeroCombat.ts`:

```typescript
import { shakeCamera } from '@/core/viewport';
import { services } from '@/core/services';
import { t } from '@/core/i18n';
import { Wildlife } from '@/game/Wildlife';
import { FloatText } from '@/gfx/FloatText';
import { TILE } from '@/gfx/TerrainLayer';
import type { GameScene } from '@/scenes/GameScene';
import { HERO_DEFENSE } from '@/sim/combat';
import { cueForEncounter } from '@/sim/cues';
import { isNight } from '@/sim/daynight';
import { hostilesNear, type EncounterEvent } from '@/sim/encounters';
import type { Melee } from '@/sim/melee';
import { hurtHero, type Fx } from '@/sim/session';
import { COLORS } from '@/ui/theme';

/** The "backpack full" notice for loot on the ground is shown at most this often (seconds). */
const FULL_NOTICE = 3;
/** Monsters this close that are after the hero make it a fight; the battle music lingers this long after the last one (seconds). */
const FIGHT_RADIUS = 10;
const FIGHT_LINGER = 4;
/** How long the island freezes when a blow lands, and when it kills (seconds). */
const HIT_STOP = 0.045;
const KILL_STOP = 0.09;

/** The island scene's fighting side: runs the creatures, resolves the hero's blows and shots, and shows what happens. */
export class HeroCombat {
  private wildlife: Wildlife;
  private numbers: FloatText;
  private fullTimer = 0;
  private calm = FIGHT_LINGER;

  constructor(private host: GameScene) {
    this.wildlife = new Wildlife(host);
    this.numbers = new FloatText(host);
  }

  /** Would a blow with this melee stat block land on a creature right now? */
  reaches(melee: Pick<Melee, 'reach' | 'arc'>): boolean {
    return this.wildlife.inReach(this.host.pos, this.host.player.facing, melee);
  }

  /** True while monsters are on the hero, and for a few seconds after. */
  get fighting(): boolean {
    return this.calm < FIGHT_LINGER;
  }

  /** The hero's blow or shot, as chosen by the rules. */
  onFx(fx: Extract<Fx, { t: 'strike' | 'shot' }>): void {
    const { pos, player } = this.host;
    if (fx.t === 'strike') this.react(this.wildlife.strike(pos, player.facing, fx.melee));
    else this.wildlife.shoot(pos, player.facing, fx.stats);
  }

  /** Run creatures, loot and arrows for `dt` seconds, then let the hero pick up what he stands next to. */
  tick(dt: number): void {
    const host = this.host;
    host.player.tick(dt);
    this.fullTimer = Math.max(0, this.fullTimer - dt);
    this.calm = hostilesNear(this.wildlife.snapshot(), host.pos, FIGHT_RADIUS) > 0 ? 0 : this.calm + dt;
    const s = host.session;
    this.react(this.wildlife.tick(dt, {
      world: host.world, solids: host.solids, structures: s.structures, hero: host.pos, heroAlive: !host.dead,
      night: isNight(s.clock), difficulty: s.difficulty, defense: HERO_DEFENSE,
    }));
    const loot = this.wildlife.take(host.session.inventory, host.pos);
    if (loot.taken.length > 0) {
      host.session = { ...host.session, inventory: loot.inv };
      host.float.newGroup();
      for (const got of loot.taken) host.showGain(`+${got.qty} ${t(`item_${got.item}`)}`);
    }
    if (loot.full && this.fullTimer === 0) {
      this.fullTimer = FULL_NOTICE;
      services.notify?.(t('msgFull'));
    }
  }

  /** The hero's side of an encounter: a blow lands (red flash, shake, buzz), a creature is hurt (damage number). */
  private react(events: EncounterEvent[]): void {
    const { host } = this;
    for (const ev of events) {
      if (ev.t !== 'hurtHero' || host.player.vulnerable) services.audio?.sfx(cueForEncounter(ev));
      if (ev.t === 'killed') host.hitStop = KILL_STOP;
      if (ev.t === 'hit') {
        host.hitStop = HIT_STOP;
        if (services.settings?.damageNumbers !== false) this.numbers.show(ev.x * TILE, ev.y * TILE - 18, `-${ev.amount}`, COLORS.white);
      } else if (ev.t === 'hurtHero' && host.player.vulnerable) {
        host.session = hurtHero(host.session, ev.amount);
        host.player.hurt();
        if (services.settings?.screenShake !== false) shakeCamera(host.cameras.main, 140, 0.006);
        services.platform?.haptic('medium');
        this.numbers.show(host.pos.x * TILE, host.pos.y * TILE - 20, `-${ev.amount}`, 0xff5555);
      }
    }
  }

  /** The hero woke up somewhere else: everything that was chasing him is gone. */
  reset(): void {
    this.fullTimer = 0;
    this.calm = FIGHT_LINGER;
    this.host.player.recover();
    this.wildlife.clear();
  }
}
```

`src/game/MusicDirector.ts`:

```typescript
import { services } from '@/core/services';
import { musicFor, type Mood } from '@/sim/cues';

/** Picks the music for the island: day or night, and the battle theme while monsters are on the hero. */
export class MusicDirector {
  private mood: Mood | null = null;

  /** Call every frame; the track only changes when the mood does. */
  update(night: boolean, fighting: boolean): void {
    const mood = musicFor(night, fighting);
    if (mood === this.mood) return;
    this.mood = mood;
    services.audio?.playMusic(mood, 1200);
  }
}
```

The hero owns his moment of safety after a blow (`hurt`, `tick`, `vulnerable`, `recover`):

`src/entities/Player.ts`:

```typescript
import Phaser from 'phaser';
import { snapWorld } from '@/core/viewport';
import { dirFromVector, type Dir } from '@/gfx/animations';
import { TILE } from '@/gfx/TerrainLayer';
import { HERO_IFRAMES } from '@/sim/combat';
import type { Vec } from '@/sim/movement';

/** Where the hero's feet are inside a 32x32 hero frame (the body spans y 5..25). */
const FEET_Y = 25 / 32;

export class Player {
  readonly sprite: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private dir: Dir = 'down';
  private moving = false;
  /** Seconds left in which a blow cannot hurt him. */
  private safeFor = 0;

  constructor(private scene: Phaser.Scene, pos: Vec, private skin = 1) {
    this.sprite = scene.add.sprite(0, 0, 'heroes', `hero${skin}/idle/down/0`).setOrigin(0.5, FEET_Y);
    this.shadow = scene.add.image(0, 0, 'fx_shadow');
    this.sprite.play(this.animKey());
    this.place(pos);
  }

  get facing(): Dir {
    return this.dir;
  }

  private animKey(): string {
    return `hero${this.skin}_${this.moving ? 'walk' : 'idle'}_${this.dir}`;
  }

  /** Put the hero at a position given in tile units. Depth follows the feet so trees sort correctly. */
  private place(pos: Vec): void {
    const px = snapWorld(pos.x * TILE);
    const py = snapWorld(pos.y * TILE);
    this.sprite.setPosition(px, py).setDepth(py);
    this.shadow.setPosition(px, py - 1).setDepth(py - 1);
  }

  /** Move to `pos`, facing and animating according to the movement vector. */
  update(pos: Vec, move: Vec): void {
    const moving = Math.hypot(move.x, move.y) > 0.05;
    const dir = dirFromVector(move.x, move.y, this.dir);
    if (moving !== this.moving || dir !== this.dir) {
      this.moving = moving;
      this.dir = dir;
      this.sprite.play(this.animKey(), true);
    }
    this.place(pos);
  }

  /** Turn toward (dx, dy) without moving (used to face the thing being hit). */
  face(dx: number, dy: number): void {
    this.dir = dirFromVector(dx, dy, this.dir);
    this.sprite.play(this.animKey(), true);
  }

  get vulnerable(): boolean {
    return this.safeFor === 0;
  }

  /** A monster landed a blow: flash red and become safe for a moment. */
  hurt(): void {
    this.safeFor = HERO_IFRAMES;
    this.sprite.setTintFill(0xff4444);
    this.scene.time.delayedCall(110, () => this.sprite.clearTint());
  }

  /** Count down the moment of safety; the hero blinks while it lasts. */
  tick(dt: number): void {
    this.safeFor = Math.max(0, this.safeFor - dt);
    this.sprite.setAlpha(this.safeFor > 0 && Math.floor(this.safeFor * 16) % 2 === 0 ? 0.45 : 1);
  }

  /** Back to normal after waking up. */
  recover(): void {
    this.safeFor = 0;
    this.sprite.setAlpha(1).clearTint();
  }

  /** Short squash used as feedback for a hit. */
  punch(): void {
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.setScale(1);
    this.scene.tweens.add({ targets: this.sprite, scaleX: 1.14, scaleY: 0.88, duration: 70, yoyo: true });
  }
}
```

- [ ] **Step 5: Wire the scenes**

`GameScene` loses its input code, its blocking-tile loop and the combat handling (all moved above) and gains the creature, loot, hit-stop and music hooks; it ends at exactly 400 lines:

`src/scenes/GameScene.ts`:

```typescript
import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import type { HudScene } from './HudScene';
import { Player } from '@/entities/Player';
import { newSlot, type SaveSlot } from '@/core/save';
import { services } from '@/core/services';
import { t } from '@/core/i18n';
import { worldZoom } from '@/core/viewport';
import type { Recipe } from '@/data/recipes';
import type { Station, StructureId } from '@/data/structures';
import { FarmLayer } from '@/gfx/FarmLayer';
import { FloatText } from '@/gfx/FloatText';
import { NightLight } from '@/gfx/NightLight';
import { StructureLayer, type LightSource } from '@/gfx/StructureLayer';
import { TerrainLayer, TILE } from '@/gfx/TerrainLayer';
import { WorldObjects } from '@/gfx/WorldObjects';
import { InputReader } from '@/game/InputReader';
import { HeroCombat } from '@/game/HeroCombat';
import { MusicDirector } from '@/game/MusicDirector';
import { resetControls } from '@/game/input';
import { frontTile, resolveAction, type Action } from '@/sim/actions';
import { cueForFx } from '@/sim/cues';
import { isNight, lighting, newClock } from '@/sim/daynight';
import { plotAt } from '@/sim/farm';
import { emptyGather, isAlive, sanitizeGather } from '@/sim/gather';
import { nearestNode } from '@/sim/interact';
import { meleeFor } from '@/sim/melee';
import { moveWithCollision, speedFactor, type Vec } from '@/sim/movement';
import {
  applyAction, blocksRegrowth, collapse, craftRecipe, moveInventorySlot, rollDay, selectSlot, sessionFromSlot, sessionToSlot,
  tickSession, transferStack, type Fx, type Session, type Step,
} from '@/sim/session';
import { blockingTiles, nodesByTile, propSolidTiles } from '@/sim/solids';
import { nearbyStations } from '@/sim/structures';
import { isDead } from '@/sim/vitals';
import { GENERATOR_VERSION, generateWorld } from '@/sim/world/generate';
import { idx, type Biome, type ResourceNode, type World } from '@/sim/world/types';
import { COLORS } from '@/ui/theme';

/** Walking speed in tiles per second, how far the hero reaches, and the pause between uses (seconds). */
const PLAYER_SPEED = 3.4;
const HIT_REACH = 1.4;
const ACTION_COOLDOWN = 0.35;
const AUTOSAVE_SECONDS = 15;
const MAX_STEP = 0.05;
/** A destroyed node will not grow back while the hero stands this close (tiles). */
const REGROW_CLEARANCE = 1.5;
/** Stamina recovers slowly for this long after the hero acts (seconds). */
const BUSY_SECONDS = 1.2;
const HERO_LIGHT = 52;

export interface GameInit {
  slot: number;
  /** Present for a New Game; absent when continuing a saved slot. */
  seed?: number;
}

export interface OpenOptions {
  mode: 'bag' | 'craft' | 'chest';
  chestId?: number;
}

type Say = Extract<Fx, { t: 'say' }>;

/** The island: terrain, objects, the hero and the rules that connect them. The HUD runs in its own scene on top. */
export class GameScene extends BaseScene {
  world!: World;
  session!: Session;
  pos: Vec = { x: 0, y: 0 };
  player!: Player;
  float!: FloatText;
  /** Tiles the hero cannot walk through: living nodes, scenery and solid buildings. */
  solids = new Set<number>();
  /** Seconds the island stands still after a good hit, to give blows some weight. */
  hitStop = 0;

  private slotData!: SaveSlot;
  private lastDay = 1;
  private cooldown = 0;
  private idle = 99;
  private saveTimer = 0;
  /** True while the collapse dialog is up. */
  dead = false;
  private wiped = false;
  private nodes!: Map<number, ResourceNode>;
  private propTiles: number[] = [];
  private occupied = new Set<number>();
  private objects!: WorldObjects;
  private structureLayer!: StructureLayer;
  private farmLayer!: FarmLayer;
  private night!: NightLight;
  private cursor!: Phaser.GameObjects.Rectangle;
  private keys!: InputReader;
  private combat!: HeroCombat;
  private music = new MusicDirector();

  constructor() {
    super('Game');
  }

  create(data: GameInit): void {
    this.transitioning = false;
    this.dead = false;
    this.wiped = false;
    resetControls();
    const saves = services.saves;
    const loaded = data.seed === undefined ? saves?.load(data.slot) ?? null : null;
    if (data.seed === undefined && !loaded) {
      this.scene.start('Menu');
      return;
    }
    this.world = generateWorld(data.seed ?? loaded!.seed);
    this.slotData = loaded ?? newSlot(data.slot, 'Castaway', data.seed!, 'normal', this.world.start, newClock());
    if (!loaded) saves?.write(this.slotData);

    // Node ids follow the generator; if it changed since this save, the old harvest diff would point at other nodes.
    const gather = this.slotData.worldVersion === GENERATOR_VERSION
      ? sanitizeGather(this.slotData.gather, this.world.resources.length)
      : emptyGather();
    this.session = { ...sessionFromSlot(this.slotData), gather };
    this.pos = { ...this.slotData.player };
    this.lastDay = this.session.clock.day;
    this.cooldown = 0;
    this.saveTimer = 0;
    this.idle = 99;

    this.nodes = nodesByTile(this.world);
    this.propTiles = propSolidTiles(this.world);
    new TerrainLayer(this, this.world);
    this.objects = new WorldObjects(this, this.world);
    for (const n of this.world.resources) if (!isAlive(gather, n.id)) this.objects.setAlive(n.id, false, false);
    this.structureLayer = new StructureLayer(this, this.session.structures);
    this.farmLayer = new FarmLayer(this, this.session.farm);
    this.rebuildBlocking();
    this.player = new Player(this, this.pos);
    this.combat = new HeroCombat(this);
    this.music = new MusicDirector();
    this.float = new FloatText(this);
    this.cursor = this.add.rectangle(0, 0, TILE, TILE).setOrigin(0, 0).setStrokeStyle(1, 0xffffff, 0.9).setFillStyle(0xffffff, 0.12).setDepth(80000).setVisible(false);

    this.setupCamera();
    this.night = new NightLight(this, this.cameras.main);
    this.keys = new InputReader(this);
    this.handleBack(() => {
      (this.scene.get('Hud') as HudScene).openMenu();
      return true;
    });
    this.scene.launch('Hud', { game: this });
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.saveNow, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.saveNow();
      this.game.events.off(Phaser.Core.Events.HIDDEN, this.saveNow, this);
      this.scene.stop('Hud');
      this.scene.stop('Inventory');
    });
    this.followCamera();
    this.fadeIn(400);
  }

  private setupCamera(): void {
    const cam = this.cameras.main;
    // The shared HiResCamera plugin anchors cameras at the top-left; the world camera zooms around its centre.
    cam.setOrigin(0.5, 0.5).setZoom(worldZoom(2)).setBackgroundColor(0x0a2a4a);
    cam.setBounds(0, 0, this.world.size * TILE, this.world.size * TILE);
  }

  update(_time: number, delta: number): void {
    if (this.dead || this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - delta / 1000);
      this.followCamera();
      return;
    }
    const dt = Math.min(delta / 1000, MAX_STEP);
    this.idle += dt;
    this.session = tickSession(this.session, dt, this.biomeAt(), this.idle < BUSY_SECONDS);
    if (this.session.clock.day !== this.lastDay) this.onNewDay();
    if (isDead(this.session.vitals)) {
      this.onCollapse();
      return;
    }
    const slot = this.keys.slotPressed();
    if (slot >= 0) this.select(slot);

    const move = this.keys.move();
    if (move.x !== 0 || move.y !== 0) {
      const speed = PLAYER_SPEED * speedFactor(this.world, this.pos.x, this.pos.y);
      this.pos = moveWithCollision(this.world, this.solids, this.pos, move.x * speed * dt, move.y * speed * dt);
    }
    this.player.update(this.pos, move);
    this.combat.tick(dt);
    this.music.update(isNight(this.session.clock), this.combat.fighting);

    this.cooldown = Math.max(0, this.cooldown - dt);
    const pressed = this.keys.actionPressed();
    const action = this.computeAction();
    this.showCursor(action);
    if (pressed && this.cooldown === 0) this.perform(action);

    this.followCamera();
    const light = lighting(this.session.clock);
    this.night.update(dt, this.cameras.main, light.color, light.alpha, this.lightSources());
    this.saveTimer += dt;
    if (this.saveTimer >= AUTOSAVE_SECONDS) this.saveNow();
  }

  private biomeAt(): Biome {
    const i = idx(Math.floor(this.pos.x), Math.floor(this.pos.y), this.world.size);
    return this.world.biome[i] as Biome;
  }

  /** What ACTION would do right now. */
  private computeAction(): Action {
    const node = nearestNode(this.nodes, this.world.size, this.pos, HIT_REACH, (id) => isAlive(this.session.gather, id));
    const s = this.session;
    const melee = meleeFor(s.inventory[s.selected]?.item ?? null);
    return resolveAction({
      world: this.world, inv: s.inventory, selected: s.selected, vitals: s.vitals, pos: this.pos, facing: this.player.facing,
      structures: s.structures, farm: s.farm, occupied: this.occupied, node, creature: this.combat.reaches(melee),
    });
  }

  private showCursor(a: Action): void {
    const targeted = ['place', 'till', 'plant', 'water', 'refill', 'harvest', 'open', 'sleep', 'drink', 'pickup'].includes(a.kind);
    const refused = a.kind === 'blocked' && a.reason === 'cannotPlace';
    this.cursor.setVisible(targeted || refused);
    if (!targeted && !refused) return;
    const f = frontTile(this.pos, this.player.facing);
    this.cursor.setPosition(f.x * TILE, f.y * TILE).setStrokeStyle(1, refused ? 0xff5555 : 0xffffff, 0.9);
  }

  private perform(action: Action): void {
    this.cooldown = action.kind === 'attack' ? action.melee.cooldown : action.kind === 'shoot' ? action.stats.cooldown : ACTION_COOLDOWN;
    if (action.kind === 'none') return;
    if (action.kind === 'hit') this.player.face(action.node.x + 0.5 - this.pos.x, action.node.y + 0.5 - this.pos.y);
    if (action.kind !== 'blocked') this.idle = 0;
    this.commit(applyAction(this.session, action, this.pos));
    services.platform?.haptic('light');
  }

  /** Take a rule result: the new state, and the effects to show. */
  private commit(step: Step, quiet = false): void {
    this.session = step.session;
    this.float.newGroup();
    for (const fx of step.fx) this.playFx(fx, quiet);
    this.rebuildBlocking();
  }

  private playFx(fx: Fx, quiet: boolean): void {
    const cue = quiet ? null : cueForFx(fx, fx.t === 'hit' ? this.world.resources[fx.id]?.kind : undefined);
    if (cue) services.audio?.sfx(cue);
    switch (fx.t) {
      case 'say': services.notify?.(this.sayText(fx)); break;
      case 'gain': this.showGain(`+${fx.qty} ${t(`item_${fx.item}`)}`); break;
      case 'swing': this.player.punch(); break;
      case 'strike':
      case 'shot': this.combat.onFx(fx); break;
      case 'hit': this.objects.shake(fx.id); break;
      case 'gone': this.objects.setAlive(fx.id, false); break;
      case 'built': this.structureLayer.add(fx.structure); break;
      case 'unbuilt': this.structureLayer.remove(fx.id); break;
      case 'plot': this.farmLayer.refresh(fx.tile, plotAt(this.session.farm, fx.tile)); break;
      case 'open': this.openStructure(fx.structure.type, fx.structure.id); break;
      case 'slept': this.cameras.main.flash(700, 8, 10, 30); break;
    }
  }

  private sayText(fx: Say): string {
    const vars = { ...fx.vars };
    for (const key of fx.translate ?? []) vars[key] = t(String(vars[key]));
    return t(fx.key, vars);
  }

  /** Floating "+2 Wood" text above the hero (or a toast while a screen covers the island). */
  showGain(text: string): void {
    if (this.scene.isPaused()) {
      services.notify?.(text);
      return;
    }
    this.float.show(this.pos.x * TILE, this.pos.y * TILE - 26, text, COLORS.gold, true);
  }

  /** Walk-blocking tiles (living nodes, scenery, solid structures) and tiles that cannot be built or tilled on. */
  private rebuildBlocking(): void {
    const { solids, occupied } = blockingTiles(this.world, this.propTiles, this.session);
    this.solids = solids;
    this.occupied = occupied;
  }

  /** Nodes that were gone may grow back; the ones next to the hero wait for tomorrow. */
  private onNewDay(): void {
    const before = this.session.gather;
    this.lastDay = this.session.clock.day;
    const held = this.session;
    this.session = rollDay(this.session, (id) => this.heroIsNear(id) || blocksRegrowth(held, this.world.resources[id], this.world.size));
    for (const key of Object.keys(before.gone)) {
      const id = Number(key);
      if (isAlive(this.session.gather, id)) this.objects.setAlive(id, true);
    }
    this.farmLayer.rebuild(this.session.farm);
    this.rebuildBlocking();
    services.notify?.(t('hudDay', { n: this.lastDay }));
    this.saveNow();
  }

  private heroIsNear(id: number): boolean {
    const n = this.world.resources[id];
    return Math.hypot(n.x + 0.5 - this.pos.x, n.y + 0.5 - this.pos.y) < REGROW_CLEARANCE;
  }

  private onCollapse(): void {
    this.dead = true;
    services.audio?.sfx('death');
    (this.scene.get('Hud') as HudScene).showDeath(this.session.difficulty, () => this.wakeUp());
  }

  /** After the death dialog: lose what the difficulty takes and wake at the respawn point, or end a hardcore run. */
  private wakeUp(): void {
    const result = collapse(this.session, Math.random);
    if (result.wipeSave) {
      this.wiped = true;
      services.saves?.delete(this.slotData.slot);
      this.goTo('Menu');
      return;
    }
    this.session = result.session;
    this.pos = { ...this.session.respawn };
    this.player.update(this.pos, { x: 0, y: 0 });
    this.dead = false;
    this.idle = 99;
    this.combat.reset();
    this.saveNow();
  }

  private lightSources(): LightSource[] {
    return [
      ...this.structureLayer.lights(this.session.structures),
      { x: this.pos.x * TILE, y: this.pos.y * TILE - 8, radius: HERO_LIGHT },
    ];
  }

  /** Centre on the hero, then snap to whole device pixels so pixel art does not shimmer. */
  private followCamera(): void {
    const cam = this.cameras.main;
    cam.centerOn(this.pos.x * TILE, this.pos.y * TILE);
    const k = worldZoom(2);
    cam.scrollX = Math.round(cam.scrollX * k) / k;
    cam.scrollY = Math.round(cam.scrollY * k) / k;
  }

  // ---- used by the HUD and the inventory screen

  select(index: number): void {
    this.session = selectSlot(this.session, index);
  }

  /** Crafting stations within reach of the hero. */
  stations(): Set<Station> {
    return nearbyStations(this.session.structures, this.pos);
  }

  craft(recipe: Recipe): void {
    const step = craftRecipe(this.session, recipe, this.stations());
    if (step.fx.length > 0) services.audio?.sfx('craft');
    this.commit(step, true);
  }

  moveSlot(from: number, to: number): void {
    this.session = moveInventorySlot(this.session, from, to);
  }

  transfer(chestId: number, from: 'bag' | 'chest', index: number): void {
    this.commit(transferStack(this.session, chestId, from, index));
  }

  /** Open the backpack, the crafting list of a station, or a chest; the island waits while it is open. */
  openInventory(opts: OpenOptions): void {
    if (this.scene.isPaused()) return;
    this.scene.pause('Game');
    this.scene.launch('Inventory', { game: this, ...opts });
  }

  private openStructure(type: StructureId, id: number): void {
    this.openInventory(type === 'chest' ? { mode: 'chest', chestId: id } : { mode: 'craft' });
  }

  private snapshot(): SaveSlot {
    return { ...sessionToSlot(this.slotData, this.session, this.pos), worldVersion: GENERATOR_VERSION };
  }

  saveNow(): void {
    if (this.wiped || !this.session) return;
    this.saveTimer = 0;
    services.saves?.write(this.snapshot());
  }

  quitToMenu(): void {
    this.saveNow();
    this.goTo('Menu');
  }
}
```

`PreloadScene` loads the monsters atlas and the audio sprite, tells the audio service where the music files are, and marks sound ready:

`src/scenes/PreloadScene.ts`:

```typescript
import Phaser from 'phaser';
import { t } from '@/core/i18n';
import { services } from '@/core/services';
import { view } from '@/core/viewport';
import { TILES_KEY } from '@/data/terrainTiles';
import { registerAnimations } from '@/gfx/animations';
import { nine } from '@/ui/skin';
import { COLORS, FONT } from '@/ui/theme';

/** Sprite atlases built by tools/pack_assets.py. */
const ATLASES = ['heroes', 'actors', 'monsters', 'props', 'icons'];

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload(): void {
    const { w: W, h: H } = view;
    const barW = Math.min(220, W - 80);
    const y = Math.round(H * 0.55);
    this.add.bitmapText(W / 2, y - 18, FONT.small, t('loading')).setOrigin(0.5).setTint(COLORS.textDim);
    nine(this, W / 2 - barW / 2, y, 'ui_bar_bg', barW, 8).setOrigin(0, 0);
    const fill = this.add.image(W / 2 - barW / 2 + 1, y + 1, 'ui_white').setOrigin(0, 0).setTint(COLORS.gold);
    fill.setDisplaySize(1, 6);
    this.load.on('progress', (p: number) => fill.setDisplaySize(Math.max(1, Math.round((barW - 2) * p)), 6));
    this.load.on('loaderror', (f: Phaser.Loader.File) => console.warn('[preload] failed', f.key));

    for (const a of ATLASES) this.load.atlas(a, `assets/pack/${a}.png`, `assets/pack/${a}.json`);
    this.load.audioSprite('sfx', 'assets/audio/sfx.json', ['assets/audio/sfx.ogg']);
    this.load.spritesheet(TILES_KEY, 'assets/pack/tiles.png', { frameWidth: 16, frameHeight: 16 });
  }

  create(): void {
    registerAnimations(this);
    services.audio?.setMusicUrls({
      day: 'assets/audio/music_day.ogg', night: 'assets/audio/music_night.ogg', battle: 'assets/audio/music_battle.ogg',
    });
    services.audio?.markReady();
    this.scene.launch('Notify');
    void services.platform?.hideSplash();
    this.scene.start('Splash');
  }
}
```

In `src/gfx/animations.ts`, add the monsters atlas to the list of atlases whose frame groups become animations. Change:

```ts
  for (const atlas of ['heroes', 'actors', 'props']) {
```

to:

```ts
  for (const atlas of ['heroes', 'actors', 'monsters', 'props']) {
```

In `src/scenes/BootScene.ts`, pause the audio when the app goes to the background. Right after the line `services.audio = audio;` add:

```ts
    this.game.events.on(Phaser.Core.Events.HIDDEN, () => audio.setPaused(true));
    this.game.events.on(Phaser.Core.Events.VISIBLE, () => audio.setPaused(false));
```

In `src/scenes/MenuScene.ts`, play the day music on the menu. In `create()`, right after `this.fadeIn(400);` add:

```ts
    services.audio?.playMusic('day');
```

- [ ] **Step 6: Run the tests, the typecheck, the coverage gate and the build**

Run: `npx vitest run tests/blocking.test.ts && npm run typecheck && npm run test:cov && npm run build`
Expected: blocking 2 tests PASS; typecheck exits 0 (the `GameScene` errors from Tasks 7 and 8 are gone); the whole suite passes (373 tests) with coverage above 80% (about 98.9% lines); the build succeeds and `dist/assets/audio` is about 0.9 MB.

- [ ] **Step 7: Run the island once in the browser**

Start the dev server in a second terminal and leave it running (it uses port 5199):

```bash
npm run dev
```

Run an old scenario to prove nothing broke: `node tools/play.mjs tools/scripts/harvest.json tools/.cache/shots`
Expected: the last lines are `eval -> []` and `page errors: []`. Open `tools/.cache/shots/after-hits.png`: the island looks as before, with the hero and the HUD.

- [ ] **Step 8: Commit**

```bash
git add src/gfx src/game src/entities src/scenes src/sim/solids.ts tests/blocking.test.ts
git commit -m "feat: add creatures, combat feedback, loot and sound to the island; split GameScene"
```

---

### Task 10: Browser scenarios and docs

**Files:**
- Create: `tools/scripts/fight.json`, `tools/scripts/hunt.json`, `tools/scripts/monster-death.json`, `tools/scripts/spawn.json`, `tools/scripts/audio.json`, `tools/scripts/perf-fight.json`, `tools/scripts/zoo.json`
- Replace: `README.md`

Each scenario drives the real game in headless Edge. They place creatures directly into the running simulation (`__game.scene.getScene('Game').combat.wildlife.state`) so results do not depend on random spawns. The dev server from Task 9 must still be running on port 5199.

- [ ] **Step 1: Add the scenarios**

A slime hunts the hero, he fights back with a stone sword, the slime dies and its gel is picked up:

`tools/scripts/fight.json`:

```json
[
 {
  "goto": "http://localhost:5199/"
 },
 {
  "eval": "localStorage.clear()"
 },
 {
  "goto": "http://localhost:5199/"
 },
 {
  "until": "window.__game && __game.scene.isActive('Menu')",
  "timeout": 20000
 },
 {
  "eval": "__game.scene.getScene('Menu').goTo('Game', {slot: 0, seed: 1234})"
 },
 {
  "until": "__game.scene.isActive('Game') && __game.scene.isActive('Hud')",
  "timeout": 20000
 },
 {
  "wait": 800
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); const w = g.world; const S = w.size; const c = w.landmarks.find(l => l.id === 'camp'); let best = null; for (let r = 4; r < 40 && !best; r++) for (let dy = -r; dy <= r && !best; dy++) for (let dx = -r; dx <= r && !best; dx++) { let ok = true; for (let yy = -4; yy <= 4 && ok; yy++) for (let xx = -4; xx <= 4 && ok; xx++) { const x = c.x + dx + xx, y = c.y + dy + yy; if (x < 1 || y < 1 || x >= S - 1 || y >= S - 1) { ok = false; break; } const i = y * S + x; if (w.terrain[i] !== 3 || g.solids.has(i)) ok = false; } if (ok) best = { x: c.x + dx, y: c.y + dy }; } if (!best) return 'no clearing'; g.pos = { x: best.x + 0.5, y: best.y + 0.5 }; g.player.face(1, 0); return 'clearing ' + best.x + ',' + best.y; })()"
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); const inv = g.session.inventory.slice(); inv[0] = {item:'sword_stone', qty:1, dur:80}; inv[1] = {item:'bow', qty:1, dur:80}; inv[2] = {item:'arrow', qty:12}; g.session = {...g.session, inventory: inv, selected: 0}; const w = g.combat.wildlife; w.state = {...w.state, spawnTimer: 9999}; return 'armed'; })()"
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); const w = g.combat.wildlife; const mk = (id, kind, dx, dy, hp) => ({id, kind, x: g.pos.x + dx, y: g.pos.y + dy, hp, facing: 'left', state: 'idle', timer: 1, headX: 0, headY: 0, angry: false, pushX: 0, pushY: 0, stun: 0}); w.state = {...w.state, creatures: [mk(900,'slime',2.2,0,8)], nextId: 1000}; w.apply(w.state, []); return 'placed'; })()"
 },
 {
  "wait": 900
 },
 {
  "shot": "fight-1-chase"
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); const w = g.combat.wildlife; return JSON.stringify({creatures: w.state.creatures.map(c => [c.kind, c.state, +c.x.toFixed(2), c.hp]), pickups: w.state.pickups.map(p => [p.item, p.qty]), hp: +g.session.vitals.hp.toFixed(1), stamina: +g.session.vitals.stamina.toFixed(1), gel: g.session.inventory.filter(s => s && s.item === 'gel').reduce((n, s) => n + s.qty, 0), meat: g.session.inventory.filter(s => s && s.item === 'raw_meat').reduce((n, s) => n + s.qty, 0), arrows: g.session.inventory.filter(s => s && s.item === 'arrow').reduce((n, s) => n + s.qty, 0)}); })()"
 },
 {
  "press": "Space",
  "ms": 60
 },
 {
  "wait": 420
 },
 {
  "press": "Space",
  "ms": 60
 },
 {
  "wait": 420
 },
 {
  "press": "Space",
  "ms": 60
 },
 {
  "wait": 420
 },
 {
  "press": "Space",
  "ms": 60
 },
 {
  "wait": 420
 },
 {
  "press": "Space",
  "ms": 60
 },
 {
  "wait": 420
 },
 {
  "shot": "fight-2-after"
 },
 {
  "wait": 600
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); const w = g.combat.wildlife; return JSON.stringify({creatures: w.state.creatures.map(c => [c.kind, c.state, +c.x.toFixed(2), c.hp]), pickups: w.state.pickups.map(p => [p.item, p.qty]), hp: +g.session.vitals.hp.toFixed(1), stamina: +g.session.vitals.stamina.toFixed(1), gel: g.session.inventory.filter(s => s && s.item === 'gel').reduce((n, s) => n + s.qty, 0), meat: g.session.inventory.filter(s => s && s.item === 'raw_meat').reduce((n, s) => n + s.qty, 0), arrows: g.session.inventory.filter(s => s && s.item === 'arrow').reduce((n, s) => n + s.qty, 0)}); })()"
 },
 {
  "until": "(() => { const g = __game.scene.getScene('Game'); return g.combat.wildlife.state.pickups.length === 0; })()",
  "timeout": 8000
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); const w = g.combat.wildlife; return JSON.stringify({creatures: w.state.creatures.map(c => [c.kind, c.state, +c.x.toFixed(2), c.hp]), pickups: w.state.pickups.map(p => [p.item, p.qty]), hp: +g.session.vitals.hp.toFixed(1), stamina: +g.session.vitals.stamina.toFixed(1), gel: g.session.inventory.filter(s => s && s.item === 'gel').reduce((n, s) => n + s.qty, 0), meat: g.session.inventory.filter(s => s && s.item === 'raw_meat').reduce((n, s) => n + s.qty, 0), arrows: g.session.inventory.filter(s => s && s.item === 'arrow').reduce((n, s) => n + s.qty, 0)}); })()"
 },
 {
  "shot": "fight-3-looted"
 },
 {
  "eval": "JSON.stringify(window.__errs)"
 }
]
```

A rabbit and a fox in front of the bow; the arrow kills the rabbit, the hero walks onto the meat:

`tools/scripts/hunt.json`:

```json
[
 {
  "goto": "http://localhost:5199/"
 },
 {
  "eval": "localStorage.clear()"
 },
 {
  "goto": "http://localhost:5199/"
 },
 {
  "until": "window.__game && __game.scene.isActive('Menu')",
  "timeout": 20000
 },
 {
  "eval": "__game.scene.getScene('Menu').goTo('Game', {slot: 0, seed: 1234})"
 },
 {
  "until": "__game.scene.isActive('Game') && __game.scene.isActive('Hud')",
  "timeout": 20000
 },
 {
  "wait": 800
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); const w = g.world; const S = w.size; const c = w.landmarks.find(l => l.id === 'camp'); let best = null; for (let r = 4; r < 40 && !best; r++) for (let dy = -r; dy <= r && !best; dy++) for (let dx = -r; dx <= r && !best; dx++) { let ok = true; for (let yy = -4; yy <= 4 && ok; yy++) for (let xx = -4; xx <= 4 && ok; xx++) { const x = c.x + dx + xx, y = c.y + dy + yy; if (x < 1 || y < 1 || x >= S - 1 || y >= S - 1) { ok = false; break; } const i = y * S + x; if (w.terrain[i] !== 3 || g.solids.has(i)) ok = false; } if (ok) best = { x: c.x + dx, y: c.y + dy }; } if (!best) return 'no clearing'; g.pos = { x: best.x + 0.5, y: best.y + 0.5 }; g.player.face(1, 0); return 'clearing ' + best.x + ',' + best.y; })()"
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); const inv = g.session.inventory.slice(); inv[0] = {item:'sword_stone', qty:1, dur:80}; inv[1] = {item:'bow', qty:1, dur:80}; inv[2] = {item:'arrow', qty:12}; g.session = {...g.session, inventory: inv, selected: 0}; const w = g.combat.wildlife; w.state = {...w.state, spawnTimer: 9999}; return 'armed'; })()"
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); g.session = {...g.session, selected: 1}; return 'bow selected'; })()"
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); const w = g.combat.wildlife; const mk = (id, kind, dx, dy, hp) => ({id, kind, x: g.pos.x + dx, y: g.pos.y + dy, hp, facing: 'left', state: 'idle', timer: 1, headX: 0, headY: 0, angry: false, pushX: 0, pushY: 0, stun: 0}); w.state = {...w.state, creatures: [mk(901,'rabbit',4,0,3),mk(902,'fox',5,1,6)], nextId: 1000}; w.apply(w.state, []); return 'placed'; })()"
 },
 {
  "wait": 120
 },
 {
  "press": "Space",
  "ms": 60
 },
 {
  "wait": 150
 },
 {
  "shot": "hunt-1-arrow"
 },
 {
  "wait": 500
 },
 {
  "press": "Space",
  "ms": 60
 },
 {
  "wait": 700
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); const w = g.combat.wildlife; return JSON.stringify({creatures: w.state.creatures.map(c => [c.kind, c.state, +c.x.toFixed(2), c.hp]), pickups: w.state.pickups.map(p => [p.item, p.qty]), hp: +g.session.vitals.hp.toFixed(1), stamina: +g.session.vitals.stamina.toFixed(1), gel: g.session.inventory.filter(s => s && s.item === 'gel').reduce((n, s) => n + s.qty, 0), meat: g.session.inventory.filter(s => s && s.item === 'raw_meat').reduce((n, s) => n + s.qty, 0), arrows: g.session.inventory.filter(s => s && s.item === 'arrow').reduce((n, s) => n + s.qty, 0)}); })()"
 },
 {
  "shot": "hunt-2-after"
 },
 {
  "press": "ArrowRight",
  "ms": 2400
 },
 {
  "wait": 700
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); const w = g.combat.wildlife; return JSON.stringify({creatures: w.state.creatures.map(c => [c.kind, c.state, +c.x.toFixed(2), c.hp]), pickups: w.state.pickups.map(p => [p.item, p.qty]), hp: +g.session.vitals.hp.toFixed(1), stamina: +g.session.vitals.stamina.toFixed(1), gel: g.session.inventory.filter(s => s && s.item === 'gel').reduce((n, s) => n + s.qty, 0), meat: g.session.inventory.filter(s => s && s.item === 'raw_meat').reduce((n, s) => n + s.qty, 0), arrows: g.session.inventory.filter(s => s && s.item === 'arrow').reduce((n, s) => n + s.qty, 0)}); })()"
 },
 {
  "shot": "hunt-3-loot"
 },
 {
  "eval": "JSON.stringify(window.__errs)"
 }
]
```

Three monsters surround a hero with 14 hit points: the collapse dialog opens, nothing hits him while it is open, waking up clears the monsters:

`tools/scripts/monster-death.json`:

```json
[
 {
  "goto": "http://localhost:5199/"
 },
 {
  "eval": "localStorage.clear()"
 },
 {
  "goto": "http://localhost:5199/"
 },
 {
  "until": "window.__game && __game.scene.isActive('Menu')",
  "timeout": 20000
 },
 {
  "eval": "__game.scene.getScene('Menu').goTo('Game', {slot: 0, seed: 1234})"
 },
 {
  "until": "__game.scene.isActive('Game') && __game.scene.isActive('Hud')",
  "timeout": 20000
 },
 {
  "wait": 800
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); const w = g.world; const S = w.size; const c = w.landmarks.find(l => l.id === 'camp'); let best = null; for (let r = 4; r < 40 && !best; r++) for (let dy = -r; dy <= r && !best; dy++) for (let dx = -r; dx <= r && !best; dx++) { let ok = true; for (let yy = -4; yy <= 4 && ok; yy++) for (let xx = -4; xx <= 4 && ok; xx++) { const x = c.x + dx + xx, y = c.y + dy + yy; if (x < 1 || y < 1 || x >= S - 1 || y >= S - 1) { ok = false; break; } const i = y * S + x; if (w.terrain[i] !== 3 || g.solids.has(i)) ok = false; } if (ok) best = { x: c.x + dx, y: c.y + dy }; } if (!best) return 'no clearing'; g.pos = { x: best.x + 0.5, y: best.y + 0.5 }; g.player.face(1, 0); return 'clearing ' + best.x + ',' + best.y; })()"
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); const inv = g.session.inventory.slice(); inv[0] = {item:'sword_stone', qty:1, dur:80}; inv[1] = {item:'bow', qty:1, dur:80}; inv[2] = {item:'arrow', qty:12}; g.session = {...g.session, inventory: inv, selected: 0}; const w = g.combat.wildlife; w.state = {...w.state, spawnTimer: 9999}; return 'armed'; })()"
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); g.session = {...g.session, vitals: {...g.session.vitals, hp: 14}}; return 'hp 14'; })()"
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); const w = g.combat.wildlife; const mk = (id, kind, dx, dy, hp) => ({id, kind, x: g.pos.x + dx, y: g.pos.y + dy, hp, facing: 'left', state: 'chase', timer: 1, headX: 0, headY: 0, angry: false, pushX: 0, pushY: 0, stun: 0}); w.state = {...w.state, creatures: [mk(910,'skeleton',1.4,0,14),mk(911,'skeleton',-1.4,0,14),mk(912,'zombie',0,1.4,18)], nextId: 1000}; w.apply(w.state, []); return 'placed'; })()"
 },
 {
  "wait": 300
 },
 {
  "until": "__game.scene.getScene('Game').dead === true",
  "timeout": 10000
 },
 {
  "eval": "'collapsed: dead=' + __game.scene.getScene('Game').dead + ' hp=' + __game.scene.getScene('Game').session.vitals.hp.toFixed(1)"
 },
 {
  "shot": "monster-death-dialog"
 },
 {
  "wait": 1500
 },
 {
  "eval": "'hp still ' + __game.scene.getScene('Game').session.vitals.hp.toFixed(1) + ' (no further blows while down)'"
 },
 {
  "eval": "__game.scene.getScene('Game').wakeUp(); 'woke up'"
 },
 {
  "wait": 600
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); const w = g.combat.wildlife; return 'after waking: dead=' + g.dead + ' hp=' + g.session.vitals.hp + ' creatures=' + w.state.creatures.length + ' alpha=' + g.player.sprite.alpha; })()"
 },
 {
  "shot": "monster-death-woke"
 },
 {
  "eval": "JSON.stringify(window.__errs)"
 }
]
```

Night on a mountain far from the start: monsters of that region appear 12 to 20 tiles away:

`tools/scripts/spawn.json`:

```json
[
 {
  "goto": "http://localhost:5199/"
 },
 {
  "eval": "localStorage.clear()"
 },
 {
  "goto": "http://localhost:5199/"
 },
 {
  "until": "window.__game && __game.scene.isActive('Menu')",
  "timeout": 20000
 },
 {
  "eval": "__game.scene.getScene('Menu').goTo('Game', {slot: 0, seed: 1234})"
 },
 {
  "until": "__game.scene.isActive('Game') && __game.scene.isActive('Hud')",
  "timeout": 20000
 },
 {
  "wait": 800
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); const w = g.world; const S = w.size; const s = w.start; let best = null; for (let i = 0; i < S * S && !best; i += 7) { if (w.biome[i] === 2 && w.terrain[i] === 6 && !g.solids.has(i)) { const x = i % S, y = Math.floor(i / S); if (Math.hypot(x - s.x, y - s.y) > 40) best = { x, y }; } } if (!best) return 'no mountain'; g.pos = { x: best.x + 0.5, y: best.y + 0.5 }; g.session = {...g.session, clock: {day: 1, t: 450}}; return 'mountain at ' + best.x + ',' + best.y; })()"
 },
 {
  "wait": 16000
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); const w = g.combat.wildlife; const cs = w.state.creatures; const kinds = {}; cs.forEach(c => kinds[c.kind] = (kinds[c.kind] || 0) + 1); const dists = cs.map(c => Math.hypot(c.x - g.pos.x, c.y - g.pos.y)); return 'creatures=' + cs.length + ' kinds=' + JSON.stringify(kinds) + ' nearest=' + Math.min(...dists).toFixed(1) + ' farthest=' + Math.max(...dists).toFixed(1) + ' hero hp=' + g.session.vitals.hp.toFixed(0); })()"
 },
 {
  "shot": "spawn-mountain-night"
 },
 {
  "eval": "JSON.stringify(window.__errs)"
 }
]
```

All 16 clips exist, the music follows the situation (day, battle, day again, night), and nothing warns about missing audio:

`tools/scripts/audio.json`:

```json
[
 {
  "goto": "http://localhost:5199/"
 },
 {
  "eval": "localStorage.clear()"
 },
 {
  "goto": "http://localhost:5199/"
 },
 {
  "eval": "window.__warns = []; const w = console.warn; console.warn = (...a) => { window.__warns.push(a.join(' ')); w(...a); }"
 },
 {
  "until": "window.__game && __game.scene.isActive('Menu')",
  "timeout": 20000
 },
 {
  "wait": 600
 },
 {
  "eval": "'menu music: ' + __services.audio.musicKey + ' playing=' + (__services.audio.music && !__services.audio.music.paused)"
 },
 {
  "eval": "__game.scene.getScene('Menu').goTo('Game', {slot: 0, seed: 1234})"
 },
 {
  "until": "__game.scene.isActive('Game') && __game.scene.isActive('Hud')",
  "timeout": 20000
 },
 {
  "wait": 1200
 },
 {
  "eval": "'clips missing: ' + JSON.stringify(['swing','hit','kill','hurt','shoot','pickup','chop','mine','eat','drink','craft','place','break','sleep','ui_click','death'].filter(c => !__services.audio.hasClip(c)))"
 },
 {
  "eval": "'day music: ' + __services.audio.musicKey + ' currentTime=' + (__services.audio.music && __services.audio.music.currentTime.toFixed(2)) + ' volume=' + (__services.audio.music && __services.audio.music.volume.toFixed(2))"
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); const w = g.world; const S = w.size; const c = w.landmarks.find(l => l.id === 'camp'); let best = null; for (let r = 4; r < 40 && !best; r++) for (let dy = -r; dy <= r && !best; dy++) for (let dx = -r; dx <= r && !best; dx++) { let ok = true; for (let yy = -4; yy <= 4 && ok; yy++) for (let xx = -4; xx <= 4 && ok; xx++) { const x = c.x + dx + xx, y = c.y + dy + yy; if (x < 1 || y < 1 || x >= S - 1 || y >= S - 1) { ok = false; break; } const i = y * S + x; if (w.terrain[i] !== 3 || g.solids.has(i)) ok = false; } if (ok) best = { x: c.x + dx, y: c.y + dy }; } if (!best) return 'no clearing'; g.pos = { x: best.x + 0.5, y: best.y + 0.5 }; g.player.face(1, 0); return 'clearing ' + best.x + ',' + best.y; })()"
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); const inv = g.session.inventory.slice(); inv[0] = {item:'sword_stone', qty:1, dur:80}; inv[1] = {item:'bow', qty:1, dur:80}; inv[2] = {item:'arrow', qty:12}; g.session = {...g.session, inventory: inv, selected: 0}; const w = g.combat.wildlife; w.state = {...w.state, spawnTimer: 9999}; return 'armed'; })()"
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); const w = g.combat.wildlife; const mk = (id, kind, dx, dy, hp) => ({id, kind, x: g.pos.x + dx, y: g.pos.y + dy, hp, facing: 'left', state: 'idle', timer: 1, headX: 0, headY: 0, angry: false, pushX: 0, pushY: 0, stun: 0}); w.state = {...w.state, creatures: [mk(900,'slime',2.2,0,8)], nextId: 1000}; w.apply(w.state, []); return 'placed'; })()"
 },
 {
  "wait": 900
 },
 {
  "eval": "'fight music: ' + __services.audio.musicKey"
 },
 {
  "press": "Space",
  "ms": 60
 },
 {
  "wait": 420
 },
 {
  "press": "Space",
  "ms": 60
 },
 {
  "wait": 420
 },
 {
  "press": "Space",
  "ms": 60
 },
 {
  "wait": 420
 },
 {
  "press": "Space",
  "ms": 60
 },
 {
  "wait": 420
 },
 {
  "press": "Space",
  "ms": 60
 },
 {
  "wait": 420
 },
 {
  "wait": 5200
 },
 {
  "eval": "'calm music: ' + __services.audio.musicKey"
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); g.session = {...g.session, clock: {day: 1, t: 450}}; return 'set night'; })()"
 },
 {
  "wait": 1500
 },
 {
  "eval": "'night music: ' + __services.audio.musicKey"
 },
 {
  "eval": "'warnings: ' + JSON.stringify(window.__warns)"
 },
 {
  "eval": "JSON.stringify(window.__errs)"
 }
]
```

24 creatures chase the hero while the frame rate is sampled and the CPU is profiled:

`tools/scripts/perf-fight.json`:

```json
[
 {
  "goto": "http://localhost:5199/"
 },
 {
  "eval": "localStorage.clear()"
 },
 {
  "goto": "http://localhost:5199/"
 },
 {
  "until": "window.__game && __game.scene.isActive('Menu')",
  "timeout": 20000
 },
 {
  "eval": "__game.scene.getScene('Menu').goTo('Game', {slot: 0, seed: 1234})"
 },
 {
  "until": "__game.scene.isActive('Game') && __game.scene.isActive('Hud')",
  "timeout": 20000
 },
 {
  "wait": 800
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); const w = g.world; const S = w.size; const c = w.landmarks.find(l => l.id === 'camp'); let best = null; for (let r = 4; r < 40 && !best; r++) for (let dy = -r; dy <= r && !best; dy++) for (let dx = -r; dx <= r && !best; dx++) { let ok = true; for (let yy = -4; yy <= 4 && ok; yy++) for (let xx = -4; xx <= 4 && ok; xx++) { const x = c.x + dx + xx, y = c.y + dy + yy; if (x < 1 || y < 1 || x >= S - 1 || y >= S - 1) { ok = false; break; } const i = y * S + x; if (w.terrain[i] !== 3 || g.solids.has(i)) ok = false; } if (ok) best = { x: c.x + dx, y: c.y + dy }; } if (!best) return 'no clearing'; g.pos = { x: best.x + 0.5, y: best.y + 0.5 }; g.player.face(1, 0); return 'clearing ' + best.x + ',' + best.y; })()"
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); const w = g.combat.wildlife; const kinds = ['slime','mushroom','wasp','skeleton','zombie','worm','ghost','scorpion','rabbit','fox','bird','boar']; const cs = []; for (let i = 0; i < 24; i++) cs.push({id: 800 + i, kind: kinds[i % kinds.length], x: g.pos.x + Math.cos(i) * (4 + (i % 5)), y: g.pos.y + Math.sin(i) * (4 + (i % 5)), hp: 99, facing: 'down', state: 'chase', timer: 0, headX: 0, headY: 0, angry: true, pushX: 0, pushY: 0, stun: 0}); const items = []; for (let i = 0; i < 20; i++) items.push({id: 700 + i, item: 'bone', qty: 1, x: g.pos.x + (i % 5) - 2, y: g.pos.y + 6 + Math.floor(i / 5), age: 0}); w.state = {...w.state, creatures: cs, pickups: items, spawnTimer: 9999}; w.apply(w.state, []); g.session = {...g.session, vitals: {...g.session.vitals, hp: 100000}}; return 'crowd of ' + cs.length; })()"
 },
 {
  "wait": 2500
 },
 {
  "eval": "(() => { window.__fps = []; window.__fpsTimer = setInterval(() => window.__fps.push(__game.loop.actualFps), 250); return 'sampling'; })()"
 },
 {
  "profile": 4000,
  "top": 14
 },
 {
  "eval": "(() => { clearInterval(window.__fpsTimer); const f = window.__fps.slice(); f.sort((a, b) => a - b); return 'fps min=' + f[0].toFixed(0) + ' median=' + f[Math.floor(f.length / 2)].toFixed(0) + ' samples=' + f.length + ' creatures=' + __game.scene.getScene('Game').combat.wildlife.state.creatures.length; })()"
 },
 {
  "shot": "perf-crowd"
 },
 {
  "eval": "JSON.stringify(window.__errs)"
 }
]
```

A visual check: every creature and every loot icon in one picture:

`tools/scripts/zoo.json`:

```json
[
 { "goto": "http://localhost:5199/" },
 { "eval": "localStorage.clear()" },
 { "goto": "http://localhost:5199/" },
 { "until": "window.__game && __game.scene.isActive('Menu')", "timeout": 20000 },
 { "eval": "__game.scene.getScene('Menu').goTo('Game', {slot: 0, seed: 1234})" },
 { "until": "__game.scene.isActive('Game') && __game.scene.isActive('Hud')", "timeout": 20000 },
 { "wait": 800 },
 { "eval": "(() => { const g = __game.scene.getScene('Game'); const w = g.world; const S = w.size; const c = w.landmarks.find(l => l.id === 'camp'); let best = null; for (let r = 4; r < 40 && !best; r++) for (let dy = -r; dy <= r && !best; dy++) for (let dx = -r; dx <= r && !best; dx++) { let ok = true; for (let yy = -4; yy <= 4 && ok; yy++) for (let xx = -4; xx <= 4 && ok; xx++) { const x = c.x + dx + xx, y = c.y + dy + yy; if (x < 1 || y < 1 || x >= S - 1 || y >= S - 1) { ok = false; break; } const i = y * S + x; if (w.terrain[i] !== 3 || g.solids.has(i)) ok = false; } if (ok) best = { x: c.x + dx, y: c.y + dy }; } if (!best) return 'no clearing'; g.pos = { x: best.x + 0.5, y: best.y + 0.5 }; g.player.face(0, 1); return 'clearing ' + best.x + ',' + best.y; })()" },
 { "eval": "(() => { const g = __game.scene.getScene('Game'); const w = g.combat.wildlife; const kinds = ['slime','mushroom','wasp','skeleton','zombie','worm','ghost','scorpion','skeleton_warrior','rabbit','fox','bird','boar']; const cs = kinds.map((k, i) => ({id: 800 + i, kind: k, x: g.pos.x + ((i % 5) - 2) * 1.5, y: g.pos.y - 3 + Math.floor(i / 5) * 2, hp: 99, facing: 'down', state: 'idle', timer: 999, headX: 0, headY: 0, angry: false, pushX: 0, pushY: 0, stun: 0})); const items = ['raw_meat','cooked_meat','bone','gel','honey','bandage','arrow'].map((it, i) => ({id: 700 + i, item: it, qty: 1, x: g.pos.x - 3 + i, y: g.pos.y + 3.2, age: 0})); w.state = {...w.state, creatures: cs, pickups: items, spawnTimer: 9999}; w.apply(w.state, []); return 'zoo ' + cs.length; })()" },
 { "wait": 300 },
 { "shot": "zoo" },
 { "eval": "JSON.stringify(window.__errs)" }
]
```

- [ ] **Step 2: Run the new scenarios**

Run each, from the repository root, and compare:

```bash
for n in fight hunt monster-death spawn audio perf-fight zoo; do echo "=== $n"; node tools/play.mjs tools/scripts/$n.json tools/.cache/shots 2>&1 | tail -14; done
```

Expected:
- `fight`: the state after the fight shows `"creatures":[]`, `"pickups":[]`, `"gel":` at least 1, `hp` below 100 (the slime got a blow in); `page errors: []`.
- `hunt`: before walking, the rabbit is dead and `"pickups":[["raw_meat",1]]`; after walking, `"meat":1`, `"arrows":10`; `page errors: []`.
- `monster-death`: `collapsed: dead=true hp=0.0`; `hp still 0.0 (no further blows while down)`; `after waking: dead=false hp=60.` with `creatures=0 alpha=1`; `page errors: []`.
- `spawn`: `creatures=` between 5 and 12, kinds from the mountain and its neighbours, `nearest=` at least 11; `page errors: []`.
- `audio`: `menu music: day playing=true`, `clips missing: []`, `fight music: battle`, `calm music: day`, `night music: night`, `warnings: []`; `page errors: []`.
- `perf-fight`: `fps median=` 50 or more with `creatures=24`; `page errors: []`.
- `zoo`: `zoo 13` and `page errors: []`. Open `tools/.cache/shots/zoo.png`: slime, mushroom, wasp, skeleton, zombie, worm, ghost, scorpion, skeleton warrior, rabbit, fox, bird and boar stand around the hero, with seven loot icons below.

Look at `tools/.cache/shots/monster-death-dialog.png`, `fight-2-after.png` and `hunt-1-arrow.png` as well: a red `-10` over the hero and the collapse dialog; a damage number and a health bar on the slime; an arrow in flight.

- [ ] **Step 3: Run every older scenario again**

```bash
for n in badsave boot build corrupt death-back death harvest island migrate night pause perf persist sleep survive tools; do echo "=== $n"; node tools/play.mjs tools/scripts/$n.json tools/.cache/shots 2>&1 | tail -3; done
```

Expected: every scenario ends with `page errors: []` (the same results as at the end of plan 2).

- [ ] **Step 4: Update the README**

`README.md`:

```markdown
# Tidewake: Island Survival

Offline 2D pixel-art survival game for Android (Phaser 3 + TypeScript, packaged with Capacitor).
Design: `docs/superpowers/specs/2026-10-03-tidewake-design.md`. Plans: `docs/superpowers/plans/`.

## Run

    npm install
    npm run dev          # http://localhost:5199
    npm test             # unit tests
    npm run test:cov     # tests + coverage gate (80%)
    npm run build        # typecheck + production build into dist/

## Assets

Sprites are packed from the licensed Unity pack *Super Retro Collection* by Gif, read from
`E:\Pixel Games Asset Master` (never modified):

    npm run assets       # tools/pack_assets.py + tools/pack_tiles.py

Generated files in `public/assets/pack/` and `src/data/tileIndex.ts` are committed.

Sound is synthesized offline by code (no samples, no network, no API keys): `npm run audio` runs
`tools/gen_audio.py`, which writes `public/assets/audio/` (a sound-effect sprite and three music loops as Ogg Vorbis).
It needs `numpy`, `scipy` and `imageio-ffmpeg` (or `ffmpeg` on the PATH). The generated files are committed.

## Browser smoke tests

With `npm run dev` running: `node tools/play.mjs tools/scripts/<name>.json tools/.cache/shots`.
Scenarios: boot, island, harvest, persist, night, pause, corrupt, badsave, survive, build, tools, death, death-back, sleep, migrate, perf, fight, hunt, monster-death, spawn, audio, perf-fight, zoo.

## Status (phase 3)

A survival game on a seed-generated island: hunger, thirst, stamina and health; a 32-slot backpack with a hotbar;
tools with tiers and durability; 21 recipes at the hand, campfire, workbench and furnace; building (campfire,
workbench, furnace, bed, chest, torch, fence) and taking buildings down; four farmed crops; a real night with
light from fires and torches; sleeping; death rules per difficulty; save format 2 (phase 1 saves still load).
Phase 3 adds fighting and hunting: 9 monsters and 4 animals that spawn by biome and time of day (monsters keep away
from the starting beach and from fire light), swords, a bone spear and a bow with arrows, knockback, hit-stop, damage
numbers, loot that lies on the ground and is picked up on contact, raw and cooked meat, honey and bandages for
healing, sound effects and day, night and battle music. Controls: USE (or Space or E) swings the held weapon at what
is in front of you, shoots the bow, or does whatever the held item does; with bare hands or a tool it fights back when
something is in reach.
Measured on the dev PC (headless Edge): tap-to-game 415 ms, 60 fps, still 58 fps with 24 creatures chasing.

## Credits

Pixel art: Super Retro Collection by Gif. Fonts: Jersey and Tiny5 (SIL OFL).
```

- [ ] **Step 5: Final checks**

Run: `npm test && npm run test:cov && npm run build`
Expected: 373 tests PASS; coverage above 80%; the build succeeds. Stop the dev server you started in Task 9 (only that one).

- [ ] **Step 6: Commit**

```bash
git add tools/scripts README.md
git commit -m "test: add combat, hunting, death, spawning, audio and crowd scenarios; update docs"
```

