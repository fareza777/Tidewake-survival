# Tidewake: Island Survival — Premium Launch Kit

A complete English campaign built around real gameplay, an antique brass compass, ocean navy, beacon cyan, warm gold, and a survivor whose face remains concealed.

## Finished assets

| Deliverable | File | Specification |
| --- | --- | --- |
| Google Play app icon | `playstore/app-icon-512.png` | 512 × 512 PNG, opaque, no face or lettering |
| Larger icon | `playstore/app-icon-1024.png` | 1024 × 1024 PNG |
| Feature graphic / banner | `playstore/feature-graphic-1024x500.png` | 1024 × 500 PNG |
| Banner master | `art/feature-graphic-master-2048x1000.png` | 2048 × 1000 PNG |
| Eight phone screenshots | `playstore/screenshots/` | Exactly eight 1080 × 1920 PNGs, numbered in upload order |
| Landscape trailer | `video/Tidewake-Trailer-EN-1920x1080.mp4` | 34 seconds, 1920 × 1080, 30 fps, H.264 + AAC |
| Vertical trailer | `video/Tidewake-Trailer-EN-1080x1920.mp4` | 34 seconds, 1080 × 1920, 30 fps, H.264 + AAC |
| Trailer thumbnails | `video/Tidewake-Thumbnail-EN-*.jpg` | Matching landscape and portrait artwork |
| Screenshot overview | `screenshot-contact-sheet.jpg` | All eight designs on one sheet |
| Editable video project | `remotion/` | Ten authored scenes, local fonts, original audio, captured gameplay |
| Browse the package | `index.html` | Local gallery with enlarged screenshots and video players |

The main app icon contains a compass rather than a person. Promotional characters wear a dark hood and armor and face away from the viewer. There are no full-face character portraits.

## Screenshot upload order

1. **Shipwrecked. Still Standing.** — The survival hook and a dangerous night at camp.
2. **Turn Scraps Into Survival.** — Actual crafting and resource gathering.
3. **Build Your Camp. Own the Night.** — Structures, defenses, farming, and fire.
4. **Five Islands. No Safe Shores.** — Frostfang and Emberhold, ice against fire.
5. **Go Below. Hit Back.** — A real dungeon boss encounter.
6. **Grow Stronger. Go Further.** — Equipment, inventory, and six survival skills.
7. **Every Season Tests You.** — Snow, weather, warmth, and survival.
8. **Your Island. Your Story.** — The lighthouse payoff and offline play.

## Trailer structure

| Time | Scene | Hook / payoff |
| --- | --- | --- |
| 0–2.5 s | Night survival | **The island wants you dead. Make it regret that.** |
| 2.5–5.5 s | Gathering | Start with nothing. |
| 5.5–9 s | Camp | Build before dark. |
| 9–12 s | Crafting | Turn scraps into survival. |
| 12–16 s | Archipelago | Five islands. No safe shores. |
| 16–21 s | Two bosses | Go below. Hit back. |
| 21–24 s | Gear and skills | Grow stronger. Go further. |
| 24–27 s | Endless Depths | How far will you go? |
| 27–30 s | Lighthouse | Find your way home. |
| 30–34 s | Title and call to action | Play offline. Survive your way. Begin your survival. |

The original instrumental score combines a dark melodic pulse, rising percussion, bass impacts, sea texture, and transition sweeps. It was synthesized for this campaign without third-party music recordings or sampled sound packs. There is no voice-over.

## Game review and authenticity

The campaign was grounded in the local Tidewake game, version 1.3.0. The source includes survival vitals, gathering and crafting, camp construction and farming, night threats, five islands in total, elemental dungeons and bosses, four equipment slots, six progression skills, the Endless Depths, lighthouse story content, and offline local play.

The screenshots and gameplay clips come from the running game. Existing QA hooks staged inventory, structures, weather, locations, and encounters to demonstrate those implemented features. Notification toasts were hidden for clean capture; the game's artwork and primary UI were preserved. Some panels are cropped or arranged into two views for readability. Capture frames are advanced at 30 fps and encoded as real gameplay footage.

The atmospheric background artwork and compass are original promotional illustrations made with the built-in image generation tool. They are not presented as gameplay. Exact generation prompts are saved in `source/imagegen-prompts.md`; the selected original images are in `art/` and copied into the video project.

## Google Play use

Upload the 512 px icon, 1024 × 500 feature graphic, and eight numbered screenshots to the matching Play Console fields. The exported PNGs use opaque RGB output. Google Play applies the icon treatment; no pre-rounded outer corners were added to the upload image.

For a preview video, upload the **landscape MP4** to your YouTube account and use its public or unlisted YouTube video URL in Play Console. The portrait MP4 is supplied for vertical promotion and social placements. No video or other asset was uploaded or published during this work.

Specifications were checked against [Google Play's official preview asset guidance](https://support.google.com/googleplay/android-developer/answer/9866151) on 11 October 2026. Store review and placement remain subject to Google Play's current policies.

## Edit or render the video

The project is self-contained under `remotion/`, including footage, fonts, art, and audio. From that directory:

```powershell
npm ci
npm run dev -- --no-open
```

Open the displayed Studio URL. The compositions are `Tidewake-PlayStore` and `Tidewake-Vertical`. Edit text and timing in `src/Trailer.tsx`, `src/design.tsx`, and the individually authored files under `src/scenes/`.

```powershell
npm run lint
npm run render
```

The render helper uses the installed Microsoft Edge on Windows when available. Set `REMOTION_BROWSER` to another compatible browser executable if needed; otherwise Remotion uses its managed browser. Final MP4s and thumbnails are written to `../video/`.

For individual scene checks, run `npm run qa`. `QA_FRAMES` optionally accepts comma-separated frame numbers. Font files are bundled locally so rendering does not depend on a font CDN.

The extra capture and asset-composition scripts live in `source/`. Re-capturing gameplay requires the original game project, its existing QA hooks, a running development server on port 5199, and Playwright with Microsoft Edge. The existing captures and clips are already bundled; re-capture is unnecessary to edit or render the trailer. Raw frame intermediates and installed dependencies are excluded from the ZIP to keep the package practical.

To serve the gallery from this directory, run `node source/serve.mjs` and open `http://127.0.0.1:5205/`.

## Provenance and verification

- Original promotional artwork: built-in image generation; saved prompts and masters included.
- Gameplay: the local game, captured with its existing assets and UI; rights remain with their respective owner.
- Original music and transition sound design: synthesized for this campaign; source and WAV included.
- Fonts: Cinzel and Barlow / Barlow Condensed, distributed under the bundled SIL Open Font License notices.
- Delivery checks: exact PNG dimensions and count, icon file size, opaque color mode, video resolution and duration, full decode, Remotion TypeScript and lint checks, and a visual review of every scene in both aspect ratios. Machine-readable results are in `source/validation-report.json`.

The complete editable delivery is `Tidewake-Premium-Launch-Kit.zip`.
