# Tidewake Survival Systems Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the walkable island into a survival game: hunger, thirst, stamina and health; a 32-slot backpack with a hotbar; tools with tiers and durability; crafting at the hand, campfire, workbench and furnace; building (campfire, workbench, furnace, bed, chest, torch, fence); farming four crops; real night light; sleeping; and the death rules of each difficulty.

**Architecture:** Same split as plan 1. Rules are pure, immutable and unit-tested: items, inventory, vitals, crafting, tools, structures, farming, the action resolver (`resolveAction`: what ACTION does right now) and a `Session` module (`applyAction`: how a chosen action changes the game and what effects to show). The Phaser scenes only gather input, ask the resolver, apply the result and draw the effects. The save format moves to version 2 and still loads version 1 saves.

**Tech Stack:** unchanged (Phaser 3.90, TypeScript 5.9, Vite 7, Vitest 3, Capacitor 8 plugins, Python + Pillow for assets, Playwright + Edge for browser smoke tests).

**Spec:** `docs/superpowers/specs/2026-10-03-tidewake-design.md` (this plan implements phase 2 of section 11, plus sections 4, 7 and 8 as they apply to survival, inventory and saving).

**Builds on:** tag `phase-1` of this repository (`docs/superpowers/plans/2026-10-03-tidewake-foundation-and-island.md`).

## Scope of this plan

Delivered: everything in the goal above, 36 items, 21 recipes, 4 crops, an icon atlas drawn in code (the Unity pack has no tool, material or building icons), HUD vitals and hotbar, a backpack / crafting / chest screen, a night overlay with lights, and the fixes from the phase 1 review (world version in saves, joystick and hotbar do not clash, pause saves).

Deferred on purpose:
- Combat, enemies, animals, hunting and cooked meat (plan 3); armour and weapons (plan 3).
- Rain, weather, seasons, water bottles, fishing (later plans; for now the river is the water source).
- A pre-built starter camp, tutorial hints and the real NPC huts and dungeons (plans 5 and 6).
- The gold tier of tools and armour (the spec lists wood, stone, iron and gold; gold needs a later ore).
- Quick-eat button, item drop-on-death piles (the Normal penalty simply loses half of the hotbar), repairing tools, a balance file for all constants (plan 7).

## Global Constraints

- Phaser `^3.90.0`, TypeScript `5.9`, Vite `^7.3.6`, Vitest `^3.2.7`, Capacitor `^8.5.2` plugins; Node 22 or newer. No new dependencies.
- Android package id `com.fajar.tidewake`. Portrait; 16x16 tiles; world camera zoom `worldZoom(2)`; layout in virtual pixels (`view.w`, `view.h`).
- The world is regenerated from a seed; a save stores the seed, `worldVersion` (generator version) and the player's changes only.
- Save format is **version 2**; version 1 saves must still load (their `bag` becomes inventory items). A save claiming any other version is rejected.
- Languages: English and Bahasa Indonesia; every UI string is in `src/data/strings.ts` with matching `{placeholders}`.
- Tool tiers: wood 1, stone 2, iron 3. Damage per hit: bare hands 0.34, tiers 1/2/3 = 1/2/3. Ore needs tier 2, crystal tier 3.
- Death: Relaxed keeps everything, Normal loses half of every hotbar stack (tools: 50% each), Hardcore deletes the save. The hero wakes at the last bed or the start with 60 hit points, hunger and thirst.
- Anything the player builds can be taken down again (fences and torches with ACTION, stations/beds/chests with ACTION while holding an axe or pickaxe; a chest must be empty), so nobody can trap themselves.
- `src/sim/` and `src/data/` never import Phaser; `src/sim/` functions never mutate their arguments and return new values.
- Files stay under 400 lines (hard limit 800; `GameScene.ts` is slightly over 400 and is split in plan 3); functions under 50 lines.
- Coverage of `src/sim/**`, `src/data/**` and the testable `src/core/` files stays at least 80% lines (`npm run test:cov`).
- The Unity pack at `E:\Pixel Games Asset Master` is read-only. API keys from `E:\Game Dev Tools.txt` are never copied into the repo.
- Commits use `<type>: <description>` with no attribution trailer; commit locally, never push.
- The dev server runs on port **5188** (`strictPort`); port 5173 belongs to another project of the owner. Never stop processes you did not start.

## Review Focus

Inputs and conditions the spec implies but that are easy to miss. Each has tests or a scripted scenario in the task that owns it.

