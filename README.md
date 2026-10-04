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
Scenarios: boot, island, harvest, persist, night, pause, corrupt, badsave, survive, build, tools, death, death-back, sleep, migrate, perf, fight, hunt, monster-death, spawn, audio, perf-fight, zoo, dungeon-play, dungeon-death, dungeon-persist, dungeon-perf, dungeon-leave-moving, armor.

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
