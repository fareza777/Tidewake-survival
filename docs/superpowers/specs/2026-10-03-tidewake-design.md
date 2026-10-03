# Tidewake: Island Survival — Design Spec

Date: 2026-10-03 · Status: draft for user review · Working folder: `E:\RPG Survival Sprite Sonnet 55`

## 1. Intent

**Request (user):** a complete, polished 2D survival game in the spirit of *Survival RPG 1: Lost Treasure* (Bew Games,
`com.bewgames.survivaladventure`), built with the Unity-store sprite pack *Super Retro Collection v3.1.5*, with a cool
name, app icon, splash, onboarding, New Game menu, Settings, About, Share, Rate, a main quest and side quests.
Reference project: `E:\Roguelike Opus 55` (Dawnbound — Phaser 3 + Capacitor).

**Decisions confirmed with the user**
- Stack: **Phaser 3 + TypeScript + Capacitor 8** (same as Dawnbound). Not a Unity-editor project; the Unity pack is used as sprite source only.
- World: **hybrid** — generated from a seed per New Game, with guaranteed fixed story landmarks.
- v1 scale: **one large island, 4 biomes, 3 dungeons**.

**Defaults assumed (user may change):** Android/Google Play target · offline single-player · languages EN + ID ·
no ads and no IAP in v1 · working title **Tidewake: Island Survival** (alternates: Driftlight, Emberwreck) ·
art/audio extras produced with the existing generation tools.

**Success =** a player can install the APK, go through splash → onboarding → New Game, survive on the island,
craft 60+ items, clear 3 dungeons, finish the 10-chapter main quest (two endings), and optionally 10 side quests,
with save/continue, settings, share and rate all working, at stable 60 fps on a mid-range Android phone.

## 2. Non-goals (v1)

Multiplayer, ads/IAP, cloud save, iOS, multiple islands, base raids, vehicles, modding. The Play Store listing itself
(account, signing key, publishing) is the owner's task; the repo only produces the AAB and listing assets.

## 3. Platform & stack

Phaser 3.90, TypeScript 5.9, Vite 7, Vitest 3, Capacitor 8 (app, haptics, preferences, screen-orientation, share,
splash-screen, status-bar, in-app-review). Portrait 9:16–9:21, integer-scaled canvas, world zoom 2×, 16×16 tiles.
Package id `com.fajar.tidewake`. Tooling (Python/Node scripts, Gradle wrapper, patch-package setup) is adapted from Dawnbound.

## 4. Gameplay systems

All numeric values live in one file `src/data/balance.ts` and are tuned during phase 7.

**Controls:** floating joystick (move), ACTION button (context: hit/harvest/talk/open — auto-targets the nearest
interactable in front), ATTACK, DASH (short roll, stamina cost), hotbar (8 slots, tap to equip/use), QUICK-EAT.
Auto-attack option in Settings.

**Vitals:** HP 100, Hunger 100, Thirst 100, Stamina 100. Hunger and thirst drain over time (faster when sprinting
or in the desert); at 0 they drain HP. Stamina drains on dash/sprint/heavy tools and regenerates when idle.
Sleeping in a bed restores HP and skips the night. Death returns the player to the last bed/camp, dropping
nothing in Santai, 50% of the hotbar in Normal, and deleting the save in Hardcore.

**Time & weather:** a full day lasts 10 real minutes (dawn, day, dusk, night). Night is dark and spawns more hostile
mobs; rain extinguishes unprotected torches and refills water barrels. Light sources (campfire, torch, lantern)
use the `Lighting` approach from Dawnbound.

**Gathering:** tools have tiers (wood → stone → iron → gold) and durability. Axe (trees), pickaxe (rocks, ores),
shovel (dig, treasure spots), hoe and watering can (farming), fishing rod, bow. Resources respawn per in-game day.

**Crafting (60+ recipes):** by hand (basic), Workbench (tools, furniture), Furnace (smelt, bricks, glass),
Cooking Pot/Campfire (food), Alchemy Table (potions, antidote). Categories: tools, weapons, armor, food, potions,
building, furniture, utility (torch, rope, raft parts). Item icons are required for every item (see §9).

**Building (camp):** place chests, beds, workbench, furnace, campfire, torches, fences, planter beds, signs on a
tile grid; a placement ghost shows validity. Beds set the respawn point.

