# Tidewake Dungeons and Bosses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the three dungeons: a door on the island leads into a generated interior of eight rooms with the puzzle pieces of the pack (pushable blocks, floor switches, doors, spike traps, locked chests with keys, crystals), guards in the fighting rooms, and a boss with two phases at the end who drops the story item and a piece of armour. Armour can be worn and cuts every blow.

**Architecture:** The same split as before. A dungeon is a pure function of the world seed (`generateDungeon(seed, id)`), laid out on a fixed chain of eight rooms and always solvable by construction (tests play every generated dungeon through). What the hero changes is a small `DungeonProgress` record per dungeon, saved with the game (save format 3). Rules stay pure and tested: `rules.ts` (doors, blocks, spikes, crystals, chests), `boss.ts` (the boss script), `bossFight.ts` (bolts and helpers), and the resolver and session learn four new actions. The scene side gets a `Level` interface with two implementations, `IslandLevel` (what `GameScene` used to do itself) and `DungeonLevel`, so `GameScene` runs whichever place the hero is in and stays at 400 lines.

**Tech Stack:** unchanged (Phaser 3.90, TypeScript 5.9, Vite 7, Vitest 3, Capacitor 8 plugins, Python + Pillow for art, Playwright + Edge for browser smoke tests).

**Spec:** `docs/superpowers/specs/2026-10-03-tidewake-design.md` (this plan implements phase 4 of section 11 and the dungeon, boss and armour parts of section 4).

**Builds on:** tag `phase-3` of this repository (`docs/superpowers/plans/2026-10-04-tidewake-combat-and-wildlife.md`).

## Scope of this plan

Delivered: save format 3 (the dungeon the hero is in, dungeon progress, worn armour); five armour pieces (two craftable, three boss rewards) with a screen to wear them; keys and the three story items (Compass, Hull Planks, Lighthouse Key) with icons; floor and wall terrain with three looks (mossy grotto, brown mine, sandstone ruin); the dungeon generator and its rules; spike traps, blocks, switches, crystals, locked chests and doors; three bosses (Mossback, Ironbones, Mirelord) with charge, slam, bolt fans, bolt rings and summons; enemy bolts; the island doors that lead in; a dungeon-aware `GameScene`; the boss health bar; browser scenarios that play a whole dungeon.

Deferred on purpose:
- Story: which dungeon is open when, the quest log, NPCs and the chapters that use the Compass, Hull Planks and Lighthouse Key (plan 5). For now the items just drop and sit in the backpack.
- The Hollow Keeper (final boss, plan 5) and a minimap or dungeon map.
- Gold-tier tools, the alchemy table and potions.
- Sprite polish for the dungeons (a nicer lane than wall blocks, door frames in the right orientation, decorations) and boss balance numbers (plans 6 and 7).
- A softlock reset inside a room: leaving the dungeon puts every block back where it started. The block lanes are closed at both sides, so a block can only be slid along them.

## Global Constraints

- Phaser `^3.90.0`, TypeScript `5.9`, Vite `^7.3.6`, Vitest `^3.2.7`, Capacitor `^8.5.2` plugins; Node 22 or newer. No new dependencies.
- Android package id `com.fajar.tidewake`. Portrait; 16x16 tiles; world camera zoom `worldZoom(2)`; layout in virtual pixels.
- **Save format is version 3**; versions 1 and 2 must still load (their new fields default to "on the island, nothing worn, no progress"). A save claiming any other version is rejected. A save made under another `DUNGEON_VERSION` keeps everything but its dungeon progress and wakes the hero at his bed.
- Dungeons are regenerated from the world seed; only `DungeonProgress` (open doors, emptied chests, solved rooms, struck crystals, boss dead) is saved. Creatures, bolts and blocks are not saved: they start again on every visit, apart from what the progress says is done.
- Dungeon layout: 48x48 tiles, eight rooms of 13x11 on a 3x3 grid, a fixed chain entrance, four puzzle rooms in a seeded order (fight, block, crystal, trap), a vault, the boss room, and a side room by the entrance. Two small keys lie in the side room and open the two locked chests (the vault, which holds the boss key, and the trap room's treasure); the boss door needs the boss key.
- Armour: five pieces (bone 2, iron 4 craftable; moss 3, ironbones 5, mire 7 dropped by the bosses), one armour slot, worn from the backpack screen, never worn out. Every blow from a creature, bolt or trap is cut by the defence, but never below 1.
- Bosses: Mossback 140 hit points, Ironbones 160, Mirelord 180; they are not staggered or pushed; the aim of a charge, fan or ring is fixed when the warning begins, so a hero who moves in time is missed; the second phase starts at half health; helpers are limited to 6 alive.
- Spike traps take 6 hit points (before difficulty and armour); the hero is safe for 0.7 s after any blow.
- `src/sim/` and `src/data/` never import Phaser; `src/sim/` functions never mutate their arguments and return new values.
- Files stay at most 400 lines (hard limit 800); functions under 50 lines.
- Coverage of `src/sim/**`, `src/data/**` and the testable `src/core/` files stays at least 80% lines (`npm run test:cov`).
- The Unity pack at `E:\Pixel Games Asset Master` is read-only. API keys from `E:\Game Dev Tools.txt` are never copied into the repo; this plan needs none.
- Commits use `<type>: <description>` with no attribution trailer; commit locally, never push.
- The dev server runs on port **5199** (`strictPort`); ports 5173 and 5188 belong to another project of the owner. Never stop processes you did not start.

## Review Focus

Inputs and conditions the spec implies but that are easy to miss. Each has tests or a scripted scenario in the task that owns it.

1. **Every dungeon must be finishable, and nobody may get stuck.** Keys match locks exactly; the boss and the boss key are out of reach until the puzzles are solved; blocks can only slide along closed lanes; leaving and coming back resets what is not saved. Tests: Task 3 (twelve generated dungeons are played through). Scenario: `dungeon-play.json`.
2. **Saving and loading in every state.** Saving inside a dungeon and continuing; a save from a dungeon the game can no longer build; version 2 saves; hand-edited locations, armour and progress; dying inside a dungeon wakes the hero on the island. Tests: Tasks 1 and 6. Scenarios: `dungeon-persist.json`, `dungeon-death.json`.
3. **The boss fight has to be fair and robust.** A charge can be dodged and ends against a wall; slams only hit what is close; bolts stop at walls and never hit a collapsed hero; helpers are capped; the boss sleeps until the hero is near and never wakes for a dead hero; a hit neither staggers nor interrupts it. Tests: Task 5. Scenario: `dungeon-play.json`.
4. **A full backpack at a chest, and keys.** A locked chest spends one small key, but only if the loot fits; nothing is lost and the key stays when it does not; the boss door uses up the boss key once. Tests: Task 6.
5. **The island must not leak into a dungeon, or the other way round.** Buildings, fields, crafting stations, resource nodes and the island's harvest record never show up or change below ground; a new day below ground does not crash or regrow anything; coming out puts the hero at the door he went in by. Tests: Tasks 4 and 6. Scenarios: `dungeon-play.json`, `dungeon-persist.json`.

---

## File Structure

```
src/data/    items, recipes, strings, creatures, terrainTiles, landmarkProps (changed); dungeons, bosses, dungeonArt (new)
src/sim/     dungeon/{progress, layout, types, generate, rules, start}, equipment, boss, bossFight (new)
             actions, session, cues, creatures, encounters, combat, movement, tileView, world/types (changed)
src/game/    Level, IslandLevel, DungeonLevel (new); HeroCombat, Wildlife (changed)
src/gfx/     DungeonLayer (new); CreatureLayer, TerrainLayer (changed)
src/core/    saveData (changed)
src/scenes/  GameScene (rewritten), HudScene, InventoryScene (changed)
tools/       make_armor_icons, make_dungeon_icons (new); make_icons, pack_tiles, pack_assets (changed);
             scripts/{dungeon-play, dungeon-death, dungeon-persist, dungeon-perf, armor}.json (new smoke scenarios)
public/assets/pack/{icons,tiles,props}.*   regenerated, committed
tests/       one file per module group (see tasks); tests/helpers/dungeonSolve.ts
```

## Pre-flight

Run once. Expected: after committing this plan file the working tree is clean, the tag exists, 379 tests pass, port 5199 is free, and Python has Pillow.

```bash
cd "E:/RPG Survival Sprite Sonnet 55"
git add docs && git commit -m "docs: add plan 4 for dungeons and bosses"
git status --short && git tag --list phase-3
npm test 2>&1 | tail -4
curl -s -o /dev/null -w "port 5199 answers: %{http_code}\n" http://localhost:5199/ || echo "port 5199 is free"
python -c "import PIL; print('pillow ok')"
```

---

### Task 1: Armour, keys, story items, equipment and save format 3

**Files:**
- Create: `src/sim/dungeon/progress.ts`, `src/sim/equipment.ts`, `tools/make_armor_icons.py`, `tools/make_dungeon_icons.py`
- Replace: `src/data/items.ts`, `src/data/recipes.ts`, `src/data/strings.ts`, `src/core/saveData.ts`, `tests/saveData.test.ts`
- Modify: `tools/make_icons.py` (three lines)
- Generated: `public/assets/pack/icons.png`, `public/assets/pack/icons.json`
- Test: `tests/armor.test.ts`, `tests/dungeon-progress.test.ts`, `tests/dungeon-items.test.ts` (new), `tests/saveData.test.ts` (replaced)

**Interfaces:**
- Produces: `ItemId` grows by `armor_bone`, `armor_iron`, `armor_moss`, `armor_ironbones`, `armor_mire`, `small_key`, `boss_key`, `compass`, `hull_planks`, `lighthouse_key`; `ItemDef.armor?: {defense}`; recipes for bone and iron armour; `DUNGEON_IDS`, `DungeonId`, `isDungeonId`, `DUNGEON_VERSION = 1`, `DungeonProgress {opened, looted, solved, lit, boss}`, `Dungeons`, `emptyProgress()`, `emptyDungeons()`, `addUnique(list, id)`, `parseDungeons(raw)`; `Equipment {armor}`, `noEquipment()`, `defenseOf(e)`, `equipFromSlot(inv, e, index)`, `unequipArmor(inv, e)`, `parseEquipment(raw)`; `SaveSlot` gains `location`, `equipment`, `dungeons`, `dungeonVersion`; `SAVE_VERSION = 3`. `src/data/strings.ts` already holds every text the later tasks use (dungeon and boss names, key messages, the armour screen).

- [ ] **Step 1: Write the failing tests**

`tests/armor.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { ITEMS, ITEM_IDS, type ItemId } from '@/data/items';
import { RECIPES } from '@/data/recipes';
import { UI_STRINGS } from '@/data/strings';
import { defenseOf, equipFromSlot, noEquipment, parseEquipment, unequipArmor } from '@/sim/equipment';
import { addItem, emptyInventory } from '@/sim/inventory';

const ARMORS: ItemId[] = ['armor_bone', 'armor_iron', 'armor_moss', 'armor_ironbones', 'armor_mire'];

describe('armour items', () => {
  it('are the five pieces, never stack, never wear out, and name a positive defence', () => {
    expect(ITEM_IDS.filter((id) => ITEMS[id].armor)).toEqual(ARMORS);
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
  });

  it('can be crafted from bones and iron at the workbench, while the boss pieces are rewards only', () => {
    const make = (out: ItemId) => RECIPES.find((r) => r.out === out);
    expect(make('armor_bone')).toMatchObject({ station: 'workbench', cost: [['bone', 8], ['rope', 2]] });
    expect(make('armor_iron')).toMatchObject({ station: 'workbench', cost: [['iron_ingot', 8], ['rope', 2]] });
    for (const id of ['armor_moss', 'armor_ironbones', 'armor_mire'] as const) expect(make(id), id).toBeUndefined();
  });
});

describe('equipment', () => {
  it('starts with nothing worn and no defence', () => {
    expect(noEquipment()).toEqual({ armor: null });
    expect(defenseOf(noEquipment())).toBe(0);
    expect(defenseOf({ armor: 'armor_iron' })).toBe(ITEMS.armor_iron.armor!.defense);
  });

  it('wears the armour in a slot and puts what was worn back in that slot', () => {
    let inv = addItem(emptyInventory(), 'armor_bone', 1).inv;
    inv = addItem(inv, 'armor_iron', 1).inv;
    const first = equipFromSlot(inv, noEquipment(), 0)!;
    expect(first.equipment).toEqual({ armor: 'armor_bone' });
    expect(first.inv[0]).toBeNull();
    const swapped = equipFromSlot(first.inv, first.equipment, 1)!;
    expect(swapped.equipment).toEqual({ armor: 'armor_iron' });
    expect(swapped.inv[1]).toEqual({ item: 'armor_bone', qty: 1 });
  });

  it('refuses anything that is not armour, and an empty slot', () => {
    const inv = addItem(emptyInventory(), 'wood', 5).inv;
    expect(equipFromSlot(inv, noEquipment(), 0)).toBeNull();
    expect(equipFromSlot(inv, noEquipment(), 9)).toBeNull();
    expect(equipFromSlot(inv, noEquipment(), -1)).toBeNull();
  });

  it('takes armour off into the first free slot, or refuses when the backpack is full', () => {
    const worn = { armor: 'armor_moss' } as const;
    const off = unequipArmor(emptyInventory(), worn)!;
    expect(off.equipment).toEqual({ armor: null });
    expect(off.inv[0]).toEqual({ item: 'armor_moss', qty: 1 });
    const full = addItem(emptyInventory(1), 'wood', 99).inv;
    expect(unequipArmor(full, worn)).toBeNull();
    expect(unequipArmor(emptyInventory(), noEquipment())).toBeNull();
  });

  it('keeps only real armour from an untrusted save', () => {
    expect(parseEquipment({ armor: 'armor_mire' })).toEqual({ armor: 'armor_mire' });
    expect(parseEquipment({ armor: 'wood' })).toEqual({ armor: null });
    expect(parseEquipment({ armor: 'nonsense' })).toEqual({ armor: null });
    expect(parseEquipment(null)).toEqual({ armor: null });
  });
});
```

`tests/dungeon-progress.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { DUNGEON_IDS, DUNGEON_VERSION, addUnique, emptyDungeons, emptyProgress, isDungeonId, parseDungeons } from '@/sim/dungeon/progress';

describe('dungeon progress', () => {
  it('knows the three dungeons and starts each with nothing done', () => {
    expect(DUNGEON_IDS).toEqual(['grotto', 'deepmine', 'ruin']);
    for (const id of DUNGEON_IDS) expect(emptyDungeons()[id]).toEqual({ opened: [], looted: [], solved: [], lit: [], boss: false });
    expect(emptyProgress()).not.toBe(emptyProgress());
  });

  it('has a version that is bumped whenever the generator changes, so old progress is never applied to a new layout', () => {
    expect(Number.isInteger(DUNGEON_VERSION)).toBe(true);
    expect(DUNGEON_VERSION).toBeGreaterThanOrEqual(1);
  });

  it('recognises dungeon ids safely', () => {
    expect(isDungeonId('ruin')).toBe(true);
    expect(isDungeonId('toString')).toBe(false);
    expect(isDungeonId(null)).toBe(false);
  });

  it('adds a number to a list once, without changing the original', () => {
    const list = [1, 2] as const;
    expect(addUnique(list, 3)).toEqual([1, 2, 3]);
    expect(addUnique(list, 2)).toBe(list);
    expect(list).toEqual([1, 2]);
  });

  it('keeps only sound progress from an untrusted save', () => {
    const parsed = parseDungeons({
      grotto: { opened: [1, 2, 2, -4, 'x', 3.5, 7], looted: [0], solved: 'no', lit: [4, 1e12], boss: true },
      deepmine: 'junk',
      toString: { boss: true },
    });
    expect(parsed.grotto).toEqual({ opened: [1, 2, 7], looted: [0], solved: [], lit: [4], boss: true });
    expect(parsed.deepmine).toEqual(emptyProgress());
    expect(parsed.ruin).toEqual(emptyProgress());
    expect(parseDungeons(undefined)).toEqual(emptyDungeons());
    expect(parseDungeons({ grotto: { boss: 'yes' } }).grotto.boss).toBe(false);
  });

  it('caps the length of a list so a hand-edited save cannot bloat memory', () => {
    const huge = Array.from({ length: 5000 }, (_, i) => i);
    expect(parseDungeons({ ruin: { opened: huge } }).ruin.opened.length).toBeLessThanOrEqual(200);
  });
});
```

`tests/dungeon-items.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { ITEMS, type ItemId } from '@/data/items';
import { UI_STRINGS } from '@/data/strings';
import { addItem, emptyInventory } from '@/sim/inventory';

const STORY: ItemId[] = ['compass', 'hull_planks', 'lighthouse_key'];

describe('dungeon items', () => {
  it('has keys that stack a little, and story items that are one of a kind', () => {
    expect(ITEMS.small_key.stack).toBeGreaterThan(1);
    expect(ITEMS.small_key.stack).toBeLessThanOrEqual(9);
    expect(ITEMS.boss_key.stack).toBe(1);
    for (const id of STORY) expect(ITEMS[id].stack, id).toBe(1);
  });

  it('gives every one of them an icon frame and a name in both languages', () => {
    for (const id of ['small_key', 'boss_key', ...STORY] as const) {
      expect(ITEMS[id].icon.frame, id).toBe(id);
      expect(UI_STRINGS[`item_${id}`], id).toBeDefined();
    }
  });

  it('are plain items: no tool, weapon, armour, food or placement', () => {
    for (const id of ['small_key', 'boss_key', ...STORY] as const) {
      const d = ITEMS[id];
      expect([d.tool, d.weapon, d.armor, d.food, d.place, d.seed], id).toEqual([undefined, undefined, undefined, undefined, undefined, undefined]);
    }
  });

  it('go into the backpack like anything else, and keys merge', () => {
    let inv = addItem(emptyInventory(), 'small_key', 2).inv;
    inv = addItem(inv, 'small_key', 1).inv;
    expect(inv[0]).toEqual({ item: 'small_key', qty: 3 });
    expect(addItem(inv, 'compass', 1).inv[1]).toEqual({ item: 'compass', qty: 1 });
  });
});
```

Replace `tests/saveData.test.ts` (adds the version 3 fields and the dungeon version):

`tests/saveData.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { SAVE_VERSION, newSlot, parseSlot } from '@/core/saveData';
import { newClock } from '@/sim/daynight';
import { DUNGEON_VERSION } from '@/sim/dungeon/progress';
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

describe('save format 3', () => {
  it('starts a new game on the island with nothing worn and no dungeon progress', () => {
    const s = make(0);
    expect(s.location).toBeNull();
    expect(s.equipment).toEqual({ armor: null });
    expect(s.dungeons.grotto).toEqual({ opened: [], looted: [], solved: [], lit: [], boss: false });
  });

  it('records which dungeon generator the progress belongs to, and assumes the current one for saves that have none', () => {
    expect(make(0).dungeonVersion).toBe(DUNGEON_VERSION);
    const old = JSON.parse(JSON.stringify(make(1)));
    delete old.dungeonVersion;
    expect(parseSlot(old, 1)!.dungeonVersion).toBe(DUNGEON_VERSION);
    expect(parseSlot({ ...old, dungeonVersion: 0 }, 1)!.dungeonVersion).toBe(0);
    expect(parseSlot({ ...old, dungeonVersion: 'x' }, 1)!.dungeonVersion).toBe(DUNGEON_VERSION);
  });

  it('upgrades a version 2 save without losing anything', () => {
    const old = JSON.parse(JSON.stringify(make(2)));
    delete old.location;
    delete old.equipment;
    delete old.dungeons;
    old.version = 2;
    old.inventory[0] = { item: 'wood', qty: 7 };
    const up = parseSlot(old, 2)!;
    expect(up.version).toBe(SAVE_VERSION);
    expect(up.inventory[0]).toEqual({ item: 'wood', qty: 7 });
    expect(up.location).toBeNull();
    expect(up.equipment).toEqual({ armor: null });
    expect(up.dungeons.ruin.boss).toBe(false);
  });

  it('keeps worn armour, a dungeon location and progress, and drops what is not real', () => {
    const raw = JSON.parse(JSON.stringify(make(0)));
    raw.location = 'deepmine';
    raw.equipment = { armor: 'armor_iron' };
    raw.dungeons = { deepmine: { opened: [1, 4], looted: [2], solved: [0], lit: [], boss: true } };
    const s = parseSlot(raw, 0)!;
    expect(s.location).toBe('deepmine');
    expect(s.equipment).toEqual({ armor: 'armor_iron' });
    expect(s.dungeons.deepmine).toEqual({ opened: [1, 4], looted: [2], solved: [0], lit: [], boss: true });
    expect(parseSlot({ ...raw, location: 'atlantis' }, 0)!.location).toBeNull();
    expect(parseSlot({ ...raw, equipment: { armor: 'wood' } }, 0)!.equipment).toEqual({ armor: null });
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
    for (const version of [0, -5, 4, 1.5, '2', null]) expect(parseSlot({ ...valid(), version }, 0), String(version)).toBeNull();
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
    expect(s.version).toBe(SAVE_VERSION);
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

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/armor.test.ts tests/dungeon-progress.test.ts tests/dungeon-items.test.ts tests/saveData.test.ts`
Expected: FAIL. All four files fail: `armor.test.ts`, `dungeon-progress.test.ts` and `saveData.test.ts` stop with "Cannot find module '@/sim/equipment'" (or '@/sim/dungeon/progress'), and `dungeon-items.test.ts` fails because the new items are missing.

- [ ] **Step 3: Write the modules**

Dungeon progress: what the hero has done in each dungeon, validated when loaded:

`src/sim/dungeon/progress.ts`:

```typescript
/** The three dungeons, one per region of the island. */
export const DUNGEON_IDS = ['grotto', 'deepmine', 'ruin'] as const;
export type DungeonId = (typeof DUNGEON_IDS)[number];

/** Bumped whenever the dungeon generator changes: progress saved under another version no longer fits the layout. */
export const DUNGEON_VERSION = 1;

export const isDungeonId = (v: unknown): v is DungeonId => typeof v === 'string' && (DUNGEON_IDS as readonly string[]).includes(v);

/**
 * What the hero has changed inside one dungeon, by the numeric ids the generator gives its doors, chests, rooms and
 * crystals. Saved with the game; the dungeon itself is regenerated from the world seed.
 */
export interface DungeonProgress {
  /** Doors that stay open. */
  readonly opened: readonly number[];
  /** Chests that have been emptied. */
  readonly looted: readonly number[];
  /** Rooms whose puzzle is solved or whose monsters are all dead. */
  readonly solved: readonly number[];
  /** Crystals that have been struck. */
  readonly lit: readonly number[];
  /** The boss is dead. */
  readonly boss: boolean;
}

export type Dungeons = Readonly<Record<DungeonId, DungeonProgress>>;

const MAX_IDS = 200;

export const emptyProgress = (): DungeonProgress => ({ opened: [], looted: [], solved: [], lit: [], boss: false });

export const emptyDungeons = (): Dungeons => ({ grotto: emptyProgress(), deepmine: emptyProgress(), ruin: emptyProgress() });

/** The list with `id` added, or the very same list when it is already there. */
export function addUnique(list: readonly number[], id: number): readonly number[] {
  return list.includes(id) ? list : [...list, id];
}

function parseIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  for (const v of raw as unknown[]) {
    if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 100_000 && !out.includes(v)) out.push(v);
    if (out.length >= MAX_IDS) break;
  }
  return out;
}

/** Validate untrusted JSON into dungeon progress; anything unreadable becomes "nothing done yet". */
export function parseDungeons(raw: unknown): Dungeons {
  const d = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const one = (id: DungeonId): DungeonProgress => {
    const p = d[id];
    if (typeof p !== 'object' || p === null) return emptyProgress();
    const r = p as Record<string, unknown>;
    return { opened: parseIds(r.opened), looted: parseIds(r.looted), solved: parseIds(r.solved), lit: parseIds(r.lit), boss: r.boss === true };
  };
  return { grotto: one('grotto'), deepmine: one('deepmine'), ruin: one('ruin') };
}
```

Equipment: wearing, taking off, and what the worn armour is worth:

`src/sim/equipment.ts`:

```typescript
import { ITEMS, isItemId, type ItemId } from '@/data/items';
import { addItem, type Inventory } from '@/sim/inventory';

/** What the hero wears. Only armour for now. */
export interface Equipment {
  readonly armor: ItemId | null;
}

export const noEquipment = (): Equipment => ({ armor: null });

/** Points taken off every blow from a creature. */
export const defenseOf = (e: Equipment): number => (e.armor ? ITEMS[e.armor].armor?.defense ?? 0 : 0);

export interface Worn {
  inv: Inventory;
  equipment: Equipment;
}

/** Put the armour in a backpack slot on; whatever was worn takes its place. Null when the slot holds no armour. */
export function equipFromSlot(inv: Inventory, e: Equipment, index: number): Worn | null {
  const slot = inv[index];
  if (!slot || !ITEMS[slot.item].armor) return null;
  const out = inv.map((s, i) => (i === index ? (e.armor ? { item: e.armor, qty: 1 } : null) : s));
  return { inv: out, equipment: { armor: slot.item } };
}

/** Take the armour off into the first free slot. Null when nothing is worn or the backpack is full. */
export function unequipArmor(inv: Inventory, e: Equipment): Worn | null {
  if (!e.armor) return null;
  const { inv: next, left } = addItem(inv, e.armor, 1);
  return left > 0 ? null : { inv: next, equipment: { armor: null } };
}

/** Validate untrusted JSON into equipment; anything that is not real armour is dropped. */
export function parseEquipment(raw: unknown): Equipment {
  const armor = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>).armor : null;
  return { armor: isItemId(armor) && ITEMS[armor].armor ? armor : null };
}
```

The catalog: five armour pieces (no durability), five key and story items, and the two armour recipes; and every text the rest of the plan needs, in both languages:

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
  | 'raw_meat' | 'cooked_meat' | 'honey' | 'bandage' | 'gel' | 'bone'
  | 'armor_bone' | 'armor_iron' | 'armor_moss' | 'armor_ironbones' | 'armor_mire'
  | 'small_key' | 'boss_key' | 'compass' | 'hull_planks' | 'lighthouse_key';

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
  /** Worn in the armour slot: every blow from a creature is cut by `defense` points. */
  armor?: { defense: number };
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
const armor = (id: ItemId, defense: number): ItemDef => ({ id, stack: 1, icon: icons(id), armor: { defense } });
const keepsake = (id: ItemId, stack = 1): ItemDef => ({ id, stack, icon: icons(id) });
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

  armor_bone: armor('armor_bone', 2),
  armor_iron: armor('armor_iron', 4),
  armor_moss: armor('armor_moss', 3),
  armor_ironbones: armor('armor_ironbones', 5),
  armor_mire: armor('armor_mire', 7),

  small_key: keepsake('small_key', 9),
  boss_key: keepsake('boss_key'),
  compass: keepsake('compass'),
  hull_planks: keepsake('hull_planks'),
  lighthouse_key: keepsake('lighthouse_key'),

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
  r('armor_bone', 1, [['bone', 8], ['rope', 2]], 'workbench'),
  r('armor_iron', 1, [['iron_ingot', 8], ['rope', 2]], 'workbench'),
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
  item_armor_bone: { en: 'Bone armor', id: 'Zirah tulang' },
  item_armor_iron: { en: 'Iron armor', id: 'Zirah besi' },
  item_armor_moss: { en: 'Moss mantle', id: 'Jubah lumut' },
  item_armor_ironbones: { en: 'Ironbones plate', id: 'Pelat Ironbones' },
  item_armor_mire: { en: 'Mire scale', id: 'Sisik rawa' },
  item_small_key: { en: 'Small key', id: 'Kunci kecil' },
  item_boss_key: { en: 'Boss key', id: 'Kunci bos' },
  item_compass: { en: 'Compass', id: 'Kompas' },
  item_hull_planks: { en: 'Hull planks', id: 'Papan lambung' },
  item_lighthouse_key: { en: 'Lighthouse key', id: 'Kunci mercusuar' },
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
  dungeon_grotto: { en: 'Mushroom Grotto', id: 'Gua Jamur' },
  dungeon_deepmine: { en: 'Deepmine', id: 'Tambang Dalam' },
  dungeon_ruin: { en: 'Sunken Ruin', id: 'Reruntuhan Tenggelam' },
  boss_mossback: { en: 'Mossback', id: 'Mossback' },
  boss_ironbones: { en: 'Ironbones', id: 'Ironbones' },
  boss_mirelord: { en: 'Mirelord', id: 'Mirelord' },
  msgWayOpens: { en: 'A door opens', id: 'Sebuah pintu terbuka' },
  msgBossDefeated: { en: '{name} is defeated!', id: '{name} telah dikalahkan!' },
  wearArmor: { en: 'Wear', id: 'Pakai' },
  takeOffArmor: { en: 'Take off', id: 'Lepas' },
  armorDefense: { en: 'Defense {n}', id: 'Pertahanan {n}' },
  armorNone: { en: 'No armor', id: 'Tanpa zirah' },
  msgNeedsKey: { en: 'Locked. You need a small key', id: 'Terkunci. Butuh kunci kecil' },
  msgNeedsBossKey: { en: 'Sealed. You need the boss key', id: 'Tersegel. Butuh kunci bos' },
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

Save format 3. Versions 1 and 2 still load; a hand-edited location, armour or progress is cleaned up rather than trusted:

`src/core/saveData.ts`:

```typescript
import { CROPS, type CropId } from '@/data/crops';
import { ITEMS, isItemId } from '@/data/items';
import { CHEST_SLOTS, STRUCTURES, type StructureId } from '@/data/structures';
import { DAY_SECONDS, type Clock } from '@/sim/daynight';
import { DUNGEON_VERSION, emptyDungeons, isDungeonId, parseDungeons, type DungeonId, type Dungeons } from '@/sim/dungeon/progress';
import { noEquipment, parseEquipment, type Equipment } from '@/sim/equipment';
import { emptyFarm, type Farm, type Plot } from '@/sim/farm';
import { emptyGather, type GatherState } from '@/sim/gather';
import { HOTBAR_SIZE, INVENTORY_SIZE, addItem, emptyInventory, type Inventory, type Slot } from '@/sim/inventory';
import type { Structure, Structures } from '@/sim/structures';
import { VITAL_MAX, fullVitals, type Difficulty, type Vitals } from '@/sim/vitals';
import { GENERATOR_VERSION } from '@/sim/world/generate';
import { WORLD_SIZE } from '@/sim/world/types';

export const SAVE_VERSION = 3;
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
  /** The dungeon the hero is in, or null on the island. `player` is in that dungeon's coordinates. */
  location: DungeonId | null;
  equipment: Equipment;
  dungeons: Dungeons;
  /** DUNGEON_VERSION the dungeon progress was made under. */
  dungeonVersion: number;
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
    vitals: fullVitals(), structures: { next: 1, list: [] }, farm: emptyFarm(), location: null, equipment: noEquipment(),
    dungeons: emptyDungeons(), dungeonVersion: DUNGEON_VERSION,
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
  if (d.version !== 1 && d.version !== 2 && d.version !== 3) return null;
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
    location: isDungeonId(d.location) ? d.location : null,
    equipment: parseEquipment(d.equipment),
    dungeons: parseDungeons(d.dungeons),
    dungeonVersion: isInt(d.dungeonVersion) ? d.dungeonVersion : DUNGEON_VERSION,
  };
}
```

- [ ] **Step 4: Draw the icons**

Armour as little tunics, keys, a compass, a bundle of planks and a lighthouse key, with the drawing kit from plan 3:

`tools/make_armor_icons.py`:

```python
"""Item icons for the five armour pieces (16x16, drawn with the shared kit in icon_kit.py)."""
from icon_kit import FIBER_L, GOLD, IRON_D, IRON_L, canvas, outlined

BONE = (232, 224, 200, 255)
BONE_D = (176, 164, 138, 255)
MOSS = (104, 156, 84, 255)
MOSS_D = (62, 106, 54, 255)
MOSS_L = (160, 206, 120, 255)
DARK = (74, 74, 94, 255)
DARK_D = (46, 46, 62, 255)
MIRE = (62, 176, 152, 255)
MIRE_D = (34, 112, 112, 255)
MIRE_L = (150, 236, 206, 255)


def breastplate(body, dark, light):
    """A chest piece: shoulders, a torso with a neck opening, and a lighter strip down the left side."""
    img, d = canvas()
    d.polygon([(1, 5), (4, 2), (12, 2), (15, 5), (13, 9), (11, 8), (11, 14), (5, 14), (5, 8), (3, 9)], fill=body)
    d.polygon([(5, 2), (8, 6), (11, 2)], fill=dark)
    d.line([(5, 9), (5, 13)], fill=light)
    d.line([(3, 5), (5, 3)], fill=light)
    d.line([(11, 9), (11, 13)], fill=dark)
    d.line([(13, 6), (12, 8)], fill=dark)
    return img, d


def armor_bone():
    img, d = breastplate(BONE, BONE_D, (255, 252, 240, 255))
    for y in (8, 10, 12):
        d.line([(6, y), (10, y)], fill=BONE_D)
    return outlined(img)


def armor_iron():
    img, d = breastplate(IRON_L, IRON_D, (255, 255, 255, 255))
    d.rectangle([7, 8, 9, 11], fill=IRON_D)
    return outlined(img)


def armor_moss():
    img, d = breastplate(MOSS, MOSS_D, MOSS_L)
    d.polygon([(7, 9), (9, 9), (10, 11), (8, 13), (6, 11)], fill=MOSS_L)
    d.point([8, 11], fill=MOSS_D)
    return outlined(img)


def armor_ironbones():
    img, d = breastplate(DARK, DARK_D, IRON_L)
    d.rectangle([6, 8, 10, 11], fill=BONE)
    d.point([7, 9], fill=DARK_D)
    d.point([9, 9], fill=DARK_D)
    d.line([(7, 11), (9, 11)], fill=DARK_D)
    d.point([2, 4], fill=GOLD)
    d.point([14, 4], fill=GOLD)
    return outlined(img)


def armor_mire():
    img, d = breastplate(MIRE, MIRE_D, MIRE_L)
    for y in (8, 10, 12):
        for x in (6, 8):
            d.arc([x, y - 1, x + 2, y + 1], 0, 180, fill=MIRE_L)
    d.point([8, 5], fill=FIBER_L)
    return outlined(img)


def armor_icons():
    return {
        "armor_bone": armor_bone(), "armor_iron": armor_iron(), "armor_moss": armor_moss(), "armor_ironbones": armor_ironbones(),
        "armor_mire": armor_mire(),
    }
```

`tools/make_dungeon_icons.py`:

```python
"""Item icons for dungeon keys and the three story items (16x16, drawn with the shared kit in icon_kit.py)."""
from icon_kit import GOLD, IRON_D, IRON_L, RED, ROPE, ROPE_D, WOOD, WOOD_D, WOOD_L, canvas, outlined

GOLD_D = (190, 140, 40, 255)
BRASS = (214, 170, 80, 255)
BRASS_D = (150, 110, 50, 255)
GLASS = (190, 236, 250, 255)


def key(head, head_d, long_teeth=1):
    img, d = canvas()
    d.ellipse([1, 2, 7, 8], fill=head)
    d.ellipse([3, 4, 5, 6], fill=(0, 0, 0, 0))
    d.line([(7, 7), (14, 14)], fill=head, width=2)
    d.line([(8, 8), (14, 14)], fill=head_d)
    for i in range(long_teeth):
        d.rectangle([11 + i * 2 - 1, 12 - i, 12 + i * 2 - 1, 13 - i], fill=head_d)
    d.point([3, 3], fill=(255, 255, 255, 255))
    return outlined(img)


def small_key():
    return key(GOLD, GOLD_D, 1)


def boss_key():
    img = key(RED, (120, 30, 40, 255), 2)
    return img


def compass():
    img, d = canvas()
    d.ellipse([2, 2, 14, 14], fill=BRASS)
    d.ellipse([4, 4, 12, 12], fill=GLASS)
    d.polygon([(8, 4), (9, 8), (7, 8)], fill=RED)
    d.polygon([(8, 12), (9, 8), (7, 8)], fill=IRON_D)
    d.point([8, 8], fill=BRASS_D)
    d.arc([2, 2, 14, 14], 200, 340, fill=GOLD)
    return outlined(img)


def hull_planks():
    img, d = canvas()
    for i, y in enumerate((3, 6, 9)):
        d.rectangle([2, y, 13, y + 2], fill=WOOD_L if i % 2 == 0 else WOOD)
        d.line([(2, y + 2), (13, y + 2)], fill=WOOD_D)
    d.line([(5, 2), (5, 12)], fill=ROPE, width=1)
    d.line([(10, 2), (10, 12)], fill=ROPE_D, width=1)
    d.polygon([(2, 12), (13, 12), (11, 14), (4, 14)], fill=WOOD_D)
    return outlined(img)


def lighthouse_key():
    img, d = canvas()
    d.polygon([(8, 1), (13, 5), (11, 9), (5, 9), (3, 5)], fill=IRON_L)
    d.polygon([(8, 3), (11, 5), (10, 7), (6, 7), (5, 5)], fill=GLASS)
    d.line([(8, 9), (8, 14)], fill=IRON_L, width=2)
    d.rectangle([8, 12, 11, 13], fill=IRON_D)
    d.rectangle([8, 14, 10, 14], fill=IRON_D)
    d.point([8, 5], fill=GOLD)
    return outlined(img)


def dungeon_icons():
    return {
        "small_key": small_key(), "boss_key": boss_key(), "compass": compass(), "hull_planks": hull_planks(),
        "lighthouse_key": lighthouse_key(),
    }
```

In `tools/make_icons.py`, find the two imports of the other icon files and the line `icons.update(combat_icons())`:

```python
from make_combat_icons import combat_icons
```

and

```python
    icons.update(combat_icons())
```

Change them so the file also imports and merges the new sets:

```python
from make_armor_icons import armor_icons
from make_combat_icons import combat_icons
from make_dungeon_icons import dungeon_icons
```

and

```python
    icons.update(combat_icons())
    icons.update(armor_icons())
    icons.update(dungeon_icons())
```

Run: `python tools/make_icons.py`
Expected: prints `icons: 57 frames -> 128x128`. Open `public/assets/pack/icons.png`: after the weapons come five tunics (bone, iron, moss, dark with a skull, teal scales), two keys, a compass, planks and a lighthouse key.

- [ ] **Step 5: Run the tests, the typecheck and the whole suite**

Run: `npx vitest run tests/armor.test.ts tests/dungeon-progress.test.ts tests/dungeon-items.test.ts tests/saveData.test.ts && npm run typecheck && npm test`
Expected: armor 8, dungeon-progress 6, dungeon-items 4, saveData 15 tests PASS; typecheck exits 0; the whole suite passes (401 tests; `tests/assets.test.ts` also checks that every new item has an icon).

- [ ] **Step 6: Commit**

```bash
git add src/sim/dungeon/progress.ts src/sim/equipment.ts src/data tools/make_armor_icons.py tools/make_dungeon_icons.py tools/make_icons.py src/core/saveData.ts public/assets/pack/icons.png public/assets/pack/icons.json tests/armor.test.ts tests/dungeon-progress.test.ts tests/dungeon-items.test.ts tests/saveData.test.ts
git commit -m "feat: add armour, keys and story items, equipment and save format 3"
```

---

### Task 2: Floor and wall terrain with dungeon tiles

**Files:**
- Create: none
- Replace: `src/sim/world/types.ts`, `src/data/terrainTiles.ts`, `src/sim/tileView.ts`, `tools/pack_tiles.py`
- Modify: `src/sim/movement.ts` (one line)
- Generated: `public/assets/pack/tiles.png`, `src/data/tileIndex.ts`
- Test: `tests/dungeon-terrain.test.ts` (new)

**Interfaces:**
- Produces: `T.FLOOR = 9` and `T.WALL = 10`; `isWalkable(WALL) = false`; `tileBlocked` is true for walls; `DUNGEON_THEMES = ['moss', 'mine', 'ruin']`, `DungeonTheme`, `themeTiles(theme)`; `dungeonFrame(world, x, y, theme)`, which shows the lit face of a wall that has floor to its south and a dark top elsewhere; 18 new packed tiles.

- [ ] **Step 1: Write the failing test**

`tests/dungeon-terrain.test.ts`:

```typescript
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DUNGEON_THEMES, themeTiles } from '@/data/terrainTiles';
import { TILE_FRAMES } from '@/data/tileIndex';
import { moveWithCollision, speedFactor, tileBlocked } from '@/sim/movement';
import { dungeonFrame } from '@/sim/tileView';
import { T, isWalkable, idx, type World } from '@/sim/world/types';

/** A 6x6 room: floor inside, wall all round. */
function room(): World {
  const size = 6;
  const terrain = new Uint8Array(size * size).fill(T.WALL);
  for (let y = 1; y < 5; y++) for (let x = 1; x < 5; x++) terrain[idx(x, y, size)] = T.FLOOR;
  return { seed: 0, size, terrain, biome: new Uint8Array(size * size), landmarks: [], resources: [], start: { x: 2, y: 2 } };
}

describe('floor and wall terrain', () => {
  it('has its own terrain ids, and walls cannot be walked through while floors can', () => {
    expect(new Set(Object.values(T)).size).toBe(Object.values(T).length);
    expect(T.FLOOR).not.toBe(T.WALL);
    expect(isWalkable(T.FLOOR)).toBe(true);
    expect(isWalkable(T.WALL)).toBe(false);
  });

  it('blocks movement into a wall, slides along it, and walks freely on the floor', () => {
    const w = room();
    const none = new Set<number>();
    expect(tileBlocked(w, none, 0, 0)).toBe(true);
    expect(tileBlocked(w, none, 2, 2)).toBe(false);
    expect(moveWithCollision(w, none, { x: 1.5, y: 2.5 }, -1, 0).x).toBeCloseTo(1.5, 0);
    expect(moveWithCollision(w, none, { x: 1.5, y: 2.5 }, -1, 0).x).toBeGreaterThanOrEqual(1.28);
    expect(moveWithCollision(w, none, { x: 2.5, y: 2.5 }, 0.5, 0)).toEqual({ x: 3, y: 2.5 });
    expect(speedFactor(w, 2.5, 2.5)).toBe(1);
  });
});

describe('dungeon tiles', () => {
  it('has three themes with four floor tiles, a wall face and a wall top each, all packed', () => {
    expect(DUNGEON_THEMES).toEqual(['moss', 'mine', 'ruin']);
    for (const theme of DUNGEON_THEMES) {
      const t = themeTiles(theme);
      expect(t[T.FLOOR].length, theme).toBe(4);
      for (const [name, weight] of [...t[T.FLOOR], ...t[T.WALL]]) {
        expect(TILE_FRAMES[name], name).toBeTypeOf('number');
        expect(weight).toBeGreaterThan(0);
      }
      expect(TILE_FRAMES[`wallface.${theme}`], theme).toBeTypeOf('number');
      expect(TILE_FRAMES[`walltop.${theme}`], theme).toBeTypeOf('number');
    }
  });

  it('draws the lit face of a wall where floor lies to its south, and a dark top elsewhere', () => {
    const w = room();
    const face = TILE_FRAMES['wallface.mine'];
    const top = TILE_FRAMES['walltop.mine'];
    // The north wall has floor to its south only one row down, so its own south neighbour (y = 1) is floor: it is a face.
    expect(dungeonFrame(w, 2, 0, 'mine')).toBe(face);
    expect(dungeonFrame(w, 0, 2, 'mine')).toBe(top);
    expect(dungeonFrame(w, 5, 2, 'mine')).toBe(top);
    expect(dungeonFrame(w, 2, 5, 'mine')).toBe(top);
    expect(dungeonFrame(w, 0, 0, 'mine')).toBe(top);
  });

  it('shows a wall face for a wall tile whose south neighbour is floor', () => {
    const w = room();
    // Put a wall in the middle of the floor: the tile above it is floor, the one it stands on has floor to its south.
    w.terrain[idx(2, 2, 6)] = T.WALL;
    expect(dungeonFrame(w, 2, 2, 'ruin')).toBe(TILE_FRAMES['wallface.ruin']);
    expect(dungeonFrame(w, 0, 3, 'ruin')).toBe(TILE_FRAMES['walltop.ruin']);
  });

  it('is stable for a position and mixes the floor variants, favouring the plain one', () => {
    const w = room();
    const counts = new Map<number, number>();
    for (let i = 0; i < 40; i++) expect(dungeonFrame(w, 1 + (i % 4), 2, 'moss')).toBe(dungeonFrame(w, 1 + (i % 4), 2, 'moss'));
    const big: World = { ...w, size: 40, terrain: new Uint8Array(1600).fill(T.FLOOR) };
    for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) counts.set(dungeonFrame(big, x, y, 'moss'), (counts.get(dungeonFrame(big, x, y, 'moss')) ?? 0) + 1);
    expect(counts.size).toBeGreaterThan(1);
    expect(counts.get(TILE_FRAMES['floor.moss.0'])!).toBeGreaterThan(1600 * 0.4);
  });

  it.skipIf(!fs.existsSync(path.resolve(__dirname, '../public/assets/pack/tiles.png')))('packs every frame the index names into the sheet', () => {
    const png = fs.readFileSync(path.resolve(__dirname, '../public/assets/pack/tiles.png'));
    const height = png.readUInt32BE(20);
    const width = png.readUInt32BE(16);
    expect((width / 16) * (height / 16)).toBeGreaterThanOrEqual(Math.max(...Object.values(TILE_FRAMES)) + 1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/dungeon-terrain.test.ts`
Expected: FAIL. `themeTiles` and `dungeonFrame` do not exist, and the terrain ids are missing.

- [ ] **Step 3: Write the code**

The two new terrain ids (the dungeon uses them; the island never does):

`src/sim/world/types.ts`:

```typescript
export const WORLD_SIZE = 160;

/** Island terrain, plus the floor and walls of dungeon interiors (FLOOR and WALL only occur in dungeons). */
export const T = { DEEP: 0, SHALLOW: 1, SAND: 2, GRASS: 3, SWAMP: 4, DIRT: 5, STONE: 6, DESERT: 7, RIVER: 8, FLOOR: 9, WALL: 10 } as const;
export type Terrain = (typeof T)[keyof typeof T];

export const B = { SEA: 0, FOREST: 1, MOUNTAIN: 2, SWAMP: 3, DESERT: 4 } as const;
export type Biome = (typeof B)[keyof typeof B];

export const isWater = (t: number): boolean => t === T.DEEP || t === T.SHALLOW || t === T.RIVER;
/** The player can wade through shallow water and rivers; only deep water and dungeon walls block. */
export const isWalkable = (t: number): boolean => t !== T.DEEP && t !== T.WALL;

export type LandmarkId =
  | 'start' | 'camp' | 'sailor' | 'herbalist' | 'miner' | 'grotto' | 'deepmine' | 'ruin'
  | 'lighthouse' | 'tablets' | 'treasure1' | 'treasure2' | 'treasure3';

export interface Landmark {
  id: LandmarkId;
  x: number;
  y: number;
  biome: Biome;
}

export type ResourceKind = 'tree' | 'palm' | 'bush' | 'rock' | 'ore' | 'crystal' | 'swamptree' | 'redrock';

export interface ResourceNode {
  id: number;
  kind: ResourceKind;
  x: number;
  y: number;
  /** Random 0..255; the renderer picks a sprite as variant % frames.length. */
  variant: number;
}

export interface World {
  seed: number;
  size: number;
  terrain: Uint8Array;
  biome: Uint8Array;
  landmarks: Landmark[];
  resources: ResourceNode[];
  start: { x: number; y: number };
}

export const idx = (x: number, y: number, size = WORLD_SIZE): number => y * size + x;
export const inBounds = (x: number, y: number, size = WORLD_SIZE): boolean => x >= 0 && y >= 0 && x < size && y < size;
```

In `src/sim/movement.ts`, make walls block movement. Change:

```ts
  return world.terrain[i] === T.DEEP || solids.has(i);
```

to:

```ts
  return world.terrain[i] === T.DEEP || world.terrain[i] === T.WALL || solids.has(i);
```

Themed tiles and which frame a dungeon tile uses:

`src/data/terrainTiles.ts`:

```typescript
import { T, type Terrain } from '@/sim/world/types';
import type { TileName } from './tileIndex';

/** Texture key of the packed ground tiles (public/assets/pack/tiles.png, 16x16 frames). */
export const TILES_KEY = 'tiles_ss';

type Weighted = readonly (readonly [TileName, number])[];

/** Ground tiles by terrain; the flat tile dominates so the speckles read as texture, not noise. */
export const GROUND_TILES: Record<Terrain, Weighted> = {
  [T.DEEP]: [['water.deep', 1]],
  [T.SHALLOW]: [['water.shallow', 1]],
  [T.RIVER]: [['water.shallow', 1]],
  [T.SAND]: [['sand.0', 10], ['sand.1', 3], ['sand.2', 3], ['sand.3', 3]],
  [T.GRASS]: [['grass.0', 10], ['grass.1', 3], ['grass.2', 3], ['grass.3', 2], ['grass.4', 2]],
  [T.SWAMP]: [['swamp.0', 10], ['swamp.1', 3], ['swamp.2', 3], ['swamp.3', 3]],
  [T.DIRT]: [['dirt.0', 10], ['dirt.1', 3], ['dirt.2', 3], ['dirt.3', 3]],
  [T.STONE]: [['stone.0', 1]],
  [T.DESERT]: [['desert.0', 10], ['desert.1', 3], ['desert.2', 3], ['desert.3', 3]],
  [T.FLOOR]: [['floor.mine.0', 10], ['floor.mine.1', 3], ['floor.mine.2', 3], ['floor.mine.3', 2]],
  [T.WALL]: [['walltop.mine', 1]],
};

/** Looks of the three dungeons: mossy grotto, brown mine, sandstone ruin. */
export const DUNGEON_THEMES = ['moss', 'mine', 'ruin'] as const;
export type DungeonTheme = (typeof DUNGEON_THEMES)[number];

/** Floor and wall tiles of one dungeon theme. */
export function themeTiles(theme: DungeonTheme): Record<typeof T.FLOOR | typeof T.WALL, Weighted> {
  return {
    [T.FLOOR]: [[`floor.${theme}.0`, 10], [`floor.${theme}.1`, 3], [`floor.${theme}.2`, 3], [`floor.${theme}.3`, 2]],
    [T.WALL]: [[`walltop.${theme}`, 1]],
  };
}
```

`src/sim/tileView.ts`:

```typescript
import { GROUND_TILES, themeTiles, type DungeonTheme } from '@/data/terrainTiles';
import { TILE_FRAMES } from '@/data/tileIndex';
import { T, idx, inBounds, isWater, type Terrain, type World } from '@/sim/world/types';

/** Stable pseudo-random number in [0, 1) for a tile, so the same tile always looks the same. */
export function tileHash(x: number, y: number, seed = 0): number {
  let h = (seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Frame index (in tiles.png) of the ground tile to draw at (x, y). */
export function groundFrame(terrain: number, x: number, y: number): number {
  const list = GROUND_TILES[terrain as Terrain];
  const total = list.reduce((s, [, w]) => s + w, 0);
  let roll = tileHash(x, y) * total;
  for (const [name, w] of list) {
    roll -= w;
    if (roll < 0) return TILE_FRAMES[name];
  }
  return TILE_FRAMES[list[list.length - 1][0]];
}

/** Frame of the dungeon tile at (x, y): a themed floor variant, the lit face of a wall that has floor to its south, or a wall top. */
export function dungeonFrame(world: World, x: number, y: number, theme: DungeonTheme): number {
  const here = world.terrain[idx(x, y, world.size)];
  if (here === T.WALL) {
    const below = inBounds(x, y + 1, world.size) ? world.terrain[idx(x, y + 1, world.size)] : T.WALL;
    return TILE_FRAMES[below === T.FLOOR ? (`wallface.${theme}` as const) : (`walltop.${theme}` as const)];
  }
  const list = themeTiles(theme)[T.FLOOR];
  const total = list.reduce((s, [, w]) => s + w, 0);
  let roll = tileHash(x, y) * total;
  for (const [name, w] of list) {
    roll -= w;
    if (roll < 0) return TILE_FRAMES[name];
  }
  return TILE_FRAMES[list[list.length - 1][0]];
}

export const SHORE_N = 1;
export const SHORE_E = 2;
export const SHORE_S = 4;
export const SHORE_W = 8;

/** For a water tile: which of its four sides touch land (a foam line is drawn there). 0 for land tiles. */
export function shoreMask(w: World, x: number, y: number): number {
  if (!isWater(w.terrain[idx(x, y, w.size)])) return 0;
  const land = (nx: number, ny: number): boolean => inBounds(nx, ny, w.size) && !isWater(w.terrain[idx(nx, ny, w.size)]);
  return (land(x, y - 1) ? SHORE_N : 0) | (land(x + 1, y) ? SHORE_E : 0) | (land(x, y + 1) ? SHORE_S : 0) | (land(x - 1, y) ? SHORE_W : 0);
}
```

- [ ] **Step 4: Draw and pack the tiles**

The pack has no dungeon floor or wall at this size, so the flagstones, the brick face and the dark top are drawn in `pack_tiles.py` (three palettes, four floor variants each). The ground tiles of the island keep their numbers; the new ones are appended.

`tools/pack_tiles.py`:

```python
"""Pack the ground tiles Tidewake draws into one small sheet and write src/data/tileIndex.ts.

Raw tiles come from the read-only Unity pack (Super Retro Collection). The pack has no seamless sand/desert/dirt/swamp
ground, so those are recoloured copies of its speckled grass tiles. Nothing in the asset master is modified.
Run: python tools/pack_tiles.py
"""
import random
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


# Dungeon looks: (floor, mortar, brick, brick shadow, wall top, accent). The pack has no dungeon floor or wall at this
# size, so the flagstones and brick are drawn here, a few pixels at a time.
THEMES = {
    "moss": ((78, 96, 74), (54, 70, 56), (104, 118, 98), (72, 88, 72), (30, 38, 34), (92, 150, 70)),
    "mine": ((108, 94, 86), (76, 64, 58), (134, 108, 90), (96, 74, 62), (40, 33, 31), (150, 120, 84)),
    "ruin": ((216, 190, 140), (178, 152, 106), (226, 200, 152), (186, 158, 110), (88, 68, 48), (198, 150, 80)),
}


def shade(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c) + (255,)


def floor_tile(theme, variant):
    """Flagstones: 2 x 2 stones divided by mortar lines, a little different in each variant."""
    floor, mortar, _brick, _shadow, _top, accent = THEMES[theme]
    rng = random.Random(f"{theme}:{variant}")
    img = Image.new("RGBA", (TILE, TILE), shade(floor, 1.0))
    px = img.load()
    cut = 7 + (variant % 2)
    for i in range(TILE):
        for j in (0, cut):
            px[i, j] = shade(mortar, 1.0)
            px[j, i] = shade(mortar, 1.0)
    for _ in range(8 + variant * 2):
        x, y = rng.randrange(TILE), rng.randrange(TILE)
        px[x, y] = shade(floor, rng.choice([0.88, 1.1]))
    if variant == 3:
        for _ in range(3):
            px[rng.randrange(TILE), rng.randrange(TILE)] = shade(accent, 0.9)
    return img


def wall_face(theme):
    """The lit front of a wall: brick courses with a bright top edge and a shadowed foot."""
    _floor, mortar, brick, shadow, _top, accent = THEMES[theme]
    img = Image.new("RGBA", (TILE, TILE), shade(brick, 1.0))
    px = img.load()
    for row in range(4):
        y = row * 4 + 3
        for x in range(TILE):
            px[x, y] = shade(mortar, 1.0)
        offset = 0 if row % 2 == 0 else 4
        for x in range(offset, TILE, 8):
            for yy in range(row * 4, row * 4 + 3):
                px[x, yy] = shade(mortar, 1.0)
    for x in range(TILE):
        px[x, 0] = shade(brick, 1.25)
        px[x, TILE - 1] = shade(shadow, 0.8)
    rng = random.Random(f"face:{theme}")
    for _ in range(5):
        px[rng.randrange(TILE), rng.randrange(1, TILE - 1)] = shade(accent, 0.8) if theme == "moss" else shade(shadow, 1.0)
    return img


def wall_top(theme):
    """The top of a wall seen from above: dark, with a faint grain."""
    top = THEMES[theme][4]
    rng = random.Random(f"top:{theme}")
    img = Image.new("RGBA", (TILE, TILE), shade(top, 1.0))
    px = img.load()
    for _ in range(14):
        px[rng.randrange(TILE), rng.randrange(TILE)] = shade(top, rng.choice([0.8, 1.25]))
    return img


def dungeon_tiles():
    tiles = []
    for theme in THEMES:
        for variant in range(4):
            tiles.append((f"floor.{theme}.{variant}", floor_tile(theme, variant)))
        tiles.append((f"wallface.{theme}", wall_face(theme)))
        tiles.append((f"walltop.{theme}", wall_top(theme)))
    return tiles


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
    return tiles + dungeon_tiles()


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

Run: `python tools/pack_tiles.py`
Expected: prints `packed 44 tiles into 128x96` and rewrites `public/assets/pack/tiles.png` and `src/data/tileIndex.ts` (the old 26 entries are unchanged; 18 are added: `floor.<theme>.0..3`, `wallface.<theme>`, `walltop.<theme>`).

- [ ] **Step 5: Run the tests, the typecheck and the whole suite**

Run: `npx vitest run tests/dungeon-terrain.test.ts && npm run typecheck && npm test`
Expected: dungeon-terrain 7 tests PASS; typecheck exits 0; the whole suite passes (408 tests; `tests/tiles.test.ts` now also covers the two new terrain ids).

- [ ] **Step 6: Commit**

```bash
git add src/sim/world/types.ts src/sim/movement.ts src/data/terrainTiles.ts src/data/tileIndex.ts src/sim/tileView.ts tools/pack_tiles.py public/assets/pack/tiles.png tests/dungeon-terrain.test.ts
git commit -m "feat: add floor and wall terrain with three dungeon looks"
```

---

### Task 3: The dungeon generator

**Files:**
- Create: `src/data/dungeons.ts`, `src/sim/dungeon/layout.ts`, `src/sim/dungeon/types.ts`, `src/sim/dungeon/generate.ts`, `tests/helpers/dungeonSolve.ts`
- Test: `tests/dungeon-generate.test.ts` (new)

**Interfaces:**
- Consumes: `DungeonId` (Task 1), the creature roster, `T`, `World`, `Rng`.
- Produces: `BossId = 'mossback' | 'ironbones' | 'mirelord'`, `DungeonDef {id, theme, roster, boss, story, armor}`, `DUNGEONS`; `DUNGEON_SIZE = 48`, `ROOM_W = 13`, `ROOM_H = 11`, `CELLS`, `LINKS`, `roomOrigin`, `doorwayBetween`; `Room`, `RoomKind`, `Door {id, x, y, lock: 'free' | 'room' | 'boss', room, vertical}`, `Switch`, `Block`, `Pillar`, `Crystal`, `Trap {id, x, y, phase}`, `Chest {id, x, y, locked, loot}`, `Spawn`, `Torch`, `Dungeon {id, seed, theme, world, rooms, doors, switches, blocks, pillars, crystals, traps, chests, spawns, boss, torches, entry, exit}`; `generateDungeon(seed, id) -> Dungeon`.

- [ ] **Step 1: Write the failing test and its helper**

The helper plays a dungeon abstractly: it opens what can be opened and collects what can be reached until nothing changes.

`tests/helpers/dungeonSolve.ts`:

```typescript
import type { Dungeon, Door } from '@/sim/dungeon/types';
import { ROOM_H, ROOM_W } from '@/sim/dungeon/layout';
import { T, idx } from '@/sim/world/types';

/** Tiles the hero can reach from the entrance, given which doors count as open. Pillars, crystals, chests and blocks are solid. */
export function reachable(d: Dungeon, isOpen: (door: Door) => boolean): Set<number> {
  const size = d.world.size;
  const solid = new Set<number>();
  for (const p of d.pillars) solid.add(idx(p.x, p.y, size));
  for (const c of d.crystals) solid.add(idx(c.x, c.y, size));
  for (const c of d.chests) solid.add(idx(c.x, c.y, size));
  for (const b of d.blocks) solid.add(idx(b.x, b.y, size));
  for (const door of d.doors) if (!isOpen(door)) solid.add(idx(door.x, door.y, size));
  const start = idx(Math.floor(d.entry.x), Math.floor(d.entry.y), size);
  const seen = new Set<number>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const cur = queue.pop()!;
    const x = cur % size;
    const y = Math.floor(cur / size);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const n = idx(nx, ny, size);
      if (seen.has(n) || solid.has(n) || d.world.terrain[n] !== T.FLOOR) continue;
      seen.add(n);
      queue.push(n);
    }
  }
  return seen;
}

