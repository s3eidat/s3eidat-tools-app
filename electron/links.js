"use strict";
/* Where a link goes: stays in the app (bundled page), opens in the default browser, or is blocked.
   `has(pathname)` says whether the app bundles that path. */
const { SITE } = require("./remote.js");

const APP = "app://tools";

function classify(raw, has) {
  if (typeof raw === "string" && raw.startsWith("blob:" + APP + "/")) return { action: "internal", url: raw };
  let u;
  try { u = new URL(raw); } catch { return { action: "block" }; }
  const rest = u.pathname + u.search + u.hash;
  if (u.protocol === "app:") {
    if (u.host !== "tools") return { action: "block" };
    return has(u.pathname) ? { action: "internal", url: u.href } : { action: "external", url: SITE + rest };
  }
  if (u.protocol === "https:" && u.host === new URL(SITE).host) {
    return has(u.pathname) ? { action: "internal", url: APP + rest } : { action: "external", url: u.href };
  }
  if (u.protocol === "https:" || u.protocol === "http:" || u.protocol === "mailto:") return { action: "external", url: u.href };
  return { action: "block" };
}

module.exports = { classify, APP };
