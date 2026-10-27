# Tidewake — Editable Remotion Trailer

Two compositions: `Tidewake-PlayStore` (1920 × 1080) and `Tidewake-Vertical` (1080 × 1920). Both run for 1020 frames at 30 fps, or 34 seconds.

```powershell
npm ci
npm run dev -- --no-open
npm run lint
npm run render
```

`src/Trailer.tsx` contains the authored ten-scene timeline. Individual scenes are in `src/scenes/`; type, color, film grain, particles, and key-art motion are in `src/design.tsx`. All footage, artwork, fonts, and the original score are bundled under `public/`.

`npm run render` exports both MP4s and matching thumbnails to `../video/`. `npm run qa` exports scene-check frames. On Windows the helper uses installed Microsoft Edge; `REMOTION_BROWSER` can override the executable. It falls back to Remotion's managed browser on other systems.

See `../README.md` for asset specifications, production provenance, Google Play upload guidance, and the full delivery map. Font license notices are in `public/fonts/`.
