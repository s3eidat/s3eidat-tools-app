/* Assemble www/ (what the app serves) from the S3eidat Tools repos, laid out like the live site:
   the hub repo at /, each tool repo at /<slug>/. Then:
   - identical files (the kit, pdf.js, …) are stored once under /_shared/ and listed in /_app/aliases.json;
   - files of BIG bytes or more (AI models and runtimes) are left out and listed in /_app/remote.json with their
     SHA-256, so the app downloads them from the site on first use and can verify them;
   - the site's "app coming soon" banner is removed from kit.js, and the hub pages become the app home.
   Usage: node scripts/build-www.mjs [reposDir] [outDir] */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeHome } from "./home.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(HERE, "..");
export const BIG = 2 * 1024 * 1024;
const SHARE_MIN = 4096; // smaller duplicates aren't worth an alias entry
const SKIP_DIRS = new Set([".git", ".github", "node_modules"]);
const SKIP_ROOT_FILES = new Set(["README.md", "screenshot.png"]);
const HUB_SKIP_DIRS = new Set(["factory"]); // the factory routine's state, not site pages

function walk(dir, rel, out, skipDirs) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name), r = rel + "/" + e.name;
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name) && !(rel === "" && skipDirs.has(e.name))) walk(abs, r, out, skipDirs);
    } else if (e.isFile()) out.push({ rel: r, src: abs });
  }
}

function stripAnnouncement(kitJs) {
  const start = kitJs.indexOf("/*@@CONFIG@@*/"), end = kitJs.indexOf("/*@@END@@*/", start);
  if (start < 0 || end < 0) throw new Error("kit.js: CONFIG markers not found");
  const cfg = JSON.parse(kitJs.slice(start + 14, end));
  delete cfg.announce;
  return kitJs.slice(0, start + 14) + JSON.stringify(cfg) + kitJs.slice(end);
}

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

export function buildWww({ repos, out, hub = "s3eidat.github.io", big = BIG, shell = path.join(APP_ROOT, "shell") }) {
  const hubDir = path.join(repos, hub);
  if (!fs.existsSync(path.join(hubDir, "index.html"))) throw new Error("hub repo not found at " + hubDir);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  // 1. Every file of the site, keyed by its URL path.
  const files = [];
  walk(hubDir, "", files, HUB_SKIP_DIRS);
  const hubTop = new Set(fs.readdirSync(hubDir));
  const slugs = [];
  for (const e of fs.readdirSync(repos, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === hub || /^[._]/.test(e.name)) continue;
    if (!fs.existsSync(path.join(repos, e.name, "index.html"))) continue;
    if (hubTop.has(e.name)) throw new Error(`tool repo ${e.name} clashes with a hub folder of the same name`);
    slugs.push(e.name);
    walk(path.join(repos, e.name), "/" + e.name, files, new Set());
  }
  const kept = files.filter((f) => !SKIP_ROOT_FILES.has(path.basename(f.rel)) || f.rel.split("/").length > 3);

  // 2. Read, patch the kit, hash.
  for (const f of kept) {
    let buf = fs.readFileSync(f.src);
    if (/\/kit\/kit\.js$/.test(f.rel)) buf = Buffer.from(stripAnnouncement(buf.toString("utf8")), "utf8");
    f.buf = buf;
    f.sha = sha256(buf);
  }

  // 3. Group identical content; decide where each piece lives.
  const groups = new Map();
  for (const f of kept) (groups.get(f.sha) || groups.set(f.sha, []).get(f.sha)).push(f);
  const aliases = {}, remote = {};
  let bytes = 0, remoteBytes = 0;
  for (const [sha, members] of groups) {
    const size = members[0].buf.length;
    const shared = members.length > 1 && size >= SHARE_MIN;
    const home = shared ? `/_shared/${sha.slice(0, 12)}/${path.basename(members[0].rel)}` : null;
    if (shared) for (const m of members) aliases[m.rel] = home;
    const places = shared ? [home] : members.map((m) => m.rel);
    for (const p of places) {
      if (size >= big) {
        remote[p] = { sha256: sha, size, src: members[0].rel };
        remoteBytes += size;
      } else {
        const dest = path.join(out, ...p.split("/").filter(Boolean));
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, members[0].buf);
        bytes += size;
      }
    }
  }

  // 4. The app home replaces the hub pages (English at /, Arabic at /ar/).
  for (const p of ["/index.html", "/ar/index.html"]) { delete aliases[p]; delete remote[p]; }
  fs.mkdirSync(path.join(out, "ar"), { recursive: true });
  fs.writeFileSync(path.join(out, "index.html"), makeHome(fs.readFileSync(path.join(hubDir, "index.html"), "utf8"), "en"));
  fs.writeFileSync(path.join(out, "ar", "index.html"), makeHome(fs.readFileSync(path.join(hubDir, "ar", "index.html"), "utf8"), "ar"));
  fs.mkdirSync(path.join(out, "_app"), { recursive: true });
  for (const f of ["home.js", "home.css"]) fs.copyFileSync(path.join(shell, f), path.join(out, "_app", f));

  const summary = { builtAt: new Date().toISOString(), tools: slugs.length, files: kept.length, bytes, remoteBytes, remoteFiles: Object.keys(remote).length, sharedFiles: Object.keys(aliases).length };
  fs.writeFileSync(path.join(out, "_app", "aliases.json"), JSON.stringify(aliases));
  fs.writeFileSync(path.join(out, "_app", "remote.json"), JSON.stringify(remote, null, 1));
  fs.writeFileSync(path.join(out, "_app", "build.json"), JSON.stringify({ ...summary, slugs }, null, 1));
  return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repos = path.resolve(process.argv[2] || path.join(APP_ROOT, "..", "S3eidat-Tools", "repos"));
  const out = path.resolve(process.argv[3] || path.join(APP_ROOT, "www"));
  const s = buildWww({ repos, out });
  const mb = (n) => (n / 1048576).toFixed(1) + " MB";
  console.log(`www: ${s.tools} tools, ${s.files} files → ${mb(s.bytes)} bundled, ${s.remoteFiles} on-demand files (${mb(s.remoteBytes)}), ${s.sharedFiles} paths share a copy`);
}