1. **Hand-edited or corrupt save contents** beyond the clock and node ids: unknown items, negative or huge counts, broken or zero-durability tools, structures off the map or on the same tile, crops with impossible growth. They are dropped or clamped; the rest of the save loads. A version 1 save upgrades. Tests: Task 7. Scenario: `migrate.json` (Task 12).
2. **A full backpack**: harvesting, picking crops and taking buildings down never destroy items silently; crafting is all-or-nothing; moving into a full chest keeps what does not fit. Tests: Tasks 2, 4, 8.
3. **Dying**: the collapse dialog cannot be dismissed with the Back button, Hardcore deletes the save and the scene shutdown must not write it again, and waking up never lands the hero back in the death spot. Tests: Task 3 and 8. Scenario: `death.json`.
4. **Sleeping and day boundaries**: sleeping jumps to the next dawn and the day rolls exactly once (crops grow once, nodes regrow once, one "Day N" toast); sleeping by day only sets the respawn point. Tests: Tasks 3 and 8. Scenario: `sleep.json`.
5. **Trapping or blocking yourself** with buildings, and building where it makes no sense (water, the hero's own tile, out of reach, on soil or on top of another building). Tests: Tasks 5, 6 and 8. Scenario: `build.json`.

---

## File Structure

```
src/data/    items, crops, structures, recipes, tools, resources (changed), strings (changed)
src/sim/     inventory, vitals, death, crafting, tools, structures, farm, actions, session   (new)
             daynight, gather, world/generate (changed)
src/core/    saveData (new: save format 2), save (store; re-exports saveData)
src/gfx/     StructureLayer, FarmLayer, NightLight (new)
src/ui/      itemIcon (new), Joystick (changed)
src/scenes/  GameScene, HudScene (rewritten), InventoryScene (new), PreloadScene, index (changed)
tools/       make_icons.py (new), pack_tiles.py (changed), scripts/*.json (new and updated smoke scenarios)
public/assets/pack/icons.{png,json}   generated, committed
tests/       one file per module group (see tasks)
```

## Pre-flight

Run once. Expected: after committing this plan file the working tree is clean, the tag exists, 112 tests pass and port 5188 is free.

```bash
cd "E:/RPG Survival Sprite Sonnet 55"
git add docs && git commit -m "docs: add plan 2 for survival systems"
git status --short && git tag --list phase-1
npm test 2>&1 | tail -4
curl -s -o /dev/null -w "port 5188 answers: %{http_code}\n" http://localhost:5188/ || echo "port 5188 is free"
```

---

### Task 1: Item, crop and structure catalog; node drops with chances

**Files:**
- Create: `src/data/items.ts`, `src/data/crops.ts`, `src/data/structures.ts`
- Replace: `src/data/resources.ts`, `src/data/strings.ts`, `src/sim/gather.ts`
- Test: `tests/items.test.ts` (new), `tests/gather.test.ts` and `tests/i18n.test.ts` (replaced)

**Interfaces:**
- Produces: `ItemId` (36 ids), `ItemDef {id, stack, icon: {atlas, frame}, tool?, food?, place?, seed?}`, `ITEMS`, `ITEM_IDS`, `isItemId(v)`, `ToolType`; `CropId`, `CROPS`, `SEED_RETURN_CHANCE`; `StructureId`, `Station`, `STRUCTURES` (`solid`, `station?`, `light`, `pickup`, `frame`, `world?`), `CHEST_SLOTS = 20`; `Drop {item, min, max, chance?}` where `item` is an `ItemId`; `hitNode` honours `chance`.

- [ ] **Step 1: Write the failing tests**

`tests/items.test.ts`:

`tests/items.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { CROPS } from '@/data/crops';
import { ITEMS, ITEM_IDS, isItemId } from '@/data/items';
import { RESOURCES } from '@/data/resources';
import { STRUCTURES } from '@/data/structures';

describe('item catalog', () => {
  it('keys every entry by its own id, with a stack size and an icon', () => {
    for (const id of ITEM_IDS) {
      const def = ITEMS[id];
      expect(def.id).toBe(id);
      expect(def.stack).toBeGreaterThan(0);
      expect(def.icon.frame.length).toBeGreaterThan(0);
    }
  });

  it('never stacks tools and gives them a positive durability', () => {
    for (const def of Object.values(ITEMS)) {
      if (!def.tool) continue;
      expect(def.stack).toBe(1);
      expect(def.tool.durability).toBeGreaterThan(0);
    }
  });

  it('keeps tool tiers consistent with the item name', () => {
    expect(ITEMS.axe_wood.tool?.tier).toBe(1);
    expect(ITEMS.axe_stone.tool?.tier).toBe(2);
    expect(ITEMS.axe_iron.tool?.tier).toBe(3);
    expect(ITEMS.pickaxe_iron.tool?.tier).toBe(3);
  });

  it('links placeable items to real structures and seeds to real crops', () => {
    for (const def of Object.values(ITEMS)) {
      if (def.place) expect(STRUCTURES[def.place], def.id).toBeDefined();
      if (def.seed) expect(CROPS[def.seed].seed, def.id).toBe(def.id);
    }
    for (const s of Object.values(STRUCTURES)) expect(ITEMS[s.id].place).toBe(s.id);
  });

  it('makes food worth eating', () => {
    for (const def of Object.values(ITEMS)) {
      if (!def.food) continue;
      expect(def.food.hunger + def.food.thirst + def.food.hp, def.id).toBeGreaterThan(0);
    }
    expect(ITEMS.roasted_corn.food!.hunger).toBeGreaterThan(ITEMS.corn.food!.hunger);
    expect(ITEMS.coconut.food!.thirst).toBeGreaterThan(ITEMS.coconut.food!.hunger);
  });

  it('only lets nodes drop items that exist, with sound chances', () => {
    for (const [kind, def] of Object.entries(RESOURCES)) {
      for (const d of def.drops) {
        expect(isItemId(d.item), `${kind} drops ${d.item}`).toBe(true);
        if (d.chance !== undefined) {
          expect(d.chance).toBeGreaterThan(0);
          expect(d.chance).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('can be reached from the island: fibre, wood and stone come from nodes', () => {
    const dropped = new Set(Object.values(RESOURCES).flatMap((r) => r.drops.map((d) => d.item)));
    for (const item of ['wood', 'stone', 'fiber', 'iron_ore', 'coconut', 'berries', 'carrot_seed', 'corn_seed', 'pumpkin_seed', 'turnip_seed'] as const) {
      expect(dropped.has(item), item).toBe(true);
    }
  });

  it('recognises item ids safely', () => {
    expect(isItemId('wood')).toBe(true);
    expect(isItemId('toString')).toBe(false);
    expect(isItemId(5)).toBe(false);
  });
});
```

Replace `tests/gather.test.ts` (adds drop-chance tests; the rest is unchanged):

`tests/gather.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/rng';
import { RESOURCES } from '@/data/resources';
import { RESPAWN_DAYS, emptyGather, hitNode, isAlive, sanitizeGather, startNewDay } from '@/sim/gather';
import type { ResourceNode } from '@/sim/world/types';

const tree: ResourceNode = { id: 7, kind: 'tree', x: 10, y: 10, variant: 3 };
const rock: ResourceNode = { id: 8, kind: 'rock', x: 12, y: 10, variant: 1 };

describe('hitNode', () => {
  it('chips a node without destroying it and keeps the input untouched', () => {
    const s = emptyGather();
    const r = hitNode(s, tree, 1, 1, new Rng(1));
    expect(r.destroyed).toBe(false);
    expect(r.drops).toEqual([]);
    expect(r.state.hp[7]).toBe(RESOURCES.tree.hp - 1);
    expect(s).toEqual(emptyGather());
  });

  it('destroys a node after enough hits and drops items within the configured range', () => {
    let s = emptyGather();
    let last = hitNode(s, tree, 1, 1, new Rng(2));
    for (let i = 1; i < RESOURCES.tree.hp; i++) {
      s = last.state;
      last = hitNode(s, tree, 1, 1, new Rng(2));
    }
    expect(last.destroyed).toBe(true);
    expect(isAlive(last.state, tree.id)).toBe(false);
    expect(last.state.hp[tree.id]).toBeUndefined();
    const wood = last.drops.find((d) => d.item === 'wood')!;
    expect(wood.amount).toBeGreaterThanOrEqual(2);
    expect(wood.amount).toBeLessThanOrEqual(4);
  });

  it('can destroy in one hit with enough damage', () => {
    const r = hitNode(emptyGather(), rock, 99, 1, new Rng(3));
    expect(r.destroyed).toBe(true);
    expect(r.drops.every((d) => d.amount > 0)).toBe(true);
  });

  it('ignores hits on destroyed nodes and zero or negative damage', () => {
    const gone = hitNode(emptyGather(), rock, 99, 1, new Rng(3)).state;
    const again = hitNode(gone, rock, 5, 1, new Rng(3));
    expect(again.state).toBe(gone);
    expect(again.drops).toEqual([]);
    const s = emptyGather();
    expect(hitNode(s, tree, 0, 1, new Rng(1)).state).toBe(s);
    expect(hitNode(s, tree, -3, 1, new Rng(1)).state).toBe(s);
  });
});

describe('startNewDay', () => {
  it('heals damaged nodes', () => {
    const damaged = hitNode(emptyGather(), tree, 2, 1, new Rng(1)).state;
    expect(startNewDay(damaged, 2).hp).toEqual({});
  });

  it('regrows destroyed nodes only after RESPAWN_DAYS', () => {
    const gone = hitNode(emptyGather(), rock, 99, 5, new Rng(1)).state;
    expect(isAlive(startNewDay(gone, 5 + RESPAWN_DAYS - 1), rock.id)).toBe(false);
    expect(isAlive(startNewDay(gone, 5 + RESPAWN_DAYS), rock.id)).toBe(true);
  });

  it('postpones regrowth for nodes the caller wants to keep clear', () => {
    const gone = hitNode(emptyGather(), rock, 99, 1, new Rng(1)).state;
    const day = 1 + RESPAWN_DAYS;
    expect(isAlive(startNewDay(gone, day, (id) => id === rock.id), rock.id)).toBe(false);
    expect(isAlive(startNewDay(gone, day + 1), rock.id)).toBe(true);
  });

  it('keeps other nodes gone while one regrows', () => {
    let s = hitNode(emptyGather(), rock, 99, 1, new Rng(1)).state;
    s = hitNode(s, tree, 99, 3, new Rng(1)).state;
    const next = startNewDay(s, 1 + RESPAWN_DAYS);
    expect(isAlive(next, rock.id)).toBe(true);
    expect(isAlive(next, tree.id)).toBe(false);
  });
});

describe('drop chances', () => {
  const palm: ResourceNode = { id: 20, kind: 'palm', x: 5, y: 5, variant: 0 };
  const bushNode: ResourceNode = { id: 21, kind: 'bush', x: 6, y: 5, variant: 0 };

  it('makes chance drops come and go, but always gives the certain ones', () => {
    const coconuts = new Set<boolean>();
    for (let seed = 0; seed < 60; seed++) {
      const r = hitNode(emptyGather(), palm, 99, 1, new Rng(seed));
      coconuts.add(r.drops.some((d) => d.item === 'coconut'));
      expect(r.drops.some((d) => d.item === 'wood')).toBe(true);
    }
    expect(coconuts.size).toBe(2);
  });

  it('only ever drops seeds from nodes that list them', () => {
    const seeds = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      for (const d of hitNode(emptyGather(), bushNode, 99, 1, new Rng(seed)).drops) if (d.item.endsWith('_seed')) seeds.add(d.item);
    }
    expect([...seeds].sort()).toEqual(['carrot_seed', 'turnip_seed']);
  });
});

describe('sanitizeGather', () => {
  it('drops ids that are not nodes of this island (a hand-edited save, or a changed generator)', () => {
    const dirty = { hp: { 3: 2, '-3': 1, 99999: 4 }, gone: { 5: 1, 10: 2, 1.5: 3 } } as unknown as Parameters<typeof sanitizeGather>[0];
    const clean = sanitizeGather(dirty, 10);
    expect(clean.hp).toEqual({ 3: 2 });
    expect(clean.gone).toEqual({ 5: 1 });
  });

  it('returns a new object and leaves valid state alone', () => {
    const state = { hp: { 1: 2 }, gone: { 2: 3 } };
    const out = sanitizeGather(state, 5);
    expect(out).toEqual(state);
    expect(out).not.toBe(state);
  });
});
```

Replace `tests/i18n.test.ts` (adds item, tool, station and placement-message name checks):

`tests/i18n.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { getLang, setLang, t, tr } from '@/core/i18n';
import { ITEM_IDS } from '@/data/items';
import { RESOURCES } from '@/data/resources';
import { UI_STRINGS } from '@/data/strings';

const placeholders = (s: string): string[] => (s.match(/\{\w+\}/g) ?? []).sort();

describe('UI strings', () => {
  it('has a non-empty English and Indonesian text for every key', () => {
    for (const [key, v] of Object.entries(UI_STRINGS)) {
      expect(v.en.trim(), `${key}.en`).not.toBe('');
      expect(v.id.trim(), `${key}.id`).not.toBe('');
    }
  });

  it('uses the same {placeholders} in both languages', () => {
    for (const [key, v] of Object.entries(UI_STRINGS)) {
      expect(placeholders(v.id), key).toEqual(placeholders(v.en));
    }
  });
});

describe('item names', () => {
  it('has a name for every item a resource can drop', () => {
    for (const def of Object.values(RESOURCES)) {
      for (const d of def.drops) expect(UI_STRINGS[`item_${d.item}`], `name for ${d.item}`).toBeDefined();
    }
  });
});

describe('item and tool names', () => {
  it('names every item in the catalog in both languages', () => {
    for (const id of ITEM_IDS) expect(UI_STRINGS[`item_${id}`], id).toBeDefined();
    for (const tool of ['axe', 'pickaxe', 'hoe', 'can']) expect(UI_STRINGS[`tool_${tool}`], tool).toBeDefined();
    for (const station of ['hand', 'campfire', 'workbench', 'furnace']) expect(UI_STRINGS[`station_${station}`], station).toBeDefined();
    for (const why of ['bounds', 'water', 'occupied', 'far', 'hero']) expect(UI_STRINGS[`msgPlace_${why}`], why).toBeDefined();
  });
});

describe('new game confirmation', () => {
  it('names the save that will be replaced, in both languages', () => {
    for (const lang of ['en', 'id'] as const) {
      setLang(lang);
      const text = t('newGameConfirm', { name: 'Ari', day: 4 });
      expect(text, lang).toContain('Ari');
      expect(text, lang).toContain('4');
      expect(text, lang).not.toContain('{');
    }
    setLang('en');
  });
});

describe('t / tr', () => {
  it('translates by key in the current language and fills variables', () => {
    setLang('en');
    expect(t('hudDay', { n: 3 })).toBe('Day 3');
    setLang('id');
    expect(t('hudDay', { n: 3 })).toBe('Hari 3');
    expect(getLang()).toBe('id');
    setLang('en');
  });

  it('returns unknown keys as-is and keeps unknown placeholders visible', () => {
    expect(t('does_not_exist')).toBe('does_not_exist');
    expect(tr({ en: 'Hi {name}', id: 'Halo {name}' }, {})).toBe('Hi {name}');
    expect(tr(undefined)).toBe('');
    expect(tr('plain')).toBe('plain');
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/items.test.ts tests/gather.test.ts tests/i18n.test.ts`
Expected: FAIL. `items.test.ts` cannot resolve `@/data/items`; the new gather and i18n tests fail on missing chance drops and missing strings.

- [ ] **Step 3: Write the catalog data**

`src/data/structures.ts`:

```typescript
/** Things the player can build. `station` is the crafting station a structure provides, if any. */
export type StructureId = 'campfire' | 'workbench' | 'furnace' | 'bed' | 'chest' | 'torch' | 'fence';

/** Where a recipe can be crafted. `hand` is always available. */
export type Station = 'hand' | 'campfire' | 'workbench' | 'furnace';

export interface StructureDef {
  id: StructureId;
  station?: Exclude<Station, 'hand'>;
  /** Blocks walking. Torches are decoration the hero can walk past. */
  solid: boolean;
  /** Still frame in the `icons` atlas: the inventory icon and the in-world sprite. */
  frame: string;
  /** Animated in-world sprite from the `props` atlas that replaces the still frame (fires and torches). */
  world?: { frame: string; anim: string };
  /** Radius of the night glow in tiles; 0 means none. */
  light: number;
  /**
   * How it is taken down: `always` with a plain ACTION (fences and torches), or `tool` while holding an axe or pickaxe
   * (stations, chests and beds, which ACTION otherwise uses). Nothing the player builds can trap them.
   */
  pickup: 'always' | 'tool';
}

export const STRUCTURES: Record<StructureId, StructureDef> = {
  campfire: { id: 'campfire', station: 'campfire', solid: true, frame: 'struct_campfire', world: { frame: 'fire/campfire_burning/0', anim: 'fire_campfire_burning' }, light: 5, pickup: 'tool' },
  workbench: { id: 'workbench', station: 'workbench', solid: true, frame: 'struct_workbench', light: 0, pickup: 'tool' },
  furnace: { id: 'furnace', station: 'furnace', solid: true, frame: 'struct_furnace', light: 2, pickup: 'tool' },
  bed: { id: 'bed', solid: true, frame: 'struct_bed', light: 0, pickup: 'tool' },
  chest: { id: 'chest', solid: true, frame: 'struct_chest', light: 0, pickup: 'tool' },
  torch: { id: 'torch', solid: false, frame: 'struct_torch', world: { frame: 'torch/torch_03/0', anim: 'torch_torch_03' }, light: 3, pickup: 'always' },
  fence: { id: 'fence', solid: true, frame: 'struct_fence', light: 0, pickup: 'always' },
};

/** Number of slots in a chest. */
export const CHEST_SLOTS = 20;
```

`src/data/crops.ts`:

```typescript
import type { ItemId } from './items';

export type CropId = 'carrot' | 'turnip' | 'pumpkin' | 'corn';

export interface CropDef {
  id: CropId;
  seed: ItemId;
  produce: ItemId;
  /** Watered days needed to ripen. */
  growDays: number;
  /** Which `plant/<sheet>/<stage>` sprite strip in the props atlas shows this crop. */
  sheet: number;
  /** Last growth stage of the strip; the plant is ripe at this stage. */
  ripeStage: number;
  yield: readonly [number, number];
}

export const CROPS: Record<CropId, CropDef> = {
  carrot: { id: 'carrot', seed: 'carrot_seed', produce: 'carrot', growDays: 3, sheet: 5, ripeStage: 3, yield: [1, 2] },
  turnip: { id: 'turnip', seed: 'turnip_seed', produce: 'turnip', growDays: 3, sheet: 6, ripeStage: 3, yield: [1, 2] },
  pumpkin: { id: 'pumpkin', seed: 'pumpkin_seed', produce: 'pumpkin', growDays: 5, sheet: 7, ripeStage: 4, yield: [1, 1] },
  corn: { id: 'corn', seed: 'corn_seed', produce: 'corn', growDays: 4, sheet: 8, ripeStage: 4, yield: [1, 2] },
};

/** Chance that harvesting a crop also returns one seed of the same kind. */
export const SEED_RETURN_CHANCE = 0.5;
```

`src/data/items.ts`:

```typescript
import type { CropId } from './crops';
import type { StructureId } from './structures';

export type ItemId =
  | 'wood' | 'stone' | 'fiber' | 'plank' | 'rope' | 'iron_ore' | 'iron_ingot' | 'crystal'
  | 'coconut' | 'berries' | 'carrot' | 'turnip' | 'pumpkin' | 'corn' | 'roasted_carrot' | 'roasted_corn' | 'baked_pumpkin'
  | 'carrot_seed' | 'turnip_seed' | 'pumpkin_seed' | 'corn_seed'
  | 'axe_wood' | 'axe_stone' | 'axe_iron' | 'pickaxe_wood' | 'pickaxe_stone' | 'pickaxe_iron' | 'hoe' | 'watering_can'
  | 'campfire' | 'workbench' | 'furnace' | 'bed' | 'chest' | 'torch' | 'fence';

export type ToolType = 'axe' | 'pickaxe' | 'hoe' | 'can';

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

- [ ] **Step 4: Replace the resource table, the gathering logic and the strings**

Resource nodes now drop catalog items, some with a chance (seeds, coconuts, fibre):

`src/data/resources.ts`:

```typescript
import type { ResourceKind } from '@/sim/world/types';
import type { ItemId } from './items';

export interface Drop {
  item: ItemId;
  min: number;
  max: number;
  /** Probability that this drop happens at all (default 1). */
  chance?: number;
}

export interface ResourceDef {
  /** Frame names in the `props` atlas; a node shows frames[variant % frames.length]. */
  frames: readonly string[];
  /** Hits (at damage 1) needed to destroy the node. */
  hp: number;
  drops: readonly Drop[];
}

export const RESOURCES: Record<ResourceKind, ResourceDef> = {
  tree: {
    frames: ['p/tree_02', 'p/tree_04', 'p/tree_13', 'p/tree_03', 'p/tree_01'],
    hp: 5,
    drops: [{ item: 'wood', min: 2, max: 4 }, { item: 'fiber', min: 1, max: 1, chance: 0.35 }],
  },
  palm: {
    frames: ['p/tree_06', 'p/tree_07'],
    hp: 4,
    drops: [
      { item: 'wood', min: 1, max: 2 },
      { item: 'coconut', min: 1, max: 1, chance: 0.7 },
      { item: 'fiber', min: 1, max: 2, chance: 0.5 },
      { item: 'corn_seed', min: 1, max: 1, chance: 0.2 },
    ],
  },
  bush: {
    frames: ['p/tree_30', 'p/tree_31'],
    hp: 2,
    drops: [
      { item: 'berries', min: 1, max: 3 },
      { item: 'fiber', min: 1, max: 2 },
      { item: 'carrot_seed', min: 1, max: 1, chance: 0.3 },
      { item: 'turnip_seed', min: 1, max: 1, chance: 0.3 },
    ],
  },
  rock: {
    frames: ['p/rock_18', 'p/rock_19', 'p/rock_20', 'p/rock_36'],
    hp: 6,
    drops: [{ item: 'stone', min: 2, max: 4 }],
  },
  ore: {
    frames: ['p/rock_44', 'p/rock_45'],
    hp: 9,
    drops: [{ item: 'iron_ore', min: 1, max: 2 }, { item: 'stone', min: 1, max: 1 }],
  },
  crystal: {
    frames: ['p/rock_15', 'p/rock_16', 'p/rock_17'],
    hp: 10,
    drops: [{ item: 'crystal', min: 1, max: 1 }],
  },
  swamptree: {
    frames: ['p/tree_15', 'p/tree_16', 'p/tree_17', 'p/tree_18'],
    hp: 5,
    drops: [
      { item: 'wood', min: 2, max: 3 },
      { item: 'fiber', min: 1, max: 2, chance: 0.5 },
      { item: 'pumpkin_seed', min: 1, max: 1, chance: 0.15 },
    ],
  },
  redrock: {
    frames: ['p/rock_02', 'p/rock_03', 'p/rock_07', 'p/rock_08'],
    hp: 5,
    drops: [{ item: 'stone', min: 1, max: 3 }],
  },
};

export function resourceFrame(kind: ResourceKind, variant: number): string {
  const frames = RESOURCES[kind].frames;
  return frames[variant % frames.length];
}
```

`src/sim/gather.ts`:

```typescript
import type { Rng } from '@/core/rng';
import type { ItemId } from '@/data/items';
import { RESOURCES } from '@/data/resources';
import type { ResourceNode } from '@/sim/world/types';

/** Days a destroyed node takes to grow back. */
export const RESPAWN_DAYS = 3;

/**
 * The player's changes to the generated world, stored as a diff so a save never has to hold the whole island:
 * `hp` is remaining hit points of damaged nodes, `gone` maps a destroyed node id to the day it was destroyed.
 */
export interface GatherState {
  readonly hp: Readonly<Record<number, number>>;
  readonly gone: Readonly<Record<number, number>>;
}

export interface DropResult {
  item: ItemId;
  amount: number;
}

export interface HitResult {
  state: GatherState;
  drops: DropResult[];
  destroyed: boolean;
}

export const emptyGather = (): GatherState => ({ hp: {}, gone: {} });

export const isAlive = (s: GatherState, id: number): boolean => !(id in s.gone);

export function hitNode(state: GatherState, node: ResourceNode, damage: number, day: number, rng: Rng): HitResult {
  if (!isAlive(state, node.id) || damage <= 0) return { state, drops: [], destroyed: false };
  const def = RESOURCES[node.kind];
  const left = (state.hp[node.id] ?? def.hp) - damage;
  if (left > 0) return { state: { hp: { ...state.hp, [node.id]: left }, gone: state.gone }, drops: [], destroyed: false };
  const { [node.id]: _removed, ...hp } = state.hp;
  const drops = def.drops
    .filter((d) => d.chance === undefined || rng.chance(d.chance))
    .map((d) => ({ item: d.item, amount: rng.int(d.min, d.max) }))
    .filter((d) => d.amount > 0);
  return { state: { hp, gone: { ...state.gone, [node.id]: day } }, drops, destroyed: true };
}

/**
 * Keep only entries whose id is a node of the current island. A hand-edited save, or a later change to the generator
 * (node ids are positions in the scatter order), can leave ids that point at no node.
 */
export function sanitizeGather(state: GatherState, nodeCount: number): GatherState {
  const keep = (rec: Readonly<Record<number, number>>): Record<number, number> => {
    const out: Record<number, number> = {};
    for (const [key, value] of Object.entries(rec)) {
      const id = Number(key);
      if (Number.isInteger(id) && id >= 0 && id < nodeCount) out[id] = value;
    }
    return out;
  };
  return { hp: keep(state.hp), gone: keep(state.gone) };
}

/**
 * Call when a new in-game day starts: damaged nodes heal and nodes destroyed RESPAWN_DAYS ago grow back.
 * `keepGone(id)` lets the caller postpone a regrowth (for example while the player stands on that tile).
 */
export function startNewDay(state: GatherState, day: number, keepGone: (id: number) => boolean = () => false): GatherState {
  const gone: Record<number, number> = {};
  for (const [key, since] of Object.entries(state.gone)) {
    const id = Number(key);
    if (day - since < RESPAWN_DAYS || keepGone(id)) gone[id] = since;
  }
  return { hp: {}, gone };
}
```

All new UI text in both languages (items, tools, stations, messages, inventory, death):

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
  waterLeft: { en: 'Water {n}', id: 'Air {n}' },
};
```

- [ ] **Step 5: Run the tests, the typecheck and the whole suite**

Run: `npx vitest run tests/items.test.ts tests/gather.test.ts tests/i18n.test.ts && npm run typecheck && npm test`
Expected: items 8, gather 12, i18n 7 tests PASS; typecheck exits 0; the whole suite passes. (The phase 1 HUD still compiles; its button label `hitAction` is gone from the strings and shows its key until Task 11 replaces the HUD. That is expected and only visible if you run the browser before Task 11.)

- [ ] **Step 6: Commit**

```bash
git add src/data tests/items.test.ts tests/gather.test.ts tests/i18n.test.ts src/sim/gather.ts
git commit -m "feat: add item, crop and structure catalog with chance-based node drops"
```

---

### Task 2: Inventory

**Files:**
- Create: `src/sim/inventory.ts`
- Test: `tests/inventory.test.ts`

**Interfaces:**
- Consumes: `ITEMS`, `ItemId` (Task 1).
- Produces: `INVENTORY_SIZE = 32`, `HOTBAR_SIZE = 8`, `Slot {item, qty, dur?}`, `Inventory` (read-only array of `Slot | null`), `Cost` (`[ItemId, number][]`), `emptyInventory(size?)`, `newSlot(item, qty)`, `countItem`, `addItem(inv, item, qty) -> {inv, left}`, `removeItem -> Inventory | null`, `canAfford`, `spend -> Inventory | null`, `moveSlot(inv, from, to)`, `wearTool(inv, index)`, `setDurability(inv, index, dur)`, `takeOne(inv, index)`, `loseHalfOfHotbar(inv, roll)`.

- [ ] **Step 1: Write the failing test**

`tests/inventory.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
  HOTBAR_SIZE, INVENTORY_SIZE, addItem, canAfford, countItem, emptyInventory, loseHalfOfHotbar, moveSlot, newSlot,
  removeItem, setDurability, spend, takeOne, wearTool, type Inventory,
} from '@/sim/inventory';

const empty = emptyInventory();

describe('addItem', () => {
  it('fills the first free slots and keeps the input untouched', () => {
    const { inv, left } = addItem(empty, 'wood', 5);
    expect(left).toBe(0);
    expect(inv[0]).toEqual({ item: 'wood', qty: 5 });
    expect(empty.every((s) => s === null)).toBe(true);
  });

  it('tops up existing stacks before opening new ones', () => {
    const a = addItem(empty, 'wood', 90).inv;
    const b = addItem(a, 'wood', 20).inv;
    expect(b[0]).toEqual({ item: 'wood', qty: 99 });
    expect(b[1]).toEqual({ item: 'wood', qty: 11 });
  });

  it('reports what did not fit when the backpack is full', () => {
    const full = emptyInventory(2);
    const { inv, left } = addItem(full, 'wood', 250);
    expect(inv).toEqual([{ item: 'wood', qty: 99 }, { item: 'wood', qty: 99 }]);
    expect(left).toBe(52);
  });

  it('never stacks tools and gives them full durability (a watering can starts empty)', () => {
    const { inv } = addItem(empty, 'axe_wood', 2);
    expect(inv[0]).toEqual({ item: 'axe_wood', qty: 1, dur: 40 });
    expect(inv[1]).toEqual({ item: 'axe_wood', qty: 1, dur: 40 });
    expect(newSlot('watering_can', 1).dur).toBe(0);
  });

  it('ignores zero, negative and fractional quantities safely', () => {
    expect(addItem(empty, 'wood', 0).inv).toEqual(empty);
    expect(addItem(empty, 'wood', -4).inv).toEqual(empty);
    expect(addItem(empty, 'wood', 2.9).inv[0]).toEqual({ item: 'wood', qty: 2 });
  });
});

describe('removeItem / spend / canAfford', () => {
  const inv = addItem(addItem(empty, 'wood', 10).inv, 'stone', 4).inv;

  it('removes from the back of the backpack first', () => {
    const two = addItem(addItem(emptyInventory(3), 'wood', 99).inv, 'wood', 5).inv;
    const out = removeItem(two, 'wood', 7)!;
    expect(out[0]).toEqual({ item: 'wood', qty: 97 });
    expect(out[1]).toBeNull();
  });

  it('returns null instead of going negative', () => {
    expect(removeItem(inv, 'wood', 11)).toBeNull();
    expect(removeItem(inv, 'plank', 1)).toBeNull();
    expect(countItem(inv, 'wood')).toBe(10);
  });

  it('pays a whole cost atomically', () => {
    const paid = spend(inv, [['wood', 6], ['stone', 4]])!;
    expect(countItem(paid, 'wood')).toBe(4);
    expect(countItem(paid, 'stone')).toBe(0);
    expect(spend(inv, [['wood', 6], ['stone', 5]])).toBeNull();
    expect(canAfford(inv, [['wood', 10]])).toBe(true);
    expect(canAfford(inv, [['wood', 11]])).toBe(false);
  });
});

describe('moveSlot', () => {
  it('swaps different items and moves into empty slots', () => {
    const inv = addItem(addItem(empty, 'wood', 3).inv, 'stone', 2).inv;
    const swapped = moveSlot(inv, 0, 1);
    expect(swapped[0]).toEqual({ item: 'stone', qty: 2 });
    expect(swapped[1]).toEqual({ item: 'wood', qty: 3 });
    const moved = moveSlot(inv, 0, 5);
    expect(moved[0]).toBeNull();
    expect(moved[5]).toEqual({ item: 'wood', qty: 3 });
  });

  it('merges stacks of the same item up to the limit', () => {
    const inv: Inventory = [{ item: 'wood', qty: 90 }, { item: 'wood', qty: 20 }, null, null];
    const merged = moveSlot(inv, 1, 0);
    expect(merged[0]?.qty).toBe(99);
    expect(merged[1]?.qty).toBe(11);
    const other = moveSlot(inv, 0, 1);
    expect(other[1]?.qty).toBe(99);
    expect(other[0]?.qty).toBe(11);
  });

  it('ignores invalid moves', () => {
    const inv = addItem(empty, 'wood', 1).inv;
    expect(moveSlot(inv, 0, 0)).toBe(inv);
    expect(moveSlot(inv, 0, 99)).toBe(inv);
    expect(moveSlot(inv, -1, 2)).toBe(inv);
    expect(moveSlot(inv, 3, 4)).toBe(inv);
  });
});

describe('tools', () => {
  it('wears a tool down and breaks it at zero', () => {
    let inv = addItem(empty, 'axe_wood', 1).inv;
    inv = setDurability(inv, 0, 2);
    inv = wearTool(inv, 0);
    expect(inv[0]?.dur).toBe(1);
    inv = wearTool(inv, 0);
    expect(inv[0]).toBeNull();
  });

  it('lets a watering can run dry without breaking and caps refills at capacity', () => {
    let inv = addItem(empty, 'watering_can', 1).inv;
    inv = setDurability(inv, 0, 1);
    inv = wearTool(inv, 0);
    expect(inv[0]).toEqual({ item: 'watering_can', qty: 1, dur: 0 });
    expect(setDurability(inv, 0, 9999)[0]?.dur).toBe(40);
    expect(setDurability(inv, 0, -5)[0]?.dur).toBe(0);
  });

  it('does nothing for slots without a tool', () => {
    const inv = addItem(empty, 'wood', 1).inv;
    expect(wearTool(inv, 0)).toBe(inv);
    expect(wearTool(inv, 3)).toBe(inv);
    expect(setDurability(inv, 0, 5)).toBe(inv);
  });
});

describe('takeOne', () => {
  it('removes one item and empties the slot at the last one', () => {
    const inv = addItem(empty, 'carrot', 2).inv;
    const once = takeOne(inv, 0);
    expect(once[0]?.qty).toBe(1);
    expect(takeOne(once, 0)[0]).toBeNull();
    expect(takeOne(inv, 9)).toBe(inv);
  });
});

describe('loseHalfOfHotbar', () => {
  it('halves stacks on the hotbar and leaves the rest of the backpack alone', () => {
    let inv = addItem(empty, 'wood', 10).inv;
    inv = moveSlot(inv, 0, 20);
    inv = addItem(inv, 'stone', 5).inv;
    inv = addItem(inv, 'carrot', 1).inv;
    const out = loseHalfOfHotbar(inv, () => 0.9);
    expect(out[20]).toEqual({ item: 'wood', qty: 10 });
    expect(out[0]).toEqual({ item: 'stone', qty: 2 });
    expect(out[1]).toBeNull();
  });

  it('breaks or keeps a tool depending on the roll', () => {
    const inv = addItem(empty, 'axe_wood', 1).inv;
    expect(loseHalfOfHotbar(inv, () => 0.2)[0]).toBeNull();
    expect(loseHalfOfHotbar(inv, () => 0.8)[0]?.item).toBe('axe_wood');
  });

  it('has the sizes the spec calls for', () => {
    expect(INVENTORY_SIZE).toBe(32);
    expect(HOTBAR_SIZE).toBe(8);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/inventory.test.ts`
Expected: FAIL, "Failed to resolve import "@/sim/inventory"".

- [ ] **Step 3: Write the inventory module**

`src/sim/inventory.ts`:

```typescript
import { ITEMS, type ItemId } from '@/data/items';

/** Backpack size; the first HOTBAR_SIZE slots are the hotbar. */
export const INVENTORY_SIZE = 32;
export const HOTBAR_SIZE = 8;

export interface Slot {
  readonly item: ItemId;
  readonly qty: number;
  /** Remaining uses of a tool (or water in a watering can). */
  readonly dur?: number;
}

export type Inventory = readonly (Slot | null)[];

export type Cost = readonly (readonly [ItemId, number])[];

export const emptyInventory = (size = INVENTORY_SIZE): Inventory => Array.from({ length: size }, () => null);

/** A fresh slot: tools start with full durability, a watering can starts empty. */
export function newSlot(item: ItemId, qty: number): Slot {
  const tool = ITEMS[item].tool;
  if (!tool) return { item, qty };
  return { item, qty, dur: tool.type === 'can' ? 0 : tool.durability };
}

export function countItem(inv: Inventory, item: ItemId): number {
  let n = 0;
  for (const s of inv) if (s && s.item === item) n += s.qty;
  return n;
}

const stackable = (item: ItemId): boolean => ITEMS[item].stack > 1;

/** Put `qty` of `item` into the inventory: top up existing stacks first, then empty slots from the left. */
export function addItem(inv: Inventory, item: ItemId, qty: number): { inv: Inventory; left: number } {
  const max = ITEMS[item].stack;
  const out = inv.slice();
  let left = Math.max(0, Math.floor(qty));
  if (stackable(item)) {
    for (let i = 0; i < out.length && left > 0; i++) {
      const s = out[i];
      if (!s || s.item !== item || s.qty >= max) continue;
      const take = Math.min(left, max - s.qty);
      out[i] = { ...s, qty: s.qty + take };
      left -= take;
    }
  }
  for (let i = 0; i < out.length && left > 0; i++) {
    if (out[i]) continue;
    const take = Math.min(left, max);
    out[i] = newSlot(item, take);
    left -= take;
  }
  return { inv: out, left };
}

/** Remove `qty` of `item`, taking from the back of the backpack first. Null when there is not enough. */
export function removeItem(inv: Inventory, item: ItemId, qty: number): Inventory | null {
  if (countItem(inv, item) < qty) return null;
  const out = inv.slice();
  let need = qty;
  for (let i = out.length - 1; i >= 0 && need > 0; i--) {
    const s = out[i];
    if (!s || s.item !== item) continue;
    const take = Math.min(need, s.qty);
    out[i] = take === s.qty ? null : { ...s, qty: s.qty - take };
    need -= take;
  }
  return out;
}

export function canAfford(inv: Inventory, cost: Cost): boolean {
  return cost.every(([item, n]) => countItem(inv, item) >= n);
}

/** Pay a cost, or null when any ingredient is missing. */
export function spend(inv: Inventory, cost: Cost): Inventory | null {
  let cur: Inventory | null = inv;
  for (const [item, n] of cost) {
    cur = cur && removeItem(cur, item, n);
    if (!cur) return null;
  }
  return cur;
}

/** Drag a slot onto another: stacks of the same item merge, anything else swaps. */
export function moveSlot(inv: Inventory, from: number, to: number): Inventory {
  if (from === to || from < 0 || to < 0 || from >= inv.length || to >= inv.length) return inv;
  const a = inv[from];
  const b = inv[to];
  if (!a) return inv;
  const out = inv.slice();
  if (b && b.item === a.item && stackable(a.item)) {
    const max = ITEMS[a.item].stack;
    const moved = Math.min(a.qty, max - b.qty);
    out[to] = { ...b, qty: b.qty + moved };
    out[from] = moved === a.qty ? null : { ...a, qty: a.qty - moved };
    return out;
  }
  out[from] = b;
  out[to] = a;
  return out;
}

/** Use up one point of durability of the tool in `index`. Tools break at 0; a watering can just runs dry. */
export function wearTool(inv: Inventory, index: number): Inventory {
  const s = inv[index];
  if (!s || s.dur === undefined) return inv;
  const out = inv.slice();
  const dur = s.dur - 1;
  out[index] = dur <= 0 && ITEMS[s.item].tool?.type !== 'can' ? null : { ...s, dur: Math.max(0, dur) };
  return out;
}

/** Set the durability (water) of a slot, clamped to the tool's maximum. */
export function setDurability(inv: Inventory, index: number, dur: number): Inventory {
  const s = inv[index];
  const tool = s && ITEMS[s.item].tool;
  if (!s || !tool) return inv;
  const out = inv.slice();
  out[index] = { ...s, dur: Math.min(tool.durability, Math.max(0, dur)) };
  return out;
}

/** Remove one item from a slot (eating, planting, placing). */
export function takeOne(inv: Inventory, index: number): Inventory {
  const s = inv[index];
  if (!s) return inv;
  const out = inv.slice();
  out[index] = s.qty <= 1 ? null : { ...s, qty: s.qty - 1 };
  return out;
}

/** Keep a random half of every hotbar stack (rounding the loss up), as a death penalty. */
export function loseHalfOfHotbar(inv: Inventory, roll: () => number): Inventory {
  const out = inv.slice();
  for (let i = 0; i < Math.min(HOTBAR_SIZE, out.length); i++) {
    const s = out[i];
    if (!s) continue;
    if (!stackable(s.item)) {
      if (roll() < 0.5) out[i] = null;
      continue;
    }
    const lost = Math.ceil(s.qty / 2);
    out[i] = lost >= s.qty ? null : { ...s, qty: s.qty - lost };
  }
  return out;
}
```

- [ ] **Step 4: Run the test and the typecheck**

Run: `npx vitest run tests/inventory.test.ts && npm run typecheck`
Expected: 18 tests PASS; typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/sim/inventory.ts tests/inventory.test.ts
git commit -m "feat: add stackable inventory with hotbar, tool wear and death penalty helper"
```

---

### Task 3: Vitals, death and sleeping

**Files:**
- Create: `src/sim/vitals.ts`, `src/sim/death.ts`
- Replace: `src/sim/daynight.ts`
- Test: `tests/vitals.test.ts`, `tests/death.test.ts` (new), `tests/daynight.test.ts` (replaced)

**Interfaces:**
- Consumes: `Biome`, `B` (plan 1 world types), `loseHalfOfHotbar`, `Inventory` (Task 2).
- Produces: `Difficulty`, `VITAL_MAX = 100`, `Vitals {hp, hunger, thirst, stamina}`, `fullVitals()`, `tickVitals(v, dt, {difficulty, biome, busy})`, `eat(v, food)`, `wouldWaste(v, food)`, `spendStamina(v, cost) -> Vitals | null`, `isDead`, `sleepRecovery`; `RESPAWN_VITALS`, `applyDeath(difficulty, inv, roll) -> {inv, vitals, wipeSave}`; `canSleep(clock)`, `wakeUp(clock)`.

- [ ] **Step 1: Write the failing tests**

`tests/vitals.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
  DESERT_THIRST, HUNGER_RATE, STARVE_DAMAGE, THIRST_RATE, VITAL_MAX, eat, fullVitals, isDead, sleepRecovery, spendStamina,
  tickVitals, wouldWaste, type VitalsContext, type Vitals,
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

`tests/death.test.ts`:

```typescript
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

  it('ends the adventure on Hardcore', () => {
    expect(applyDeath('hardcore', inv, () => 0.9).wipeSave).toBe(true);
  });

  it('wakes the hero up alive but needy so they do not collapse again at once', () => {
    expect(RESPAWN_VITALS.hp).toBeGreaterThan(0);
    expect(RESPAWN_VITALS.hunger).toBeLessThan(100);
    expect(RESPAWN_VITALS.thirst).toBeLessThan(100);
  });
});
```

Replace `tests/daynight.test.ts` (adds the sleeping rules):

`tests/daynight.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { DAY_SECONDS, NIGHT_DARKNESS, advance, canSleep, clockLabel, darkness, lighting, newClock, phaseOf, wakeUp, type Clock } from '@/sim/daynight';

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

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/vitals.test.ts tests/death.test.ts tests/daynight.test.ts`
Expected: FAIL. `vitals.test.ts` and `death.test.ts` cannot resolve their modules; the new daynight test fails with `canSleep is not a function`.

- [ ] **Step 3: Write the modules**

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
  else if (hunger >= REGEN_THRESHOLD && thirst >= REGEN_THRESHOLD) hp += REGEN_RATE * dt;
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

`src/sim/death.ts`:

```typescript
import { loseHalfOfHotbar, type Inventory } from '@/sim/inventory';
import type { Difficulty, Vitals } from '@/sim/vitals';

/** How the hero wakes up after collapsing: hurt, hungry and thirsty, but alive. */
export const RESPAWN_VITALS: Vitals = { hp: 60, hunger: 60, thirst: 60, stamina: 100 };

export interface DeathResult {
  inv: Inventory;
  vitals: Vitals;
  /** Hardcore: the adventure is over and the save must be deleted. */
  wipeSave: boolean;
}

/** Relaxed keeps everything, Normal loses half of the hotbar, Hardcore ends the game. */
export function applyDeath(difficulty: Difficulty, inv: Inventory, roll: () => number): DeathResult {
  if (difficulty === 'hardcore') return { inv, vitals: RESPAWN_VITALS, wipeSave: true };
  if (difficulty === 'normal') return { inv: loseHalfOfHotbar(inv, roll), vitals: RESPAWN_VITALS, wipeSave: false };
  return { inv, vitals: RESPAWN_VITALS, wipeSave: false };
}
```

Replace `src/sim/daynight.ts` (adds `canSleep` and `wakeUp`; everything else is unchanged):

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

/** The hero can only sleep once evening has come. */
export const canSleep = (c: Clock): boolean => phaseOf(c) === 'dusk' || phaseOf(c) === 'night';

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

- [ ] **Step 4: Run the tests and the typecheck**

Run: `npx vitest run tests/vitals.test.ts tests/death.test.ts tests/daynight.test.ts && npm run typecheck`
Expected: vitals 12, death 4, daynight 9 tests PASS; typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/sim/vitals.ts src/sim/death.ts src/sim/daynight.ts tests/vitals.test.ts tests/death.test.ts tests/daynight.test.ts
git commit -m "feat: add survival vitals, difficulty death rules and sleeping"
```

---

### Task 4: Recipes, tool rules and crafting

**Files:**
- Create: `src/data/recipes.ts`, `src/data/tools.ts`, `src/sim/crafting.ts`, `src/sim/tools.ts`
- Test: `tests/crafting.test.ts`

**Interfaces:**
- Consumes: `ITEMS`, `Station` (Task 1), `Inventory`, `Cost`, `spend`, `addItem`, `canAfford`, `countItem` (Task 2).
- Produces: `Recipe {id, out, qty, cost, station}`, `RECIPES` (21); `hasStation`, `availableRecipes(near)`, `canCraft(inv, recipe, near)`, `missingFor(inv, recipe)`, `craft(inv, recipe, near) -> Inventory | null` (all-or-nothing, also when the product would not fit); `HAND_DAMAGE = 0.34`, `TIER_DAMAGE`, `STAMINA_HAND`, `STAMINA_TOOL`, `NODE_NEED`; `checkHit(kind, held) -> {ok: true, damage, stamina, wear} | {ok: false, tool, tier}`.

- [ ] **Step 1: Write the failing test**

`tests/crafting.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { ITEMS } from '@/data/items';
import { RECIPES } from '@/data/recipes';
import type { Station } from '@/data/structures';
import { availableRecipes, canCraft, craft, hasStation, missingFor } from '@/sim/crafting';
import { addItem, countItem, emptyInventory } from '@/sim/inventory';
import { checkHit } from '@/sim/tools';
import { HAND_DAMAGE } from '@/data/tools';

const none: ReadonlySet<Station> = new Set();
const recipe = (id: string) => RECIPES.find((r) => r.id === id)!;
const withItems = (...pairs: [Parameters<typeof addItem>[1], number][]) =>
  pairs.reduce((inv, [item, n]) => addItem(inv, item, n).inv, emptyInventory());

describe('recipe data', () => {
  it('only uses known items and sensible amounts, with unique ids', () => {
    const ids = new Set<string>();
    for (const r of RECIPES) {
      expect(ids.has(r.id), r.id).toBe(false);
      ids.add(r.id);
      expect(ITEMS[r.out], r.id).toBeDefined();
      expect(r.qty).toBeGreaterThan(0);
      expect(r.cost.length).toBeGreaterThan(0);
      for (const [item, n] of r.cost) {
        expect(ITEMS[item], `${r.id} needs ${item}`).toBeDefined();
        expect(n).toBeGreaterThan(0);
      }
    }
  });

  it('lets a player with nothing but their hands reach every station', () => {
    const handMade = new Set(RECIPES.filter((r) => r.station === 'hand').map((r) => r.out));
    expect(handMade.has('workbench')).toBe(true);
    expect(handMade.has('campfire')).toBe(true);
    expect(handMade.has('axe_wood')).toBe(true);
    // The furnace comes from the workbench, and iron tools need the furnace: no circular dependency.
    expect(recipe('furnace').station).toBe('workbench');
    expect(recipe('iron_ingot').station).toBe('furnace');
  });
});

describe('crafting', () => {
  it('crafts by hand and keeps the input untouched', () => {
    const inv = withItems(['wood', 4]);
    const out = craft(inv, recipe('plank'), none)!;
    expect(countItem(out, 'wood')).toBe(2);
    expect(countItem(out, 'plank')).toBe(2);
    expect(countItem(inv, 'plank')).toBe(0);
  });

  it('needs the station for non-hand recipes', () => {
    const inv = withItems(['plank', 20], ['rope', 5], ['stone', 10]);
    expect(craft(inv, recipe('axe_stone'), none)).toBeNull();
    expect(canCraft(inv, recipe('axe_stone'), new Set<Station>(['workbench']))).toBe(true);
    expect(craft(inv, recipe('axe_stone'), new Set<Station>(['workbench']))).not.toBeNull();
    expect(hasStation('hand', none)).toBe(true);
  });

  it('refuses when an ingredient is missing and reports the shortfall', () => {
    const inv = withItems(['wood', 2], ['fiber', 1]);
    expect(craft(inv, recipe('axe_wood'), none)).toBeNull();
    expect(missingFor(inv, recipe('axe_wood'))).toEqual([['wood', 1], ['fiber', 1]]);
    expect(missingFor(withItems(['wood', 9], ['fiber', 9]), recipe('axe_wood'))).toEqual([]);
  });

  it('does not craft when the product would not fit, and loses nothing', () => {
    let inv = emptyInventory(2);
    inv = addItem(inv, 'axe_wood', 1).inv;
    inv = addItem(inv, 'wood', 2).inv;
    expect(craft(inv, recipe('axe_wood'), none)).toBeNull();
    expect(countItem(inv, 'wood')).toBe(2);
  });

  it('crafts the product even when it takes the freed slot', () => {
    let inv = emptyInventory(1);
    inv = addItem(inv, 'wood', 2).inv;
    const out = craft(inv, recipe('plank'), none)!;
    expect(countItem(out, 'plank')).toBe(2);
  });

  it('lists only recipes whose station is available', () => {
    const hand = availableRecipes(none);
    expect(hand.every((r) => r.station === 'hand')).toBe(true);
    const bench = availableRecipes(new Set<Station>(['workbench']));
    expect(bench.length).toBeGreaterThan(hand.length);
    expect(bench.some((r) => r.station === 'furnace')).toBe(false);
  });
});

describe('checkHit', () => {
  it('lets bare hands chop and mine slowly, but not break ore or crystal', () => {
    expect(checkHit('tree', null)).toEqual({ ok: true, damage: HAND_DAMAGE, stamina: 1, wear: false });
    expect(checkHit('rock', null)).toMatchObject({ ok: true, damage: HAND_DAMAGE });
    expect(checkHit('ore', null)).toEqual({ ok: false, tool: 'pickaxe', tier: 2 });
    expect(checkHit('crystal', null)).toEqual({ ok: false, tool: 'pickaxe', tier: 3 });
  });

  it('scales damage with tool tier and wears the tool', () => {
    expect(checkHit('tree', 'axe_wood')).toEqual({ ok: true, damage: 1, stamina: 2, wear: true });
    expect(checkHit('tree', 'axe_stone')).toMatchObject({ damage: 2 });
    expect(checkHit('tree', 'axe_iron')).toMatchObject({ damage: 3 });
  });

  it('unlocks ore with a stone pickaxe and crystal with an iron one', () => {
    expect(checkHit('ore', 'pickaxe_wood')).toMatchObject({ ok: false });
    expect(checkHit('ore', 'pickaxe_stone')).toMatchObject({ ok: true, damage: 2 });
    expect(checkHit('crystal', 'pickaxe_stone')).toMatchObject({ ok: false });
    expect(checkHit('crystal', 'pickaxe_iron')).toMatchObject({ ok: true, damage: 3 });
  });

  it('treats the wrong tool like bare hands and picks berries with anything', () => {
    expect(checkHit('tree', 'pickaxe_iron')).toMatchObject({ ok: true, damage: HAND_DAMAGE, wear: false });
    expect(checkHit('ore', 'axe_iron')).toMatchObject({ ok: false });
    expect(checkHit('bush', null)).toMatchObject({ ok: true, damage: 1, wear: false });
    expect(checkHit('bush', 'axe_iron')).toMatchObject({ ok: true, damage: 1, wear: false });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/crafting.test.ts`
Expected: FAIL, "Failed to resolve import "@/data/recipes"" (or `@/sim/crafting`).

- [ ] **Step 3: Write the data and rules**

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
  // Furnace
  r('iron_ingot', 1, [['iron_ore', 2], ['wood', 1]], 'furnace'),
  // Campfire
  r('roasted_carrot', 1, [['carrot', 1]], 'campfire'),
  r('roasted_corn', 1, [['corn', 1]], 'campfire'),
  r('baked_pumpkin', 1, [['pumpkin', 1]], 'campfire'),
];
```

`src/data/tools.ts`:

```typescript
import type { ToolType } from './items';
import type { ResourceKind } from '@/sim/world/types';

/** Damage per hit with bare hands; real tools do 1, 2 and 3 for tiers 1 to 3. */
export const HAND_DAMAGE = 0.34;
export const TIER_DAMAGE: readonly number[] = [HAND_DAMAGE, 1, 2, 3];

/** Stamina spent per swing, by hand and with a tool. */
export const STAMINA_HAND = 1;
export const STAMINA_TOOL = 2;

export interface NodeNeed {
  /** The tool that works best; null means any hand will do. */
  tool: Extract<ToolType, 'axe' | 'pickaxe'> | null;
  /** Minimum tool tier that can damage the node at all (0 means bare hands can, just slowly). */
  minTier: 0 | 1 | 2 | 3;
}

export const NODE_NEED: Record<ResourceKind, NodeNeed> = {
  tree: { tool: 'axe', minTier: 0 },
  palm: { tool: 'axe', minTier: 0 },
  swamptree: { tool: 'axe', minTier: 0 },
  bush: { tool: null, minTier: 0 },
  rock: { tool: 'pickaxe', minTier: 0 },
  redrock: { tool: 'pickaxe', minTier: 0 },
  ore: { tool: 'pickaxe', minTier: 2 },
  crystal: { tool: 'pickaxe', minTier: 3 },
};
```

`src/sim/crafting.ts`:

```typescript
import { RECIPES, type Recipe } from '@/data/recipes';
import type { Station } from '@/data/structures';
import { addItem, canAfford, countItem, spend, type Cost, type Inventory } from '@/sim/inventory';

/** Can the hero use this station right now? Crafting by hand is always possible. */
export const hasStation = (station: Station, near: ReadonlySet<Station>): boolean => station === 'hand' || near.has(station);

/** Recipes the hero can attempt here: those whose station is at hand or nearby. */
export function availableRecipes(near: ReadonlySet<Station>): Recipe[] {
  return RECIPES.filter((r) => hasStation(r.station, near));
}

export function canCraft(inv: Inventory, recipe: Recipe, near: ReadonlySet<Station>): boolean {
  return hasStation(recipe.station, near) && canAfford(inv, recipe.cost);
}

/** What is still missing, as (item, amount) pairs; empty when the recipe is affordable. */
export function missingFor(inv: Inventory, recipe: Recipe): Cost {
  return recipe.cost.flatMap(([item, n]) => {
    const short = n - countItem(inv, item);
    return short > 0 ? ([[item, short]] as const) : [];
  });
}

/** Craft once. Null when a station or ingredient is missing, or the product would not fit in the backpack. */
export function craft(inv: Inventory, recipe: Recipe, near: ReadonlySet<Station>): Inventory | null {
  if (!hasStation(recipe.station, near)) return null;
  const paid = spend(inv, recipe.cost);
  if (!paid) return null;
  const { inv: out, left } = addItem(paid, recipe.out, recipe.qty);
  return left > 0 ? null : out;
}
```

`src/sim/tools.ts`:

```typescript
import { ITEMS, type ItemId, type ToolType } from '@/data/items';
import { NODE_NEED, STAMINA_HAND, STAMINA_TOOL, TIER_DAMAGE } from '@/data/tools';
import type { ResourceKind } from '@/sim/world/types';

export type HitCheck =
  | { ok: true; damage: number; stamina: number; /** The held tool takes wear. */ wear: boolean }
  | { ok: false; tool: ToolType; tier: number };

/** What happens when the hero swings `held` (null for bare hands) at a node of this kind. */
export function checkHit(kind: ResourceKind, held: ItemId | null): HitCheck {
  const need = NODE_NEED[kind];
  const tool = held ? ITEMS[held].tool : undefined;
  const matching = tool && need.tool !== null && tool.type === need.tool ? tool.tier : 0;
  if (need.tool === null) return { ok: true, damage: 1, stamina: STAMINA_HAND, wear: false };
  if (matching < need.minTier) return { ok: false, tool: need.tool, tier: need.minTier };
  return {
    ok: true,
    damage: TIER_DAMAGE[matching],
    stamina: matching > 0 ? STAMINA_TOOL : STAMINA_HAND,
    wear: matching > 0,
  };
}
```

- [ ] **Step 4: Run the test and the typecheck**

Run: `npx vitest run tests/crafting.test.ts && npm run typecheck`
Expected: 12 tests PASS; typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/data/recipes.ts src/data/tools.ts src/sim/crafting.ts src/sim/tools.ts tests/crafting.test.ts
git commit -m "feat: add recipes, tool tiers and all-or-nothing crafting"
```

---

### Task 5: Structures and farming

**Files:**
- Create: `src/sim/structures.ts`, `src/sim/farm.ts`
- Test: `tests/structures.test.ts`, `tests/farm.test.ts`

**Interfaces:**
- Consumes: `STRUCTURES`, `CHEST_SLOTS`, `Station`, `StructureId`, `CROPS`, `SEED_RETURN_CHANCE`, `ITEMS` (Task 1), `Inventory`, `emptyInventory` (Task 2), `Vec` (plan 1), `Rng`.
- Produces: `Structure {id, type, x, y, inv?}`, `Structures {next, list}`, `emptyStructures`, `canPlace(world, structures, occupied, x, y, hero) -> {ok} | {ok: false, reason}`, `placeStructure` (a chest starts with an empty 20-slot storage), `removeStructure`, `structureAt`, `setStructureInventory`, `nearbyStations(structures, pos)`, `structureSolids(structures, size)`, `PLACE_REACH = 4`, `STATION_REACH = 3`; `Plot`, `Farm {plots}`, `emptyFarm`, `canTill`, `till`, `plotAt`, `plant`, `water`, `isRipe`, `stageOf`, `advanceDay`, `harvest(farm, tile, rng) -> {farm, items} | null`.

- [ ] **Step 1: Write the failing tests**

`tests/structures.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { STRUCTURES } from '@/data/structures';
import { addItem, emptyInventory } from '@/sim/inventory';
import {
  PLACE_REACH, canPlace, emptyStructures, nearbyStations, placeStructure, removeStructure, setStructureInventory,
  structureAt, structureSolids,
} from '@/sim/structures';
import { T, WORLD_SIZE, idx, type World } from '@/sim/world/types';

function makeWorld(): World {
  const size = WORLD_SIZE;
  const terrain = new Uint8Array(size * size).fill(T.GRASS);
  terrain[idx(12, 10)] = T.RIVER;
  terrain[idx(13, 10)] = T.SHALLOW;
  terrain[idx(14, 10)] = T.DEEP;
  return { seed: 0, size, terrain, biome: new Uint8Array(size * size), landmarks: [], resources: [], start: { x: 10, y: 10 } };
}

const world = makeWorld();
const hero = { x: 10.5, y: 10.5 };
const noSolids: ReadonlySet<number> = new Set();

describe('canPlace', () => {
  it('allows an empty land tile within reach', () => {
    expect(canPlace(world, emptyStructures(), noSolids, 11, 10, hero)).toEqual({ ok: true });
  });

  it('refuses water of every kind, the map edge and the hero tile', () => {
    expect(canPlace(world, emptyStructures(), noSolids, 12, 10, hero)).toEqual({ ok: false, reason: 'water' });
    expect(canPlace(world, emptyStructures(), noSolids, 13, 10, hero)).toEqual({ ok: false, reason: 'water' });
    expect(canPlace(world, emptyStructures(), noSolids, 14, 10, hero)).toEqual({ ok: false, reason: 'water' });
    expect(canPlace(world, emptyStructures(), noSolids, -1, 5, hero)).toEqual({ ok: false, reason: 'bounds' });
    expect(canPlace(world, emptyStructures(), noSolids, 10, 10, hero)).toEqual({ ok: false, reason: 'hero' });
  });

  it('refuses tiles that are occupied by a solid thing or another structure', () => {
    expect(canPlace(world, emptyStructures(), new Set([idx(11, 10)]), 11, 10, hero)).toEqual({ ok: false, reason: 'occupied' });
    const built = placeStructure(emptyStructures(), 'chest', 11, 10);
    expect(canPlace(world, built, noSolids, 11, 10, hero)).toEqual({ ok: false, reason: 'occupied' });
  });

  it('refuses tiles that are too far away', () => {
    expect(canPlace(world, emptyStructures(), noSolids, 10 + PLACE_REACH + 1, 10, hero)).toEqual({ ok: false, reason: 'far' });
  });
});

describe('structures', () => {
  it('places and removes immutably with unique ids', () => {
    const a = placeStructure(emptyStructures(), 'campfire', 3, 4);
    const b = placeStructure(a, 'bed', 5, 6);
    expect(a.list).toHaveLength(1);
    expect(b.list.map((s) => s.id)).toEqual([1, 2]);
    const c = removeStructure(b, 1);
    expect(c.list.map((s) => s.type)).toEqual(['bed']);
    const d = placeStructure(c, 'fence', 7, 8);
    expect(d.list.map((s) => s.id)).toEqual([2, 3]);
    expect(structureAt(d, 7, 8)?.type).toBe('fence');
    expect(structureAt(d, 0, 0)).toBeUndefined();
  });

  it('gives a freshly placed chest an empty storage and other structures none', () => {
    const s = placeStructure(placeStructure(emptyStructures(), 'chest', 1, 1), 'bed', 2, 2);
    expect(s.list[0].inv).toHaveLength(20);
    expect(s.list[0].inv!.every((slot) => slot === null)).toBe(true);
    expect(s.list[1].inv).toBeUndefined();
  });

  it('stores chest contents without touching other structures', () => {
    const s = placeStructure(placeStructure(emptyStructures(), 'chest', 1, 1), 'chest', 2, 2);
    const inv = addItem(emptyInventory(20), 'wood', 5).inv;
    const out = setStructureInventory(s, 1, inv);
    expect(out.list[0].inv).toBe(inv);
    expect(out.list[1].inv).toBe(s.list[1].inv);
    expect(s.list[0].inv).not.toBe(inv);
  });

  it('reports crafting stations only when they are close', () => {
    let s = placeStructure(emptyStructures(), 'workbench', 11, 10);
    s = placeStructure(s, 'furnace', 40, 40);
    s = placeStructure(s, 'bed', 10, 11);
    const near = nearbyStations(s, hero);
    expect([...near]).toEqual(['workbench']);
    expect(nearbyStations(s, { x: 40.5, y: 40.5 }).has('furnace')).toBe(true);
  });

  it('blocks walking for everything except torches', () => {
    let s = placeStructure(emptyStructures(), 'torch', 1, 1);
    s = placeStructure(s, 'fence', 2, 2);
    expect(structureSolids(s, WORLD_SIZE)).toEqual([idx(2, 2)]);
    expect(STRUCTURES.torch.solid).toBe(false);
  });
});
```

`tests/farm.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/rng';
import { CROPS } from '@/data/crops';
import { ITEMS } from '@/data/items';
import { advanceDay, canTill, emptyFarm, harvest, isRipe, plant, plotAt, stageOf, till, water } from '@/sim/farm';
import { T, WORLD_SIZE, idx, type World } from '@/sim/world/types';

function makeWorld(): World {
  const size = WORLD_SIZE;
  const terrain = new Uint8Array(size * size).fill(T.GRASS);
  terrain[idx(3, 3)] = T.SAND;
  terrain[idx(4, 3)] = T.DIRT;
  terrain[idx(5, 3)] = T.RIVER;
  return { seed: 0, size, terrain, biome: new Uint8Array(size * size), landmarks: [], resources: [], start: { x: 1, y: 1 } };
}

const world = makeWorld();
const tile = idx(2, 2);
const none: ReadonlySet<number> = new Set();

describe('crop data', () => {
  it('refers to real items, with a ripe stage inside the sprite strip', () => {
    for (const c of Object.values(CROPS)) {
      expect(ITEMS[c.seed].seed).toBe(c.id);
      expect(ITEMS[c.produce].food).toBeDefined();
      expect(c.growDays).toBeGreaterThan(0);
      expect(c.ripeStage).toBeGreaterThan(0);
      expect(c.yield[1]).toBeGreaterThanOrEqual(c.yield[0]);
    }
  });
});

describe('tilling', () => {
  it('allows grass and dirt only', () => {
    expect(canTill(world, emptyFarm(), none, 2, 2)).toBe(true);
    expect(canTill(world, emptyFarm(), none, 4, 3)).toBe(true);
    expect(canTill(world, emptyFarm(), none, 3, 3)).toBe(false);
    expect(canTill(world, emptyFarm(), none, 5, 3)).toBe(false);
    expect(canTill(world, emptyFarm(), none, -1, 0)).toBe(false);
  });

  it('refuses occupied or already tilled tiles', () => {
    expect(canTill(world, emptyFarm(), new Set([tile]), 2, 2)).toBe(false);
    expect(canTill(world, till(emptyFarm(), tile), none, 2, 2)).toBe(false);
  });

  it('tills without mutating and tolerates tilling twice', () => {
    const farm = emptyFarm();
    const once = till(farm, tile);
    expect(farm.plots).toEqual({});
    expect(plotAt(once, tile)).toEqual({ crop: null, growth: 0, watered: false });
    expect(till(once, tile)).toBe(once);
  });
});

describe('planting and growing', () => {
  it('plants only on empty tilled soil', () => {
    expect(plant(emptyFarm(), tile, 'carrot')).toBeNull();
    const soil = till(emptyFarm(), tile);
    const planted = plant(soil, tile, 'carrot')!;
    expect(plotAt(planted, tile)?.crop).toBe('carrot');
    expect(plant(planted, tile, 'corn')).toBeNull();
  });

  it('grows only on watered days and never past ripeness', () => {
    let farm = plant(till(emptyFarm(), tile), tile, 'carrot')!;
    farm = advanceDay(farm);
    expect(plotAt(farm, tile)?.growth).toBe(0);
    for (let day = 0; day < 10; day++) farm = advanceDay(water(farm, tile));
    expect(plotAt(farm, tile)?.growth).toBe(CROPS.carrot.growDays);
    expect(isRipe(plotAt(farm, tile))).toBe(true);
  });

  it('dries the soil every morning', () => {
    let farm = water(till(emptyFarm(), tile), tile);
    expect(plotAt(farm, tile)?.watered).toBe(true);
    farm = advanceDay(farm);
    expect(plotAt(farm, tile)?.watered).toBe(false);
    expect(water(farm, idx(9, 9))).toBe(farm);
  });

  it('shows growing sprite stages up to the ripe one', () => {
    let farm = plant(till(emptyFarm(), tile), tile, 'pumpkin')!;
    const stages: number[] = [stageOf(plotAt(farm, tile)!)];
    for (let d = 0; d < CROPS.pumpkin.growDays; d++) {
      farm = advanceDay(water(farm, tile));
      stages.push(stageOf(plotAt(farm, tile)!));
    }
    expect(stages[0]).toBe(0);
    expect(stages[stages.length - 1]).toBe(CROPS.pumpkin.ripeStage);
    expect([...stages].sort((a, b) => a - b)).toEqual(stages);
  });
});

describe('harvest', () => {
  const ripe = () => {
    let farm = plant(till(emptyFarm(), tile), tile, 'corn')!;
    for (let d = 0; d < CROPS.corn.growDays; d++) farm = advanceDay(water(farm, tile));
    return farm;
  };

  it('gives produce within the yield range and leaves bare tilled soil', () => {
    const result = harvest(ripe(), tile, new Rng(1))!;
    const produce = result.items.find((i) => i.item === 'corn')!;
    expect(produce.qty).toBeGreaterThanOrEqual(CROPS.corn.yield[0]);
    expect(produce.qty).toBeLessThanOrEqual(CROPS.corn.yield[1]);
    expect(plotAt(result.farm, tile)).toEqual({ crop: null, growth: 0, watered: false });
  });

  it('sometimes returns a seed', () => {
    const seen = new Set<boolean>();
    for (let s = 0; s < 40; s++) seen.add(harvest(ripe(), tile, new Rng(s))!.items.some((i) => i.item === 'corn_seed'));
    expect(seen.size).toBe(2);
  });

  it('refuses unripe, empty or missing plots', () => {
    const young = plant(till(emptyFarm(), tile), tile, 'corn')!;
    expect(harvest(young, tile, new Rng(1))).toBeNull();
    expect(harvest(till(emptyFarm(), tile), tile, new Rng(1))).toBeNull();
    expect(harvest(emptyFarm(), tile, new Rng(1))).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/structures.test.ts tests/farm.test.ts`
Expected: FAIL, "Failed to resolve import "@/sim/structures"" (and `@/sim/farm`).

- [ ] **Step 3: Write the modules**

`src/sim/structures.ts`:

```typescript
import { CHEST_SLOTS, STRUCTURES, type Station, type StructureId } from '@/data/structures';
import { emptyInventory, type Inventory } from '@/sim/inventory';
import type { Vec } from '@/sim/movement';
import { idx, inBounds, isWater, type World } from '@/sim/world/types';

export interface Structure {
  readonly id: number;
  readonly type: StructureId;
  readonly x: number;
  readonly y: number;
  /** Contents of a chest. */
  readonly inv?: Inventory;
}

export interface Structures {
  readonly next: number;
  readonly list: readonly Structure[];
}

/** How far (tiles) the hero can place something, and how close a station must be to be used. */
export const PLACE_REACH = 4;
export const STATION_REACH = 3;

export const emptyStructures = (): Structures => ({ next: 1, list: [] });

export type PlaceResult = { ok: true } | { ok: false; reason: 'bounds' | 'water' | 'occupied' | 'far' | 'hero' };

/**
 * Can `type` go on tile (x, y)? `occupied` holds the tiles that are already taken by solid things (resource nodes,
 * landmark scenery, soil, structures); the hero's own tile is never allowed.
 */
export function canPlace(world: World, structures: Structures, occupied: ReadonlySet<number>, x: number, y: number, hero: Vec): PlaceResult {
  if (!inBounds(x, y, world.size)) return { ok: false, reason: 'bounds' };
  const i = idx(x, y, world.size);
  if (isWater(world.terrain[i])) return { ok: false, reason: 'water' };
  if (occupied.has(i) || structureAt(structures, x, y)) return { ok: false, reason: 'occupied' };
  if (Math.floor(hero.x) === x && Math.floor(hero.y) === y) return { ok: false, reason: 'hero' };
  if (Math.hypot(x + 0.5 - hero.x, y + 0.5 - hero.y) > PLACE_REACH) return { ok: false, reason: 'far' };
  return { ok: true };
}

export function placeStructure(s: Structures, type: StructureId, x: number, y: number): Structures {
  const built: Structure = type === 'chest' ? { id: s.next, type, x, y, inv: emptyInventory(CHEST_SLOTS) } : { id: s.next, type, x, y };
  return { next: s.next + 1, list: [...s.list, built] };
}

export function removeStructure(s: Structures, id: number): Structures {
  return { next: s.next, list: s.list.filter((p) => p.id !== id) };
}

export function structureAt(s: Structures, x: number, y: number): Structure | undefined {
  return s.list.find((p) => p.x === x && p.y === y);
}

export function setStructureInventory(s: Structures, id: number, inv: Inventory): Structures {
  return { next: s.next, list: s.list.map((p) => (p.id === id ? { ...p, inv } : p)) };
}

/** Crafting stations within reach of the hero. */
export function nearbyStations(s: Structures, pos: Vec): Set<Station> {
  const near = new Set<Station>();
  for (const p of s.list) {
    const station = STRUCTURES[p.type].station;
    if (station && Math.hypot(p.x + 0.5 - pos.x, p.y + 0.5 - pos.y) <= STATION_REACH) near.add(station);
  }
  return near;
}

/** Tiles structures block (torches do not). */
export function structureSolids(s: Structures, size: number): number[] {
  return s.list.filter((p) => STRUCTURES[p.type].solid).map((p) => idx(p.x, p.y, size));
}
```

`src/sim/farm.ts`:

```typescript
import { CROPS, SEED_RETURN_CHANCE, type CropId } from '@/data/crops';
import type { ItemId } from '@/data/items';
import type { Rng } from '@/core/rng';
import { T, idx, inBounds, type World } from '@/sim/world/types';

/** One tilled tile. `crop` is null for bare tilled soil. */
export interface Plot {
  readonly crop: CropId | null;
  /** Watered days the crop has grown. */
  readonly growth: number;
  /** Watered today; cleared when a new day starts. */
  readonly watered: boolean;
}

/** Tilled soil, keyed by tile index. */
export interface Farm {
  readonly plots: Readonly<Record<number, Plot>>;
}

export const emptyFarm = (): Farm => ({ plots: {} });

const BARE: Plot = { crop: null, growth: 0, watered: false };

/** Only grass and bare dirt can be tilled. */
export function canTill(world: World, farm: Farm, occupied: ReadonlySet<number>, x: number, y: number): boolean {
  if (!inBounds(x, y, world.size)) return false;
  const i = idx(x, y, world.size);
  const t = world.terrain[i];
  return (t === T.GRASS || t === T.DIRT) && !occupied.has(i) && !(i in farm.plots);
}

export function till(farm: Farm, tile: number): Farm {
  return tile in farm.plots ? farm : { plots: { ...farm.plots, [tile]: BARE } };
}

export function plotAt(farm: Farm, tile: number): Plot | undefined {
  return farm.plots[tile];
}

/** Sow a seed on empty tilled soil; null when the tile is not tilled or already planted. */
export function plant(farm: Farm, tile: number, crop: CropId): Farm | null {
  const p = farm.plots[tile];
  if (!p || p.crop) return null;
  return { plots: { ...farm.plots, [tile]: { crop, growth: 0, watered: p.watered } } };
}

export function water(farm: Farm, tile: number): Farm {
  const p = farm.plots[tile];
  if (!p || p.watered) return farm;
  return { plots: { ...farm.plots, [tile]: { ...p, watered: true } } };
}

export const isRipe = (p: Plot | undefined): boolean => !!p && p.crop !== null && p.growth >= CROPS[p.crop].growDays;

/** Which sprite stage (0 to ripeStage) to show. */
export function stageOf(p: Plot): number {
  if (!p.crop) return 0;
  const def = CROPS[p.crop];
  return Math.min(def.ripeStage, Math.floor((p.growth / def.growDays) * def.ripeStage));
}

/** A new day: watered crops grow a day, then every plot dries out. */
export function advanceDay(farm: Farm): Farm {
  const plots: Record<number, Plot> = {};
  for (const [key, p] of Object.entries(farm.plots)) {
    const grows = p.crop !== null && p.watered && p.growth < CROPS[p.crop].growDays;
    plots[Number(key)] = { crop: p.crop, growth: grows ? p.growth + 1 : p.growth, watered: false };
  }
  return { plots };
}

export interface Harvest {
  farm: Farm;
  items: { item: ItemId; qty: number }[];
}

/** Pick a ripe crop: the soil stays tilled and bare. Null when nothing is ripe there. */
export function harvest(farm: Farm, tile: number, rng: Rng): Harvest | null {
  const p = farm.plots[tile];
  if (!p || !p.crop || !isRipe(p)) return null;
  const def = CROPS[p.crop];
  const items: Harvest['items'] = [{ item: def.produce, qty: rng.int(def.yield[0], def.yield[1]) }];
  if (rng.chance(SEED_RETURN_CHANCE)) items.push({ item: def.seed, qty: 1 });
  return { farm: { plots: { ...farm.plots, [tile]: BARE } }, items };
}
```

- [ ] **Step 4: Run the tests and the typecheck**

Run: `npx vitest run tests/structures.test.ts tests/farm.test.ts && npm run typecheck`
Expected: structures 9, farm 11 tests PASS; typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/sim/structures.ts src/sim/farm.ts tests/structures.test.ts tests/farm.test.ts
git commit -m "feat: add building placement rules and crop farming"
```

---

### Task 6: The action resolver

**Files:**
- Create: `src/sim/actions.ts`
- Test: `tests/actions.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1 to 5, `ResourceNode`, `World`, `T`, `idx`, `inBounds` (plan 1).
- Produces: `Facing`, `frontTile(pos, facing)`, `ActionContext`, `Action` (`none`, `blocked` with a reason, `hit`, `place`, `pickup`, `till`, `plant`, `water`, `refill`, `eat`, `harvest`, `open`, `sleep`, `drink`), `resolveAction(ctx) -> Action`. Order of precedence: a structure in front, a ripe crop in front, the selected item's own use, then chopping/mining the nearest node, then drinking from a river.

- [ ] **Step 1: Write the failing test**

`tests/actions.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import type { ItemId } from '@/data/items';
import { advanceDay, emptyFarm, plant, till, water } from '@/sim/farm';
import { frontTile, resolveAction, type Action, type ActionContext, type Facing } from '@/sim/actions';
import { addItem, emptyInventory, setDurability } from '@/sim/inventory';
import { emptyStructures, placeStructure, setStructureInventory } from '@/sim/structures';
import { fullVitals } from '@/sim/vitals';
import { T, WORLD_SIZE, idx, type ResourceNode, type World } from '@/sim/world/types';

function makeWorld(): World {
  const size = WORLD_SIZE;
  const terrain = new Uint8Array(size * size).fill(T.GRASS);
  terrain[idx(11, 12)] = T.RIVER; // south-east of the hero
  terrain[idx(10, 12)] = T.SHALLOW;
  terrain[idx(9, 10)] = T.SAND;
  return { seed: 0, size, terrain, biome: new Uint8Array(size * size), landmarks: [], resources: [], start: { x: 10, y: 10 } };
}

const tree: ResourceNode = { id: 1, kind: 'tree', x: 11, y: 10, variant: 0 };
const bush: ResourceNode = { id: 2, kind: 'bush', x: 11, y: 10, variant: 0 };
const ore: ResourceNode = { id: 3, kind: 'ore', x: 11, y: 10, variant: 0 };

/** Hero at (10.5, 10.5) facing right, so the front tile is (11, 10). `hold` goes in hotbar slot 0. */
function ctx(over: Partial<ActionContext> & { hold?: ItemId; facing?: Facing } = {}): ActionContext {
  const { hold, ...rest } = over;
  let inv = emptyInventory();
  if (hold) inv = addItem(inv, hold, 1).inv;
  return {
    world: makeWorld(), inv, selected: 0, vitals: fullVitals(), pos: { x: 10.5, y: 10.5 }, facing: 'right',
    structures: emptyStructures(), farm: emptyFarm(), occupied: new Set(), node: null, ...rest,
  };
}

const kind = (a: Action): string => a.kind;

describe('frontTile', () => {
  it('is the neighbouring tile in the facing direction', () => {
    const pos = { x: 10.9, y: 10.1 };
    expect(frontTile(pos, 'right')).toEqual({ x: 11, y: 10 });
    expect(frontTile(pos, 'left')).toEqual({ x: 9, y: 10 });
    expect(frontTile(pos, 'up')).toEqual({ x: 10, y: 9 });
    expect(frontTile(pos, 'down')).toEqual({ x: 10, y: 11 });
  });
});

describe('structures and crops come first', () => {
  it('opens a workbench, furnace, campfire or chest and sleeps in a bed with bare hands or food in hand', () => {
    for (const [type, expected] of [['workbench', 'open'], ['chest', 'open'], ['furnace', 'open'], ['campfire', 'open'], ['bed', 'sleep']] as const) {
      const structures = placeStructure(emptyStructures(), type, 11, 10);
      expect(kind(resolveAction(ctx({ structures })))).toBe(expected);
      expect(kind(resolveAction(ctx({ structures, hold: 'carrot' })))).toBe(expected);
    }
  });

  it('takes fences and torches down with a plain press, whatever is held', () => {
    for (const type of ['fence', 'torch'] as const) {
      const structures = placeStructure(emptyStructures(), type, 11, 10);
      expect(resolveAction(ctx({ structures }))).toMatchObject({ kind: 'pickup', structure: { type } });
      expect(kind(resolveAction(ctx({ structures, hold: 'carrot' })))).toBe('pickup');
    }
  });

  it('dismantles stations, beds and chests only while holding an axe or pickaxe', () => {
    for (const type of ['workbench', 'furnace', 'campfire', 'bed', 'chest'] as const) {
      const structures = placeStructure(emptyStructures(), type, 11, 10);
      expect(kind(resolveAction(ctx({ structures, hold: 'axe_wood' })))).toBe('pickup');
      expect(kind(resolveAction(ctx({ structures, hold: 'pickaxe_stone' })))).toBe('pickup');
      expect(kind(resolveAction(ctx({ structures, hold: 'hoe' })))).not.toBe('pickup');
    }
  });

  it('refuses to dismantle a chest that still holds items', () => {
    const full = setStructureInventory(placeStructure(emptyStructures(), 'chest', 11, 10), 1, addItem(emptyInventory(20), 'wood', 3).inv);
    expect(resolveAction(ctx({ structures: full, hold: 'axe_wood' }))).toEqual({ kind: 'blocked', reason: 'chestNotEmpty' });
    const empty = setStructureInventory(placeStructure(emptyStructures(), 'chest', 11, 10), 1, emptyInventory(20));
    expect(kind(resolveAction(ctx({ structures: empty, hold: 'axe_wood' })))).toBe('pickup');
  });

  it('harvests a ripe crop but not a young one', () => {
    const tile = idx(11, 10);
    let farm = plant(till(emptyFarm(), tile), tile, 'carrot')!;
    expect(kind(resolveAction(ctx({ farm })))).toBe('none');
    for (let d = 0; d < 3; d++) farm = advanceDay(water(farm, tile));
    expect(resolveAction(ctx({ farm }))).toEqual({ kind: 'harvest', x: 11, y: 10 });
  });
});

describe('held items', () => {
  it('eats food when something would be gained, otherwise does nothing', () => {
    const hungry = { ...fullVitals(), hunger: 50 };
    expect(kind(resolveAction(ctx({ hold: 'carrot', vitals: hungry })))).toBe('eat');
    expect(kind(resolveAction(ctx({ hold: 'carrot' })))).toBe('none');
    expect(kind(resolveAction(ctx({ hold: 'coconut', vitals: { ...fullVitals(), thirst: 10 } })))).toBe('eat');
  });

  it('places a structure in front, or says why not', () => {
    expect(resolveAction(ctx({ hold: 'campfire' }))).toEqual({ kind: 'place', type: 'campfire', x: 11, y: 10 });
    expect(resolveAction(ctx({ hold: 'campfire', facing: 'down', pos: { x: 11.5, y: 11.5 } }))).toEqual({
      kind: 'blocked', reason: 'cannotPlace', why: 'water',
    });
    expect(resolveAction(ctx({ hold: 'campfire', occupied: new Set([idx(11, 10)]) }))).toEqual({
      kind: 'blocked', reason: 'cannotPlace', why: 'occupied',
    });
  });

  it('plants a seed only on empty tilled soil', () => {
    const tile = idx(11, 10);
    expect(kind(resolveAction(ctx({ hold: 'corn_seed' })))).toBe('none');
    expect(resolveAction(ctx({ hold: 'corn_seed', farm: till(emptyFarm(), tile) }))).toEqual({ kind: 'plant', x: 11, y: 10, crop: 'corn' });
    const planted = plant(till(emptyFarm(), tile), tile, 'corn')!;
    expect(kind(resolveAction(ctx({ hold: 'corn_seed', farm: planted })))).toBe('none');
  });

  it('tills grass with a hoe, refuses sand, and needs stamina', () => {
    expect(resolveAction(ctx({ hold: 'hoe' }))).toEqual({ kind: 'till', x: 11, y: 10, stamina: 2 });
    expect(kind(resolveAction(ctx({ hold: 'hoe', facing: 'left' })))).toBe('none');
    expect(resolveAction(ctx({ hold: 'hoe', vitals: { ...fullVitals(), stamina: 1 } }))).toEqual({ kind: 'blocked', reason: 'tired' });
  });

  it('refills a watering can at a river, waters thirsty crops and refuses sea water', () => {
    const riverCtx = { hold: 'watering_can' as const, facing: 'down' as const, pos: { x: 11.5, y: 11.5 } };
    expect(resolveAction(ctx(riverCtx))).toEqual({ kind: 'refill', x: 11, y: 12 });
    expect(resolveAction(ctx({ ...riverCtx, pos: { x: 10.5, y: 11.5 } }))).toEqual({ kind: 'blocked', reason: 'saltWater' });
    const tile = idx(11, 10);
    const farm = plant(till(emptyFarm(), tile), tile, 'carrot')!;
    const full = setDurability(ctx({ hold: 'watering_can' }).inv, 0, 5);
    expect(resolveAction(ctx({ farm, inv: full }))).toEqual({ kind: 'water', x: 11, y: 10 });
    expect(resolveAction(ctx({ hold: 'watering_can', farm }))).toEqual({ kind: 'blocked', reason: 'canEmpty' });
    expect(kind(resolveAction(ctx({ farm: water(farm, tile), inv: full })))).toBe('none');
  });
});

describe('the world', () => {
  it('chops with the right tool and by hand, slowly', () => {
    expect(resolveAction(ctx({ hold: 'axe_wood', node: tree }))).toEqual({ kind: 'hit', node: tree, damage: 1, stamina: 2, wear: true });
    expect(resolveAction(ctx({ node: tree }))).toMatchObject({ kind: 'hit', damage: 0.34, wear: false });
  });

  it('tells the player which tool a hard node needs', () => {
    expect(resolveAction(ctx({ hold: 'pickaxe_wood', node: ore }))).toEqual({ kind: 'blocked', reason: 'needsTool', tool: 'pickaxe', tier: 2 });
    expect(resolveAction(ctx({ node: ore }))).toMatchObject({ reason: 'needsTool' });
  });

  it('picks berries without a tool and refuses when too tired to swing', () => {
    expect(resolveAction(ctx({ node: bush }))).toMatchObject({ kind: 'hit', damage: 1 });
    const tired = { ...fullVitals(), stamina: 0 };
    expect(resolveAction(ctx({ node: tree, vitals: tired }))).toEqual({ kind: 'blocked', reason: 'tired' });
  });

  it('drinks from a river, warns about sea water and otherwise does nothing', () => {
    const down = { facing: 'down' as const };
    expect(resolveAction(ctx({ ...down, pos: { x: 11.5, y: 11.5 } }))).toEqual({ kind: 'drink', x: 11, y: 12 });
    expect(resolveAction(ctx({ ...down, pos: { x: 10.5, y: 11.5 } }))).toEqual({ kind: 'blocked', reason: 'saltWater' });
    expect(kind(resolveAction(ctx()))).toBe('none');
  });

  it('is safe at the edge of the map', () => {
    expect(kind(resolveAction(ctx({ pos: { x: 0.5, y: 0.5 }, facing: 'left' })))).toBe('blocked');
    expect(kind(resolveAction(ctx({ pos: { x: 0.5, y: 0.5 }, facing: 'up', hold: 'hoe' })))).toBe('none');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/actions.test.ts`
Expected: FAIL, "Failed to resolve import "@/sim/actions"".

- [ ] **Step 3: Write the resolver**

`src/sim/actions.ts`:

```typescript
import { ITEMS, type ToolType } from '@/data/items';
import type { CropId } from '@/data/crops';
import { STRUCTURES, type StructureId } from '@/data/structures';
import { STAMINA_TOOL } from '@/data/tools';
import { canTill, isRipe, plotAt, type Farm } from '@/sim/farm';
import type { Inventory } from '@/sim/inventory';
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
}

export type Blocked =
  | { reason: 'needsTool'; tool: ToolType; tier: number }
  | { reason: 'tired' }
  | { reason: 'saltWater' }
  | { reason: 'canEmpty' }
  | { reason: 'chestNotEmpty' }
  | { reason: 'cannotPlace'; why: Extract<PlaceResult, { ok: false }>['reason'] };

export type Action =
  | { kind: 'none' }
  | ({ kind: 'blocked' } & Blocked)
  | { kind: 'hit'; node: ResourceNode; damage: number; stamina: number; wear: boolean }
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
    const ok = canPlace(c.world, c.structures, c.occupied, x, y, c.pos);
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

  if (c.node) {
    const check = checkHit(c.node.kind, slot?.item ?? null);
    if (!check.ok) return blocked({ reason: 'needsTool', tool: check.tool, tier: check.tier });
    if (c.vitals.stamina < check.stamina) return blocked({ reason: 'tired' });
    return { kind: 'hit', node: c.node, damage: check.damage, stamina: check.stamina, wear: check.wear };
  }
  if (terrain === T.RIVER) return { kind: 'drink', x, y };
  if (terrain === T.SHALLOW || terrain === T.DEEP) return blocked({ reason: 'saltWater' });
  return NONE;
}
```

- [ ] **Step 4: Run the test and the typecheck**

Run: `npx vitest run tests/actions.test.ts && npm run typecheck`
Expected: 16 tests PASS; typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/sim/actions.ts tests/actions.test.ts
git commit -m "feat: add the action resolver that decides what the use button does"
```

---

### Task 7: Save format 2 and the generator version

**Files:**
- Create: `src/core/saveData.ts`
- Replace: `src/sim/world/generate.ts`, `vite.config.ts`
- Test: `tests/saveData.test.ts`

**Interfaces:**
- Consumes: Tasks 1 to 5 (items, inventory, vitals, structures, farm), `Clock`, `GatherState`, `DAY_SECONDS` (plan 1).
- Produces: `SAVE_VERSION = 2`, `Difficulty`, `SaveSlot` (adds `worldVersion`, `respawn`, `inventory`, `selected`, `vitals`, `structures`, `farm`; no `bag`), `SlotSummary`, `newSlot(slot, name, seed, difficulty, start, clock, now?)`, `parseSlot(raw, slot) -> SaveSlot | null`; `GENERATOR_VERSION = 1` exported from `generate.ts`.

`core/save.ts` (the store) and the old `newSlot`/`parseSlot` stay as they are until Task 11, which switches the store over together with the scenes that use it. Until then both exist side by side so every task keeps compiling.

- [ ] **Step 1: Write the failing test**

`tests/saveData.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { SAVE_VERSION, newSlot, parseSlot } from '@/core/saveData';
import { newClock } from '@/sim/daynight';
import { GENERATOR_VERSION } from '@/sim/world/generate';

const make = (slot = 0, name = 'Ari') => newSlot(slot, name, 4242, 'normal', { x: 77, y: 147 }, newClock(), 1000);

describe('newSlot', () => {
  it('starts a fresh game with full vitals, an empty backpack and the hero beside the start beach', () => {
    const s = make(1);
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.worldVersion).toBe(GENERATOR_VERSION);
    expect(s.player).toEqual({ x: 77.5, y: 147.5 });
    expect(s.respawn).toEqual(s.player);
    expect(s.respawn).not.toBe(s.player);
    expect(s.vitals).toEqual({ hp: 100, hunger: 100, thirst: 100, stamina: 100 });
    expect(s.inventory).toHaveLength(32);
    expect(s.inventory.every((slot) => slot === null)).toBe(true);
    expect(s.structures).toEqual({ next: 1, list: [] });
    expect(s.farm).toEqual({ plots: {} });
  });
});

describe('parseSlot', () => {
  const valid = () => JSON.parse(JSON.stringify(make(0)));

  it('rejects non-objects and missing fields', () => {
    expect(parseSlot(null, 0)).toBeNull();
    expect(parseSlot('x', 0)).toBeNull();
    expect(parseSlot({}, 0)).toBeNull();
    expect(parseSlot({ ...valid(), seed: 'abc' }, 0)).toBeNull();
    expect(parseSlot({ ...valid(), player: { x: NaN, y: 1 } }, 0)).toBeNull();
    expect(parseSlot({ ...valid(), clock: { day: 0, t: 1 } }, 0)).toBeNull();
  });

  it('rejects a clock that cannot belong to a real save (a huge time of day would hang the game)', () => {
    expect(parseSlot({ ...valid(), clock: { day: 1, t: 1e300 } }, 0)).toBeNull();
    expect(parseSlot({ ...valid(), clock: { day: 1, t: 600 } }, 0)).toBeNull();
    expect(parseSlot({ ...valid(), clock: { day: 1e7, t: 10 } }, 0)).toBeNull();
    expect(parseSlot({ ...valid(), clock: { day: 3, t: 599.9 } }, 0)?.clock).toEqual({ day: 3, t: 599.9 });
  });

  it('rejects a save from a newer game version', () => {
    expect(parseSlot({ ...valid(), version: 99 }, 0)).toBeNull();
  });

  it('rejects saves whose version is not one this game understands', () => {
    for (const version of [0, -5, 3, 1.5, '2', null]) expect(parseSlot({ ...valid(), version }, 0), String(version)).toBeNull();
  });

  it('drops unreadable inventory slots instead of failing the whole save', () => {
    const raw = valid();
    raw.inventory[0] = { item: 'unobtainium', qty: 3 };
    raw.inventory[1] = { item: 'wood', qty: -4 };
    raw.inventory[2] = { item: 'wood', qty: 5000 };
    raw.inventory[3] = { item: 'axe_wood', qty: 7, dur: 9999 };
    raw.inventory[4] = { item: 'axe_wood', qty: 1, dur: 0 };
    raw.inventory[5] = { item: 'watering_can', qty: 1, dur: 0 };
    raw.inventory[6] = 'junk';
    const inv = parseSlot(raw, 0)!.inventory;
    expect(inv).toHaveLength(32);
    expect(inv[0]).toBeNull();
    expect(inv[1]).toBeNull();
    expect(inv[2]).toEqual({ item: 'wood', qty: 99 });
    expect(inv[3]).toEqual({ item: 'axe_wood', qty: 1, dur: 40 });
    expect(inv[4]).toBeNull();
    expect(inv[5]).toEqual({ item: 'watering_can', qty: 1, dur: 0 });
    expect(inv[6]).toBeNull();
  });

  it('clamps vitals and the hotbar selection', () => {
    const s = parseSlot({ ...valid(), vitals: { hp: 500, hunger: -3, thirst: 'x' }, selected: 99 }, 0)!;
    expect(s.vitals).toEqual({ hp: 100, hunger: 0, thirst: 100, stamina: 100 });
    expect(s.selected).toBe(0);
  });

  it('keeps only sound structures and farm plots', () => {
    const raw = valid();
    raw.structures = {
      next: 1,
      list: [
        { id: 4, type: 'chest', x: 3, y: 3, inv: [{ item: 'wood', qty: 2 }] },
        { id: 5, type: 'castle', x: 4, y: 4 },
        { id: 6, type: 'bed', x: -1, y: 4 },
        { id: 7, type: 'bed', x: 3, y: 3 },
        { id: 4, type: 'fence', x: 9, y: 9 },
        { id: 8, type: 'fence', x: 1.5, y: 9 },
      ],
    };
    raw.farm = { plots: { 10: { crop: 'carrot', growth: 99, watered: true }, 11: { crop: 'weeds', growth: 5 }, '-4': {}, abc: {} } };
    const s = parseSlot(raw, 0)!;
    expect(s.structures.list).toHaveLength(1);
    expect(s.structures.list[0]).toMatchObject({ id: 4, type: 'chest', x: 3, y: 3 });
    expect(s.structures.list[0].inv?.[0]).toEqual({ item: 'wood', qty: 2 });
    expect(s.structures.next).toBe(5);
    expect(s.farm.plots[10]).toEqual({ crop: 'carrot', growth: 3, watered: true });
    expect(s.farm.plots[11]).toEqual({ crop: null, growth: 0, watered: false });
    expect(Object.keys(s.farm.plots)).toEqual(['10', '11']);
  });

  it('upgrades a phase 1 save: loose materials become inventory items, the rest gets defaults', () => {
    const old = { version: 1, slot: 0, name: 'Ari', seed: 7, difficulty: 'normal', player: { x: 5, y: 6 }, clock: { day: 3, t: 10 }, gather: { hp: {}, gone: { 4: 1 } }, bag: { wood: 7, stone: 2, mystery: 4 } };
    const s = parseSlot(old, 1)!;
    expect(s.version).toBe(2);
    expect(s.inventory[0]).toEqual({ item: 'wood', qty: 7 });
    expect(s.inventory[1]).toEqual({ item: 'stone', qty: 2 });
    expect(s.inventory.filter(Boolean)).toHaveLength(2);
    expect(s.vitals).toEqual({ hp: 100, hunger: 100, thirst: 100, stamina: 100 });
    expect(s.respawn).toEqual({ x: 5, y: 6 });
    expect(s.worldVersion).toBe(1);
    expect(s.gather.gone).toEqual({ 4: 1 });
    expect(s.structures).toEqual({ next: 1, list: [] });
  });

  it('fills defaults for missing optional fields and cleans the name', () => {
    const raw = valid();
    delete raw.inventory;
    delete raw.vitals;
    delete raw.gather;
    raw.name = '   ';
    raw.difficulty = 'impossible';
    const s = parseSlot(raw, 2)!;
    expect(s.inventory.every((slot) => slot === null)).toBe(true);
    expect(s.worldVersion).toBeGreaterThan(0);
    expect(s.gather).toEqual({ hp: {}, gone: {} });
    expect(s.name).toBe('Castaway');
    expect(s.difficulty).toBe('normal');
    expect(s.slot).toBe(2);
  });

  it('truncates very long names', () => {
    expect(parseSlot({ ...valid(), name: 'x'.repeat(100) }, 0)!.name).toHaveLength(16);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/saveData.test.ts`
Expected: FAIL, "Failed to resolve import "@/core/saveData"".

- [ ] **Step 3: Write the save data module and the generator version**

`src/core/saveData.ts`:

```typescript
import { CROPS, type CropId } from '@/data/crops';
import { ITEMS, isItemId } from '@/data/items';
import { CHEST_SLOTS, STRUCTURES, type StructureId } from '@/data/structures';
import { DAY_SECONDS, type Clock } from '@/sim/daynight';
import { emptyFarm, type Farm, type Plot } from '@/sim/farm';
import { emptyGather, type GatherState } from '@/sim/gather';
import { HOTBAR_SIZE, INVENTORY_SIZE, addItem, emptyInventory, type Inventory, type Slot } from '@/sim/inventory';
import type { Structure, Structures } from '@/sim/structures';
import { VITAL_MAX, fullVitals, type Difficulty, type Vitals } from '@/sim/vitals';
import { GENERATOR_VERSION } from '@/sim/world/generate';
import { WORLD_SIZE } from '@/sim/world/types';

export const SAVE_VERSION = 2;
/** A save claiming more days than this is corrupt (real games last far fewer). */
const MAX_DAY = 1_000_000;

export type { Difficulty };
const DIFFICULTIES: readonly Difficulty[] = ['relaxed', 'normal', 'hardcore'];

/** Everything that survives closing the app. The island itself is regenerated from `seed`. */
export interface SaveSlot {
  version: number;
  slot: number;
  name: string;
  seed: number;
  /** GENERATOR_VERSION the island was played on; if it changed, harvested-node state no longer applies. */
  worldVersion: number;
  difficulty: Difficulty;
  createdAt: number;
  updatedAt: number;
  playTimeSec: number;
  player: { x: number; y: number };
  /** Where the hero wakes up after sleeping or collapsing. */
  respawn: { x: number; y: number };
  clock: Clock;
  gather: GatherState;
  inventory: Inventory;
  /** Selected hotbar slot. */
  selected: number;
  vitals: Vitals;
  structures: Structures;
  farm: Farm;
}

export interface SlotSummary {
  slot: number;
  name: string;
  day: number;
  playTimeSec: number;
  updatedAt: number;
  seed: number;
  difficulty: Difficulty;
}

export function newSlot(
  slot: number, name: string, seed: number, difficulty: Difficulty, start: { x: number; y: number }, clock: Clock, now = Date.now(),
): SaveSlot {
  const spawn = { x: start.x + 0.5, y: start.y + 0.5 };
  return {
    version: SAVE_VERSION, slot, name, seed, worldVersion: GENERATOR_VERSION, difficulty, createdAt: now, updatedAt: now,
    playTimeSec: 0, player: spawn, respawn: { ...spawn }, clock, gather: emptyGather(), inventory: emptyInventory(), selected: 0,
    vitals: fullVitals(), structures: { next: 1, list: [] }, farm: emptyFarm(),
  };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isRecordOfNumbers = (v: unknown): v is Record<string, number> => isRecord(v) && Object.values(v).every((n) => isNum(n) && n >= 0);
const clampVital = (v: unknown, fallback: number): number => (isNum(v) ? Math.min(VITAL_MAX, Math.max(0, v)) : fallback);

/** Keep every valid slot of an untrusted inventory and drop the rest (unknown items, bad counts, broken tools). */
function parseInventory(raw: unknown, size: number): Inventory {
  const out: (Slot | null)[] = [...emptyInventory(size)];
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < Math.min(size, raw.length); i++) {
    const s: unknown = raw[i];
    if (!isRecord(s) || !isItemId(s.item) || !isInt(s.qty) || s.qty < 1) continue;
    const def = ITEMS[s.item];
    if (!def.tool) {
      out[i] = { item: s.item, qty: Math.min(def.stack, s.qty) };
      continue;
    }
    const dur = isNum(s.dur) ? Math.min(def.tool.durability, Math.max(0, s.dur)) : def.tool.type === 'can' ? 0 : def.tool.durability;
    if (dur <= 0 && def.tool.type !== 'can') continue;
    out[i] = { item: s.item, qty: 1, dur };
  }
  return out;
}

function parseVitals(raw: unknown): Vitals {
  const d = isRecord(raw) ? raw : {};
  return { hp: clampVital(d.hp, VITAL_MAX), hunger: clampVital(d.hunger, VITAL_MAX), thirst: clampVital(d.thirst, VITAL_MAX), stamina: clampVital(d.stamina, VITAL_MAX) };
}

function parseStructures(raw: unknown): Structures {
  const list: Structure[] = [];
  const d = isRecord(raw) ? raw : {};
  const seenTiles = new Set<number>();
  const seenIds = new Set<number>();
  for (const e of Array.isArray(d.list) ? (d.list as unknown[]) : []) {
    if (!isRecord(e) || typeof e.type !== 'string' || !Object.prototype.hasOwnProperty.call(STRUCTURES, e.type)) continue;
    if (!isInt(e.id) || e.id < 1 || !isInt(e.x) || !isInt(e.y)) continue;
    if (e.x < 0 || e.y < 0 || e.x >= WORLD_SIZE || e.y >= WORLD_SIZE) continue;
    const tile = e.y * WORLD_SIZE + e.x;
    if (seenTiles.has(tile) || seenIds.has(e.id)) continue;
    seenTiles.add(tile);
    seenIds.add(e.id);
    const type = e.type as StructureId;
    list.push(type === 'chest' ? { id: e.id, type, x: e.x, y: e.y, inv: parseInventory(e.inv, CHEST_SLOTS) } : { id: e.id, type, x: e.x, y: e.y });
  }
  const next = Math.max(isInt(d.next) ? d.next : 1, ...list.map((s) => s.id + 1), 1);
  return { next, list };
}

function parseFarm(raw: unknown): Farm {
  const plots: Record<number, Plot> = {};
  const d = isRecord(raw) && isRecord(raw.plots) ? raw.plots : {};
  for (const [key, p] of Object.entries(d)) {
    const tile = Number(key);
    if (!Number.isInteger(tile) || tile < 0 || tile >= WORLD_SIZE * WORLD_SIZE || !isRecord(p)) continue;
    const crop = typeof p.crop === 'string' && Object.prototype.hasOwnProperty.call(CROPS, p.crop) ? (p.crop as CropId) : null;
    const growth = crop && isInt(p.growth) ? Math.min(CROPS[crop].growDays, Math.max(0, p.growth)) : 0;
    plots[tile] = { crop, growth, watered: p.watered === true };
  }
  return { plots };
}

/** Phase 1 saves kept loose materials in a `bag`; they become ordinary inventory items. */
function inventoryFromBag(bag: unknown): Inventory {
  let inv = emptyInventory();
  if (!isRecord(bag)) return inv;
  for (const [item, n] of Object.entries(bag)) {
    if (isItemId(item) && isInt(n) && n > 0) inv = addItem(inv, item, n).inv;
  }
  return inv;
}

/** Validate untrusted JSON into a SaveSlot; null when it cannot be trusted (corrupt, or from a newer game version). */
export function parseSlot(raw: unknown, slot: number): SaveSlot | null {
  if (!isRecord(raw)) return null;
  const d = raw;
  if (d.version !== 1 && d.version !== 2) return null;
  if (!isNum(d.seed)) return null;
  const player = d.player;
  const clock = d.clock;
  if (!isRecord(player) || !isNum(player.x) || !isNum(player.y)) return null;
  if (!isRecord(clock) || !isNum(clock.day) || clock.day < 1 || clock.day > MAX_DAY) return null;
  // The time of day is always inside one day; a huge value would make the clock loop for ages.
  if (!isNum(clock.t) || clock.t < 0 || clock.t >= DAY_SECONDS) return null;
  const gather = isRecord(d.gather) ? d.gather : undefined;
  const hp = gather?.hp ?? {};
  const gone = gather?.gone ?? {};
  if (!isRecordOfNumbers(hp) || !isRecordOfNumbers(gone)) return null;
  const respawn = isRecord(d.respawn) && isNum(d.respawn.x) && isNum(d.respawn.y) ? { x: d.respawn.x, y: d.respawn.y } : { x: player.x, y: player.y };
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    slot,
    name: typeof d.name === 'string' && d.name.trim() ? d.name.trim().slice(0, 16) : 'Castaway',
    seed: d.seed >>> 0,
    worldVersion: isInt(d.worldVersion) ? d.worldVersion : 1,
    difficulty: DIFFICULTIES.includes(d.difficulty as Difficulty) ? (d.difficulty as Difficulty) : 'normal',
    createdAt: isNum(d.createdAt) ? d.createdAt : now,
    updatedAt: isNum(d.updatedAt) ? d.updatedAt : now,
    playTimeSec: isNum(d.playTimeSec) && d.playTimeSec >= 0 ? d.playTimeSec : 0,
    player: { x: player.x, y: player.y },
    respawn,
    clock: { day: Math.floor(clock.day), t: clock.t },
    gather: { hp, gone },
    inventory: d.version === 1 ? inventoryFromBag(d.bag) : parseInventory(d.inventory, INVENTORY_SIZE),
    selected: isInt(d.selected) && d.selected >= 0 && d.selected < HOTBAR_SIZE ? d.selected : 0,
    vitals: parseVitals(d.vitals),
    structures: parseStructures(d.structures),
    farm: parseFarm(d.farm),
  };
}
```

Replace `src/sim/world/generate.ts` (adds `GENERATOR_VERSION`; nothing else changes):

`src/sim/world/generate.ts`:

```typescript
import { Rng } from '@/core/rng';
import { generateTerrain } from './terrain';
import { placeLandmarks } from './landmarks';
import { scatterResources } from './resources';
import { B, WORLD_SIZE, idx, inBounds, isWalkable, isWater, T, type World } from './types';

/**
 * Bump when a change to the generator would alter existing islands. Saves record it so that a changed island does not
 * silently scramble the resource nodes the player already harvested (node ids are positions in the scatter order).
 */
export const GENERATOR_VERSION = 1;

const MAX_ATTEMPTS = 24;
const MIN_BIOME_LAND = 400;
const LANDMARK_COUNT = 13;

/** Flood-fill walkable ground from `from`; returns the set of reachable tile indexes. */
export function reachable(terrain: Uint8Array, size: number, from: { x: number; y: number }): Uint8Array {
  const seen = new Uint8Array(size * size);
  const stack = [idx(from.x, from.y, size)];
  seen[stack[0]] = 1;
  while (stack.length) {
    const c = stack.pop()!;
    const x = c % size;
    const y = (c - x) / size;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny, size)) continue;
      const n = idx(nx, ny, size);
      if (!seen[n] && isWalkable(terrain[n])) {
        seen[n] = 1;
        stack.push(n);
      }
    }
  }
  return seen;
}

/** Human-readable problems; an empty list means the world is playable. */
export function validateWorld(w: World): string[] {
  const problems: string[] = [];
  if (w.landmarks.length !== LANDMARK_COUNT) problems.push(`expected ${LANDMARK_COUNT} landmarks, got ${w.landmarks.length}`);
  const seen = reachable(w.terrain, w.size, w.start);
  for (const l of w.landmarks) {
    const i = idx(l.x, l.y, w.size);
    if (isWater(w.terrain[i])) problems.push(`${l.id} is in water`);
    else if (!seen[i]) problems.push(`${l.id} is unreachable`);
  }
  if (w.terrain[idx(w.start.x, w.start.y, w.size)] !== T.SAND) problems.push('start is not on sand');
  for (const b of [B.FOREST, B.MOUNTAIN, B.SWAMP, B.DESERT]) {
    let n = 0;
    for (let i = 0; i < w.biome.length; i++) if (w.biome[i] === b && !isWater(w.terrain[i])) n++;
    if (n < MIN_BIOME_LAND) problems.push(`biome ${b} has only ${n} land tiles`);
  }
  return problems;
}

/** Deterministic: the same seed always yields the same island (re-rolling internally if a layout is unplayable). */
export function generateWorld(seed: number, size = WORLD_SIZE): World {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const s = (seed + Math.imul(attempt, 7919)) >>> 0;
    const { terrain, biome } = generateTerrain(s, size);
    const rng = new Rng(s);
    const landmarks = placeLandmarks(terrain, biome, size, rng);
    if (!landmarks) continue;
    const start = landmarks.find((l) => l.id === 'start')!;
    const world: World = {
      seed, size, terrain, biome, landmarks,
      resources: scatterResources(terrain, biome, landmarks, size, rng),
      start: { x: start.x, y: start.y },
    };
    if (validateWorld(world).length === 0) return world;
  }
  throw new Error(`generateWorld: no valid island for seed ${seed}`);
}
```

Replace `vite.config.ts` (adds `saveData.ts` to the coverage list):

`vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: './',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 3000,
    rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } },
  },
  server: { port: 5188, strictPort: true },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/sim/**', 'src/data/**', 'src/core/rng.ts', 'src/core/save.ts', 'src/core/saveData.ts', 'src/core/settings.ts', 'src/core/i18n.ts', 'src/core/viewport.ts'],
      exclude: ['src/data/tileIndex.ts'],
      reporter: ['text'],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 70 },
    },
  },
} as never);
```

- [ ] **Step 4: Run the tests and the typecheck**

Run: `npx vitest run tests/saveData.test.ts && npm run typecheck && npm test`
Expected: saveData 11 tests PASS; typecheck exits 0; the whole suite passes.

- [ ] **Step 5: Commit**

```bash
git add src/core/saveData.ts src/sim/world/generate.ts vite.config.ts tests/saveData.test.ts
git commit -m "feat: add save format 2 with inventory, vitals, buildings and crops, and a generator version"
```

---

### Task 8: The session

**Files:**
- Create: `src/sim/session.ts`
- Test: `tests/session.test.ts`

**Interfaces:**
- Consumes: Tasks 1 to 7.
- Produces: `Session` (seed, difficulty, clock, gather, inventory, selected, vitals, structures, farm, respawn, playTime), `Fx` (`say`, `gain`, `swing`, `hit`, `gone`, `built`, `unbuilt`, `plot`, `open`, `slept`), `Step {session, fx}`, `sessionFromSlot`, `sessionToSlot(base, session, pos)`, `tickSession(s, dt, biome, busy)`, `rollDay(s, keepGone)`, `selectSlot`, `applyAction(s, action, pos) -> Step`, `craftRecipe(s, recipe, near) -> Step`, `moveInventorySlot`, `transferStack(s, chestId, from, index) -> Step`, `collapse(s, roll) -> {session, wipeSave}`.

- [ ] **Step 1: Write the failing test**

`tests/session.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { newSlot } from '@/core/saveData';
import { CROPS } from '@/data/crops';
import { RECIPES } from '@/data/recipes';
import type { Station } from '@/data/structures';
import type { Action } from '@/sim/actions';
import { DAY_SECONDS } from '@/sim/daynight';
import { emptyFarm, plotAt, till, plant, water, advanceDay } from '@/sim/farm';
import { RESOURCES } from '@/data/resources';
import { RESPAWN_VITALS } from '@/sim/death';
import { emptyGather, isAlive } from '@/sim/gather';
import { addItem, countItem, emptyInventory, setDurability } from '@/sim/inventory';
import { emptyStructures, placeStructure, setStructureInventory } from '@/sim/structures';
import {
  applyAction, collapse, craftRecipe, moveInventorySlot, rollDay, selectSlot, sessionFromSlot, sessionToSlot, tickSession,
  transferStack, type Session,
} from '@/sim/session';
import { B, WORLD_SIZE, idx, type ResourceNode } from '@/sim/world/types';

const slot = () => newSlot(0, 'Ari', 1234, 'normal', { x: 50, y: 50 }, { day: 1, t: 100 }, 1000);
const base = (over: Partial<Session> = {}): Session => ({ ...sessionFromSlot(slot()), ...over });
const give = (s: Session, ...pairs: [Parameters<typeof addItem>[1], number][]): Session => ({
  ...s, inventory: pairs.reduce((inv, [item, n]) => addItem(inv, item, n).inv, s.inventory),
});
const pos = { x: 50.5, y: 50.5 };
const tree: ResourceNode = { id: 3, kind: 'tree', x: 51, y: 50, variant: 0 };
const say = (s: ReturnType<typeof applyAction>) => s.fx.filter((f) => f.t === 'say');

describe('session basics', () => {
  it('round-trips through a save slot', () => {
    const s = give(base(), ['wood', 4]);
    const out = sessionToSlot(slot(), s, { x: 1.5, y: 2.5 });
    expect(out.player).toEqual({ x: 1.5, y: 2.5 });
    expect(sessionFromSlot(out)).toEqual(s);
  });

  it('ticks the clock and the vital meters', () => {
    const s = tickSession(base(), 10, B.FOREST, false);
    expect(s.clock.t).toBeCloseTo(110);
    expect(s.playTime).toBe(10);
    expect(s.vitals.hunger).toBeLessThan(100);
  });

  it('selects only hotbar slots', () => {
    expect(selectSlot(base(), 5).selected).toBe(5);
    expect(selectSlot(base(), 8).selected).toBe(0);
    expect(selectSlot(base(), -1).selected).toBe(0);
  });

  it('moves inventory slots', () => {
    const s = moveInventorySlot(give(base(), ['wood', 2]), 0, 9);
    expect(s.inventory[9]).toEqual({ item: 'wood', qty: 2 });
  });
});

describe('hitting resource nodes', () => {
  const hit = (over: Partial<Extract<Action, { kind: 'hit' }>> = {}): Action => ({ kind: 'hit', node: tree, damage: 99, stamina: 2, wear: true, ...over });

  it('collects drops, spends stamina and wears the tool', () => {
    const s = give(base(), ['axe_wood', 1]);
    const r = applyAction(s, hit(), pos);
    expect(countItem(r.session.inventory, 'wood')).toBeGreaterThanOrEqual(2);
    expect(r.session.vitals.stamina).toBe(98);
    expect(r.session.inventory[0]?.dur).toBe(39);
    expect(isAlive(r.session.gather, tree.id)).toBe(false);
    expect(r.fx).toContainEqual({ t: 'gone', id: tree.id });
    expect(r.fx).toContainEqual({ t: 'swing' });
    expect(r.fx.some((f) => f.t === 'gain' && f.item === 'wood')).toBe(true);
    expect(countItem(s.inventory, 'wood')).toBe(0);
  });

  it('only chips a node when damage is low and gives nothing yet', () => {
    const r = applyAction(base(), hit({ damage: 0.34, wear: false }), pos);
    expect(r.session.gather.hp[tree.id]).toBeCloseTo(RESOURCES.tree.hp - 0.34);
    expect(r.fx.some((f) => f.t === 'gain')).toBe(false);
    expect(r.fx).toContainEqual({ t: 'hit', id: tree.id });
  });

  it('is deterministic for the same state', () => {
    const a = applyAction(base(), hit({ wear: false }), pos);
    const b = applyAction(base(), hit({ wear: false }), pos);
    expect(a.fx).toEqual(b.fx);
  });

  it('announces a broken tool', () => {
    let s = give(base(), ['axe_wood', 1]);
    s = { ...s, inventory: setDurability(s.inventory, 0, 1) };
    const r = applyAction(s, hit({ damage: 0.1 }), pos);
    expect(r.session.inventory[0]).toBeNull();
    expect(say(r)).toEqual([{ t: 'say', key: 'msgToolBroke', vars: { item: 'item_axe_wood' }, translate: ['item'] }]);
  });

  it('says so when the backpack is full and keeps what fits', () => {
    let s = base();
    s = { ...s, inventory: emptyInventory(1) };
    s = give(s, ['stone', 99]);
    const r = applyAction(s, hit({ wear: false, damage: 99 }), pos);
    expect(say(r).some((f) => f.t === 'say' && f.key === 'msgFull')).toBe(true);
    expect(r.session.inventory[0]).toEqual({ item: 'stone', qty: 99 });
  });
});

describe('other actions', () => {
  it('places a structure and uses up the item', () => {
    const s = give(base(), ['campfire', 2]);
    const r = applyAction(s, { kind: 'place', type: 'campfire', x: 51, y: 50 }, pos);
    expect(r.session.structures.list).toHaveLength(1);
    expect(countItem(r.session.inventory, 'campfire')).toBe(1);
    expect(r.fx[0]).toMatchObject({ t: 'built', structure: { type: 'campfire', x: 51, y: 50 } });
  });

  it('tills, plants and waters step by step', () => {
    const tile = idx(51, 50);
    let s = give(base(), ['hoe', 1], ['carrot_seed', 2], ['watering_can', 1]);
    s = applyAction(s, { kind: 'till', x: 51, y: 50, stamina: 2 }, pos).session;
    expect(plotAt(s.farm, tile)).toBeDefined();
    expect(s.vitals.stamina).toBe(98);
    s = { ...s, selected: 1 };
    s = applyAction(s, { kind: 'plant', x: 51, y: 50, crop: 'carrot' }, pos).session;
    expect(plotAt(s.farm, tile)?.crop).toBe('carrot');
    expect(countItem(s.inventory, 'carrot_seed')).toBe(1);
    s = { ...s, selected: 2, inventory: setDurability(s.inventory, 2, 3) };
    s = applyAction(s, { kind: 'water', x: 51, y: 50 }, pos).session;
    expect(plotAt(s.farm, tile)?.watered).toBe(true);
    expect(s.inventory[2]?.dur).toBe(2);
  });

  it('refills a watering can to capacity', () => {
    const s = give(base(), ['watering_can', 1]);
    const r = applyAction(s, { kind: 'refill', x: 1, y: 1 }, pos);
    expect(r.session.inventory[0]?.dur).toBe(40);
  });

  it('eats and drinks', () => {
    let s = give(base(), ['roasted_corn', 2]);
    s = { ...s, vitals: { ...s.vitals, hunger: 20, thirst: 20 } };
    const eaten = applyAction(s, { kind: 'eat', food: { hunger: 28, thirst: 0, hp: 4 } }, pos);
    expect(eaten.session.vitals.hunger).toBe(48);
    expect(countItem(eaten.session.inventory, 'roasted_corn')).toBe(1);
    const drunk = applyAction(s, { kind: 'drink', x: 1, y: 1 }, pos);
    expect(drunk.session.vitals.thirst).toBe(45);
  });

  it('harvests a ripe crop into the backpack and leaves tilled soil', () => {
    const tile = idx(51, 50);
    let farm = plant(till(emptyFarm(), tile), tile, 'corn')!;
    for (let d = 0; d < CROPS.corn.growDays; d++) farm = advanceDay(water(farm, tile));
    const r = applyAction(base({ farm }), { kind: 'harvest', x: 51, y: 50 }, pos);
    expect(countItem(r.session.inventory, 'corn')).toBeGreaterThanOrEqual(1);
    expect(plotAt(r.session.farm, tile)).toEqual({ crop: null, growth: 0, watered: false });
    expect(applyAction(base(), { kind: 'harvest', x: 51, y: 50 }, pos).fx).toEqual([]);
  });

  it('opens stations and does nothing for none', () => {
    const structures = placeStructure(emptyStructures(), 'workbench', 51, 50);
    const st = structures.list[0];
    expect(applyAction(base(), { kind: 'open', structure: st }, pos).fx).toEqual([{ t: 'open', structure: st }]);
    expect(applyAction(base(), { kind: 'none' }, pos).fx).toEqual([]);
  });

  it('turns every blocked reason into a message', () => {
    const cases: [Action, string][] = [
      [{ kind: 'blocked', reason: 'needsTool', tool: 'pickaxe', tier: 2 }, 'msgNeedsTool'],
      [{ kind: 'blocked', reason: 'tired' }, 'msgTired'],
      [{ kind: 'blocked', reason: 'saltWater' }, 'msgSaltWater'],
      [{ kind: 'blocked', reason: 'canEmpty' }, 'msgCanEmpty'],
      [{ kind: 'blocked', reason: 'chestNotEmpty' }, 'msgChestNotEmpty'],
      [{ kind: 'blocked', reason: 'cannotPlace', why: 'water' }, 'msgPlace_water'],
    ];
    for (const [action, key] of cases) {
      const fx = applyAction(base(), action, pos).fx;
      expect(fx).toHaveLength(1);
      expect(fx[0]).toMatchObject({ t: 'say', key });
    }
    expect(applyAction(base(), cases[0][0], pos).fx[0]).toMatchObject({ vars: { tool: 'tool_pickaxe', tier: 2 }, translate: ['tool'] });
  });
});

describe('taking buildings down', () => {
  it('returns the item to the backpack and removes the structure', () => {
    const structures = placeStructure(emptyStructures(), 'fence', 51, 50);
    const r = applyAction(base({ structures }), { kind: 'pickup', structure: structures.list[0] }, pos);
    expect(r.session.structures.list).toHaveLength(0);
    expect(countItem(r.session.inventory, 'fence')).toBe(1);
    expect(r.fx).toEqual([{ t: 'unbuilt', id: 1 }, { t: 'gain', item: 'fence', qty: 1 }]);
  });

  it('leaves the building standing when the backpack has no room', () => {
    const structures = placeStructure(emptyStructures(), 'workbench', 51, 50);
    const full = base({ structures, inventory: addItem(emptyInventory(1), 'stone', 99).inv });
    const r = applyAction(full, { kind: 'pickup', structure: structures.list[0] }, pos);
    expect(r.session.structures.list).toHaveLength(1);
    expect(r.fx).toEqual([{ t: 'say', key: 'msgFull', vars: undefined, translate: undefined }]);
  });
});

describe('sleeping', () => {
  const bed = placeStructure(emptyStructures(), 'bed', 51, 50).list[0];

  it('sets the respawn point by day without skipping time', () => {
    const r = applyAction(base(), { kind: 'sleep', structure: bed }, { x: 60.5, y: 61.5 });
    expect(r.session.respawn).toEqual({ x: 60.5, y: 61.5 });
    expect(r.session.clock).toEqual({ day: 1, t: 100 });
    expect(say(r)[0]).toMatchObject({ key: 'msgSleepDay' });
  });

  it('skips to dawn at night, healing and costing food and water', () => {
    const night = base({ clock: { day: 2, t: DAY_SECONDS * 0.9 }, vitals: { hp: 30, hunger: 80, thirst: 80, stamina: 10 } });
    const r = applyAction(night, { kind: 'sleep', structure: bed }, pos);
    expect(r.session.clock).toEqual({ day: 3, t: 0 });
    expect(r.session.vitals).toEqual({ hp: 70, hunger: 65, thirst: 65, stamina: 100 });
    expect(r.fx).toContainEqual({ t: 'slept' });
  });
});

describe('crafting and chests', () => {
  const plank = RECIPES.find((r) => r.id === 'plank')!;
  const none: ReadonlySet<Station> = new Set();

  it('crafts when possible and changes nothing otherwise', () => {
    const r = craftRecipe(give(base(), ['wood', 2]), plank, none);
    expect(countItem(r.session.inventory, 'plank')).toBe(2);
    expect(r.fx).toEqual([{ t: 'gain', item: 'plank', qty: 2 }]);
    const fail = base();
    expect(craftRecipe(fail, plank, none).session).toBe(fail);
  });

  const withChest = (s: Session): Session => {
    const structures = placeStructure(emptyStructures(), 'chest', 52, 50);
    return { ...s, structures: setStructureInventory(structures, 1, emptyInventory(20)) };
  };

  it('moves stacks into a chest and back', () => {
    let s = withChest(give(base(), ['wood', 30]));
    s = transferStack(s, 1, 'bag', 0).session;
    expect(countItem(s.inventory, 'wood')).toBe(0);
    expect(s.structures.list[0].inv?.[0]).toEqual({ item: 'wood', qty: 30 });
    s = transferStack(s, 1, 'chest', 0).session;
    expect(countItem(s.inventory, 'wood')).toBe(30);
    expect(s.structures.list[0].inv?.[0]).toBeNull();
  });

  it('keeps what does not fit and reports a full target', () => {
    let s = withChest(give(base(), ['wood', 99], ['axe_wood', 1]));
    s = { ...s, structures: setStructureInventory(s.structures, 1, addItem(emptyInventory(1), 'wood', 90).inv) };
    const r = transferStack(s, 1, 'bag', 0);
    expect(r.session.structures.list[0].inv?.[0]).toEqual({ item: 'wood', qty: 99 });
    expect(r.session.inventory[0]).toEqual({ item: 'wood', qty: 90 });
    const full = transferStack(r.session, 1, 'bag', 0);
    expect(full.fx).toEqual([{ t: 'say', key: 'msgFull', vars: undefined, translate: undefined }]);
    expect(full.session).toBe(r.session);
  });

  it('keeps a tool worn down when it moves', () => {
    let s = withChest(give(base(), ['axe_stone', 1]));
    s = { ...s, inventory: setDurability(s.inventory, 0, 7) };
    s = transferStack(s, 1, 'bag', 0).session;
    expect(s.structures.list[0].inv?.[0]).toEqual({ item: 'axe_stone', qty: 1, dur: 7 });
    s = transferStack(s, 1, 'chest', 0).session;
    expect(s.inventory[0]).toEqual({ item: 'axe_stone', qty: 1, dur: 7 });
  });

  it('can fill a chest that was just built by the player', () => {
    let s = give(base(), ['chest', 1], ['wood', 12]);
    s = applyAction(s, { kind: 'place', type: 'chest', x: 51, y: 50 }, pos).session;
    const wood = s.inventory.findIndex((slot) => slot?.item === 'wood');
    s = transferStack(s, 1, 'bag', wood).session;
    expect(s.structures.list[0].inv?.find(Boolean)).toEqual({ item: 'wood', qty: 12 });
    expect(countItem(s.inventory, 'wood')).toBe(0);
  });

  it('ignores empty slots and things that are not chests', () => {
    const s = withChest(base());
    expect(transferStack(s, 1, 'bag', 5).session).toBe(s);
    expect(transferStack(s, 99, 'bag', 0).session).toBe(s);
  });
});

describe('collapse and new days', () => {
  it('applies the death penalty of the difficulty', () => {
    const s = give(base(), ['wood', 10]);
    expect(countItem(collapse(s, () => 0.9).session.inventory, 'wood')).toBe(5);
    expect(collapse(s, () => 0.9).session.vitals).toEqual(RESPAWN_VITALS);
    expect(collapse({ ...s, difficulty: 'relaxed' }, () => 0.9).session.inventory).toBe(s.inventory);
    expect(collapse({ ...s, difficulty: 'hardcore' }, () => 0.9).wipeSave).toBe(true);
  });

  it('grows watered crops and regrows nodes once a day rolls over', () => {
    const tile = idx(51, 50);
    const farm = water(plant(till(emptyFarm(), tile), tile, 'carrot')!, tile);
    const gather = { hp: {}, gone: { 7: 1 } };
    const s = base({ farm, gather, clock: { day: 4, t: 0 } });
    const next = rollDay(s, () => false);
    expect(plotAt(next.farm, tile)?.growth).toBe(1);
    expect(plotAt(next.farm, tile)?.watered).toBe(false);
    expect(isAlive(next.gather, 7)).toBe(true);
    expect(isAlive(rollDay(s, (id) => id === 7).gather, 7)).toBe(false);
    expect(emptyGather()).toEqual({ hp: {}, gone: {} });
    expect(WORLD_SIZE).toBe(160);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/session.test.ts`
Expected: FAIL, "Failed to resolve import "@/sim/session"".

- [ ] **Step 3: Write the session module**

`src/sim/session.ts`:

```typescript
import { Rng, hashString } from '@/core/rng';
import type { SaveSlot } from '@/core/saveData';
import { ITEMS, type ItemId } from '@/data/items';
import type { Recipe } from '@/data/recipes';
import type { Station } from '@/data/structures';
import type { Action } from '@/sim/actions';
import { advance, canSleep, wakeUp, type Clock } from '@/sim/daynight';
import { applyDeath } from '@/sim/death';
import * as farmSim from '@/sim/farm';
import { hitNode, startNewDay, type GatherState } from '@/sim/gather';
import {
  addItem, moveSlot, setDurability, takeOne, wearTool, type Inventory, type Slot,
} from '@/sim/inventory';
import { craft } from '@/sim/crafting';
import type { Vec } from '@/sim/movement';
import { placeStructure, removeStructure, setStructureInventory, type Structure, type Structures } from '@/sim/structures';
import { eat, sleepRecovery, spendStamina, tickVitals, type Difficulty, type Vitals } from '@/sim/vitals';
import { idx, type Biome } from '@/sim/world/types';

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
  | { t: 'hit'; id: number }
  | { t: 'gone'; id: number }
  | { t: 'built'; structure: Structure }
  | { t: 'unbuilt'; id: number }
  | { t: 'plot'; tile: number }
  | { t: 'open'; structure: Structure }
  | { t: 'slept' };

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

export function selectSlot(s: Session, index: number): Session {
  return index >= 0 && index < 8 ? { ...s, selected: index } : s;
}

const say = (key: string, vars?: Record<string, string | number>, translate?: string[]): Fx => ({ t: 'say', key, vars, translate });

function giveItems(inv: Inventory, items: { item: ItemId; qty: number }[]): { inv: Inventory; fx: Fx[] } {
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
  return { inv: cur, fx };
}

function blockedFx(a: Extract<Action, { kind: 'blocked' }>): Fx[] {
  switch (a.reason) {
    case 'needsTool': return [say('msgNeedsTool', { tool: `tool_${a.tool}`, tier: a.tier }, ['tool'])];
    case 'tired': return [say('msgTired')];
    case 'saltWater': return [say('msgSaltWater')];
    case 'canEmpty': return [say('msgCanEmpty')];
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
      const fx: Fx[] = [{ t: 'swing' }, { t: 'hit', id: a.node.id }];
      if (result.destroyed) fx.push({ t: 'gone', id: a.node.id });
      if (slotBefore && !worn[s.selected]) fx.push(say('msgToolBroke', { item: `item_${slotBefore.item}` }, ['item']));
      return {
        session: { ...s, gather: result.state, inventory: given.inv, vitals: spendStamina(s.vitals, a.stamina) ?? s.vitals },
        fx: [...fx, ...given.fx],
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
      return { session: { ...s, inventory: takeOne(s.inventory, s.selected), vitals: eat(s.vitals, a.food) }, fx: [] };
    case 'harvest': {
      const tile = idx(a.x, a.y);
      const rng = new Rng(hashString(`${s.seed}:farm:${tile}:${s.clock.day}`));
      const result = farmSim.harvest(s.farm, tile, rng);
      if (!result) return { session: s, fx: [] };
      const given = giveItems(s.inventory, result.items);
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

- [ ] **Step 4: Run the test and the typecheck**

Run: `npx vitest run tests/session.test.ts && npm run typecheck`
Expected: 28 tests PASS; typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/sim/session.ts tests/session.test.ts
git commit -m "feat: add the session that applies actions, crafting, sleeping and death"
```

---

### Task 9: Icons, soil tiles and the art checks

**Files:**
- Create: `tools/make_icons.py`
- Replace: `tools/pack_tiles.py`
- Generated and committed: `public/assets/pack/icons.png`, `public/assets/pack/icons.json`, `public/assets/pack/tiles.png`, `src/data/tileIndex.ts`
- Test: `tests/assets.test.ts`

**Interfaces:**
- Produces: the `icons` atlas (35 frames of 16x16): materials, tools in three tiers, seed packets, buildable structures (`struct_*`), HUD icons (`ui_heart`, `ui_food`, `ui_drop`, `ui_bolt`) and roasted/baked foods (tinted copies of the pack's food icons); tiles `soil.dry` and `soil.wet` in `TILE_FRAMES`.

The Unity pack has only farm and food icons, so everything else is drawn by this script with plain shapes plus an automatic dark outline (the look is reviewed in Step 5).

- [ ] **Step 1: Write the art check**

`tests/assets.test.ts`:

```typescript
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CROPS } from '@/data/crops';
import { ITEMS } from '@/data/items';
import { STRUCTURES } from '@/data/structures';
import { TILE_FRAMES } from '@/data/tileIndex';

const PACK = path.resolve(__dirname, '../public/assets/pack');
const atlasFrames = (name: string): Record<string, unknown> | null => {
  const file = path.join(PACK, `${name}.json`);
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as { frames: Record<string, unknown> }).frames : null;
};
const props = atlasFrames('props');
const icons = atlasFrames('icons');
const ready = !!props && !!icons;

describe.skipIf(!ready)('packed art matches the game data', () => {
  it('has an icon for every item, in the atlas the item names', () => {
    for (const def of Object.values(ITEMS)) {
      const frames = def.icon.atlas === 'icons' ? icons! : props!;
      expect(frames[def.icon.frame], `${def.id}: ${def.icon.atlas}/${def.icon.frame}`).toBeDefined();
    }
  });

  it('has a sprite for every structure, and a matching animation for the animated ones', () => {
    for (const s of Object.values(STRUCTURES)) {
      expect(icons![s.frame], s.id).toBeDefined();
      if (!s.world) continue;
      expect(props![s.world.frame], `${s.id} world frame`).toBeDefined();
      const group = s.world.frame.slice(0, s.world.frame.lastIndexOf('/'));
      expect(s.world.anim).toBe(group.replace(/\//g, '_'));
    }
  });

  it('has every growth stage of every crop', () => {
    for (const c of Object.values(CROPS)) {
      for (let stage = 0; stage <= c.ripeStage; stage++) expect(props![`plant/${c.sheet}/${stage}`], `${c.id} stage ${stage}`).toBeDefined();
    }
  });

  it('has the HUD icons and the farm soil tiles', () => {
    for (const name of ['ui_heart', 'ui_food', 'ui_drop', 'ui_bolt']) expect(icons![name], name).toBeDefined();
    expect(TILE_FRAMES['soil.dry']).toBeTypeOf('number');
    expect(TILE_FRAMES['soil.wet']).toBeTypeOf('number');
  });
});
```

- [ ] **Step 2: Run it (it skips until the icons exist)**

Run: `npx vitest run tests/assets.test.ts`
Expected: 4 tests skipped (the `icons` atlas is missing), exit code 0.

- [ ] **Step 3: Write the icon generator and update the tile packer**

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

ROOT = Path(__file__).resolve().parent.parent
PACK = ROOT / "public" / "assets" / "pack"
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


def handle(d, x0, y0, x1, y1):
    d.line([(x0, y0), (x1, y1)], fill=WOOD, width=2)
    d.line([(x0 + 1, y0), (x1 + 1, y1)], fill=WOOD_D)


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

Replace `tools/pack_tiles.py` (adds the two farm soil tiles):

`tools/pack_tiles.py`:

```python
"""Pack the ground tiles Tidewake draws into one small sheet and write src/data/tileIndex.ts.

Raw tiles come from the read-only Unity pack (Super Retro Collection). The pack has no seamless sand/desert/dirt/swamp
ground, so those are recoloured copies of its speckled grass tiles. Nothing in the asset master is modified.
Run: python tools/pack_tiles.py
"""
from collections import Counter
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ENV = Path("E:/Pixel Games Asset Master/Assets/Gif/Super_Retro_Collection/Resources/Environments")
TILE = 16
COLS = 8

# name -> (base colour, speckle colour)
PALETTES = {
    "sand": ((240, 214, 160), (222, 192, 134)),
    "desert": ((232, 176, 104), (208, 150, 82)),
    "dirt": ((150, 110, 78), (128, 92, 62)),
    "swamp": ((70, 104, 52), (52, 82, 40)),
}


def crop(sheet: Image.Image, col: int, row: int) -> Image.Image:
    return sheet.crop((col * TILE, row * TILE, (col + 1) * TILE, (row + 1) * TILE))


def recolor(tile: Image.Image, base_to, speck_to) -> Image.Image:
    """Swap the most common colour for base_to and every other opaque colour for speck_to."""
    px = tile.load()
    counts = Counter(px[x, y] for y in range(TILE) for x in range(TILE) if px[x, y][3] > 0)
    base = counts.most_common(1)[0][0]
    out = tile.copy()
    o = out.load()
    for y in range(TILE):
        for x in range(TILE):
            if px[x, y][3] == 0:
                continue
            o[x, y] = (*(base_to if px[x, y] == base else speck_to), 255)
    return out


def tint(tile: Image.Image, mul) -> Image.Image:
    out = tile.copy()
    o = out.load()
    for y in range(TILE):
        for x in range(TILE):
            r, g, b, a = o[x, y]
            o[x, y] = (int(r * mul[0]), int(g * mul[1]), int(b * mul[2]), a)
    return out


def build_tiles(main: Image.Image, legacy: Image.Image):
    flat_grass = crop(main, 18, 30)
    speck_sources = [crop(legacy, 8, 115), crop(legacy, 7, 114), crop(legacy, 8, 114)]
    tiles = [
        ("grass.0", flat_grass),
        ("grass.1", crop(legacy, 7, 114)),
        ("grass.2", crop(legacy, 8, 114)),
        ("grass.3", crop(legacy, 7, 115)),
        ("grass.4", crop(legacy, 8, 115)),
        ("water.shallow", crop(main, 11, 37)),
        ("water.deep", tint(crop(main, 11, 37), (0.62, 0.72, 0.9))),
        ("stone.0", crop(main, 2, 36)),
    ]
    for name, (base, speck) in PALETTES.items():
        tiles.append((f"{name}.0", recolor(flat_grass, base, speck)))
        for i, src in enumerate(speck_sources, start=1):
            tiles.append((f"{name}.{i}", recolor(src, base, speck)))
    # Tilled farm soil: darker brown, darker still when watered.
    tiles.append(("soil.dry", recolor(speck_sources[0], (112, 78, 54), (92, 62, 42))))
    tiles.append(("soil.wet", recolor(speck_sources[0], (78, 54, 40), (62, 42, 32))))
    return tiles


def main() -> None:
    main_sheet = Image.open(ENV / "original_atlas.png").convert("RGBA")
    legacy_sheet = Image.open(ENV / "legacy_atlas.png").convert("RGBA")
    tiles = build_tiles(main_sheet, legacy_sheet)
    rows = (len(tiles) + COLS - 1) // COLS
    out = Image.new("RGBA", (COLS * TILE, rows * TILE), (0, 0, 0, 0))
    lines = []
    for n, (name, img) in enumerate(tiles):
        out.paste(img, ((n % COLS) * TILE, (n // COLS) * TILE))
        lines.append(f"  '{name}': {n},")
    pack = ROOT / "public" / "assets" / "pack"
    pack.mkdir(parents=True, exist_ok=True)
    out.save(pack / "tiles.png", optimize=True)
    ts = [
        "// Generated by tools/pack_tiles.py - do not edit. Frame index of each ground tile in public/assets/pack/tiles.png.",
        "export const TILE_FRAMES = {",
        *lines,
        "} as const;",
        "export type TileName = keyof typeof TILE_FRAMES;",
        "",
    ]
    (ROOT / "src" / "data" / "tileIndex.ts").write_text("\n".join(ts), encoding="utf-8")
    print(f"packed {len(tiles)} tiles into {out.width}x{out.height}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Generate the art**

```bash
python tools/make_icons.py
python tools/pack_tiles.py
```

Expected: `icons: 35 frames -> 128x80` and `packed 26 tiles into 128x64`.

- [ ] **Step 5: Look at the icons once**

Make a magnified preview and open it with the Read tool:

```bash
python -c "from PIL import Image; im=Image.open('public/assets/pack/icons.png').convert('RGBA'); bg=Image.new('RGBA',im.size,(96,104,70,255)); bg.alpha_composite(im); bg.resize((im.width*8,im.height*8),Image.NEAREST).save('tools/.cache/icons_preview.png')"
```

Expected picture: logs, stone, fibre, planks, rope, ore with orange flecks, an iron bar, a blue crystal, a coconut, four seed packets with coloured tops, axes and pickaxes in wood/stone/steel, a hoe, a watering can, a campfire, workbench, furnace, bed, chest, torch and fence, four small HUD icons and three cooked foods. If an icon looks wrong, adjust its function in `make_icons.py` and re-run Step 4.

- [ ] **Step 6: Run the art check, the whole suite and the typecheck**

Run: `npx vitest run tests/assets.test.ts && npm test && npm run typecheck`
Expected: assets 4 tests PASS (no longer skipped); the whole suite passes; typecheck exits 0.

- [ ] **Step 7: Commit (generated files included)**

```bash
git add tools/make_icons.py tools/pack_tiles.py public/assets/pack src/data/tileIndex.ts tests/assets.test.ts
git commit -m "feat: draw item and structure icons and add farm soil tiles"
```

---

### Task 10: Renderers for buildings, crops and the night

**Files:**
- Create: `src/ui/itemIcon.ts`, `src/gfx/StructureLayer.ts`, `src/gfx/FarmLayer.ts`, `src/gfx/NightLight.ts`
- Replace: `src/ui/Joystick.ts`, `src/scenes/PreloadScene.ts`

**Interfaces:**
- Consumes: `STRUCTURES`, `CROPS`, `ITEMS`, `TILE_FRAMES`, `TILES_KEY`, `stageOf`, `TILE` (earlier tasks and plan 1).
- Produces: `itemIcon(scene, x, y, item, size?)`; `new StructureLayer(scene, structures)` with `add(structure)`, `remove(id)`, `lights(structures) -> LightSource[]`; `new FarmLayer(scene, farm)` with `rebuild(farm)`, `refresh(tile, plot | undefined)`; `new NightLight(scene, camera)` with `update(dt, camera, color, alpha, lights)`: a camera-sized dark overlay with soft light shapes erased out of it. `Joystick` ignores touches in the bottom strip (the hotbar). `PreloadScene` also loads the `icons` atlas.

Rendering is verified in Task 12; this task ends at the typecheck.

- [ ] **Step 1: Write the helpers and renderers**

`src/ui/itemIcon.ts`:

```typescript
import Phaser from 'phaser';
import { ITEMS, type ItemId } from '@/data/items';

/** An item's icon as an image of `size` virtual pixels (icons are drawn on a 16x16 grid). */
export function itemIcon(scene: Phaser.Scene, x: number, y: number, item: ItemId, size = 24): Phaser.GameObjects.Image {
  const icon = ITEMS[item].icon;
  return scene.add.image(x, y, icon.atlas, icon.frame).setDisplaySize(size, size);
}
```

`src/gfx/StructureLayer.ts`:

```typescript
import Phaser from 'phaser';
import { STRUCTURES } from '@/data/structures';
import { TILE } from '@/gfx/TerrainLayer';
import type { Structure, Structures } from '@/sim/structures';

/** A light source in world pixels. */
export interface LightSource {
  x: number;
  y: number;
  radius: number;
}

/** Sprites for everything the player has built. Depth follows the base line, like trees, so the hero walks around them. */
export class StructureLayer {
  private sprites = new Map<number, Phaser.GameObjects.Image>();

  constructor(private scene: Phaser.Scene, structures: Structures) {
    for (const s of structures.list) this.add(s);
  }

  add(s: Structure): void {
    const def = STRUCTURES[s.type];
    const x = (s.x + 0.5) * TILE;
    const y = (s.y + 1) * TILE - 1;
    const obj = def.world
      ? this.scene.add.sprite(x, y, 'props', def.world.frame).play(def.world.anim)
      : this.scene.add.image(x, y, 'icons', def.frame);
    obj.setOrigin(0.5, 1).setDepth(y);
    this.sprites.set(s.id, obj);
  }

  remove(id: number): void {
    this.sprites.get(id)?.destroy();
    this.sprites.delete(id);
  }

  /** Campfires, torches and furnaces light up the night. */
  lights(structures: Structures): LightSource[] {
    return structures.list
      .filter((s) => STRUCTURES[s.type].light > 0)
      .map((s) => ({ x: (s.x + 0.5) * TILE, y: (s.y + 0.5) * TILE, radius: STRUCTURES[s.type].light * TILE }));
  }
}
```

`src/gfx/FarmLayer.ts`:

```typescript
import Phaser from 'phaser';
import { CROPS } from '@/data/crops';
import { TILE_FRAMES } from '@/data/tileIndex';
import { TILES_KEY } from '@/data/terrainTiles';
import { TILE } from '@/gfx/TerrainLayer';
import { stageOf, type Farm, type Plot } from '@/sim/farm';
import { WORLD_SIZE } from '@/sim/world/types';

/** Tilled soil (darker when watered) and the crops growing on it. */
export class FarmLayer {
  private soil = new Map<number, Phaser.GameObjects.Image>();
  private crops = new Map<number, Phaser.GameObjects.Image>();

  constructor(private scene: Phaser.Scene, farm: Farm) {
    this.rebuild(farm);
  }

  /** Redraw every plot (used after loading and when a new day changes the growth stages). */
  rebuild(farm: Farm): void {
    for (const [key, plot] of Object.entries(farm.plots)) this.refresh(Number(key), plot);
  }

  /** Redraw one tile; pass undefined when the plot is gone. */
  refresh(tile: number, plot: Plot | undefined): void {
    const x = tile % WORLD_SIZE;
    const y = Math.floor(tile / WORLD_SIZE);
    this.soil.get(tile)?.destroy();
    this.crops.get(tile)?.destroy();
    this.soil.delete(tile);
    this.crops.delete(tile);
    if (!plot) return;
    const frame = TILE_FRAMES[plot.watered ? 'soil.wet' : 'soil.dry'];
    this.soil.set(tile, this.scene.add.image(x * TILE, y * TILE, TILES_KEY, frame).setOrigin(0, 0).setDepth(-80));
    if (!plot.crop) return;
    const base = (y + 1) * TILE - 1;
    const sprite = this.scene.add.image((x + 0.5) * TILE, base, 'props', `plant/${CROPS[plot.crop].sheet}/${stageOf(plot)}`);
    this.crops.set(tile, sprite.setOrigin(0.5, 1).setDepth(base));
  }
}
```

`src/gfx/NightLight.ts`:

```typescript
import Phaser from 'phaser';
import type { LightSource } from '@/gfx/StructureLayer';

/**
 * The night: a dark overlay the size of the camera view, with soft light shapes erased out of it around campfires,
 * torches and the hero. It lives in world space but is moved to the camera every frame, so it stays a small texture
 * (about 200 x 430 world pixels) however big the island is. Linear filtering keeps the light falloff smooth.
 */
export class NightLight {
  private rt: Phaser.GameObjects.RenderTexture;
  private eraser: Phaser.GameObjects.Image;
  private time = 0;

  constructor(scene: Phaser.Scene, cam: Phaser.Cameras.Scene2D.Camera) {
    // The camera's world view is only computed on its first render, so size the overlay from its width and zoom.
    const w = Math.ceil(cam.width / cam.zoom) + 4;
    const h = Math.ceil(cam.height / cam.zoom) + 4;
    this.rt = scene.add.renderTexture(0, 0, w, h).setOrigin(0, 0).setDepth(90000);
    this.rt.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.eraser = scene.make.image({ key: 'fx_light' }, false);
  }

  /** `alpha` is the darkness (0 in daylight); `lights` are in world pixels. */
  update(dt: number, cam: Phaser.Cameras.Scene2D.Camera, color: number, alpha: number, lights: readonly LightSource[]): void {
    this.time += dt;
    this.rt.setVisible(alpha > 0.01);
    if (alpha <= 0.01) return;
    const view = cam.worldView;
    // The overlay starts a little outside the view so rounding never uncovers a pixel row at the edge.
    const ox = Math.floor(view.x) - 2;
    const oy = Math.floor(view.y) - 2;
    this.rt.setPosition(ox, oy);
    this.rt.clear();
    this.rt.fill(color, alpha);
    for (const l of lights) {
      const flicker = 1 + Math.sin(this.time * 9 + l.x) * 0.04 + Math.sin(this.time * 23 + l.y) * 0.03;
      const r = l.radius * flicker;
      if (l.x + r < view.x || l.x - r > view.right || l.y + r < view.y || l.y - r > view.bottom) continue;
      // fx_light fades to nothing at its edge, so it is drawn a little larger than the nominal radius.
      this.eraser.setScale((r * 2.6) / 128).setAlpha(1);
      this.rt.erase(this.eraser, l.x - ox, l.y - oy);
    }
  }
}
```

- [ ] **Step 2: Replace the joystick and the preloader**

The joystick no longer starts a drag in the bottom strip, where the hotbar lives:

`src/ui/Joystick.ts`:

```typescript
import Phaser from 'phaser';
import { controls } from '@/game/input';
import { view, vx, vy } from '@/core/viewport';

/** Thumb travel (virtual px) and the radii where movement starts and reaches full speed. */
const MAX = 34;
const DEAD = 4;
const FULL = 22;
/** The bottom strip belongs to the hotbar; touches there never start the stick. */
const HOTBAR_BAND = 50;

/**
 * Touch joystick for the HUD scene. In floating mode it re-centres on the first touch in the lower-left area and
 * trails the thumb when it slides past the rim, so reversing direction is instant. Writes into `controls`.
 */
export class Joystick {
  private base: Phaser.GameObjects.Image;
  private knob: Phaser.GameObjects.Image;
  private origin: { x: number; y: number };
  private home: { x: number; y: number };
  private pointerId: number | null = null;

  constructor(private scene: Phaser.Scene, private mode: () => 'floating' | 'fixed') {
    const k = view.res;
    Joystick.makeTextures(scene);
    this.home = { x: 70, y: view.h - 110 };
    this.origin = { ...this.home };
    this.base = scene.add.image(this.origin.x, this.origin.y, 'joy_base').setScale(1 / k).setAlpha(0.55).setDepth(10);
    this.knob = scene.add.image(this.origin.x, this.origin.y, 'joy_knob').setScale(1 / k).setAlpha(0.75).setDepth(11);
    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** Drawn at the render scale so the rings stay smooth on high-density screens. */
  private static makeTextures(scene: Phaser.Scene): void {
    if (scene.textures.exists('joy_base')) return;
    const k = view.res;
    const g = scene.make.graphics({}, false);
    g.fillStyle(0x0b0914, 0.45).fillCircle(40 * k, 40 * k, 38 * k);
    g.lineStyle(3 * k, 0x07060d, 0.6).strokeCircle(40 * k, 40 * k, 38 * k);
    g.lineStyle(2 * k, 0xd8d0ff, 0.45).strokeCircle(40 * k, 40 * k, 36 * k);
    g.lineStyle(1 * k, 0xd8d0ff, 0.2).strokeCircle(40 * k, 40 * k, 22 * k);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      g.fillStyle(0xd8d0ff, 0.5).fillCircle((40 + Math.cos(a) * 30) * k, (40 + Math.sin(a) * 30) * k, 1.5 * k);
    }
    g.generateTexture('joy_base', 80 * k, 80 * k);
    g.clear();
    g.fillStyle(0x000000, 0.35).fillCircle(18 * k, 20 * k, 15 * k);
    g.fillStyle(0xe8e2ff, 0.85).fillCircle(18 * k, 18 * k, 15 * k);
    g.fillStyle(0xffffff, 0.9).fillCircle(15 * k, 14 * k, 6 * k);
    g.lineStyle(2 * k, 0x5a5078, 0.9).strokeCircle(18 * k, 18 * k, 15 * k);
    g.generateTexture('joy_knob', 36 * k, 36 * k);
    g.destroy();
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.pointerId !== null) return;
    const x = vx(p);
    const y = vy(p);
    if (x > view.w * 0.6 || y < view.h * 0.35 || y > view.h - HOTBAR_BAND) return;
    // A button (or an open dialog) is under the thumb: leave the touch to it.
    if (this.scene.input.hitTestPointer(p).length > 0) return;
    this.pointerId = p.id;
    if (this.mode() === 'floating') {
      this.origin = { x, y };
      this.base.setPosition(x, y);
    }
    this.base.setAlpha(0.85);
    this.update(p);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (p.id === this.pointerId) this.update(p);
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (p.id !== this.pointerId) return;
    this.pointerId = null;
    controls.moveX = 0;
    controls.moveY = 0;
    if (this.mode() === 'floating') {
      this.origin = { ...this.home };
      this.base.setPosition(this.home.x, this.home.y);
    }
    this.knob.setPosition(this.origin.x, this.origin.y);
    this.base.setAlpha(0.55);
  }

  private update(p: Phaser.Input.Pointer): void {
    let dx = vx(p) - this.origin.x;
    let dy = vy(p) - this.origin.y;
    let d = Math.hypot(dx, dy);
    if (d > MAX && this.mode() === 'floating') {
      const pull = (d - MAX) / d;
      this.origin = { x: this.origin.x + dx * pull, y: this.origin.y + dy * pull };
      this.base.setPosition(this.origin.x, this.origin.y);
      dx -= dx * pull;
      dy -= dy * pull;
      d = MAX;
    }
    const k = d > MAX ? MAX / d : 1;
    this.knob.setPosition(this.origin.x + dx * k, this.origin.y + dy * k);
    if (d < DEAD) {
      controls.moveX = 0;
      controls.moveY = 0;
      return;
    }
    const mag = Math.min(1, (d - DEAD) / (FULL - DEAD));
    controls.moveX = (dx / d) * mag;
    controls.moveY = (dy / d) * mag;
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.onDown, this);
    this.scene.input.off('pointermove', this.onMove, this);
    this.scene.input.off('pointerup', this.onUp, this);
    this.scene.input.off('pointerupoutside', this.onUp, this);
    controls.moveX = 0;
    controls.moveY = 0;
  }
}
```

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
const ATLASES = ['heroes', 'actors', 'props', 'icons'];

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
    this.load.spritesheet(TILES_KEY, 'assets/pack/tiles.png', { frameWidth: 16, frameHeight: 16 });
  }

  create(): void {
    registerAnimations(this);
    this.scene.launch('Notify');
    void services.platform?.hideSplash();
    this.scene.start('Splash');
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck && npm test`
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/ui src/gfx src/scenes/PreloadScene.ts
git commit -m "feat: add renderers for buildings, crops and the night light"
```

---

### Task 11: Wire the game together

**Files:**
- Replace: `src/core/save.ts`, `src/scenes/GameScene.ts`, `src/scenes/HudScene.ts`, `src/scenes/index.ts`, `tests/save.test.ts`
- Create: `src/scenes/InventoryScene.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: `core/save.ts` keeps the store (`SaveStore`, `SLOT_COUNT`, `StorageLike`) and re-exports the format 2 types and functions from `saveData`. `GameScene` (`session`, `pos`, `select`, `stations`, `craft`, `moveSlot`, `transfer`, `openInventory`, `saveNow`, `quitToMenu`); `HudScene` (`openMenu`, `showDeath`); `InventoryScene` (opened with `{game, mode: 'bag' | 'craft' | 'chest', chestId?}`; pauses the island while open).

- [ ] **Step 1: Write the failing store test**

Replace `tests/save.test.ts` (store and settings tests only; the format tests live in `saveData.test.ts` since Task 7):

`tests/save.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { SLOT_COUNT, SaveStore, newSlot, type StorageLike } from '@/core/save';
import { defaultSettings, loadSettings, parseSettings, saveSettings, SETTINGS_KEY } from '@/core/settings';
import { newClock } from '@/sim/daynight';
import { addItem } from '@/sim/inventory';
import { emptyStructures, placeStructure } from '@/sim/structures';
import { till, plant, emptyFarm } from '@/sim/farm';

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
  removeItem(k: string): void {
    this.data.delete(k);
  }
}

const make = (slot = 0, name = 'Ari') => newSlot(slot, name, 4242, 'normal', { x: 77, y: 147 }, newClock(), 1000);

describe('SaveStore', () => {
  it('starts empty', () => {
    const s = new SaveStore(new MemoryStorage());
    expect(s.list()).toEqual([null, null, null]);
    expect(s.latest()).toBeNull();
    expect(s.load(0)).toBeNull();
  });

  it('round-trips a slot', () => {
    const s = new SaveStore(new MemoryStorage());
    const data = make(1);
    data.inventory = addItem(data.inventory, 'wood', 5).inv;
    data.selected = 2;
    data.vitals = { ...data.vitals, hunger: 40 };
    data.structures = placeStructure(emptyStructures(), 'campfire', 20, 30);
    data.farm = plant(till(emptyFarm(), 5 * 160 + 6), 5 * 160 + 6, 'carrot')!;
    data.gather = { hp: { 3: 2 }, gone: { 9: 4 } };
    s.write(data);
    const back = s.load(1)!;
    expect(back.name).toBe('Ari');
    expect(back.seed).toBe(4242);
    expect(back.inventory[0]).toEqual({ item: 'wood', qty: 5 });
    expect(back.selected).toBe(2);
    expect(back.vitals.hunger).toBe(40);
    expect(back.structures.list).toEqual([{ id: 1, type: 'campfire', x: 20, y: 30 }]);
    expect(back.farm.plots[5 * 160 + 6]).toEqual({ crop: 'carrot', growth: 0, watered: false });
    expect(back.gather).toEqual({ hp: { 3: 2 }, gone: { 9: 4 } });
    expect(back.player).toEqual({ x: 77.5, y: 147.5 });
  });

  it('summarizes slots and finds the latest', () => {
    const s = new SaveStore(new MemoryStorage());
    s.write(make(0, 'First'));
    const later = make(2, 'Second');
    s.write(later);
    const list = s.list();
    expect(list[0]?.name).toBe('First');
    expect(list[1]).toBeNull();
    expect(list[2]?.day).toBe(1);
    expect(s.latest()).not.toBeNull();
  });

  it('falls back to the backup when the main copy is corrupt', () => {
    const mem = new MemoryStorage();
    const s = new SaveStore(mem);
    s.write(make(0, 'Old'));
    s.write(make(0, 'New'));
    mem.setItem('tidewake.slot.0', '{not json');
    expect(s.load(0)?.name).toBe('Old');
  });

  it('returns null when both copies are corrupt', () => {
    const mem = new MemoryStorage();
    const s = new SaveStore(mem);
    s.write(make(0));
    s.write(make(0));
    mem.setItem('tidewake.slot.0', 'x');
    mem.setItem('tidewake.slot.0.bak', 'y');
    expect(s.load(0)).toBeNull();
  });

  it('deletes both the save and its backup', () => {
    const mem = new MemoryStorage();
    const s = new SaveStore(mem);
    s.write(make(0));
    s.write(make(0));
    s.delete(0);
    expect(s.load(0)).toBeNull();
    expect(mem.data.size).toBe(0);
  });

  it('rejects slot numbers outside the range', () => {
    const s = new SaveStore(new MemoryStorage());
    expect(() => s.load(SLOT_COUNT)).toThrow(RangeError);
    expect(() => s.load(-1)).toThrow(RangeError);
    expect(() => s.write(make(5))).toThrow(RangeError);
  });

  it('mirrors every write to the durable store and can restore from it', async () => {
    const mirror = new Map<string, string>();
    const a = new SaveStore(new MemoryStorage(), (k, v) => mirror.set(k, v));
    a.write(make(1, 'Mirrored'));
    expect(mirror.has('tidewake.slot.1')).toBe(true);
    const fresh = new SaveStore(new MemoryStorage());
    await fresh.restoreFromNative(async (k) => mirror.get(k) ?? null);
    expect(fresh.load(1)?.name).toBe('Mirrored');
  });

  it('offers the first empty slot for a new game, then the oldest one', () => {
    const s = new SaveStore(new MemoryStorage());
    expect(s.slotForNewGame()).toEqual({ slot: 0, overwrites: false });
    s.write(make(0));
    expect(s.slotForNewGame()).toEqual({ slot: 1, overwrites: false });
    s.write(make(1));
    s.write(make(2));
    const oldest = new SaveStore(new MemoryStorage());
    for (const slot of [2, 0, 1]) {
      const data = make(slot);
      oldest.write(data);
      const stored = JSON.parse((oldest as unknown as { storage: StorageLike }).storage.getItem(`tidewake.slot.${slot}`)!);
      stored.updatedAt = 1000 + (slot === 1 ? 0 : 500);
      (oldest as unknown as { storage: StorageLike }).storage.setItem(`tidewake.slot.${slot}`, JSON.stringify(stored));
    }
    expect(oldest.slotForNewGame()).toEqual({ slot: 1, overwrites: true });
  });

  it('works without any storage', () => {
    const s = new SaveStore(null);
    expect(() => s.write(make(0))).not.toThrow();
    expect(s.load(0)).toBeNull();
  });
});

describe('settings', () => {
  it('returns defaults when nothing is stored or the data is corrupt', () => {
    expect(loadSettings(new MemoryStorage())).toEqual(defaultSettings());
    const mem = new MemoryStorage();
    mem.setItem(SETTINGS_KEY, '{oops');
    expect(loadSettings(mem)).toEqual(defaultSettings());
  });

  it('round-trips and clamps volumes', () => {
    const mem = new MemoryStorage();
    saveSettings(mem, { ...defaultSettings(), musicVol: 0.2, lang: 'id', joystick: 'fixed' });
    expect(loadSettings(mem)).toMatchObject({ musicVol: 0.2, lang: 'id', joystick: 'fixed' });
    expect(parseSettings({ musicVol: 7, sfxVol: -2 }).musicVol).toBe(1);
    expect(parseSettings({ musicVol: 7, sfxVol: -2 }).sfxVol).toBe(0);
  });

  it('defaults to automatic quality and clamps the text scale', () => {
    expect(defaultSettings().quality).toBe('auto');
    expect(parseSettings({ quality: 'low' }).quality).toBe('low');
    expect(parseSettings({ quality: 'ultra' }).quality).toBe('auto');
    expect(parseSettings({ textScale: 5 }).textScale).toBe(1.3);
    expect(parseSettings({ textScale: 0.2 }).textScale).toBe(1);
    expect(parseSettings({ textScale: 'big' }).textScale).toBe(1);
  });

  it('ignores unknown keys and wrong types', () => {
    const s = parseSettings({ vibration: 'yes', bogus: 1, lang: 'fr' }, 'id');
    expect(s.vibration).toBe(true);
    expect(s.lang).toBe('id');
    expect('bogus' in s).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/save.test.ts`
Expected: FAIL. The store still produces format 1 slots, so the round-trip test fails on `data.inventory` (undefined).

- [ ] **Step 3: Switch the store to format 2**

`src/core/save.ts`:

```typescript
import { SAVE_VERSION, newSlot, parseSlot, type Difficulty, type SaveSlot, type SlotSummary } from './saveData';

export { SAVE_VERSION, newSlot, parseSlot };
export type { Difficulty, SaveSlot, SlotSummary };

export const SLOT_COUNT = 3;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const key = (slot: number): string => `tidewake.slot.${slot}`;
const backupKey = (slot: number): string => `${key(slot)}.bak`;

/** Three save slots on top of a localStorage-like store; every write keeps the previous copy as a backup. */
export class SaveStore {
  /** @param mirror optional durable copy (Capacitor Preferences on Android) written after every save. */
  constructor(private storage: StorageLike | null, private mirror?: (key: string, value: string) => void) {}

  private check(slot: number): void {
    if (!Number.isInteger(slot) || slot < 0 || slot >= SLOT_COUNT) throw new RangeError(`save slot ${slot} out of range`);
  }

  private read(k: string, slot: number): SaveSlot | null {
    try {
      const txt = this.storage?.getItem(k);
      return txt ? parseSlot(JSON.parse(txt), slot) : null;
    } catch {
      return null;
    }
  }

  load(slot: number): SaveSlot | null {
    this.check(slot);
    return this.read(key(slot), slot) ?? this.read(backupKey(slot), slot);
  }

  write(data: SaveSlot): void {
    this.check(data.slot);
    const txt = JSON.stringify({ ...data, updatedAt: Date.now() });
    try {
      const prev = this.storage?.getItem(key(data.slot));
      if (prev && parseSlot(JSON.parse(prev), data.slot)) this.storage?.setItem(backupKey(data.slot), prev);
      this.storage?.setItem(key(data.slot), txt);
    } catch (err) {
      console.error('[save] write failed', err);
    }
    this.mirror?.(key(data.slot), txt);
  }

  delete(slot: number): void {
    this.check(slot);
    this.storage?.removeItem(key(slot));
    this.storage?.removeItem(backupKey(slot));
  }

  list(): (SlotSummary | null)[] {
    return Array.from({ length: SLOT_COUNT }, (_, slot) => {
      const s = this.load(slot);
      return s ? { slot, name: s.name, day: s.clock.day, playTimeSec: s.playTimeSec, updatedAt: s.updatedAt, seed: s.seed, difficulty: s.difficulty } : null;
    });
  }

  /** Slot to resume: the most recently saved one, or null on a fresh install. */
  latest(): number | null {
    let best: SlotSummary | null = null;
    for (const s of this.list()) if (s && (!best || s.updatedAt > best.updatedAt)) best = s;
    return best ? best.slot : null;
  }

  /** Slot for a New Game: the first empty one, otherwise the least recently played (which it would overwrite). */
  slotForNewGame(): { slot: number; overwrites: boolean } {
    const list = this.list();
    const empty = list.findIndex((s) => s === null);
    if (empty >= 0) return { slot: empty, overwrites: false };
    let oldest = list[0]!;
    for (const s of list) if (s && s.updatedAt < oldest.updatedAt) oldest = s;
    return { slot: oldest.slot, overwrites: true };
  }

  /** Android can wipe localStorage under storage pressure; restore any slot the durable copy still has. */
  async restoreFromNative(read: (key: string) => Promise<string | null>): Promise<void> {
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      if (this.load(slot)) continue;
      try {
        const txt = await read(key(slot));
        if (txt && parseSlot(JSON.parse(txt), slot)) this.storage?.setItem(key(slot), txt);
      } catch (err) {
        console.warn('[save] native restore failed', err);
      }
    }
  }
}
```

- [ ] **Step 4: Replace the game scene and the HUD, and add the inventory screen**

The game scene keeps the hero, camera and input from phase 1 and delegates every rule to the resolver and the session. It also starts new games with the world version, drops the harvest diff of a changed generator, shows a cursor on the tile in front, runs the night light, and handles death, sleeping and new days.

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
import { NightLight } from '@/gfx/NightLight';
import { StructureLayer, type LightSource } from '@/gfx/StructureLayer';
import { TerrainLayer, TILE } from '@/gfx/TerrainLayer';
import { WorldObjects } from '@/gfx/WorldObjects';
import { controls, resetControls, takeAction } from '@/game/input';
import { frontTile, resolveAction, type Action } from '@/sim/actions';
import { lighting, newClock } from '@/sim/daynight';
import { plotAt } from '@/sim/farm';
import { emptyGather, isAlive, sanitizeGather } from '@/sim/gather';
import { nearestNode } from '@/sim/interact';
import { moveWithCollision, speedFactor, type Vec } from '@/sim/movement';
import {
  applyAction, collapse, craftRecipe, moveInventorySlot, rollDay, selectSlot, sessionFromSlot, sessionToSlot, tickSession,
  transferStack, type Fx, type Session, type Step,
} from '@/sim/session';
import { nodesByTile, propSolidTiles } from '@/sim/solids';
import { nearbyStations, structureSolids } from '@/sim/structures';
import { isDead } from '@/sim/vitals';
import { GENERATOR_VERSION, generateWorld } from '@/sim/world/generate';
import { idx, type Biome, type ResourceNode, type World } from '@/sim/world/types';
import { COLORS, FONT } from '@/ui/theme';

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

  private slotData!: SaveSlot;
  private lastDay = 1;
  private cooldown = 0;
  private idle = 99;
  private saveTimer = 0;
  private dead = false;
  private wiped = false;
  private nodes!: Map<number, ResourceNode>;
  private propTiles: number[] = [];
  private solids = new Set<number>();
  private occupied = new Set<number>();
  private objects!: WorldObjects;
  private structureLayer!: StructureLayer;
  private farmLayer!: FarmLayer;
  private night!: NightLight;
  private player!: Player;
  private cursor!: Phaser.GameObjects.Rectangle;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
  private actionKeys: Phaser.Input.Keyboard.Key[] = [];
  private digitKeys: Phaser.Input.Keyboard.Key[] = [];
  private floatRow = 0;

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
    this.cursor = this.add.rectangle(0, 0, TILE, TILE).setOrigin(0, 0).setStrokeStyle(1, 0xffffff, 0.9).setFillStyle(0xffffff, 0.12).setDepth(80000).setVisible(false);

    this.setupCamera();
    this.night = new NightLight(this, this.cameras.main);
    this.setupInput();
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

  private setupInput(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    this.cursors = kb.createCursorKeys();
    this.wasd = kb.addKeys({ w: 'W', a: 'A', s: 'S', d: 'D' }) as Record<'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
    this.actionKeys = [kb.addKey('SPACE'), kb.addKey('E')];
    this.digitKeys = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT'].map((k) => kb.addKey(k));
  }

  update(_time: number, delta: number): void {
    if (this.dead) {
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
    this.digitKeys.forEach((k, i) => {
      if (Phaser.Input.Keyboard.JustDown(k)) this.select(i);
    });

    const move = this.readMove();
    if (move.x !== 0 || move.y !== 0) {
      const speed = PLAYER_SPEED * speedFactor(this.world, this.pos.x, this.pos.y);
      this.pos = moveWithCollision(this.world, this.solids, this.pos, move.x * speed * dt, move.y * speed * dt);
    }
    this.player.update(this.pos, move);

    this.cooldown = Math.max(0, this.cooldown - dt);
    const pressed = this.consumeAction();
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

  /** Keyboard (for desktop testing) plus the touch joystick, capped at length 1. */
  private readMove(): Vec {
    let x = controls.moveX;
    let y = controls.moveY;
    if (this.cursors) {
      if (this.cursors.left.isDown || this.wasd.a.isDown) x -= 1;
      if (this.cursors.right.isDown || this.wasd.d.isDown) x += 1;
      if (this.cursors.up.isDown || this.wasd.w.isDown) y -= 1;
      if (this.cursors.down.isDown || this.wasd.s.isDown) y += 1;
    }
    const len = Math.hypot(x, y);
    return len > 1 ? { x: x / len, y: y / len } : { x, y };
  }

  private consumeAction(): boolean {
    const fromKeys = this.actionKeys.some((k) => Phaser.Input.Keyboard.JustDown(k));
    const fromHud = takeAction();
    return fromKeys || fromHud;
  }

  /** What ACTION would do right now. */
  private computeAction(): Action {
    const node = nearestNode(this.nodes, this.world.size, this.pos, HIT_REACH, (id) => isAlive(this.session.gather, id));
    const s = this.session;
    return resolveAction({
      world: this.world, inv: s.inventory, selected: s.selected, vitals: s.vitals, pos: this.pos, facing: this.player.facing,
      structures: s.structures, farm: s.farm, occupied: this.occupied, node,
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
    this.cooldown = ACTION_COOLDOWN;
    if (action.kind === 'none') return;
    if (action.kind === 'hit') this.player.face(action.node.x + 0.5 - this.pos.x, action.node.y + 0.5 - this.pos.y);
    if (action.kind !== 'blocked') this.idle = 0;
    this.commit(applyAction(this.session, action, this.pos));
    services.platform?.haptic('light');
  }

  /** Take a rule result: the new state, and the effects to show. */
  private commit(step: Step): void {
    this.session = step.session;
    this.floatRow = 0;
    for (const fx of step.fx) this.playFx(fx);
    this.rebuildBlocking();
  }

  private playFx(fx: Fx): void {
    switch (fx.t) {
      case 'say': services.notify?.(this.sayText(fx)); break;
      case 'gain': this.showGain(`+${fx.qty} ${t(`item_${fx.item}`)}`); break;
      case 'swing': this.player.punch(); break;
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

  private showGain(text: string): void {
    if (this.scene.isPaused()) {
      services.notify?.(text);
      return;
    }
    const x = this.pos.x * TILE;
    const y = this.pos.y * TILE - 26 - this.floatRow++ * 8;
    const label = this.add.bitmapText(x, y, FONT.small, text).setOrigin(0.5).setTint(COLORS.gold).setScale(0.5).setDepth(1_000_000);
    this.tweens.add({ targets: label, y: y - 14, alpha: 0, duration: 900, ease: 'Sine.easeOut', onComplete: () => label.destroy() });
  }

  /** Walk-blocking tiles (living nodes, scenery, solid structures) and tiles that cannot be built or tilled on. */
  private rebuildBlocking(): void {
    const s = this.session;
    const solids = new Set<number>(this.propTiles);
    for (const n of this.world.resources) if (isAlive(s.gather, n.id)) solids.add(idx(n.x, n.y, this.world.size));
    for (const tile of structureSolids(s.structures, this.world.size)) solids.add(tile);
    const occupied = new Set<number>(solids);
    for (const p of s.structures.list) occupied.add(idx(p.x, p.y, this.world.size));
    for (const key of Object.keys(s.farm.plots)) occupied.add(Number(key));
    this.solids = solids;
    this.occupied = occupied;
  }

  /** Nodes that were gone may grow back; the ones next to the hero wait for tomorrow. */
  private onNewDay(): void {
    const before = this.session.gather;
    this.lastDay = this.session.clock.day;
    this.session = rollDay(this.session, (id) => this.heroIsNear(id));
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
    this.commit(craftRecipe(this.session, recipe, this.stations()));
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

The HUD shows the four vital bars with icons, the day and time, the hotbar (tap to select; shows counts and tool wear), the USE, bag and pause buttons and the joystick. Opening the pause dialog now saves.

`src/scenes/HudScene.ts`:

```typescript
import Phaser from 'phaser';
import type { GameScene } from './GameScene';
import { t } from '@/core/i18n';
import { services } from '@/core/services';
import { view, vx, vy } from '@/core/viewport';
import { ITEMS } from '@/data/items';
import { controls } from '@/game/input';
import { clockLabel } from '@/sim/daynight';
import { HOTBAR_SIZE, type Inventory } from '@/sim/inventory';
import type { Difficulty } from '@/sim/vitals';
import { showModal } from '@/ui/modal';
import { itemIcon } from '@/ui/itemIcon';
import { Joystick } from '@/ui/Joystick';
import { nine } from '@/ui/skin';
import { COLORS, FONT } from '@/ui/theme';
import { Bar, Button } from '@/ui/widgets';

const SLOT = 34;
const GAP = 3;
const BAR_W = 78;
const BARS = [
  { key: 'hp', icon: 'ui_heart', color: 0xe0524f },
  { key: 'hunger', icon: 'ui_food', color: 0xff9a3c },
  { key: 'thirst', icon: 'ui_drop', color: 0x5fa8ff },
  { key: 'stamina', icon: 'ui_bolt', color: 0x6bd46b },
] as const;

/** Heads-up display on top of the island: vitals, time, hotbar, joystick and the USE, bag and pause buttons. */
export class HudScene extends Phaser.Scene {
  private world!: GameScene;
  private dayText!: Phaser.GameObjects.BitmapText;
  private bars: { bar: Bar; last: number }[] = [];
  private slotLayer!: Phaser.GameObjects.Container;
  private lastInventory: Inventory | null = null;
  private lastSelected = -1;
  private lastDay = '';
  private menuOpen = false;

  constructor() {
    super('Hud');
  }

  create(data: { game: GameScene }): void {
    this.world = data.game;
    this.menuOpen = false;
    this.lastInventory = null;
    this.lastSelected = -1;
    this.lastDay = '';
    this.bars = [];
    const { w: W, h: H } = view;
    this.dayText = this.add.bitmapText(8, 8, FONT.body, '').setTint(COLORS.text).setDepth(5);
    BARS.forEach((b, i) => {
      const y = 30 + i * 13;
      this.add.image(14, y + 4, 'icons', b.icon).setDisplaySize(12, 12).setDepth(5);
      const bar = new Bar(this, 24, y, BAR_W, 8, b.color);
      bar.setDepth(5);
      this.bars.push({ bar, last: -1 });
    });
    new Button(this, W - 24, 22, 'II', () => this.openMenu(), { w: 34, h: 28 }).setDepth(6);
    new Button(this, W - 24, 54, t('tabBag'), () => this.world.openInventory({ mode: 'bag' }), { w: 34, h: 24, font: FONT.small }).setDepth(6);
    new Button(this, W - 52, H - 100, t('useAction'), () => {
      controls.action = true;
    }, { w: 68, h: 68, style: 'primary' }).setDepth(6);
    new Joystick(this, () => services.settings?.joystick ?? 'floating');
    this.slotLayer = this.add.container(0, 0).setDepth(7);
    this.input.on('pointerdown', this.onTap, this);
  }

  private slotX(i: number): number {
    const total = HOTBAR_SIZE * SLOT + (HOTBAR_SIZE - 1) * GAP;
    return Math.round((view.w - total) / 2) + i * (SLOT + GAP);
  }

  private slotY(): number {
    return view.h - SLOT - 8;
  }

  private onTap(p: Phaser.Input.Pointer): void {
    if (this.input.hitTestPointer(p).length > 0) return;
    const x = vx(p);
    const y = vy(p);
    if (y < this.slotY() || y > this.slotY() + SLOT) return;
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      if (x >= this.slotX(i) && x <= this.slotX(i) + SLOT) {
        this.world.select(i);
        return;
      }
    }
  }

  /** Redraw the hotbar; only called when the inventory or the selection changed. */
  private drawHotbar(): void {
    this.slotLayer.removeAll(true);
    const inv = this.world.session.inventory;
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const x = this.slotX(i);
      const y = this.slotY();
      const selected = i === this.world.session.selected;
      this.slotLayer.add(nine(this, x, y, selected ? 'ui_tab_on' : 'ui_slot', SLOT, SLOT).setOrigin(0, 0));
      const slot = inv[i];
      if (!slot) continue;
      this.slotLayer.add(itemIcon(this, x + SLOT / 2, y + SLOT / 2 - 1, slot.item, 24));
      if (slot.qty > 1) {
        this.slotLayer.add(this.add.bitmapText(x + SLOT - 3, y + SLOT - 3, FONT.small, String(slot.qty)).setOrigin(1, 1).setTint(COLORS.white));
      }
      const tool = ITEMS[slot.item].tool;
      if (tool && slot.dur !== undefined) {
        const ratio = Math.min(1, slot.dur / tool.durability);
        this.slotLayer.add(this.add.rectangle(x + 4, y + SLOT - 5, SLOT - 8, 2, 0x000000, 0.6).setOrigin(0, 0));
        this.slotLayer.add(this.add.rectangle(x + 4, y + SLOT - 5, Math.round((SLOT - 8) * ratio), 2, tool.type === 'can' ? 0x5fa8ff : 0x6bd46b).setOrigin(0, 0));
      }
    }
  }

  /** Pause dialog: the island stops while it is open. Also used for the Android back button. */
  openMenu(): void {
    if (this.menuOpen || this.scene.isPaused('Game')) return;
    this.menuOpen = true;
    this.world.saveNow();
    this.scene.pause('Game');
    const finish = (): void => {
      this.menuOpen = false;
      unregister?.();
      this.scene.resume('Game');
    };
    const close = showModal(this, t('paused'), '', [
      { label: t('resume'), style: 'primary', onClick: finish },
      {
        label: t('saveQuit'),
        onClick: () => {
          finish();
          this.world.quitToMenu();
        },
      },
    ]);
    // Pressed after the dialog's own handler, so it runs first and also resumes the island.
    const unregister = services.platform?.onBack(() => {
      close();
      finish();
      return true;
    });
  }

  /** The hero collapsed. The dialog cannot be dismissed with Back; only its button continues. */
  showDeath(difficulty: Difficulty, onWake: () => void): void {
    const body = difficulty === 'hardcore' ? t('deathHardcore') : difficulty === 'normal' ? t('deathNormal') : t('deathRelaxed');
    const unregister = services.platform?.onBack(() => true);
    showModal(this, t('deathTitle'), body, [
      {
        label: difficulty === 'hardcore' ? t('deathOver') : t('deathContinue'),
        style: 'primary',
        onClick: () => {
          unregister?.();
          onWake();
        },
      },
    ]);
  }

  update(): void {
    const s = this.world.session;
    const day = `${t('hudDay', { n: s.clock.day })}  ${clockLabel(s.clock)}`;
    if (day !== this.lastDay) {
      this.lastDay = day;
      this.dayText.setText(day);
    }
    const values = [s.vitals.hp, s.vitals.hunger, s.vitals.thirst, s.vitals.stamina];
    this.bars.forEach((b, i) => {
      if (Math.abs(values[i] - b.last) < 0.5) return;
      b.last = values[i];
      b.bar.setValue(values[i] / 100, false);
    });
    if (s.inventory !== this.lastInventory || s.selected !== this.lastSelected) {
      this.lastInventory = s.inventory;
      this.lastSelected = s.selected;
      this.drawHotbar();
    }
  }
}
```

The inventory screen has a backpack tab (tap a stack, then another slot, to move or swap), a crafting tab with paging, and a chest mode where tapping a stack sends it to the other side.

`src/scenes/InventoryScene.ts`:

```typescript
import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import type { GameScene, OpenOptions } from './GameScene';
import { t } from '@/core/i18n';
import { view, vx, vy } from '@/core/viewport';
import { ITEMS } from '@/data/items';
import type { Recipe } from '@/data/recipes';
import { CHEST_SLOTS } from '@/data/structures';
import { availableRecipes, canCraft, missingFor } from '@/sim/crafting';
import { HOTBAR_SIZE, INVENTORY_SIZE, type Inventory } from '@/sim/inventory';
import { itemIcon } from '@/ui/itemIcon';
import { nine } from '@/ui/skin';
import { COLORS, FONT } from '@/ui/theme';
import { Button, label, panel } from '@/ui/widgets';

const COLS = 8;
const SLOT = 36;
const GAP = 2;
const ROWS_PER_PAGE = 5;
const ROW_H = 54;

type Tab = 'bag' | 'craft';

/** Backpack, hand/station crafting and chest storage in one screen. The island is paused while it is open. */
export class InventoryScene extends BaseScene {
  private world!: GameScene;
  private mode: OpenOptions['mode'] = 'bag';
  private chestId = 0;
  private tab: Tab = 'bag';
  private picked = -1;
  private page = 0;
  private ui!: Phaser.GameObjects.Container;

  constructor() {
    super('Inventory');
  }

  create(data: OpenOptions & { game: GameScene }): void {
    this.world = data.game;
    this.mode = data.mode;
    this.chestId = data.chestId ?? 0;
    this.tab = data.mode === 'craft' ? 'craft' : 'bag';
    this.picked = -1;
    this.page = 0;
    this.transitioning = false;
    this.ui = this.add.container(0, 0);
    this.handleBack(() => {
      this.close();
      return true;
    });
    this.input.on('pointerdown', this.onTap, this);
    this.render();
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume('Game');
  }

  private bagInv(): Inventory {
    return this.world.session.inventory;
  }

  private chestInv(): Inventory | undefined {
    return this.world.session.structures.list.find((s) => s.id === this.chestId)?.inv;
  }

  // ---- layout helpers

  private gridX(): number {
    return Math.round((view.w - (COLS * SLOT + (COLS - 1) * GAP)) / 2);
  }

  private slotPos(i: number, top: number): { x: number; y: number } {
    return { x: this.gridX() + (i % COLS) * (SLOT + GAP), y: top + Math.floor(i / COLS) * (SLOT + GAP) };
  }

  private chestTop(): number {
    return 64;
  }

  private bagTop(): number {
    return this.mode === 'chest' ? this.chestTop() + 3 * (SLOT + GAP) + 34 : 78;
  }

  private onTap(p: Phaser.Input.Pointer): void {
    if (this.tab !== 'bag') return;
    const x = vx(p);
    const y = vy(p);
    const hit = (top: number, count: number): number => {
      for (let i = 0; i < count; i++) {
        const s = this.slotPos(i, top);
        if (x >= s.x && x <= s.x + SLOT && y >= s.y && y <= s.y + SLOT) return i;
      }
      return -1;
    };
    if (this.mode === 'chest') {
      const c = hit(this.chestTop(), CHEST_SLOTS);
      if (c >= 0) {
        this.world.transfer(this.chestId, 'chest', c);
        this.render();
        return;
      }
    }
    const b = hit(this.bagTop(), INVENTORY_SIZE);
    if (b < 0) return;
    if (this.mode === 'chest') {
      this.world.transfer(this.chestId, 'bag', b);
    } else if (this.picked < 0) {
      if (this.bagInv()[b]) this.picked = b;
    } else {
      if (this.picked !== b) this.world.moveSlot(this.picked, b);
      this.picked = -1;
    }
    this.render();
  }

  // ---- drawing

  private render(): void {
    this.ui.removeAll(true);
    const { w: W, h: H } = view;
    this.ui.add(this.add.rectangle(0, 0, W, H, COLORS.bg0, 0.88).setOrigin(0, 0).setInteractive());
    this.ui.add(panel(this, 6, 6, W - 12, H - 12, 'ui_panel_dark'));
    const title = this.mode === 'chest' ? t('chestTitle') : this.tab === 'craft' ? t('craftTitle') : t('invTitle');
    this.ui.add(label(this, 16, 14, title, FONT.head, COLORS.gold));
    this.ui.add(new Button(this, W - 30, 24, 'X', () => this.close(), { w: 34, h: 26, style: 'danger' }));
    if (this.mode !== 'chest') this.drawTabs();
    if (this.tab === 'craft') this.drawCrafting();
    else this.drawBag();
  }

  private drawTabs(): void {
    const w = 62;
    this.ui.add(new Button(this, 218, 24, t('tabBag'), () => this.switchTab('bag'), { w, h: 24, font: FONT.small, style: this.tab === 'bag' ? 'primary' : 'normal' }));
    this.ui.add(new Button(this, 286, 24, t('tabCraft'), () => this.switchTab('craft'), { w, h: 24, font: FONT.small, style: this.tab === 'craft' ? 'primary' : 'normal' }));
  }

  private switchTab(tab: Tab): void {
    this.tab = tab;
    this.picked = -1;
    this.page = 0;
    this.render();
  }

  private drawGrid(inv: Inventory, count: number, top: number, mark: (i: number) => boolean): void {
    for (let i = 0; i < count; i++) {
      const { x, y } = this.slotPos(i, top);
      this.ui.add(nine(this, x, y, mark(i) ? 'ui_tab_on' : 'ui_slot', SLOT, SLOT).setOrigin(0, 0));
      const slot = inv[i];
      if (!slot) continue;
      this.ui.add(itemIcon(this, x + SLOT / 2, y + SLOT / 2 - 1, slot.item, 26));
      if (slot.qty > 1) this.ui.add(this.add.bitmapText(x + SLOT - 3, y + SLOT - 3, FONT.small, String(slot.qty)).setOrigin(1, 1).setTint(COLORS.white));
    }
  }

  private drawBag(): void {
    const inv = this.bagInv();
    if (this.mode === 'chest') {
      this.ui.add(label(this, this.gridX(), this.chestTop() - 14, t('chestTitle'), FONT.small, COLORS.textDim));
      this.drawGrid(this.chestInv() ?? [], CHEST_SLOTS, this.chestTop(), () => false);
      this.ui.add(label(this, this.gridX(), this.bagTop() - 14, t('invTitle'), FONT.small, COLORS.textDim));
    }
    const top = this.bagTop();
    this.drawGrid(inv, INVENTORY_SIZE, top, (i) => i === this.picked || (this.mode === 'bag' && i < HOTBAR_SIZE && i === this.world.session.selected));
    const infoY = top + 4 * (SLOT + GAP) + 6;
    const slot = this.picked >= 0 ? inv[this.picked] : null;
    if (this.mode === 'chest') {
      this.ui.add(label(this, this.gridX(), infoY, t('chestHint'), FONT.small, COLORS.textDim));
      return;
    }
    if (!slot) return;
    const def = ITEMS[slot.item];
    this.ui.add(label(this, this.gridX(), infoY, t(`item_${slot.item}`), FONT.body, COLORS.text));
    if (def.tool && slot.dur !== undefined) {
      this.ui.add(label(this, this.gridX(), infoY + 18, t(def.tool.type === 'can' ? 'waterLeft' : 'durability', { n: slot.dur }), FONT.small, COLORS.textDim));
    }
  }

  private costText(recipe: Recipe): string {
    return recipe.cost.map(([item, n]) => `${n} ${t(`item_${item}`)}`).join(', ');
  }

  private drawCrafting(): void {
    const near = this.world.stations();
    const list = availableRecipes(near);
    const inv = this.bagInv();
    const pages = Math.max(1, Math.ceil(list.length / ROWS_PER_PAGE));
    this.page = Math.min(this.page, pages - 1);
    const stations = ['hand', ...near].map((s) => t(`station_${s}`)).join(', ');
    this.ui.add(label(this, 16, 52, t('craftAt', { station: stations }), FONT.small, COLORS.textDim));
    if (list.length === 0) {
      this.ui.add(label(this, 16, 80, t('craftNothing'), FONT.body, COLORS.textDim));
      return;
    }
    const rows = list.slice(this.page * ROWS_PER_PAGE, (this.page + 1) * ROWS_PER_PAGE);
    rows.forEach((recipe, i) => {
      const y = 72 + i * ROW_H;
      const ok = canCraft(inv, recipe, near);
      this.ui.add(nine(this, 12, y, 'ui_panel', view.w - 24, ROW_H - 4).setOrigin(0, 0));
      this.ui.add(itemIcon(this, 32, y + 24, recipe.out, 28));
      const qty = recipe.qty > 1 ? ` x${recipe.qty}` : '';
      this.ui.add(label(this, 52, y + 6, t(`item_${recipe.out}`) + qty, FONT.body, COLORS.text));
      const missing = missingFor(inv, recipe);
      const need = missing.length ? `${t('craftNeeds')}: ${missing.map(([item, n]) => `${n} ${t(`item_${item}`)}`).join(', ')}` : this.costText(recipe);
      this.ui.add(label(this, 52, y + 26, need, FONT.small, missing.length ? 0xe0824f : COLORS.textDim));
      const btn = new Button(this, view.w - 52, y + 22, t('craftBtn'), () => {
        this.world.craft(recipe);
        this.render();
      }, { w: 60, h: 28, style: ok ? 'primary' : 'normal', disabled: !ok });
      this.ui.add(btn);
    });
    if (pages > 1) this.drawPager(pages);
  }

  private drawPager(pages: number): void {
    const y = 72 + ROWS_PER_PAGE * ROW_H + 8;
    const cx = view.w / 2;
    this.ui.add(new Button(this, cx - 80, y + 12, '<', () => this.turn(-1, pages), { w: 40, h: 26, disabled: this.page === 0 }));
    this.ui.add(label(this, cx, y + 12, t('craftPage', { n: this.page + 1, m: pages }), FONT.small, COLORS.text, 0.5, 0.5));
    this.ui.add(new Button(this, cx + 80, y + 12, '>', () => this.turn(1, pages), { w: 40, h: 26, disabled: this.page >= pages - 1 }));
  }

  private turn(delta: number, pages: number): void {
    this.page = Math.min(pages - 1, Math.max(0, this.page + delta));
    this.render();
  }
}
```

`src/scenes/index.ts`:

```typescript
import { BootScene } from './BootScene';
import { PreloadScene } from './PreloadScene';
import { SplashScene } from './SplashScene';
import { MenuScene } from './MenuScene';
import { GameScene } from './GameScene';
import { HudScene } from './HudScene';
import { InventoryScene } from './InventoryScene';
import { NotifyScene } from './NotifyScene';

export const SCENES = [BootScene, PreloadScene, SplashScene, MenuScene, GameScene, HudScene, InventoryScene, NotifyScene];
```

- [ ] **Step 5: Run the tests, the typecheck and the build**

Run: `npm test && npm run typecheck && npm run build`
Expected: every test passes (including `save.test.ts` with 14 tests), typecheck exits 0 and Vite builds.

- [ ] **Step 6: Commit**

```bash
git add src/core/save.ts src/scenes tests/save.test.ts
git commit -m "feat: wire survival into the game scene, HUD and a new inventory screen"
```

---

### Task 12: Smoke scenarios

**Files:**
- Replace: `tools/scripts/island.json`, `harvest.json`, `persist.json`, `night.json`, `pause.json`, `badsave.json`, `boot.json`, `corrupt.json`, `perf.json`
- Create: `tools/scripts/survive.json`, `build.json`, `tools.json`, `death.json`, `sleep.json`, `migrate.json`

The phase 1 scenarios that read the old `bag` or `clock` fields are updated, and six new scenarios cover the survival systems. The file list is long but each is a plain JSON list of steps for `tools/play.mjs`.

- [ ] **Step 1: Write the scenario files**

`tools/scripts/boot.json`:

`tools/scripts/boot.json`:

```json
[
  {
    "goto": "http://localhost:5188/"
  },
  {
    "until": "window.__game && __game.scene.isActive('Menu')",
    "timeout": 20000
  },
  {
    "wait": 900
  },
  {
    "shot": "menu"
  },
  {
    "eval": "JSON.stringify(window.__errs)"
  }
]
```

`tools/scripts/island.json`:

`tools/scripts/island.json`:

```json
[
  {
    "goto": "http://localhost:5188/"
  },
  {
    "eval": "localStorage.clear()"
  },
  {
    "goto": "http://localhost:5188/"
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
    "wait": 1200
  },
  {
    "shot": "island-start"
  },
  {
    "eval": "JSON.stringify(__game.scene.getScene('Game').pos)"
  },
  {
    "press": "ArrowUp",
    "ms": 1500
  },
  {
    "eval": "JSON.stringify(__game.scene.getScene('Game').pos)"
  },
  {
    "shot": "island-walked"
  },
  {
    "press": "ArrowDown",
    "ms": 4000
  },
  {
    "eval": "(() => { const g = __game.scene.getScene('Game'); const w = g.world; return 'tile under hero = ' + w.terrain[Math.floor(g.pos.y) * w.size + Math.floor(g.pos.x)] + ' (0 would mean deep water: a bug)'; })()"
  },
  {
    "shot": "island-shore"
  },
  {
    "eval": "JSON.stringify(window.__errs)"
  }
]
```

`tools/scripts/harvest.json` (now gives the hero an axe first):

`tools/scripts/harvest.json`:

```json
[
 {
  "goto": "http://localhost:5188/"
 },
 {
  "eval": "localStorage.clear()"
 },
 {
  "goto": "http://localhost:5188/"
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
  "eval": "(() => { const g = __game.scene.getScene('Game'); const inv = g.session.inventory.slice(); inv[0] = {'item': 'axe_wood', 'qty': 1, 'dur': 40}; g.session = {...g.session, inventory: inv}; return 'given'; })()"
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); const w = g.world; const S = w.size; const occ = new Set(w.resources.map(r => r.y * S + r.x)); const n = w.resources.find(r => r.kind === 'tree' && w.terrain[(r.y + 1) * S + r.x] === 3 && !occ.has((r.y + 1) * S + r.x)); g.pos = { x: n.x + 0.5, y: n.y + 1.5 }; return JSON.stringify(n); })()"
 },
 {
  "wait": 600
 },
 {
  "shot": "before-hit"
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 450
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 450
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 450
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 450
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 450
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 450
 },
 {
  "eval": "JSON.stringify({wood: __game.scene.getScene('Game').session.inventory.filter(s => s && s.item === 'wood').reduce((a, s) => a + s.qty, 0), axeDur: __game.scene.getScene('Game').session.inventory[0].dur})"
 },
 {
  "shot": "after-hits"
 },
 {
  "eval": "JSON.stringify(window.__errs)"
 }
]
```

`tools/scripts/persist.json` (also checks buildings and the selected slot):

`tools/scripts/persist.json`:

```json
[
 {
  "goto": "http://localhost:5188/"
 },
 {
  "eval": "localStorage.clear()"
 },
 {
  "goto": "http://localhost:5188/"
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
  "eval": "(() => { const g = __game.scene.getScene('Game'); const inv = g.session.inventory.slice(); inv[0] = {'item': 'axe_wood', 'qty': 1, 'dur': 40}; inv[1] = {'item': 'campfire', 'qty': 1}; inv[2] = {'item': 'hoe', 'qty': 1, 'dur': 60}; g.session = {...g.session, inventory: inv}; return 'given'; })()"
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); const w = g.world; const S = w.size; const occ = new Set(w.resources.map(r => r.y * S + r.x)); const n = w.resources.find(r => r.kind === 'tree' && w.terrain[(r.y + 1) * S + r.x] === 3 && !occ.has((r.y + 1) * S + r.x)); g.pos = { x: n.x + 0.5, y: n.y + 1.5 }; return JSON.stringify(n); })()"
 },
 {
  "wait": 400
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 450
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 450
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 450
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 450
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 450
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 450
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 450
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 450
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 450
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 450
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 450
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 450
 },
 {
  "eval": "__game.scene.getScene('Game').select(1)"
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 500
 },
 {
  "eval": "__game.scene.getScene('Game').select(2)"
 },
 {
  "press": "ArrowRight",
  "ms": 300
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 500
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); const s = g.session; return JSON.stringify({ pos: g.pos, wood: __game.scene.getScene('Game').session.inventory.filter(s => s && s.item === 'wood').reduce((a, s) => a + s.qty, 0), gone: Object.keys(s.gather.gone).length, day: s.clock.day, inv: s.inventory.filter(Boolean).length, structures: s.structures.list.length, plots: Object.keys(s.farm.plots).length, selected: s.selected }); })()"
 },
 {
  "eval": "__game.scene.getScene('Game').saveNow()"
 },
 {
  "goto": "http://localhost:5188/"
 },
 {
  "until": "window.__game && __game.scene.isActive('Menu')",
  "timeout": 20000
 },
 {
  "wait": 800
 },
 {
  "shot": "menu-with-continue"
 },
 {
  "eval": "__game.scene.getScene('Menu').goTo('Game', {slot: 0})"
 },
 {
  "until": "__game.scene.isActive('Game') && __game.scene.isActive('Hud')",
  "timeout": 20000
 },
 {
  "wait": 800
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); const s = g.session; return JSON.stringify({ pos: g.pos, wood: __game.scene.getScene('Game').session.inventory.filter(s => s && s.item === 'wood').reduce((a, s) => a + s.qty, 0), gone: Object.keys(s.gather.gone).length, day: s.clock.day, inv: s.inventory.filter(Boolean).length, structures: s.structures.list.length, plots: Object.keys(s.farm.plots).length, selected: s.selected }); })()"
 },
 {
  "shot": "continued"
 },
 {
  "eval": "JSON.stringify(window.__errs)"
 }
]
```

`tools/scripts/night.json`:

`tools/scripts/night.json`:

```json
[
 {
  "goto": "http://localhost:5188/"
 },
 {
  "eval": "localStorage.clear()"
 },
 {
  "goto": "http://localhost:5188/"
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
  "eval": "__game.scene.getScene('Game').session = {...__game.scene.getScene('Game').session, clock: {day: 1, t: 540}}; 'dusk set'"
 },
 {
  "wait": 400
 },
 {
  "shot": "dusk"
 },
 {
  "eval": "__game.scene.getScene('Game').session = {...__game.scene.getScene('Game').session, clock: {day: 1, t: 600 * 0.9}}; 'night set'"
 },
 {
  "wait": 400
 },
 {
  "shot": "night"
 },
 {
  "eval": "__game.scene.getScene('Game').session = {...__game.scene.getScene('Game').session, clock: {day: 1, t: 599.9}}; 'late set'"
 },
 {
  "wait": 700
 },
 {
  "shot": "new-day"
 },
 {
  "eval": "JSON.stringify(__game.scene.getScene('Game').session.clock)"
 },
 {
  "eval": "JSON.stringify(window.__errs)"
 }
]
```

`tools/scripts/pause.json`:

`tools/scripts/pause.json`:

```json
[
 {
  "goto": "http://localhost:5188/"
 },
 {
  "eval": "localStorage.clear()"
 },
 {
  "goto": "http://localhost:5188/"
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
  "eval": "__game.scene.getScene('Hud').openMenu()"
 },
 {
  "wait": 300
 },
 {
  "eval": "JSON.stringify(__game.scene.getScene('Game').session.clock)"
 },
 {
  "wait": 1500
 },
 {
  "eval": "JSON.stringify(__game.scene.getScene('Game').session.clock)"
 },
 {
  "eval": "'Game paused: ' + __game.scene.isPaused('Game')"
 },
 {
  "shot": "pause-menu"
 },
 {
  "eval": "JSON.stringify(window.__errs)"
 }
]
```

`tools/scripts/corrupt.json`:

`tools/scripts/corrupt.json`:

```json
[
  {
    "goto": "http://localhost:5188/"
  },
  {
    "eval": "localStorage.clear(); localStorage.setItem('tidewake.slot.0', '{broken'); localStorage.setItem('tidewake.slot.0.bak', 'nope')"
  },
  {
    "goto": "http://localhost:5188/"
  },
  {
    "until": "window.__game && __game.scene.isActive('Menu')",
    "timeout": 20000
  },
  {
    "wait": 800
  },
  {
    "shot": "menu-corrupt"
  },
  {
    "eval": "__game.scene.getScene('Menu').goTo('Game', {slot: 0})"
  },
  {
    "wait": 1500
  },
  {
    "eval": "'Back at menu: ' + __game.scene.isActive('Menu') + ', game running: ' + __game.scene.isActive('Game')"
  },
  {
    "eval": "JSON.stringify(window.__errs)"
  }
]
```

`tools/scripts/badsave.json`:

`tools/scripts/badsave.json`:

```json
[
 {
  "goto": "http://localhost:5188/"
 },
 {
  "eval": "localStorage.clear()"
 },
 {
  "goto": "http://localhost:5188/"
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
  "eval": "__game.scene.getScene('Game').quitToMenu()"
 },
 {
  "until": "__game.scene.isActive('Menu')",
  "timeout": 20000
 },
 {
  "eval": "(() => { const k = 'tidewake.slot.0'; const s = JSON.parse(localStorage.getItem(k)); s.gather = { hp: { '-3': 1 }, gone: { '99999': 1, 'abc': 1 } }; s.clock = { day: 5, t: 599 }; localStorage.setItem(k, JSON.stringify(s)); localStorage.removeItem(k + '.bak'); return 'edited'; })()"
 },
 {
  "goto": "http://localhost:5188/"
 },
 {
  "until": "window.__game && __game.scene.isActive('Menu')",
  "timeout": 20000
 },
 {
  "eval": "__game.scene.getScene('Menu').goTo('Game', {slot: 0})"
 },
 {
  "until": "__game.scene.isActive('Game') && __game.scene.isActive('Hud')",
  "timeout": 20000
 },
 {
  "wait": 2500
 },
 {
  "eval": "'day now: ' + __game.scene.getScene('Game').session.clock.day + ' (expected 6)'"
 },
 {
  "shot": "badsave-after-rollover"
 },
 {
  "eval": "JSON.stringify(window.__errs)"
 }
]
```

`tools/scripts/perf.json`:

`tools/scripts/perf.json`:

```json
[
  {"goto": "http://localhost:5188/"},
  {"eval": "localStorage.clear()"},
  {"goto": "http://localhost:5188/"},
  {"until": "window.__game && __game.scene.isActive('Menu')", "timeout": 20000},
  {"eval": "window.__t0 = performance.now(); __game.scene.getScene('Menu').goTo('Game', {slot: 0, seed: 777})"},
  {"until": "__game.scene.isActive('Game') && __game.scene.isActive('Hud')", "timeout": 20000},
  {"eval": "'ms from tap to Game: ' + Math.round(performance.now() - window.__t0)"},
  {"wait": 3000},
  {"press": "ArrowUp", "ms": 3000},
  {"eval": "'fps: ' + Math.round(__game.loop.actualFps)"},
  {"profile": 3000, "top": 12}
]
```

`tools/scripts/survive.json` (farm, camp, night light, backpack, crafting and a chest in one run):

`tools/scripts/survive.json`:

```json
[
 {
  "goto": "http://localhost:5188/"
 },
 {
  "eval": "localStorage.clear()"
 },
 {
  "goto": "http://localhost:5188/"
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
  "eval": "(() => { const g = __game.scene.getScene('Game'); const inv = g.session.inventory.slice();\ninv[0]={item:'axe_wood',qty:1,dur:40}; inv[1]={item:'hoe',qty:1,dur:60}; inv[2]={item:'carrot_seed',qty:5}; inv[3]={item:'watering_can',qty:1,dur:40};\ninv[4]={item:'campfire',qty:2}; inv[5]={item:'chest',qty:1}; inv[6]={item:'bed',qty:1}; inv[7]={item:'torch',qty:5};\ninv[8]={item:'wood',qty:20}; inv[9]={item:'fiber',qty:10}; inv[10]={item:'stone',qty:10}; inv[11]={item:'carrot',qty:3};\ng.session = {...g.session, inventory: inv}; return 'items ok'; })()"
 },
 {
  "wait": 300
 },
 {
  "shot": "hud-items"
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); const w = g.world; const S = w.size; const c = w.landmarks.find(l => l.id === 'camp');\nfor (let r = 0; r < 14; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = c.x + dx, y = c.y + dy; const i = y * S + x, a = (y - 1) * S + x;\nif (w.terrain[i] === 3 && w.terrain[a] === 3 && !g.occupied.has(i) && !g.occupied.has(a)) { g.pos = { x: x + 0.5, y: y - 0.5 }; return 'front tile ' + x + ',' + y; } } return 'no grass'; })()"
 },
 {
  "wait": 300
 },
 {
  "eval": "__game.scene.getScene('Game').select(1)"
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 500
 },
 {
  "eval": "__game.scene.getScene('Game').select(2)"
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 500
 },
 {
  "eval": "__game.scene.getScene('Game').select(3)"
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 500
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); return JSON.stringify({ plots: Object.keys(g.session.farm.plots).length, planted: Object.values(g.session.farm.plots).filter(p => p.crop).length, wet: Object.values(g.session.farm.plots).filter(p => p.watered).length, structures: g.session.structures.list.map(s => s.type), seeds: (g.session.inventory[2] || {}).qty }); })()"
 },
 {
  "shot": "farm"
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); g.pos = { x: g.pos.x + (3), y: g.pos.y }; return JSON.stringify(g.pos); })()"
 },
 {
  "eval": "__game.scene.getScene('Game').select(4)"
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 500
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); g.pos = { x: g.pos.x + (2), y: g.pos.y }; return JSON.stringify(g.pos); })()"
 },
 {
  "eval": "__game.scene.getScene('Game').select(5)"
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 500
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); return JSON.stringify({ plots: Object.keys(g.session.farm.plots).length, planted: Object.values(g.session.farm.plots).filter(p => p.crop).length, wet: Object.values(g.session.farm.plots).filter(p => p.watered).length, structures: g.session.structures.list.map(s => s.type), seeds: (g.session.inventory[2] || {}).qty }); })()"
 },
 {
  "wait": 300
 },
 {
  "shot": "camp-built"
 },
 {
  "eval": "__game.scene.getScene('Game').session = {...__game.scene.getScene('Game').session, clock: {day: 1, t: 540}}; 'dusk set'"
 },
 {
  "wait": 600
 },
 {
  "shot": "dusk-camp"
 },
 {
  "eval": "__game.scene.getScene('Game').session = {...__game.scene.getScene('Game').session, clock: {day: 1, t: 570}}; 'night set'"
 },
 {
  "wait": 600
 },
 {
  "shot": "night-camp"
 },
 {
  "eval": "__game.scene.getScene('Game').openInventory({mode: 'bag'})"
 },
 {
  "wait": 500
 },
 {
  "shot": "bag"
 },
 {
  "tap": [
   286,
   24
  ]
 },
 {
  "wait": 400
 },
 {
  "shot": "craft-hand"
 },
 {
  "tap": [
   338,
   94
  ]
 },
 {
  "wait": 300
 },
 {
  "eval": "JSON.stringify({wood: __game.scene.getScene('Game').session.inventory.filter(s => s && s.item === 'wood').reduce((a, s) => a + s.qty, 0), plank: __game.scene.getScene('Game').session.inventory.filter(s => s && s.item === 'plank').reduce((a, s) => a + s.qty, 0)})"
 },
 {
  "shot": "crafted"
 },
 {
  "tap": [
   343,
   24
  ]
 },
 {
  "wait": 400
 },
 {
  "eval": "'game paused after closing: ' + __game.scene.isPaused('Game')"
 },
 {
  "eval": "(() => { const c = __game.scene.getScene('Game').session.structures.list.find(s => s.type === 'chest'); __game.scene.getScene('Game').openInventory({mode: 'chest', chestId: c.id}); return 'chest ' + c.id; })()"
 },
 {
  "wait": 400
 },
 {
  "tap": [
   62,
   268
  ]
 },
 {
  "wait": 300
 },
 {
  "eval": "JSON.stringify({chestHolds: __game.scene.getScene('Game').session.structures.list.find(s => s.type === 'chest').inv.filter(Boolean).map(s => s.item + ' x' + s.qty)})"
 },
 {
  "shot": "chest"
 },
 {
  "eval": "JSON.stringify(window.__errs)"
 }
]
```

`tools/scripts/build.json` (place and take down a fence; dismantle a workbench with an axe):

`tools/scripts/build.json`:

```json
[
 {
  "goto": "http://localhost:5188/"
 },
 {
  "eval": "localStorage.clear()"
 },
 {
  "goto": "http://localhost:5188/"
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
  "eval": "(() => { const g = __game.scene.getScene('Game'); const inv = g.session.inventory.slice(); inv[0] = {item:'axe_wood',qty:1,dur:40}; inv[1] = {item:'fence',qty:3}; inv[2] = {item:'workbench',qty:1}; g.session = {...g.session, inventory: inv}; return 'given'; })()"
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); const w = g.world; const S = w.size; const c = w.landmarks.find(l => l.id === 'camp');\nfor (let r = 0; r < 14; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = c.x + dx, y = c.y + dy; const i = y * S + x, a = (y - 1) * S + x;\nif (w.terrain[i] === 3 && w.terrain[a] === 3 && !g.occupied.has(i) && !g.occupied.has(a)) { g.pos = { x: x + 0.5, y: y - 0.5 }; return 'front tile ' + x + ',' + y; } } return 'no grass'; })()"
 },
 {
  "wait": 300
 },
 {
  "eval": "__game.scene.getScene('Game').select(1)"
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 500
 },
 {
  "eval": "'after placing a fence: structures=' + __game.scene.getScene('Game').session.structures.list.map(s => s.type).join(',') + ' fence=' + __game.scene.getScene('Game').session.inventory.filter(s => s && s.item === 'fence').reduce((a, s) => a + s.qty, 0) + ' workbench=' + __game.scene.getScene('Game').session.inventory.filter(s => s && s.item === 'workbench').reduce((a, s) => a + s.qty, 0)"
 },
 {
  "shot": "fence-placed"
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 500
 },
 {
  "eval": "'after pressing again (fence taken back): structures=' + __game.scene.getScene('Game').session.structures.list.map(s => s.type).join(',') + ' fence=' + __game.scene.getScene('Game').session.inventory.filter(s => s && s.item === 'fence').reduce((a, s) => a + s.qty, 0) + ' workbench=' + __game.scene.getScene('Game').session.inventory.filter(s => s && s.item === 'workbench').reduce((a, s) => a + s.qty, 0)"
 },
 {
  "eval": "__game.scene.getScene('Game').select(2)"
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 500
 },
 {
  "eval": "'after placing a workbench: structures=' + __game.scene.getScene('Game').session.structures.list.map(s => s.type).join(',') + ' fence=' + __game.scene.getScene('Game').session.inventory.filter(s => s && s.item === 'fence').reduce((a, s) => a + s.qty, 0) + ' workbench=' + __game.scene.getScene('Game').session.inventory.filter(s => s && s.item === 'workbench').reduce((a, s) => a + s.qty, 0)"
 },
 {
  "eval": "__game.scene.getScene('Game').select(1)"
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 500
 },
 {
  "eval": "'fence in hand next to a workbench (pressing ACTION opens the workbench instead): structures=' + __game.scene.getScene('Game').session.structures.list.map(s => s.type).join(',') + ' fence=' + __game.scene.getScene('Game').session.inventory.filter(s => s && s.item === 'fence').reduce((a, s) => a + s.qty, 0) + ' workbench=' + __game.scene.getScene('Game').session.inventory.filter(s => s && s.item === 'workbench').reduce((a, s) => a + s.qty, 0)"
 },
 {
  "eval": "'crafting screen open, game paused: ' + __game.scene.isPaused('Game')"
 },
 {
  "tap": [
   360,
   24
  ]
 },
 {
  "wait": 400
 },
 {
  "eval": "'after closing, game paused: ' + __game.scene.isPaused('Game')"
 },
 {
  "eval": "__game.scene.getScene('Game').select(0)"
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 500
 },
 {
  "eval": "'axe in hand (workbench dismantled): structures=' + __game.scene.getScene('Game').session.structures.list.map(s => s.type).join(',') + ' fence=' + __game.scene.getScene('Game').session.inventory.filter(s => s && s.item === 'fence').reduce((a, s) => a + s.qty, 0) + ' workbench=' + __game.scene.getScene('Game').session.inventory.filter(s => s && s.item === 'workbench').reduce((a, s) => a + s.qty, 0)"
 },
 {
  "eval": "JSON.stringify(window.__errs)"
 }
]
```

`tools/scripts/tools.json` (bare hands against a tree and against ore):

`tools/scripts/tools.json`:

```json
[
 {
  "goto": "http://localhost:5188/"
 },
 {
  "eval": "localStorage.clear()"
 },
 {
  "goto": "http://localhost:5188/"
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
  "eval": "(() => { const g = __game.scene.getScene('Game'); const w = g.world; const S = w.size; const occ = new Set(w.resources.map(r => r.y * S + r.x)); const n = w.resources.find(r => r.kind === 'tree' && w.terrain[(r.y + 1) * S + r.x] === 3 && !occ.has((r.y + 1) * S + r.x)); g.pos = { x: n.x + 0.5, y: n.y + 1.5 }; return JSON.stringify(n); })()"
 },
 {
  "wait": 500
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 420
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 420
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 420
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 420
 },
 {
  "eval": "'bare hands, 4 swings: wood=' + __game.scene.getScene('Game').session.inventory.filter(s => s && s.item === 'wood').reduce((a, s) => a + s.qty, 0) + ' (tree needs ~15 hand hits)'"
 },
 {
  "eval": "(() => { const g = __game.scene.getScene('Game'); const w = g.world; const o = w.resources.find(r => r.kind === 'ore'); g.pos = { x: o.x + 0.5, y: o.y + 1.5 }; g.session = {...g.session, selected: 0}; return JSON.stringify(o); })()"
 },
 {
  "wait": 500
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 600
 },
 {
  "shot": "needs-pickaxe"
 },
 {
  "eval": "JSON.stringify(window.__errs)"
 }
]
```

`tools/scripts/death.json`:

`tools/scripts/death.json`:

```json
[
 {
  "goto": "http://localhost:5188/"
 },
 {
  "eval": "localStorage.clear()"
 },
 {
  "goto": "http://localhost:5188/"
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
  "eval": "(() => { const g = __game.scene.getScene('Game'); const inv = g.session.inventory.slice(); inv[0] = {'item': 'stone', 'qty': 10}; inv[1] = {'item': 'wood', 'qty': 10}; g.session = {...g.session, inventory: inv}; return 'given'; })()"
 },
 {
  "eval": "__game.scene.getScene('Game').session = {...__game.scene.getScene('Game').session, vitals: {hp: 0.3, hunger: 0, thirst: 0, stamina: 100}}; 'dying'"
 },
 {
  "wait": 1500
 },
 {
  "shot": "collapsed"
 },
 {
  "eval": "'dead flag: ' + __game.scene.getScene('Game').dead"
 },
 {
  "eval": "__game.scene.getScene('Game').wakeUp(); JSON.stringify({vitals: __game.scene.getScene('Game').session.vitals, stone: __game.scene.getScene('Game').session.inventory.filter(s => s && s.item === 'stone').reduce((a, s) => a + s.qty, 0), wood: __game.scene.getScene('Game').session.inventory.filter(s => s && s.item === 'wood').reduce((a, s) => a + s.qty, 0), pos: __game.scene.getScene('Game').pos})"
 },
 {
  "wait": 500
 },
 {
  "shot": "woke-up"
 },
 {
  "eval": "JSON.stringify(window.__errs)"
 }
]
```

`tools/scripts/sleep.json`:

`tools/scripts/sleep.json`:

```json
[
 {
  "goto": "http://localhost:5188/"
 },
 {
  "eval": "localStorage.clear()"
 },
 {
  "goto": "http://localhost:5188/"
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
  "eval": "(() => { const g = __game.scene.getScene('Game'); const inv = g.session.inventory.slice(); inv[0] = {'item': 'bed', 'qty': 1}; g.session = {...g.session, inventory: inv}; return 'given'; })()"
 },
 {
  "eval": "__game.scene.getScene('Game').session = {...__game.scene.getScene('Game').session, clock: {day: 1, t: 600 * 0.9}, vitals: {hp: 40, hunger: 80, thirst: 80, stamina: 20}}; 'night set'"
 },
 {
  "wait": 300
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 600
 },
 {
  "eval": "JSON.stringify({structures: __game.scene.getScene('Game').session.structures.list.length})"
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 1200
 },
 {
  "eval": "JSON.stringify({clock: __game.scene.getScene('Game').session.clock, vitals: __game.scene.getScene('Game').session.vitals})"
 },
 {
  "shot": "after-sleep"
 },
 {
  "eval": "JSON.stringify(window.__errs)"
 }
]
```

`tools/scripts/migrate.json` (a phase 1 save upgrades):

`tools/scripts/migrate.json`:

```json
[
 {
  "goto": "http://localhost:5188/"
 },
 {
  "eval": "localStorage.clear(); localStorage.setItem('tidewake.slot.0', \"{\\\"version\\\": 1, \\\"slot\\\": 0, \\\"name\\\": \\\"Old Ari\\\", \\\"seed\\\": 1234, \\\"difficulty\\\": \\\"normal\\\", \\\"createdAt\\\": 1, \\\"updatedAt\\\": 2, \\\"playTimeSec\\\": 300, \\\"player\\\": {\\\"x\\\": 80.5, \\\"y\\\": 143.5}, \\\"bag\\\": {\\\"wood\\\": 7, \\\"stone\\\": 3}, \\\"clock\\\": {\\\"day\\\": 2, \\\"t\\\": 50}, \\\"gather\\\": {\\\"hp\\\": {}, \\\"gone\\\": {}}}\"); 'v1 save written'"
 },
 {
  "goto": "http://localhost:5188/"
 },
 {
  "until": "window.__game && __game.scene.isActive('Menu')",
  "timeout": 20000
 },
 {
  "eval": "__game.scene.getScene('Menu').goTo('Game', {slot: 0})"
 },
 {
  "until": "__game.scene.isActive('Game') && __game.scene.isActive('Hud')",
  "timeout": 20000
 },
 {
  "wait": 800
 },
 {
  "eval": "JSON.stringify({wood: __game.scene.getScene('Game').session.inventory.filter(s => s && s.item === 'wood').reduce((a, s) => a + s.qty, 0), stone: __game.scene.getScene('Game').session.inventory.filter(s => s && s.item === 'stone').reduce((a, s) => a + s.qty, 0), day: __game.scene.getScene('Game').session.clock.day, hp: __game.scene.getScene('Game').session.vitals.hp})"
 },
 {
  "shot": "migrated"
 },
 {
  "eval": "JSON.stringify(window.__errs)"
 }
]
```

- [ ] **Step 2: Start the dev server and run every scenario**

In one terminal: `npm run dev` (port 5188). In another:

```bash
for s in boot island harvest persist night pause corrupt badsave survive build tools death sleep migrate; do echo "=== $s"; node tools/play.mjs tools/scripts/$s.json tools/.cache/shots 2>&1 | grep -v "^shot "; done
```

- [ ] **Step 3: Check each result**

Every scenario must end with `page errors: []` and no `[http ...]`, `[console.error]` or `[step ...]` lines. In addition:

| Scenario | Expected printed values |
|---|---|
| `boot` | `eval -> []` |
| `island` | the second position has a smaller `y` than the first; `tile under hero = 1` (never `0`) |
| `harvest` | `{"wood":N,"axeDur":D}` with `N >= 2` and `D < 40` |
| `persist` | the two state lines are identical (`structures:1`, `selected:2`, same `pos`, `wood`, `gone`, `day`) |
| `night` | the last clock is `{"day":2,"t":<small>}` |
| `pause` | the two clock lines are identical and `Game paused: true` |
| `corrupt` | `Back at menu: true, game running: false` |
| `badsave` | `day now: 6 (expected 6)` |
| `survive` | `plots:1, planted:1, wet:1`; later `structures:["campfire","chest"]`; `{"wood":18,"plank":2}` after crafting; `game paused after closing: false`; `{"chestHolds":["wood x18"]}` |
| `build` | `fence=2` after placing, `fence=3` after pressing again, `workbench=0` after placing it, `crafting screen open, game paused: true`, then `game paused: false` and finally `structures=` empty with `workbench=1` |
| `tools` | `wood=0` after four bare-hand swings; the last screenshot shows the toast `You need a better pickaxe (tier 2)` |
| `death` | `dead flag: true`, then vitals `hp 60, hunger 60, thirst 60`, `stone 5`, `wood 5` and the position equal to the respawn point |
| `sleep` | `structures:1`, then `clock.day 2` with `t` near `1`, `hp` near `80` |
| `migrate` | `{"wood":7,"stone":3,"day":2,"hp":100}` |

Open these screenshots with the Read tool and check them: `hud-items.png` (four coloured vital bars with icons at the top left, a hotbar of eight slots at the bottom with counts and thin wear bars under the tools), `farm.png` (a dark soil tile with a seedling in front of the hero), `night-camp.png` (a dark world with a warm pool of light around the campfire and the hero), `bag.png`, `craft-hand.png` (rows with icon, name, cost and a Craft button; the Bag/Craft tabs do not overlap the title), `chest.png` (a chest grid above the backpack grid), `collapsed.png` (the dialog `You collapsed` with a `Wake up` button over a dimmed world).

If something differs, fix its cause in the file that owns it, re-run the typecheck, tests and that scenario only. Typical culprits: a night overlay that stays invisible (size the overlay from `camera.width / camera.zoom`, see `NightLight`), a hotbar tap that moves the joystick (the bottom strip rule in `Joystick`), or a missing frame name (the art tests list it).

- [ ] **Step 4: Commit**

```bash
git add tools/scripts
git commit -m "test: add smoke scenarios for survival, building, farming, death and sleep"
```

---

### Task 13: Phase gate

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Coverage, build and the secret scan**

```bash
npm run test:cov
npm run build
grep -rnE "(sk_[a-f0-9]{16}|r8_[A-Za-z0-9]{20}|msy_[A-Za-z0-9]{20})" src tools docs README.md package.json || echo "no secrets found"
```

Expected: all tests pass and `All files` stays at or above 80% lines (about 98%); the build succeeds; `no secrets found`.

- [ ] **Step 2: Performance with the night light on**

Run: `node tools/play.mjs tools/scripts/perf.json tools/.cache/shots`
Expected: tap-to-Game under 2500 ms and `fps` at or above 55 (in the reference run: about 560 ms and 59 fps). Note both numbers.

- [ ] **Step 3: Update the README**

In `README.md` replace the scenario sentence with `Scenarios: boot, island, harvest, persist, night, pause, corrupt, badsave, survive, build, tools, death, sleep, migrate, perf.` and replace the whole `## Status (phase 1)` section with:

```markdown
## Status (phase 2)

A survival game on a seed-generated island: hunger, thirst, stamina and health; a 32-slot backpack with a hotbar;
tools with tiers and durability; 21 recipes at the hand, campfire, workbench and furnace; building (campfire,
workbench, furnace, bed, chest, torch, fence) and taking buildings down; four farmed crops; a real night with
light from fires and torches; sleeping; death rules per difficulty; save format 2 (phase 1 saves still load).
Measured on the dev PC (headless Edge): tap-to-game <N> ms, <N> fps.
```

Fill the two numbers from Step 2.

- [ ] **Step 4: Code review**

Dispatch the `code-reviewer` agent on everything since tag `phase-1` (`git diff phase-1..HEAD`, ignoring generated atlases and the lockfile), giving it this plan's Global Constraints and Review Focus. Fix every CRITICAL and HIGH finding with a test that fails first, fix MEDIUM findings where cheap, then repeat Steps 1 and 2.

- [ ] **Step 5: Commit and tag**

```bash
git add README.md
git commit -m "docs: describe phase 2 and record its performance"
git tag phase-2
```

Expected: `git tag` lists `phase-1` and `phase-2`. Plan 3 (combat, enemies, animals, hunting and cooked meat) is written next, starting from this tag.

