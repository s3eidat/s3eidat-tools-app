"use strict";
/* S3eidat Tools desktop app: serves the bundled site on app://tools/ and keeps it private.
   - Pages can't reach the network: their own CSP blocks it, and this process cancels any http(s)/ws request too.
   - Only this process downloads, only on-demand files listed in remote.json, only from the official site, verified.
   - Links to other sites open in the default browser.
   S3_SMOKE=slug,slug runs each tool's self-test with all network blocked, saves screenshots and exits
   (S3_SMOKE_ONLINE=1 lets the app process fetch on-demand files; pages stay blocked). */
const { app, BrowserWindow, desktopCapturer, protocol, session, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { resolvePath } = require("./resolve.js");
const { getRemote } = require("./remote.js");
const { classify, APP } = require("./links.js");
const { mimeFor } = require("./mime.js");

const SMOKE = process.env.S3_SMOKE;
const WWW = app.isPackaged ? path.join(process.resourcesPath, "www") : path.join(__dirname, "..", "www");
const ALLOWED = new Set(["media", "geolocation", "notifications", "fullscreen", "clipboard-sanitized-write", "clipboard-read"]);
const NET = ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"];

if (SMOKE) { // the smoke window is invisible; keep Chromium from treating it as covered up and pausing it
  app.setPath("userData", fs.mkdtempSync(path.join(app.getPath("temp"), "s3-smoke-profile-"))); // never the user's favourites
  app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");
  app.commandLine.appendSwitch("disable-renderer-backgrounding");
  app.commandLine.appendSwitch("disable-background-timer-throttling");
}

protocol.registerSchemesAsPrivileged([{
  scheme: "app",
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true }
}]);

const readJson = (name) => JSON.parse(fs.readFileSync(path.join(WWW, "_app", name), "utf8"));
const site = { root: WWW, aliases: readJson("aliases.json"), remote: readJson("remote.json") };
const has = (p) => resolvePath(p, site).kind !== "notfound";
const blocked = [];

function body(buf, file, status = 200) {
  return new Response(buf, { status, headers: { "Content-Type": mimeFor(file), "Cache-Control": "no-cache" } });
}

async function serve(request, download) {
  const u = new URL(request.url);
  const r = u.host === "tools" ? resolvePath(u.pathname, site) : { kind: "notfound" };
  if (process.env.S3_TRACE) console.error("trace:", r.kind, request.url);
  if (r.kind === "redirect") return new Response(null, { status: 301, headers: { Location: r.location + u.search } });
  if (r.kind === "file") return body(await fs.promises.readFile(r.file), r.file);
  if (r.kind === "remote") {
    try {
      return body(await getRemote(r.entry, { cacheDir: path.join(app.getPath("userData"), "downloads"), fetch: download }), r.path);
    } catch (e) {
      console.error("on-demand file:", e.message);
      return new Response("This part of the tool downloads once. Connect to the internet and try again.", { status: 502 });
    }
  }
  const nf = path.join(WWW, "404.html");
  return fs.existsSync(nf) ? body(await fs.promises.readFile(nf), nf, 404) : new Response("Not found", { status: 404 });
}

function lockDown(ses) {
  ses.webRequest.onBeforeRequest({ urls: NET }, (d, cb) => { blocked.push(d.url); cb({ cancel: true }); });
  ses.setPermissionRequestHandler((wc, perm, cb) => cb(ALLOWED.has(perm)));
  ses.setPermissionCheckHandler((wc, perm) => ALLOWED.has(perm));
  // Screen Recorder: the tool asks only after the user clicks Record; share the main screen with system audio.
  ses.setDisplayMediaRequestHandler((req, cb) => {
    desktopCapturer.getSources({ types: ["screen"] }).then((s) => cb(s[0] ? { video: s[0], audio: "loopback" } : {})).catch(() => cb({}));
  });
}

// Every page and pop-up follows the same link rules.
app.on("web-contents-created", (_e, wc) => {
  wc.on("will-navigate", (e) => {
    const c = classify(e.url, has);
    if (c.action === "internal" && c.url === e.url) return;
    e.preventDefault();
    if (c.action === "internal") wc.loadURL(c.url);
    else if (c.action === "external") shell.openExternal(c.url);
  });
  wc.setWindowOpenHandler(({ url }) => {
    const c = classify(url, has);
    if (c.action === "external") shell.openExternal(c.url);
    return c.action === "internal" ? { action: "allow", overrideBrowserWindowOptions: { autoHideMenuBar: true } } : { action: "deny" };
  });
  wc.on("before-input-event", (e, input) => {
    if (input.type !== "keyDown" || !input.alt) return;
    if (input.key === "ArrowLeft" && wc.navigationHistory.canGoBack()) { e.preventDefault(); wc.navigationHistory.goBack(); }
    if (input.key === "ArrowRight" && wc.navigationHistory.canGoForward()) { e.preventDefault(); wc.navigationHistory.goForward(); }
  });
});

