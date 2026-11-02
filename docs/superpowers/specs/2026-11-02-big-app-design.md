# S3eidat Tools app — design (2 Nov 2026)

One app with every S3eidat Tools tool, for Windows, Mac, Android and iPhone. The site's banner already
promises it. Decisions settled with Omar on 2 Nov 2026.

## Decisions

| Topic | Decision |
|---|---|
| Stack | **Electron** for Windows (.exe) and Mac (.dmg); **Capacitor** for Android (.apk) and iPhone (.ipa). Both wrap the same `www/` folder. No rewrite: the tools run unchanged. |
| Offline | Every tool ships inside the app. Files of 2 MB or more (AI models and runtimes: transcribe, upscale, background remover, OCR, photo-editor's AI cut-out) download once on first use from `s3eidat.github.io`, are checked against the SHA-256 recorded at build time, and are kept for offline use. |
| Money | Free, like the site: the coffee button and the house ads (s3eidatGPT, Spark) stay. On iPhone, Stripe tip links are against Apple's rules once the app is in the App Store; for a sideloaded IPA that does not apply yet. Revisit if it ever goes to the App Store. |
| Distribution | Direct files, no store review for now: `.exe`, `.dmg`, `.apk`, `.ipa`. |
| Signing | `.exe` unsigned (SmartScreen shows "More info → Run anyway"). `.apk` signed with our own keystore (free). `.dmg` signed + notarised with Omar's Apple Developer account (needs a Developer ID certificate he creates). `.ipa` **unsigned**: it installs only through a sideloading tool (AltStore / Sideloadly), which re-signs it with the installer's own Apple ID. |

## Architecture

```
S3eidat-Tools/repos/*   (source of truth, untouched)
        │  scripts/build-www.mjs
        ▼
www/                    the site as deployed: hub repo at /, each tool repo at /<slug>/
  index.html, ar/       replaced by the app home (shell/), which adds favourites
  _shared/kit/          one copy of the kit; /<slug>/kit/* resolves here
  _remote.json          on-demand files: path → {sha256, size}
        │
        ├── electron/main.js   serves www/ on app://tools/ (desktop)
        └── capacitor (later)  serves www/ on its local origin (phones)
```

**Why a custom `app://tools/` origin (desktop):** every tool's CSP says `'self'`. One privileged, secure,
standard origin makes all pages, workers and wasm load exactly as on the website, and keeps `localStorage`
shared (recent tools, favourites, settings), as on `s3eidat.github.io`.

**Protocol handler (`electron/serve.js`), in order:**
1. Map the URL path to a file in `www/`; a directory gets `index.html`; `..` is rejected.
2. `/<slug>/kit/<file>` → `/_shared/kit/<file>` (the build only does this when the copy is byte-identical).
3. Path listed in `_remote.json`: serve from the cache in the user's app-data folder; if missing, download from
   `https://s3eidat.github.io/<path>`, verify size + SHA-256, store, serve. Wrong hash → 502, nothing stored.
4. Anything else → 404 (the page's own 404 handling stays).

The page itself never touches the network: its CSP still blocks it. Only the app process downloads, and only
the tool's own static files from the official site. Nothing the user opens or types is sent anywhere.

**Navigation (`electron/links.js`):** links to `https://s3eidat.github.io/<path>` stay in the app when that
path exists in `www/`; every other `http(s)` link (Stripe, s3eidatGPT, GitHub) opens in the default browser.
Pop-ups (`target=_blank`) follow the same rule. No other navigation is allowed.

**App home (`shell/`):** a fork of the hub's `index.html` + `hub.js`: search, categories, flagship row,
**Favourites** (a ☆ on each card, saved with `S3.store("favs")`), **Recent** (the kit already records it),
English at `/`, Arabic at `/ar/` (the kit's header language switch already links between them). Website-only
blocks (the promo video, the "app coming soon" banner) are removed.

## Testing

- `node --test`: unit tests for path mapping, kit aliasing, remote verify (hash mismatch rejected), link rules,
  and the build script's output (all tools present, big files excluded and listed).
- `npm run smoke`: launches the real Electron app with **all network blocked**, opens the home and N tools,
  runs each tool's `window.S3_SELFTEST()`, saves screenshots, prints a pass/fail table, exits non-zero on failure.
- Done for the first slice: the Windows `.exe` installs and runs on Omar's PC: home opens, search works,
  a handful of real tools (JSON Studio, PDF Merge, QR Studio, Image Convert, Photo Editor without AI) pass
  their self-tests offline.

## Later slices (not in the first one)

1. Mac `.dmg` (build on the Intel Mac over ssh, sign + notarise).
2. Android `.apk` (Capacitor; on-demand files via a native request interceptor). Test on Omar's phone, never
   the emulator.
3. iPhone `.ipa` (Capacitor, unsigned, built on the Mac).
4. Auto-update check (a link to the newest release, no silent download).
