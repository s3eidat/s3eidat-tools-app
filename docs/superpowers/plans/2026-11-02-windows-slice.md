# Windows slice: implementation plan

> For agentic workers: run this task by task (superpowers:executing-plans). Steps use `- [ ]` checkboxes.
> Written to be executed right away by the same session, so code lives in the commits, not repeated here.

**Goal:** a Windows `.exe` of the S3eidat Tools app that opens the app home and runs real tools fully offline.

**Architecture:** `scripts/build-www.mjs` assembles `www/` from `../S3eidat-Tools/repos` (dedupes identical
files, moves files ≥ 2 MB to an on-demand list, swaps in the app home). Electron serves `www/` on the
privileged `app://tools/` origin through a small protocol handler built from pure, unit-tested modules.

**Tech stack:** Node 20, Electron 44.10.1, electron-builder 26.18.0 (NSIS), `node:test`, no runtime npm deps.

## Global constraints

- Tools stay unchanged; their CSP stays unchanged. The page never reaches the network.
- Only the main process downloads, only from `https://s3eidat.github.io/`, only paths in `_remote.json`, only after a
  size + SHA-256 check.
- External links open in the default browser; nothing else navigates away.
- `S3eidat-Tools/` is read-only for this project.
- No public repo, no release, no publish without Omar's OK. Commits as s3eidat.
- Never boot the Android emulator.

## Files

| File | Responsibility |
|---|---|
| `scripts/build-www.mjs` | `buildWww({repos, out})` → writes `www/`, returns a summary |
| `scripts/home.mjs` | `makeHome(hubHtml, lang)` → the app home HTML (pure string transform) |
| `shell/home.js`, `shell/home.css` | the app home's script (fork of hub.js + favourites) and styles |
| `electron/resolve.js` | `resolvePath(urlPath, {root, aliases, remote})` → `{kind, file?, entry?, path?}` |
| `electron/remote.js` | `getRemote(entry, {cacheDir, fetch})` → `Buffer` (verified) |
| `electron/links.js` | `classify(url, has)` → `{action: "internal" \| "external" \| "block", url}` |
| `electron/mime.js` | `mimeFor(file)` → content type |
| `electron/main.js` | window, protocol, navigation, permissions, smoke mode |
| `test/*.test.mjs` | unit tests for the modules above and the build output |

## Tasks

- [ ] **1. Scaffold.** `package.json` (scripts: `build:www`, `test`, `start`, `smoke`, `dist`), `.gitignore`
  (`node_modules`, `www`, `dist`), install pinned dev deps. Commit.
- [ ] **2. resolve + mime (TDD).** Tests: `/` → `www/index.html`; `/json-studio/` → `.../index.html`;
  `/../x` and `%2e%2e` → notfound; aliased path → shared file; remote path → `{kind:"remote"}`; missing → notfound.
- [ ] **3. remote (TDD).** Tests: cache hit served without fetch; miss fetches `https://s3eidat.github.io/<src>`,
  stores, returns; wrong hash → throws, nothing stored; wrong size → throws.
- [ ] **4. links (TDD).** Tests: `app://tools/x/` existing → internal; `https://s3eidat.github.io/pdf-merge/` →
  internal `app://tools/pdf-merge/`; site path missing in app → external; `https://ai.s3eidat.com` → external;
  `file:`, `javascript:` → block; `mailto:` → external.
- [ ] **5. build-www + home (TDD on a fixture repo set).** Tests: hub at root, tools at `/<slug>/`, `.git` and
  READMEs dropped, identical files deduped into `/_shared/` with aliases, files ≥ 2 MB listed in `_remote.json`
  with correct hash and removed, the announcement removed from `kit.js`, home has favourites + `home.js`, no promo
  video. Then run on the real repos and check counts and size.
- [ ] **6. Electron main + smoke.** `npm run smoke` with all network blocked: home has 100+ cards, and JSON Studio,
  PDF Merge, QR Studio, Image Convert, Photo Editor, Hash Lab and Unit Convert pass `S3_SELFTEST()`; screenshots saved.
  Look at them.
- [ ] **7. Package.** Icon from `kit/icon.svg`, `npm run dist` → NSIS `.exe`; install it, launch the installed app,
  run the smoke run against the installed copy. Commit. Hand-over note in the shared notes folder.