function createWindow() {
  const icon = path.join(__dirname, "..", "build", "icon.png");
  const win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 380, minHeight: 500, show: false, title: "S3eidat Tools",
    backgroundColor: "#0d0f12", autoHideMenuBar: true, icon: fs.existsSync(icon) ? icon : undefined,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: true, backgroundThrottling: !SMOKE }
  });
  if (SMOKE) { win.setOpacity(0); win.showInactive(); } // hidden windows get no animation frames; some self-tests need them
  win.on("app-command", (_e, cmd) => {
    const h = win.webContents.navigationHistory;
    if (cmd === "browser-backward" && h.canGoBack()) h.goBack();
    if (cmd === "browser-forward" && h.canGoForward()) h.goForward();
  });
  if (!SMOKE) win.once("ready-to-show", () => win.show());
  return win;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const PROBE = `(async () => {
  const out = { title: document.title, cards: document.querySelectorAll(".hub-card").length };
  try {
    const t = typeof window.S3_SELFTEST === "function"
      ? await Promise.race([window.S3_SELFTEST(), new Promise((r) => setTimeout(() => r("timeout"), ${Number(process.env.S3_SMOKE_TIMEOUT) || 30000}))]) : "none";
    out.selftest = String(t);
  } catch (e) { out.selftest = "error: " + e.message; }
  return out;
})()`;

const HOME_PROBE = `(async () => {
  const q = document.querySelector("#q"), all = document.querySelectorAll(".hub-card").length;
  q.value = "pdf"; q.dispatchEvent(new Event("input"));
  const pdf = document.querySelectorAll(".hub-card").length;
  q.value = ""; q.dispatchEvent(new Event("input"));
  const before = document.querySelector("#favs").hidden;
  document.querySelector(".app-star").click();
  const shown = !document.querySelector("#favs").hidden;
  document.querySelector(".app-star").click();
  return { search: pdf > 0 && pdf < all, favourites: before && shown && document.querySelector("#favs").hidden };
})()`;

async function smoke(win, slugs) {
  const shots = process.env.S3_SMOKE_OUT || path.join(app.getPath("temp"), "s3-smoke");
  fs.mkdirSync(shots, { recursive: true });
  let errors = [];
  win.webContents.on("console-message", (e, level, message) => {
    const lvl = e.level ?? level, msg = e.message ?? message;
    if (lvl === "error" || lvl === 3) errors.push(String(msg).slice(0, 200));
  });
  const results = [];
  for (const target of ["", "ar", ...slugs]) {
    errors = [];
    const name = target || "home";
    let r;
    try {
      await win.loadURL(`${APP}/${target ? target + "/" : ""}`);
      await wait(1500);
      r = await win.webContents.executeJavaScript(PROBE);
      if (!target) Object.assign(r, await win.webContents.executeJavaScript(HOME_PROBE));
    } catch (e) { r = { selftest: "load error: " + e.message }; }
    for (let i = 0; i < 3; i++) { // a screenshot can fail while the GPU is busy; it never fails the tool
      try { fs.writeFileSync(path.join(shots, name + ".png"), (await win.webContents.capturePage()).toPNG()); break; } catch { await wait(500); }
    }
    const home = target === "" || target === "ar";
    const ok = home ? r.cards > 100 && r.selftest === "true" && (target || (r.search && r.favourites)) : r.selftest === "true";
    results.push({ tool: name, ok, ...r, errors: errors.slice(0, 3) });
  }
  console.log("S3_SMOKE_RESULT " + JSON.stringify({ shots, blockedRequests: blocked.length, results }));
  app.exit(results.every((r) => r.ok) && blocked.length === 0 ? 0 : 1);
}

if (!SMOKE && !app.requestSingleInstanceLock()) app.quit();

app.whenReady().then(() => {
  const ses = session.defaultSession;
  lockDown(ses);
  // Downloads of on-demand files use their own session, so the pages' network block never applies to them.
  const dl = session.fromPartition("s3-downloads");
  // Smoke runs are fully offline unless S3_SMOKE_ONLINE=1 (to test on-demand downloads; pages stay blocked either way).
  const offline = SMOKE && !process.env.S3_SMOKE_ONLINE;
  const download = offline ? () => Promise.reject(new Error("network blocked in smoke mode")) : (url) => dl.fetch(url);
  ses.protocol.handle("app", (req) => serve(req, download));
  const win = createWindow();
  if (SMOKE) return smoke(win, SMOKE.split(",").filter(Boolean));
  win.loadURL(APP + "/");
  app.on("second-instance", () => { if (win.isMinimized()) win.restore(); win.focus(); });
});

app.on("window-all-closed", () => app.quit());
