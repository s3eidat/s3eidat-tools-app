# S3eidat Tools app

Every [S3eidat Tools](https://s3eidat.github.io) tool in one private, offline app: 195 tools for PDFs, images,
video, text, code and everyday life. No account, no uploads, no tracking.

## Download

| Platform | |
|---|---|
| **Windows 10/11** | **[Download the installer](https://github.com/s3eidat/s3eidat-tools-app/releases/latest/download/S3eidat-Tools-Windows-Setup.exe)** (about 130 MB) |
| Mac | Coming soon |
| iPhone | Coming soon |
| Android | Coming soon |

The Windows installer isn't code-signed yet, so Windows may show "Windows protected your PC". Click
**More info → Run anyway**. Each release lists the installer's SHA-256 so you can check your download.

Everything works offline. The AI tools (transcribe, upscale, background remover, OCR) download their model once
from s3eidat.github.io the first time you use them; the app checks every file against its SHA-256 before using it.

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
npm run dist            # dist/S3eidat-Tools-Windows-Setup.exe (unsigned)
```

`build:www` expects the tool repos (all public under [github.com/s3eidat](https://github.com/s3eidat)) checked out
next to this repo in `../S3eidat-Tools/repos/`, with the hub repo `s3eidat.github.io` among them.

MIT licensed. Made by [s3eidat](https://github.com/s3eidat).