**Farming & animals:** plant seeds on tilled soil, water, harvest by growth stage (the pack's crop frames).
Huntable animals (boar, rabbit, fox, bird); chickens/pigs can be fed to follow and produce items.

**Combat:** real-time top-down. Sword, spear, and a bow with arrows. Enemy roster from the pack's monsters and battlers:
forest — slime, mushroom, wasp, wild pig (recoloured pig); mountain — skeleton, zombie, wasp; swamp — worm, ghost, slime variants;
desert/ruin — scorpion, lamia, skeleton warrior. Hit-stop, flash, knockback, damage numbers. Armor reduces damage.
Three bosses (one per dungeon) with 2 phases each.

**Dungeons (3):** generated from room templates with a fixed boss room, using these puzzle pieces from the pack:
pushable blocks, floor switches, doors, traps, locked chests with keys, crystals. Each dungeon rewards a
story item and an upgrade (tool tier or armor).

## 5. World generation

`generateWorld(seed) -> World`, a pure function; same seed → same island.

1. 160×160 tile grid. Height = fBm noise × radial falloff → land/sea mask (shallow water, beach).
2. Moisture noise + height → four biomes: **Beach/Forest** (start), **Mountain/Mine**, **Swamp**, **Desert/Ruins**.
3. Rivers carved downhill from the mountain to the sea.
4. Fixed landmarks placed by rules (biome, distance from start, min spacing): shipwreck beach (start), starter camp
   site, Old Sailor's hut, Herbalist hut, Miner's tent, 3 dungeon entrances, lighthouse on the north cape,
   ruin tablets area, treasure spots.
5. **Validation:** flood-fill from the start must reach every landmark without crossing deep water; otherwise
   the generator re-rolls with `seed + n` (bounded retries, fallback seed guaranteed valid and covered by a test).
6. Resources and animals scattered by per-biome density tables with minimum spacing; no spawn on landmarks.
7. The world is stored as typed arrays (tile ids, object ids); player changes are saved as a diff against the seed.

Rendering: ground and decoration in chunked tilemap layers with camera culling; trees, rocks and entities as
y-sorted sprites. Autotile water/beach from the pack's autotile atlases.

## 6. Quests

Engine: data-driven quest definitions (steps with typed objectives: collect, craft, kill, reach, talk, build, survive),
a quest log, tracker on the HUD, rewards, and flags. Adapted from Dawnbound `systems/quests.ts` (tested).

**Main quest — 10 chapters**
1. Washed Ashore — gather wood, make an axe and a campfire.
2. First Night — build a bed and a shelter, eat cooked food, survive until dawn.
3. The Old Sailor — find Marlo; learn the raft needs a compass, planks and sailcloth.
4. Mushroom Grotto — Dungeon 1; defeat **Mossback** (minotaur); get the Compass.
5. Iron and Fire — climb the mountain, mine ore, build a furnace, make iron tools.
6. Deepmine — Dungeon 2; defeat **Ironbones** (skeleton warrior); get the Hull Planks.
7. Swamp Fever — survive the swamp, craft an antidote with Nia, reach the swamp camp.
8. Sunken Ruin — Dungeon 3 in the desert; defeat **Mirelord** (lamia); get the Lighthouse Key.
9. The Lighthouse — open it, uncover the island's secret (a graveyard of ships) and face the **Hollow Keeper** (final boss).
10. Set Sail — build the raft; choose to leave (ending A) or stay and rebuild the lighthouse (ending B).

**Side quests (10):** Lost Cat (Tali), Grandma's Recipes (Nia, cook 3 dishes), Treasure Map (Marlo, dig 3 spots),
The Big Catch (Odo, rare fish), Brock's Pickaxe (Brock, lost in the mine), Harvest Season (plant and harvest 10 crops),
Boar Trouble (clear boars from Tali's garden), Message in a Bottle (find 5 bottles), Night Watch (spend a night outside with light),
Ruin Tablets (4 tablets, lore). NPCs: Marlo, Nia, Brock, Tali, Odo. Dialogue in EN and ID.

## 7. App flow & screens

```
Splash (logo) → [first launch] Language → Onboarding (3 cards) → Main Menu
Main Menu: Continue · New Game · Settings · About · Share · Rate
New Game: slot (3) → hero name → seed (optional) → difficulty (Santai/Normal/Hardcore) → Intro cinematic (skippable) → Game
Game HUD: vitals, hotbar, joystick, action buttons, quest tracker, minimap toggle
Pause: Inventory · Crafting · Quest log · Map · Settings · Save & Quit
```

- **Settings:** music, SFX, vibration, screen shake, damage numbers, auto-attack, joystick mode, language (EN/ID),
  graphics quality, reset save.
- **About:** version, credits (**Super Retro Collection by Gif** is credited; plus tools/audio), privacy-policy link, contact.
- **Share:** Capacitor Share with a message and the Play Store URL (config constant; placeholder until published).
- **Rate:** in-app review prompt after a meaningful milestone (e.g. chapter 3) plus a manual button in the menu.
- Back button, pause on app background, safe-area insets and a11y reduce-motion option are handled in the shell.

## 8. Architecture

Pure logic is separated from Phaser so it is unit-testable.

```
src/
  core/      audio, i18n, save, store, rng, viewport, platform, events, a11y   (reused/adapted from Dawnbound)
  data/      items, recipes, biomes, enemies, bosses, npcs, quests, dialogues, strings(en,id), balance, types
  sim/       world (gen), survival, crafting, inventory, building, farming, daynight, quests, loot, combat-math
  game/      FlowField, Lighting, Fx, Projectiles, input, WorldManager, SpawnManager
  entities/  Actor, Player, Enemy, Boss, Animal, Npc, Interactable
  gfx/       TileRenderer, ObjectLayer, animations
  scenes/    Boot, Preload, Splash, Onboarding, Menu, NewGame, Intro, Game, Hud, Pause(+Inventory/Crafting/Quests/Map),
             Dialogue, Settings, About, Transition, Notify
  ui/        theme, skin, widgets, modal, scroll, itemIcon
tools/       pack_assets.py, pack_tiles.py, gen_art.py, gen_audio.py, play.mjs, build_fonts.py   (adapted)
tests/       vitest unit tests for every sim/ module + content integrity + world-gen validity
```

Files stay under ~400 lines (800 max). State is treated immutably in `sim/` (functions return new state); Phaser
objects are the only mutable layer.

**Save:** JSON, `{ version, slot, seed, difficulty, player, inventory, world diff, quests, time }` (settings are stored under a separate key)
via Capacitor Preferences (3 slots + settings key). Versioned with a `migrate()` chain; load validates the schema
and falls back to the last good autosave rather than crashing. Autosave on sleep, pause, background and quit.

## 9. Assets & branding

- **From the pack (read-only master `E:\Pixel Games Asset Master`, never modified):** terrain/autotiles, trees,
  rocks, crops, houses, torches, fires, chests, doors, hero (5 colours, 4 directions, attack/bow/lift/hit/death),
  32 ARPG characters, NPC sprites, animals, monsters and battlers, farm tool animations. A pack script copies the used
  frames into trimmed atlases under `public/assets/pack/` (same approach as Dawnbound).
- **Not in the pack (gaps):** UI/HUD skin, fonts, item icons (except farming icons), music and SFX. Plan: reuse
  Dawnbound's `ui/skin.ts` approach and `build_fonts.py` for UI/fonts; item icons are cropped from pack sprites
  where one exists and otherwise generated pixel icons, then reviewed in-game; music/SFX/voice from the audio generation tool.
- **Branding:** name + logo lockup, adaptive app icon (all densities), splash screen, key art, Play feature graphic,
  8 store screenshots, short promo video, listing text (EN/ID). Generated via the image tools and composed in-repo.
- **Secrets:** API keys are never committed or copied into source; tools read them from environment variables
  (`E:\Game Dev Tools.txt` stays outside the repo and should be rotated/stored in a secret manager).

## 10. Testing & quality

- Vitest unit tests for all `sim/` modules; world generator property tests (determinism, reachability for N seeds,
  landmark count); content integrity (every recipe/item/icon/string/quest reference resolves, EN and ID keys match).
- Target ≥ 80% coverage on `sim/` and `data/` validation.
- Browser smoke test via `tools/play.mjs` each phase; manual visual QA of every screen at 9:16 and 9:21.
- Performance budget: 60 fps on mid-range Android, atlas memory < 64 MB, app size < 80 MB AAB.
- A debug APK is built and installed in the emulator in phase 7. Code review pass after each phase.

## 11. Phases (each ends with a playable build)

| # | Scope | Done when |
|---|---|---|
| 0 | Scaffold, tooling, asset pack scripts, shell scenes | `npm run build` + `npm test` green; boots to menu |
| 1 | World gen, tile rendering, player, camera, resources, day/night | Walk around a generated island, chop/mine |
| 2 | Vitals, inventory, hotbar, crafting, building, farming | Survive a day, craft and build a camp |
| 3 | Combat, enemies, animals, loot, music | Fight and hunt; death/respawn works |
| 4 | Dungeons, puzzles, 3 bosses | All three dungeons clearable |
| 5 | NPCs, dialogue, main quest, side quests, endings | Full playthrough start→ending |
| 6 | Branding, onboarding, full menu (New Game/Settings/About/Share/Rate), audio, EN/ID | All screens final |
| 7 | Balance, polish, QA, perf, Android build | AAB/APK builds, checklist in §10 passes |

## 12. Risks

| Risk | Mitigation |
|---|---|
| Missing item/HUD art and audio in the pack | Early visual spike in phase 0/1; iterate icon style before mass production |
| Scope (60+ recipes, 20 quests, 3 dungeons) | Data-driven content, strict phase gates, content can be trimmed without touching engine |
| Performance of a 160×160 world | Chunked tilemaps, culling, pooled sprites, measured in phase 1 |
| Generated world feels samey or has dead ends | Validation + re-roll, landmark rules, seeds tested in CI |
| Unity pack license | Pack is used as a licensed sprite source; credit Gif in About; do not redistribute raw pack files |
| Generated audio/art quality inconsistent | Human-review gate on each batch; replace weak assets before release |
