# Release checklist

Things only the owner can do, or that must be replaced before the game goes to the store.

1. **Replace the placeholders.** `PRIVACY_URL` and `CONTACT_EMAIL` in `src/core/config.ts`; `APP_ID`/`STORE_URL` in `src/core/platform.ts` (the store link is only right once the listing exists); the contact line in `docs/privacy-policy.md`. Host the privacy policy at a public address.
2. **Upload key.** Create your own upload keystore outside the repository, then build with `TIDEWAKE_KEYSTORE_PROPS=<path to a .properties file>` (keys `storeFile`, `storePassword`, `keyAlias`, `keyPassword`; `storeFile` is relative to that file). Never commit it.
3. **Build the bundle.** `npm test && npm run android:release`; the file is `android/app/build/outputs/bundle/release/app-release.aab`. Raise `versionCode` in `android/app/build.gradle` for every upload.
4. **Play Console.** Use `store/listing-en.md`, `store/listing-id.md`, `branding/` (icon 512 from `public/icon-512.png`, feature graphic) and `store/screenshots/`. Data safety: the game collects no data and has no ads or purchases; Android backup is switched off (`allowBackup=false`).
5. **Try it on a real phone.** The emulator used here renders in software (about 13 fps) and says nothing about speed. Check 60 fps, the touch controls, the back button, and a tablet or foldable (the portrait lock is ignored on large screens; the game letterboxes).
6. **Never publish a QA build** (`npm run android:qa`): it exposes `window.__game`.
