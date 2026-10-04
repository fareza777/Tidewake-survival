# Tidewake Release (phase 7)

**Goal:** a build that can be installed and published: the Android project, the content the spec promises, guard rails on the balance, QA on the emulator, and the store assets.

**Spec:** section 10 (Testing and quality) and section 11, phase 7. Builds on tag `phase-6`. Built directly, test first.

## Done

- `android/` (Capacitor 8): package `com.fajar.tidewake`, portrait, dark window and system bars, launcher icons (plain, round, adaptive) and splash generated from `branding/` by `tools/make_android_assets.py`, optional signing through `TIDEWAKE_KEYSTORE_PROPS`.
- Content: the recipe book now has 60 or more recipes (`tests/recipes-content.test.ts` checks that every recipe can be made from things that can be got, that every station can be built, and that the unique keys are never consumed).
- Balance guard rails (`tests/balance.test.ts`); no tuning was needed.
- QA: debug APK installed and run in an emulator (Android 16, API 36); `tools/android-qa.mjs` drives it over the WebView debug socket.
- Store assets: `store/` and `branding/`; `docs/privacy-policy.md`.

## Measured against the checklist of section 10

| Item | Result |
|---|---|
| Unit and integration tests, 80% coverage of sim, data and core | all pass; about 96% of lines |
| Browser smoke scenarios | 32 scenarios, no page errors |
| App size under 80 MB (AAB) | release bundle about 6 MB; debug APK about 8 MB |
| Texture memory under 64 MB | about 20 MB of atlases and fonts, uncompressed |
| 60 fps on a mid-range phone | 58 fps in desktop Edge with 24 creatures; the emulator (software rendering, no GPU) shows only 13 fps and says nothing about a real phone, which still has to be tried by hand |
| Install and run on Android | runs in the emulator: boots, onboarding, New Game, intro, the island, with no page errors |

## Gold tier

The spec lists a gold tool tier; there is no gold in the game, and the crystal gear (sword and armor) takes its place at the top of the crafting tree.

## Review Focus

1. The Android project builds from a clean checkout with only the documented commands, and nothing secret or machine-specific is committed (`local.properties`, keystores, build outputs).
2. The new content is consistent: icons, names in both languages, recipes reachable, stacks and stats, potions and tonics, the alchemy table station, placeable furniture solidity and pickup rules; saves containing the new items load; old saves are unaffected.
3. The QA and store scripts do not depend on anything outside the repository, and the placeholders (privacy URL, contact address, store link) are flagged in one place each.
