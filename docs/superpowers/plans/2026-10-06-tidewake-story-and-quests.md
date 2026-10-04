# Tidewake Story and Quests (phase 5)

**Goal:** the island has people and a story: five islanders who talk, a ten-chapter main quest from the wreck to the lighthouse and its final boss, ten side quests, a quest log and a tracker, things to find (bottles, tablets, treasure, a lost cat), fishing, a raft, and two endings.

**Spec:** `docs/superpowers/specs/2026-10-03-tidewake-design.md` (section 6, Quests; section 11, phase 5). Builds on tag `phase-4`.

This phase was built directly in the repository, test first, without a pre-written code plan (the user asked for the remaining phases to be finished without further confirmation). This file records the design and the Review Focus given to the final reviewer.

## Design

- **Engine** (`src/sim/quests.ts`, pure): a quest has steps; a step asks for a named counter (`craft:axe_wood`, `kill:boar`, `talk:tali`, `night`, `dig`...) or for items in the backpack. `settle` starts chapters, passes finished steps and finishes quests, returning events. `fresh` steps count only what happens after they begin (used for hand-in talks). Rewards that do not fit the backpack wait in `QuestState.owed`. `parseQuests` validates untrusted save data.
- **Session** (`src/sim/storySession.ts`, `sessionKit.ts`): `story(s, counters)` raises counters, settles and pays rewards; `talk`, `inspect`, `dig`, `fish`, `useRaft`, `chooseEnding`, `dawn`, `reached`, `recordKill` are the story's rules. Crafting, building, eating and harvesting raise their counters through `withStory`.
- **Data**: `data/quests.ts` (10 chapters, 10 side quests, texts inline in English and Indonesian), `data/npcs.ts` (five islanders with ordered topics), `data/lore.ts` (tablets, bottle notes, endings, treasure).
- **World**: `sim/world/spots.ts` places the islanders and the finds deterministically from the world.
- **Lighthouse**: a fourth dungeon (`DungeonId` `lighthouse`) opened with the lighthouse key; its boss is the Hollow Keeper, who drops the beacon core and an armour piece.
- **Scenes**: `StoryDirector` (quest toasts, dialogue, the ending, landmark reach, night watch), `DialogueScene`, `QuestsScene`, a tracker on the HUD, `StoryLayer` (islanders and finds).
- **Save**: format 4 adds `quests`; versions 1 to 3 still load.

## Review Focus

1. **The main quest can always be finished, in order, with nothing missing.** Every item a chapter needs can be got (recipes, drops, chests); chapters cannot be skipped or stuck; the raft needs only things the hero can obtain.
2. **Saves.** Version 1 to 3 saves load with the story starting at chapter one; corrupt or hand-edited quest data never crashes or grants anything; quest state survives save and load in every place (island, dungeon).
3. **Rewards and the backpack.** A reward never disappears: it is paid or kept owed; a full backpack never blocks a quest from finishing and never loses an item; a boss's reward is paid once.
4. **Side quests.** Each can be offered, taken, progressed and handed in exactly once, with the right counters (fresh versus absolute), and cannot be started before it is unlocked.
5. **The scenes.** Dialogue and the quest log pause and resume the island correctly (including when another screen is open); a dialogue never opens twice or strands the island paused; talking to islanders who stand in the way of nothing else; the ending can be chosen once and the game continues after it.

## Verification

Unit tests for the engine, the session rules, the actions, the world spots and the dialogue selection; browser scenario `tools/scripts/story-play.json` plays talking, a bottle, buried treasure, fishing, the locked and the opened lighthouse door, the Hollow Keeper's fall and its reward, the raft and the ending, with no page errors.
