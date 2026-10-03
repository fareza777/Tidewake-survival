# Tidewake Foundation & Walkable Island Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Tidewake project foundation (toolchain, tested game logic, asset pipeline, app shell) and a playable seed-generated island where the hero can walk, harvest resources, see day turn to night, and save and continue.

**Architecture:** Pure, unit-tested logic in `src/sim/` and `src/core/` (immutable data in, new data out) that never imports Phaser; thin Phaser scenes in `src/scenes/` that render and read input. The island is regenerated from a seed, and a save stores only the seed plus the player's changes (a diff). UI kit, platform services and tooling are ported from the sibling project `E:\Roguelike Opus 55` (Dawnbound).

**Tech Stack:** Phaser 3.90, TypeScript 5.9 (strict), Vite 7, Vitest 3, Capacitor 8 (plugins only; the Android project is added in a later plan), Python 3 + Pillow for asset packing, Playwright (`playwright-core` + Edge) for browser smoke tests.

**Spec:** `docs/superpowers/specs/2026-10-03-tidewake-design.md` (this plan implements phases 0 and 1 of section 11).

## Scope of this plan

The spec has eight phases. Each later phase builds on real code from the earlier ones, so each gets its own plan, written after the previous phase ships:

| Plan | Spec phase | Delivers |
|---|---|---|
| **1 (this plan)** | 0 + 1 | Toolchain, tested logic, asset pipeline, shell scenes, walkable island, harvesting, day/night, save/continue |
| 2 | 2 | Vitals, inventory, hotbar, crafting, building, farming |
| 3 | 3 | Combat, enemies, animals, loot, music |
| 4 | 4 | Dungeons, puzzles, three bosses |
| 5 | 5 | NPCs, dialogue, main quest and side quests, endings |
| 6 | 6 | Branding, onboarding, full menus (New Game / Settings / About), audio, polish of EN/ID |
| 7 | 7 | Balance, QA, performance, Android build |

Intentionally deferred from this plan: onboarding and language picker, Settings and About screens, the New Game options screen (slot, name, seed, difficulty), real inventory, audio assets, NPC huts and dungeons (landmarks only get stand-in scenery now).

## Global Constraints

- Phaser `^3.90.0`, TypeScript `5.9`, Vite `^7.3.6`, Vitest `^3.2.7`, Capacitor `^8.5.2` plugins; Node 22 or newer.
- Android package id `com.fajar.tidewake`; app name `Tidewake: Island Survival`.
- Portrait 9:16 to 9:21; 16x16 pixel tiles; the world camera zooms 2x (`worldZoom(2)`); the canvas renders at the device's integer scale (`view.res`) and all layout uses virtual pixels (`view.w`, `view.h`).
- World is 160 x 160 tiles (`WORLD_SIZE`) and always regenerated from a seed; saves store `seed` plus a diff, never the tiles.
- Languages: English and Bahasa Indonesia. Every UI string lives in `src/data/strings.ts` with both languages and matching `{placeholders}`.
- No ads, no in-app purchases, no cloud save in v1.
- `src/sim/` and `src/data/` never import Phaser; `src/sim/` functions never mutate their arguments.
- Files stay under 400 lines (hard limit 800); functions under 50 lines.
- Coverage of `src/sim/**`, `src/data/**` and the testable `src/core/` files is at least 80% lines, enforced by `npm run test:cov`.
- The Unity pack at `E:\Pixel Games Asset Master` is read-only: never modify, move or delete anything there. Tools only read from it.
- API keys (`E:\Game Dev Tools.txt`) are never copied into the repo, code, docs or commit messages.
- Commits use `<type>: <description>` (feat, fix, refactor, docs, test, chore, perf, ci) and carry no attribution trailer (the user disabled attribution globally). Commit locally only; never push.
- Credit *Super Retro Collection by Gif* and the SIL OFL fonts (Jersey, Tiny5) in the About screen when it is built (plan 6).

## Review Focus

Inputs and conditions the spec implies but that are easy to miss; each has a test or a scripted scenario in the task that owns it.

1. **Corrupt, hand-edited or too-new save data** (bad JSON, negative amounts, `version` from a future build): `Continue` must never crash; it falls back to the backup copy, then to the Menu. Tests: Task 7. Scenario: `corrupt.json` in Task 15.
2. **Extreme or odd seeds** (0, 2^31, 4294967295, negative, fractional): the island is still valid and fully reachable. Test: Task 3.
3. **New Game when all three slots are used**: asks before overwriting and overwrites only the least recently played slot. Tests: Task 7. Behavior: `MenuScene.newGame` in Task 12.
4. **Hero ends up inside something solid** (a node regrows under the hero, a save from a buggy build): the hero can always walk out, and regrowth is postponed while the hero stands close. Tests: Tasks 4 and 6.
5. **App backgrounded, back button pressed or pause dialog open**: progress is saved on `hidden`, the island freezes while paused and does not tick time. Scenario: `pause.json` in Task 15.

---

## File Structure

```
package.json  tsconfig.json  vite.config.ts  index.html  capacitor.config.ts  .gitignore  README.md
public/assets/fonts/*            copied bitmap fonts (OFL), from Dawnbound
public/assets/pack/*             generated: heroes/actors/props atlases + tiles.png (committed)
tools/pack_assets.py             copies sprites from the Unity pack into atlases
tools/pack_tiles.py              builds tiles.png + src/data/tileIndex.ts
tools/play.mjs                   headless Edge driver for smoke tests
tools/scripts/*.json             smoke scenarios
src/core/    rng, save, settings, i18n, viewport, services, platform, audio
src/data/    strings, resources, terrainTiles, tileIndex (generated), landmarkProps
src/sim/     world/{types,noise,terrain,landmarks,resources,generate}, gather, daynight, movement, solids, interact, tileView
src/gfx/     animations, TerrainLayer, WorldObjects
src/entities/ Player
src/game/    input
src/ui/      theme, skin, widgets, modal, Joystick
src/scenes/  BaseScene, Boot, Preload, Splash, Menu, Notify, Game, Hud, index
src/main.ts
tests/       one test file per module group (see tasks)
```

## Pre-flight

Run once before Task 1. Expected: every line prints a version or `True`.

```bash
node -v && npm -v && python --version && python -c "import PIL; print('Pillow', PIL.__version__)" && git --version
test -d "E:/Pixel Games Asset Master/Assets/Gif/Super_Retro_Collection/Resources" && echo "Unity pack: True"
test -d "E:/Roguelike Opus 55/src" && echo "Dawnbound sources: True"
```

Edge is needed for `tools/play.mjs`. `where msedge` (or `Get-Command msedge`) should find it; on Windows 10 it ships with the OS.

---

### Task 1: Scaffold the project and port the seeded RNG

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `capacitor.config.ts`, `.gitignore`
- Create: `src/core/rng.ts`
- Test: `tests/rng.test.ts`

**Interfaces:**
- Produces: `Rng` class (`next()`, `int(min,max)`, `float(min,max)`, `chance(p)`, `pick(arr)`, `weighted(entries)`, `shuffle(arr)`, `sample(arr,n)`, `fork(label)`, static `seedFromTime()`), `hashString(str)`, `seedToCode(seed)`, `codeToSeed(code)`.

- [ ] **Step 1: Initialise git and commit the existing docs**

```bash
cd "E:/RPG Survival Sprite Sonnet 55"
git init -b main
git add docs
git commit -m "docs: add Tidewake design spec and foundation plan"
```

Expected: a commit containing only `docs/`.

- [ ] **Step 2: Write the project configuration files**

`package.json`:

```json
{
  "name": "tidewake",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview --host",
    "test": "vitest run",
    "test:cov": "vitest run --coverage",
    "typecheck": "tsc --noEmit",
    "assets": "python tools/pack_assets.py && python tools/pack_tiles.py",
    "play": "node tools/play.mjs"
  },
  "dependencies": {
    "@capacitor-community/in-app-review": "^8.0.0",
    "@capacitor/app": "^8.1.1",
    "@capacitor/core": "^8.5.2",
    "@capacitor/haptics": "^8.0.2",
    "@capacitor/preferences": "^8.0.1",
    "@capacitor/screen-orientation": "^8.0.1",
    "@capacitor/share": "^8.0.2",
    "@capacitor/splash-screen": "^8.0.2",
    "@capacitor/status-bar": "^8.0.3",
    "phaser": "^3.90.0"
  },
  "devDependencies": {
    "@capacitor/cli": "^8.5.2",
    "@types/node": "^22.20.5",
    "@vitest/coverage-v8": "^3.2.7",
    "playwright-core": "^1.63.0",
    "typescript": "5.9",
    "vite": "^7.3.6",
    "vitest": "^3.2.7"
  },
  "allowScripts": {
    "esbuild@0.28.2": true
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "types": ["vite/client", "node"],
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "tests"]
}
```

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
  server: { port: 5188 },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/sim/**', 'src/data/**', 'src/core/rng.ts', 'src/core/save.ts', 'src/core/settings.ts', 'src/core/i18n.ts', 'src/core/viewport.ts'],
      exclude: ['src/data/tileIndex.ts'],
      reporter: ['text'],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 70 },
    },
  },
} as never);
```

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <meta name="theme-color" content="#0b0a14" />
    <link rel="icon" href="data:," />
    <title>Tidewake</title>
    <style>
      html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #0b0a14; overflow: hidden;
        touch-action: none; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
      #game { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; }
      #game canvas { image-rendering: pixelated; image-rendering: crisp-edges; display: block; }
    </style>
  </head>
  <body>
    <div id="game"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`capacitor.config.ts`:

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fajar.tidewake',
  appName: 'Tidewake: Island Survival',
  webDir: 'dist',
  android: { backgroundColor: '#0b0a14', allowMixedContent: false },
  plugins: {
    SplashScreen: { launchShowDuration: 600, backgroundColor: '#0b0a14', showSpinner: false, launchFadeOutDuration: 250 },
  },
};

export default config;
```

`.gitignore`:

```
node_modules
dist
dist-qa
coverage
tools/.cache
android/build
android/app/build
android/.gradle
*.log
.env
.env.*
```

- [ ] **Step 3: Install dependencies**

Run: `npm install`
Expected: completes without errors (npm may print `allow-scripts` notices for esbuild; that is fine). Then `npx vitest --version` prints `3.2.x` and `npx tsc --version` prints `Version 5.9.x`.

- [ ] **Step 4: Write the failing RNG test**

`tests/rng.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { Rng, codeToSeed, hashString, seedToCode } from '@/core/rng';

describe('Rng', () => {
  it('produces the same sequence for the same seed and differs between seeds', () => {
    const a = new Rng(5);
    const b = new Rng(5);
    for (let i = 0; i < 20; i++) expect(a.next()).toBe(b.next());
    expect(new Rng(5).next()).not.toBe(new Rng(6).next());
    expect(new Rng('island').next()).toBe(new Rng('island').next());
  });

  it('keeps next() in [0, 1) and int()/float() in range', () => {
    const r = new Rng(9);
    for (let i = 0; i < 500; i++) {
      const n = r.next();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
      const k = r.int(3, 7);
      expect(k).toBeGreaterThanOrEqual(3);
      expect(k).toBeLessThanOrEqual(7);
      const f = r.float(-2, 2);
      expect(f).toBeGreaterThanOrEqual(-2);
      expect(f).toBeLessThan(2);
    }
  });

  it('hits every value of a small int range', () => {
    const r = new Rng(1);
    const seen = new Set<number>();
    for (let i = 0; i < 300; i++) seen.add(r.int(1, 4));
    expect([...seen].sort()).toEqual([1, 2, 3, 4]);
  });

  it('picks, shuffles and samples without losing elements', () => {
    const r = new Rng(2);
    const arr = [1, 2, 3, 4, 5, 6];
    expect(arr).toContain(r.pick(arr));
    expect(r.shuffle(arr).sort()).toEqual(arr);
    expect(arr).toEqual([1, 2, 3, 4, 5, 6]);
    expect(new Set(r.sample(arr, 4)).size).toBe(4);
    expect(r.sample(arr, 99)).toHaveLength(6);
    expect(() => r.pick([])).toThrow();
  });

  it('respects weights and rejects empty ones', () => {
    const r = new Rng(3);
    let a = 0;
    for (let i = 0; i < 1000; i++) if (r.weighted([['a', 9], ['b', 1]]) === 'a') a++;
    expect(a).toBeGreaterThan(800);
    expect(r.weighted([['x', 0], ['y', 5]])).toBe('y');
    expect(() => r.weighted([['x', 0]])).toThrow();
  });

  it('forks independent but deterministic child streams', () => {
    const a = new Rng(11).fork('terrain');
    const b = new Rng(11).fork('terrain');
    expect(a.next()).toBe(b.next());
    expect(new Rng(11).fork('terrain').next()).not.toBe(new Rng(11).fork('landmarks').next());
  });
});

describe('seed codes', () => {
  it('round-trips seeds through readable codes', () => {
    for (const seed of [0, 1, 4242, 123456789, 4294967295]) expect(codeToSeed(seedToCode(seed))).toBe(seed);
    expect(seedToCode(4242)).toHaveLength(7);
  });

  it('ignores case and punctuation when reading a code', () => {
    const code = seedToCode(98765);
    expect(codeToSeed(code.toLowerCase())).toBe(98765);
    expect(codeToSeed(`${code.slice(0, 3)}-${code.slice(3)}`)).toBe(98765);
  });

  it('hashes strings stably', () => {
    expect(hashString('tidewake')).toBe(hashString('tidewake'));
    expect(hashString('a')).not.toBe(hashString('b'));
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npx vitest run tests/rng.test.ts`
Expected: FAIL, "Failed to resolve import "@/core/rng"".

- [ ] **Step 6: Port the RNG from Dawnbound**

Create `src/core/rng.ts` with exactly this content (it is Dawnbound's tested RNG, unchanged):

`src/core/rng.ts`:

```typescript
/** Deterministic, seedable RNG (sfc32) so runs can be replayed from a seed (daily runs, shared seeds). */

