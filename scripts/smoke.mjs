/* Run the real app offline (every network request blocked), open the home pages and each tool, run the tools'
   own self-tests and save screenshots. Exit code 0 only if everything passed and nothing tried the network.
   Usage: node scripts/smoke.mjs [--exe "path/to/S3eidat Tools.exe"] [--all | slug ...] */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT = ["json-studio", "pdf-merge", "qr-studio", "image-convert", "photo-editor", "hash-lab", "unit-convert", "word-count"];

const args = process.argv.slice(2);
const exeAt = args.indexOf("--exe");
const exe = exeAt >= 0 ? args.splice(exeAt, 2)[1] : null;
const slugs = args[0] === "--all"
  ? JSON.parse(fs.readFileSync(path.join(ROOT, "www", "_app", "build.json"), "utf8")).slugs
  : args.length ? args : DEFAULT;
const bin = exe || createRequire(import.meta.url)("electron");
const out = path.join(ROOT, "out", "smoke");

const run = spawnSync(bin, exe ? [] : [ROOT], {
  env: { ...process.env, S3_SMOKE: slugs.join(","), S3_SMOKE_OUT: out, ELECTRON_ENABLE_LOGGING: "" },
  encoding: "utf8", timeout: 60000 + slugs.length * 40000, maxBuffer: 64 * 1024 * 1024
});
const line = (run.stdout || "").split(/\r?\n/).find((l) => l.startsWith("S3_SMOKE_RESULT "));
if (!line) {
  console.error("no result from the app\n", run.stdout, run.stderr, run.error || "");
  process.exit(1);
}
const res = JSON.parse(line.slice(16));
for (const r of res.results) {
  const extra = r.cards ? ` cards=${r.cards}` + (r.search !== undefined ? ` search=${r.search} favourites=${r.favourites}` : "") : "";
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.tool.padEnd(16)} selftest=${r.selftest}${extra}${r.errors.length ? "  errors: " + r.errors.join(" | ") : ""}`);
}
console.log(`network requests blocked: ${res.blockedRequests} (must be 0)\nscreenshots: ${res.shots}`);
process.exit(run.status ?? 1);
