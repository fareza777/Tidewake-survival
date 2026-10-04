# Tidewake Menus, Settings and Branding (phase 6)

**Goal:** every screen between launching the app and playing is final: language choice and onboarding on first launch, a main menu, a New Game screen with an intro, Settings, About, a one-time rating prompt, and the game's branding assets.

**Spec:** `docs/superpowers/specs/2026-10-03-tidewake-design.md` section 7 (App flow and screens) and section 9 (Branding). Builds on tag `phase-5`. Built directly, test first, like phase 5.

## What was built

- `core/newGame.ts` (hero name cleaning, seed from typed text), `core/flags.ts` (one-time flags), `core/settingsApply.ts` (apply and remember settings), `core/storage.ts`, `core/config.ts` (privacy and contact placeholders).
- Scenes: `OnboardingScene` (language, then three cards), `NewGameScene` (slot, name, seed, difficulty), `IntroScene` (skippable), `SettingsScene` (also opened from the pause menu), `AboutScene`; the menu gained Settings and About and a night-beach scene; the splash routes first launches to onboarding.
- The rating prompt after chapter 3 (`StoryDirector`), auto-attack (`GameScene`).
- Branding: `tools/make_branding.py` writes `branding/` (icon, adaptive icon layers, splash, feature graphic) and favicons in `public/`.

## Review Focus

1. **Flow cannot trap or loop.** First launch, language, onboarding, back button on each screen, skipping, coming back to the menu; the one-time flags behave when storage is blocked.
2. **Settings.** Every setting applies at once and is remembered; the two that need a restart (graphics, text size) ask; corrupt stored settings never crash; opening Settings from the pause menu keeps the island paused and resumes it on close, with no taps leaking through to the HUD; deleting saves.
3. **New Game.** Choosing an occupied slot asks before overwriting; name and seed text from `window.prompt` (null, huge, markup, empty) is made safe; the chosen difficulty and name really reach the save; hardcore; the intro can be skipped and a new game never starts twice.
4. **Prompts and links.** The rating prompt appears once and never over another dialogue; share and rate work in the browser fallback; privacy and contact are placeholders in one place.
5. **Text and layout.** Every string the player sees exists in English and Indonesian; screens fit a narrow phone (320 wide) with the longer Indonesian texts; no hard-coded English in scenes.