export function hashString(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: number | string) {
    const s = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
    this.a = s ^ 0x9e3779b9;
    this.b = s ^ 0x243f6a88;
    this.c = s ^ 0xb7e15162;
    this.d = s;
    for (let i = 0; i < 12; i++) this.next();
  }

  /** Float in [0, 1). */
  next(): number {
    this.a >>>= 0; this.b >>>= 0; this.c >>>= 0; this.d >>>= 0;
    let t = (this.a + this.b) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0;
    t = (t + this.d) | 0;
    this.c = (this.c + t) | 0;
    return (t >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('Rng.pick on empty array');
    return arr[Math.floor(this.next() * arr.length)];
  }

  weighted<T>(entries: readonly (readonly [T, number])[]): T {
    const total = entries.reduce((s, [, w]) => s + Math.max(0, w), 0);
    if (total <= 0) throw new Error('Rng.weighted with no positive weights');
    let roll = this.next() * total;
    for (const [value, w] of entries) {
      roll -= Math.max(0, w);
      if (roll < 0) return value;
    }
    return entries[entries.length - 1][0];
  }

  shuffle<T>(arr: readonly T[]): T[] {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /** Pick n distinct elements. */
  sample<T>(arr: readonly T[], n: number): T[] {
    return this.shuffle(arr).slice(0, Math.min(n, arr.length));
  }

  /** Derive an independent child stream (e.g. per floor / per room) so generation order doesn't leak across systems. */
  fork(label: string): Rng {
    return new Rng(hashString(label + ':' + Math.floor(this.next() * 4294967296)));
  }

  static seedFromTime(): number {
    return (Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0;
  }
}

export function seedToCode(seed: number): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let n = seed >>> 0;
  let s = '';
  for (let i = 0; i < 7; i++) {
    s += alphabet[n % alphabet.length];
    n = Math.floor(n / alphabet.length);
  }
  return s;
}

export function codeToSeed(code: string): number {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  let n = 0;
  for (let i = clean.length - 1; i >= 0; i--) {
    const idx = alphabet.indexOf(clean[i]);
    n = n * alphabet.length + (idx < 0 ? 0 : idx);
  }
  return n >>> 0;
}
```

- [ ] **Step 7: Run the test and the typecheck**

Run: `npx vitest run tests/rng.test.ts && npm run typecheck`
Expected: 9 tests PASS; typecheck exits 0.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html capacitor.config.ts .gitignore src/core/rng.ts tests/rng.test.ts
git commit -m "chore: scaffold Tidewake toolchain and port seeded RNG"
```

---

### Task 2: World types, noise and terrain generation

**Files:**
- Create: `src/sim/world/types.ts`, `src/sim/world/noise.ts`, `src/sim/world/terrain.ts`
- Test: `tests/terrain.test.ts`

**Interfaces:**
- Consumes: `Rng` (`@/core/rng`).
- Produces: from `types.ts`: `WORLD_SIZE = 160`, `T` (terrain ids DEEP..RIVER), `B` (biome ids SEA..DESERT), `Terrain`, `Biome`, `isWater(t)`, `isWalkable(t)`, `idx(x,y,size?)`, `inBounds(x,y,size?)`, `LandmarkId`, `Landmark`, `ResourceKind`, `ResourceNode {id,kind,x,y,variant}`, `World {seed,size,terrain,biome,landmarks,resources,start}`. From `noise.ts`: `valueNoise(seed,x,y)`, `fbm(seed,x,y,scale,octaves?)`. From `terrain.ts`: `generateTerrain(seed,size?) -> { terrain: Uint8Array, biome: Uint8Array, height: Float32Array }`.

- [ ] **Step 1: Write the failing terrain test**

`tests/terrain.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { generateTerrain } from '@/sim/world/terrain';
import { B, T, WORLD_SIZE, idx, inBounds, isWater } from '@/sim/world/types';

describe('generateTerrain', () => {
  it('is deterministic for a seed', () => {
    const a = generateTerrain(77);
    const b = generateTerrain(77);
    expect(Array.from(a.terrain)).toEqual(Array.from(b.terrain));
    expect(Array.from(a.biome)).toEqual(Array.from(b.biome));
  });

  it('leaves the whole map border as deep water', () => {
    for (const seed of [1, 2, 3]) {
      const { terrain } = generateTerrain(seed);
      for (let i = 0; i < WORLD_SIZE; i++) {
        expect(terrain[idx(i, 0)]).toBe(T.DEEP);
        expect(terrain[idx(i, WORLD_SIZE - 1)]).toBe(T.DEEP);
        expect(terrain[idx(0, i)]).toBe(T.DEEP);
        expect(terrain[idx(WORLD_SIZE - 1, i)]).toBe(T.DEEP);
      }
    }
  });

  it('makes one connected island of a sensible size (rivers can be crossed)', () => {
    const isSea = (t: number): boolean => t === T.DEEP || t === T.SHALLOW;
    for (const seed of [4, 5, 6]) {
      const { terrain } = generateTerrain(seed);
      let land = 0;
      let first = -1;
      for (let i = 0; i < terrain.length; i++) {
        if (!isSea(terrain[i])) {
          land++;
          if (first < 0) first = i;
        }
      }
      expect(land).toBeGreaterThan(WORLD_SIZE * WORLD_SIZE * 0.3);
      expect(land).toBeLessThan(WORLD_SIZE * WORLD_SIZE * 0.65);
      const seen = new Set<number>([first]);
      const stack = [first];
      while (stack.length) {
        const c = stack.pop()!;
        const x = c % WORLD_SIZE;
        const y = (c - x) / WORLD_SIZE;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (!inBounds(x + dx, y + dy)) continue;
          const n = idx(x + dx, y + dy);
          if (!seen.has(n) && !isSea(terrain[n])) {
            seen.add(n);
            stack.push(n);
          }
        }
      }
      expect(seen.size).toBe(land);
    }
  });

  it('gives every land tile a biome and water none', () => {
    const { terrain, biome } = generateTerrain(8);
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === T.DEEP || terrain[i] === T.SHALLOW) expect(biome[i]).toBe(B.SEA);
      else expect(biome[i]).not.toBe(B.SEA);
    }
  });

  it('draws each biome with its own ground', () => {
    const { terrain, biome } = generateTerrain(9);
    const grounds = new Map<number, Set<number>>();
    for (let i = 0; i < terrain.length; i++) {
      if (isWater(terrain[i])) continue;
      if (!grounds.has(biome[i])) grounds.set(biome[i], new Set());
      grounds.get(biome[i])!.add(terrain[i]);
    }
    expect(grounds.get(B.FOREST)!.has(T.GRASS)).toBe(true);
    expect(grounds.get(B.SWAMP)!.has(T.SWAMP)).toBe(true);
    expect(grounds.get(B.DESERT)!.has(T.DESERT)).toBe(true);
    expect(grounds.get(B.MOUNTAIN)!.has(T.DIRT) || grounds.get(B.MOUNTAIN)!.has(T.STONE)).toBe(true);
    expect(grounds.get(B.FOREST)!.has(T.SWAMP)).toBe(false);
  });

  it('carves rivers on most islands', () => {
    let withRiver = 0;
    for (let seed = 1; seed <= 10; seed++) {
      if (generateTerrain(seed).terrain.some((t) => t === T.RIVER)) withRiver++;
    }
    expect(withRiver).toBeGreaterThanOrEqual(8);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/terrain.test.ts`
Expected: FAIL, "Failed to resolve import "@/sim/world/terrain"".

- [ ] **Step 3: Write the world types**

`src/sim/world/types.ts`:

```typescript
export const WORLD_SIZE = 160;

export const T = { DEEP: 0, SHALLOW: 1, SAND: 2, GRASS: 3, SWAMP: 4, DIRT: 5, STONE: 6, DESERT: 7, RIVER: 8 } as const;
export type Terrain = (typeof T)[keyof typeof T];

export const B = { SEA: 0, FOREST: 1, MOUNTAIN: 2, SWAMP: 3, DESERT: 4 } as const;
export type Biome = (typeof B)[keyof typeof B];

export const isWater = (t: number): boolean => t === T.DEEP || t === T.SHALLOW || t === T.RIVER;
/** The player can wade through shallow water and rivers; only deep water blocks. */
export const isWalkable = (t: number): boolean => t !== T.DEEP;

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

- [ ] **Step 4: Write the noise module**

`src/sim/world/noise.ts`:

```typescript
/** Seeded 2D value noise + fractal Brownian motion. Pure and deterministic. */
function hash2(seed: number, x: number, y: number): number {
  let h = (seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

export function valueNoise(seed: number, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const a = hash2(seed, x0, y0);
  const b = hash2(seed, x0 + 1, y0);
  const c = hash2(seed, x0, y0 + 1);
  const d = hash2(seed, x0 + 1, y0 + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** Fractal noise in [0, 1). `scale` is the wavelength of the first octave in tiles. */
export function fbm(seed: number, x: number, y: number, scale: number, octaves = 4): number {
  let amp = 1;
  let freq = 1 / scale;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(seed + o * 101, x * freq, y * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}
```

- [ ] **Step 5: Write the terrain generator**

The island is a radial falloff plus fractal noise; four biome anchors are placed around the centre (forest in the south where the hero starts, mountain in the middle, swamp and desert on opposite sides, side chosen by the seed); a noise-warped nearest-anchor rule gives organic biome borders; rivers run from the mountain to the sea.

`src/sim/world/terrain.ts`:

```typescript
import { Rng } from '@/core/rng';
import { fbm } from './noise';
import { B, T, WORLD_SIZE, idx, inBounds, isWater } from './types';

const isSea = (t: number): boolean => t === T.DEEP || t === T.SHALLOW;

export interface TerrainResult {
  terrain: Uint8Array;
  biome: Uint8Array;
  height: Float32Array;
}

const R = 68;
const SEA_LEVEL = 0.3;
const SHALLOW_LEVEL = 0.22;
const SAND_LEVEL = 0.36;
const STONE_LEVEL = 0.56;
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Keep the largest 4-connected land component; every other bit of land becomes water. */
function keepLargestLand(terrain: Uint8Array, height: Float32Array, size: number): void {
  const label = new Int32Array(size * size).fill(-1);
  const sizes: number[] = [];
  for (let s = 0; s < size * size; s++) {
    if (label[s] !== -1 || isWater(terrain[s])) continue;
    const id = sizes.length;
    let count = 0;
    const stack = [s];
    label[s] = id;
    while (stack.length) {
      const c = stack.pop()!;
      count++;
      const x = c % size;
      const y = (c - x) / size;
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny, size)) continue;
        const n = idx(nx, ny, size);
        if (label[n] === -1 && !isWater(terrain[n])) {
          label[n] = id;
          stack.push(n);
        }
      }
    }
    sizes.push(count);
  }
  const best = sizes.indexOf(Math.max(...sizes));
  for (let i = 0; i < size * size; i++) {
    if (!isWater(terrain[i]) && label[i] !== best) terrain[i] = height[i] > SHALLOW_LEVEL ? T.SHALLOW : T.DEEP;
  }
}

interface Anchor {
  biome: number;
  x: number;
  y: number;
  weight: number;
}

/** Move a wanted anchor point toward the island centre until it sits on land. */
function landAnchor(terrain: Uint8Array, size: number, x: number, y: number): { x: number; y: number } {
  const c = size / 2;
  let px = x;
  let py = y;
  for (let i = 0; i < 120; i++) {
    const ix = Math.round(px);
    const iy = Math.round(py);
    if (inBounds(ix, iy, size) && !isWater(terrain[idx(ix, iy, size)])) return { x: ix, y: iy };
    px += Math.sign(c - px) * 1;
    py += Math.sign(c - py) * 1;
  }
  return { x: Math.round(c), y: Math.round(c) };
}

export function generateTerrain(seed: number, size = WORLD_SIZE): TerrainResult {
  const rng = new Rng(seed).fork('terrain');
  const c = size / 2;
  const terrain = new Uint8Array(size * size);
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c) / R;
      const n = fbm(seed, x, y, 38, 4);
      const h = 0.62 * (1 - Math.pow(Math.min(d, 1.4), 1.6)) + 0.38 * n;
      height[idx(x, y, size)] = h;
      terrain[idx(x, y, size)] = h > SEA_LEVEL ? T.GRASS : h > SHALLOW_LEVEL ? T.SHALLOW : T.DEEP;
    }
  }
  keepLargestLand(terrain, height, size);

  const west = rng.chance(0.5) ? -1 : 1;
  const jit = () => rng.float(-5, 5);
  const raw: [number, number, number, number][] = [
    [B.FOREST, c + jit(), c + 0.42 * R + jit(), 1.2],
    [B.MOUNTAIN, c + west * 0.05 * R + jit(), c - 0.12 * R + jit(), 0.95],
    [B.SWAMP, c + west * 0.5 * R + jit(), c + 0.12 * R + jit(), 1.0],
    [B.DESERT, c - west * 0.42 * R + jit(), c - 0.4 * R + jit(), 1.0],
  ];
  const anchors: Anchor[] = raw.map(([biome, x, y, weight]) => ({ biome, weight, ...landAnchor(terrain, size, x, y) }));

  const biome = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = idx(x, y, size);
      if (isWater(terrain[i])) continue;
      const wx = x + (fbm(seed + 7, x, y, 16, 3) - 0.5) * 44;
      const wy = y + (fbm(seed + 13, x, y, 16, 3) - 0.5) * 44;
      let best: number = B.FOREST;
      let bestScore = Infinity;
      for (const a of anchors) {
        const s = Math.hypot(wx - a.x, wy - a.y) / a.weight;
        if (s < bestScore) {
          bestScore = s;
          best = a.biome;
        }
      }
      biome[i] = best;
      const h = height[i];
      if (h < SAND_LEVEL) terrain[i] = T.SAND;
      else if (best === B.SWAMP) terrain[i] = T.SWAMP;
      else if (best === B.DESERT) terrain[i] = T.DESERT;
      else if (best === B.MOUNTAIN) terrain[i] = h > STONE_LEVEL ? T.STONE : T.DIRT;
      else terrain[i] = T.GRASS;
    }
  }
  carveRivers(terrain, anchors.find((a) => a.biome === B.MOUNTAIN)!, size, rng);
  return { terrain, biome, height };
}

/** Walk from the mountain toward the sea in two well-separated directions, wading two tiles wide. */
function carveRivers(terrain: Uint8Array, from: Anchor, size: number, rng: Rng): void {
  const dists: { ang: number; dist: number }[] = [];
  for (let k = 0; k < 16; k++) {
    const ang = (k / 16) * Math.PI * 2;
    let dist = 0;
    for (; dist < size; dist++) {
      const x = Math.round(from.x + Math.cos(ang) * dist);
      const y = Math.round(from.y + Math.sin(ang) * dist);
      if (!inBounds(x, y, size) || isSea(terrain[idx(x, y, size)])) break;
    }
    dists.push({ ang, dist });
  }
  dists.sort((a, b) => a.dist - b.dist);
  const first = dists[0];
  const second = dists.find((d) => Math.abs(Math.atan2(Math.sin(d.ang - first.ang), Math.cos(d.ang - first.ang))) > Math.PI / 2);
  for (const dir of [first, second]) {
    if (!dir) continue;
    let x = from.x;
    let y = from.y;
    let ang = dir.ang;
    for (let step = 0; step < size; step++) {
      ang += rng.float(-0.35, 0.35);
      x += Math.cos(ang);
      y += Math.sin(ang);
      const ix = Math.round(x);
      const iy = Math.round(y);
      if (!inBounds(ix, iy, size) || isSea(terrain[idx(ix, iy, size)])) break;
      for (const [ox, oy] of [[0, 0], [1, 0], [0, 1]]) {
        const ti = idx(ix + ox, iy + oy, size);
        if (inBounds(ix + ox, iy + oy, size) && !isSea(terrain[ti])) terrain[ti] = T.RIVER;
      }
    }
  }
}
```

- [ ] **Step 6: Run the tests and typecheck**

Run: `npx vitest run tests/terrain.test.ts && npm run typecheck`
Expected: 6 tests PASS; typecheck exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/sim/world tests/terrain.test.ts
git commit -m "feat: add seeded island terrain and biome generation"
```

---

### Task 3: Landmarks, resource scatter and the validated island

**Files:**
- Create: `src/sim/world/landmarks.ts`, `src/sim/world/resources.ts`, `src/sim/world/generate.ts`
- Test: `tests/world.test.ts`

**Interfaces:**
- Consumes: `generateTerrain`, `Rng`, world types (Task 2).
- Produces: `placeLandmarks(terrain,biome,size,rng) -> Landmark[] | null`, `RESERVE_RADIUS: Record<LandmarkId, number>` (clearing radius around each landmark), `scatterResources(terrain,biome,landmarks,size,rng) -> ResourceNode[]` (ids are `0..n-1`, equal to the array index), `reachable(terrain,size,from) -> Uint8Array`, `validateWorld(world) -> string[]` (empty means playable), `generateWorld(seed,size?) -> World` (deterministic; re-rolls internally up to 24 times; throws if none valid).

- [ ] **Step 1: Write the failing world test**

`tests/world.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { fbm, valueNoise } from '@/sim/world/noise';
import { generateWorld, reachable, validateWorld } from '@/sim/world/generate';
import { RESERVE_RADIUS } from '@/sim/world/landmarks';
import { B, T, WORLD_SIZE, idx, isWater, type World } from '@/sim/world/types';

describe('noise', () => {
  it('is deterministic and stays in [0, 1)', () => {
    for (let i = 0; i < 200; i++) {
      const a = fbm(42, i * 1.7, i * 0.9, 38, 4);
      expect(a).toBe(fbm(42, i * 1.7, i * 0.9, 38, 4));
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(1);
    }
    expect(valueNoise(1, 3.2, 4.1)).not.toBe(valueNoise(2, 3.2, 4.1));
  });
});

describe('generateWorld', () => {
  it('returns the same island for the same seed', () => {
    const a = generateWorld(1234);
    const b = generateWorld(1234);
    expect(Array.from(a.terrain)).toEqual(Array.from(b.terrain));
    expect(a.landmarks).toEqual(b.landmarks);
    expect(a.resources).toEqual(b.resources);
  });

  it('differs between seeds', () => {
    expect(Array.from(generateWorld(1).terrain)).not.toEqual(Array.from(generateWorld(2).terrain));
  });

  it('produces a valid, fully reachable island for many seeds', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const w = generateWorld(seed);
      expect(validateWorld(w), `seed ${seed}`).toEqual([]);
    }
  }, 60_000);

  it('copes with extreme seeds (0, the largest 32-bit value, negative and fractional input)', () => {
    for (const seed of [0, 1, 2 ** 31, 4294967295, -5, 12.7]) {
      const w = generateWorld(seed);
      expect(validateWorld(w), `seed ${seed}`).toEqual([]);
    }
  }, 30_000);

  it('places every story landmark exactly once', () => {
    const w = generateWorld(7);
    const ids = w.landmarks.map((l) => l.id);
    expect(new Set(ids).size).toBe(13);
    for (const id of ['start', 'camp', 'sailor', 'herbalist', 'miner', 'grotto', 'deepmine', 'ruin', 'lighthouse', 'tablets', 'treasure1', 'treasure2', 'treasure3']) {
      expect(ids).toContain(id);
    }
  });

  it('puts the start on a southern beach and the lighthouse on the north cape', () => {
    for (const seed of [3, 11, 99]) {
      const w = generateWorld(seed);
      expect(w.terrain[idx(w.start.x, w.start.y)]).toBe(T.SAND);
      expect(w.start.y).toBeGreaterThan(WORLD_SIZE * 0.6);
      const light = w.landmarks.find((l) => l.id === 'lighthouse')!;
      expect(light.y).toBeLessThan(WORLD_SIZE * 0.35);
    }
  });

  it('places dungeons and NPC huts in the biomes the story expects', () => {
    const w = generateWorld(21);
    const biomeOf = (id: string) => w.landmarks.find((l) => l.id === id)!.biome;
    expect(biomeOf('grotto')).toBe(B.FOREST);
    expect(biomeOf('deepmine')).toBe(B.MOUNTAIN);
    expect(biomeOf('herbalist')).toBe(B.SWAMP);
    expect(biomeOf('ruin')).toBe(B.DESERT);
  });

  it('has all four biomes with real land area', () => {
    const w = generateWorld(5);
    for (const b of [B.FOREST, B.MOUNTAIN, B.SWAMP, B.DESERT]) {
      let n = 0;
      for (let i = 0; i < w.biome.length; i++) if (w.biome[i] === b && !isWater(w.terrain[i])) n++;
      expect(n).toBeGreaterThan(400);
    }
  });

  it('scatters plenty of resources, never in water, on landmarks or stacked', () => {
    const w = generateWorld(8);
    expect(w.resources.length).toBeGreaterThan(400);
    const seen = new Set<number>();
    for (const r of w.resources) {
      expect(isWater(w.terrain[idx(r.x, r.y)])).toBe(false);
      expect(seen.has(idx(r.x, r.y))).toBe(false);
      seen.add(idx(r.x, r.y));
      for (const l of w.landmarks) {
        const rad = RESERVE_RADIUS[l.id];
        expect(Math.abs(r.x - l.x) <= rad && Math.abs(r.y - l.y) <= rad, `${r.kind}@${r.x},${r.y} inside ${l.id}`).toBe(false);
      }
    }
  });

  it('does not let resource nodes touch each other', () => {
    const w = generateWorld(8);
    const at = new Set(w.resources.map((r) => idx(r.x, r.y)));
    for (const r of w.resources) {
      for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) expect(at.has(idx(r.x + dx, r.y + dy))).toBe(false);
    }
  });
});

describe('validateWorld', () => {
  const clone = (w: World): World => ({ ...w, terrain: w.terrain.slice(), landmarks: w.landmarks.map((l) => ({ ...l })) });

  it('reports a landmark sunk into deep water', () => {
    const w = clone(generateWorld(9));
    const l = w.landmarks.find((x) => x.id === 'sailor')!;
    w.terrain[idx(l.x, l.y)] = T.DEEP;
    expect(validateWorld(w)).toContain('sailor is in water');
  });

  it('reports a landmark cut off by deep water', () => {
    const w = clone(generateWorld(9));
    const l = w.landmarks.find((x) => x.id === 'ruin')!;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === 3) w.terrain[idx(l.x + dx, l.y + dy)] = T.DEEP;
      }
    }
    expect(validateWorld(w)).toContain('ruin is unreachable');
  });

  it('reachable() never crosses deep water', () => {
    const w = generateWorld(4);
    const seen = reachable(w.terrain, w.size, w.start);
    for (let i = 0; i < seen.length; i++) if (seen[i]) expect(w.terrain[i]).not.toBe(T.DEEP);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/world.test.ts`
