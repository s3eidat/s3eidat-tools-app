"use strict";
/* Map an app://tools/ path to what answers it: a bundled file, a shared copy, an on-demand download, or nothing. */
const fs = require("node:fs");
const path = require("node:path");

function resolvePath(urlPath, { root, aliases = {}, remote = {} }) {
  let p;
  try { p = decodeURIComponent(urlPath.split(/[?#]/)[0]); } catch { return { kind: "notfound" }; }
  if (!p.startsWith("/") || p.includes("\0") || p.includes("\\") || p.split("/").includes("..")) return { kind: "notfound" };
  if (p.endsWith("/")) p += "index.html";
  p = aliases[p] || p;
  if (Object.hasOwn(remote, p)) return { kind: "remote", path: p, entry: remote[p] };
  const file = path.join(root, ...p.split("/").filter(Boolean));
  let st;
  try { st = fs.statSync(file); } catch { return { kind: "notfound" }; }
  if (st.isDirectory()) return { kind: "redirect", location: p + "/" };
  return { kind: "file", file, path: p };
}

module.exports = { resolvePath };
