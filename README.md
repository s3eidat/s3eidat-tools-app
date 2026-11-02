# S3eidat Tools app

Every [S3eidat Tools](https://s3eidat.github.io) tool in one private, offline app. Windows first; Mac, Android and
iPhone next (see `docs/superpowers/specs/2026-11-02-big-app-design.md`).

## How it works

- `scripts/build-www.mjs` assembles `www/` from `../S3eidat-Tools/repos`, laid out like the live site. Identical files
  are stored once (`/_shared/`), and AI models/runtimes (files ≥ 2 MB) are left out and listed in `www/_app/remote.json`
  with their SHA-256.
- `electron/main.js` serves `www/` on `app://tools/`. Pages can't reach the network: their CSP blocks it, and the app
  cancels any http(s)/ws request as well. Only the app process downloads, and only the listed AI files from
  `s3eidat.github.io`, verified against the hash, then kept for offline use.
- Links to other sites open in the default browser. The app home (`shell/`) is the hub plus favourites.

## Commands

```bash
npm install
npm run build:www       # assemble www/ from the tool repos
npm test                # unit tests
npm start               # run the app
npm run smoke           # offline self-tests of the home + 8 tools, screenshots in out/smoke/
node scripts/smoke.mjs --all                    # every tool
node scripts/smoke.mjs --exe "C:/path/to/S3eidat Tools.exe"   # against an installed build
npm run icon            # build/icon.png from the kit icon
npm run dist            # dist/S3eidat-Tools-Setup-<version>.exe (unsigned)
```

The `.exe` is unsigned for now, so Windows SmartScreen shows "More info → Run anyway" on first install.

MIT licensed. Made by [s3eidat](https://github.com/s3eidat).