Expected: FAIL, "Failed to resolve import "@/sim/world/generate"".

- [ ] **Step 3: Write the landmark placement**

Thirteen landmarks are placed in a fixed order (start beach, lighthouse on the north cape, then camp, sailor, grotto, deepmine, miner, herbalist, ruin, tablets and three treasure spots) with biome, distance and spacing rules. If a rule cannot be met it relaxes once, then gives up (the caller re-rolls).

`src/sim/world/landmarks.ts`:

```typescript
import type { Rng } from '@/core/rng';
import { B, T, idx, inBounds, isWater, type Biome, type Landmark, type LandmarkId } from './types';

interface SpotSpec {
  id: LandmarkId;
  biome: Biome;
  /** Half-size of the footprint that must be dry land (footprint is (2*half+1)^2 tiles). */
  half: number;
  minStart?: number;
  maxStart?: number;
  near?: { id: LandmarkId; min: number; max: number };
  spacing?: number;
}

/** Placement order matters: later landmarks are positioned relative to earlier ones. */
const SPECS: SpotSpec[] = [
  { id: 'camp', biome: B.FOREST, half: 2, minStart: 6, maxStart: 14, spacing: 6 },
  { id: 'sailor', biome: B.FOREST, half: 1, minStart: 14, maxStart: 30, spacing: 10 },
  { id: 'grotto', biome: B.FOREST, half: 2, minStart: 30, maxStart: 64, spacing: 16 },
  { id: 'deepmine', biome: B.MOUNTAIN, half: 2, spacing: 16 },
  { id: 'miner', biome: B.MOUNTAIN, half: 1, near: { id: 'deepmine', min: 6, max: 16 }, spacing: 8 },
  { id: 'herbalist', biome: B.SWAMP, half: 1, spacing: 12 },
  { id: 'ruin', biome: B.DESERT, half: 2, spacing: 16 },
  { id: 'tablets', biome: B.DESERT, half: 1, near: { id: 'ruin', min: 8, max: 26 }, spacing: 8 },
  { id: 'treasure1', biome: B.FOREST, half: 0, minStart: 10, maxStart: 60, spacing: 12 },
  { id: 'treasure2', biome: B.FOREST, half: 0, minStart: 10, maxStart: 60, spacing: 12 },
  { id: 'treasure3', biome: B.FOREST, half: 0, minStart: 10, maxStart: 60, spacing: 12 },
];

export const RESERVE_RADIUS: Record<LandmarkId, number> = {
  start: 6, camp: 5, sailor: 4, herbalist: 4, miner: 4, grotto: 4, deepmine: 4, ruin: 4,
  lighthouse: 4, tablets: 3, treasure1: 1, treasure2: 1, treasure3: 1,
};

const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by);

function footprintIsLand(terrain: Uint8Array, size: number, x: number, y: number, half: number): boolean {
  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      if (!inBounds(x + dx, y + dy, size)) return false;
      if (isWater(terrain[idx(x + dx, y + dy, size)])) return false;
    }
  }
  return true;
}

function findSpot(
  terrain: Uint8Array, biome: Uint8Array, size: number, placed: Landmark[], spec: SpotSpec, rng: Rng, relax: number,
): { x: number; y: number } | null {
  const start = placed.find((l) => l.id === 'start')!;
  const near = spec.near ? placed.find((l) => l.id === spec.near!.id) : undefined;
  const spacing = (spec.spacing ?? 8) * relax;
  const candidates: { x: number; y: number }[] = [];
  for (let y = 4; y < size - 4; y++) {
    for (let x = 4; x < size - 4; x++) {
      if (biome[idx(x, y, size)] !== spec.biome) continue;
      if (!footprintIsLand(terrain, size, x, y, spec.half)) continue;
      const d = dist(x, y, start.x, start.y);
      if (spec.minStart !== undefined && d < spec.minStart * relax) continue;
      if (spec.maxStart !== undefined && d > spec.maxStart / relax) continue;
      if (near) {
        const dn = dist(x, y, near.x, near.y);
        if (dn < spec.near!.min * relax || dn > spec.near!.max / relax) continue;
      }
      if (placed.some((l) => dist(x, y, l.x, l.y) < spacing)) continue;
      candidates.push({ x, y });
    }
  }
  return candidates.length ? rng.pick(candidates) : null;
}

/** Pick the spot with the best score among dry-land spots whose footprint (half) is all land. */
function bestSpot(
  terrain: Uint8Array, size: number, half: number, ok: (x: number, y: number) => boolean, score: (x: number, y: number) => number,
): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestScore = -Infinity;
  for (let y = 2; y < size - 2; y++) {
    for (let x = 2; x < size - 2; x++) {
      if (!ok(x, y) || !footprintIsLand(terrain, size, x, y, half)) continue;
      const s = score(x, y);
      if (s > bestScore) {
        bestScore = s;
        best = { x, y };
      }
    }
  }
  return best;
}

/** Returns every landmark, or null when the island cannot host them (the caller re-rolls the seed). */
export function placeLandmarks(terrain: Uint8Array, biome: Uint8Array, size: number, rng: Rng): Landmark[] | null {
  const c = size / 2;
  const start = bestSpot(
    terrain, size, 1,
    (x, y) => terrain[idx(x, y, size)] === T.SAND && biome[idx(x, y, size)] === B.FOREST && isWater(terrain[idx(x, y + 2, size)]),
    (x, y) => y * 1000 - Math.abs(x - c),
  );
  if (!start) return null;
  const placed: Landmark[] = [{ id: 'start', x: start.x, y: start.y, biome: B.FOREST }];

  const light = bestSpot(
    terrain, size, 1,
    (x, y) => terrain[idx(x, y, size)] !== T.RIVER,
    (x, y) => -y * 1000 - Math.abs(x - c),
  );
  if (!light) return null;
  placed.push({ id: 'lighthouse', x: light.x, y: light.y, biome: biomeAt(biome, size, light.x, light.y) });

  const spotRng = rng.fork('landmarks');
  for (const spec of SPECS) {
    const spot = findSpot(terrain, biome, size, placed, spec, spotRng, 1) ?? findSpot(terrain, biome, size, placed, spec, spotRng, 0.6);
    if (!spot) return null;
    placed.push({ id: spec.id, x: spot.x, y: spot.y, biome: spec.biome });
  }
  return placed;
}

function biomeAt(biome: Uint8Array, size: number, x: number, y: number): Biome {
  return biome[idx(x, y, size)] as Biome;
}
```

- [ ] **Step 4: Write the resource scatter**

`src/sim/world/resources.ts`:

```typescript
import type { Rng } from '@/core/rng';
import { RESERVE_RADIUS } from './landmarks';
import { B, T, idx, inBounds, isWater, type Landmark, type ResourceKind, type ResourceNode } from './types';

interface Rule {
  kind: ResourceKind;
  p: number;
}

/** Chance per tile, by biome and ground. Rolls are exclusive: at most one node per tile. */
function rulesFor(biome: number, ground: number): Rule[] {
  switch (biome) {
    case B.FOREST:
      if (ground === T.SAND) return [{ kind: 'palm', p: 0.03 }];
      return [{ kind: 'tree', p: 0.14 }, { kind: 'bush', p: 0.02 }, { kind: 'rock', p: 0.012 }];
    case B.MOUNTAIN:
      if (ground === T.SAND) return [{ kind: 'palm', p: 0.01 }, { kind: 'rock', p: 0.02 }];
      if (ground === T.STONE) return [{ kind: 'rock', p: 0.08 }, { kind: 'ore', p: 0.035 }, { kind: 'crystal', p: 0.007 }];
      return [{ kind: 'tree', p: 0.04 }, { kind: 'rock', p: 0.05 }, { kind: 'ore', p: 0.008 }];
    case B.SWAMP:
      if (ground === T.SAND) return [{ kind: 'palm', p: 0.01 }];
      return [{ kind: 'swamptree', p: 0.1 }, { kind: 'bush', p: 0.02 }, { kind: 'rock', p: 0.008 }];
    case B.DESERT:
      if (ground === T.SAND) return [{ kind: 'palm', p: 0.01 }];
      return [{ kind: 'redrock', p: 0.035 }, { kind: 'rock', p: 0.01 }];
    default:
      return [];
  }
}

/** Scatter harvestable nodes over dry land, keeping landmark surroundings clear and nodes one tile apart. */
export function scatterResources(
  terrain: Uint8Array, biome: Uint8Array, landmarks: Landmark[], size: number, rng: Rng,
): ResourceNode[] {
  const r = rng.fork('resources');
  const blocked = new Uint8Array(size * size);
  for (const l of landmarks) {
    const rad = RESERVE_RADIUS[l.id];
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        if (inBounds(l.x + dx, l.y + dy, size)) blocked[idx(l.x + dx, l.y + dy, size)] = 1;
      }
    }
  }
  const nodes: ResourceNode[] = [];
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = idx(x, y, size);
      if (blocked[i] || isWater(terrain[i])) continue;
      const rules = rulesFor(biome[i], terrain[i]);
      if (!rules.length) continue;
      const roll = r.next();
      let acc = 0;
      let kind: ResourceKind | null = null;
      for (const rule of rules) {
        acc += rule.p;
        if (roll < acc) {
          kind = rule.kind;
          break;
        }
      }
      if (!kind) continue;
      let crowded = false;
      for (let dy = -1; dy <= 1 && !crowded; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (blocked[idx(x + dx, y + dy, size)] === 2) {
            crowded = true;
            break;
          }
        }
      }
      if (crowded) continue;
      blocked[i] = 2;
      nodes.push({ id: nodes.length, kind, x, y, variant: r.int(0, 255) });
    }
  }
  return nodes;
}
```

- [ ] **Step 5: Write the generator and validator**

`src/sim/world/generate.ts`:

```typescript
import { Rng } from '@/core/rng';
import { generateTerrain } from './terrain';
import { placeLandmarks } from './landmarks';
import { scatterResources } from './resources';
import { B, WORLD_SIZE, idx, inBounds, isWalkable, isWater, T, type World } from './types';

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

- [ ] **Step 6: Run the tests and typecheck**

Run: `npx vitest run tests/world.test.ts && npm run typecheck`
Expected: 14 tests PASS (10 to 20 seconds; the many-seeds test is the slow one); typecheck exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/sim/world tests/world.test.ts
git commit -m "feat: place landmarks and resources and validate generated islands"
```

---

### Task 4: Resource definitions and gathering state

**Files:**
- Create: `src/data/resources.ts`, `src/sim/gather.ts`
- Test: `tests/gather.test.ts`, `tests/content.test.ts`

**Interfaces:**
- Consumes: `Rng`, `ResourceNode`, `ResourceKind` (Tasks 1 and 2).
- Produces: `DropId`, `Drop`, `ResourceDef {frames,hp,drops}`, `RESOURCES: Record<ResourceKind, ResourceDef>`, `resourceFrame(kind, variant) -> string`; `GatherState {hp, gone}` (read-only records), `RESPAWN_DAYS = 3`, `emptyGather()`, `isAlive(state,id)`, `hitNode(state,node,damage,day,rng) -> { state, drops: {item,amount}[], destroyed }`, `startNewDay(state, day, keepGone?) -> GatherState`.

- [ ] **Step 1: Write the failing tests**

`tests/gather.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/rng';
import { RESOURCES } from '@/data/resources';
import { RESPAWN_DAYS, emptyGather, hitNode, isAlive, startNewDay } from '@/sim/gather';
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
```

`tests/content.test.ts`:

```typescript
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RESOURCES, resourceFrame } from '@/data/resources';
import type { ResourceKind } from '@/sim/world/types';

const PROPS = path.resolve(__dirname, '../public/assets/pack/props.json');

describe('resource content', () => {
  const kinds = Object.keys(RESOURCES) as ResourceKind[];

  it('defines sane hit points and drops for every kind', () => {
    for (const k of kinds) {
      const def = RESOURCES[k];
      expect(def.frames.length, k).toBeGreaterThan(0);
      expect(def.hp, k).toBeGreaterThan(0);
      expect(def.drops.length, k).toBeGreaterThan(0);
      for (const d of def.drops) {
        expect(d.min).toBeGreaterThanOrEqual(0);
        expect(d.max).toBeGreaterThanOrEqual(d.min);
      }
    }
  });

  it('picks sprite frames by variant, wrapping around', () => {
    expect(resourceFrame('tree', 0)).toBe(RESOURCES.tree.frames[0]);
    expect(resourceFrame('tree', 255)).toBe(RESOURCES.tree.frames[255 % RESOURCES.tree.frames.length]);
  });

  it.skipIf(!fs.existsSync(PROPS))('only uses sprite frames that exist in the packed props atlas', () => {
    const atlas = JSON.parse(fs.readFileSync(PROPS, 'utf8')) as { frames: Record<string, unknown> };
    for (const k of kinds) for (const f of RESOURCES[k].frames) expect(atlas.frames[f], `${k}: ${f}`).toBeDefined();
  });
});
```

The two atlas checks in `content.test.ts` are skipped until the sprite atlases exist (Task 10), then they run automatically.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/gather.test.ts tests/content.test.ts`
Expected: FAIL, "Failed to resolve import "@/sim/gather"" (and `@/data/resources`).

- [ ] **Step 3: Write the resource definitions**

`src/data/resources.ts`:

```typescript
import type { ResourceKind } from '@/sim/world/types';

export type DropId = 'wood' | 'stone' | 'coconut' | 'berries' | 'fiber' | 'iron_ore' | 'crystal';

