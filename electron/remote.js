"use strict";
/* On-demand files (AI models and runtimes): fetched once from the official site, checked against the SHA-256
   recorded at build time, then kept in the app-data folder for offline use. */
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const SITE = "https://s3eidat.github.io";
const pending = new Map(); // sha256 → promise, so parallel requests for one model download it once

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

async function download(entry, { cacheDir, fetch }) {
  const res = await fetch(SITE + entry.src);
  if (!res.ok) throw new Error(`download failed (${res.status}) for ${entry.src}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length !== entry.size || sha256(buf) !== entry.sha256) throw new Error(`downloaded file did not match for ${entry.src}`);
  await fs.mkdir(cacheDir, { recursive: true });
  const file = path.join(cacheDir, entry.sha256), tmp = file + ".part";
  await fs.writeFile(tmp, buf);
  await fs.rename(tmp, file);
  return buf;
}

async function getRemote(entry, opts) {
  try {
    const cached = await fs.readFile(path.join(opts.cacheDir, entry.sha256));
    if (cached.length === entry.size) return cached; // verified when it was written
  } catch { /* not cached yet */ }
  if (!pending.has(entry.sha256)) {
    pending.set(entry.sha256, download(entry, opts).finally(() => pending.delete(entry.sha256)));
  }
  return pending.get(entry.sha256);
}

module.exports = { getRemote, SITE };