export interface Playthrough {
  reachedBoss: boolean;
  keysLeft: number;
  gotBossKey: boolean;
  openDoors: number;
  chestsOpened: number;
}

/** Play the dungeon abstractly: open what can be opened, collect what can be reached, until nothing changes. */
export function playthrough(d: Dungeon): Playthrough {
  const size = d.world.size;
  const open = new Set<number>();
  let keys = 0;
  let bossKey = false;
  const opened = new Set<number>();
  for (let round = 0; round < 40; round++) {
    const reach = reachable(d, (door) => open.has(door.id));
    const inRoom = (roomId: number): boolean => {
      const r = d.rooms[roomId];
      for (let y = r.y0; y < r.y0 + ROOM_H; y++) for (let x = r.x0; x < r.x0 + ROOM_W; x++) if (reach.has(idx(x, y, size))) return true;
      return false;
    };
    const adjacent = (x: number, y: number): boolean => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => reach.has(idx(x + dx, y + dy, size)));
    let changed = false;
    for (const door of d.doors) {
      if (open.has(door.id)) continue;
      const ok = door.lock === 'free' || (door.lock === 'room' && door.room !== null && inRoom(door.room)) || (door.lock === 'boss' && bossKey && adjacent(door.x, door.y));
      if (ok) {
        open.add(door.id);
        changed = true;
      }
    }
    for (const chest of d.chests) {
      if (opened.has(chest.id) || !adjacent(chest.x, chest.y)) continue;
      if (chest.locked) {
        if (keys === 0) continue;
        keys -= 1;
      }
      opened.add(chest.id);
      changed = true;
      for (const l of chest.loot) {
        if (l.item === 'small_key') keys += l.qty;
        if (l.item === 'boss_key') bossKey = true;
      }
    }
    if (!changed) break;
  }
  const finalReach = reachable(d, (door) => open.has(door.id));
  return {
    reachedBoss: finalReach.has(idx(d.boss.x, d.boss.y, size)) || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => finalReach.has(idx(d.boss.x + dx, d.boss.y + dy, size))),
    keysLeft: keys,
    gotBossKey: bossKey,
    openDoors: open.size,
    chestsOpened: opened.size,
  };
}
```

`tests/dungeon-generate.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { DUNGEONS } from '@/data/dungeons';
import { ITEMS } from '@/data/items';
import { CREATURES } from '@/data/creatures';
import { DUNGEON_SIZE, ROOM_H, ROOM_W } from '@/sim/dungeon/layout';
import { DUNGEON_IDS } from '@/sim/dungeon/progress';
import { generateDungeon } from '@/sim/dungeon/generate';
import type { Dungeon } from '@/sim/dungeon/types';
import { T, idx } from '@/sim/world/types';
import { playthrough, reachable } from './helpers/dungeonSolve';

const SEEDS = [1, 2, 3, 4242, 99991, 123456789];
const all = (): [string, Dungeon][] => DUNGEON_IDS.flatMap((id) => SEEDS.map((seed) => [`${id}/${seed}`, generateDungeon(seed, id)] as [string, Dungeon]));

describe('dungeon definitions', () => {
  it('names a theme, a roster of real creatures, a boss, a story item and an armour reward for each dungeon', () => {
    expect(DUNGEON_IDS).toEqual(['grotto', 'deepmine', 'ruin']);
    expect(DUNGEONS.grotto.theme).toBe('moss');
    expect(DUNGEONS.deepmine.theme).toBe('mine');
    expect(DUNGEONS.ruin.theme).toBe('ruin');
    for (const id of DUNGEON_IDS) {
      const def = DUNGEONS[id];
      expect(def.roster.length, id).toBeGreaterThanOrEqual(3);
      for (const kind of def.roster) expect(CREATURES[kind], `${id}: ${kind}`).toBeDefined();
      expect(ITEMS[def.story].stack, id).toBe(1);
      expect(ITEMS[def.armor].armor, id).toBeDefined();
    }
    expect(new Set(DUNGEON_IDS.map((id) => DUNGEONS[id].boss)).size).toBe(3);
  });
});