export interface Drop {
  item: DropId;
  min: number;
  max: number;
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
    drops: [{ item: 'wood', min: 2, max: 4 }],
  },
  palm: {
    frames: ['p/tree_06', 'p/tree_07'],
    hp: 4,
    drops: [{ item: 'wood', min: 1, max: 2 }, { item: 'coconut', min: 0, max: 1 }],
  },
  bush: {
    frames: ['p/tree_30', 'p/tree_31'],
    hp: 2,
    drops: [{ item: 'berries', min: 1, max: 3 }, { item: 'fiber', min: 0, max: 1 }],
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
    drops: [{ item: 'wood', min: 2, max: 3 }, { item: 'fiber', min: 0, max: 1 }],
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

- [ ] **Step 4: Write the gathering logic**

`src/sim/gather.ts`:

```typescript
import type { Rng } from '@/core/rng';
import { RESOURCES, type DropId } from '@/data/resources';
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
  item: DropId;
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
    .map((d) => ({ item: d.item, amount: rng.int(d.min, d.max) }))
    .filter((d) => d.amount > 0);
  return { state: { hp, gone: { ...state.gone, [node.id]: day } }, drops, destroyed: true };
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

- [ ] **Step 5: Run the tests and typecheck**

Run: `npx vitest run tests/gather.test.ts tests/content.test.ts && npm run typecheck`
Expected: gather 8 tests PASS, content 2 PASS and 1 skipped; typecheck exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/data/resources.ts src/sim/gather.ts tests/gather.test.ts tests/content.test.ts
git commit -m "feat: add resource definitions and respawning gather state"
```

---

### Task 5: Day/night clock

**Files:**
- Create: `src/sim/daynight.ts`
- Test: `tests/daynight.test.ts`

**Interfaces:**
- Produces: `DAY_SECONDS = 600`, `NIGHT_DARKNESS = 0.85`, `Clock {day, t}`, `Phase`, `newClock()`, `advance(clock, dt) -> Clock`, `phaseOf(clock)`, `darkness(clock) -> 0..0.85`, `lighting(clock) -> { color, alpha }`, `clockLabel(clock) -> "HH:MM"`.

- [ ] **Step 1: Write the failing test**

`tests/daynight.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { DAY_SECONDS, NIGHT_DARKNESS, advance, clockLabel, darkness, lighting, newClock, phaseOf, type Clock } from '@/sim/daynight';

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
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/daynight.test.ts`
Expected: FAIL, "Failed to resolve import "@/sim/daynight"".

- [ ] **Step 3: Write the clock**

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

/** "HH:MM" time of day; the day starts at 06:00 with dawn. */
export function clockLabel(c: Clock): string {
  const minutes = Math.floor((6 * 60 + fraction(c) * 24 * 60) % (24 * 60));
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}
```

- [ ] **Step 4: Run the test and typecheck**

Run: `npx vitest run tests/daynight.test.ts && npm run typecheck`
Expected: 8 tests PASS; typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/sim/daynight.ts tests/daynight.test.ts
git commit -m "feat: add day and night clock with lighting overlay"
```

---

### Task 6: Movement and collision

**Files:**
- Create: `src/sim/movement.ts`
- Test: `tests/movement.test.ts`

**Interfaces:**
- Consumes: `World`, `T`, `idx`, `inBounds` (Task 2).
- Produces: `Vec {x,y}` (tile units; tile n covers `[n, n+1)`), `PLAYER_HALF = 0.28`, `WADE_SPEED = 0.6`, `tileBlocked(world, solids, tx, ty)`, `moveWithCollision(world, solids, pos, dx, dy) -> Vec` (axis-separated so the hero slides along walls; a hero already stuck inside a solid may walk out), `speedFactor(world, x, y)`.

- [ ] **Step 1: Write the failing test**

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

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/movement.test.ts`
Expected: FAIL, "Failed to resolve import "@/sim/movement"".

- [ ] **Step 3: Write movement**

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

function boxBlocked(world: World, solids: ReadonlySet<number>, x: number, y: number): boolean {
  const x0 = Math.floor(x - PLAYER_HALF);
  const x1 = Math.floor(x + PLAYER_HALF);
  const y0 = Math.floor(y - PLAYER_HALF);
  const y1 = Math.floor(y + PLAYER_HALF);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (tileBlocked(world, solids, tx, ty)) return true;
    }
  }
  return false;
}

/** Move by (dx, dy), one axis at a time, so the player slides along walls instead of sticking to them. */
export function moveWithCollision(world: World, solids: ReadonlySet<number>, pos: Vec, dx: number, dy: number): Vec {
  let { x, y } = pos;
  // Already inside something solid (it should not happen, but a stuck player must always be able to walk out).
  if (boxBlocked(world, solids, x, y)) {
    const max = world.size - 0.01;
    return { x: Math.min(max, Math.max(0.01, x + dx)), y: Math.min(max, Math.max(0.01, y + dy)) };
  }
  if (dx !== 0 && !boxBlocked(world, solids, x + dx, y)) x += dx;
  if (dy !== 0 && !boxBlocked(world, solids, x, y + dy)) y += dy;
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

- [ ] **Step 4: Run the test and typecheck**

Run: `npx vitest run tests/movement.test.ts && npm run typecheck`
Expected: 9 tests PASS; typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/sim/movement.ts tests/movement.test.ts
git commit -m "feat: add tile collision movement with wading and stuck escape"
```

---

### Task 7: Translations, settings and save slots

**Files:**
- Create: `src/data/strings.ts`, `src/core/i18n.ts`, `src/core/settings.ts`, `src/core/save.ts`
- Test: `tests/i18n.test.ts`, `tests/save.test.ts`

**Interfaces:**
- Consumes: `Clock` (Task 5), `GatherState`/`emptyGather` (Task 4), `RESOURCES` (Task 4, for the item-name test).
- Produces: `Lang`, `L10n`, `setLang`, `getLang`, `tr(v, vars?)`, `t(key, vars?)`, `detectLang()`; `UI_STRINGS`; `Settings`, `SETTINGS_KEY`, `defaultSettings(lang?)`, `parseSettings(raw, lang?)`, `loadSettings(storage, lang?)`, `saveSettings(storage, s)`; `SAVE_VERSION = 1`, `SLOT_COUNT = 3`, `Difficulty`, `SaveSlot`, `SlotSummary`, `StorageLike`, `newSlot(slot,name,seed,difficulty,start,clock,now?)`, `parseSlot(raw, slot) -> SaveSlot | null`, and `SaveStore` with `load(slot)`, `write(slot data)`, `delete(slot)`, `list()`, `latest()`, `slotForNewGame() -> { slot, overwrites }`, `restoreFromNative(read)`.

- [ ] **Step 1: Write the failing tests**

`tests/i18n.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { getLang, setLang, t, tr } from '@/core/i18n';
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

`tests/save.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { SLOT_COUNT, SaveStore, newSlot, parseSlot, type StorageLike } from '@/core/save';
import { defaultSettings, loadSettings, parseSettings, saveSettings, SETTINGS_KEY } from '@/core/settings';
import { newClock } from '@/sim/daynight';

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
    data.bag = { wood: 5 };
    data.gather = { hp: { 3: 2 }, gone: { 9: 4 } };
    s.write(data);
    const back = s.load(1)!;
    expect(back.name).toBe('Ari');
    expect(back.seed).toBe(4242);
    expect(back.bag).toEqual({ wood: 5 });
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

  it('rejects a save from a newer game version', () => {
    expect(parseSlot({ ...valid(), version: 99 }, 0)).toBeNull();
  });

  it('rejects negative or non-numeric bag amounts', () => {
    expect(parseSlot({ ...valid(), bag: { wood: -1 } }, 0)).toBeNull();
    expect(parseSlot({ ...valid(), bag: { wood: 'many' } }, 0)).toBeNull();
  });

  it('fills defaults for missing optional fields and cleans the name', () => {
    const raw = valid();
    delete raw.bag;
    delete raw.gather;
    raw.name = '   ';
    raw.difficulty = 'impossible';
    const s = parseSlot(raw, 2)!;
    expect(s.bag).toEqual({});
    expect(s.gather).toEqual({ hp: {}, gone: {} });
    expect(s.name).toBe('Castaway');
    expect(s.difficulty).toBe('normal');
    expect(s.slot).toBe(2);
  });

  it('truncates very long names', () => {
    expect(parseSlot({ ...valid(), name: 'x'.repeat(100) }, 0)!.name).toHaveLength(16);
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

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/i18n.test.ts tests/save.test.ts`
Expected: FAIL, "Failed to resolve import "@/core/i18n"" (and the others).

- [ ] **Step 3: Write the strings and i18n**

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
    en: 'Starting a new game replaces the latest save. Continue?',
    id: 'Game baru akan menimpa simpanan terakhir. Lanjutkan?',
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
  hitAction: { en: 'HIT', id: 'PUKUL' },
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
};
```

`src/core/i18n.ts`:

```typescript
/** Localization: English + Bahasa Indonesia. Content data carries inline {en, id} pairs; UI strings use keys. */
import { UI_STRINGS } from '@/data/strings';

export type Lang = 'en' | 'id';
export interface L10n {
  en: string;
  id: string;
}

let current: Lang = 'en';

export function setLang(lang: Lang): void {
  current = lang;
}

export function getLang(): Lang {
  return current;
}

/** Translate an inline localized value. Plain strings pass through. */
export function tr(v: L10n | string | undefined, vars?: Record<string, string | number>): string {
  if (v === undefined) return '';
  const s = typeof v === 'string' ? v : v[current] || v.en;
  return vars ? fill(s, vars) : s;
}

/** Translate a UI key. Unknown keys are returned as-is so missing strings are visible but never crash. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const entry = UI_STRINGS[key];
  if (!entry) return key;
  return tr(entry, vars);
}

function fill(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_m, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function detectLang(): Lang {
  const nav = typeof navigator !== 'undefined' ? navigator.language || '' : '';
  return nav.toLowerCase().startsWith('id') || nav.toLowerCase().startsWith('in') ? 'id' : 'en';
}
```

- [ ] **Step 4: Write settings and the save store**

`src/core/settings.ts`:

```typescript
import type { Lang } from '@/core/i18n';
import type { StorageLike } from '@/core/save';

export interface Settings {
  musicVol: number;
  sfxVol: number;
  vibration: boolean;
  screenShake: boolean;
  damageNumbers: boolean;
  autoAttack: boolean;
  joystick: 'floating' | 'fixed';
  lang: Lang;
  quality: 'auto' | 'high' | 'low';
  /** Accessibility text size multiplier, 1..1.3. */
  textScale: number;
}

export const SETTINGS_KEY = 'tidewake.settings.v1';

export function defaultSettings(lang: Lang = 'en'): Settings {
  return {
    musicVol: 0.6, sfxVol: 0.8, vibration: true, screenShake: true, damageNumbers: true,
    autoAttack: false, joystick: 'floating', lang, quality: 'auto', textScale: 1,
  };
}

const clamp01 = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

/** Merge stored JSON over the defaults, ignoring unknown keys and wrong types. */
export function parseSettings(raw: unknown, lang: Lang = 'en'): Settings {
  const base = defaultSettings(lang);
  if (typeof raw !== 'object' || raw === null) return base;
  const d = raw as Record<string, unknown>;
  return {
    musicVol: clamp01(d.musicVol, base.musicVol),
    sfxVol: clamp01(d.sfxVol, base.sfxVol),
    vibration: bool(d.vibration, base.vibration),
    screenShake: bool(d.screenShake, base.screenShake),
    damageNumbers: bool(d.damageNumbers, base.damageNumbers),
    autoAttack: bool(d.autoAttack, base.autoAttack),
    joystick: d.joystick === 'fixed' ? 'fixed' : 'floating',
    lang: d.lang === 'id' ? 'id' : d.lang === 'en' ? 'en' : base.lang,
    quality: d.quality === 'low' ? 'low' : d.quality === 'high' ? 'high' : 'auto',
    textScale: typeof d.textScale === 'number' && Number.isFinite(d.textScale) ? Math.min(1.3, Math.max(1, d.textScale)) : base.textScale,
  };
}

export function loadSettings(storage: StorageLike | null, lang: Lang = 'en'): Settings {
  try {
    const txt = storage?.getItem(SETTINGS_KEY);
    return parseSettings(txt ? JSON.parse(txt) : null, lang);
  } catch {
    return defaultSettings(lang);
  }
}

export function saveSettings(storage: StorageLike | null, s: Settings): void {
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch (err) {
    console.error('[settings] write failed', err);
  }
}
```

`src/core/save.ts`:

```typescript
import type { Clock } from '@/sim/daynight';
import { emptyGather, type GatherState } from '@/sim/gather';

export const SAVE_VERSION = 1;
export const SLOT_COUNT = 3;

export type Difficulty = 'relaxed' | 'normal' | 'hardcore';
const DIFFICULTIES: readonly Difficulty[] = ['relaxed', 'normal', 'hardcore'];

/** Everything that survives closing the app. The island itself is regenerated from `seed`. */
export interface SaveSlot {
  version: number;
  slot: number;
  name: string;
  seed: number;
  difficulty: Difficulty;
  createdAt: number;
  updatedAt: number;
  playTimeSec: number;
  player: { x: number; y: number };
  /** Gathered materials by item id (the real inventory replaces this in a later phase). */
  bag: Record<string, number>;
  clock: Clock;
  gather: GatherState;
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

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function newSlot(
  slot: number, name: string, seed: number, difficulty: Difficulty, start: { x: number; y: number }, clock: Clock, now = Date.now(),
): SaveSlot {
  return {
    version: SAVE_VERSION, slot, name, seed, difficulty, createdAt: now, updatedAt: now, playTimeSec: 0,
    player: { x: start.x + 0.5, y: start.y + 0.5 },
    bag: {}, clock, gather: emptyGather(),
  };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isRecordOfNumbers = (v: unknown): v is Record<string, number> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && Object.values(v).every((n) => isNum(n) && n >= 0);

/** Validate untrusted JSON into a SaveSlot; null when it cannot be trusted (corrupt, or from a newer game version). */
export function parseSlot(raw: unknown, slot: number): SaveSlot | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const d = raw as Record<string, unknown>;
  if (!isNum(d.version) || d.version > SAVE_VERSION || !isNum(d.seed)) return null;
  const player = d.player as Record<string, unknown> | undefined;
  const clock = d.clock as Record<string, unknown> | undefined;
  if (!player || !isNum(player.x) || !isNum(player.y)) return null;
  if (!clock || !isNum(clock.day) || clock.day < 1 || !isNum(clock.t) || clock.t < 0) return null;
  const gather = d.gather as Record<string, unknown> | undefined;
  const bag = d.bag === undefined ? {} : d.bag;
  if (!isRecordOfNumbers(bag)) return null;
  const hp = gather?.hp ?? {};
  const gone = gather?.gone ?? {};
  if (!isRecordOfNumbers(hp) || !isRecordOfNumbers(gone)) return null;
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    slot,
    name: typeof d.name === 'string' && d.name.trim() ? d.name.trim().slice(0, 16) : 'Castaway',
    seed: d.seed >>> 0,
    difficulty: DIFFICULTIES.includes(d.difficulty as Difficulty) ? (d.difficulty as Difficulty) : 'normal',
    createdAt: isNum(d.createdAt) ? d.createdAt : now,
    updatedAt: isNum(d.updatedAt) ? d.updatedAt : now,
    playTimeSec: isNum(d.playTimeSec) && d.playTimeSec >= 0 ? d.playTimeSec : 0,
    player: { x: player.x, y: player.y },
    bag,
    clock: { day: Math.floor(clock.day), t: clock.t },
    gather: { hp, gone },
  };
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

- [ ] **Step 5: Run the tests and typecheck**

Run: `npx vitest run tests/i18n.test.ts tests/save.test.ts && npm run typecheck`
Expected: i18n 5 tests PASS, save 19 tests PASS; typecheck exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/data/strings.ts src/core/i18n.ts src/core/settings.ts src/core/save.ts tests/i18n.test.ts tests/save.test.ts
git commit -m "feat: add EN/ID strings, settings and three-slot save store"
```

---

### Task 8: Viewport

**Files:**
- Create: `src/core/viewport.ts`
- Test: `tests/viewport.test.ts`

**Interfaces:**
- Consumes: `SETTINGS_KEY` (Task 7).
- Produces: `Viewport`, `computeViewport(cssW,cssH,dpr,hiRes?)`, mutable `view {w,h,res,cssPerVirtual}`, `setView(vp)`, `worldZoom(z) -> z * view.res`, `snapWorld(v, z?)`, `vx(pointer)`, `vy(pointer)`, `savedHiRes()`, `autoQuality()`, `savedTextScale()`, `AUTO_LOW_KEY`, `shakeCamera(cam, ms, intensity)`.

- [ ] **Step 1: Write the failing test**

`tests/viewport.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUTO_LOW_KEY, MAX_W, MIN_W, autoQuality, computeViewport, savedHiRes, savedTextScale, setView, snapWorld, view, vx, vy } from '@/core/viewport';
import { SETTINGS_KEY } from '@/core/settings';

function stubStorage(items: Record<string, string>, deviceMemory?: number): void {
  vi.stubGlobal('localStorage', { getItem: (k: string) => items[k] ?? null });
  vi.stubGlobal('navigator', { deviceMemory });
}

afterEach(() => vi.unstubAllGlobals());

describe('computeViewport', () => {
  it('renders a 390x844 @2x phone at 2x', () => {
    expect(computeViewport(390, 844, 2)).toEqual({ width: 390, height: 844, scale: 2, res: 2, zoom: 0.5 });
  });

  it('renders a tall 412x915 @2.625x phone at 3x', () => {
    const vp = computeViewport(412, 915, 2.625);
    expect(vp).toMatchObject({ width: 360, height: 800, scale: 3, res: 3 });
  });

  it('draws at 1x when hi-res is off', () => {
    expect(computeViewport(360, 640, 3, false)).toMatchObject({ scale: 3, res: 1, zoom: 1 });
  });

  it('halves the render scale on 4x screens and upscales exactly', () => {
    expect(computeViewport(360, 780, 4)).toMatchObject({ scale: 4, res: 2, zoom: 0.5 });
  });

  it('keeps the virtual width inside the supported range for extreme shapes', () => {
    for (const [w, h] of [[200, 900], [1200, 900], [360, 360], [1, 1]]) {
      const vp = computeViewport(w, h, 2);
      expect(vp.width).toBeGreaterThanOrEqual(MIN_W);
      expect(vp.width).toBeLessThanOrEqual(MAX_W);
      expect(vp.scale).toBeGreaterThanOrEqual(1);
      expect(vp.res).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('view helpers', () => {
  it('converts canvas pixels to virtual pixels and snaps to device pixels', () => {
    setView({ width: 390, height: 844, scale: 2, res: 2, zoom: 0.5 });
    expect(view).toMatchObject({ w: 390, h: 844, res: 2 });
    expect(vx({ x: 100 })).toBe(50);
    expect(vy({ y: 100 })).toBe(50);
    expect(snapWorld(10.13, 2)).toBe(10.25);
  });
});

describe('saved quality settings', () => {
  it('uses hi-res by default on a normal device', () => {
    stubStorage({});
    expect(savedHiRes()).toBe(true);
    expect(autoQuality()).toBe(true);
    expect(savedTextScale()).toBe(1);
  });

  it('respects an explicit choice over the device check', () => {
    stubStorage({ [SETTINGS_KEY]: JSON.stringify({ quality: 'low' }) }, 8);
    expect(savedHiRes()).toBe(false);
    expect(autoQuality()).toBe(false);
    stubStorage({ [SETTINGS_KEY]: JSON.stringify({ quality: 'high' }) }, 1);
    expect(savedHiRes()).toBe(true);
  });

  it('falls back to low quality on low-memory devices or after a failed frame-rate check', () => {
    stubStorage({}, 2);
    expect(savedHiRes()).toBe(false);
    stubStorage({ [AUTO_LOW_KEY]: '1' }, 8);
    expect(savedHiRes()).toBe(false);
  });

  it('reads the text scale only when it is in range and survives corrupt storage', () => {
    stubStorage({ [SETTINGS_KEY]: JSON.stringify({ textScale: 1.2 }) });
    expect(savedTextScale()).toBe(1.2);
    stubStorage({ [SETTINGS_KEY]: JSON.stringify({ textScale: 3 }) });
    expect(savedTextScale()).toBe(1);
    stubStorage({ [SETTINGS_KEY]: '{broken' });
    expect(savedTextScale()).toBe(1);
    expect(savedHiRes()).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/viewport.test.ts`
Expected: FAIL, "Failed to resolve import "@/core/viewport"".

- [ ] **Step 3: Write the viewport module**

This is Dawnbound's hi-res viewport logic, trimmed and reading the quality and text-scale choices from the new settings key.

`src/core/viewport.ts`:

```typescript
import type Phaser from 'phaser';
import { SETTINGS_KEY } from '@/core/settings';

/**
 * Layout works in a small "virtual" resolution (about 360 px wide) so pixel art and UI keep their proportions,
 * but the canvas itself is rendered at `res` canvas pixels per virtual pixel (the device's integer scale on High
 * quality). Cameras zoom by `res`, so sprites move in sub-virtual-pixel steps, lights are smooth and text is crisp.
 */
export interface Viewport {
  /** Virtual size used by all layout code. */
  width: number;
  height: number;
  /** Integer device pixels per virtual pixel. */
  scale: number;
  /** Canvas pixels per virtual pixel (= scale on High quality, 1 on Low). */
  res: number;
  /** CSS zoom passed to Phaser (device pixels per canvas pixel / devicePixelRatio). */
  zoom: number;
}

export const MIN_W = 320;
export const MAX_W = 420;

export function computeViewport(cssW: number, cssH: number, dpr: number, hiRes = true): Viewport {
  const devW = Math.max(1, Math.floor(cssW * dpr));
  const devH = Math.max(1, Math.floor(cssH * dpr));
  const byWidth = Math.round(devW / 360);
  const byHeight = Math.floor(devH / 600);
  const scale = Math.max(1, Math.min(byWidth, byHeight));
  const height = Math.floor(devH / scale);
  let width = Math.floor(devW / scale);
  width = Math.max(MIN_W, Math.min(MAX_W, width, Math.floor(height * 0.62)));
  // 4x screens (1440p) render at 2x and upscale by an exact 2: a quarter of the pixel cost, still crisp.
  const res = !hiRes ? 1 : scale >= 4 && scale % 2 === 0 ? scale / 2 : scale;
  return { width, height, scale, res, zoom: scale / res / dpr };
}

/** Live virtual size + render scale, updated on resize. Read these instead of `scene.scale.width`. */
export const view = { w: 360, h: 640, res: 1, cssPerVirtual: 1 };

export function setView(vp: Viewport): void {
  view.w = vp.width;
  view.h = vp.height;
  view.res = vp.res;
  view.cssPerVirtual = vp.zoom * vp.res;
}

/** Camera zoom that magnifies the world `z` times in virtual pixels. */
export function worldZoom(z: number): number {
  return z * view.res;
}

/**
 * Snap a world coordinate to the nearest device pixel under a world camera of virtual zoom `z` (2 in the world).
 * Keeps pixel art crisp while letting sprites glide in sub-pixel steps instead of whole-texel jumps.
 */
export function snapWorld(v: number, z = 2): number {
  const k = z * view.res;
  return Math.round(v * k) / k;
}

/** Pointer position in virtual coordinates (pointer.x/y are canvas pixels). */
export function vx(p: { x: number }): number {
  return p.x / view.res;
}

export function vy(p: { y: number }): number {
  return p.y / view.res;
}

/** Set when the frame-rate guard found the device too slow for hi-res rendering. */
export const AUTO_LOW_KEY = 'tidewake.autoLow';

function readSettings(): { quality?: unknown; textScale?: unknown } {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return typeof parsed === 'object' && parsed !== null ? (parsed as { quality?: unknown; textScale?: unknown }) : {};
  } catch {
    return {};
  }
}

/** Accessibility text size chosen in Settings (read before boot, because fonts are set up once). */
export function savedTextScale(): number {
  const k = readSettings().textScale;
  return typeof k === 'number' && k >= 1 && k <= 1.3 ? k : 1;
}

/** True while the player has not chosen a graphics quality themselves. */
export function autoQuality(): boolean {
  const q = readSettings().quality;
  return q !== 'low' && q !== 'high';
}

/**
 * Decides hi-res rendering before the settings system boots (the canvas size is fixed at startup): the player's
 * choice if they made one, otherwise hi-res unless the device reports little memory or already failed the frame-rate check.
 */
export function savedHiRes(): boolean {
  const q = readSettings().quality;
  if (q === 'low') return false;
  if (q === 'high') return true;
  try {
    if (localStorage.getItem(AUTO_LOW_KEY) === '1') return false;
  } catch {
    // Storage unavailable: fall through to the device check.
  }
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return !(mem !== undefined && mem <= 3);
}

/**
 * Camera shake whose strength is the same on every screen. Phaser measures shake in canvas pixels times zoom, so on a
 * hi-res canvas (res device pixels per virtual pixel) a raw shake would be res times stronger.
 */
export function shakeCamera(cam: Phaser.Cameras.Scene2D.Camera, ms: number, intensity: number): void {
  cam.shake(ms, intensity / Math.max(1, view.res));
}
```

- [ ] **Step 4: Run the test and typecheck**

Run: `npx vitest run tests/viewport.test.ts && npm run typecheck`
Expected: 10 tests PASS; typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/core/viewport.ts tests/viewport.test.ts
git commit -m "feat: add hi-res viewport computation and saved quality settings"
```

---

### Task 9: Platform services and UI kit (ported from Dawnbound)

**Files:**
- Create: `src/core/services.ts`
- Copy (then edit): `src/core/platform.ts`, `src/core/audio.ts`, `src/ui/theme.ts`, `src/ui/skin.ts`, `src/ui/widgets.ts`, `src/ui/modal.ts`, `src/gfx/animations.ts`, `public/assets/fonts/*`

**Interfaces:**
- Consumes: `SaveStore` (Task 7), `Settings` (Task 7), `view` (Task 8).
- Produces: `services` (`audio`, `platform`, `saves`, `settings`, `notify`); `Platform` (`init`, `hideSplash`, `onBack(fn) -> unregister`, `haptic(kind)`, `share(title,text)`, `rate()`, `exitApp()`, `native`, `hapticsEnabled`); `AudioManager` (`sfx`, `playMusic`, `setMusicVolume`, `setSfxVolume`, ...); UI kit exports `COLORS`, `FONT`, `createUiTextures`, `installBitmapTextDefaults`, `setTextScale`, `fontSuffix`, `nine`, `createHiResSkin`, `Button`, `label`, `toast`, `dimmer`, `panel`, `showModal`, `confirm`; `registerAnimations(scene)`, `dirFromVector`, `Dir`, `animKey`.

These modules are Dawnbound's, already proven on devices, and are not rewritten. This task copies them and applies the few edits Tidewake needs. There is nothing to unit-test here, so verification is the typecheck.

- [ ] **Step 1: Copy the files**

```bash
cd "E:/RPG Survival Sprite Sonnet 55"
SRC="E:/Roguelike Opus 55"
mkdir -p src/ui src/gfx public/assets
cp "$SRC/src/core/platform.ts" "$SRC/src/core/audio.ts" src/core/
cp "$SRC/src/ui/theme.ts" "$SRC/src/ui/skin.ts" "$SRC/src/ui/widgets.ts" "$SRC/src/ui/modal.ts" src/ui/
cp "$SRC/src/gfx/animations.ts" src/gfx/
cp -r "$SRC/public/assets/fonts" public/assets/fonts
```

- [ ] **Step 2: Apply the Tidewake edits**

```bash
sed -i "s/com.fajar.dawnbound/com.fajar.tidewake/" src/core/platform.ts
sed -i "s/\['heroes', 'actors', 'monsters', 'props'\]/['heroes', 'actors', 'props']/" src/gfx/animations.ts
grep -n "APP_ID =" src/core/platform.ts
grep -n "for (const atlas of" src/gfx/animations.ts
```

Expected: `export const APP_ID = 'com.fajar.tidewake';` and `for (const atlas of ['heroes', 'actors', 'props']) {`. The `monsters` atlas is added back in the combat plan.

- [ ] **Step 3: Write the service locator**

`src/core/services.ts`:

```typescript
/** Global service locator, filled during boot. Kept tiny so pure systems (tests) never depend on it. */
import type { AudioManager } from './audio';
import type { Platform } from './platform';
import type { SaveStore } from './save';
import type { Settings } from './settings';

export interface Services {
  audio?: AudioManager;
  platform?: Platform;
  saves?: SaveStore;
  settings?: Settings;
  notify?: (text: string, color?: number) => void;
}

export const services: Services = {};
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: exits 0. If it reports a missing module, a copied file imports something Dawnbound has and Tidewake does not; do not copy more of Dawnbound, remove or replace that import (the files above were verified to need nothing else).

- [ ] **Step 5: Commit**

```bash
git add src/core/services.ts src/core/platform.ts src/core/audio.ts src/ui src/gfx/animations.ts public/assets/fonts
git commit -m "chore: port platform services, UI kit and fonts from Dawnbound"
```

---

### Task 10: Asset pipeline and ground tiles

**Files:**
- Create: `tools/pack_assets.py` (copy + edit), `tools/pack_tiles.py`, `src/data/terrainTiles.ts`, `src/sim/tileView.ts`
- Generated and committed: `public/assets/pack/{heroes,actors,props}.{png,json}`, `public/assets/pack/tiles.png`, `src/data/tileIndex.ts`
- Test: `tests/tiles.test.ts`

**Interfaces:**
- Produces: atlases `heroes` (frames like `hero1/walk/down/0`), `actors`, `props` (frames like `p/tree_02`, `fire/campfire_burning/0`); `TILE_FRAMES` and `TileName` (generated, in `tileIndex.ts`); `TILES_KEY = 'tiles_ss'`, `GROUND_TILES: Record<Terrain, [TileName, weight][]>`; `tileHash(x,y,seed?)`, `groundFrame(terrain, x, y) -> frame index`, `SHORE_N/E/S/W`, `shoreMask(world, x, y) -> 0..15`.

- [ ] **Step 1: Bring over the atlas packer and trim it to what Phase 1 needs**

```bash
cd "E:/RPG Survival Sprite Sonnet 55"
mkdir -p tools
cp "E:/Roguelike Opus 55/tools/pack_assets.py" tools/pack_assets.py
sed -i '/^    build_monsters()$/d; /^    build_battlers()$/d; /^    copy_singles()$/d' tools/pack_assets.py
tail -6 tools/pack_assets.py
```

Expected tail:

```python
if __name__ == "__main__":
    build_heroes()
    build_actors()
    build_props()
```

(The monster, battler and background builders stay in the file for the combat plan.)

- [ ] **Step 2: Write the tile packer**

The Unity pack has no seamless sand, desert, dirt or swamp ground (those tiles carry grid lines), so this script derives them from its speckled grass tiles by recolouring. Water, grass and cobble stone are used as they are; deep water is a darker tint of the shallow water tile.

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

- [ ] **Step 3: Run both packers**

```bash
python tools/pack_assets.py
python tools/pack_tiles.py
ls -la public/assets/pack
```

Expected: `atlas heroes: ... frames`, `atlas actors: ...`, `atlas props: ...`, then `packed 24 tiles into 128x48`. The folder lists `heroes.json/png`, `actors.json/png`, `props.json/png`, `tiles.png` (about 1.3 MB in total) and `src/data/tileIndex.ts` now exists.

- [ ] **Step 4: Write the failing tile test**

`tests/tiles.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { GROUND_TILES } from '@/data/terrainTiles';
import { TILE_FRAMES } from '@/data/tileIndex';
import { SHORE_E, SHORE_N, SHORE_S, SHORE_W, groundFrame, shoreMask, tileHash } from '@/sim/tileView';
import { T, WORLD_SIZE, idx, type World } from '@/sim/world/types';

describe('ground tiles', () => {
  it('maps every terrain type to existing packed tiles', () => {
    for (const t of Object.values(T)) {
      const list = GROUND_TILES[t];
      expect(list.length, `terrain ${t}`).toBeGreaterThan(0);
      for (const [name, weight] of list) {
        expect(TILE_FRAMES[name], name).toBeTypeOf('number');
        expect(weight).toBeGreaterThan(0);
      }
    }
  });

  it('picks the same tile for the same position and stays inside the packed frames', () => {
    const max = Math.max(...Object.values(TILE_FRAMES));
    for (let i = 0; i < 300; i++) {
      const f = groundFrame(T.GRASS, i, i * 3);
      expect(f).toBe(groundFrame(T.GRASS, i, i * 3));
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(max);
    }
  });

  it('mixes variants but favors the flat tile', () => {
    const counts = new Map<number, number>();
    for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) counts.set(groundFrame(T.GRASS, x, y), (counts.get(groundFrame(T.GRASS, x, y)) ?? 0) + 1);
    expect(counts.size).toBeGreaterThan(1);
    expect(counts.get(TILE_FRAMES['grass.0'])!).toBeGreaterThan(1600 * 0.4);
  });

  it('hashes tiles into [0, 1)', () => {
    for (let i = 0; i < 100; i++) {
      const h = tileHash(i, i * 7);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
  });
});

describe('shoreMask', () => {
  const size = WORLD_SIZE;
  const world = (): World => {
    const terrain = new Uint8Array(size * size).fill(T.DEEP);
    terrain[idx(5, 5)] = T.GRASS;
    return { seed: 0, size, terrain, biome: new Uint8Array(size * size), landmarks: [], resources: [], start: { x: 5, y: 5 } };
  };

  it('is 0 for land tiles and for open sea', () => {
    const w = world();
    expect(shoreMask(w, 5, 5)).toBe(0);
    expect(shoreMask(w, 20, 20)).toBe(0);
  });

  it('sets a bit for each side that touches land', () => {
    const w = world();
    expect(shoreMask(w, 5, 4)).toBe(SHORE_S);
    expect(shoreMask(w, 5, 6)).toBe(SHORE_N);
    expect(shoreMask(w, 4, 5)).toBe(SHORE_E);
    expect(shoreMask(w, 6, 5)).toBe(SHORE_W);
  });

  it('combines bits for narrow water and treats the map edge as not land', () => {
    const w = world();
    w.terrain[idx(7, 5)] = T.GRASS;
    expect(shoreMask(w, 6, 5)).toBe(SHORE_W | SHORE_E);
    expect(shoreMask(w, 0, 0)).toBe(0);
  });
});
```

- [ ] **Step 5: Run it to verify it fails**

Run: `npx vitest run tests/tiles.test.ts`
Expected: FAIL, "Failed to resolve import "@/sim/tileView"".

- [ ] **Step 6: Write the tile mapping and tile view**

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
};
```

`src/sim/tileView.ts`:

```typescript
import { GROUND_TILES } from '@/data/terrainTiles';
import { TILE_FRAMES } from '@/data/tileIndex';
import { idx, inBounds, isWater, type Terrain, type World } from '@/sim/world/types';

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

- [ ] **Step 7: Run the whole suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: every test PASSES, including the two atlas checks in `content.test.ts` that were skipped before (now 3 of 3); typecheck exits 0.

- [ ] **Step 8: Look at the tiles once**

Open `public/assets/pack/tiles.png` with the Read tool. Expected: a 128 x 48 sheet showing flat and speckled grass, two blues (shallow and darker deep water), grey cobble, then four colour families (sand, desert, dirt, swamp) with four variants each. If the colours look wrong, adjust `PALETTES` in `tools/pack_tiles.py` and re-run Step 3.

- [ ] **Step 9: Commit (generated assets included)**

```bash
git add tools/pack_assets.py tools/pack_tiles.py public/assets/pack src/data/tileIndex.ts src/data/terrainTiles.ts src/sim/tileView.ts tests/tiles.test.ts
git commit -m "feat: add asset packing pipeline and ground tile mapping"
```

---

### Task 11: Landmark scenery, solid tiles and interaction

**Files:**
- Create: `src/data/landmarkProps.ts`, `src/sim/solids.ts`, `src/sim/interact.ts`
- Test: `tests/interact.test.ts`, `tests/landmarkProps.test.ts`

**Interfaces:**
- Consumes: `World`, `LandmarkId`, `ResourceNode`, `idx`, `inBounds` (Task 2); `RESERVE_RADIUS` (Task 3); `Vec` (Task 6); the `props` atlas (Task 10).
- Produces: `PropSpec {frame, dx, dy, anim?, blocks?}`, `LANDMARK_PROPS: Record<LandmarkId, PropSpec[]>`; `propSolidTiles(world) -> number[]` (tile indexes), `nodesByTile(world) -> Map<tileIndex, ResourceNode>`; `nearestNode(nodes, size, pos, radius, alive) -> ResourceNode | null`.

- [ ] **Step 1: Write the failing tests**

`tests/interact.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { LANDMARK_PROPS } from '@/data/landmarkProps';
import { nearestNode } from '@/sim/interact';
import { nodesByTile, propSolidTiles } from '@/sim/solids';
import { generateWorld } from '@/sim/world/generate';
import { RESERVE_RADIUS } from '@/sim/world/landmarks';
import { T, WORLD_SIZE, idx, isWater, type ResourceNode } from '@/sim/world/types';

const node = (id: number, x: number, y: number): ResourceNode => ({ id, kind: 'tree', x, y, variant: 0 });

describe('nearestNode', () => {
  const nodes = new Map([node(1, 10, 10), node(2, 12, 10), node(3, 10, 14)].map((n) => [idx(n.x, n.y), n]));
  const alive = () => true;

  it('finds the closest node within the radius', () => {
    expect(nearestNode(nodes, WORLD_SIZE, { x: 10.5, y: 10.5 }, 1.3, alive)?.id).toBe(1);
    expect(nearestNode(nodes, WORLD_SIZE, { x: 11.9, y: 10.5 }, 1.3, alive)?.id).toBe(2);
  });

  it('returns null when nothing is in reach', () => {
    expect(nearestNode(nodes, WORLD_SIZE, { x: 20, y: 20 }, 1.3, alive)).toBeNull();
    expect(nearestNode(nodes, WORLD_SIZE, { x: 10.5, y: 12.5 }, 1.3, alive)).toBeNull();
  });

  it('skips nodes that are no longer alive', () => {
    expect(nearestNode(nodes, WORLD_SIZE, { x: 10.5, y: 10.5 }, 1.3, (id) => id !== 1)).toBeNull();
    expect(nearestNode(nodes, WORLD_SIZE, { x: 11.2, y: 10.5 }, 2, (id) => id !== 1)?.id).toBe(2);
  });

  it('is safe at the map edge', () => {
    expect(nearestNode(nodes, WORLD_SIZE, { x: 0.2, y: 0.2 }, 3, alive)).toBeNull();
    expect(nearestNode(nodes, WORLD_SIZE, { x: WORLD_SIZE - 0.1, y: WORLD_SIZE - 0.1 }, 3, alive)).toBeNull();
  });
});

describe('solids', () => {
  const world = generateWorld(13);

  it('indexes every resource node by its tile', () => {
    const map = nodesByTile(world);
    expect(map.size).toBe(world.resources.length);
    for (const n of world.resources) expect(map.get(idx(n.x, n.y))).toBe(n);
  });

  it('blocks only dry land inside each landmark clearing', () => {
    const tiles = new Set(propSolidTiles(world));
    expect(tiles.size).toBeGreaterThan(0);
    for (const l of world.landmarks) {
      for (const prop of LANDMARK_PROPS[l.id]) {
        for (const [bx, by] of prop.blocks ?? []) {
          expect(Math.abs(bx) <= RESERVE_RADIUS[l.id] && Math.abs(by) <= RESERVE_RADIUS[l.id], `${l.id} block ${bx},${by}`).toBe(true);
          expect(isWater(world.terrain[idx(l.x + bx, l.y + by)]), `${l.id} block in water`).toBe(false);
        }
      }
    }
    expect(world.terrain[idx(world.start.x, world.start.y)]).toBe(T.SAND);
    expect(tiles.has(idx(world.start.x, world.start.y))).toBe(false);
  });

  it('never blocks the tile where the player starts or a resource tile', () => {
    const tiles = new Set(propSolidTiles(world));
    for (const n of world.resources) expect(tiles.has(idx(n.x, n.y))).toBe(false);
  });
});
```

`tests/landmarkProps.test.ts`:

```typescript
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LANDMARK_PROPS } from '@/data/landmarkProps';
import { RESERVE_RADIUS } from '@/sim/world/landmarks';
import type { LandmarkId } from '@/sim/world/types';

const PROPS = path.resolve(__dirname, '../public/assets/pack/props.json');

describe('landmark props', () => {
  it('defines scenery for all 13 landmarks', () => {
    expect(Object.keys(LANDMARK_PROPS)).toHaveLength(13);
    for (const props of Object.values(LANDMARK_PROPS)) expect(props.length).toBeGreaterThan(0);
  });

  it('keeps every prop and blocked tile inside the clearing the generator leaves free', () => {
    for (const [id, props] of Object.entries(LANDMARK_PROPS)) {
      const rad = RESERVE_RADIUS[id as LandmarkId];
      for (const p of props) {
        expect(Math.abs(p.dx) <= rad && Math.abs(p.dy) <= rad, `${id} prop ${p.frame}`).toBe(true);
        for (const [bx, by] of p.blocks ?? []) expect(Math.abs(bx) <= rad && Math.abs(by) <= rad, `${id} block`).toBe(true);
      }
    }
  });

  it.skipIf(!fs.existsSync(PROPS))('only uses frames that exist in the packed props atlas', () => {
    const atlas = JSON.parse(fs.readFileSync(PROPS, 'utf8')) as { frames: Record<string, unknown> };
    for (const [id, props] of Object.entries(LANDMARK_PROPS)) {
      for (const p of props) expect(atlas.frames[p.frame], `${id}: ${p.frame}`).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/interact.test.ts tests/landmarkProps.test.ts`
Expected: FAIL, "Failed to resolve import "@/sim/interact"" (and `@/data/landmarkProps`).

- [ ] **Step 3: Write the landmark scenery data**

These are stand-ins (huts, columns, statues, chests, a campfire) that later plans replace with real NPC huts, dungeon doors and the lighthouse.

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
    { frame: 'p/column_01', dx: -1, dy: 0, blocks: [[-1, 0]] },
    { frame: 'p/column_01', dx: 1, dy: 0, blocks: [[1, 0]] },
  ],
  deepmine: [
    { frame: 'p/column_03', dx: -1, dy: 0, blocks: [[-1, 0]] },
    { frame: 'p/column_03', dx: 1, dy: 0, blocks: [[1, 0]] },
  ],
  ruin: [
    { frame: 'p/statue_01', dx: 0, dy: 0, blocks: [[0, 0]] },
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

- [ ] **Step 4: Write solids and interaction**

`src/sim/solids.ts`:

```typescript
import { LANDMARK_PROPS } from '@/data/landmarkProps';
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
```

`src/sim/interact.ts`:

```typescript
import type { Vec } from '@/sim/movement';
import { idx, inBounds, type ResourceNode } from '@/sim/world/types';

/** The closest living node within `radius` tiles of `pos` (positions in tile units), or null. */
export function nearestNode(
  nodes: ReadonlyMap<number, ResourceNode>, size: number, pos: Vec, radius: number, alive: (id: number) => boolean,
): ResourceNode | null {
  const reach = Math.ceil(radius);
  const cx = Math.floor(pos.x);
  const cy = Math.floor(pos.y);
  let best: ResourceNode | null = null;
  let bestDist = Infinity;
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (!inBounds(x, y, size)) continue;
      const node = nodes.get(idx(x, y, size));
      if (!node || !alive(node.id)) continue;
      const d = Math.hypot(node.x + 0.5 - pos.x, node.y + 0.5 - pos.y);
      if (d <= radius && d < bestDist) {
        best = node;
        bestDist = d;
      }
    }
  }
  return best;
}
```

- [ ] **Step 5: Run the tests and typecheck**

Run: `npx vitest run tests/interact.test.ts tests/landmarkProps.test.ts && npm run typecheck`
Expected: interact 7 tests PASS, landmarkProps 3 PASS (the atlas check now runs); typecheck exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/data/landmarkProps.ts src/sim/solids.ts src/sim/interact.ts tests/interact.test.ts tests/landmarkProps.test.ts
git commit -m "feat: add landmark scenery, solid tiles and nearest-node lookup"
```

---

### Task 12: App shell scenes

**Files:**
- Create: `src/main.ts`, `src/scenes/BaseScene.ts`, `src/scenes/BootScene.ts`, `src/scenes/PreloadScene.ts`, `src/scenes/SplashScene.ts`, `src/scenes/MenuScene.ts`, `src/scenes/NotifyScene.ts`, `src/scenes/index.ts`
- Copy (then edit): `tools/play.mjs`
- Create: `tools/scripts/boot.json`

**Interfaces:**
- Consumes: everything from Tasks 1 to 11 (services, save store, settings, viewport, UI kit, atlases, tile keys).
- Produces: scene keys `Boot`, `Preload`, `Splash`, `Menu`, `Notify`. `BaseScene` (`W`, `H`, `handleBack(fn)`, `fadeIn(ms)`, `goTo(key, data?, ms?)`). `MenuScene` starts `Game` with `{ slot }` (Continue) or `{ slot, seed }` (New Game). `services.notify(text, color?)` is available from `Notify`. In dev builds `window.__game` is the Phaser game and `window.__errs` collects page errors.

There is no unit test for scenes; this task is verified by running the dev server and a browser script.

- [ ] **Step 1: Write the shell scenes**

`src/scenes/BaseScene.ts`:

```typescript
import Phaser from 'phaser';
import { services } from '@/core/services';
import { view } from '@/core/viewport';

/** Shared helpers for every scene: virtual size, fade transitions and Android back-button handling. */
export abstract class BaseScene extends Phaser.Scene {
  private unregisterBack?: () => void;
  protected transitioning = false;

  get W(): number {
    return view.w;
  }

  get H(): number {
    return view.h;
  }

  /** Call from create(). Return true from the handler to consume the back press. */
  protected handleBack(fn: () => boolean): void {
    this.unregisterBack?.();
    this.unregisterBack = services.platform?.onBack(() => (this.scene.isActive() ? fn() : false));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unregisterBack?.();
      this.unregisterBack = undefined;
    });
  }

  protected fadeIn(ms = 300): void {
    this.cameras.main.fadeIn(ms, 11, 10, 20);
  }

  /** Fade out then start another scene (stopping this one). */
  goTo(key: string, data?: object, ms = 280): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(ms, 11, 10, 20);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(key, data);
    });
  }
}
```

`src/scenes/BootScene.ts`:

```typescript
import Phaser from 'phaser';
import { Preferences } from '@capacitor/preferences';
import { AudioManager } from '@/core/audio';
import { detectLang, setLang } from '@/core/i18n';
import { Platform } from '@/core/platform';
import { SaveStore, type StorageLike } from '@/core/save';
import { services } from '@/core/services';
import { loadSettings } from '@/core/settings';
import { view } from '@/core/viewport';
import { createHiResSkin } from '@/ui/skin';
import { createUiTextures, FONT, fontSuffix } from '@/ui/theme';

function browserStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Loads the fonts, wires up the services (settings, saves, platform, audio) and hands over to Preload. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    const sfx = fontSuffix(view.res);
    for (const key of Object.values(FONT)) {
      this.load.bitmapFont(key, `assets/fonts/${key}${sfx}.png`, `assets/fonts/${key}${sfx}.fnt`);
    }
  }

  async create(): Promise<void> {
    createUiTextures(this);
    createHiResSkin(this);
    const storage = browserStorage();
    const settings = loadSettings(storage, detectLang());
    services.settings = settings;
    setLang(settings.lang);
    const saves = new SaveStore(storage, (key, value) => {
      Preferences.set({ key, value }).catch((err) => console.warn('[save] native write failed', err));
    });
    services.saves = saves;
    const platform = new Platform();
    platform.hapticsEnabled = settings.vibration;
    services.platform = platform;
    const audio = new AudioManager(this.game);
    audio.setMusicVolume(settings.musicVol);
    audio.setSfxVolume(settings.sfxVol);
    services.audio = audio;
    await platform.init();
    await saves.restoreFromNative(async (key) => (await Preferences.get({ key })).value);
    this.scene.start('Preload');
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
const ATLASES = ['heroes', 'actors', 'props'];

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

`src/scenes/SplashScene.ts`:

```typescript
import { BaseScene } from './BaseScene';
import { t } from '@/core/i18n';
import { COLORS, FONT } from '@/ui/theme';

/** Title card shown at launch; tap to skip. */
export class SplashScene extends BaseScene {
  constructor() {
    super('Splash');
  }

  create(): void {
    this.transitioning = false;
    this.cameras.main.setBackgroundColor(COLORS.bg0);
    const cx = this.W / 2;
    const cy = this.H / 2;
    const title = this.add.bitmapText(cx, cy - 8, FONT.title, t('gameTitle').toUpperCase()).setOrigin(0.5).setScale(3).setTint(COLORS.gold).setAlpha(0);
    const sub = this.add.bitmapText(cx, cy + 34, FONT.head, t('subtitle')).setOrigin(0.5).setTint(COLORS.textDim).setAlpha(0);
    this.tweens.add({ targets: [title, sub], alpha: 1, duration: 600, ease: 'Sine.easeOut' });
    const next = () => this.goTo('Menu', {}, 400);
    this.time.delayedCall(1800, next);
    this.input.once('pointerdown', next);
  }
}
```

`src/scenes/MenuScene.ts`:

```typescript
import { BaseScene } from './BaseScene';
import { t } from '@/core/i18n';
import { Rng } from '@/core/rng';
import { services } from '@/core/services';
import { COLORS, FONT } from '@/ui/theme';
import { confirm, showModal } from '@/ui/modal';
import { Button, label, toast } from '@/ui/widgets';

export const GAME_VERSION = '0.1.0';

/** Main menu: Continue / New Game / Share / Rate. Settings and About arrive with the menu polish phase. */
export class MenuScene extends BaseScene {
  constructor() {
    super('Menu');
  }

  create(): void {
    this.transitioning = false;
    this.fadeIn(400);
    this.buildBackground();
    this.buildTitle();
    this.buildButtons();
    label(this, this.W - 6, this.H - 6, t('version', { v: GAME_VERSION }), FONT.small, COLORS.textDim, 1, 1).setAlpha(0.7);
    this.handleBack(() => {
      confirm(this, t('quitConfirm'), '', () => void services.platform?.exitApp());
      return true;
    });
  }

  private buildBackground(): void {
    const { W, H } = this;
    const sea = this.add.graphics();
    sea.fillGradientStyle(0x0d3a5c, 0x0d3a5c, 0x050f1c, 0x050f1c, 1);
    sea.fillRect(0, 0, W, H);
    this.add.image(W / 2, H / 2, 'fx_vignette').setDisplaySize(W * 1.3, H * 1.2).setAlpha(0.9);
  }

  private buildTitle(): void {
    const { W, H } = this;
    const y = Math.round(H * 0.2);
    const glow = this.add.image(W / 2, y + 4, 'fx_light').setTint(0x4fb3e8).setBlendMode('ADD').setAlpha(0.4);
    glow.setDisplaySize(W * 1.2, 120);
    this.tweens.add({ targets: glow, alpha: 0.2, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const title = this.add.bitmapText(W / 2, y, FONT.title, t('gameTitle').toUpperCase()).setOrigin(0.5).setScale(3).setTint(COLORS.gold);
    this.tweens.add({ targets: title, y: y - 3, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    label(this, W / 2, y + 38, t('subtitle').toUpperCase(), FONT.head, 0xbfe6ff, 0.5, 0.5);
  }

  private buildButtons(): void {
    const { W, H } = this;
    const latest = services.saves?.latest() ?? null;
    const bw = Math.min(200, W - 80);
    let y = Math.round(H * 0.52);
    const step = 40;
    const buttons: Button[] = [];
    if (latest !== null) {
      buttons.push(new Button(this, W / 2, y, t('menuContinue'), () => this.goTo('Game', { slot: latest }), { w: bw, h: 32, style: 'primary' }));
      y += step;
    }
    buttons.push(new Button(this, W / 2, y, t('menuNewGame'), () => this.newGame(), { w: bw, h: 32, style: latest === null ? 'primary' : 'normal' }));
    y += step;
    const half = Math.floor((bw - 6) / 2);
    buttons.push(new Button(this, W / 2 - half / 2 - 3, y, t('menuShare'), () => void this.share(), { w: half, h: 28, font: FONT.small }));
    buttons.push(new Button(this, W / 2 + half / 2 + 3, y, t('menuRate'), () => this.rate(), { w: half, h: 28, font: FONT.small }));
    buttons.forEach((b, i) => {
      b.setAlpha(0);
      b.y += 10;
      this.tweens.add({ targets: b, alpha: 1, y: b.y - 10, delay: 250 + i * 70, duration: 300, ease: 'Back.easeOut' });
    });
  }

  private newGame(): void {
    const saves = services.saves;
    if (!saves) return;
    const { slot, overwrites } = saves.slotForNewGame();
    const start = () => this.goTo('Game', { slot, seed: Rng.seedFromTime() });
    if (overwrites) confirm(this, t('menuNewGame'), t('newGameConfirm'), start, true);
    else start();
  }

  private async share(): Promise<void> {
    const ok = await services.platform?.share(t('gameTitle'), t('shareText'));
    if (ok && !services.platform?.native) toast(this, t('ok'));
  }

  private rate(): void {
    showModal(this, t('rateTitle'), t('rateBody'), [
      { label: t('later') },
      { label: t('rateNow'), style: 'primary', onClick: () => void services.platform?.rate() },
    ]);
  }
}
```

`src/scenes/NotifyScene.ts`:

```typescript
import Phaser from 'phaser';
import { services } from '@/core/services';
import { view } from '@/core/viewport';
import { nine } from '@/ui/skin';
import { COLORS, FONT } from '@/ui/theme';

interface Pending {
  text: string;
  color: number;
}

/** Always-on overlay for toasts (quest updates, new day). Queues messages so they never overlap. */
export class NotifyScene extends Phaser.Scene {
  private queue: Pending[] = [];
  private busy = false;

  constructor() {
    super({ key: 'Notify', active: false });
  }

  create(): void {
    services.notify = (text, color = COLORS.gold) => {
      this.queue.push({ text, color });
      if (!this.busy) this.next();
    };
  }

  /** Toasts sit under the HUD bar while playing and at the very top of menus. */
  private toastY(): number {
    const top = this.game.scene.getScenes(true).filter((sc) => sc !== this).pop();
    return top && (top.scene.key === 'Game' || top.scene.key === 'Hud') ? 58 : 18;
  }

  private next(): void {
    const item = this.queue.shift();
    if (!item) {
      this.busy = false;
      return;
    }
    this.busy = true;
    this.scene.bringToTop();
    const W = view.w;
    const y = this.toastY();
    const txt = this.add.bitmapText(W / 2, y, FONT.body, item.text).setOrigin(0.5).setTint(item.color).setMaxWidth(W - 60).setCenterAlign();
    const bg = nine(this, W / 2, y, 'ui_panel_ornate', Math.min(W - 24, txt.width + 28), txt.height + 14);
    this.children.bringToTop(txt);
    const objs = [bg, txt];
    for (const o of objs) {
      o.setAlpha(0);
      o.y -= 16;
    }
    this.tweens.add({ targets: objs, alpha: 1, y: '+=16', duration: 220, ease: 'Back.easeOut' });
    this.time.delayedCall(2000, () => {
      this.tweens.add({
        targets: objs, alpha: 0, y: '-=12', duration: 220,
        onComplete: () => {
          objs.forEach((o) => o.destroy());
          this.next();
        },
      });
    });
  }
}
```

- [ ] **Step 2: Write the scene list and entry point**

For now the list holds only the shell scenes; Task 15 adds `Game` and `Hud`.

`src/scenes/index.ts`:

```ts
import { BootScene } from './BootScene';
import { PreloadScene } from './PreloadScene';
import { SplashScene } from './SplashScene';
import { MenuScene } from './MenuScene';
import { NotifyScene } from './NotifyScene';

export const SCENES = [BootScene, PreloadScene, SplashScene, MenuScene, NotifyScene];
```

`src/main.ts`:

```typescript
import Phaser from 'phaser';
import { SCENES } from './scenes';
import { AUTO_LOW_KEY, autoQuality, computeViewport, savedHiRes, savedTextScale, setView, view } from './core/viewport';
import { installBitmapTextDefaults, setTextScale } from './ui/theme';

const hiRes = savedHiRes();
const vp = computeViewport(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1, hiRes);
setView(vp);
setTextScale(savedTextScale());
installBitmapTextDefaults(vp.res);

/** Every scene's main camera zooms by the render scale, so all layout code keeps working in virtual pixels. */
class HiResCamera extends Phaser.Plugins.ScenePlugin {
  boot(): void {
    this.systems!.events.on(Phaser.Scenes.Events.START, this.apply, this);
  }

  apply(): void {
    this.scene!.cameras.main.setOrigin(0, 0).setZoom(view.res);
  }
}

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  width: vp.width * vp.res,
  height: vp.height * vp.res,
  backgroundColor: '#0b0a14',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: { mode: Phaser.Scale.NONE, zoom: vp.zoom },
  input: { activePointers: 4 },
  fps: { target: 60, smoothStep: true },
  render: { powerPreference: 'high-performance', batchSize: 4096 },
  audio: { disableWebAudio: false },
  scene: SCENES,
  plugins: { scene: [{ key: 'HiResCamera', plugin: HiResCamera, mapping: 'hiResCamera' }] },
});

let resizeTimer: ReturnType<typeof setTimeout> | null = null;
window.addEventListener('resize', () => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const next = computeViewport(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1, hiRes);
    setView(next);
    game.scale.setZoom(next.zoom);
    game.scale.resize(next.width * next.res, next.height * next.res);
  }, 150);
});

// Frame-rate guard: if hi-res rendering runs slowly on this device (and the player never picked a quality),
// remember that and restart once in the lighter pixel-resolution mode.
if (hiRes && vp.res > 1 && autoQuality()) {
  setTimeout(() => {
    const samples: number[] = [];
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      samples.push(game.loop.actualFps);
      if (samples.length < 8) return;
      clearInterval(id);
      const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
      if (avg < 32) {
        try {
          localStorage.setItem(AUTO_LOW_KEY, '1');
        } catch {
          return;
        }
        window.location.reload();
      }
    }, 500);
  }, 6000);
}

// Debug and automated-test hooks: dev server and QA builds only.
if (import.meta.env.DEV || import.meta.env.VITE_QA === '1') {
  (window as unknown as { __game: Phaser.Game }).__game = game;
  const errs: string[] = [];
  (window as unknown as { __errs: string[] }).__errs = errs;
  window.addEventListener('error', (e) => errs.push(String((e.error as Error | undefined)?.stack ?? e.message)));
  window.addEventListener('unhandledrejection', (e) => errs.push(String((e.reason as Error | undefined)?.stack ?? e.reason)));
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 4: Add the browser driver and the boot scenario**

```bash
cp "E:/Roguelike Opus 55/tools/play.mjs" tools/play.mjs
mkdir -p tools/scripts tools/.cache
```

In `tools/play.mjs`, add a keyboard step. Replace the line `    } else if (s.until) {` with:

```js
    } else if (s.press) {
      await page.keyboard.down(s.press);
      await page.waitForTimeout(s.ms ?? 300);
      await page.keyboard.up(s.press);
    } else if (s.until) {
```

Also update the header comment of the file to list `{"press": "ArrowRight", "ms": 800}` among the steps. Then create `tools/scripts/boot.json`:

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

- [ ] **Step 5: Run the boot scenario**

In one terminal: `npm run dev` (leave it running; it serves `http://localhost:5188`). In another:

```bash
node tools/play.mjs tools/scripts/boot.json tools/.cache/shots
```

Expected output: `shot menu`, then `eval -> []` and `page errors: []`, with no `[http 404]` or `[console.error]` lines. Open `tools/.cache/shots/menu.png` with the Read tool. Expected picture: a dark-blue sea gradient with a vignette, a gold `TIDEWAKE` title with a subtitle `ISLAND SURVIVAL` below, an orange primary `New Game` button, and small `Share` and `Rate` buttons under it. There is no `Continue` button on a fresh browser profile. If fonts look blurry or missing, re-check that `public/assets/fonts` was copied (Task 9) and the console for 404s.

- [ ] **Step 6: Commit**

```bash
git add src tools/play.mjs tools/scripts/boot.json
git commit -m "feat: add app shell scenes (boot, preload, splash, menu) and browser driver"
```

---

### Task 13: Terrain and object renderers

**Files:**
- Create: `src/gfx/TerrainLayer.ts`, `src/gfx/WorldObjects.ts`

**Interfaces:**
- Consumes: `groundFrame`, `shoreMask`, `SHORE_*` (Task 10), `TILES_KEY` (Task 10), `LANDMARK_PROPS` (Task 11), `resourceFrame` (Task 4), the `props` atlas.
- Produces: `TILE = 16`; `new TerrainLayer(scene, world)` (two culled tilemap layers: ground at depth -100, foam shoreline at -90); `new WorldObjects(scene, world)` with `setAlive(id, alive, animate?)` and `shake(id)`. Objects are y-sorted: depth equals the world y of the sprite's base.

Rendering is checked visually in Task 15 once the game scene exists; this task ends at the typecheck.

- [ ] **Step 1: Write the terrain layer**

`src/gfx/TerrainLayer.ts`:

```typescript
import Phaser from 'phaser';
import { TILES_KEY } from '@/data/terrainTiles';
import { groundFrame, shoreMask, SHORE_E, SHORE_N, SHORE_S, SHORE_W } from '@/sim/tileView';
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

  constructor(scene: Phaser.Scene, world: World) {
    createShoreTexture(scene);
    const size = world.size;
    const groundData: number[][] = [];
    const shoreData: number[][] = [];
    for (let y = 0; y < size; y++) {
      const g: number[] = [];
      const s: number[] = [];
      for (let x = 0; x < size; x++) {
        g.push(groundFrame(world.terrain[idx(x, y, size)], x, y));
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

- [ ] **Step 2: Write the world objects**

`src/gfx/WorldObjects.ts`:

```typescript
import Phaser from 'phaser';
import { LANDMARK_PROPS } from '@/data/landmarkProps';
import { resourceFrame } from '@/data/resources';
import { TILE } from '@/gfx/TerrainLayer';
import type { World } from '@/sim/world/types';

/**
 * Sprites for every resource node and landmark prop. Objects are y-sorted by their base line (depth = world y of the
 * feet), so the player walks behind trees that are further south. Phaser culls the ones off screen.
 */
export class WorldObjects {
  private sprites = new Map<number, Phaser.GameObjects.Image>();

  constructor(private scene: Phaser.Scene, world: World) {
    for (const n of world.resources) {
      const x = (n.x + 0.5) * TILE;
      const y = (n.y + 1) * TILE - 1;
      const img = scene.add.image(x, y, 'props', resourceFrame(n.kind, n.variant)).setOrigin(0.5, 1).setDepth(y);
      this.sprites.set(n.id, img);
    }
    for (const l of world.landmarks) {
      for (const p of LANDMARK_PROPS[l.id]) {
        const x = (l.x + p.dx + 0.5) * TILE;
        const y = (l.y + p.dy + 1) * TILE - 1;
        const obj = p.anim ? scene.add.sprite(x, y, 'props', p.frame).play(p.anim) : scene.add.image(x, y, 'props', p.frame);
        obj.setOrigin(0.5, 1).setDepth(y);
      }
    }
  }

  /** Show or hide a node. Destroyed nodes shrink away; `animate` is off when restoring a save. */
  setAlive(id: number, alive: boolean, animate = true): void {
    const s = this.sprites.get(id);
    if (!s) return;
    this.scene.tweens.killTweensOf(s);
    s.setAngle(0);
    if (alive) {
      s.setVisible(true).setAlpha(1).setScale(1);
      return;
    }
    if (!animate) {
      s.setVisible(false);
      return;
    }
    this.scene.tweens.add({
      targets: s, alpha: 0, scaleX: 0.6, scaleY: 0.6, duration: 160,
      onComplete: () => s.setVisible(false),
    });
  }

  /** Quick sway when a node is hit. */
  shake(id: number): void {
    const s = this.sprites.get(id);
    if (!s) return;
    this.scene.tweens.killTweensOf(s);
    s.setAngle(0);
    this.scene.tweens.add({
      targets: s, angle: { from: -4, to: 4 }, duration: 45, yoyo: true, repeat: 1,
      onComplete: () => s.setAngle(0),
    });
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/gfx/TerrainLayer.ts src/gfx/WorldObjects.ts
git commit -m "feat: add tilemap terrain layer and y-sorted world objects"
```

---

### Task 14: Player, controls and joystick

**Files:**
- Create: `src/game/input.ts`, `src/entities/Player.ts`, `src/ui/Joystick.ts`

**Interfaces:**
- Consumes: `TILE` (Task 13), `snapWorld`, `view`, `vx`, `vy` (Task 8), `dirFromVector` and `Dir` (Task 9), `Vec` (Task 6).
- Produces: `controls {moveX, moveY, action}`, `resetControls()`, `takeAction() -> boolean` (one-shot); `new Player(scene, pos, skin?)` with `update(pos, move)`, `face(dx, dy)`, `punch()`, `facing`, `sprite`; `new Joystick(scene, mode: () => 'floating' | 'fixed')` which writes into `controls` and ignores touches that land on a button or open dialog.

- [ ] **Step 1: Write the controls state**

`src/game/input.ts`:

```typescript
/** Virtual-controller state written by the HUD (touch) and read by the world scene every frame. */
export interface ControlState {
  /** Joystick direction, each axis in [-1, 1]. */
  moveX: number;
  moveY: number;
  /** One-shot: the ACTION button was pressed since the last read. */
  action: boolean;
}

export const controls: ControlState = { moveX: 0, moveY: 0, action: false };

export function resetControls(): void {
  controls.moveX = 0;
  controls.moveY = 0;
  controls.action = false;
}

/** Consume a one-shot button press. */
export function takeAction(): boolean {
  const v = controls.action;
  controls.action = false;
  return v;
}
```

- [ ] **Step 2: Write the player entity**

`src/entities/Player.ts`:

```typescript
import Phaser from 'phaser';
import { snapWorld } from '@/core/viewport';
import { dirFromVector, type Dir } from '@/gfx/animations';
import { TILE } from '@/gfx/TerrainLayer';
import type { Vec } from '@/sim/movement';

/** Where the hero's feet are inside a 32x32 hero frame (the body spans y 5..25). */
const FEET_Y = 25 / 32;

export class Player {
  readonly sprite: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private dir: Dir = 'down';
  private moving = false;

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

  /** Short squash used as feedback for a hit. */
  punch(): void {
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.setScale(1);
    this.scene.tweens.add({ targets: this.sprite, scaleX: 1.14, scaleY: 0.88, duration: 70, yoyo: true });
  }
}
```

- [ ] **Step 3: Write the joystick**

`src/ui/Joystick.ts`:

```typescript
import Phaser from 'phaser';
import { controls } from '@/game/input';
import { view, vx, vy } from '@/core/viewport';

/** Thumb travel (virtual px) and the radii where movement starts and reaches full speed. */
const MAX = 34;
const DEAD = 4;
const FULL = 22;

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
    if (x > view.w * 0.6 || y < view.h * 0.35) return;
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

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/game/input.ts src/entities/Player.ts src/ui/Joystick.ts
git commit -m "feat: add player entity, shared controls and touch joystick"
```

---

### Task 15: The playable island (game scene and HUD)

**Files:**
- Create: `src/scenes/GameScene.ts`, `src/scenes/HudScene.ts`
- Modify: `src/scenes/index.ts`
- Create: `tools/scripts/island.json`, `harvest.json`, `persist.json`, `night.json`, `pause.json`, `corrupt.json`

**Interfaces:**
- Consumes: all earlier tasks.
- Produces: scene `Game` started with `GameInit {slot, seed?}` (a `seed` means New Game). Public on `GameScene` for tests and the HUD: `world`, `clock`, `bag`, `pos`, `saveNow()`, `quitToMenu()`. Scene `Hud` (started by `Game` with `{ game }`) with `openMenu()` (pauses the island and shows Resume / Save & Quit). Autosave every 15 seconds, on the browser `hidden` event and on scene shutdown.

- [ ] **Step 1: Write the game scene**

Behavior in one place: build the world from the seed (or the slot's seed on Continue), draw terrain and objects, move the hero with keyboard or joystick against `moveWithCollision`, hit the nearest node in reach on ACTION, drop items into `bag`, advance the clock, regrow nodes on a new day (never under the hero), snap the camera to device pixels, and autosave.

`src/scenes/GameScene.ts`:

```typescript
import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import type { HudScene } from './HudScene';
import { Player } from '@/entities/Player';
import { Rng, hashString } from '@/core/rng';
import { newSlot, type SaveSlot } from '@/core/save';
import { services } from '@/core/services';
import { worldZoom } from '@/core/viewport';
import { t } from '@/core/i18n';
import { TerrainLayer, TILE } from '@/gfx/TerrainLayer';
import { WorldObjects } from '@/gfx/WorldObjects';
import { controls, resetControls, takeAction } from '@/game/input';
import { advance, newClock, type Clock } from '@/sim/daynight';
import { hitNode, isAlive, startNewDay, type GatherState } from '@/sim/gather';
import { nearestNode } from '@/sim/interact';
import { moveWithCollision, speedFactor, type Vec } from '@/sim/movement';
import { nodesByTile, propSolidTiles } from '@/sim/solids';
import { generateWorld } from '@/sim/world/generate';
import { idx, type ResourceNode, type World } from '@/sim/world/types';
import { COLORS, FONT } from '@/ui/theme';

/** Walking speed in tiles per second. */
const PLAYER_SPEED = 3.4;
/** How far (tiles) the hero can reach to hit a resource, and the pause between hits (seconds). */
const HIT_REACH = 1.4;
const HIT_COOLDOWN = 0.35;
const AUTOSAVE_SECONDS = 15;
const MAX_STEP = 0.05;
/** A destroyed node will not grow back while the hero stands this close (tiles). */
const REGROW_CLEARANCE = 1.5;

export interface GameInit {
  slot: number;
  /** Present for a New Game; absent when continuing a saved slot. */
  seed?: number;
}

/** The island: terrain, resources, the hero, time of day and saving. The HUD runs in its own scene on top. */
export class GameScene extends BaseScene {
  world!: World;
  clock: Clock = newClock();
  bag: Record<string, number> = {};
  pos: Vec = { x: 0, y: 0 };

  private slotData!: SaveSlot;
  private gather!: GatherState;
  private playTime = 0;
  private lastDay = 1;
  private cooldown = 0;
  private saveTimer = 0;
  private nodes!: Map<number, ResourceNode>;
  private solids = new Set<number>();
  private objects!: WorldObjects;
  private player!: Player;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
  private actionKeys: Phaser.Input.Keyboard.Key[] = [];

  constructor() {
    super('Game');
  }

  create(data: GameInit): void {
    this.transitioning = false;
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

    this.clock = this.slotData.clock;
    this.gather = this.slotData.gather;
    this.bag = this.slotData.bag;
    this.playTime = this.slotData.playTimeSec;
    this.pos = { ...this.slotData.player };
    this.lastDay = this.clock.day;
    this.cooldown = 0;
    this.saveTimer = 0;

    this.nodes = nodesByTile(this.world);
    this.solids = new Set(propSolidTiles(this.world));
    new TerrainLayer(this, this.world);
    this.objects = new WorldObjects(this, this.world);
    for (const n of this.world.resources) {
      if (isAlive(this.gather, n.id)) this.solids.add(idx(n.x, n.y, this.world.size));
      else this.objects.setAlive(n.id, false, false);
    }
    this.player = new Player(this, this.pos);

    this.setupCamera();
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
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, MAX_STEP);
    this.clock = advance(this.clock, dt);
    this.playTime += dt;
    if (this.clock.day !== this.lastDay) this.onNewDay();

    const move = this.readMove();
    if (move.x !== 0 || move.y !== 0) {
      const speed = PLAYER_SPEED * speedFactor(this.world, this.pos.x, this.pos.y);
      this.pos = moveWithCollision(this.world, this.solids, this.pos, move.x * speed * dt, move.y * speed * dt);
    }
    this.player.update(this.pos, move);

    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.consumeAction() && this.cooldown === 0) this.tryHit();

    this.followCamera();
    this.saveTimer += dt;
    if (this.saveTimer >= AUTOSAVE_SECONDS) this.saveNow();
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

  private tryHit(): void {
    this.cooldown = HIT_COOLDOWN;
    const node = nearestNode(this.nodes, this.world.size, this.pos, HIT_REACH, (id) => isAlive(this.gather, id));
    if (node) this.player.face(node.x + 0.5 - this.pos.x, node.y + 0.5 - this.pos.y);
    this.player.punch();
    if (!node) return;
    const rng = new Rng(hashString(`${this.slotData.seed}:${node.id}:${this.gather.hp[node.id] ?? 'full'}`));
    const result = hitNode(this.gather, node, 1, this.clock.day, rng);
    this.gather = result.state;
    this.objects.shake(node.id);
    services.platform?.haptic('light');
    if (result.destroyed) {
      this.solids.delete(idx(node.x, node.y, this.world.size));
      this.objects.setAlive(node.id, false);
    }
    result.drops.forEach((d, i) => {
      this.bag = { ...this.bag, [d.item]: (this.bag[d.item] ?? 0) + d.amount };
      this.floatText(`+${d.amount} ${t(`item_${d.item}`)}`, i);
    });
  }

  /** Nodes that were gone may grow back; the ones next to the hero wait for tomorrow. */
  private onNewDay(): void {
    const day = this.clock.day;
    this.lastDay = day;
    const before = this.gather;
    this.gather = startNewDay(this.gather, day, (id) => this.heroIsNear(id));
    for (const key of Object.keys(before.gone)) {
      const id = Number(key);
      if (!isAlive(this.gather, id)) continue;
      const n = this.world.resources[id];
      this.objects.setAlive(id, true);
      this.solids.add(idx(n.x, n.y, this.world.size));
    }
    services.notify?.(t('hudDay', { n: day }));
    this.saveNow();
  }

  private heroIsNear(id: number): boolean {
    const n = this.world.resources[id];
    return Math.hypot(n.x + 0.5 - this.pos.x, n.y + 0.5 - this.pos.y) < REGROW_CLEARANCE;
  }

  private floatText(text: string, row: number): void {
    const x = this.pos.x * TILE;
    const y = this.pos.y * TILE - 26 - row * 8;
    const label = this.add.bitmapText(x, y, FONT.small, text).setOrigin(0.5).setTint(COLORS.gold).setScale(0.5).setDepth(1_000_000);
    this.tweens.add({ targets: label, y: y - 14, alpha: 0, duration: 900, ease: 'Sine.easeOut', onComplete: () => label.destroy() });
  }

  /** Centre on the hero, then snap to whole device pixels so pixel art does not shimmer. */
  private followCamera(): void {
    const cam = this.cameras.main;
    cam.centerOn(this.pos.x * TILE, this.pos.y * TILE);
    const k = worldZoom(2);
    cam.scrollX = Math.round(cam.scrollX * k) / k;
    cam.scrollY = Math.round(cam.scrollY * k) / k;
  }

  private snapshot(): SaveSlot {
    return {
      ...this.slotData,
      player: { x: this.pos.x, y: this.pos.y },
      bag: this.bag,
      clock: this.clock,
      gather: this.gather,
      playTimeSec: this.playTime,
    };
  }

  saveNow(): void {
    this.saveTimer = 0;
    services.saves?.write(this.snapshot());
  }

  quitToMenu(): void {
    this.saveNow();
    this.goTo('Menu');
  }
}
```

- [ ] **Step 2: Write the HUD scene**

`src/scenes/HudScene.ts`:

```typescript
import Phaser from 'phaser';
import type { GameScene } from './GameScene';
import { t } from '@/core/i18n';
import { services } from '@/core/services';
import { view } from '@/core/viewport';
import { controls } from '@/game/input';
import { clockLabel, lighting } from '@/sim/daynight';
import { showModal } from '@/ui/modal';
import { Joystick } from '@/ui/Joystick';
import { COLORS, FONT } from '@/ui/theme';
import { Button } from '@/ui/widgets';

/** Heads-up display on top of the island: time, materials, joystick, ACTION and pause buttons, plus the night shade. */
export class HudScene extends Phaser.Scene {
  private world!: GameScene;
  private shade!: Phaser.GameObjects.Rectangle;
  private dayText!: Phaser.GameObjects.BitmapText;
  private bagText!: Phaser.GameObjects.BitmapText;
  private lastDay = '';
  private lastBag = '';
  private menuOpen = false;

  constructor() {
    super('Hud');
  }

  create(data: { game: GameScene }): void {
    this.world = data.game;
    this.menuOpen = false;
    this.lastDay = '';
    this.lastBag = '';
    const { w: W, h: H } = view;
    // The night shade sits under every HUD element, so buttons and text are never darkened.
    this.shade = this.add.rectangle(0, 0, W, H, 0x0a1030, 0).setOrigin(0, 0).setDepth(0);
    this.dayText = this.add.bitmapText(8, 8, FONT.body, '').setTint(COLORS.text).setDepth(5);
    this.bagText = this.add.bitmapText(8, 28, FONT.small, '').setTint(COLORS.textDim).setDepth(5);
    new Button(this, W - 24, 22, 'II', () => this.openMenu(), { w: 34, h: 28 }).setDepth(6);
    new Button(this, W - 52, H - 90, t('hitAction'), () => {
      controls.action = true;
    }, { w: 68, h: 68, style: 'primary' }).setDepth(6);
    new Joystick(this, () => services.settings?.joystick ?? 'floating');
  }

  /** Pause dialog: the island stops while it is open. Also used for the Android back button. */
  openMenu(): void {
    if (this.menuOpen) return;
    this.menuOpen = true;
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

  update(): void {
    const w = this.world;
    const day = `${t('hudDay', { n: w.clock.day })}  ${clockLabel(w.clock)}`;
    if (day !== this.lastDay) {
      this.lastDay = day;
      this.dayText.setText(day);
    }
    const bag = Object.entries(w.bag)
      .filter(([, n]) => n > 0)
      .map(([id, n]) => `${t(`item_${id}`)} ${n}`)
      .join('\n');
    if (bag !== this.lastBag) {
      this.lastBag = bag;
      this.bagText.setText(bag);
    }
    const light = lighting(w.clock);
    this.shade.setFillStyle(light.color, light.alpha);
  }
}
```

- [ ] **Step 3: Register the new scenes**

Replace `src/scenes/index.ts` with:

`src/scenes/index.ts`:

```typescript
import { BootScene } from './BootScene';
import { PreloadScene } from './PreloadScene';
import { SplashScene } from './SplashScene';
import { MenuScene } from './MenuScene';
import { GameScene } from './GameScene';
import { HudScene } from './HudScene';
import { NotifyScene } from './NotifyScene';

export const SCENES = [BootScene, PreloadScene, SplashScene, MenuScene, GameScene, HudScene, NotifyScene];
```

- [ ] **Step 4: Typecheck and run the unit tests**

Run: `npm run typecheck && npm test`
Expected: both exit 0.

- [ ] **Step 5: Write the smoke scenarios**

Create these six files in `tools/scripts/`. Each starts from a clean browser profile.

`tools/scripts/island.json` (new game, look around, walk, hit the shore):

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

`tools/scripts/harvest.json` (teleport next to a tree and hit it six times):

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
    "eval": "JSON.stringify(__game.scene.getScene('Game').bag)"
  },
  {
    "shot": "after-hits"
  },
  {
    "eval": "JSON.stringify(window.__errs)"
  }
]
```

`tools/scripts/persist.json` (harvest, save, reload the page, Continue, compare state):

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
    "eval": "(() => { const g = __game.scene.getScene('Game'); return JSON.stringify({ pos: g.pos, bag: g.bag, gone: Object.keys(g.gather.gone).length, day: g.clock.day }); })()"
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
    "eval": "(() => { const g = __game.scene.getScene('Game'); return JSON.stringify({ pos: g.pos, bag: g.bag, gone: Object.keys(g.gather.gone).length, day: g.clock.day }); })()"
  },
  {
    "shot": "continued"
  },
  {
    "eval": "JSON.stringify(window.__errs)"
  }
]
```

`tools/scripts/night.json` (dusk, night and a new day):

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
    "eval": "__game.scene.getScene('Game').clock = { day: 1, t: 540 }"
  },
  {
    "wait": 400
  },
  {
    "shot": "dusk"
  },
  {
    "eval": "__game.scene.getScene('Game').clock = { day: 1, t: 600 * 0.9 }"
  },
  {
    "wait": 400
  },
  {
    "shot": "night"
  },
  {
    "eval": "__game.scene.getScene('Game').clock = { day: 1, t: 599.9 }"
  },
  {
    "wait": 700
  },
  {
    "shot": "new-day"
  },
  {
    "eval": "JSON.stringify(__game.scene.getScene('Game').clock)"
  },
  {
    "eval": "JSON.stringify(window.__errs)"
  }
]
```

`tools/scripts/pause.json` (the island freezes while paused):

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
    "eval": "JSON.stringify(__game.scene.getScene('Game').clock)"
  },
  {
    "wait": 1500
  },
  {
    "eval": "JSON.stringify(__game.scene.getScene('Game').clock)"
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

`tools/scripts/corrupt.json` (both copies of slot 0 are garbage):

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

- [ ] **Step 6: Run the scenarios and check each result**

With `npm run dev` running, run each and inspect the printed values and screenshots (open the PNGs with the Read tool):

```bash
for s in island harvest persist night pause corrupt; do echo "=== $s ==="; node tools/play.mjs tools/scripts/$s.json tools/.cache/shots; done
```

Expected for every scenario: the last lines are `page errors: []` and there are no `[http ...]` or `[console.error]` lines. Then, per scenario:

- **island**: `island-start.png` shows the hero sprite standing on a beige beach, blue water below, green grass and green trees above, a few crates and a barrel beside the hero, a campfire further north, `Day 1  10:48` at the top left, a `II` button top right, a round orange `HIT` button bottom right and a faint joystick ring bottom left. Water edges have a thin white foam line. `island-walked.png` has the hero further north (the second printed position has a smaller `y` than the first, about 5 tiles less unless a tree blocked it). The last printed line must say `tile under hero = N` where `N` is not `0`: holding Down for 4 seconds must stop at the water's edge, never walk into deep water.
- **harvest**: the `eval` after the hits prints a bag like `{"wood":3}` (wood count at least 2). `before-hit.png` shows the hero in front of a tree; `after-hits.png` shows the tree gone and the hero still standing there.
- **persist**: the two state lines (before saving and after Continue) print the same `pos` (within 0.05), the same `bag`, the same `gone` count and `day`. `menu-with-continue.png` now shows a `Continue` button above `New Game`.
- **night**: `dusk.png` is slightly tinted and darker, `night.png` is clearly dark blue with the HUD text still bright and readable, `new-day.png` shows a toast `Day 2` near the top and the last printed clock has `day: 2`.
- **pause**: the two clock lines are identical (the island did not tick while paused) and the next line says `Game paused: true`; `pause-menu.png` shows a dialog titled `Paused` with `Resume` and `Save & Quit`.
- **corrupt**: `menu-corrupt.png` has no `Continue` button; the last line says `Back at menu: true, game running: false`.

If a scenario fails, fix the cause in the relevant file (the unit tests keep the logic honest, so most problems will be in scene wiring), re-run the typecheck and tests, and re-run only that scenario. Typical culprits: a wrong tile or object offset (check `FEET_Y` in `Player.ts`, the origin `(0.5, 1)` in `WorldObjects.ts`), the camera centring (`setOrigin(0.5, 0.5)` in `GameScene.setupCamera`), or a tilemap whose layer is blank (check that `tiles.png` is served and `TILES_KEY` matches).

- [ ] **Step 7: Commit**

```bash
git add src/scenes tools/scripts
git commit -m "feat: add playable island scene with HUD, harvesting, day/night and autosave"
```

---

### Task 16: Phase gate

**Files:**
- Create: `README.md`
- Modify: none (fixes found here go into the file that owns them)

- [ ] **Step 1: Run the full test suite with coverage**

Run: `npm run test:cov`
Expected: all tests PASS; the coverage table ends with `All files` at or above 80% lines, statements and functions and 70% branches (the config fails the run otherwise).

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: `tsc` exits 0 and Vite prints the built files; the `phaser` chunk is separate. `dist/assets/` contains the fonts and pack atlases.

- [ ] **Step 3: Measure world start-up time and frame rate**

With `npm run dev` running, create `tools/scripts/perf.json`:

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

Run: `node tools/play.mjs tools/scripts/perf.json tools/.cache/shots`
Expected: tap-to-Game under 2500 ms (this includes the 280 ms fade and island generation) and `fps` at or above 55 in headless Edge. Write both numbers into the README (Step 5). If generation is the slowest item in the profile, note it for the performance work in plan 7; do not optimise it now.

- [ ] **Step 4: Check there are no secrets and no leftovers**

```bash
grep -rnE "(sk_[a-f0-9]{16}|r8_[A-Za-z0-9]{20}|msy_[A-Za-z0-9]{20})" src tools docs README.md package.json || echo "no secrets found"
git status --short
```

Expected: `no secrets found`; `git status` shows only intended untracked files (screenshots live in the ignored `tools/.cache`).

- [ ] **Step 5: Write the README**

`README.md` (fill the two measured numbers from Step 3):

```markdown
# Tidewake: Island Survival

Offline 2D pixel-art survival game for Android (Phaser 3 + TypeScript, packaged with Capacitor).
Design: `docs/superpowers/specs/2026-10-03-tidewake-design.md`. Plans: `docs/superpowers/plans/`.

## Run

    npm install
    npm run dev          # http://localhost:5188
    npm test             # unit tests
    npm run test:cov     # tests + coverage gate (80%)
    npm run build        # typecheck + production build into dist/

## Assets

Sprites are packed from the licensed Unity pack *Super Retro Collection* by Gif, read from
`E:\Pixel Games Asset Master` (never modified):

    npm run assets       # tools/pack_assets.py + tools/pack_tiles.py

Generated files in `public/assets/pack/` and `src/data/tileIndex.ts` are committed.

## Browser smoke tests

With `npm run dev` running: `node tools/play.mjs tools/scripts/<name>.json tools/.cache/shots`.

## Status (phase 1)

Walkable seed-generated island, harvesting, day/night, save and continue.
Measured on the dev PC (headless Edge): tap-to-game <N> ms, <N> fps.

## Credits

Pixel art: Super Retro Collection by Gif. Fonts: Jersey and Tiny5 (SIL OFL).
```

- [ ] **Step 6: Code review**

Dispatch the `code-reviewer` agent on everything since the first commit (`git diff $(git rev-list --max-parents=0 HEAD)..HEAD`), asking it to check against this plan's Global Constraints and Review Focus. Fix every CRITICAL and HIGH finding, fix MEDIUM findings where cheap, then re-run Steps 1 and 2.

- [ ] **Step 7: Commit and tag**

```bash
git add README.md tools/scripts/perf.json
git commit -m "docs: add README and phase 1 performance baseline"
git tag phase-1
```

Expected: `git log --oneline` shows one commit per task and `git tag` lists `phase-1`. Plan 2 (survival vitals, inventory and crafting) is written next, starting from this tag.