describe('generateDungeon', () => {
  it('is the same dungeon for the same seed and a different one for another seed', () => {
    const a = generateDungeon(7, 'grotto');
    const b = generateDungeon(7, 'grotto');
    expect(Array.from(a.world.terrain)).toEqual(Array.from(b.world.terrain));
    expect(a.spawns).toEqual(b.spawns);
    expect(a.rooms.map((r) => r.kind)).toEqual(b.rooms.map((r) => r.kind));
    const kinds = new Set(SEEDS.map((s) => generateDungeon(s, 'grotto').rooms.map((r) => r.kind).join(',')));
    expect(kinds.size).toBeGreaterThan(2);
  });

  it('makes a 48 by 48 world with a fixed chain of eight rooms: entrance, four puzzles, a vault, the boss and a side room', () => {
    for (const [name, d] of all()) {
      expect(d.world.size, name).toBe(DUNGEON_SIZE);
      expect(d.rooms.map((r) => r.id), name).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
      const kinds = d.rooms.map((r) => r.kind);
      expect([kinds[0], kinds[5], kinds[6], kinds[7]], name).toEqual(['entrance', 'vault', 'boss', 'side']);
      expect([...kinds.slice(1, 5)].sort(), name).toEqual(['block', 'crystal', 'fight', 'trap']);
      expect(d.doors, name).toHaveLength(7);
    }
  });

  it('puts every floor, door, object and creature on a floor tile, and no two solid things on the same tile', () => {
    for (const [name, d] of all()) {
      const size = d.world.size;
      const taken = new Map<number, string>();
      const put = (x: number, y: number, what: string, solid = true): void => {
        expect(d.world.terrain[idx(x, y, size)], `${name}: ${what} at ${x},${y}`).toBe(T.FLOOR);
        if (!solid) return;
        const key = idx(x, y, size);
        expect(taken.get(key), `${name}: ${what} overlaps ${taken.get(key)} at ${x},${y}`).toBeUndefined();
        taken.set(key, what);
      };
      d.doors.forEach((o) => put(o.x, o.y, 'door'));
      d.switches.forEach((o) => put(o.x, o.y, 'switch', false));
      d.blocks.forEach((o) => put(o.x, o.y, 'block'));
      d.pillars.forEach((o) => expect(d.world.terrain[idx(o.x, o.y, size)], `${name}: pillar at ${o.x},${o.y} is wall`).toBe(T.WALL));
      d.crystals.forEach((o) => put(o.x, o.y, 'crystal'));
      d.chests.forEach((o) => put(o.x, o.y, 'chest'));
      d.traps.forEach((o) => put(o.x, o.y, 'trap', false));
      d.spawns.forEach((o) => put(o.x, o.y, 'spawn', false));
      put(d.boss.x, d.boss.y, 'boss', false);
      put(Math.floor(d.entry.x), Math.floor(d.entry.y), 'entry', false);
      put(d.exit.x, d.exit.y, 'exit');
      d.torches.forEach((t) => expect(d.world.terrain[idx(t.x, t.y, size)], `${name}: torch`).toBe(T.WALL));
    }
  });

  it('joins rooms through doorways that are floor between two wall tiles, and walls everything else in', () => {
    for (const [name, d] of all()) {
      const size = d.world.size;
      for (const door of d.doors) {
        // A doorway in a vertical wall (rooms side by side) has wall above and below it; in a horizontal wall, left and right.
        const wallsOnSides = door.vertical
          ? [d.world.terrain[idx(door.x, door.y - 1, size)], d.world.terrain[idx(door.x, door.y + 1, size)]]
          : [d.world.terrain[idx(door.x - 1, door.y, size)], d.world.terrain[idx(door.x + 1, door.y, size)]];
        expect(wallsOnSides, `${name}: door ${door.id}`).toEqual([T.WALL, T.WALL]);
      }
      for (let i = 0; i < size; i++) {
        for (const [x, y] of [[i, 0], [i, size - 1], [0, i], [size - 1, i]] as const) expect(d.world.terrain[idx(x, y, size)], name).toBe(T.WALL);
      }
      const pillar = new Set(d.pillars.map((p) => idx(p.x, p.y, size)));
      for (const r of d.rooms) {
        for (let y = r.y0; y < r.y0 + ROOM_H; y++) {
          for (let x = r.x0; x < r.x0 + ROOM_W; x++) expect(d.world.terrain[idx(x, y, size)], `${name}: room ${r.id} at ${x},${y}`).toBe(pillar.has(idx(x, y, size)) ? T.WALL : T.FLOOR);
        }
      }
    }
  });

  it('can always be played through: with two small keys the boss can be reached, and nothing is left locked', () => {
    for (const [name, d] of all()) {
      const p = playthrough(d);
      expect(p.reachedBoss, name).toBe(true);
      expect(p.gotBossKey, name).toBe(true);
      expect(p.openDoors, name).toBe(7);
      expect(p.chestsOpened, name).toBe(d.chests.length);
      expect(p.keysLeft, name).toBe(0);
    }
  });

  it('never leaves the boss or the boss key reachable without passing through the puzzle rooms', () => {
    for (const [name, d] of all()) {
      const start = reachable(d, (door) => door.lock === 'free');
      const size = d.world.size;
      expect(start.has(idx(d.boss.x, d.boss.y, size)), name).toBe(false);
      // Even with every puzzle solved, only the boss key opens the last door.
      expect(d.doors.filter((door) => door.lock === 'boss'), name).toHaveLength(1);
      const solved = reachable(d, (door) => door.lock !== 'boss');
      expect(solved.has(idx(d.boss.x, d.boss.y, size)), name).toBe(false);
      const vault = d.chests.find((c) => c.loot.some((l) => l.item === 'boss_key'))!;
      expect(vault.locked, name).toBe(true);
      expect([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => start.has(idx(vault.x + dx, vault.y + dy, size))), name).toBe(false);
    }
  });

  it('hands out exactly as many small keys as there are locked chests, and puts the free key chest next to the entrance', () => {
    for (const [name, d] of all()) {
      const supply = d.chests.filter((c) => !c.locked).flatMap((c) => c.loot).filter((l) => l.item === 'small_key').reduce((n, l) => n + l.qty, 0);
      expect(d.chests.filter((c) => c.locked).length, name).toBe(supply);
      const free = d.chests.find((c) => !c.locked)!;
      expect(d.rooms[7].kind).toBe('side');
      expect(free.x).toBeGreaterThanOrEqual(d.rooms[7].x0);
      expect(free.x).toBeLessThan(d.rooms[7].x0 + ROOM_W);
      for (const c of d.chests) for (const l of c.loot) expect(ITEMS[l.item], `${name}: ${l.item}`).toBeDefined();
    }
  });

  it('gives each block puzzle a lane the block can only slide along, ending on the switch', () => {
    for (const [name, d] of all()) {
      const room = d.rooms.find((r) => r.kind === 'block')!;
      const block = d.blocks.find((b) => b.room === room.id)!;
      const sw = d.switches.find((s) => s.room === room.id)!;
      expect(sw.y, name).toBe(block.y);
      expect(sw.x, name).toBeGreaterThan(block.x);
      const at = (x: number, y: number): boolean => d.pillars.some((p) => p.x === x && p.y === y);
      for (let x = block.x; x <= sw.x; x++) {
        expect(at(x, block.y - 1), `${name}: wall above ${x}`).toBe(true);
        expect(at(x, block.y + 1), `${name}: wall below ${x}`).toBe(true);
        if (x > block.x) expect(at(x, block.y), `${name}: lane free at ${x}`).toBe(false);
      }
      expect(at(sw.x + 1, sw.y), `${name}: end cap`).toBe(true);
      expect(d.blocks.filter((b) => b.room === room.id)).toHaveLength(1);
    }
  });

  it('spawns only creatures from the dungeon roster in fight rooms and the vault, away from the doorways, and the boss in its own room', () => {
    for (const id of DUNGEON_IDS) {
      for (const seed of SEEDS) {
        const d = generateDungeon(seed, id);
        const def = DUNGEONS[id];
        expect(d.boss.kind).toBe(def.boss);
        expect(d.boss.room).toBe(6);
        for (const s of d.spawns) {
          expect(def.roster, `${id}/${seed}`).toContain(s.kind);
          expect(['fight', 'vault']).toContain(d.rooms[s.room].kind);
          for (const door of d.doors) expect(Math.hypot(door.x - s.x, door.y - s.y), `${id}/${seed}: spawn near door`).toBeGreaterThanOrEqual(3);
        }
        for (const r of d.rooms) {
          const n = d.spawns.filter((s) => s.room === r.id).length;
          if (r.kind === 'fight') expect(n).toBeGreaterThanOrEqual(3);
          if (r.kind === 'vault') expect(n).toBe(4);
          if (r.kind !== 'fight' && r.kind !== 'vault') expect(n).toBe(0);
        }
      }
    }
  });

  it('puts the hero in the entrance room, one step from an exit doorway in its south wall', () => {
    for (const [name, d] of all()) {
      const room = d.rooms[0];
      expect(Math.floor(d.entry.x), name).toBe(room.x0 + 6);
      expect(d.exit.x, name).toBe(room.x0 + 6);
      expect(d.exit.y, name).toBe(room.y0 + ROOM_H);
      expect(d.world.terrain[idx(d.exit.x, d.exit.y + 1, d.world.size)], name).toBe(T.WALL);
      expect(d.world.start.x).toBe(Math.floor(d.entry.x));
    }
  });

  it('lights the walls with torches and puts crystals, traps and switches only in their own kind of room', () => {
    for (const [name, d] of all()) {
      expect(d.torches.length, name).toBeGreaterThanOrEqual(12);
      expect(d.crystals.length, name).toBe(3);
      for (const c of d.crystals) expect(d.rooms[c.room].kind).toBe('crystal');
      for (const s of d.switches) expect(d.rooms[s.room].kind).toBe('block');
      const trapRoom = d.rooms.find((r) => r.kind === 'trap')!;
      for (const t of d.traps) expect(t.x >= trapRoom.x0 && t.x < trapRoom.x0 + ROOM_W && t.y >= trapRoom.y0 && t.y < trapRoom.y0 + ROOM_H, name).toBe(true);
      expect(new Set(d.traps.map((t) => t.phase))).toEqual(new Set([0, 1]));
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/dungeon-generate.test.ts`
Expected: FAIL, "Failed to resolve import "@/data/dungeons"".

- [ ] **Step 3: Write the data, the geometry and the generator**

`src/data/dungeons.ts`:

```typescript
import type { ItemId } from './items';
import type { CreatureId } from './creatures';
import type { DungeonTheme } from './terrainTiles';
import type { DungeonId } from '@/sim/dungeon/progress';

export type BossId = 'mossback' | 'ironbones' | 'mirelord';

export interface DungeonDef {
  id: DungeonId;
  theme: DungeonTheme;
  /** Creatures that guard the fight rooms and the vault. */
  roster: readonly CreatureId[];
  boss: BossId;
  /** The story item the boss drops. */
  story: ItemId;
  /** The armour the boss drops. */
  armor: ItemId;
}

export const DUNGEONS: Record<DungeonId, DungeonDef> = {
  grotto: { id: 'grotto', theme: 'moss', roster: ['slime', 'mushroom', 'worm'], boss: 'mossback', story: 'compass', armor: 'armor_moss' },
  deepmine: { id: 'deepmine', theme: 'mine', roster: ['skeleton', 'zombie', 'wasp'], boss: 'ironbones', story: 'hull_planks', armor: 'armor_ironbones' },
  ruin: { id: 'ruin', theme: 'ruin', roster: ['scorpion', 'skeleton_warrior', 'ghost'], boss: 'mirelord', story: 'lighthouse_key', armor: 'armor_mire' },
};
```

`src/sim/dungeon/layout.ts`:

```typescript
/** Geometry shared by the dungeon generator and the rules: a 3 by 3 grid of rooms joined in a chain. */
export const DUNGEON_SIZE = 48;
/** Interior of every room, in tiles. */
export const ROOM_W = 13;
export const ROOM_H = 11;
/** Distance between the same corner of two neighbouring rooms: the interior plus one shared wall. */
export const PITCH_X = ROOM_W + 1;
export const PITCH_Y = ROOM_H + 1;
/** Solid margin around the whole grid. */
export const ORIGIN = 2;

/** Grid cell (column, row) of each of the eight rooms: the entrance, four puzzles, the vault, the boss and the side room. */
export const CELLS: readonly (readonly [number, number])[] = [[1, 2], [2, 2], [2, 1], [1, 1], [0, 1], [0, 0], [1, 0], [0, 2]];
/** Pairs of rooms joined by a doorway. */
export const LINKS: readonly (readonly [number, number])[] = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [0, 7]];

/** Top-left tile of a room's interior. */
export function roomOrigin(col: number, row: number): { x0: number; y0: number } {
  return { x0: ORIGIN + 1 + col * PITCH_X, y0: ORIGIN + 1 + row * PITCH_Y };
}

/** The doorway tile between two neighbouring cells; `vertical` means it sits in a vertical wall (an east-west link). */
export function doorwayBetween(a: readonly [number, number], b: readonly [number, number]): { x: number; y: number; vertical: boolean } {
  const first = roomOrigin(Math.min(a[0], b[0]), Math.min(a[1], b[1]));
  if (a[1] === b[1]) return { x: first.x0 + ROOM_W, y: first.y0 + (ROOM_H >> 1), vertical: true };
  return { x: first.x0 + (ROOM_W >> 1), y: first.y0 + ROOM_H, vertical: false };
}
```

`src/sim/dungeon/types.ts`:

```typescript
import type { BossId } from '@/data/dungeons';
import type { CreatureId } from '@/data/creatures';
import type { ItemId } from '@/data/items';
import type { DungeonTheme } from '@/data/terrainTiles';
import type { Vec } from '@/sim/movement';
import type { World } from '@/sim/world/types';
import type { DungeonId } from './progress';

export type RoomKind = 'entrance' | 'fight' | 'block' | 'crystal' | 'trap' | 'vault' | 'boss' | 'side';

/** One room; (x0, y0) is the top-left tile of its interior, which is ROOM_W by ROOM_H. */
export interface Room {
  id: number;
  kind: RoomKind;
  col: number;
  row: number;
  x0: number;
  y0: number;
}

/**
 * `free` doors are always open, `room` doors open once the puzzle of room `room` is solved (monsters dead, switch pressed,
 * crystals lit), `boss` doors need the boss key.
 */
export type DoorLock = 'free' | 'room' | 'boss';

export interface Door {
  id: number;
  x: number;
  y: number;
  lock: DoorLock;
  room: number | null;
  /** The doorway is in a vertical wall (it joins rooms side by side). */
  vertical: boolean;
}

export interface Switch {
  id: number;
  x: number;
  y: number;
  room: number;
}

export interface Block {
  id: number;
  x: number;
  y: number;
  room: number;
}

/** A short stretch of wall inside a room (the walls of a block lane). The terrain draws it; it is listed so the rules know where it is. */
export interface Pillar {
  x: number;
  y: number;
}

export interface Crystal {
  id: number;
  x: number;
  y: number;
  room: number;
}

/** A spike trap; the two phases take turns, so half the traps are up at any moment. */
export interface Trap {
  id: number;
  x: number;
  y: number;
  phase: 0 | 1;
}

export interface Chest {
  id: number;
  x: number;
  y: number;
  /** Needs a small key. */
  locked: boolean;
  loot: readonly { item: ItemId; qty: number }[];
}

export interface Spawn {
  kind: CreatureId;
  x: number;
  y: number;
  room: number;
}

export interface Torch {
  x: number;
  y: number;
}

/** A generated dungeon: the walls and floor as a World, and everything standing in it. All positions are tile coordinates. */
export interface Dungeon {
  id: DungeonId;
  seed: number;
  theme: DungeonTheme;
  world: World;
  rooms: Room[];
  doors: Door[];
  switches: Switch[];
  blocks: Block[];
  pillars: Pillar[];
  crystals: Crystal[];
  traps: Trap[];
  chests: Chest[];
  spawns: Spawn[];
  boss: { kind: BossId; x: number; y: number; room: number };
  torches: Torch[];
  /** Where the hero appears (tile centre). */
  entry: Vec;
  /** The doorway out, in the south wall of the entrance room. */
  exit: { x: number; y: number };
}
```

The chain: entrance, four puzzle rooms in a seeded order, the vault, the boss room, and a side room. The block puzzle is a lane of wall that a block can only slide along; the crystal room has three crystals; the trap room is a field of spikes with a locked treasure chest behind it; the free chest in the side room holds the two small keys; the vault's locked chest holds the boss key.

`src/sim/dungeon/generate.ts`:

```typescript
import { Rng, hashString } from '@/core/rng';
import { DUNGEONS } from '@/data/dungeons';
import { T, idx, type World } from '@/sim/world/types';
import { CELLS, DUNGEON_SIZE, LINKS, ROOM_H, ROOM_W, doorwayBetween, roomOrigin } from './layout';
import type { DungeonId } from './progress';
import type { Block, Chest, Crystal, Door, Dungeon, Pillar, Room, RoomKind, Spawn, Switch, Torch, Trap } from './types';

const PUZZLES: readonly RoomKind[] = ['fight', 'block', 'crystal', 'trap'];
/** Creatures stay at least this far from every doorway when a room is populated. */
const DOOR_CLEARANCE = 3;

/** Everything one room adds to the dungeon. Positions are given relative to the room and shifted by `place`. */
interface Contents {
  switches: Switch[];
  blocks: Block[];
  pillars: Pillar[];
  crystals: Crystal[];
  traps: Trap[];
  chests: Chest[];
  spawns: Spawn[];
}

const emptyContents = (): Contents => ({ switches: [], blocks: [], pillars: [], crystals: [], traps: [], chests: [], spawns: [] });

/** A lane two pillars wide, closed at the far end: a block can only slide along it, onto the switch. */
function blockPuzzle(room: Room, out: Contents): void {
  const at = (x: number, y: number) => ({ x: room.x0 + x, y: room.y0 + y });
  for (let x = 4; x <= 10; x++) {
    out.pillars.push(at(x, 2), at(x, 4));
  }
  out.pillars.push(at(10, 3));
  out.blocks.push({ id: 0, ...at(4, 3), room: room.id });
  out.switches.push({ id: 0, ...at(9, 3), room: room.id });
}

function crystalPuzzle(room: Room, out: Contents): void {
  [[2, 2], [10, 2], [6, 8]].forEach(([x, y], i) => out.crystals.push({ id: i, x: room.x0 + x, y: room.y0 + y, room: room.id }));
}

/** A field of spikes where neighbouring columns take turns: crossing it takes timing. */
function trapField(room: Room, out: Contents, firstId: number): void {
  let id = firstId;
  for (let y = 3; y <= 7; y++) {
    for (let x = 3; x <= 9; x++) out.traps.push({ id: id++, x: room.x0 + x, y: room.y0 + y, phase: (x % 2) as 0 | 1 });
  }
}

/** Creatures standing where they do not block a doorway. */
function populate(room: Room, count: number, roster: readonly string[], doors: readonly Door[], taken: ReadonlySet<string>, rng: Rng, out: Contents): void {
  const spots: { x: number; y: number }[] = [];
  for (let y = room.y0 + 2; y <= room.y0 + 8; y++) {
    for (let x = room.x0 + 2; x <= room.x0 + 10; x++) {
      if (taken.has(`${x},${y}`)) continue;
      if (doors.some((d) => Math.hypot(d.x - x, d.y - y) < DOOR_CLEARANCE)) continue;
      spots.push({ x, y });
    }
  }
  for (const spot of rng.sample(spots, count)) {
    out.spawns.push({ kind: rng.pick(roster) as Spawn['kind'], x: spot.x, y: spot.y, room: room.id });
  }
}

function carve(terrain: Uint8Array, x0: number, y0: number, w: number, h: number): void {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) terrain[idx(x, y, DUNGEON_SIZE)] = T.FLOOR;
}

/** Build a dungeon from the world seed. The same seed and dungeon always give the same result. */
export function generateDungeon(seed: number, id: DungeonId): Dungeon {
  const def = DUNGEONS[id];
  const rng = new Rng(hashString(`${seed}:dungeon:${id}`));
  const kinds: RoomKind[] = ['entrance', ...rng.shuffle(PUZZLES), 'vault', 'boss', 'side'];
  const rooms: Room[] = CELLS.map(([col, row], i) => ({ id: i, kind: kinds[i], col, row, ...roomOrigin(col, row) }));

  const terrain = new Uint8Array(DUNGEON_SIZE * DUNGEON_SIZE).fill(T.WALL);
  for (const r of rooms) carve(terrain, r.x0, r.y0, ROOM_W, ROOM_H);

  const doors: Door[] = LINKS.map(([a, b], i) => {
    const w = doorwayBetween(CELLS[a], CELLS[b]);
    terrain[idx(w.x, w.y, DUNGEON_SIZE)] = T.FLOOR;
    const puzzle = a >= 1 && a <= 4 && rooms[a].kind !== 'trap';
    const lock = b === 6 ? 'boss' : puzzle ? 'room' : 'free';
    return { id: i, x: w.x, y: w.y, lock, room: lock === 'room' ? a : null, vertical: w.vertical };
  });

  const entrance = rooms[0];
  const exit = { x: entrance.x0 + (ROOM_W >> 1), y: entrance.y0 + ROOM_H };
  terrain[idx(exit.x, exit.y, DUNGEON_SIZE)] = T.FLOOR;

  const out = emptyContents();
  const at = (r: Room, x: number, y: number) => ({ x: r.x0 + x, y: r.y0 + y });
  let chestId = 0;
  for (const room of rooms) {
    if (room.kind === 'block') blockPuzzle(room, out);
    if (room.kind === 'crystal') crystalPuzzle(room, out);
    if (room.kind === 'trap') {
      trapField(room, out, out.traps.length);
      out.chests.push({ id: chestId++, ...at(room, 11, 1), locked: true, loot: [{ item: 'bandage', qty: 3 }, { item: 'honey', qty: 2 }, { item: 'arrow', qty: 12 }] });
    }
    if (room.kind === 'side') out.chests.push({ id: chestId++, ...at(room, 6, 2), locked: false, loot: [{ item: 'small_key', qty: 2 }] });
    if (room.kind === 'vault') out.chests.push({ id: chestId++, ...at(room, 3, 2), locked: true, loot: [{ item: 'boss_key', qty: 1 }] });
  }
  for (const p of out.pillars) terrain[idx(p.x, p.y, DUNGEON_SIZE)] = T.WALL;
  for (const room of rooms) {
    if (room.kind !== 'fight' && room.kind !== 'vault') continue;
    const taken = new Set(out.chests.map((c) => `${c.x},${c.y}`));
    populate(room, room.kind === 'vault' ? 4 : 3 + (room.id % 2), def.roster, doors, taken, rng, out);
  }

  const torches: Torch[] = rooms.flatMap((r) => [at(r, 2, -1), at(r, 10, -1)]);
  const bossRoom = rooms[6];
  const world: World = {
    seed, size: DUNGEON_SIZE, terrain, biome: new Uint8Array(DUNGEON_SIZE * DUNGEON_SIZE), landmarks: [], resources: [],
    start: { x: entrance.x0 + (ROOM_W >> 1), y: entrance.y0 + 8 },
  };
  return {
    id, seed, theme: def.theme, world, rooms, doors, ...out, torches,
    boss: { kind: def.boss, ...at(bossRoom, 9, 5), room: bossRoom.id },
    entry: { x: world.start.x + 0.5, y: world.start.y + 0.5 },
    exit,
  };
}
```

- [ ] **Step 4: Run the test and the typecheck**

Run: `npx vitest run tests/dungeon-generate.test.ts && npm run typecheck`
Expected: 12 tests PASS (three dungeons times six seeds are generated and played through); typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/data/dungeons.ts src/sim/dungeon/layout.ts src/sim/dungeon/types.ts src/sim/dungeon/generate.ts tests/helpers/dungeonSolve.ts tests/dungeon-generate.test.ts
git commit -m "feat: add the dungeon generator, always solvable"
```

---

### Task 4: Dungeon rules

**Files:**
- Create: `src/sim/dungeon/rules.ts`
- Test: `tests/dungeon-rules.test.ts` (new)

**Interfaces:**
- Consumes: Tasks 1 and 3.
- Produces: `Run {dungeon, blocks}`, `newRun(dungeon)`, `doorIsOpen(door, progress)`, `unlockDoor`, `lootChest`, `lightCrystal` (each returns the very same progress when nothing changes), `solidTiles(run, progress)`, `pushBlock(run, progress, blockId, dx, dy) -> Run | null`, `pressedSwitches(run)`, `solveRooms(run, progress, alive) -> DungeonProgress`, `TRAP_CYCLE = 2.4`, `trapState(trap, t)` (`'down' | 'warn' | 'up'`), `trapUnder(run, hero, t)`, `Target`, `targetAt(run, progress, x, y)`, `entranceAt(world, x, y)`, `doorwayOutside(world, id)`.

- [ ] **Step 1: Write the failing test**

`tests/dungeon-rules.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { generateDungeon } from '@/sim/dungeon/generate';
import { emptyProgress, type DungeonProgress } from '@/sim/dungeon/progress';
import {
  TRAP_CYCLE, doorIsOpen, doorwayOutside, entranceAt, lightCrystal, lootChest, newRun, pressedSwitches, pushBlock, solidTiles, solveRooms, targetAt, trapState,
  trapUnder, unlockDoor,
} from '@/sim/dungeon/rules';
import type { Dungeon, Room } from '@/sim/dungeon/types';
import { generateWorld } from '@/sim/world/generate';
import { propSolidTiles } from '@/sim/solids';
import { T, idx, isWater } from '@/sim/world/types';

const dungeon = (): Dungeon => generateDungeon(1, 'grotto');
const room = (d: Dungeon, kind: Room['kind']): Room => d.rooms.find((r) => r.kind === kind)!;
const fresh = (): DungeonProgress => emptyProgress();

describe('doors', () => {
  it('are open when free, when their room is solved, or once unlocked, and closed otherwise', () => {
    const d = dungeon();
    const free = d.doors.find((x) => x.lock === 'free')!;
    const gated = d.doors.find((x) => x.lock === 'room')!;
    const boss = d.doors.find((x) => x.lock === 'boss')!;
    expect(doorIsOpen(free, fresh())).toBe(true);
    expect(doorIsOpen(gated, fresh())).toBe(false);
    expect(doorIsOpen(gated, { ...fresh(), solved: [gated.room!] })).toBe(true);
    expect(doorIsOpen(boss, fresh())).toBe(false);
    expect(doorIsOpen(boss, unlockDoor(fresh(), boss.id))).toBe(true);
  });

  it('remember an unlock without changing the old progress, and only once', () => {
    const p = fresh();
    const a = unlockDoor(p, 3);
    expect(a.opened).toEqual([3]);
    expect(p.opened).toEqual([]);
    expect(unlockDoor(a, 3)).toBe(a);
  });
});

describe('solid tiles', () => {
  it('include closed doors, pillars, crystals, chests and blocks, but not open doors, switches or traps', () => {
    const d = dungeon();
    const run = newRun(d);
    const solid = solidTiles(run, fresh());
    const at = (o: { x: number; y: number }): boolean => solid.has(idx(o.x, o.y, d.world.size));
    for (const o of [...d.pillars, ...d.crystals, ...d.chests, ...d.blocks]) expect(at(o)).toBe(true);
    for (const door of d.doors) expect(at(door), `door ${door.id}`).toBe(door.lock !== 'free');
    for (const o of [...d.switches, ...d.traps]) expect(at(o)).toBe(false);
    const open = solidTiles(run, { ...fresh(), solved: d.doors.filter((x) => x.room !== null).map((x) => x.room!) });
    for (const door of d.doors.filter((x) => x.lock === 'room')) expect(open.has(idx(door.x, door.y, d.world.size))).toBe(false);
  });
});

describe('pushing blocks', () => {
  const setup = () => {
    const d = dungeon();
    return { d, run: newRun(d), block: d.blocks[0], sw: d.switches[0] };
  };

  it('slides a block one tile along its lane, onto the switch, and no further', () => {
    const { run, block, sw } = setup();
    let cur = run;
    for (let x = block.x; x < sw.x; x++) {
      const next = pushBlock(cur, fresh(), block.id, 1, 0);
      expect(next, `push from ${x}`).not.toBeNull();
      cur = next!;
    }
    expect(cur.blocks[0]).toMatchObject({ x: sw.x, y: sw.y });
    expect(pressedSwitches(cur)).toEqual([sw.id]);
    expect(pushBlock(cur, fresh(), block.id, 1, 0)).toBeNull();
    expect(pressedSwitches(run)).toEqual([]);
  });

  it('refuses to push into a wall, a pillar, another block, a diagonal, or nowhere', () => {
    const { run, block } = setup();
    expect(pushBlock(run, fresh(), block.id, 0, -1)).toBeNull();
    expect(pushBlock(run, fresh(), block.id, 0, 1)).toBeNull();
    expect(pushBlock(run, fresh(), block.id, -1, 0)).not.toBeNull();
    expect(pushBlock(run, fresh(), block.id, 1, 1)).toBeNull();
    expect(pushBlock(run, fresh(), block.id, 0, 0)).toBeNull();
    expect(pushBlock(run, fresh(), 99, 1, 0)).toBeNull();
    const crowded = { ...run, blocks: [block, { id: 5, x: block.x + 1, y: block.y, room: block.room }] };
    expect(pushBlock(crowded, fresh(), block.id, 1, 0)).toBeNull();
  });

  it('never changes the run it was given', () => {
    const { run, block } = setup();
    const before = JSON.stringify(run.blocks);
    pushBlock(run, fresh(), block.id, 1, 0);
    expect(JSON.stringify(run.blocks)).toBe(before);
  });
});

describe('solving rooms', () => {
  it('solves a block room when its switch is pressed, a crystal room when all crystals are lit, a fight room when its monsters are dead', () => {
    const d = dungeon();
    const blockRoom = room(d, 'block');
    const crystalRoom = room(d, 'crystal');
    const fightRoom = room(d, 'fight');
    let run = newRun(d);
    const vaultRoom = room(d, 'vault');
    const alive = (id: number): number => (id === fightRoom.id || id === vaultRoom.id ? 2 : 0);
    expect(solveRooms(run, fresh(), alive).solved).toEqual([]);

    for (let x = d.blocks[0].x; x < d.switches[0].x; x++) run = pushBlock(run, fresh(), 0, 1, 0)!;
    expect(solveRooms(run, fresh(), alive).solved).toContain(blockRoom.id);

    let p = fresh();
    for (const c of d.crystals.slice(0, 2)) p = lightCrystal(p, c.id);
    expect(solveRooms(newRun(d), p, alive).solved).not.toContain(crystalRoom.id);
    p = lightCrystal(p, d.crystals[2].id);
    expect(solveRooms(newRun(d), p, alive).solved).toContain(crystalRoom.id);

    expect(solveRooms(newRun(d), fresh(), () => 0).solved).toContain(fightRoom.id);
    expect(solveRooms(newRun(d), fresh(), () => 0).solved).toContain(room(d, 'vault').id);
  });

  it('keeps a room solved once it is, hands back the same object when nothing changed, and never touches rooms with nothing to solve', () => {
    const d = dungeon();
    const done = { ...fresh(), solved: [room(d, 'block').id] };
    expect(solveRooms(newRun(d), done, () => 1)).toBe(done);
    const all = solveRooms(newRun(d), fresh(), () => 0);
    for (const kind of ['entrance', 'trap', 'boss', 'side'] as const) expect(all.solved).not.toContain(room(d, kind).id);
  });

  it('lights a crystal once without changing the old progress', () => {
    const p = fresh();
    const a = lightCrystal(p, 1);
    expect(a.lit).toEqual([1]);
    expect(p.lit).toEqual([]);
    expect(lightCrystal(a, 1)).toBe(a);
  });
});

describe('spike traps', () => {
  it('warn, spring up, and fall back, with the two phases taking turns so they are never up together', () => {
    const d = dungeon();
    const t0 = d.traps.find((t) => t.phase === 0)!;
    const t1 = d.traps.find((t) => t.phase === 1)!;
    const seen = new Set<string>();
    for (let t = 0; t < TRAP_CYCLE * 3; t += 0.05) {
      seen.add(trapState(t0, t));
      expect(trapState(t0, t) === 'up' && trapState(t1, t) === 'up', `t=${t}`).toBe(false);
    }
    expect([...seen].sort()).toEqual(['down', 'up', 'warn']);
  });

  it('always warns before a trap springs up', () => {
    const d = dungeon();
    const trap = d.traps[0];
    let prev = trapState(trap, 0);
    for (let t = 0.01; t < TRAP_CYCLE * 2; t += 0.01) {
      const cur = trapState(trap, t);
      if (cur === 'up') expect(prev === 'warn' || prev === 'up', `t=${t}`).toBe(true);
      prev = cur;
    }
  });

  it('hurt only a hero standing on a trap that is up', () => {
    const d = dungeon();
    const run = newRun(d);
    const trap = d.traps[0];
    let upAt = -1;
    let downAt = -1;
    for (let t = 0; t < TRAP_CYCLE && (upAt < 0 || downAt < 0); t += 0.02) {
      if (trapState(trap, t) === 'up' && upAt < 0) upAt = t;
      if (trapState(trap, t) === 'down' && downAt < 0) downAt = t;
    }
    const on = { x: trap.x + 0.5, y: trap.y + 0.5 };
    expect(trapUnder(run, on, upAt)).toMatchObject({ id: trap.id });
    expect(trapUnder(run, on, downAt)).toBeNull();
    expect(trapUnder(run, { x: trap.x + 0.5, y: d.rooms[0].y0 + 2.5 }, upAt)).toBeNull();
  });
});

describe('what ACTION can reach', () => {
  it('finds a closed boss door, an unopened chest, and the exit, but nothing at an open door, an emptied chest or bare floor', () => {
    const d = dungeon();
    const run = newRun(d);
    const boss = d.doors.find((x) => x.lock === 'boss')!;
    const chest = d.chests[0];
    expect(targetAt(run, fresh(), boss.x, boss.y)).toEqual({ kind: 'door', door: boss });
    expect(targetAt(run, unlockDoor(fresh(), boss.id), boss.x, boss.y)).toBeNull();
    expect(targetAt(run, fresh(), chest.x, chest.y)).toEqual({ kind: 'chest', chest });
    expect(targetAt(run, lootChest(fresh(), chest.id), chest.x, chest.y)).toBeNull();
    expect(targetAt(run, fresh(), d.exit.x, d.exit.y)).toEqual({ kind: 'exit' });
    expect(targetAt(run, fresh(), Math.floor(d.entry.x), Math.floor(d.entry.y))).toBeNull();
    const gated = d.doors.find((x) => x.lock === 'room')!;
    expect(targetAt(run, fresh(), gated.x, gated.y)).toBeNull();
  });

  it('remembers a looted chest without changing the old progress', () => {
    const p = fresh();
    expect(lootChest(p, 2).looted).toEqual([2]);
    expect(p.looted).toEqual([]);
    expect(lootChest(lootChest(p, 2), 2).looted).toEqual([2]);
  });
});

describe('dungeon entrances on the island', () => {
  it('are the landmark tiles of the grotto, the deep mine and the ruin, and nothing else', () => {
    const world = generateWorld(1234);
    for (const l of world.landmarks) {
      const found = entranceAt(world, l.x, l.y);
      expect(found, l.id).toBe(l.id === 'grotto' || l.id === 'deepmine' || l.id === 'ruin' ? l.id : null);
      expect(entranceAt(world, l.x + 1, l.y), l.id).toBeNull();
    }
    expect(entranceAt(world, -1, 5)).toBeNull();
  });
});

describe('coming back out', () => {
  it('puts the hero on open ground just south of the entrance of that dungeon, on every island', () => {
    for (const seed of [1, 2, 3, 1234, 99991]) {
      const world = generateWorld(seed);
      const blocked = new Set(propSolidTiles(world));
      for (const id of ['grotto', 'deepmine', 'ruin'] as const) {
        const door = world.landmarks.find((l) => l.id === id)!;
        const out = doorwayOutside(world, id);
        expect(out, `${seed}/${id}`).toEqual({ x: door.x + 0.5, y: door.y + 1.5 });
        const tile = idx(door.x, door.y + 1, world.size);
        expect(isWater(world.terrain[tile]) || world.terrain[tile] === T.DEEP, `${seed}/${id} water`).toBe(false);
        expect(blocked.has(tile), `${seed}/${id} blocked`).toBe(false);
      }
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/dungeon-rules.test.ts`
Expected: FAIL, "Failed to resolve import "@/sim/dungeon/rules"".

- [ ] **Step 3: Write the rules**

`src/sim/dungeon/rules.ts`:

```typescript
import type { Vec } from '@/sim/movement';
import { T, idx, inBounds, type World } from '@/sim/world/types';
import { addUnique, isDungeonId, type DungeonId, type DungeonProgress } from './progress';
import type { Block, Chest, Door, Dungeon, Trap } from './types';

/** A dungeon as it is right now: the generated layout plus the blocks, which the hero moves. Everything else is in the progress. */
export interface Run {
  readonly dungeon: Dungeon;
  readonly blocks: readonly Block[];
}

export const newRun = (dungeon: Dungeon): Run => ({ dungeon, blocks: dungeon.blocks });

/** Free doors are open, a room's door opens when the room is solved, and a locked door once it has been unlocked. */
export function doorIsOpen(door: Door, p: DungeonProgress): boolean {
  if (door.lock === 'free' || p.opened.includes(door.id)) return true;
  return door.lock === 'room' && door.room !== null && p.solved.includes(door.room);
}

export const unlockDoor = (p: DungeonProgress, doorId: number): DungeonProgress => {
  const opened = addUnique(p.opened, doorId);
  return opened === p.opened ? p : { ...p, opened };
};

export const lootChest = (p: DungeonProgress, chestId: number): DungeonProgress => {
  const looted = addUnique(p.looted, chestId);
  return looted === p.looted ? p : { ...p, looted };
};

export const lightCrystal = (p: DungeonProgress, crystalId: number): DungeonProgress => {
  const lit = addUnique(p.lit, crystalId);
  return lit === p.lit ? p : { ...p, lit };
};

/** Tiles nobody can walk through: closed doors, pillars, crystals, chests and blocks (walls are terrain). */
export function solidTiles(run: Run, p: DungeonProgress): Set<number> {
  const d = run.dungeon;
  const size = d.world.size;
  const solid = new Set<number>();
  for (const o of [...d.pillars, ...d.crystals, ...d.chests, ...run.blocks]) solid.add(idx(o.x, o.y, size));
  for (const door of d.doors) if (!doorIsOpen(door, p)) solid.add(idx(door.x, door.y, size));
  return solid;
}

/** Slide a block one tile. Null when the block is not there, the push is not a straight step, or the tile is not free. */
export function pushBlock(run: Run, p: DungeonProgress, blockId: number, dx: number, dy: number): Run | null {
  const block = run.blocks.find((b) => b.id === blockId);
  if (!block || Math.abs(dx) + Math.abs(dy) !== 1) return null;
  const x = block.x + dx;
  const y = block.y + dy;
  const size = run.dungeon.world.size;
  if (!inBounds(x, y, size) || run.dungeon.world.terrain[idx(x, y, size)] !== T.FLOOR) return null;
  if (solidTiles(run, p).has(idx(x, y, size))) return null;
  return { ...run, blocks: run.blocks.map((b) => (b.id === blockId ? { ...b, x, y } : b)) };
}

/** Switches with a block on them. */
export function pressedSwitches(run: Run): number[] {
  return run.dungeon.switches.filter((s) => run.blocks.some((b) => b.x === s.x && b.y === s.y)).map((s) => s.id);
}

/**
 * Add the rooms that are solved right now: a block room whose switch is pressed, a crystal room whose crystals are all lit,
 * and a fight room or vault whose monsters are dead (`alive(room)` counts the living ones). Solved rooms stay solved.
 * Returns the very same object when nothing changed.
 */
export function solveRooms(run: Run, p: DungeonProgress, alive: (room: number) => number): DungeonProgress {
  const d = run.dungeon;
  const pressed = pressedSwitches(run);
  let solved = p.solved;
  for (const room of d.rooms) {
    if (solved.includes(room.id)) continue;
    const done =
      room.kind === 'block' ? d.switches.some((s) => s.room === room.id && pressed.includes(s.id))
      : room.kind === 'crystal' ? d.crystals.filter((c) => c.room === room.id).every((c) => p.lit.includes(c.id))
      : room.kind === 'fight' || room.kind === 'vault' ? alive(room.id) === 0
      : false;
    if (done) solved = addUnique(solved, room.id);
  }
  return solved === p.solved ? p : { ...p, solved };
}

/** A spike trap's cycle: it warns, springs up, and falls back. The two phases are half a cycle apart. */
export const TRAP_CYCLE = 2.4;
const WARN = 0.4;
const UP = 0.6;
export type TrapState = 'down' | 'warn' | 'up';

export function trapState(trap: Trap, t: number): TrapState {
  const u = (((t - trap.phase * (TRAP_CYCLE / 2)) % TRAP_CYCLE) + TRAP_CYCLE) % TRAP_CYCLE;
  return u < WARN ? 'warn' : u < WARN + UP ? 'up' : 'down';
}

/** The spike trap under the hero that is up right now, if any. */
export function trapUnder(run: Run, hero: Vec, t: number): Trap | null {
  const x = Math.floor(hero.x);
  const y = Math.floor(hero.y);
  return run.dungeon.traps.find((tr) => tr.x === x && tr.y === y && trapState(tr, t) === 'up') ?? null;
}

export type Target = { kind: 'door'; door: Door } | { kind: 'chest'; chest: Chest } | { kind: 'exit' };

/** What the hero can use on this tile: a locked door, a chest not yet emptied, or the way out. */
export function targetAt(run: Run, p: DungeonProgress, x: number, y: number): Target | null {
  const d = run.dungeon;
  if (x === d.exit.x && y === d.exit.y) return { kind: 'exit' };
  const door = d.doors.find((o) => o.x === x && o.y === y && o.lock === 'boss' && !doorIsOpen(o, p));
  if (door) return { kind: 'door', door };
  const chest = d.chests.find((o) => o.x === x && o.y === y && !p.looted.includes(o.id));
  return chest ? { kind: 'chest', chest } : null;
}

/** Where the hero stands after coming out of a dungeon: the tile just south of its door on the island. */
export function doorwayOutside(world: World, id: DungeonId): Vec {
  const door = world.landmarks.find((l) => l.id === id);
  return door ? { x: door.x + 0.5, y: door.y + 1.5 } : { ...world.start };
}

/** The dungeon whose entrance stands on this island tile (the landmark tile of the grotto, the deep mine or the ruin). */
export function entranceAt(world: World, x: number, y: number): DungeonId | null {
  const l = world.landmarks.find((o) => o.x === x && o.y === y);
  return l && isDungeonId(l.id) ? l.id : null;
}
```

- [ ] **Step 4: Run the test, the typecheck and the whole suite**

Run: `npx vitest run tests/dungeon-rules.test.ts && npm run typecheck && npm test`
Expected: 16 tests PASS; typecheck exits 0; the whole suite passes (436 tests).

- [ ] **Step 5: Commit**

```bash
git add src/sim/dungeon/rules.ts tests/dungeon-rules.test.ts
git commit -m "feat: add dungeon rules (doors, blocks, spikes, crystals, chests)"
```

---

### Task 5: Bosses, bolts and crystal targets

**Files:**
- Create: `src/data/bosses.ts`, `src/sim/boss.ts`, `src/sim/bossFight.ts`, `src/sim/dungeon/start.ts`
- Replace: `src/data/creatures.ts`, `src/sim/creatures.ts`, `src/sim/encounters.ts`, `tests/creatures-data.test.ts`
- Test: `tests/boss.test.ts`, `tests/encounters-boss.test.ts`, `tests/dungeon-start.test.ts` (new), `tests/creatures-data.test.ts` (replaced)

**Interfaces:**
- Consumes: Tasks 1, 3 and 4 (`startEncounters` needs the dungeon and its progress).
- Produces: `BossAction`, `BossMove`, `BossPhase`, `BossDef`, `BOSSES`; `CreatureId` includes the three bosses, `Temper` gains `'boss'`, `CreatureSprite.scale`, `isHostileKind` is true for bosses; `Creature` gains `step` and the state `'charge'`; `StepResult` gains `damage`, `shots`, `summons`; `hurtCreature` neither staggers nor pushes a boss; `Shot`, `FlyingShot`, `stepBoss`, `phaseOf`, `isBoss`, `CHARGE_SPEED`, `CHARGE_TIME`, `CRASH_REST`, `HIT_REST`, `SHOT_SPEED`, `SHOT_RANGE`; `launch`, `flyShots`, `placeSummons`, `MAX_MINIONS = 6`; `Encounters` gains `shots` and `targets`, `Target {id, x, y}`, `EncounterEvent` gains `struck`, `TickContext.fixed`, `creatureInReach` counts targets, `hostilesNear` counts bosses and charges; `startEncounters(dungeon, progress, rng)`, `creaturesInRoom`, `bossOf`.

- [ ] **Step 1: Write the failing tests**

Replace `tests/creatures-data.test.ts` (bosses have their own checks):

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
    expect(CREATURE_IDS).toHaveLength(16);
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

  it('has nine enemies that chase and four animals: three flee and the boar fights back', () => {
    const by = (temper: string) => CREATURE_IDS.filter((id) => CREATURES[id].temper === temper).sort();
    expect(by('chase')).toHaveLength(9);
    expect(by('flee')).toEqual(['bird', 'fox', 'rabbit']);
    expect(by('defend')).toEqual(['boar']);
    expect(isHostileKind('slime')).toBe(true);
    expect(isHostileKind('boar')).toBe(false);
  });

  it('has three bosses that never appear by themselves, count as hostile, and drop their dungeon rewards', () => {
    const bosses = CREATURE_IDS.filter((id) => CREATURES[id].temper === 'boss');
    expect(bosses.sort()).toEqual(['ironbones', 'mirelord', 'mossback']);
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
```

`tests/boss.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/rng';
import { BOSSES } from '@/data/bosses';
import { CREATURES } from '@/data/creatures';
import type { BossId } from '@/data/dungeons';
import { CHARGE_SPEED, HIT_REST, SHOT_RANGE, SHOT_SPEED, isBoss, phaseOf, stepBoss, type Shot } from '@/sim/boss';
import { hurtCreature, newCreature, stepCreature, type Creature, type StepContext } from '@/sim/creatures';
import { T, WORLD_SIZE, idx, type World } from '@/sim/world/types';

/** All grass, with a deep-water column at x = 40. */
function makeWorld(): World {
  const size = WORLD_SIZE;
  const terrain = new Uint8Array(size * size).fill(T.GRASS);
  for (let y = 0; y < size; y++) terrain[idx(40, y)] = T.DEEP;
  return { seed: 0, size, terrain, biome: new Uint8Array(size * size), landmarks: [], resources: [], start: { x: 1, y: 1 } };
}
const world = makeWorld();
const boss = (kind: BossId, x: number, y: number, over: Partial<Creature> = {}): Creature => ({ ...newCreature(1, kind, x, y, new Rng(1)), ...over });
const ctx = (hero: { x: number; y: number }, over: Partial<StepContext> = {}): StepContext =>
  ({ world, solids: new Set(), hero, heroAlive: true, rng: new Rng(3), dt: 0.05, ...over });

interface Log {
  c: Creature;
  strikes: { t: number; damage: number | undefined }[];
  shots: Shot[][];
  summons: string[][];
  states: string[];
}

/** Step a boss for `seconds`; `move` lets the test move the hero as the fight goes on. */
function fight(start: Creature, hero: { x: number; y: number }, seconds: number, move?: (t: number, h: { x: number; y: number }) => void): Log {
  const log: Log = { c: start, strikes: [], shots: [], summons: [], states: [] };
  const h = { ...hero };
  for (let t = 0; t < seconds; t += 0.05) {
    move?.(t, h);
    const r = stepBoss(log.c, CREATURES[log.c.kind], BOSSES[log.c.kind as BossId], ctx(h));
    if (r.creature.state !== log.c.state) log.states.push(r.creature.state);
    if (r.strike) log.strikes.push({ t, damage: r.damage });
    if (r.shots) log.shots.push(r.shots);
    if (r.summons) log.summons.push(r.summons);
    log.c = r.creature;
  }
  return log;
}

describe('boss definitions', () => {
  it('give every boss two phases, with a summon only in the second', () => {
    for (const id of ['mossback', 'ironbones', 'mirelord'] as const) {
      const b = BOSSES[id];
      expect(isBoss(id)).toBe(true);
      expect(CREATURES[id].temper).toBe('boss');
      expect(b.phases[0].moves.some((m) => m.action === 'summon'), id).toBe(false);
      expect(b.phases[1].moves.some((m) => m.action === 'summon'), id).toBe(true);
      expect(b.phases[1].speed, id).toBeGreaterThan(b.phases[0].speed);
      expect(CREATURES[b.summon], id).toBeDefined();
      for (const phase of b.phases) {
        for (const m of phase.moves) {
          expect(m.windup, id).toBeGreaterThan(0.3);
          expect(m.range[0], id).toBeLessThanOrEqual(m.range[1]);
          if (m.action !== 'summon') expect(m.damage, `${id} ${m.action}`).toBeGreaterThan(0);
        }
      }
    }
    expect(isBoss('slime')).toBe(false);
  });

  it('switch to the second phase at half health', () => {
    const def = CREATURES.mossback;
    expect(phaseOf(boss('mossback', 5, 5), def, BOSSES.mossback)).toBe(0);
    expect(phaseOf(boss('mossback', 5, 5, { hp: def.hp / 2 }), def, BOSSES.mossback)).toBe(1);
    expect(phaseOf(boss('mossback', 5, 5, { hp: def.hp / 2 + 1 }), def, BOSSES.mossback)).toBe(0);
  });
});

describe('a sleeping boss', () => {
  it('stays put until the hero comes within its sight, and never wakes for a collapsed hero', () => {
    const far = fight(boss('mossback', 20, 20), { x: 20 + CREATURES.mossback.sight + 3, y: 20 }, 2);
    expect(far.c).toMatchObject({ x: 20, y: 20, state: 'idle', angry: false });
    const down = stepBoss(boss('mossback', 20, 20, { angry: true, state: 'windup', timer: 0.1 }), CREATURES.mossback, BOSSES.mossback, ctx({ x: 21, y: 20 }, { heroAlive: false }));
    expect(down.creature).toMatchObject({ state: 'idle', angry: false });
    expect(down.strike).toBe(false);
  });

  it('wakes for good once the hero was near, even if he backs off', () => {
    const log = fight(boss('mossback', 20, 20), { x: 28, y: 20 }, 1.5, (t, h) => {
      if (t > 0.3) h.x = 20 + CREATURES.mossback.sight + 6;
    });
    expect(log.c.angry).toBe(true);
    expect(log.c.state).not.toBe('idle');
  });
});

describe('Mossback', () => {
  it('winds up, then charges in a straight line and hurts a hero who stood still', () => {
    const log = fight(boss('mossback', 20, 20), { x: 28, y: 20 }, 3);
    expect(log.states.slice(0, 3)).toEqual(['windup', 'charge', 'recover']);
    expect(log.strikes[0].damage).toBe(BOSSES.mossback.phases[0].moves[0].damage);
    expect(log.c.x).toBeGreaterThan(20);
  });

  it('charges where the hero was when the warning began, so a hero who steps aside is missed, and crashes into the wall behind him', () => {
    const log = fight(boss('mossback', 31, 20), { x: 37, y: 20 }, 2.6, (t, h) => {
      if (t > 0.3) h.y = 25;
    });
    expect(log.strikes).toHaveLength(0);
    expect(log.states.slice(0, 3)).toEqual(['windup', 'charge', 'recover']);
    expect(log.c.x).toBeLessThan(40 - CREATURES.mossback.radius + 0.01);
    expect(log.c.x).toBeGreaterThan(37);
  });

  it('charges faster than the hero can walk, over at most eight tiles', () => {
    expect(CHARGE_SPEED).toBeGreaterThan(3.4);
    const log = fight(boss('mossback', 10, 20), { x: 19, y: 20 }, 2, (t, h) => {
      if (t > 0.3) h.y = 30;
    });
    expect(log.c.x - 10).toBeLessThanOrEqual(CHARGE_SPEED * 1 + 0.5);
    expect(log.c.x).toBeGreaterThan(16);
  });

  it('slams a hero who is next to it, for the slam damage, after a warning', () => {
    const log = fight(boss('mossback', 20, 20, { step: 1 }), { x: 21.2, y: 20 }, 2);
    expect(log.states.slice(0, 2)).toEqual(['windup', 'recover']);
    expect(log.strikes[0].damage).toBe(BOSSES.mossback.phases[0].moves[1].damage);
    const missed = fight(boss('mossback', 20, 20, { step: 1 }), { x: 21.2, y: 20 }, 2, (t, h) => {
      if (t > 0.2) h.x = 25;
    });
    expect(missed.strikes).toHaveLength(0);
  });

  it('calls two mushrooms in its second phase, and never in its first', () => {
    const def = CREATURES.mossback;
    const first = fight(boss('mossback', 20, 20), { x: 24, y: 20 }, 20);
    expect(first.summons).toEqual([]);
    const second = fight(boss('mossback', 20, 20, { hp: def.hp * 0.4, step: 2 }), { x: 24, y: 20 }, 4);
    expect(second.summons[0]).toEqual(['mushroom', 'mushroom']);
  });
});

describe('boss shots', () => {
  it('fans out aimed at the hero for Ironbones', () => {
    const log = fight(boss('ironbones', 20, 20, { step: 1 }), { x: 28, y: 20 }, 2);
    const fan = log.shots[0];
    expect(fan).toHaveLength(3);
    for (const s of fan) {
      expect(Math.hypot(s.dx, s.dy)).toBeCloseTo(1);
      expect(s.speed).toBe(SHOT_SPEED);
      expect(s.left).toBe(SHOT_RANGE);
      expect(s.damage).toBe(BOSSES.ironbones.phases[0].moves[1].damage);
      expect(s.x).toBe(20);
    }
    expect(fan[1].dy).toBeCloseTo(0);
    expect(fan[0].dy).toBeLessThan(0);
    expect(fan[2].dy).toBeGreaterThan(0);
    expect(fan.every((s) => s.dx > 0)).toBe(true);
  });

  it('sends a ring of bolts in every direction in the second phase, and rings are never fired in the first', () => {
    const def = CREATURES.ironbones;
    const first = fight(boss('ironbones', 20, 20), { x: 26, y: 20 }, 15);
    expect(first.shots.every((s) => s.length < 8)).toBe(true);
    const log = fight(boss('ironbones', 20, 20, { hp: def.hp * 0.3, step: 2 }), { x: 26, y: 20 }, 4);
    const ring = log.shots[0];
    expect(ring).toHaveLength(8);
    const angles = ring.map((s) => Math.atan2(s.dy, s.dx));
    expect(Math.max(...angles) - Math.min(...angles)).toBeGreaterThan(Math.PI * 1.5);
  });

  it('keeps Mirelord at a distance: it backs away from a hero who gets close, and closes in on one who is far', () => {
    const near = fight(boss('mirelord', 20, 20), { x: 22, y: 20 }, 1);
    expect(near.c.x).toBeLessThan(20);
    const far = fight(boss('mirelord', 20, 20), { x: 33, y: 20 }, 1.5);
    expect(far.c.x).toBeGreaterThan(20);
  });
});

describe('hurting a boss', () => {
  it('takes hit points but neither staggers nor pushes it, and does not interrupt a wind-up', () => {
    const winding = boss('mossback', 20, 20, { state: 'windup', timer: 0.5 });
    const r = hurtCreature(winding, 10, { x: 1, y: 0 });
    expect(r.dead).toBe(false);
    expect(r.creature).toMatchObject({ hp: CREATURES.mossback.hp - 10, state: 'windup', timer: 0.5, stun: 0, pushX: 0, angry: true });
    expect(hurtCreature(winding, 9999, { x: 0, y: 0 }).dead).toBe(true);
  });

  it('is run by stepCreature, so the island code needs no special case', () => {
    const r = stepCreature(boss('mossback', 20, 20), ctx({ x: 24, y: 20 }));
    expect(r.creature.state).toBe('windup');
    expect(HIT_REST).toBeGreaterThan(0);
  });
});
```

`tests/encounters-boss.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/rng';
import { BOSSES } from '@/data/bosses';
import { CREATURES } from '@/data/creatures';
import { ITEMS } from '@/data/items';
import { SHOT_RANGE, SHOT_SPEED, type FlyingShot } from '@/sim/boss';
import { MAX_MINIONS, flyShots, launch, placeSummons } from '@/sim/bossFight';
import { newCreature, type Creature } from '@/sim/creatures';
import { creatureInReach, emptyEncounters, hostilesNear, shoot, swing, tickEncounters, type Encounters, type TickContext } from '@/sim/encounters';
import { emptyStructures } from '@/sim/structures';
import { T, WORLD_SIZE, idx, type World } from '@/sim/world/types';

function makeWorld(): World {
  const size = WORLD_SIZE;
  const terrain = new Uint8Array(size * size).fill(T.GRASS);
  return { seed: 0, size, terrain, biome: new Uint8Array(size * size).fill(1), landmarks: [], resources: [], start: { x: 3, y: 3 } };
}
const world = makeWorld();
const hero = { x: 80.5, y: 80.5 };
const tctx = (over: Partial<TickContext> = {}): TickContext => ({
  world, solids: new Set(), structures: emptyStructures(), hero, heroAlive: true, night: false, difficulty: 'normal', defense: 0, rng: new Rng(4), ...over,
});
const mk = (kind: Creature['kind'], x: number, y: number, id: number, over: Partial<Creature> = {}): Creature =>
  ({ ...newCreature(id, kind, x, y, new Rng(id)), ...over });
const withCreatures = (...creatures: Creature[]): Encounters => ({ ...emptyEncounters(), creatures, nextId: 100, spawnTimer: 99 });
const bolt = (over: Partial<FlyingShot> = {}): FlyingShot => ({ id: 1, kind: 'ironbones', x: 74, y: 80.5, dx: 1, dy: 0, speed: SHOT_SPEED, left: SHOT_RANGE, damage: 10, ...over });

describe('boss bolts', () => {
  it('are added with ids from the shared counter and the kind that fired them', () => {
    const e = launch({ ...emptyEncounters(), nextId: 40 }, 'mirelord', [bolt(), bolt()]);
    expect(e.shots.map((s) => [s.id, s.kind])).toEqual([[40, 'mirelord'], [41, 'mirelord']]);
    expect(e.nextId).toBe(42);
  });

  it('fly straight, hurt the hero once with the difficulty and armour applied, and are used up', () => {
    let e: Encounters = { ...emptyEncounters(), shots: [bolt()], spawnTimer: 99 };
    const hits: number[] = [];
    for (let i = 0; i < 80; i++) {
      const r = flyShots(e, tctx({ defense: 3 }), 0.05);
      e = r.e;
      for (const ev of r.events) if (ev.t === 'hurtHero') hits.push(ev.amount);
    }
    expect(hits).toEqual([7]);
    expect(e.shots).toEqual([]);
  });

  it('miss a hero who is out of the way, fall at the end of their range, and never hurt a collapsed hero', () => {
    const aside = flyShots({ ...emptyEncounters(), shots: [bolt({ y: 78 })] }, tctx(), 5);
    expect(aside.events).toEqual([]);
    expect(aside.e.shots).toEqual([]);
    const down = flyShots({ ...emptyEncounters(), shots: [bolt()] }, tctx({ heroAlive: false }), 2);
    expect(down.events).toEqual([]);
    expect(down.e.shots).toHaveLength(1);
  });

  it('stop at a wall or a solid tile and cannot skip through one in a single big step', () => {
    const solids = new Set([idx(77, 80)]);
    const r = flyShots({ ...emptyEncounters(), shots: [bolt({ speed: 50 })] }, tctx({ solids }), 1);
    expect(r.events).toEqual([]);
    expect(r.e.shots).toEqual([]);
  });
});

describe('boss fights in tickEncounters', () => {
  it('turn a boss move into bolts that then reach the hero', () => {
    let e = withCreatures(mk('ironbones', 72.5, 80.5, 1, { step: 1 }));
    const kinds: string[] = [];
    let launched = 0;
    for (let i = 0; i < 200; i++) {
      const r = tickEncounters(e, tctx({ fixed: true }), 0.05);
      launched = Math.max(launched, r.e.shots.length);
      e = r.e;
      for (const ev of r.events) if (ev.t === 'hurtHero') kinds.push(ev.kind);
    }
    expect(launched).toBe(3);
    expect(kinds.length).toBeGreaterThan(0);
    expect(new Set(kinds)).toEqual(new Set(['ironbones']));
  });

  it('use the boss move damage, not the creature damage, for a charge that lands', () => {
    let e = withCreatures(mk('mossback', 74, 80.5, 1));
    const amounts: number[] = [];
    for (let i = 0; i < 100; i++) {
      const r = tickEncounters(e, tctx({ fixed: true }), 0.05);
      e = r.e;
      for (const ev of r.events) if (ev.t === 'hurtHero') amounts.push(ev.amount);
    }
    expect(amounts[0]).toBe(BOSSES.mossback.phases[0].moves[0].damage);
    expect(amounts[0]).not.toBe(CREATURES.mossback.damage);
  });

  it('call helpers in the second phase: they appear beside the boss, already hunting, and stop at the limit', () => {
    let e = withCreatures(mk('mossback', 74, 80.5, 1, { hp: CREATURES.mossback.hp * 0.3, step: 2, state: 'windup', timer: 0.02, angry: true }));
    e = tickEncounters(e, tctx({ fixed: true }), 0.05).e;
    const minions = e.creatures.filter((c) => c.kind === 'mushroom');
    expect(minions).toHaveLength(2);
    for (const m of minions) {
      expect(Math.hypot(m.x - 74, m.y - 80.5)).toBeLessThan(2.5);
      expect(m).toMatchObject({ state: 'chase', angry: true });
    }
    expect(new Set(e.creatures.map((c) => c.id)).size).toBe(e.creatures.length);
    const crowd = Array.from({ length: MAX_MINIONS }, (_, i) => mk('slime', 60 + i, 60, 10 + i));
    const full = placeSummons({ ...withCreatures(mk('mossback', 74, 80.5, 1), ...crowd) }, mk('mossback', 74, 80.5, 1), ['mushroom', 'mushroom'], tctx());
    expect(full.creatures.filter((c) => c.kind === 'mushroom')).toHaveLength(0);
  });

  it('place helpers only on free ground', () => {
    const solids = new Set<number>();
    for (let y = 70; y < 90; y++) for (let x = 64; x < 84; x++) if (Math.hypot(x - 74, y - 80) > 0.5) solids.add(idx(x, y));
    const r = placeSummons(withCreatures(mk('mossback', 74.5, 80.5, 1)), mk('mossback', 74.5, 80.5, 1), ['mushroom'], tctx({ solids }));
    expect(r.creatures.filter((c) => c.kind === 'mushroom')).toHaveLength(0);
  });

  it('leave a dungeon alone when it is fixed: nothing appears and nothing far away fades', () => {
    let e: Encounters = { ...emptyEncounters(), creatures: [mk('rabbit', 10.5, 10.5, 1), mk('skeleton', 20, 20, 2, { state: 'idle', timer: 99 })], nextId: 100, spawnTimer: 0.01 };
    for (let i = 0; i < 400; i++) e = tickEncounters(e, tctx({ fixed: true }), 0.05).e;
    expect(e.creatures.map((c) => c.id)).toEqual([1, 2]);
    let wild: Encounters = { ...emptyEncounters(), creatures: [mk('rabbit', 10.5, 10.5, 1)], nextId: 100, spawnTimer: 0.01 };
    wild = tickEncounters(wild, tctx(), 0.05).e;
    expect(wild.creatures.find((c) => c.id === 1)).toBeUndefined();
  });

  it('count a charging boss as hunting the hero', () => {
    const e = withCreatures(mk('mossback', 82, 80.5, 1, { state: 'charge' }), mk('mossback', 120, 80.5, 2, { state: 'charge' }));
    expect(hostilesNear(e, hero, 10)).toBe(1);
  });

  it('drop the boss rewards when it dies', () => {
    const e = withCreatures(mk('mossback', 81.2, 80.5, 1, { hp: 3 }));
    const r = swing(e, hero, 'right', { damage: 8, reach: 1.3, arc: 110, knockback: 0.35 }, new Rng(1));
    expect(r.events.map((ev) => ev.t)).toEqual(['hit', 'killed']);
    expect(r.e.pickups.map((p) => p.item).sort()).toEqual(['armor_moss', 'compass']);
    for (const p of r.e.pickups) expect(ITEMS[p.item]).toBeDefined();
  });
});

describe('targets', () => {
  const crystal = { id: 7, x: 81.4, y: 80.5 };

  it('are struck by a blow in front of the hero, not by one aimed elsewhere, and do not use up creatures', () => {
    const e = { ...emptyEncounters(), targets: [crystal, { id: 8, x: 78, y: 80.5 }] };
    const r = swing(e, hero, 'right', { damage: 5, reach: 1.3, arc: 110, knockback: 0.35 }, new Rng(1));
    expect(r.events).toEqual([{ t: 'struck', id: 7 }]);
    expect(swing(e, hero, 'up', { damage: 5, reach: 1.3, arc: 110, knockback: 0.35 }, new Rng(1)).events).toEqual([]);
  });

  it('count as something a blow would land on, so a sword is swung at them', () => {
    const e = { ...emptyEncounters(), targets: [crystal] };
    expect(creatureInReach(e, hero, 'right', 1.3, 110)).toBe(true);
    expect(creatureInReach(e, hero, 'left', 1.3, 110)).toBe(false);
    expect(creatureInReach(emptyEncounters(), hero, 'right', 1.3, 110)).toBe(false);
  });

  it('are struck by an arrow, which is then used up, and not by one that flies past', () => {
    const bow = ITEMS.bow.weapon!;
    let e: Encounters = { ...shoot({ ...emptyEncounters(), targets: [{ id: 3, x: 84.5, y: 80.5 }], spawnTimer: 99 }, hero, 'right', bow) };
    const events: string[] = [];
    for (let i = 0; i < 20; i++) {
      const r = tickEncounters(e, tctx({ fixed: true }), 0.05);
      e = r.e;
      events.push(...r.events.map((ev) => (ev.t === 'struck' ? `struck:${ev.id}` : ev.t)));
    }
    expect(events).toEqual(['struck:3']);
    expect(e.arrows).toEqual([]);
    let miss: Encounters = { ...shoot({ ...emptyEncounters(), targets: [{ id: 3, x: 84.5, y: 82.5 }], spawnTimer: 99 }, hero, 'right', bow) };
    const seen: string[] = [];
    for (let i = 0; i < 20; i++) {
      const r = tickEncounters(miss, tctx({ fixed: true }), 0.05);
      miss = r.e;
      seen.push(...r.events.map((ev) => ev.t));
    }
    expect(seen).toEqual([]);
  });
});
```

`tests/dungeon-start.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/rng';
import { CREATURES } from '@/data/creatures';
import { generateDungeon } from '@/sim/dungeon/generate';
import { ROOM_H, ROOM_W } from '@/sim/dungeon/layout';
import { emptyProgress } from '@/sim/dungeon/progress';
import { bossOf, creaturesInRoom, startEncounters } from '@/sim/dungeon/start';

const dungeon = () => generateDungeon(5, 'deepmine');

describe('startEncounters', () => {
  it('puts every guard, the boss and the unlit crystals into a fresh dungeon, standing in the middle of their tiles', () => {
    const d = dungeon();
    const e = startEncounters(d, emptyProgress(), new Rng(1));
    expect(e.creatures).toHaveLength(d.spawns.length + 1);
    const boss = e.creatures.find((c) => c.kind === d.boss.kind)!;
    expect(boss).toMatchObject({ x: d.boss.x + 0.5, y: d.boss.y + 0.5, hp: CREATURES[d.boss.kind].hp });
    d.spawns.forEach((s) => expect(e.creatures.some((c) => c.kind === s.kind && c.x === s.x + 0.5 && c.y === s.y + 0.5)).toBe(true));
    expect(e.targets).toHaveLength(3);
    expect(e.targets[0]).toMatchObject({ x: d.crystals[0].x + 0.5, y: d.crystals[0].y + 0.5 });
    expect(new Set(e.creatures.map((c) => c.id)).size).toBe(e.creatures.length);
    expect(e.targets.map((t) => t.id)).toEqual(d.crystals.map((c) => c.id));
    expect(e.nextId).toBeGreaterThan(Math.max(...e.creatures.map((c) => c.id)));
    expect(e.shots).toEqual([]);
    expect(e.pickups).toEqual([]);
  });

  it('leaves out the guards of rooms already solved, the boss once it is dead, and crystals already struck', () => {
    const d = dungeon();
    const fight = d.rooms.find((r) => r.kind === 'fight')!;
    const p = { ...emptyProgress(), solved: [fight.id], boss: true, lit: [d.crystals[0].id, d.crystals[2].id] };
    const e = startEncounters(d, p, new Rng(1));
    expect(e.creatures.some((c) => c.kind === d.boss.kind)).toBe(false);
    expect(e.creatures).toHaveLength(d.spawns.filter((s) => s.room !== fight.id).length);
    expect(e.targets.map((t) => t.id)).toEqual([d.crystals[1].id]);
  });

  it('is the same for the same random stream', () => {
    const d = dungeon();
    expect(startEncounters(d, emptyProgress(), new Rng(9))).toEqual(startEncounters(d, emptyProgress(), new Rng(9)));
  });
});

describe('creaturesInRoom', () => {
  it('counts the creatures standing inside a room, and none outside it', () => {
    const d = dungeon();
    const e = startEncounters(d, emptyProgress(), new Rng(1));
    for (const r of d.rooms) {
      const expected = d.spawns.filter((s) => s.room === r.id).length + (r.id === d.boss.room ? 1 : 0);
      expect(creaturesInRoom(e, d, r.id), `room ${r.id}`).toBe(expected);
    }
    const r = d.rooms[3];
    const moved = { ...e, creatures: [{ ...e.creatures[0], x: r.x0 + ROOM_W + 0.5, y: r.y0 + ROOM_H / 2 }] };
    expect(creaturesInRoom(moved, d, r.id)).toBe(0);
  });
});

describe('bossOf', () => {
  it('finds the boss while it lives and nothing once it is gone', () => {
    const d = dungeon();
    const e = startEncounters(d, emptyProgress(), new Rng(1));
    expect(bossOf(e, d)?.kind).toBe(d.boss.kind);
    expect(bossOf({ ...e, creatures: e.creatures.filter((c) => c.kind !== d.boss.kind) }, d)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/creatures-data.test.ts tests/boss.test.ts tests/encounters-boss.test.ts tests/dungeon-start.test.ts`
Expected: FAIL. `boss.test.ts` cannot resolve `@/sim/boss`, `encounters-boss.test.ts` cannot resolve `@/sim/bossFight`, `dungeon-start.test.ts` cannot resolve `@/sim/dungeon/start`, and the new boss checks in `creatures-data.test.ts` fail.

- [ ] **Step 3: Write the boss scripts and the creature catalog**

Each boss has two phases of moves (charge, slam, fan of bolts, ring of bolts, summon); numbers are placeholders for the balance pass:

`src/data/bosses.ts`:

```typescript
import type { BossId } from './dungeons';
import type { CreatureId } from './creatures';

/** What a boss can do. A move starts with a warning (`windup`), then happens, then the boss rests. */
export type BossAction = 'charge' | 'slam' | 'fan' | 'ring' | 'summon';

export interface BossMove {
  action: BossAction;
  /** Seconds of warning before the move happens (the boss glows red). */
  windup: number;
  /** Seconds the boss stands still afterwards. */
  rest: number;
  /** The boss starts this move when the hero is between these distances (tiles); otherwise it walks closer or backs off. */
  range: readonly [number, number];
  /** Hit points taken from the hero by a charge or slam that lands, or by each shot. */
  damage: number;
  /** Shots in a fan or ring, creatures in a summon. */
  count: number;
}

export interface BossPhase {
  /** Multiplies the boss's walking speed. */
  speed: number;
  moves: readonly BossMove[];
}

export interface BossDef {
  id: BossId;
  /** The creature summoned by a `summon` move. */
  summon: CreatureId;
  /** The second phase begins when the boss is down to this share of its hit points. */
  phase2Below: number;
  phases: readonly [BossPhase, BossPhase];
}

const move = (action: BossAction, windup: number, rest: number, range: readonly [number, number], damage: number, count = 1): BossMove => ({
  action, windup, rest, range, damage, count,
});

export const BOSSES: Record<BossId, BossDef> = {
  mossback: {
    id: 'mossback', summon: 'mushroom', phase2Below: 0.5,
    phases: [
      { speed: 1, moves: [move('charge', 0.9, 1.4, [3, 9], 14), move('slam', 0.7, 1, [0, 1.9], 12)] },
      { speed: 1.3, moves: [move('charge', 0.6, 1, [3, 10], 16), move('slam', 0.5, 0.8, [0, 2.1], 14), move('summon', 0.8, 1.5, [0, 99], 0, 2)] },
    ],
  },
  ironbones: {
    id: 'ironbones', summon: 'skeleton', phase2Below: 0.5,
    phases: [
      { speed: 1, moves: [move('slam', 0.6, 1, [0, 2.2], 14), move('fan', 0.7, 1.2, [3, 10], 9, 3)] },
      { speed: 1.25, moves: [move('slam', 0.45, 0.8, [0, 2.4], 16), move('fan', 0.55, 1, [3, 10], 10, 5), move('ring', 0.9, 1.2, [0, 12], 9, 8), move('summon', 0.8, 1.5, [0, 99], 0, 2)] },
    ],
  },
  mirelord: {
    id: 'mirelord', summon: 'ghost', phase2Below: 0.5,
    phases: [
      { speed: 1, moves: [move('fan', 0.8, 1.1, [4, 12], 9, 5), move('ring', 1, 1.4, [0, 12], 8, 10)] },
      { speed: 1.2, moves: [move('fan', 0.6, 0.9, [4, 12], 10, 7), move('ring', 0.8, 1.1, [0, 12], 9, 14), move('summon', 0.8, 1.5, [0, 99], 0, 2)] },
    ],
  },
};
```

Three more creatures (the bosses drop their dungeon's story item and armour), drawn 1.5 times bigger:

`src/data/creatures.ts`:

```typescript
import { B, type Biome } from '@/sim/world/types';
import type { Drop } from './resources';
import type { BossId } from './dungeons';

export type EnemyId = 'slime' | 'mushroom' | 'wasp' | 'skeleton' | 'zombie' | 'worm' | 'ghost' | 'scorpion' | 'skeleton_warrior';
export type AnimalId = 'rabbit' | 'fox' | 'bird' | 'boar';
export type CreatureId = EnemyId | AnimalId | BossId;

/** Chasers hunt the hero on sight, fleeing animals run from him, defenders only fight back once hurt, bosses follow a script (`src/data/bosses.ts`). */
export type Temper = 'chase' | 'flee' | 'defend' | 'boss';

export interface CreatureSprite {
  atlas: 'monsters' | 'actors';
  /** Frames are named "<group>/<dir>/<n>" (down, left, right, up). */
  group: string;
  /** Walk-cycle length. */
  frames: number;
  /** Sheets that only have front-facing rows (the bonus monsters) always show this row. */
  fixedDir?: 'down' | 'left' | 'right' | 'up';
  /** Drawn this many times bigger than the sheet (bosses). */
  scale?: number;
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
const boss = (id: BossId, hp: number, speed: number, damage: number, group: string, drops: readonly Drop[]): CreatureDef => ({
  id, temper: 'boss', hp, speed, damage, sight: 14, reach: 1.4, windup: 0.7, cooldown: 1, radius: 0.7, sprite: { ...monster(group), scale: 1.5 }, drops,
  spawn: { biomes: [], weight: 1, when: 'any' },
});
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

  mossback: boss('mossback', 140, 1.6, 12, 'm04_2', [{ item: 'compass', min: 1, max: 1 }, { item: 'armor_moss', min: 1, max: 1 }]),
  ironbones: boss('ironbones', 160, 1.7, 14, 'm04_3', [{ item: 'hull_planks', min: 1, max: 1 }, { item: 'armor_ironbones', min: 1, max: 1 }]),
  mirelord: boss('mirelord', 180, 1.5, 9, 'm04_0', [{ item: 'lighthouse_key', min: 1, max: 1 }, { item: 'armor_mire', min: 1, max: 1 }]),

  rabbit: { id: 'rabbit', temper: 'flee', hp: 3, speed: 3, damage: 0, sight: 4, reach: 0, windup: 0, cooldown: 0, radius: 0.2, sprite: critter('bunny1/walk'), drops: [{ item: 'raw_meat', min: 1, max: 1 }], spawn: { biomes: [FOREST], weight: 10, when: 'any' } },
  fox: { id: 'fox', temper: 'flee', hp: 6, speed: 2.9, damage: 0, sight: 5, reach: 0, windup: 0, cooldown: 0, radius: 0.22, sprite: critter('fox1/walk'), drops: [{ item: 'raw_meat', min: 1, max: 2 }], spawn: { biomes: [FOREST, MOUNTAIN, DESERT], weight: 5, when: 'any' } },
  bird: { id: 'bird', temper: 'flee', hp: 2, speed: 3.1, damage: 0, sight: 4, reach: 0, windup: 0, cooldown: 0, radius: 0.18, sprite: critter('bird1/walk'), drops: [{ item: 'raw_meat', min: 1, max: 1, chance: 0.7 }], spawn: { biomes: [FOREST, MOUNTAIN, SWAMP, DESERT], weight: 8, when: 'day' } },
  boar: { id: 'boar', temper: 'defend', hp: 14, speed: 2.3, damage: 8, sight: 6, reach: 0.9, windup: 0.4, cooldown: 1.2, radius: 0.32, sprite: critter('pig2/move', 4), drops: [{ item: 'raw_meat', min: 2, max: 3 }, { item: 'bone', min: 1, max: 1, chance: 0.4 }], spawn: { biomes: [FOREST, SWAMP], weight: 4, when: 'any' } },
};

export const CREATURE_IDS = Object.keys(CREATURES) as CreatureId[];

/** True for creatures that attack the hero without being provoked (monsters and bosses). */
export const isHostileKind = (id: CreatureId): boolean => CREATURES[id].temper === 'chase' || CREATURES[id].temper === 'boss';

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

- [ ] **Step 4: Write the boss behaviour and the encounters**

The boss script. A boss sleeps until the hero is near; a move starts when the hero is in the move's range (it walks closer or backs off otherwise), warns, and then happens; the aim is fixed when the warning begins; a charge runs up to eight tiles or until it hits a wall (and then rests, vulnerable) or the hero:

`src/sim/boss.ts`:

```typescript
import { BOSSES, type BossDef, type BossMove } from '@/data/bosses';
import type { CreatureDef, CreatureId } from '@/data/creatures';
import { facingFromVector } from '@/sim/combat';
import type { Creature, StepContext, StepResult } from '@/sim/creatures';
import { PLAYER_HALF, moveWithCollision } from '@/sim/movement';
import type { BossId } from '@/data/dungeons';

/** A bolt of the boss's, flying straight. Tile units. */
export interface Shot {
  x: number;
  y: number;
  dx: number;
  dy: number;
  /** Tiles per second. */
  speed: number;
  /** Tiles it can still travel. */
  left: number;
  damage: number;
}

/** A bolt in flight: a shot with an id and the kind of creature that fired it. */
export interface FlyingShot extends Shot {
  id: number;
  kind: CreatureId;
}

export const CHARGE_SPEED = 8;
export const CHARGE_TIME = 1;
/** Seconds a boss is left standing after it runs into a wall, and after a charge that hit. */
export const CRASH_REST = 1.4;
export const HIT_REST = 0.8;
export const SHOT_SPEED = 5;
export const SHOT_RANGE = 14;
/** Angle between neighbouring shots of a fan. */
const FAN_STEP = 0.28;

export const isBoss = (kind: CreatureId): kind is BossId => kind in BOSSES;

/** Which of the boss's two phases it is in. */
export const phaseOf = (c: Creature, def: CreatureDef, boss: BossDef): 0 | 1 => (c.hp / def.hp <= boss.phase2Below ? 1 : 0);

function aimed(c: Creature, angle: number, damage: number): Shot {
  return { x: c.x, y: c.y, dx: Math.cos(angle), dy: Math.sin(angle), speed: SHOT_SPEED, left: SHOT_RANGE, damage };
}

/** Shots for a move: a fan aimed at the hero, or a ring that turns a little each time. */
function shotsFor(c: Creature, move: BossMove, aim: number): Shot[] {
  const out: Shot[] = [];
  for (let i = 0; i < move.count; i++) {
    const angle = move.action === 'fan' ? aim + (i - (move.count - 1) / 2) * FAN_STEP : (i / move.count) * Math.PI * 2 + c.step * 0.2;
    out.push(aimed(c, angle, move.damage));
  }
  return out;
}

const rest = (c: Creature, seconds: number, extra: Partial<Creature> = {}): Creature => ({ ...c, state: 'recover', timer: seconds, ...extra });

/** The move happens: damage, shots, a summons, or the start of a charge. It goes where the boss aimed when the warning began. */
function perform(c: Creature, boss: BossDef, move: BossMove, ctx: StepContext): StepResult {
  const dist = Math.hypot(ctx.hero.x - c.x, ctx.hero.y - c.y);
  const next = { step: c.step + 1 };
  switch (move.action) {
    case 'slam': {
      const hit = dist <= move.range[1] + PLAYER_HALF;
      return { creature: rest(c, move.rest, next), strike: hit, damage: move.damage };
    }
    case 'charge': {
      return { creature: { ...c, ...next, state: 'charge', timer: CHARGE_TIME }, strike: false };
    }
    case 'summon':
      return { creature: rest(c, move.rest, next), strike: false, summons: Array.from({ length: move.count }, () => boss.summon) };
    default:
      return { creature: rest(c, move.rest, next), strike: false, shots: shotsFor(c, move, Math.atan2(c.headY, c.headX)) };
  }
}

function charge(c: Creature, def: CreatureDef, boss: BossDef, ctx: StepContext): StepResult {
  const phase = boss.phases[phaseOf(c, def, boss)];
  const damage = phase.moves.find((m) => m.action === 'charge')?.damage ?? def.damage;
  const timer = c.timer - ctx.dt;
  const step = CHARGE_SPEED * ctx.dt;
  const moved = moveWithCollision(ctx.world, ctx.solids, c, c.headX * step, c.headY * step, def.radius);
  const travelled = Math.hypot(moved.x - c.x, moved.y - c.y);
  const body = { ...c, x: moved.x, y: moved.y, timer };
  if (Math.hypot(ctx.hero.x - moved.x, ctx.hero.y - moved.y) <= def.reach + def.radius + PLAYER_HALF) {
    return { creature: rest(body, HIT_REST), strike: true, damage };
  }
  if (travelled < step * 0.4) return { creature: rest(body, CRASH_REST), strike: false };
  return { creature: timer > 0 ? body : rest(body, HIT_REST), strike: false };
}

/** Walk toward (or away from, when `away`) the hero. */
function walkAt(c: Creature, def: CreatureDef, ctx: StepContext, speed: number, away: boolean): Creature {
  const dx = ctx.hero.x - c.x;
  const dy = ctx.hero.y - c.y;
  const len = Math.max(1e-6, Math.hypot(dx, dy));
  const sign = away ? -1 : 1;
  const step = speed * ctx.dt;
  const moved = moveWithCollision(ctx.world, ctx.solids, c, (sign * dx * step) / len, (sign * dy * step) / len, def.radius);
  return { ...c, x: moved.x, y: moved.y, state: 'chase', facing: facingFromVector(dx, dy, c.facing) };
}

/** Advance a boss by `ctx.dt` seconds: wait until the hero comes near, then run through its moves in order. */
export function stepBoss(c: Creature, def: CreatureDef, boss: BossDef, ctx: StepContext): StepResult {
  const dx = ctx.hero.x - c.x;
  const dy = ctx.hero.y - c.y;
  const dist = Math.hypot(dx, dy);
  if (!ctx.heroAlive) return { creature: c.state === 'idle' ? c : { ...c, state: 'idle', timer: 0, angry: false }, strike: false };
  if (!c.angry && dist > def.sight) return { creature: c, strike: false };
  const here: Creature = { ...c, angry: true };
  const face = facingFromVector(dx, dy, c.facing);
  if (c.state === 'charge') return charge(here, def, boss, ctx);
  if (c.state === 'recover') {
    const timer = c.timer - ctx.dt;
    return { creature: timer > 0 ? { ...here, timer } : { ...here, state: 'chase', timer: 0 }, strike: false };
  }
  const phase = boss.phases[phaseOf(c, def, boss)];
  const move = phase.moves[c.step % phase.moves.length];
  if (c.state === 'windup') {
    const timer = c.timer - ctx.dt;
    return timer > 0 ? { creature: { ...here, timer, facing: face }, strike: false } : perform(here, boss, move, ctx);
  }
  const [min, max] = move.range;
  if (dist < min) return { creature: walkAt(here, def, ctx, def.speed * phase.speed * 0.8, true), strike: false };
  if (dist > max) return { creature: walkAt(here, def, ctx, def.speed * phase.speed, false), strike: false };
  // The aim is fixed now, so a hero who moves during the warning can get out of the way.
  const len = Math.max(1e-6, dist);
  return { creature: { ...here, state: 'windup', timer: move.windup, facing: face, headX: dx / len, headY: dy / len }, strike: false };
}
```

Bolts and helpers:

`src/sim/bossFight.ts`:

```typescript
import { CREATURES, type CreatureId } from '@/data/creatures';
import { enemyDamage } from '@/sim/combat';
import type { FlyingShot, Shot } from '@/sim/boss';
import { newCreature, type Creature } from '@/sim/creatures';
import type { Encounters, EncounterEvent, EncounterStep, TickContext } from '@/sim/encounters';
import { bodyBlocked, tileBlocked } from '@/sim/movement';

/** A bolt hits the hero when it passes this close to his centre (tiles). */
const SHOT_HIT = 0.35;
/** Bolts move in steps no longer than this, so a fast one cannot skip over the hero or through a wall. */
const SUBSTEP = 0.3;
/** A boss stops calling helpers while this many of them are alive. */
export const MAX_MINIONS = 6;

/** Add bolts fired by a creature of this kind to the fight. */
export function launch(e: Encounters, kind: CreatureId, shots: readonly Shot[]): Encounters {
  const flying: FlyingShot[] = shots.map((s, i) => ({ ...s, id: e.nextId + i, kind }));
  return { ...e, shots: [...e.shots, ...flying], nextId: e.nextId + flying.length };
}

/** Fly every bolt on: walls and solid things stop them, the hero is hurt by the first one that reaches him. */
export function flyShots(e: Encounters, c: TickContext, dt: number): EncounterStep {
  const events: EncounterEvent[] = [];
  const kept: FlyingShot[] = [];
  for (const shot of e.shots) {
    let { x, y, left } = shot;
    let alive = true;
    let travel = Math.min(left, shot.speed * dt);
    while (alive && travel > 1e-9) {
      const step = Math.min(travel, SUBSTEP);
      x += shot.dx * step;
      y += shot.dy * step;
      travel -= step;
      left -= step;
      if (tileBlocked(c.world, c.solids, Math.floor(x), Math.floor(y))) alive = false;
      else if (c.heroAlive && Math.hypot(c.hero.x - x, c.hero.y - y) <= SHOT_HIT) {
        events.push({ t: 'hurtHero', amount: enemyDamage(shot.damage, c.difficulty, c.defense), from: { x, y }, kind: shot.kind });
        alive = false;
      }
    }
    if (alive && left > 1e-9) kept.push({ ...shot, x, y, left });
  }
  return { e: { ...e, shots: kept }, events };
}

/** Call helpers to stand around a boss, on free ground, unless it already has too many. */
export function placeSummons(e: Encounters, boss: Creature, kinds: readonly CreatureId[], c: TickContext): Encounters {
  let cur = e;
  const bossRadius = CREATURES[boss.kind].radius;
  kinds.forEach((kind, i) => {
    if (cur.creatures.filter((o) => CREATURES[o.kind].temper !== 'boss').length >= MAX_MINIONS) return;
    const radius = CREATURES[kind].radius;
    for (let t = 0; t < 8; t++) {
      const angle = ((i * 3 + t) / 8) * Math.PI * 2 + boss.step;
      const x = boss.x + Math.cos(angle) * (bossRadius + 1);
      const y = boss.y + Math.sin(angle) * (bossRadius + 1);
      if (bodyBlocked(c.world, c.solids, x, y, radius)) continue;
      const minion: Creature = { ...newCreature(cur.nextId, kind, x, y, c.rng), state: 'chase', angry: true };
      cur = { ...cur, creatures: [...cur.creatures, minion], nextId: cur.nextId + 1 };
      return;
    }
  });
  return cur;
}
```

`stepCreature` hands bosses to the script, and `hurtCreature` leaves them alone:

`src/sim/creatures.ts`:

```typescript
import type { Rng } from '@/core/rng';
import { BOSSES } from '@/data/bosses';
import { CREATURES, type CreatureDef, type CreatureId } from '@/data/creatures';
import type { BossId } from '@/data/dungeons';
import { stepBoss, type Shot } from '@/sim/boss';
import type { Facing } from '@/sim/actions';
import { facingFromVector } from '@/sim/combat';
import { PLAYER_HALF, moveWithCollision, speedFactor, type Vec } from '@/sim/movement';
import type { World } from '@/sim/world/types';

export type CreatureState = 'idle' | 'wander' | 'chase' | 'windup' | 'recover' | 'flee' | 'charge';

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
  /** A boss's place in its list of moves. */
  readonly step: number;
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
  /** Hit points the blow takes, when it is not the creature's usual strike (bosses). */
  damage?: number;
  /** Bolts the creature fires in this step (bosses). */
  shots?: Shot[];
  /** Creatures it calls in this step (bosses). */
  summons?: CreatureId[];
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
    headX: 0, headY: 0, angry: false, pushX: 0, pushY: 0, stun: 0, step: 0,
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
  // A boss is neither staggered nor pushed: its script runs on.
  if (CREATURES[c.kind].temper === 'boss') return { creature: { ...c, hp, angry: true }, dead: false };
  const state: CreatureState = c.state === 'windup' ? 'recover' : c.state === 'idle' || c.state === 'wander' ? 'chase' : c.state;
  // Going from idling or strolling to hunting must drop the old countdown and heading, or they would pass for a detour.
  const unsettled = c.state === 'idle' || c.state === 'wander';
  const timer = c.state === 'windup' ? CREATURES[c.kind].cooldown * 0.5 : unsettled ? 0 : c.timer;
  const heading = unsettled ? { headX: 0, headY: 0 } : {};
  return { creature: { ...c, ...heading, hp, angry: true, state, timer, stun: HURT_STUN, pushX: push.x, pushY: push.y }, dead: false };
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
  if (def.temper === 'boss') return stepBoss(c, def, BOSSES[c.kind as BossId], ctx);
  const pushed = applyPush(c, def, ctx);
  if (pushed.stun > 0) return { creature: { ...pushed, stun: Math.max(0, pushed.stun - ctx.dt) }, strike: false };
  if (def.temper === 'flee') return { creature: ctx.heroAlive ? flee(pushed, def, ctx) : stroll(settle(pushed, ctx.rng), def, ctx), strike: false };
  const hunting = def.temper === 'chase' || pushed.angry;
  if (hunting && ctx.heroAlive) return hunt(pushed, def, ctx);
  const calm = pushed.angry ? { ...pushed, angry: false } : pushed;
  return { creature: stroll(settle(calm, ctx.rng), def, ctx), strike: false };
}
```

Encounters now carry bolts and strike targets (crystals), report `struck` events, and can run `fixed` (no random arrivals or departures):

`src/sim/encounters.ts`:

```typescript
import type { Rng } from '@/core/rng';
import { CREATURES, isHostileKind, type CreatureId } from '@/data/creatures';
import type { WeaponStats } from '@/data/items';
import type { Facing } from '@/sim/actions';
import { enemyDamage, inSwing, knockbackVec, type SwingStats } from '@/sim/combat';
import type { FlyingShot } from '@/sim/boss';
import { flyShots, launch, placeSummons } from '@/sim/bossFight';
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

/** Something the hero can strike with a blow or an arrow that is not a creature (a crystal in a dungeon). */
export interface Target {
  readonly id: number;
  readonly x: number;
  readonly y: number;
}

/** Everything that lives on the island besides the hero and the scenery. Not saved: it is rebuilt around the hero. */
export interface Encounters {
  readonly creatures: readonly Creature[];
  readonly pickups: readonly Pickup[];
  readonly arrows: readonly Arrow[];
  /** Bolts fired by bosses. */
  readonly shots: readonly FlyingShot[];
  readonly targets: readonly Target[];
  /** Shared counter for creature, pickup and arrow ids. */
  readonly nextId: number;
  readonly spawnTimer: number;
}

export type EncounterEvent =
  | { t: 'hurtHero'; amount: number; from: Vec; kind: CreatureId }
  | { t: 'hit'; id: number; kind: CreatureId; amount: number; x: number; y: number }
  | { t: 'killed'; id: number; kind: CreatureId; x: number; y: number }
  | { t: 'struck'; id: number };

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
  /** No creatures appear or fade by themselves (dungeons: the rooms hold what they hold). */
  fixed?: boolean;
}

export const ARROW_SPEED = 9;
const ARROW_REACH = 0.18;
/** How big a target is for blows and arrows. */
const TARGET_RADIUS = 0.45;
/** Arrows move in steps no longer than this, so a fast one cannot skip over a small target. */
const ARROW_SUBSTEP = 0.3;

export const emptyEncounters = (): Encounters => ({
  creatures: [], pickups: [], arrows: [], shots: [], targets: [], nextId: 1, spawnTimer: SPAWN_INTERVAL,
});

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
  for (const t of e.targets) {
    if (inSwing(hero, facing, stats.reach, stats.arc, t, TARGET_RADIUS)) events.push({ t: 'struck', id: t.id });
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
      const target = cur.targets.find((t) => Math.hypot(t.x - x, t.y - y) <= TARGET_RADIUS + ARROW_REACH);
      if (target) {
        events.push({ t: 'struck', id: target.id });
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

/** Advance the island's creatures, arrows, bolts and loose items by `dt` seconds. */
export function tickEncounters(e: Encounters, c: TickContext, dt: number): EncounterStep {
  const events: EncounterEvent[] = [];
  const stepped: Creature[] = [];
  const fired: { kind: CreatureId; shots: NonNullable<ReturnType<typeof stepCreature>['shots']> }[] = [];
  const called: { boss: Creature; kinds: CreatureId[] }[] = [];
  for (const cr of e.creatures) {
    const r = stepCreature(cr, { world: c.world, solids: c.solids, hero: c.hero, heroAlive: c.heroAlive, rng: c.rng, dt });
    if (r.strike) {
      const amount = enemyDamage(r.damage ?? CREATURES[cr.kind].damage, c.difficulty, c.defense);
      events.push({ t: 'hurtHero', amount, from: { x: cr.x, y: cr.y }, kind: cr.kind });
    }
    if (r.shots) fired.push({ kind: cr.kind, shots: r.shots });
    if (r.summons) called.push({ boss: r.creature, kinds: r.summons });
    stepped.push(r.creature);
  }
  let cur: Encounters = { ...e, creatures: separate(stepped, c) };
  for (const f of fired) cur = launch(cur, f.kind, f.shots);
  for (const s of called) cur = placeSummons(cur, s.boss, s.kinds, c);
  const arrows = flyArrows(cur, c, dt);
  const bolts = flyShots(arrows.e, c, dt);
  events.push(...arrows.events, ...bolts.events);
  cur = { ...bolts.e, pickups: ageOut(drift(bolts.e.pickups, c.hero, dt), dt) };
  if (c.fixed) return { e: cur, events };
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
    if (!isHostileKind(c.kind)) return false;
    return (c.state === 'chase' || c.state === 'windup' || c.state === 'recover' || c.state === 'charge') && Math.hypot(c.x - hero.x, c.y - hero.y) <= radius;
  }).length;
}

/** Would a blow of this reach and width land on a creature or a target? Used to decide what ACTION does. */
export function creatureInReach(e: Encounters, hero: Vec, facing: Facing, reach: number, arc: number): boolean {
  return e.creatures.some((c) => inSwing(hero, facing, reach, arc, c, CREATURES[c.kind].radius))
    || e.targets.some((t) => inSwing(hero, facing, reach, arc, t, TARGET_RADIUS));
}
```

The creatures, boss and unlit crystals a dungeon visit starts with, from the saved progress:

`src/sim/dungeon/start.ts`:

```typescript
import type { Rng } from '@/core/rng';
import { CREATURES } from '@/data/creatures';
import { newCreature, type Creature } from '@/sim/creatures';
import { emptyEncounters, type Encounters } from '@/sim/encounters';
import { ROOM_H, ROOM_W } from './layout';
import type { DungeonProgress } from './progress';
import type { Dungeon } from './types';

/** The creatures and crystals of a dungeon the hero has just entered: whatever his progress has not already dealt with. */
export function startEncounters(d: Dungeon, p: DungeonProgress, rng: Rng): Encounters {
  const creatures: Creature[] = [];
  let id = 1;
  const add = (kind: Creature['kind'], x: number, y: number): void => {
    creatures.push(newCreature(id++, kind, x + 0.5, y + 0.5, rng));
  };
  for (const s of d.spawns) if (!p.solved.includes(s.room)) add(s.kind, s.x, s.y);
  if (!p.boss) add(d.boss.kind, d.boss.x, d.boss.y);
  // A crystal is struck by its own id, so the event says which one to light.
  const targets = d.crystals.filter((c) => !p.lit.includes(c.id)).map((c) => ({ id: c.id, x: c.x + 0.5, y: c.y + 0.5 }));
  return { ...emptyEncounters(), creatures, targets, nextId: id, spawnTimer: 1e9 };
}

/** How many creatures stand inside the room right now. */
export function creaturesInRoom(e: Encounters, d: Dungeon, roomId: number): number {
  const r = d.rooms[roomId];
  return e.creatures.filter((c) => c.x >= r.x0 && c.x < r.x0 + ROOM_W && c.y >= r.y0 && c.y < r.y0 + ROOM_H).length;
}

/** The boss, if it is still alive. */
export const bossOf = (e: Encounters, d: Dungeon): Creature | undefined => e.creatures.find((c) => c.kind === d.boss.kind && CREATURES[c.kind].temper === 'boss');
```

- [ ] **Step 5: Run the tests, the typecheck and the whole suite**

Run: `npx vitest run tests/creatures-data.test.ts tests/boss.test.ts tests/encounters-boss.test.ts tests/dungeon-start.test.ts && npm run typecheck && npm test`
Expected: creatures-data 11, boss 14, encounters-boss 14, dungeon-start 5 tests PASS; typecheck exits 0; the whole suite passes (470 tests).

- [ ] **Step 6: Commit**

```bash
git add src/data/bosses.ts src/data/creatures.ts src/sim/boss.ts src/sim/bossFight.ts src/sim/creatures.ts src/sim/encounters.ts src/sim/dungeon/start.ts tests/creatures-data.test.ts tests/boss.test.ts tests/encounters-boss.test.ts tests/dungeon-start.test.ts
git commit -m "feat: add three bosses with two phases, bolts, helpers and crystal targets"
```

---

### Task 6: Actions, session and sound cues for dungeons and armour

**Files:**
- Replace: `src/sim/actions.ts`, `src/sim/session.ts`, `src/sim/cues.ts`, `src/sim/combat.ts`, `tests/combat.test.ts`, `tests/cues.test.ts`
- Modify: `tests/actions.test.ts`, `tests/actions-combat.test.ts` (one line each)
- Test: `tests/actions-dungeon.test.ts`, `tests/session-dungeon.test.ts`, `tests/session-equipment.test.ts` (new)

**Interfaces:**
- Consumes: Tasks 1 to 5.
- Produces: `ActionContext` gains `entrance: DungeonId | null` and `target: Target | null`; actions `enter`, `leave`, `chest`, `door`; `Blocked` gains `needsKey` and `needsBossKey`; `Fx` gains `equipped`, `travel {to}`, `chestOpened {id}`, `doorOpened {id}`; `Session` gains `location`, `equipment`, `dungeons`; `equipArmor(session, index)`, `takeOffArmor(session)`, `updateDungeon(session, change)`; cues for the new effects and `struck`; `HERO_DEFENSE` is gone (the worn armour decides).

- [ ] **Step 1: Write the failing tests**

`tests/actions-dungeon.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import type { ItemId } from '@/data/items';
import { emptyFarm } from '@/sim/farm';
import { resolveAction, type Action, type ActionContext } from '@/sim/actions';
import { generateDungeon } from '@/sim/dungeon/generate';
import { addItem, emptyInventory } from '@/sim/inventory';
import { emptyStructures, placeStructure } from '@/sim/structures';
import { fullVitals } from '@/sim/vitals';
import { T, WORLD_SIZE, type World } from '@/sim/world/types';

function makeWorld(): World {
  const size = WORLD_SIZE;
  return { seed: 0, size, terrain: new Uint8Array(size * size).fill(T.GRASS), biome: new Uint8Array(size * size), landmarks: [], resources: [], start: { x: 10, y: 10 } };
}

const d = generateDungeon(1, 'grotto');
const chestFree = d.chests.find((c) => !c.locked)!;
const chestLocked = d.chests.find((c) => c.locked)!;
const bossDoor = d.doors.find((x) => x.lock === 'boss')!;

/** Hero at (10.5, 10.5) facing right; `give` puts items in the backpack. */
function ctx(over: Partial<ActionContext> & { give?: [ItemId, number][] } = {}): ActionContext {
  const { give, ...rest } = over;
  let inv = emptyInventory();
  for (const [item, n] of give ?? []) inv = addItem(inv, item, n).inv;
  return {
    world: makeWorld(), inv, selected: 0, vitals: fullVitals(), pos: { x: 10.5, y: 10.5 }, facing: 'right', structures: emptyStructures(),
    farm: emptyFarm(), occupied: new Set(), node: null, creature: false, entrance: null, target: null, ...rest,
  };
}
const kind = (a: Action): string => a.kind;

describe('dungeon entrances and exits', () => {
  it('goes in when the tile in front is a dungeon entrance, whatever is held', () => {
    expect(resolveAction(ctx({ entrance: 'grotto' }))).toEqual({ kind: 'enter', dungeon: 'grotto' });
    expect(resolveAction(ctx({ entrance: 'ruin', give: [['axe_wood', 1]] }))).toEqual({ kind: 'enter', dungeon: 'ruin' });
    expect(resolveAction(ctx({ entrance: 'deepmine', give: [['cooked_meat', 1]] }))).toEqual({ kind: 'enter', dungeon: 'deepmine' });
  });

  it('goes out through the exit doorway', () => {
    expect(resolveAction(ctx({ target: { kind: 'exit' } }))).toEqual({ kind: 'leave' });
  });

  it('still lets a building in front come first, as everywhere else', () => {
    const structures = placeStructure(emptyStructures(), 'workbench', 11, 10);
    expect(kind(resolveAction(ctx({ entrance: 'grotto', structures })))).toBe('open');
  });
});

describe('chests and doors', () => {
  it('opens a chest that is not locked without any key', () => {
    expect(resolveAction(ctx({ target: { kind: 'chest', chest: chestFree } }))).toEqual({ kind: 'chest', chest: chestFree });
  });

  it('needs a small key for a locked chest, and says so when there is none', () => {
    const target = { kind: 'chest', chest: chestLocked } as const;
    expect(resolveAction(ctx({ target }))).toEqual({ kind: 'blocked', reason: 'needsKey' });
    expect(resolveAction(ctx({ target, give: [['boss_key', 1]] }))).toEqual({ kind: 'blocked', reason: 'needsKey' });
    expect(resolveAction(ctx({ target, give: [['small_key', 1]] }))).toEqual({ kind: 'chest', chest: chestLocked });
  });

  it('needs the boss key for the boss door, and says so when there is none', () => {
    const target = { kind: 'door', door: bossDoor } as const;
    expect(resolveAction(ctx({ target }))).toEqual({ kind: 'blocked', reason: 'needsBossKey' });
    expect(resolveAction(ctx({ target, give: [['small_key', 3]] }))).toEqual({ kind: 'blocked', reason: 'needsBossKey' });
    expect(resolveAction(ctx({ target, give: [['boss_key', 1]] }))).toEqual({ kind: 'door', door: bossDoor });
  });
});
```

`tests/session-dungeon.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { newSlot } from '@/core/saveData';
import { generateDungeon } from '@/sim/dungeon/generate';
import { emptyProgress } from '@/sim/dungeon/progress';
import { lightCrystal } from '@/sim/dungeon/rules';
import { addItem, countItem } from '@/sim/inventory';
import { applyAction, sessionFromSlot, updateDungeon, type Session } from '@/sim/session';

const slot = () => newSlot(0, 'Ari', 1234, 'normal', { x: 50, y: 50 }, { day: 1, t: 100 }, 1000);
const base = (over: Partial<Session> = {}): Session => ({ ...sessionFromSlot(slot()), ...over });
const give = (s: Session, ...pairs: [Parameters<typeof addItem>[1], number][]): Session => ({
  ...s, inventory: pairs.reduce((inv, [item, n]) => addItem(inv, item, n).inv, s.inventory),
});
const pos = { x: 50.5, y: 50.5 };
const d = generateDungeon(1, 'grotto');
const free = d.chests.find((c) => !c.locked)!;
const locked = d.chests.find((c) => c.locked && c.loot.some((l) => l.item === 'boss_key'))!;
const bossDoor = d.doors.find((x) => x.lock === 'boss')!;
const fxTypes = (r: ReturnType<typeof applyAction>) => r.fx.map((f) => f.t);

describe('travelling', () => {
  it('moves the hero into a dungeon and back out, and tells the scene to change the level', () => {
    const inside = applyAction(base(), { kind: 'enter', dungeon: 'deepmine' }, pos);
    expect(inside.session.location).toBe('deepmine');
    expect(inside.fx).toEqual([{ t: 'travel', to: 'deepmine' }]);
    const out = applyAction(inside.session, { kind: 'leave' }, pos);
    expect(out.session.location).toBeNull();
    expect(out.fx).toEqual([{ t: 'travel', to: null }]);
  });
});

describe('opening a chest', () => {
  it('hands over the loot of a free chest, remembers it, and keeps the keys it gave', () => {
    const s = base({ location: 'grotto' });
    const r = applyAction(s, { kind: 'chest', chest: free }, pos);
    expect(countItem(r.session.inventory, 'small_key')).toBe(2);
    expect(r.session.dungeons.grotto.looted).toEqual([free.id]);
    expect(fxTypes(r)).toEqual(['chestOpened', 'gain']);
    expect(s.dungeons.grotto.looted).toEqual([]);
  });

  it('spends one small key on a locked chest', () => {
    const s = give(base({ location: 'grotto' }), ['small_key', 2]);
    const r = applyAction(s, { kind: 'chest', chest: locked }, pos);
    expect(countItem(r.session.inventory, 'small_key')).toBe(1);
    expect(countItem(r.session.inventory, 'boss_key')).toBe(1);
    expect(r.session.dungeons.grotto.looted).toEqual([locked.id]);
  });

  it('keeps the key and the loot where they are when the backpack is full, and says so', () => {
    let s = give(base({ location: 'grotto' }), ['small_key', 1]);
    for (let i = 0; i < 40; i++) s = { ...s, inventory: addItem(s.inventory, 'wood', 99).inv };
    // The treasure holds three kinds of item; spending the key frees only one slot.
    const treasure = d.chests.find((c) => c.locked && c.loot.length === 3)!;
    const r = applyAction(s, { kind: 'chest', chest: treasure }, pos);
    expect(r.session).toBe(s);
    expect(r.fx.map((f) => f.t === 'say' && f.key)).toEqual(['msgFull']);
  });

  it('does nothing without the key it needs, or outside a dungeon', () => {
    const s = base({ location: 'grotto' });
    expect(applyAction(s, { kind: 'chest', chest: locked }, pos).session).toBe(s);
    const island = give(base(), ['small_key', 1]);
    expect(applyAction(island, { kind: 'chest', chest: locked }, pos).session).toBe(island);
  });

  it('turns a blocked key door into the right message', () => {
    expect(applyAction(base(), { kind: 'blocked', reason: 'needsKey' }, pos).fx.map((f) => f.t === 'say' && f.key)).toEqual(['msgNeedsKey']);
    expect(applyAction(base(), { kind: 'blocked', reason: 'needsBossKey' }, pos).fx.map((f) => f.t === 'say' && f.key)).toEqual(['msgNeedsBossKey']);
  });
});

describe('unlocking the boss door', () => {
  it('uses up the boss key and keeps the door open from then on', () => {
    const s = give(base({ location: 'grotto' }), ['boss_key', 1]);
    const r = applyAction(s, { kind: 'door', door: bossDoor }, pos);
    expect(countItem(r.session.inventory, 'boss_key')).toBe(0);
    expect(r.session.dungeons.grotto.opened).toEqual([bossDoor.id]);
    expect(r.fx).toEqual([{ t: 'doorOpened', id: bossDoor.id }]);
  });

  it('does nothing without the key', () => {
    const s = base({ location: 'grotto' });
    expect(applyAction(s, { kind: 'door', door: bossDoor }, pos).session).toBe(s);
  });
});

describe('updateDungeon', () => {
  it('changes the progress of the dungeon the hero is in, and nothing when he is on the island or nothing changed', () => {
    const inside = base({ location: 'ruin' });
    const lit = updateDungeon(inside, (p) => lightCrystal(p, 2));
    expect(lit.dungeons.ruin.lit).toEqual([2]);
    expect(lit.dungeons.grotto).toBe(inside.dungeons.grotto);
    expect(updateDungeon(inside, (p) => p)).toBe(inside);
    expect(updateDungeon(base(), (p) => lightCrystal(p, 2))).toEqual(base());
    expect(emptyProgress().lit).toEqual([]);
  });
});
```

`tests/session-equipment.test.ts`:

```typescript
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
```

Replace `tests/combat.test.ts` (no more `HERO_DEFENSE`) and `tests/cues.test.ts` (the new cues):

`tests/combat.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { DIFFICULTY_DAMAGE, HERO_IFRAMES, enemyDamage, facingFromVector, inSwing, knockbackVec } from '@/sim/combat';

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
  it('gives the hero a short moment of safety after a hit', () => {
    expect(HERO_IFRAMES).toBeGreaterThan(0.3);
    expect(HERO_IFRAMES).toBeLessThan(1.5);
  });
});
```

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
    expect(cue({ t: 'equipped' })).toBe('pickup');
    expect(cue({ t: 'chestOpened', id: 1 })).toBe('pickup');
    expect(cue({ t: 'doorOpened', id: 1 })).toBe('place');
    expect(cue({ t: 'travel', to: null })).toBeNull();
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
    expect(cueForEncounter({ t: 'struck', id: 2 })).toBe('hit');
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

The two older test helpers that build an `ActionContext` must supply the new fields. In both `tests/actions.test.ts` and `tests/actions-combat.test.ts`, change this text inside `ctx()`:

```ts
creature: false, ...rest,
```

to:

```ts
creature: false, entrance: null, target: null, ...rest,
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/actions-dungeon.test.ts tests/session-dungeon.test.ts tests/session-equipment.test.ts tests/combat.test.ts tests/cues.test.ts`
Expected: FAIL. The new test files report failing tests (no `enter` action, no `equipArmor`, no `updateDungeon`); `cues.test.ts` fails its `equipped`, `chestOpened`, `struck` cases.

- [ ] **Step 3: Write the code**

A hero with no hit points does nothing; a dungeon entrance, the exit, a chest and the boss door are things ACTION can use (a building in front still comes first):

`src/sim/actions.ts`:

```typescript
import { ITEMS, type ToolType, type WeaponStats } from '@/data/items';
import type { CropId } from '@/data/crops';
import { STRUCTURES, type StructureId } from '@/data/structures';
import { STAMINA_TOOL } from '@/data/tools';
import { canTill, isRipe, plotAt, type Farm } from '@/sim/farm';
import type { DungeonId } from '@/sim/dungeon/progress';
import type { Target } from '@/sim/dungeon/rules';
import type { Chest, Door } from '@/sim/dungeon/types';
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
  /** The dungeon whose entrance is the tile in front of the hero (on the island). */
  entrance: DungeonId | null;
  /** What the hero can use on the tile in front of him inside a dungeon: a locked door, a chest, the way out. */
  target: Target | null;
}

export type Blocked =
  | { reason: 'needsTool'; tool: ToolType; tier: number }
  | { reason: 'tired' }
  | { reason: 'saltWater' }
  | { reason: 'canEmpty' }
  | { reason: 'chestNotEmpty' }
  | { reason: 'noArrows' }
  | { reason: 'needsKey' }
  | { reason: 'needsBossKey' }
  | { reason: 'cannotPlace'; why: Extract<PlaceResult, { ok: false }>['reason'] };

export type Action =
  | { kind: 'none' }
  | ({ kind: 'blocked' } & Blocked)
  | { kind: 'hit'; node: ResourceNode; damage: number; stamina: number; wear: boolean }
  | { kind: 'attack'; melee: Melee }
  | { kind: 'enter'; dungeon: DungeonId }
  | { kind: 'leave' }
  | { kind: 'chest'; chest: Chest }
  | { kind: 'door'; door: Door }
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
  // A hero with no hit points left does nothing: no action may heal him before the death check runs.
  if (c.vitals.hp <= 0) return NONE;
  const slot = c.inv[c.selected] ?? null;
  const def = slot ? ITEMS[slot.item] : null;
  // What a blow with the held item would be, offered whenever the item has nothing else to do and a creature is in reach.
  const melee = meleeFor(slot?.item ?? null);
  const fight: Action = c.vitals.stamina < melee.stamina ? blocked({ reason: 'tired' }) : { kind: 'attack', melee };
  const orFight = c.creature ? fight : NONE;

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
  if (c.entrance) return { kind: 'enter', dungeon: c.entrance };
  const use = c.target;
  if (use) {
    if (use.kind === 'exit') return { kind: 'leave' };
    if (use.kind === 'chest') return use.chest.locked && countItem(c.inv, 'small_key') === 0 ? blocked({ reason: 'needsKey' }) : { kind: 'chest', chest: use.chest };
    return countItem(c.inv, 'boss_key') === 0 ? blocked({ reason: 'needsBossKey' }) : { kind: 'door', door: use.door };
  }

  const terrain = inside ? c.world.terrain[tile] : T.DEEP;
  if (def?.food) return wouldWaste(c.vitals, def.food) ? orFight : { kind: 'eat', food: def.food };
  if (def?.place) {
    const ok = canPlace(c.world, c.structures, c.occupied, x, y, c.pos, STRUCTURES[def.place].solid);
    return ok.ok ? { kind: 'place', type: def.place, x, y } : blocked({ reason: 'cannotPlace', why: ok.reason });
  }
  if (def?.seed) return plot && !plot.crop ? { kind: 'plant', x, y, crop: def.seed } : orFight;
  if (def?.tool?.type === 'hoe') {
    if (!canTill(c.world, c.farm, c.occupied, x, y)) return orFight;
    return c.vitals.stamina < STAMINA_TOOL ? blocked({ reason: 'tired' }) : { kind: 'till', x, y, stamina: STAMINA_TOOL };
  }
  if (def?.tool?.type === 'can') {
    if (terrain === T.RIVER) return { kind: 'refill', x, y };
    if (terrain === T.SHALLOW) return blocked({ reason: 'saltWater' });
    if (!plot || !plot.crop || plot.watered) return orFight;
    return (slot?.dur ?? 0) > 0 ? { kind: 'water', x, y } : blocked({ reason: 'canEmpty' });
  }

  if (def?.weapon?.kind === 'bow') {
    if (countItem(c.inv, 'arrow') === 0) return blocked({ reason: 'noArrows' });
    if (c.vitals.stamina < def.weapon.stamina) return blocked({ reason: 'tired' });
    return { kind: 'shoot', stats: def.weapon };
  }
  if (c.creature) return fight;

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

The session: the new fields, wearing and taking off armour, the four dungeon actions (a locked chest spends one small key but only when the loot fits; the boss door uses up the boss key), and `updateDungeon`:

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
import type { DungeonId, DungeonProgress, Dungeons } from '@/sim/dungeon/progress';
import { lootChest, unlockDoor } from '@/sim/dungeon/rules';
import type { Chest, Door } from '@/sim/dungeon/types';
import { equipFromSlot, unequipArmor, type Equipment } from '@/sim/equipment';
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
  /** The dungeon the hero is in, or null on the island. */
  location: DungeonId | null;
  equipment: Equipment;
  dungeons: Dungeons;
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
  | { t: 'ate' }
  | { t: 'equipped' }
  | { t: 'travel'; to: DungeonId | null }
  | { t: 'chestOpened'; id: number }
  | { t: 'doorOpened'; id: number };

export interface Step {
  session: Session;
  fx: Fx[];
}

export function sessionFromSlot(slot: SaveSlot): Session {
  return {
    seed: slot.seed, difficulty: slot.difficulty, clock: slot.clock, gather: slot.gather, inventory: slot.inventory,
    selected: slot.selected, vitals: slot.vitals, structures: slot.structures, farm: slot.farm, respawn: slot.respawn,
    playTime: slot.playTimeSec, location: slot.location, equipment: slot.equipment, dungeons: slot.dungeons,
  };
}

/** Merge the live state back into a slot record for saving. */
export function sessionToSlot(base: SaveSlot, s: Session, pos: Vec): SaveSlot {
  return {
    ...base, player: { x: pos.x, y: pos.y }, respawn: s.respawn, clock: s.clock, gather: s.gather, inventory: s.inventory,
    selected: s.selected, vitals: s.vitals, structures: s.structures, farm: s.farm, playTimeSec: s.playTime,
    location: s.location, equipment: s.equipment, dungeons: s.dungeons,
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

/** Change the progress of the dungeon the hero is in. The very same session comes back when there is no change. */
export function updateDungeon(s: Session, change: (p: DungeonProgress) => DungeonProgress): Session {
  if (!s.location) return s;
  const before = s.dungeons[s.location];
  const after = change(before);
  return after === before ? s : { ...s, dungeons: { ...s.dungeons, [s.location]: after } };
}

function openChest(s: Session, chest: Chest): Step {
  if (!s.location || s.dungeons[s.location].looted.includes(chest.id)) return { session: s, fx: [] };
  const paid = chest.locked ? removeItem(s.inventory, 'small_key', 1) : s.inventory;
  if (!paid) return { session: s, fx: [] };
  const given = giveItems(paid, chest.loot.map((l) => ({ item: l.item, qty: l.qty })));
  if (given.overflow) return { session: s, fx: [say('msgFull')] };
  const session = updateDungeon({ ...s, inventory: given.inv }, (p) => lootChest(p, chest.id));
  return { session, fx: [{ t: 'chestOpened', id: chest.id }, ...given.fx] };
}

function openBossDoor(s: Session, door: Door): Step {
  const paid = s.location ? removeItem(s.inventory, 'boss_key', 1) : null;
  if (!paid) return { session: s, fx: [] };
  return { session: updateDungeon({ ...s, inventory: paid }, (p) => unlockDoor(p, door.id)), fx: [{ t: 'doorOpened', id: door.id }] };
}

/** Put the armour in a backpack slot on; whatever was worn goes back into that slot. */
export function equipArmor(s: Session, index: number): Step {
  const worn = equipFromSlot(s.inventory, s.equipment, index);
  return worn ? { session: { ...s, inventory: worn.inv, equipment: worn.equipment }, fx: [{ t: 'equipped' }] } : { session: s, fx: [] };
}

/** Take the armour off into the backpack. */
export function takeOffArmor(s: Session): Step {
  if (!s.equipment.armor) return { session: s, fx: [] };
  const off = unequipArmor(s.inventory, s.equipment);
  if (!off) return { session: s, fx: [say('msgFull')] };
  return { session: { ...s, inventory: off.inv, equipment: off.equipment }, fx: [{ t: 'equipped' }] };
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
    case 'needsKey': return [say('msgNeedsKey')];
    case 'needsBossKey': return [say('msgNeedsBossKey')];
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
    case 'enter': return { session: { ...s, location: a.dungeon }, fx: [{ t: 'travel', to: a.dungeon }] };
    case 'leave': return { session: { ...s, location: null }, fx: [{ t: 'travel', to: null }] };
    case 'chest': return openChest(s, a.chest);
    case 'door': return openBossDoor(s, a.door);
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

Sound for the new effects, and `struck` sounds like a hit:

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
    case 'gain': case 'unbuilt': case 'equipped': case 'chestOpened': return 'pickup';
    case 'doorOpened': return 'place';
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
  return ev.t === 'hit' || ev.t === 'struck' ? 'hit' : ev.t === 'killed' ? 'kill' : 'hurt';
}

/** Battle music while monsters are on the hero; otherwise the music of the time of day. */
export const musicFor = (night: boolean, fighting: boolean): Mood => (fighting ? 'battle' : night ? 'night' : 'day');
```

`HERO_DEFENSE` is replaced by the worn armour; `SwingStats`, `enemyDamage` and the rest stay:

`src/sim/combat.ts`:

```typescript
import type { WeaponStats } from '@/data/items';
import type { Facing } from '@/sim/actions';
import type { Vec } from '@/sim/movement';
import type { Difficulty } from '@/sim/vitals';

/** The part of a weapon that decides what a swing hits and how hard. */
export type SwingStats = Pick<WeaponStats, 'damage' | 'reach' | 'arc' | 'knockback'>;

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

- [ ] **Step 4: Run the tests, the typecheck and the whole suite**

Run: `npx vitest run tests/actions-dungeon.test.ts tests/session-dungeon.test.ts tests/session-equipment.test.ts tests/combat.test.ts tests/cues.test.ts tests/actions.test.ts tests/actions-combat.test.ts tests/session.test.ts`
Expected: actions-dungeon 6, session-dungeon 9, session-equipment 4, combat 12, cues 7, actions 18, actions-combat 11, session 32 tests PASS.

Run: `npm run typecheck`
Expected: errors only in `src/scenes/GameScene.ts` and `src/game/HeroCombat.ts` (the resolver needs two more fields and `HERO_DEFENSE` is gone); Task 7 fixes them, and the next step commits anyway because the unit suite is green.

Run: `npx vitest run`
Expected: the whole suite passes (489 tests).

- [ ] **Step 5: Commit**

```bash
git add src/sim/actions.ts src/sim/session.ts src/sim/cues.ts src/sim/combat.ts tests/actions-dungeon.test.ts tests/session-dungeon.test.ts tests/session-equipment.test.ts tests/combat.test.ts tests/cues.test.ts tests/actions.test.ts tests/actions-combat.test.ts
git commit -m "feat: add dungeon actions, wearing armour and their sounds"
```

---

### Task 7: Levels on the scene: the island, the dungeons, the boss bar and the armour screen

**Files:**
- Create: `src/data/dungeonArt.ts`, `src/game/Level.ts`, `src/game/IslandLevel.ts`, `src/game/DungeonLevel.ts`, `src/gfx/DungeonLayer.ts`
- Replace: `src/data/landmarkProps.ts`, `src/gfx/TerrainLayer.ts`, `src/gfx/CreatureLayer.ts`, `src/game/Wildlife.ts`, `src/game/HeroCombat.ts`, `src/scenes/GameScene.ts`, `src/scenes/HudScene.ts`, `src/scenes/InventoryScene.ts`, `tests/i18n.test.ts`
- Modify: `tools/pack_assets.py` (three lines)
- Generated: `public/assets/pack/props.png`, `public/assets/pack/props.json`
- Test: `tests/dungeon-art.test.ts` (new), `tests/i18n.test.ts` (replaced)

**Interfaces:**
- Consumes: everything from Tasks 1 to 6.
- Produces: `Level {world, dungeon, fixed, place, start, blocking, view, lit, stations, isNight, nodeKind, onFx, onEvents, update, newDay, bossBar}`, `LevelView`, `Lit`; `IslandLevel`, `DungeonLevel` (pushing blocks, spikes, solving rooms, lighting crystals, writing the boss's death into the progress); `DungeonLayer`; `DUNGEON_ART`; `GameScene` runs a level, switches between island and dungeon (`travel`), wears armour (`wear(index | null)`), shows `bossBar()`; `HeroCombat.harm(raw)`, `load`, `snapshot`; `Wildlife.load`; `TerrainLayer(scene, world, theme?)`; the entrance doors of the island landmarks; a boss health bar in the HUD; an armour box and a Wear button in the backpack.

- [ ] **Step 1: Write the failing tests**

`tests/dungeon-art.test.ts`:

```typescript
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DUNGEON_ART } from '@/data/dungeonArt';
import { LANDMARK_PROPS } from '@/data/landmarkProps';
import { DUNGEON_IDS } from '@/sim/dungeon/progress';

const PROPS = path.resolve(__dirname, '../public/assets/pack/props.json');
const frames = fs.existsSync(PROPS) ? (JSON.parse(fs.readFileSync(PROPS, 'utf8')) as { frames: Record<string, unknown> }).frames : null;

describe.skipIf(!frames)('dungeon art', () => {
  const need = (name: string): void => expect(frames![name], name).toBeDefined();

  it('has every door, chest, crystal, trap, switch and block frame the dungeon draws', () => {
    for (const door of Object.values(DUNGEON_ART.door)) for (let i = 0; i < 4; i++) need(`${door}/${i}`);
    for (const chest of Object.values(DUNGEON_ART.chest)) for (let i = 0; i < 4; i++) need(`${chest}/${i}`);
    for (const crystal of Object.values(DUNGEON_ART.crystal)) for (let i = 0; i < 3; i++) need(`${crystal}/${i}`);
    for (const i of Object.values(DUNGEON_ART.trap)) need(`${DUNGEON_ART.trapSheet}/${i}`);
    need(DUNGEON_ART.switch.off);
    need(DUNGEON_ART.switch.on);
    need(DUNGEON_ART.block);
    need(`${DUNGEON_ART.torch}/0`);
  });

  it('puts a closed dungeon door on the entrance tile of the three dungeons, and keeps it solid', () => {
    for (const id of DUNGEON_IDS) {
      const door = LANDMARK_PROPS[id].find((p) => p.dx === 0 && p.dy === 0);
      expect(door, id).toBeDefined();
      expect(door!.frame, id).toMatch(/^door\//);
      expect(door!.blocks, id).toEqual([[0, 0]]);
      need(door!.frame);
    }
  });
});
```

Replace `tests/i18n.test.ts` (checks the dungeon, boss and armour texts):

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

describe('dungeon texts', () => {
  it('names every dungeon and boss, and has the messages of the dungeon rules, in both languages', () => {
    for (const id of ['grotto', 'deepmine', 'ruin']) expect(UI_STRINGS[`dungeon_${id}`], id).toBeDefined();
    for (const id of ['mossback', 'ironbones', 'mirelord']) expect(UI_STRINGS[`boss_${id}`], id).toBeDefined();
    for (const key of ['msgWayOpens', 'msgBossDefeated', 'wearArmor', 'takeOffArmor', 'armorDefense', 'armorNone']) expect(UI_STRINGS[key], key).toBeDefined();
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

Run: `npx vitest run tests/dungeon-art.test.ts tests/i18n.test.ts`
Expected: FAIL. `dungeon-art.test.ts` stops with "Cannot find module '@/data/dungeonArt'". `i18n.test.ts` may already pass (Task 1 added the texts); that is fine.

- [ ] **Step 3: Pack the push-block sprite**

In `tools/pack_assets.py`, inside `build_props()`, find the line `anim = SRC / "Animations"` and put these lines directly before it:

```python
    # Blocks the hero can push (dungeon puzzles).
    for f in sorted((SRC / "Prefabs_with_behavior" / "block_push_on_contact" / "Sprites").glob("*.png")):
        a.add_image(f"p/{f.stem.lower()}", f)
```

Rebuild only the props atlas (every old frame keeps its name):

```bash
cd tools && python -c "import pack_assets; pack_assets.build_props()" && cd ..
```

Expected: prints `atlas props: 828 frames -> 2048x512`.

- [ ] **Step 4: Write the data and the drawing**

Which atlas frames draw a dungeon, and the doors on the island that lead in:

`src/data/dungeonArt.ts`:

```typescript
/**
 * Frames of the `props` atlas that draw a dungeon. Groups ("door/door_10") are animations made of numbered frames
 * ("door/door_10/0" is closed, the last one is open).
 */
export const DUNGEON_ART = {
  door: { gate: 'door/door_dungeon_8_h', boss: 'door/door_10', exit: 'door/door_dungeon_9_h' },
  /** Frame 0 is shut, 3 is wide open. */
  chest: { free: 'chest/chest_01', locked: 'chest/chest_03' },
  /** Three shimmering frames each. */
  crystal: { dull: 'crystal/cristal_10', lit: 'crystal/cristal_20' },
  trapSheet: 'trap/trap_1',
  /** Frame numbers of the spike sheet: holes in the floor, a few points showing, spikes up. */
  trap: { down: 0, warn: 3, up: 4 },
  switch: { off: 'switch/switch_03/right/0', on: 'switch/switch_03/right/1' },
  block: 'p/block_01',
  /** Animated wall torch; its animation key is "torch_torch_03". */
  torch: 'torch/torch_03',
} as const;
```

`src/data/landmarkProps.ts`:

```typescript
import type { LandmarkId } from '@/sim/world/types';

export interface PropSpec {
  /** Frame in the `props` atlas. */
  frame: string;
  /** Offset from the landmark tile, in tiles (the prop is drawn at the centre of that tile). */
  dx: number;
  dy: number;
  /** Animation key to loop instead of showing a still frame. */
  anim?: string;
  /** Tiles, as integer offsets from the landmark tile, that the player cannot walk through. */
  blocks?: readonly (readonly [number, number])[];
}

/**
 * Scenery that marks each story landmark. These are stand-ins that later phases replace with real NPC huts,
 * dungeon doors and the lighthouse; the footprint stays inside the area the generator keeps clear of resources.
 */
export const LANDMARK_PROPS: Record<LandmarkId, readonly PropSpec[]> = {
  start: [
    { frame: 'p/crate_03', dx: -2, dy: -1 },
    { frame: 'p/barrel_02', dx: 2, dy: 0 },
    { frame: 'p/crate_05', dx: 3, dy: -1 },
  ],
  camp: [{ frame: 'fire/campfire_burning/0', dx: 0, dy: 0, anim: 'fire_campfire_burning' }],
  sailor: [{ frame: 'p/house_01', dx: 0, dy: 0, blocks: [[-1, 0], [0, 0], [1, 0]] }],
  herbalist: [{ frame: 'p/house_02', dx: 0, dy: 0, blocks: [[-1, 0], [0, 0], [1, 0]] }],
  miner: [{ frame: 'p/house_05', dx: 0, dy: 0, blocks: [[-1, 0], [0, 0], [1, 0]] }],
  grotto: [
    { frame: 'door/door_dungeon_8_h/0', dx: 0, dy: 0, blocks: [[0, 0]] },
    { frame: 'p/column_01', dx: -1, dy: 0, blocks: [[-1, 0]] },
    { frame: 'p/column_01', dx: 1, dy: 0, blocks: [[1, 0]] },
  ],
  deepmine: [
    { frame: 'door/door_dungeon_9_h/0', dx: 0, dy: 0, blocks: [[0, 0]] },
    { frame: 'p/column_03', dx: -1, dy: 0, blocks: [[-1, 0]] },
    { frame: 'p/column_03', dx: 1, dy: 0, blocks: [[1, 0]] },
  ],
  ruin: [
    { frame: 'door/door_dungeon_10_h/0', dx: 0, dy: 0, blocks: [[0, 0]] },
    { frame: 'p/statue_01', dx: 0, dy: -1 },
    { frame: 'p/column_05', dx: -2, dy: 1, blocks: [[-2, 1]] },
    { frame: 'p/column_05', dx: 2, dy: 1, blocks: [[2, 1]] },
  ],
  lighthouse: [
    { frame: 'p/statue_02', dx: 0, dy: 0, blocks: [[0, 0]] },
    { frame: 'p/lamp_04', dx: 2, dy: 0, blocks: [[2, 0]] },
  ],
  tablets: [{ frame: 'p/statue_03', dx: 0, dy: 0, blocks: [[0, 0]] }],
  treasure1: [{ frame: 'chest/chest_01/0', dx: 0, dy: 0 }],
  treasure2: [{ frame: 'chest/chest_01/0', dx: 0, dy: 0 }],
  treasure3: [{ frame: 'chest/chest_01/0', dx: 0, dy: 0 }],
};
```

The dungeon's puzzle pieces as sprites, with doors that open, switches that change colour, blocks that slide, chests that open, crystals that light up and spikes that rise and fall:

`src/gfx/DungeonLayer.ts`:

```typescript
import Phaser from 'phaser';
import { DUNGEON_ART } from '@/data/dungeonArt';
import { animKey } from '@/gfx/animations';
import { TILE } from '@/gfx/TerrainLayer';
import type { DungeonProgress } from '@/sim/dungeon/progress';
import { doorIsOpen, pressedSwitches, trapState, type Run } from '@/sim/dungeon/rules';
import type { Dungeon } from '@/sim/dungeon/types';

const BLOCK_SLIDE_MS = 120;

/** Where a sprite stands on a tile: horizontally centred, resting on the tile's lower edge. */
const footX = (x: number): number => (x + 0.5) * TILE;
const footY = (y: number): number => (y + 1) * TILE - 1;

/** The sprites of a dungeon's puzzle pieces. `refresh` brings them in line with the rules; `traps` animates the spikes. */
export class DungeonLayer {
  private doors = new Map<number, { sprite: Phaser.GameObjects.Sprite; open: boolean }>();
  private switches = new Map<number, { sprite: Phaser.GameObjects.Image; on: boolean }>();
  private blocks = new Map<number, Phaser.GameObjects.Image>();
  private chests = new Map<number, { sprite: Phaser.GameObjects.Sprite; open: boolean }>();
  private crystals = new Map<number, { sprite: Phaser.GameObjects.Sprite; lit: boolean }>();
  private traps = new Map<number, { sprite: Phaser.GameObjects.Image; state: string }>();

  constructor(private scene: Phaser.Scene, private dungeon: Dungeon, run: Run, progress: DungeonProgress) {
    const d = dungeon;
    for (const t of d.torches) {
      scene.add.sprite(footX(t.x), footY(t.y), 'props', `${DUNGEON_ART.torch}/0`).setOrigin(0.5, 1).setDepth(footY(t.y) + 1).play(animKey(DUNGEON_ART.torch));
    }
    scene.add.sprite(footX(d.exit.x), footY(d.exit.y), 'props', `${DUNGEON_ART.door.exit}/3`).setOrigin(0.5, 1).setDepth(footY(d.exit.y));
    for (const door of d.doors) {
      if (door.lock === 'free') continue;
      const group = door.lock === 'boss' ? DUNGEON_ART.door.boss : DUNGEON_ART.door.gate;
      this.doors.set(door.id, { sprite: scene.add.sprite(footX(door.x), footY(door.y), 'props', `${group}/0`).setOrigin(0.5, 1).setDepth(footY(door.y)), open: false });
    }
    for (const s of d.switches) this.switches.set(s.id, { sprite: scene.add.image(footX(s.x), footY(s.y), 'props', DUNGEON_ART.switch.off).setOrigin(0.5, 1).setDepth(footY(s.y) - 8), on: false });
    for (const b of run.blocks) this.blocks.set(b.id, scene.add.image(footX(b.x), footY(b.y), 'props', DUNGEON_ART.block).setOrigin(0.5, 1).setDepth(footY(b.y)));
    for (const c of d.chests) {
      const group = c.locked ? DUNGEON_ART.chest.locked : DUNGEON_ART.chest.free;
      this.chests.set(c.id, { sprite: scene.add.sprite(footX(c.x), footY(c.y), 'props', `${group}/0`).setOrigin(0.5, 1).setDepth(footY(c.y)), open: false });
    }
    for (const c of d.crystals) {
      const sprite = scene.add.sprite(footX(c.x), footY(c.y), 'props', `${DUNGEON_ART.crystal.dull}/0`).setOrigin(0.5, 1).setDepth(footY(c.y)).play(animKey(DUNGEON_ART.crystal.dull));
      this.crystals.set(c.id, { sprite, lit: false });
    }
    for (const t of d.traps) this.traps.set(t.id, { sprite: scene.add.image(footX(t.x), footY(t.y), 'props', `${DUNGEON_ART.trapSheet}/${DUNGEON_ART.trap.down}`).setOrigin(0.5, 1).setDepth(footY(t.y) - 10), state: 'down' });
    this.refresh(run, progress, false);
  }

  /** Show doors, switches, blocks, chests and crystals as the rules have them. `animate` is off for the first draw. */
  refresh(run: Run, progress: DungeonProgress, animate = true): void {
    for (const door of this.dungeon.doors) {
      const v = this.doors.get(door.id);
      const open = doorIsOpen(door, progress);
      if (!v || v.open === open) continue;
      v.open = open;
      if (!open) continue;
      const group = door.lock === 'boss' ? DUNGEON_ART.door.boss : DUNGEON_ART.door.gate;
      if (!animate) v.sprite.setVisible(false);
      else v.sprite.play(animKey(group)).once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => v.sprite.setVisible(false));
    }
    const pressed = pressedSwitches(run);
    for (const [id, v] of this.switches) {
      const on = pressed.includes(id);
      if (v.on !== on) v.sprite.setFrame(on ? DUNGEON_ART.switch.on : DUNGEON_ART.switch.off);
      v.on = on;
    }
    for (const b of run.blocks) {
      const sprite = this.blocks.get(b.id);
      if (!sprite) continue;
      const x = footX(b.x);
      const y = footY(b.y);
      if (sprite.x === x && sprite.y === y) continue;
      sprite.setDepth(y);
      if (animate) this.scene.tweens.add({ targets: sprite, x, y, duration: BLOCK_SLIDE_MS });
      else sprite.setPosition(x, y);
    }
    for (const c of this.dungeon.chests) {
      const v = this.chests.get(c.id);
      const open = progress.looted.includes(c.id);
      if (!v || v.open === open) continue;
      v.open = open;
      const group = c.locked ? DUNGEON_ART.chest.locked : DUNGEON_ART.chest.free;
      if (animate) v.sprite.play(animKey(group));
      else v.sprite.setFrame(`${group}/3`);
    }
    for (const c of this.dungeon.crystals) {
      const v = this.crystals.get(c.id);
      const lit = progress.lit.includes(c.id);
      if (!v || v.lit === lit) continue;
      v.lit = lit;
      v.sprite.play(animKey(lit ? DUNGEON_ART.crystal.lit : DUNGEON_ART.crystal.dull));
    }
  }

  /** Move the spikes through their cycle; `t` is the dungeon clock in seconds. */
  updateTraps(t: number): void {
    for (const tr of this.dungeon.traps) {
      const v = this.traps.get(tr.id);
      if (!v) continue;
      const state = trapState(tr, t);
      if (state === v.state) continue;
      v.state = state;
      v.sprite.setFrame(`${DUNGEON_ART.trapSheet}/${DUNGEON_ART.trap[state]}`);
    }
  }
}
```

Terrain can now be drawn as a dungeon; creatures get boss size, a charge tint and bolts to draw:

`src/gfx/TerrainLayer.ts`:

```typescript
import Phaser from 'phaser';
import { TILES_KEY, type DungeonTheme } from '@/data/terrainTiles';
import { dungeonFrame, groundFrame, shoreMask, SHORE_E, SHORE_N, SHORE_S, SHORE_W } from '@/sim/tileView';
import { idx, type World } from '@/sim/world/types';

export const TILE = 16;
const SHORE_KEY = 'shore_ss';

/** A strip of 16 tiles: tile `m` has a foam line on every side whose SHORE_* bit is set in `m`. */
function createShoreTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(SHORE_KEY)) return;
  const tex = scene.textures.createCanvas(SHORE_KEY, TILE * 16, TILE);
  if (!tex) return;
  const ctx = tex.getContext();
  const line = (ox: number, x: number, y: number, w: number, h: number, a: number): void => {
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillRect(ox + x, y, w, h);
  };
  for (let mask = 1; mask < 16; mask++) {
    const ox = mask * TILE;
    if (mask & SHORE_N) {
      line(ox, 0, 0, TILE, 2, 0.7);
      line(ox, 0, 2, TILE, 1, 0.3);
    }
    if (mask & SHORE_E) {
      line(ox, TILE - 2, 0, 2, TILE, 0.7);
      line(ox, TILE - 3, 0, 1, TILE, 0.3);
    }
    if (mask & SHORE_S) {
      line(ox, 0, TILE - 2, TILE, 2, 0.7);
      line(ox, 0, TILE - 3, TILE, 1, 0.3);
    }
    if (mask & SHORE_W) {
      line(ox, 0, 0, 2, TILE, 0.7);
      line(ox, 2, 0, 1, TILE, 0.3);
    }
  }
  tex.refresh();
}

/** Ground and shoreline of the whole island as two culled tilemap layers (only visible tiles are drawn). */
export class TerrainLayer {
  readonly ground: Phaser.Tilemaps.TilemapLayer;
  readonly shore: Phaser.Tilemaps.TilemapLayer;

  /** `theme` draws a dungeon's flagstones and brick instead of the island's ground. */
  constructor(scene: Phaser.Scene, world: World, theme?: DungeonTheme) {
    createShoreTexture(scene);
    const size = world.size;
    const groundData: number[][] = [];
    const shoreData: number[][] = [];
    for (let y = 0; y < size; y++) {
      const g: number[] = [];
      const s: number[] = [];
      for (let x = 0; x < size; x++) {
        g.push(theme ? dungeonFrame(world, x, y, theme) : groundFrame(world.terrain[idx(x, y, size)], x, y));
        const mask = shoreMask(world, x, y);
        s.push(mask === 0 ? -1 : mask);
      }
      groundData.push(g);
      shoreData.push(s);
    }
    const groundMap = scene.make.tilemap({ data: groundData, tileWidth: TILE, tileHeight: TILE });
    const groundTiles = groundMap.addTilesetImage('ground', TILES_KEY, TILE, TILE, 0, 0);
    const shoreMap = scene.make.tilemap({ data: shoreData, tileWidth: TILE, tileHeight: TILE });
    const shoreTiles = shoreMap.addTilesetImage('shore', SHORE_KEY, TILE, TILE, 0, 0);
    if (!groundTiles || !shoreTiles) throw new Error('TerrainLayer: tileset textures are not loaded');
    const ground = groundMap.createLayer(0, groundTiles, 0, 0);
    const shore = shoreMap.createLayer(0, shoreTiles, 0, 0);
    if (!ground || !shore) throw new Error('TerrainLayer: could not create tilemap layers');
    this.ground = ground.setDepth(-100);
    this.shore = shore.setDepth(-90);
  }
}
```

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
import type { FlyingShot } from '@/sim/boss';
import type { Arrow } from '@/sim/encounters';
import type { Vec } from '@/sim/movement';
import type { Pickup } from '@/sim/pickups';

const FLASH_MS = 90;
const WINDUP_TINT = 0xff8a8a;
const SHOT_TINT = 0xd070ff;
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
  private shots = new Map<number, Phaser.GameObjects.Image>();

  constructor(private scene: Phaser.Scene) {}

  /** Create, move, animate and remove sprites so they match the given state. */
  sync(creatures: readonly Creature[], pickups: readonly Pickup[], arrows: readonly Arrow[], shots: readonly FlyingShot[]): void {
    this.syncCreatures(creatures);
    this.syncItems(pickups);
    this.syncArrows(arrows);
    this.syncShots(shots);
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
      const moving = c.state === 'wander' || c.state === 'chase' || c.state === 'flee' || c.state === 'charge';
      if (moving) {
        view.sprite.play(animKey(`${def.sprite.group}/${dir}`), true);
      } else {
        view.sprite.anims.stop();
        view.sprite.setFrame(`${def.sprite.group}/${dir}/${Math.min(1, def.sprite.frames - 1)}`);
      }
      if (now < view.flashUntil) view.sprite.setTintFill(0xffffff);
      else if (c.state === 'windup' || c.state === 'charge') view.sprite.setTint(WINDUP_TINT);
      else view.sprite.clearTint();
      view.sprite.setScale((def.sprite.scale ?? 1) * (c.state === 'windup' ? 1.12 : 1));
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
    sprite.setScale(def.sprite.scale ?? 1);
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
    const scale = def.sprite.scale ?? 1;
    const top = py - (def.sprite.atlas === 'monsters' ? 26 : 22) * scale;
    const w = BAR_W * scale;
    view.bar[0].setVisible(hurt).setPosition(px - w / 2, top).setDepth(py + 1).setSize(w, 2);
    view.bar[1].setVisible(hurt).setPosition(px - w / 2, top).setDepth(py + 2).setSize(Math.max(1, w * (c.hp / def.hp)), 2);
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

  private syncShots(list: readonly FlyingShot[]): void {
    const seen = new Set<number>();
    for (const s of list) {
      seen.add(s.id);
      const img = this.shots.get(s.id) ?? this.scene.add.image(0, 0, 'fx_light').setTint(SHOT_TINT).setDisplaySize(16, 16).setBlendMode('ADD');
      this.shots.set(s.id, img);
      const py = snapWorld(s.y * TILE);
      img.setPosition(snapWorld(s.x * TILE), py - 8).setDepth(py);
    }
    for (const [id, img] of this.shots) {
      if (seen.has(id)) continue;
      img.destroy();
      this.shots.delete(id);
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

- [ ] **Step 5: Write the levels**

A level is a place the hero can be. `Level` is the interface; `IslandLevel` is what `GameScene` used to do for the island (nodes, buildings, fields, day and night, regrowth); `DungeonLevel` is the dungeon (walls, puzzle pieces, spikes, blocks, rooms being solved, crystals, the boss's death, torch light and gloom):

`src/game/Level.ts`:

```typescript
import type { Station } from '@/data/structures';
import type { LightSource } from '@/gfx/StructureLayer';
import type { DungeonId } from '@/sim/dungeon/progress';
import type { Target } from '@/sim/dungeon/rules';
import type { Dungeon } from '@/sim/dungeon/types';
import type { Encounters, EncounterEvent } from '@/sim/encounters';
import type { Farm } from '@/sim/farm';
import type { Vec } from '@/sim/movement';
import type { Fx, Session } from '@/sim/session';
import type { Blocking } from '@/sim/solids';
import type { Structures } from '@/sim/structures';
import type { ResourceKind, ResourceNode, World } from '@/sim/world/types';

/** What the resolver needs to know about the place the hero is standing in. */
export interface LevelView {
  structures: Structures;
  farm: Farm;
  /** The nearest living resource node in reach. */
  node: ResourceNode | null;
  /** The dungeon whose entrance is the tile in front of the hero. */
  entrance: DungeonId | null;
  /** A locked door, a chest or the exit in front of the hero (dungeons). */
  target: Target | null;
}

/** The darkness laid over the world, and the lights cut out of it (world pixels). */
export interface Lit {
  color: number;
  alpha: number;
  sources: LightSource[];
  /** Radius of the hero's own light. */
  hero: number;
}

/** A place the hero can be: the island, or one of the dungeons. `GameScene` runs whichever one it is given. */
export interface Level {
  readonly world: World;
  readonly dungeon: Dungeon | null;
  /** Creatures neither appear nor fade by themselves. */
  readonly fixed: boolean;
  /** Where the hero stands when the level starts: the saved spot if it is fine, otherwise the way in. */
  place(saved: Vec): Vec;
  /** The creatures and crystals the level starts with, if it sets any. */
  start(): Encounters | null;
  blocking(session: Session): Blocking;
  view(session: Session, hero: Vec, front: { x: number; y: number }): LevelView;
  lit(session: Session): Lit;
  stations(session: Session, hero: Vec): Set<Station>;
  /** The dark hours (the dungeon is always dark): night music, and the creatures of the night. */
  isNight(session: Session): boolean;
  /** The kind of resource node with this id, for the sound of hitting it. */
  nodeKind(id: number): ResourceKind | undefined;
  /** Show an effect of the rules: a node cut down, a building put up, a chest opened. */
  onFx(fx: Fx, session: Session): void;
  /** Things that happened among the creatures: a crystal was struck, the boss died. */
  onEvents(events: EncounterEvent[]): void;
  update(dt: number, move: Vec, enc: Encounters): void;
  /** A new day begins: nodes grow back, crops grow. */
  newDay(session: Session, hero: Vec): Session;
  /** The boss's name key and health while the fight is on. */
  bossBar(enc: Encounters): { name: string; hp: number; max: number } | null;
}
```

`src/game/IslandLevel.ts`:

```typescript
import type { Station } from '@/data/structures';
import type { Level, LevelView, Lit } from '@/game/Level';
import { FarmLayer } from '@/gfx/FarmLayer';
import { StructureLayer } from '@/gfx/StructureLayer';
import { TerrainLayer } from '@/gfx/TerrainLayer';
import { WorldObjects } from '@/gfx/WorldObjects';
import type { GameScene } from '@/scenes/GameScene';
import { entranceAt } from '@/sim/dungeon/rules';
import type { Encounters, EncounterEvent } from '@/sim/encounters';
import { isNight, lighting } from '@/sim/daynight';
import { plotAt } from '@/sim/farm';
import { isAlive } from '@/sim/gather';
import { nearestNode } from '@/sim/interact';
import type { Vec } from '@/sim/movement';
import { blocksRegrowth, rollDay, type Fx, type Session } from '@/sim/session';
import { blockingTiles, nodesByTile, propSolidTiles, type Blocking } from '@/sim/solids';
import { nearbyStations } from '@/sim/structures';
import type { ResourceKind, ResourceNode, World } from '@/sim/world/types';

/** How far the hero reaches for trees, rocks and bushes, and how close he may stand to a node that would grow back (tiles). */
const HIT_REACH = 1.4;
const REGROW_CLEARANCE = 1.5;
/** Radius of the hero's own light at night (world pixels). */
const HERO_LIGHT = 52;

/** The island: terrain, trees and rocks, the camp the hero builds, his fields, and the rhythm of day and night. */
export class IslandLevel implements Level {
  readonly dungeon = null;
  readonly fixed = false;
  private nodes: Map<number, ResourceNode>;
  private propTiles: number[];
  private objects: WorldObjects;
  private structureLayer: StructureLayer;
  private farmLayer: FarmLayer;

  constructor(scene: GameScene, readonly world: World, session: Session) {
    this.nodes = nodesByTile(world);
    this.propTiles = propSolidTiles(world);
    new TerrainLayer(scene, world);
    this.objects = new WorldObjects(scene, world);
    for (const n of world.resources) if (!isAlive(session.gather, n.id)) this.objects.setAlive(n.id, false, false);
    this.structureLayer = new StructureLayer(scene, session.structures);
    this.farmLayer = new FarmLayer(scene, session.farm);
  }

  place(saved: Vec): Vec {
    return saved;
  }

  start(): Encounters | null {
    return null;
  }

  blocking(session: Session): Blocking {
    return blockingTiles(this.world, this.propTiles, session);
  }

  view(session: Session, hero: Vec, front: { x: number; y: number }): LevelView {
    return {
      structures: session.structures, farm: session.farm, target: null, entrance: entranceAt(this.world, front.x, front.y),
      node: nearestNode(this.nodes, this.world.size, hero, HIT_REACH, (id) => isAlive(session.gather, id)),
    };
  }

  lit(session: Session): Lit {
    const light = lighting(session.clock);
    return { color: light.color, alpha: light.alpha, sources: this.structureLayer.lights(session.structures), hero: HERO_LIGHT };
  }

  stations(session: Session, hero: Vec): Set<Station> {
    return nearbyStations(session.structures, hero);
  }

  isNight(session: Session): boolean {
    return isNight(session.clock);
  }

  nodeKind(id: number): ResourceKind | undefined {
    return this.world.resources[id]?.kind;
  }

  onFx(fx: Fx, session: Session): void {
    switch (fx.t) {
      case 'hit': this.objects.shake(fx.id); break;
      case 'gone': this.objects.setAlive(fx.id, false); break;
      case 'built': this.structureLayer.add(fx.structure); break;
      case 'unbuilt': this.structureLayer.remove(fx.id); break;
      case 'plot': this.farmLayer.refresh(fx.tile, plotAt(session.farm, fx.tile)); break;
    }
  }

  onEvents(_events: EncounterEvent[]): void {
    // Nothing on the island reacts to what happens among the creatures.
  }

  update(): void {
    // The island has no moving parts of its own.
  }

  /** Nodes that were gone may grow back (those next to the hero wait for tomorrow), and watered crops grow. */
  newDay(session: Session, hero: Vec): Session {
    const before = session.gather;
    const next = rollDay(session, (id) => {
      const n = this.world.resources[id];
      return Math.hypot(n.x + 0.5 - hero.x, n.y + 0.5 - hero.y) < REGROW_CLEARANCE || blocksRegrowth(session, n, this.world.size);
    });
    for (const key of Object.keys(before.gone)) {
      const id = Number(key);
      if (isAlive(next.gather, id)) this.objects.setAlive(id, true);
    }
    this.farmLayer.rebuild(next.farm);
    return next;
  }

  bossBar(): null {
    return null;
  }
}
```

`src/game/DungeonLevel.ts`:

```typescript
import { Rng } from '@/core/rng';
import { services } from '@/core/services';
import { t } from '@/core/i18n';
import { CREATURES } from '@/data/creatures';
import type { Station } from '@/data/structures';
import type { Level, LevelView, Lit } from '@/game/Level';
import { DungeonLayer } from '@/gfx/DungeonLayer';
import { TILE, TerrainLayer } from '@/gfx/TerrainLayer';
import type { GameScene } from '@/scenes/GameScene';
import { frontTile } from '@/sim/actions';
import { isBoss } from '@/sim/boss';
import { lightCrystal, newRun, pushBlock, solidTiles, solveRooms, targetAt, trapUnder, type Run } from '@/sim/dungeon/rules';
import { bossOf, creaturesInRoom, startEncounters } from '@/sim/dungeon/start';
import type { DungeonProgress } from '@/sim/dungeon/progress';
import type { Dungeon } from '@/sim/dungeon/types';
import type { Encounters, EncounterEvent } from '@/sim/encounters';
import { emptyFarm } from '@/sim/farm';
import { T, idx, type ResourceKind } from '@/sim/world/types';
import type { Vec } from '@/sim/movement';
import { rollDay, updateDungeon, type Fx, type Session } from '@/sim/session';
import type { Blocking } from '@/sim/solids';
import { emptyStructures } from '@/sim/structures';

/** Hit points a spike trap takes (before difficulty and armour). */
export const TRAP_DAMAGE = 6;
/** The hero must lean on a block this long before it slides, and rests this long after a push (seconds). */
const PUSH_AFTER = 0.3;
const PUSH_REST = 0.45;
/** How often the rooms are checked for being solved (seconds). */
const SOLVE_EVERY = 0.4;
/** The dark of a dungeon, the glow of a wall torch (tiles) and of the hero's own light (world pixels). */
const GLOOM = { color: 0x050a18, alpha: 0.52 };
const TORCH_GLOW = 4;
const HERO_LIGHT = 76;

/** A dungeon: its walls, puzzle pieces, spikes and guards. The hero pushes blocks, strikes crystals and opens doors. */
export class DungeonLevel implements Level {
  readonly world;
  readonly fixed = true;
  private run: Run;
  private layer: DungeonLayer;
  private clock = 0;
  private lean = 0;
  private sinceSolve = 0;
  private everyTile: Set<number>;

  constructor(private host: GameScene, readonly dungeon: Dungeon) {
    this.world = dungeon.world;
    this.run = newRun(dungeon);
    new TerrainLayer(host, dungeon.world, dungeon.theme);
    this.layer = new DungeonLayer(host, dungeon, this.run, this.progress(host.session));
    this.everyTile = new Set(Array.from({ length: dungeon.world.size * dungeon.world.size }, (_, i) => i));
  }

  private progress(s: Session): DungeonProgress {
    return s.dungeons[this.dungeon.id];
  }

  /** The saved spot if the hero can stand there, otherwise the doorway he came in by. */
  place(saved: Vec): Vec {
    const x = Math.floor(saved.x);
    const y = Math.floor(saved.y);
    const ok = x >= 0 && y >= 0 && x < this.world.size && y < this.world.size && this.world.terrain[idx(x, y, this.world.size)] === T.FLOOR;
    return ok ? saved : { ...this.dungeon.entry };
  }

  start(): Encounters {
    return startEncounters(this.dungeon, this.progress(this.host.session), new Rng(Rng.seedFromTime()));
  }

  /** Walls are terrain; closed doors, blocks, pillars, crystals and chests are solid. Nothing can be built here. */
  blocking(session: Session): Blocking {
    return { solids: solidTiles(this.run, this.progress(session)), occupied: this.everyTile };
  }

  view(session: Session, _hero: Vec, front: { x: number; y: number }): LevelView {
    return { structures: emptyStructures(), farm: emptyFarm(), node: null, entrance: null, target: targetAt(this.run, this.progress(session), front.x, front.y) };
  }

  lit(): Lit {
    const sources = this.dungeon.torches.map((o) => ({ x: (o.x + 0.5) * TILE, y: (o.y + 0.5) * TILE, radius: TORCH_GLOW * TILE }));
    return { ...GLOOM, sources, hero: HERO_LIGHT };
  }

  stations(): Set<Station> {
    return new Set();
  }

  isNight(): boolean {
    return true;
  }

  nodeKind(): ResourceKind | undefined {
    return undefined;
  }

  /** The rules opened a chest or a door: show it. */
  onFx(fx: Fx, session: Session): void {
    if (fx.t !== 'chestOpened' && fx.t !== 'doorOpened') return;
    this.layer.refresh(this.run, this.progress(session));
    this.host.rebuildBlocking();
  }

  /** Crystals struck by the hero light up; a dead boss is written into the progress. */
  onEvents(events: EncounterEvent[]): void {
    const host = this.host;
    for (const ev of events) {
      if (ev.t === 'struck') {
        host.session = updateDungeon(host.session, (p) => lightCrystal(p, ev.id));
        this.layer.refresh(this.run, this.progress(host.session));
      } else if (ev.t === 'killed' && isBoss(ev.kind)) {
        host.session = updateDungeon(host.session, (p) => ({ ...p, boss: true }));
        services.notify?.(t('msgBossDefeated', { name: t(`boss_${ev.kind}`) }));
      }
    }
  }

  /** Run the dungeon for `dt` seconds: spikes, a block being pushed, rooms being solved. */
  update(dt: number, move: Vec, enc: Encounters): void {
    const host = this.host;
    this.clock += dt;
    this.layer.updateTraps(this.clock);
    if (trapUnder(this.run, host.pos, this.clock)) host.combat.harm(TRAP_DAMAGE);
    this.pushBlocks(dt, move);
    this.sinceSolve += dt;
    if (this.sinceSolve >= SOLVE_EVERY) {
      this.sinceSolve = 0;
      this.checkRooms(enc);
    }
  }

  /** Lean on the block in front of the hero; after a moment it slides one tile. */
  private pushBlocks(dt: number, move: Vec): void {
    const host = this.host;
    const f = frontTile(host.pos, host.player.facing);
    const block = this.run.blocks.find((b) => b.x === f.x && b.y === f.y);
    const dx = f.x - Math.floor(host.pos.x);
    const dy = f.y - Math.floor(host.pos.y);
    if (!block || move.x * dx + move.y * dy <= 0.3) {
      this.lean = 0;
      return;
    }
    this.lean += dt;
    if (this.lean < PUSH_AFTER) return;
    const moved = pushBlock(this.run, this.progress(host.session), block.id, dx, dy);
    this.lean = -PUSH_REST;
    if (!moved) return;
    this.run = moved;
    this.layer.refresh(this.run, this.progress(host.session));
    host.rebuildBlocking();
    services.audio?.sfx('place');
  }

  private checkRooms(enc: Encounters): void {
    const host = this.host;
    const before = this.progress(host.session);
    const session = updateDungeon(host.session, (p) => solveRooms(this.run, p, (room) => creaturesInRoom(enc, this.dungeon, room)));
    if (this.progress(session) === before) return;
    host.session = session;
    this.layer.refresh(this.run, this.progress(session));
    host.rebuildBlocking();
    services.notify?.(t('msgWayOpens'));
    services.audio?.sfx('craft');
  }

  /** Crops and nodes of the island keep as they are while the hero is below ground. */
  newDay(session: Session): Session {
    return rollDay(session, () => true);
  }

  bossBar(enc: Encounters): { name: string; hp: number; max: number } | null {
    const boss = bossOf(enc, this.dungeon);
    return boss?.angry ? { name: `boss_${boss.kind}`, hp: boss.hp, max: CREATURES[boss.kind].hp } : null;
  }
}
```

The fighting side now takes armour, runs fixed in dungeons, forwards what happens to the level, and can hurt the hero from something that is not a creature (spikes):

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

  /** Replace everything with the given state (a dungeon starts with its guards in place). */
  load(e: Encounters): void {
    this.apply(e, []);
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
    this.layer.sync(this.state.creatures, this.state.pickups, this.state.arrows, this.state.shots);
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
    this.layer.sync([], [], [], []);
  }

  private apply(next: Encounters, events: EncounterEvent[]): EncounterEvent[] {
    this.state = next;
    for (const ev of events) {
      if (ev.t === 'hit') this.layer.flash(ev.id);
      if (ev.t === 'killed') this.layer.puff(ev);
    }
    this.layer.sync(next.creatures, next.pickups, next.arrows, next.shots);
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
import { enemyDamage } from '@/sim/combat';
import { cueForEncounter } from '@/sim/cues';
import { defenseOf } from '@/sim/equipment';
import { hostilesNear, type Encounters, type EncounterEvent } from '@/sim/encounters';
import type { Melee } from '@/sim/melee';
import { hurtHero, type Fx } from '@/sim/session';
import { emptyStructures } from '@/sim/structures';
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

  /** Hand the creatures of a dungeon to the simulation. */
  load(e: Encounters): void {
    this.wildlife.load(e);
  }

  /** The creatures, items and bolts as they are now. */
  snapshot(): Encounters {
    return this.wildlife.snapshot();
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
    const level = host.level;
    this.react(this.wildlife.tick(dt, {
      world: host.world, solids: host.solids, structures: level.dungeon ? emptyStructures() : s.structures, hero: host.pos, heroAlive: !host.dead,
      night: level.isNight(s), difficulty: s.difficulty, defense: defenseOf(s.equipment), fixed: level.fixed,
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
      } else if (ev.t === 'hurtHero') {
        this.hurt(ev.amount);
      }
    }
    host.level.onEvents(events);
  }

  /** The hero loses hit points to a blow (red flash, shake, buzz), unless he is still safe from the last one. */
  private hurt(amount: number): void {
    const { host } = this;
    if (!host.player.vulnerable) return;
    host.session = hurtHero(host.session, amount);
    host.player.hurt();
    if (services.settings?.screenShake !== false) shakeCamera(host.cameras.main, 140, 0.006);
    services.platform?.haptic('medium');
    this.numbers.show(host.pos.x * TILE, host.pos.y * TILE - 20, `-${amount}`, 0xff5555);
  }

  /** Damage that does not come from a creature (spike traps), with the difficulty and the armour applied. */
  harm(raw: number): void {
    const s = this.host.session;
    if (this.host.player.vulnerable) services.audio?.sfx('hurt');
    this.hurt(enemyDamage(raw, s.difficulty, defenseOf(s.equipment)));
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

- [ ] **Step 6: Write the scenes**

`GameScene` runs whichever level the save says: the island, or a dungeon (a save from a dungeon the game can no longer build wakes the hero at his bed). Going through a door saves and starts the scene again in the other place; dying below ground wakes the hero on the island. It ends at exactly 400 lines.

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
import { FloatText } from '@/gfx/FloatText';
import { NightLight } from '@/gfx/NightLight';
import { TILE } from '@/gfx/TerrainLayer';
import { DungeonLevel } from '@/game/DungeonLevel';
import { InputReader } from '@/game/InputReader';
import { HeroCombat } from '@/game/HeroCombat';
import { IslandLevel } from '@/game/IslandLevel';
import type { Level } from '@/game/Level';
import { MusicDirector } from '@/game/MusicDirector';
import { resetControls } from '@/game/input';
import { frontTile, resolveAction, type Action } from '@/sim/actions';
import { cueForFx } from '@/sim/cues';
import { newClock } from '@/sim/daynight';
import { generateDungeon } from '@/sim/dungeon/generate';
import { DUNGEON_VERSION, emptyDungeons, type DungeonId } from '@/sim/dungeon/progress';
import { doorwayOutside } from '@/sim/dungeon/rules';
import { emptyGather, sanitizeGather } from '@/sim/gather';
import { meleeFor } from '@/sim/melee';
import { moveWithCollision, speedFactor, type Vec } from '@/sim/movement';
import {
  applyAction, collapse, craftRecipe, equipArmor, moveInventorySlot, selectSlot, sessionFromSlot, sessionToSlot, takeOffArmor, tickSession,
  transferStack, type Fx, type Session, type Step,
} from '@/sim/session';
import { isDead } from '@/sim/vitals';
import { GENERATOR_VERSION, generateWorld } from '@/sim/world/generate';
import { idx, type Biome, type World } from '@/sim/world/types';
import { COLORS } from '@/ui/theme';

/** Walking speed in tiles per second, and the pause between uses (seconds). */
const PLAYER_SPEED = 3.4;
const ACTION_COOLDOWN = 0.35;
const AUTOSAVE_SECONDS = 15;
const MAX_STEP = 0.05;
/** Stamina recovers slowly for this long after the hero acts (seconds). */
const BUSY_SECONDS = 1.2;

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

/** The place the hero is in (the island or a dungeon), the hero, and the rules that connect them. The HUD runs in its own scene on top. */
export class GameScene extends BaseScene {
  world!: World;
  session!: Session;
  level!: Level;
  combat!: HeroCombat;
  pos: Vec = { x: 0, y: 0 };
  player!: Player;
  float!: FloatText;
  /** Tiles the hero cannot walk through: living nodes, scenery, buildings, closed doors, blocks. */
  solids = new Set<number>();
  /** Seconds the scene stands still after a good hit, to give blows some weight. */
  hitStop = 0;
  /** True while the collapse dialog is up. */
  dead = false;

  private slotData!: SaveSlot;
  private lastDay = 1;
  private cooldown = 0;
  private idle = 99;
  private saveTimer = 0;
  private wiped = false;
  private occupied = new Set<number>();
  private night!: NightLight;
  private cursor!: Phaser.GameObjects.Rectangle;
  private keys!: InputReader;
  private music = new MusicDirector();

  constructor() {
    super('Game');
  }

  create(data: GameInit): void {
    this.transitioning = false;
    this.dead = false;
    this.wiped = false;
    resetControls();
    const loaded = data.seed === undefined ? services.saves?.load(data.slot) ?? null : null;
    if (data.seed === undefined && !loaded) {
      this.scene.start('Menu');
      return;
    }
    const seed = data.seed ?? loaded!.seed;
    const island = loaded?.location && loaded.dungeonVersion === DUNGEON_VERSION ? null : generateWorld(seed);
    this.slotData = loaded ?? newSlot(data.slot, 'Castaway', seed, 'normal', island!.start, newClock());
    if (!loaded) services.saves?.write(this.slotData);

    const where = island ? null : this.slotData.location;
    this.session = this.startSession(island, where);
    this.level = where ? new DungeonLevel(this, generateDungeon(seed, where)) : new IslandLevel(this, island!, this.session);
    this.world = this.level.world;
    // (a save from a dungeon this game can no longer build wakes the hero at his bed)
    this.pos = this.level.place(this.slotData.location && !where ? { ...this.slotData.respawn } : { ...this.slotData.player });
    this.lastDay = this.session.clock.day;
    this.cooldown = 0;
    this.saveTimer = 0;
    this.idle = 99;

    this.rebuildBlocking();
    this.player = new Player(this, this.pos);
    this.combat = new HeroCombat(this);
    const start = this.level.start();
    if (start) this.combat.load(start);
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
    if (where) services.notify?.(t(`dungeon_${where}`));
  }

  /** The session from the save; a changed island generator drops the harvest diff, a changed dungeon generator the dungeon progress. */
  private startSession(island: World | null, where: DungeonId | null): Session {
    const s = sessionFromSlot(this.slotData);
    const current = this.slotData.dungeonVersion === DUNGEON_VERSION;
    const gather = !island ? s.gather : this.slotData.worldVersion === GENERATOR_VERSION ? sanitizeGather(s.gather, island.resources.length) : emptyGather();
    return { ...s, gather, location: where, dungeons: current ? s.dungeons : emptyDungeons() };
  }

  private setupCamera(): void {
    const cam = this.cameras.main;
    // The shared HiResCamera plugin anchors cameras at the top-left; the world camera zooms around its centre.
    cam.setOrigin(0.5, 0.5).setZoom(worldZoom(2)).setBackgroundColor(this.level.dungeon ? 0x05070d : 0x0a2a4a);
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
    this.level.update(dt, move, this.combat.snapshot());
    this.music.update(this.level.isNight(this.session), this.combat.fighting);

    this.cooldown = Math.max(0, this.cooldown - dt);
    const pressed = this.keys.actionPressed();
    const action = this.computeAction();
    this.showCursor(action);
    if (pressed && this.cooldown === 0) this.perform(action);

    this.followCamera();
    const lit = this.level.lit(this.session);
    const hero = { x: this.pos.x * TILE, y: this.pos.y * TILE - 8, radius: lit.hero };
    this.night.update(dt, this.cameras.main, lit.color, lit.alpha, [...lit.sources, hero]);
    this.saveTimer += dt;
    if (this.saveTimer >= AUTOSAVE_SECONDS) this.saveNow();
  }

  private biomeAt(): Biome {
    return this.world.biome[idx(Math.floor(this.pos.x), Math.floor(this.pos.y), this.world.size)] as Biome;
  }

  /** What ACTION would do right now. */
  private computeAction(): Action {
    const s = this.session;
    const view = this.level.view(s, this.pos, frontTile(this.pos, this.player.facing));
    const melee = meleeFor(s.inventory[s.selected]?.item ?? null);
    return resolveAction({
      world: this.world, inv: s.inventory, selected: s.selected, vitals: s.vitals, pos: this.pos, facing: this.player.facing,
      structures: view.structures, farm: view.farm, occupied: this.occupied, node: view.node, creature: this.combat.reaches(melee),
      entrance: view.entrance, target: view.target,
    });
  }

  private showCursor(a: Action): void {
    const targeted = ['place', 'till', 'plant', 'water', 'refill', 'harvest', 'open', 'sleep', 'drink', 'pickup', 'enter', 'leave', 'chest', 'door'].includes(a.kind);
    const refused = a.kind === 'blocked' && a.reason === 'cannotPlace';
    this.cursor.setVisible(targeted || refused);
    if (!targeted && !refused) return;
    const f = frontTile(this.pos, this.player.facing);
    this.cursor.setPosition(f.x * TILE, f.y * TILE).setStrokeStyle(1, refused ? 0xff5555 : 0xffffff, 0.9);
  }

  private perform(action: Action): void {
    this.cooldown = action.kind === 'attack' ? action.melee.cooldown : action.kind === 'shoot' ? action.stats.cooldown : ACTION_COOLDOWN;
    if (action.kind === 'none' || this.transitioning) return;
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
    const cue = quiet ? null : cueForFx(fx, fx.t === 'hit' ? this.level.nodeKind(fx.id) : undefined);
    if (cue) services.audio?.sfx(cue);
    this.level.onFx(fx, this.session);
    switch (fx.t) {
      case 'say': services.notify?.(this.sayText(fx)); break;
      case 'gain': this.showGain(`+${fx.qty} ${t(`item_${fx.item}`)}`); break;
      case 'swing': this.player.punch(); break;
      case 'strike':
      case 'shot': this.combat.onFx(fx); break;
      case 'open': this.openStructure(fx.structure.type, fx.structure.id); break;
      case 'slept': this.cameras.main.flash(700, 8, 10, 30); break;
      case 'travel': this.travel(fx.to); break;
    }
  }

  /** Go through a dungeon door, either way: save, then start the scene again in the other place. */
  private travel(to: DungeonId | null): void {
    const from = this.level.dungeon?.id;
    const seed = this.session.seed;
    this.pos = to ? generateDungeon(seed, to).entry : doorwayOutside(generateWorld(seed), from!);
    this.saveNow();
    this.goTo('Game', { slot: this.slotData.slot });
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

  /** Walk-blocking tiles and the tiles nothing can be built or tilled on, as the level has them now. */
  rebuildBlocking(): void {
    const { solids, occupied } = this.level.blocking(this.session);
    this.solids = solids;
    this.occupied = occupied;
  }

  private onNewDay(): void {
    this.lastDay = this.session.clock.day;
    this.session = this.level.newDay(this.session, this.pos);
    this.rebuildBlocking();
    services.notify?.(t('hudDay', { n: this.lastDay }));
    this.saveNow();
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
    if (this.level.dungeon) {
      // Dying below ground: wake on the island, with the dungeon as it was.
      this.session = { ...this.session, location: null };
      this.saveNow();
      this.goTo('Game', { slot: this.slotData.slot });
      return;
    }
    this.player.update(this.pos, { x: 0, y: 0 });
    this.dead = false;
    this.idle = 99;
    this.combat.reset();
    this.saveNow();
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
    return this.level.stations(this.session, this.pos);
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

  /** Put on the armour in a backpack slot, or take the worn armour off (null). */
  wear(index: number | null): void {
    this.commit(index === null ? takeOffArmor(this.session) : equipArmor(this.session, index));
  }

  /** The boss's name key and health while the fight is on, for the health bar. */
  bossBar(): { name: string; hp: number; max: number } | null {
    return this.level.bossBar(this.combat.snapshot());
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
    return { ...sessionToSlot(this.slotData, this.session, this.pos), worldVersion: GENERATOR_VERSION, dungeonVersion: DUNGEON_VERSION };
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

A boss health bar across the top of the HUD, shown only during a fight:

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
  private bossName!: Phaser.GameObjects.BitmapText;
  private bossBar!: Bar;

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
    // The boss's health, across the top of the screen, only while a boss fight is on.
    const bossW = Math.min(180, W - 120);
    this.bossName = this.add.bitmapText(W / 2, 10, FONT.small, '').setOrigin(0.5, 0).setTint(COLORS.gold).setDepth(5).setVisible(false);
    this.bossBar = new Bar(this, W / 2 - bossW / 2, 22, bossW, 8, 0xb04adf).setDepth(5).setVisible(false);
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
    ], 20000, false);
  }

  /** Show or hide the boss's name and health. */
  private updateBoss(): void {
    const boss = this.world.bossBar();
    this.bossName.setVisible(boss !== null);
    this.bossBar.setVisible(boss !== null);
    if (!boss) return;
    this.bossName.setText(t(boss.name));
    this.bossBar.setValue(boss.hp / boss.max);
  }

  update(): void {
    this.updateBoss();
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

The backpack screen gets an armour box (tap it to take the armour off) and a Wear button for a selected armour piece:

`src/scenes/InventoryScene.ts`:

```typescript
import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import type { GameScene, OpenOptions } from './GameScene';
import { t } from '@/core/i18n';
import { view, vx, vy } from '@/core/viewport';
import { ITEMS } from '@/data/items';
import { defenseOf } from '@/sim/equipment';
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
    if (this.mode !== 'chest' && this.onArmorBox(x, y) && this.world.session.equipment.armor) {
      this.world.wear(null);
      this.render();
      return;
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

  /** The box on the right of the item info where the worn armour sits; tapping it takes the armour off. */
  private armorBox(): { x: number; y: number } {
    return { x: this.gridX() + COLS * (SLOT + GAP) - GAP - SLOT, y: this.bagTop() + 4 * (SLOT + GAP) + 6 };
  }

  private onArmorBox(x: number, y: number): boolean {
    const a = this.armorBox();
    return x >= a.x && x <= a.x + SLOT && y >= a.y && y <= a.y + SLOT;
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
    this.drawArmorBox();
    if (!slot) return;
    const def = ITEMS[slot.item];
    this.ui.add(label(this, this.gridX(), infoY, t(`item_${slot.item}`), FONT.body, COLORS.text));
    if (def.tool && slot.dur !== undefined) {
      this.ui.add(label(this, this.gridX(), infoY + 18, t(def.tool.type === 'can' ? 'waterLeft' : 'durability', { n: slot.dur }), FONT.small, COLORS.textDim));
    }
    if (def.weapon) {
      this.ui.add(label(this, this.gridX(), infoY + 30, t('weaponDamage', { n: def.weapon.damage }), FONT.small, COLORS.textDim));
    }
    if (def.armor) {
      this.ui.add(label(this, this.gridX(), infoY + 18, t('armorDefense', { n: def.armor.defense }), FONT.small, COLORS.textDim));
      this.ui.add(new Button(this, this.gridX() + 36, infoY + 44, t('wearArmor'), () => {
        this.world.wear(this.picked);
        this.picked = -1;
        this.render();
      }, { w: 64, h: 22, font: FONT.small, style: 'primary' }));
    }
  }

  /** What the hero wears: the armour piece (tap to take it off) and the defence it gives. */
  private drawArmorBox(): void {
    const { x, y } = this.armorBox();
    const worn = this.world.session.equipment;
    this.ui.add(nine(this, x, y, 'ui_slot', SLOT, SLOT).setOrigin(0, 0));
    if (worn.armor) this.ui.add(itemIcon(this, x + SLOT / 2, y + SLOT / 2 - 1, worn.armor, 26));
    const text = worn.armor ? t('armorDefense', { n: defenseOf(worn) }) : t('armorNone');
    this.ui.add(label(this, x + SLOT, y - 12, text, FONT.small, COLORS.textDim, 1, 0));
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

- [ ] **Step 7: Run the tests, the typecheck, the coverage gate and the build**

Run: `npx vitest run tests/dungeon-art.test.ts tests/i18n.test.ts && npm run typecheck && npm run test:cov && npm run build`
Expected: dungeon-art 2, i18n 8 tests PASS; typecheck exits 0 (the errors from Task 6 are gone); the whole suite passes (492 tests) with coverage above 80% (about 99% lines); the build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/data src/game src/gfx src/scenes tools/pack_assets.py public/assets/pack/props.png public/assets/pack/props.json tests/dungeon-art.test.ts tests/i18n.test.ts
git commit -m "feat: run the island and the dungeons as levels, with a boss bar and an armour screen"
```

---

### Task 8: Browser scenarios and docs

**Files:**
- Create: `tools/scripts/dungeon-play.json`, `tools/scripts/dungeon-death.json`, `tools/scripts/dungeon-persist.json`, `tools/scripts/dungeon-perf.json`, `tools/scripts/armor.json`
- Replace: `README.md`

Each scenario drives the real game in headless Edge. They put the hero where they need him (`__game.scene.getScene('Game')`, wrapped in a small helper object `H`) and then use the real controls and rules. Start the dev server in a second terminal and leave it running (it uses port 5199): `npm run dev`.

- [ ] **Step 1: Add the scenarios**

A whole run of the Mushroom Grotto: in through the door, the free chest, a new day below ground, the block puzzle, the fight room, the crystals, both locked chests, the boss door, the boss fight, the loot and the armour, out again, and in a second time:

`tools/scripts/dungeon-play.json`:

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
  "eval": "window.H = { g: () => __game.scene.getScene('Game'), d() { return this.g().level.dungeon; }, tp(x, y, fx, fy) { const g = this.g(); g.pos = { x, y }; g.player.face(fx, fy); }, room(kind) { return this.d().rooms.find(r => r.kind === kind); }, inv(item) { return this.g().session.inventory.filter(s => s && s.item === item).reduce((n, s) => n + s.qty, 0); }, prog() { const g = this.g(); return g.session.dungeons[g.session.location]; }, creatures() { return this.g().combat.wildlife.state.creatures; }, kill(pred) { const w = this.g().combat.wildlife; w.state = {...w.state, creatures: w.state.creatures.filter(c => !pred(c))}; w.apply(w.state, []); } }; 'helpers ready'"
 },
 {
  "eval": "(() => { const g = H.g(); const l = g.world.landmarks.find(l => l.id === 'grotto'); H.tp(l.x + 0.5, l.y + 1.5, 0, -1); const inv = g.session.inventory.slice(); inv[0] = {item: 'sword_iron', qty: 1, dur: 160}; inv[1] = {item: 'bow', qty: 1, dur: 80}; inv[2] = {item: 'arrow', qty: 20}; g.session = {...g.session, inventory: inv, selected: 0}; return 'armed at the grotto door'; })()"
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "until": "(() => { const g = H.g(); return g.level && g.level.dungeon && g.scene.isActive('Game'); })()",
  "timeout": 15000
 },
 {
  "wait": 1200
 },
 {
  "eval": "window.H = { g: () => __game.scene.getScene('Game'), d() { return this.g().level.dungeon; }, tp(x, y, fx, fy) { const g = this.g(); g.pos = { x, y }; g.player.face(fx, fy); }, room(kind) { return this.d().rooms.find(r => r.kind === kind); }, inv(item) { return this.g().session.inventory.filter(s => s && s.item === item).reduce((n, s) => n + s.qty, 0); }, prog() { const g = this.g(); return g.session.dungeons[g.session.location]; }, creatures() { return this.g().combat.wildlife.state.creatures; }, kill(pred) { const w = this.g().combat.wildlife; w.state = {...w.state, creatures: w.state.creatures.filter(c => !pred(c))}; w.apply(w.state, []); } }; 'helpers ready'"
 },
 {
  "eval": "(() => { const d = H.d(); const c = d.chests.find(c => !c.locked); H.tp(c.x + 0.5, c.y + 1.5, 0, -1); return 'at the free chest ' + c.x + ',' + c.y; })()"
 },
 {
  "wait": 200
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 500
 },
 {
  "eval": "'small keys: ' + H.inv('small_key') + ' looted: ' + JSON.stringify(H.prog().looted)"
 },
 {
  "shot": "dungeon-chest"
 },
 {
  "eval": "(() => { const g = H.g(); window.__gb = JSON.stringify(g.session.gather) + JSON.stringify(g.session.farm); g.session = {...g.session, clock: {day: g.session.clock.day, t: 599.9}}; return 'the day is about to end, day ' + g.session.clock.day; })()"
 },
 {
  "wait": 700
 },
 {
  "eval": "(() => { const g = H.g(); return 'new day below ground: day ' + g.session.clock.day + ' island untouched ' + (window.__gb === JSON.stringify(g.session.gather) + JSON.stringify(g.session.farm)) + ' still in ' + g.session.location; })()"
 },
 {
  "eval": "(() => { const d = H.d(); const b = d.blocks[0]; H.tp(b.x - 0.5, b.y + 0.5, 1, 0); return 'left of the block at ' + b.x + ',' + b.y; })()"
 },
 {
  "wait": 200
 },
 {
  "shot": "dungeon-block-before"
 },
 {
  "press": "ArrowRight",
  "ms": 4200
 },
 {
  "wait": 600
 },
 {
  "eval": "'block puzzle solved: ' + H.prog().solved.includes(H.room('block').id) + ' blocks: ' + JSON.stringify(H.g().level.run.blocks)"
 },
 {
  "shot": "dungeon-block-after"
 },
 {
  "eval": "(() => { const r = H.room('fight'); const before = H.creatures().length; H.kill(c => c.x >= r.x0 && c.x < r.x0 + 13 && c.y >= r.y0 && c.y < r.y0 + 11); return 'fight room emptied: ' + before + ' -> ' + H.creatures().length; })()"
 },
 {
  "wait": 900
 },
 {
  "eval": "'fight room solved: ' + H.prog().solved.includes(H.room('fight').id) + ' solved rooms: ' + JSON.stringify(H.prog().solved)"
 },
 {
  "eval": "(() => { const c = H.d().crystals[0]; H.tp(c.x - 0.5, c.y + 0.5, 1, 0); return 'at crystal 0'; })()"
 },
 {
  "wait": 150
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 450
 },
 {
  "eval": "(() => { const c = H.d().crystals[1]; H.tp(c.x - 0.5, c.y + 0.5, 1, 0); return 'at crystal 1'; })()"
 },
 {
  "wait": 150
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 450
 },
 {
  "eval": "(() => { const c = H.d().crystals[2]; H.tp(c.x - 0.5, c.y + 0.5, 1, 0); return 'at crystal 2'; })()"
 },
 {
  "wait": 150
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 900
 },
 {
  "eval": "'crystals lit: ' + JSON.stringify(H.prog().lit) + ' crystal room solved: ' + H.prog().solved.includes(H.room('crystal').id)"
 },
 {
  "shot": "dungeon-crystals"
 },
 {
  "eval": "(() => { const c = H.d().chests.find(c => c.locked && c.loot.some(l => l.item === 'boss_key')); H.tp(c.x + 0.5, c.y + 1.5, 0, -1); return 'at the vault chest'; })()"
 },
 {
  "wait": 150
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 500
 },
 {
  "eval": "'boss keys: ' + H.inv('boss_key') + ' small keys left: ' + H.inv('small_key')"
 },
 {
  "eval": "(() => { const c = H.d().chests.find(c => c.locked && c.loot.length === 3); H.tp(c.x + 0.5, c.y + 1.5, 0, -1); return 'at the treasure chest'; })()"
 },
 {
  "wait": 150
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 500
 },
 {
  "eval": "'bandages: ' + H.inv('bandage') + ' arrows: ' + H.inv('arrow') + ' small keys left: ' + H.inv('small_key')"
 },
 {
  "eval": "(() => { const d = H.d(); const door = d.doors.find(x => x.lock === 'boss'); H.tp(door.x - 0.5, door.y + 0.5, 1, 0); return 'at the boss door'; })()"
 },
 {
  "wait": 150
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 900
 },
 {
  "eval": "'boss door opened: ' + JSON.stringify(H.prog().opened) + ' boss keys left: ' + H.inv('boss_key')"
 },
 {
  "shot": "dungeon-boss-door"
 },
 {
  "eval": "(() => { const d = H.d(); H.tp(d.rooms[6].x0 + 1.5, d.boss.y + 0.5, 1, 0); return 'in the boss room'; })()"
 },
 {
  "wait": 1800
 },
 {
  "eval": "(() => { const b = H.creatures().find(c => c.kind === H.d().boss.kind); return 'boss: ' + b.state + ' hp ' + b.hp + ' angry ' + b.angry + ' bar ' + JSON.stringify(H.g().bossBar()); })()"
 },
 {
  "shot": "dungeon-boss-fight"
 },
 {
  "wait": 1500
 },
 {
  "eval": "(() => { const b = H.creatures().find(c => c.kind === H.d().boss.kind); return 'boss: ' + b.state + ' shots ' + H.g().combat.wildlife.state.shots.length + ' hero hp ' + H.g().session.vitals.hp.toFixed(0); })()"
 },
 {
  "eval": "(() => { const g = H.g(); g.session = {...g.session, vitals: {...g.session.vitals, hp: 100}}; const b = H.creatures().find(c => c.kind === H.d().boss.kind); H.tp(b.x - 1.2, b.y, 1, 0); g.combat.onFx({t: 'strike', melee: {damage: 99999, reach: 3, arc: 360, knockback: 0, stamina: 0, cooldown: 0, wear: false}}); return 'boss struck down'; })()"
 },
 {
  "wait": 2200
 },
 {
  "eval": "'boss dead in progress: ' + H.prog().boss + ' compass: ' + H.inv('compass') + ' moss armor: ' + H.inv('armor_moss') + ' creatures left: ' + H.creatures().length"
 },
 {
  "shot": "dungeon-boss-dead"
 },
 {
  "eval": "(() => { const g = H.g(); const i = g.session.inventory.findIndex(s => s && s.item === 'armor_moss'); g.wear(i); return 'worn: ' + g.session.equipment.armor; })()"
 },
 {
  "eval": "(() => { const d = H.d(); H.tp(d.exit.x + 0.5, d.exit.y - 0.5, 0, 1); return 'at the exit'; })()"
 },
 {
  "wait": 200
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "until": "(() => { const g = H.g(); return g.level && !g.level.dungeon && g.scene.isActive('Game'); })()",
  "timeout": 15000
 },
 {
  "wait": 1200
 },
 {
  "eval": "window.H = { g: () => __game.scene.getScene('Game'), d() { return this.g().level.dungeon; }, tp(x, y, fx, fy) { const g = this.g(); g.pos = { x, y }; g.player.face(fx, fy); }, room(kind) { return this.d().rooms.find(r => r.kind === kind); }, inv(item) { return this.g().session.inventory.filter(s => s && s.item === item).reduce((n, s) => n + s.qty, 0); }, prog() { const g = this.g(); return g.session.dungeons[g.session.location]; }, creatures() { return this.g().combat.wildlife.state.creatures; }, kill(pred) { const w = this.g().combat.wildlife; w.state = {...w.state, creatures: w.state.creatures.filter(c => !pred(c))}; w.apply(w.state, []); } }; 'helpers ready'"
 },
 {
  "eval": "(() => { const g = H.g(); const l = g.world.landmarks.find(l => l.id === 'grotto'); return 'back on the island: location ' + g.session.location + ' pos ' + g.pos.x.toFixed(1) + ',' + g.pos.y.toFixed(1) + ' door at ' + l.x + ',' + l.y + ' armor ' + g.session.equipment.armor; })()"
 },
 {
  "shot": "dungeon-outside"
 },
 {
  "eval": "(() => { const g = H.g(); const l = g.world.landmarks.find(l => l.id === 'grotto'); H.tp(l.x + 0.5, l.y + 1.5, 0, -1); return 'at the door again'; })()"
 },
 {
  "wait": 200
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "until": "(() => { const g = H.g(); return g.level && g.level.dungeon && g.scene.isActive('Game'); })()",
  "timeout": 15000
 },
 {
  "wait": 1200
 },
 {
  "eval": "window.H = { g: () => __game.scene.getScene('Game'), d() { return this.g().level.dungeon; }, tp(x, y, fx, fy) { const g = this.g(); g.pos = { x, y }; g.player.face(fx, fy); }, room(kind) { return this.d().rooms.find(r => r.kind === kind); }, inv(item) { return this.g().session.inventory.filter(s => s && s.item === item).reduce((n, s) => n + s.qty, 0); }, prog() { const g = this.g(); return g.session.dungeons[g.session.location]; }, creatures() { return this.g().combat.wildlife.state.creatures; }, kill(pred) { const w = this.g().combat.wildlife; w.state = {...w.state, creatures: w.state.creatures.filter(c => !pred(c))}; w.apply(w.state, []); } }; 'helpers ready'"
 },
 {
  "eval": "(() => { const w = H.g().combat.wildlife.state; const d = H.d(); return 'second visit: boss alive ' + w.creatures.some(c => c.kind === d.boss.kind) + ' guards ' + w.creatures.length + ' crystal targets ' + w.targets.length + ' progress ' + JSON.stringify(H.prog()); })()"
 },
 {
  "eval": "JSON.stringify(window.__errs)"
 }
]
```

Dying on a spike trap in a dungeon, and waking on the island:

`tools/scripts/dungeon-death.json`:

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
  "eval": "window.H = { g: () => __game.scene.getScene('Game'), d() { return this.g().level.dungeon; }, tp(x, y, fx, fy) { const g = this.g(); g.pos = { x, y }; g.player.face(fx, fy); }, room(kind) { return this.d().rooms.find(r => r.kind === kind); }, inv(item) { return this.g().session.inventory.filter(s => s && s.item === item).reduce((n, s) => n + s.qty, 0); }, prog() { const g = this.g(); return g.session.dungeons[g.session.location]; }, creatures() { return this.g().combat.wildlife.state.creatures; }, kill(pred) { const w = this.g().combat.wildlife; w.state = {...w.state, creatures: w.state.creatures.filter(c => !pred(c))}; w.apply(w.state, []); } }; 'helpers ready'"
 },
 {
  "eval": "(() => { const g = H.g(); const l = g.world.landmarks.find(l => l.id === 'grotto'); H.tp(l.x + 0.5, l.y + 1.5, 0, -1); const inv = g.session.inventory.slice(); inv[0] = {item: 'sword_iron', qty: 1, dur: 160}; inv[1] = {item: 'bow', qty: 1, dur: 80}; inv[2] = {item: 'arrow', qty: 20}; g.session = {...g.session, inventory: inv, selected: 0}; return 'armed at the grotto door'; })()"
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "until": "(() => { const g = H.g(); return g.level && g.level.dungeon && g.scene.isActive('Game'); })()",
  "timeout": 15000
 },
 {
  "wait": 1200
 },
 {
  "eval": "window.H = { g: () => __game.scene.getScene('Game'), d() { return this.g().level.dungeon; }, tp(x, y, fx, fy) { const g = this.g(); g.pos = { x, y }; g.player.face(fx, fy); }, room(kind) { return this.d().rooms.find(r => r.kind === kind); }, inv(item) { return this.g().session.inventory.filter(s => s && s.item === item).reduce((n, s) => n + s.qty, 0); }, prog() { const g = this.g(); return g.session.dungeons[g.session.location]; }, creatures() { return this.g().combat.wildlife.state.creatures; }, kill(pred) { const w = this.g().combat.wildlife; w.state = {...w.state, creatures: w.state.creatures.filter(c => !pred(c))}; w.apply(w.state, []); } }; 'helpers ready'"
 },
 {
  "eval": "(() => { const g = H.g(); g.session = {...g.session, vitals: {...g.session.vitals, hp: 4}}; const t = H.d().traps[0]; H.tp(t.x + 0.5, t.y + 0.5, 0, 1); return 'hp 4 on a trap at ' + t.x + ',' + t.y; })()"
 },
 {
  "until": "H.g().dead === true",
  "timeout": 8000
 },
 {
  "eval": "'collapsed in the dungeon: dead ' + H.g().dead + ' hp ' + H.g().session.vitals.hp.toFixed(1)"
 },
 {
  "shot": "dungeon-death-dialog"
 },
 {
  "wait": 1500
 },
 {
  "eval": "'hp while down: ' + H.g().session.vitals.hp.toFixed(1)"
 },
 {
  "eval": "H.g().wakeUp(); 'woke up'"
 },
 {
  "until": "(() => { const g = H.g(); return g.level && !g.level.dungeon && g.scene.isActive('Game') && !g.dead; })()",
  "timeout": 15000
 },
 {
  "wait": 800
 },
 {
  "eval": "window.H = { g: () => __game.scene.getScene('Game'), d() { return this.g().level.dungeon; }, tp(x, y, fx, fy) { const g = this.g(); g.pos = { x, y }; g.player.face(fx, fy); }, room(kind) { return this.d().rooms.find(r => r.kind === kind); }, inv(item) { return this.g().session.inventory.filter(s => s && s.item === item).reduce((n, s) => n + s.qty, 0); }, prog() { const g = this.g(); return g.session.dungeons[g.session.location]; }, creatures() { return this.g().combat.wildlife.state.creatures; }, kill(pred) { const w = this.g().combat.wildlife; w.state = {...w.state, creatures: w.state.creatures.filter(c => !pred(c))}; w.apply(w.state, []); } }; 'helpers ready'"
 },
 {
  "eval": "(() => { const g = H.g(); return 'after waking: location ' + g.session.location + ' dead ' + g.dead + ' hp ' + g.session.vitals.hp + ' pos ' + g.pos.x.toFixed(1) + ',' + g.pos.y.toFixed(1) + ' respawn ' + g.session.respawn.x.toFixed(1) + ',' + g.session.respawn.y.toFixed(1); })()"
 },
 {
  "eval": "JSON.stringify(window.__errs)"
 }
]
```

Saving inside a dungeon and continuing, and a save made under another dungeon version:

`tools/scripts/dungeon-persist.json`:

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
  "eval": "window.H = { g: () => __game.scene.getScene('Game'), d() { return this.g().level.dungeon; }, tp(x, y, fx, fy) { const g = this.g(); g.pos = { x, y }; g.player.face(fx, fy); }, room(kind) { return this.d().rooms.find(r => r.kind === kind); }, inv(item) { return this.g().session.inventory.filter(s => s && s.item === item).reduce((n, s) => n + s.qty, 0); }, prog() { const g = this.g(); return g.session.dungeons[g.session.location]; }, creatures() { return this.g().combat.wildlife.state.creatures; }, kill(pred) { const w = this.g().combat.wildlife; w.state = {...w.state, creatures: w.state.creatures.filter(c => !pred(c))}; w.apply(w.state, []); } }; 'helpers ready'"
 },
 {
  "eval": "(() => { const g = H.g(); const l = g.world.landmarks.find(l => l.id === 'grotto'); H.tp(l.x + 0.5, l.y + 1.5, 0, -1); const inv = g.session.inventory.slice(); inv[0] = {item: 'sword_iron', qty: 1, dur: 160}; inv[1] = {item: 'bow', qty: 1, dur: 80}; inv[2] = {item: 'arrow', qty: 20}; g.session = {...g.session, inventory: inv, selected: 0}; return 'armed at the grotto door'; })()"
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "until": "(() => { const g = H.g(); return g.level && g.level.dungeon && g.scene.isActive('Game'); })()",
  "timeout": 15000
 },
 {
  "wait": 1200
 },
 {
  "eval": "window.H = { g: () => __game.scene.getScene('Game'), d() { return this.g().level.dungeon; }, tp(x, y, fx, fy) { const g = this.g(); g.pos = { x, y }; g.player.face(fx, fy); }, room(kind) { return this.d().rooms.find(r => r.kind === kind); }, inv(item) { return this.g().session.inventory.filter(s => s && s.item === item).reduce((n, s) => n + s.qty, 0); }, prog() { const g = this.g(); return g.session.dungeons[g.session.location]; }, creatures() { return this.g().combat.wildlife.state.creatures; }, kill(pred) { const w = this.g().combat.wildlife; w.state = {...w.state, creatures: w.state.creatures.filter(c => !pred(c))}; w.apply(w.state, []); } }; 'helpers ready'"
 },
 {
  "eval": "(() => { const d = H.d(); const c = d.chests.find(c => !c.locked); H.tp(c.x + 0.5, c.y + 1.5, 0, -1); return 'at the free chest'; })()"
 },
 {
  "wait": 200
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "wait": 400
 },
 {
  "eval": "(() => { const g = H.g(); const d = H.d(); H.tp(d.rooms[2].x0 + 3.5, d.rooms[2].y0 + 4.5, 1, 0); g.saveNow(); return 'saved inside at ' + g.pos.x.toFixed(1) + ',' + g.pos.y.toFixed(1); })()"
 },
 {
  "goto": "http://localhost:5199/"
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
  "wait": 900
 },
 {
  "eval": "window.H = { g: () => __game.scene.getScene('Game'), d() { return this.g().level.dungeon; }, tp(x, y, fx, fy) { const g = this.g(); g.pos = { x, y }; g.player.face(fx, fy); }, room(kind) { return this.d().rooms.find(r => r.kind === kind); }, inv(item) { return this.g().session.inventory.filter(s => s && s.item === item).reduce((n, s) => n + s.qty, 0); }, prog() { const g = this.g(); return g.session.dungeons[g.session.location]; }, creatures() { return this.g().combat.wildlife.state.creatures; }, kill(pred) { const w = this.g().combat.wildlife; w.state = {...w.state, creatures: w.state.creatures.filter(c => !pred(c))}; w.apply(w.state, []); } }; 'helpers ready'"
 },
 {
  "eval": "(() => { const g = H.g(); return 'continued: location ' + g.session.location + ' pos ' + g.pos.x.toFixed(1) + ',' + g.pos.y.toFixed(1) + ' looted ' + JSON.stringify(H.prog().looted) + ' keys ' + H.inv('small_key') + ' toast-free layer ok'; })()"
 },
 {
  "shot": "dungeon-continued"
 },
 {
  "goto": "http://localhost:5199/"
 },
 {
  "until": "window.__game && __game.scene.isActive('Menu')",
  "timeout": 20000
 },
 {
  "eval": "(() => { let n = 0; for (const k of Object.keys(localStorage)) { if (!k.includes('slot.0')) continue; const raw = JSON.parse(localStorage.getItem(k)); raw.dungeonVersion = 0; localStorage.setItem(k, JSON.stringify(raw)); n++; } return 'saved with an old dungeon version in ' + n + ' places'; })()"
 },
 {
  "eval": "__game.scene.getScene('Menu').goTo('Game', {slot: 0})"
 },
 {
  "until": "__game.scene.isActive('Game') && __game.scene.isActive('Hud')",
  "timeout": 20000
 },
 {
  "wait": 900
 },
 {
  "eval": "window.H = { g: () => __game.scene.getScene('Game'), d() { return this.g().level.dungeon; }, tp(x, y, fx, fy) { const g = this.g(); g.pos = { x, y }; g.player.face(fx, fy); }, room(kind) { return this.d().rooms.find(r => r.kind === kind); }, inv(item) { return this.g().session.inventory.filter(s => s && s.item === item).reduce((n, s) => n + s.qty, 0); }, prog() { const g = this.g(); return g.session.dungeons[g.session.location]; }, creatures() { return this.g().combat.wildlife.state.creatures; }, kill(pred) { const w = this.g().combat.wildlife; w.state = {...w.state, creatures: w.state.creatures.filter(c => !pred(c))}; w.apply(w.state, []); } }; 'helpers ready'"
 },
 {
  "eval": "(() => { const g = H.g(); return 'old dungeon version: location ' + g.session.location + ' on island ' + !g.level.dungeon + ' pos ' + g.pos.x.toFixed(1) + ',' + g.pos.y.toFixed(1) + ' respawn ' + g.session.respawn.x.toFixed(1) + ',' + g.session.respawn.y.toFixed(1) + ' dungeons ' + JSON.stringify(g.session.dungeons.grotto); })()"
 },
 {
  "eval": "JSON.stringify(window.__errs)"
 }
]
```

Frame rate and CPU in the boss room:

`tools/scripts/dungeon-perf.json`:

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
  "eval": "window.H = { g: () => __game.scene.getScene('Game'), d() { return this.g().level.dungeon; }, tp(x, y, fx, fy) { const g = this.g(); g.pos = { x, y }; g.player.face(fx, fy); }, room(kind) { return this.d().rooms.find(r => r.kind === kind); }, inv(item) { return this.g().session.inventory.filter(s => s && s.item === item).reduce((n, s) => n + s.qty, 0); }, prog() { const g = this.g(); return g.session.dungeons[g.session.location]; }, creatures() { return this.g().combat.wildlife.state.creatures; }, kill(pred) { const w = this.g().combat.wildlife; w.state = {...w.state, creatures: w.state.creatures.filter(c => !pred(c))}; w.apply(w.state, []); } }; 'helpers ready'"
 },
 {
  "eval": "(() => { const g = H.g(); const l = g.world.landmarks.find(l => l.id === 'grotto'); H.tp(l.x + 0.5, l.y + 1.5, 0, -1); const inv = g.session.inventory.slice(); inv[0] = {item: 'sword_iron', qty: 1, dur: 160}; inv[1] = {item: 'bow', qty: 1, dur: 80}; inv[2] = {item: 'arrow', qty: 20}; g.session = {...g.session, inventory: inv, selected: 0}; return 'armed at the grotto door'; })()"
 },
 {
  "press": "Space",
  "ms": 80
 },
 {
  "until": "(() => { const g = H.g(); return g.level && g.level.dungeon && g.scene.isActive('Game'); })()",
  "timeout": 15000
 },
 {
  "wait": 1200
 },
 {
  "eval": "window.H = { g: () => __game.scene.getScene('Game'), d() { return this.g().level.dungeon; }, tp(x, y, fx, fy) { const g = this.g(); g.pos = { x, y }; g.player.face(fx, fy); }, room(kind) { return this.d().rooms.find(r => r.kind === kind); }, inv(item) { return this.g().session.inventory.filter(s => s && s.item === item).reduce((n, s) => n + s.qty, 0); }, prog() { const g = this.g(); return g.session.dungeons[g.session.location]; }, creatures() { return this.g().combat.wildlife.state.creatures; }, kill(pred) { const w = this.g().combat.wildlife; w.state = {...w.state, creatures: w.state.creatures.filter(c => !pred(c))}; w.apply(w.state, []); } }; 'helpers ready'"
 },
 {
  "eval": "(() => { const d = H.d(); H.tp(d.rooms[6].x0 + 1.5, d.boss.y + 0.5, 1, 0); const g = H.g(); g.session = {...g.session, vitals: {...g.session.vitals, hp: 100000}}; return 'in the boss room'; })()"
 },
 {
  "wait": 1500
 },
 {
  "eval": "(() => { window.__fps = []; window.__fpsTimer = setInterval(() => window.__fps.push(__game.loop.actualFps), 250); return 'sampling'; })()"
 },
 {
  "profile": 4000,
  "top": 10
 },
 {
  "eval": "(() => { clearInterval(window.__fpsTimer); const f = window.__fps.slice().sort((a, b) => a - b); return 'fps min=' + f[0].toFixed(0) + ' median=' + f[Math.floor(f.length / 2)].toFixed(0) + ' samples=' + f.length + ' creatures=' + H.creatures().length; })()"
 },
 {
  "eval": "JSON.stringify(window.__errs)"
 }
]
```

Wearing armour from the backpack screen:

`tools/scripts/armor.json`:

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
  "eval": "window.H = { g: () => __game.scene.getScene('Game'), d() { return this.g().level.dungeon; }, tp(x, y, fx, fy) { const g = this.g(); g.pos = { x, y }; g.player.face(fx, fy); }, room(kind) { return this.d().rooms.find(r => r.kind === kind); }, inv(item) { return this.g().session.inventory.filter(s => s && s.item === item).reduce((n, s) => n + s.qty, 0); }, prog() { const g = this.g(); return g.session.dungeons[g.session.location]; }, creatures() { return this.g().combat.wildlife.state.creatures; }, kill(pred) { const w = this.g().combat.wildlife; w.state = {...w.state, creatures: w.state.creatures.filter(c => !pred(c))}; w.apply(w.state, []); } }; 'helpers ready'"
 },
 {
  "eval": "window.H = { g: () => __game.scene.getScene('Game'), d() { return this.g().level.dungeon; }, tp(x, y, fx, fy) { const g = this.g(); g.pos = { x, y }; g.player.face(fx, fy); }, room(kind) { return this.d().rooms.find(r => r.kind === kind); }, inv(item) { return this.g().session.inventory.filter(s => s && s.item === item).reduce((n, s) => n + s.qty, 0); }, prog() { const g = this.g(); return g.session.dungeons[g.session.location]; }, creatures() { return this.g().combat.wildlife.state.creatures; }, kill(pred) { const w = this.g().combat.wildlife; w.state = {...w.state, creatures: w.state.creatures.filter(c => !pred(c))}; w.apply(w.state, []); } }; 'helpers ready'"
 },
 {
  "eval": "(() => { const g = H.g(); const inv = g.session.inventory.slice(); inv[0] = {item: 'armor_iron', qty: 1}; inv[1] = {item: 'sword_wood', qty: 1, dur: 40}; g.session = {...g.session, inventory: inv, selected: 1, equipment: {armor: 'armor_moss'}}; g.openInventory({mode: 'bag'}); return 'bag open'; })()"
 },
 {
  "wait": 400
 },
 {
  "shot": "armor-bag"
 },
 {
  "eval": "(() => { const s = __game.scene.getScene('Inventory'); s.picked = 0; s.render(); return 'armor picked'; })()"
 },
 {
  "wait": 300
 },
 {
  "shot": "armor-picked"
 },
 {
  "eval": "(() => { const s = __game.scene.getScene('Inventory'); const b = s.ui.list.find(o => o.type === 'Container' && o.list && o.list.some(c => c.text === 'Wear')); b.emit('pointerdown'); b.emit('pointerup'); return 'wear pressed ' + !!b; })()"
 },
 {
  "wait": 400
 },
 {
  "eval": "'worn now: ' + H.g().session.equipment.armor + ' bag slot 0: ' + JSON.stringify(H.g().session.inventory[0])"
 },
 {
  "shot": "armor-worn"
 },
 {
  "eval": "JSON.stringify(window.__errs)"
 }
]
```

- [ ] **Step 2: Run the new scenarios**

```bash
for n in dungeon-play dungeon-death dungeon-persist dungeon-perf armor; do echo "=== $n"; node tools/play.mjs tools/scripts/$n.json tools/.cache/shots 2>&1 | grep -v "^shot" | tail -24; done
```

Expected:
- `dungeon-play`: `small keys: 2`; `new day below ground: day 2 island untouched true still in grotto`; `block puzzle solved: true`; `fight room solved: true`; `crystals lit: [0,1,2] crystal room solved: true`; `boss keys: 1 small keys left: 1`; `bandages: 3` and `small keys left: 0`; `boss door opened: [5] boss keys left: 0`; a `boss:` line with `angry true` and a bar `{"name":"boss_mossback","hp":140,"max":140}`; `boss dead in progress: true compass: 1 moss armor: 1`; `worn: armor_moss`; `back on the island: location null` with a position just south of the door; `second visit: boss alive false`, `crystal targets 0` and a progress with the boss dead; `page errors: []`.
- `dungeon-death`: `collapsed in the dungeon: dead true hp 0.0`; `hp while down: 0.0`; `after waking: location null dead false hp 60.` and the respawn position; `page errors: []`.
- `dungeon-persist`: `continued: location grotto` with the same position, `looted [2]`, `keys 2`; `old dungeon version: location null on island true` with the hero at his bed and empty progress; `page errors: []`.
- `dungeon-perf`: `page errors: []`, the CPU profile mostly `(idle)`, and `fps median=` 50 or more.
- `armor`: `worn now: armor_iron` and `bag slot 0` holding the moss mantle; `page errors: []`.

On a cold dev server the very first `goto` of a run can print `page.goto: Timeout 30000ms exceeded` after `page errors: []` although the scenario went on to pass; if you see it, run that scenario once more.

Look at `tools/.cache/shots/dungeon-boss-fight.png` (the boss bar across the top, the hero, torches, spikes), `dungeon-crystals.png` (golden crystals and the "A door opens" toast), `dungeon-block-after.png`, `dungeon-outside.png` and `armor-picked.png` (the armour box on the right, the Wear button).

- [ ] **Step 3: Run every older scenario again**

```bash
for n in audio badsave boot build corrupt death-back death fight harvest hunt island migrate monster-death night pause perf perf-fight persist sleep spawn survive tools zoo; do echo "== $n: $(node tools/play.mjs tools/scripts/$n.json tools/.cache/shots 2>&1 | grep -E 'page errors|step' | tr '\n' ' ' | cut -c1-160)"; done
```

Expected: every line ends with `page errors: []` (the same results as at the end of plan 3).

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
Scenarios: boot, island, harvest, persist, night, pause, corrupt, badsave, survive, build, tools, death, death-back, sleep, migrate, perf, fight, hunt, monster-death, spawn, audio, perf-fight, zoo, dungeon-play, dungeon-death, dungeon-persist, dungeon-perf, armor.

## Status (phase 4)

A survival game on a seed-generated island: hunger, thirst, stamina and health; a 32-slot backpack with a hotbar;
tools with tiers and durability; 23 recipes at the hand, campfire, workbench and furnace; building (campfire,
workbench, furnace, bed, chest, torch, fence) and taking buildings down; four farmed crops; a real night with
light from fires and torches; sleeping; death rules per difficulty; save format 3 (phase 1 and 2 saves still load).
Phase 3 adds fighting and hunting: 9 monsters and 4 animals that spawn by biome and time of day (monsters keep away
from the starting beach and from fire light), swords, a bone spear and a bow with arrows, knockback, hit-stop, damage
numbers, loot that lies on the ground and is picked up on contact, raw and cooked meat, honey and bandages for
healing, sound effects and day, night and battle music. Controls: USE (or Space or E) swings the held weapon at what
is in front of you, shoots the bow, or does whatever the held item does; with bare hands or a tool it fights back when
something is in reach.
Phase 4 adds three dungeons (Mushroom Grotto, Deep Mine, Sunken Ruin): a door on the island leads into a
generated interior of eight rooms with push blocks, floor switches, spike traps, crystals to strike, locked chests, small
keys and a boss key, guards, and a boss with two phases at the end (Mossback, Ironbones, Mirelord). Every dungeon is
built from the world seed and always finishable (the tests play each one through). Bosses drop a story item (Compass,
Hull Planks, Lighthouse Key) and a piece of armour; five armour pieces can be worn from the backpack screen and cut every
blow. What you did in a dungeon is saved with the game; dying below ground wakes you at your bed.
Measured on the dev PC (headless Edge): tap-to-game 415 ms, 60 fps, still 58 fps with 24 creatures chasing.

## Credits

Pixel art: Super Retro Collection by Gif. Fonts: Jersey and Tiny5 (SIL OFL).
```

- [ ] **Step 5: Final checks**

Run: `npm test && npm run test:cov && npm run build`
Expected: 492 tests PASS; coverage above 80%; the build succeeds. Stop the dev server you started (only that one).

- [ ] **Step 6: Commit**

```bash
git add tools/scripts README.md
git commit -m "test: add dungeon, boss, death, save and armour scenarios; update docs"
```

