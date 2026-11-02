import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildWww } from "../scripts/build-www.mjs";
import { makeHome } from "../scripts/home.mjs";

const HUB_HTML = `<!doctype html><html lang="en"><head>
<meta name="google-site-verification" content="x">
<link rel="stylesheet" href="/hub.css">
</head><body><main>
  <section id="recent" class="hub-recent" hidden><h2>Your tools</h2></section>
  <section class="hub-ad" aria-labelledby="ad-h"><video src="/media/ad.mp4"></video></section>
</main>
<script src="/hub.js"></script>
</body></html>`;
const KIT_JS = 'var C=/*@@CONFIG@@*/{"brand":"S3","announce":{"id":"a","en":"coming soon"}}/*@@END@@*/;' + "k".repeat(5000);
const BIG = 6000; // above the fixture kit.js (~5 KB), below the fixture "libraries" and "models"

function fixture() {
  const repos = fs.mkdtempSync(path.join(os.tmpdir(), "s3repos-"));
  const put = (p, s) => { const f = path.join(repos, ...p.split("/")); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };
  const hub = "s3eidat.github.io";
  put(`${hub}/index.html`, HUB_HTML);
  put(`${hub}/ar/index.html`, HUB_HTML.replace('lang="en"', 'lang="ar"'));
  put(`${hub}/hub.js`, "hub");
  put(`${hub}/hub.css`, "css");
  put(`${hub}/kit/kit.js`, KIT_JS);
  put(`${hub}/README.md`, "readme");
  put(`${hub}/.git/HEAD`, "ref");
  put(`${hub}/factory/state.json`, "{}");
  put(`${hub}/budget/index.html`, "budget");
  for (const t of ["json-studio", "pdf-merge"]) {
    put(`${t}/index.html`, t);
    put(`${t}/kit/kit.js`, KIT_JS);
    put(`${t}/README.md`, "readme");
    put(`${t}/screenshot.png`, "png");
    put(`${t}/lib/pdf.min.mjs`, "p".repeat(BIG + 10));
  }
  put("bg-remover/index.html", "bg");
  put("bg-remover/models/u.onnx", "m".repeat(BIG * 2));
  put("unbuilt/app.js", "no index");
  put("_kit/kit.js", "not a repo");
  return repos;
}

test("builds the site layout with shared copies, on-demand files and the app home", () => {
  const repos = fixture(), out = fs.mkdtempSync(path.join(os.tmpdir(), "s3www-"));
  const s = buildWww({ repos, out, big: BIG });
  const has = (p) => fs.existsSync(path.join(out, ...p.split("/").filter(Boolean)));
  const json = (p) => JSON.parse(fs.readFileSync(path.join(out, "_app", p), "utf8"));

  assert.equal(s.tools, 3);
  assert.deepEqual(json("build.json").slugs.sort(), ["bg-remover", "json-studio", "pdf-merge"]);
  assert.ok(has("/json-studio/index.html") && has("/budget/index.html") && has("/hub.js"));
  for (const p of ["/README.md", "/.git/HEAD", "/factory/state.json", "/json-studio/README.md", "/json-studio/screenshot.png", "/unbuilt/app.js", "/_kit/kit.js"]) {
    assert.ok(!has(p), p + " should be left out");
  }

  const aliases = json("aliases.json");
  const kit = aliases["/json-studio/kit/kit.js"];
  assert.match(kit, /^\/_shared\/[0-9a-f]{12}\/kit\.js$/);
  assert.equal(aliases["/pdf-merge/kit/kit.js"], kit);
  assert.equal(aliases["/kit/kit.js"], kit);
  assert.ok(has(kit) && !has("/json-studio/kit/kit.js"));
  const kitText = fs.readFileSync(path.join(out, ...kit.split("/").filter(Boolean)), "utf8");
  assert.ok(!kitText.includes("coming soon") && kitText.includes('"brand":"S3"'));

  const remote = json("remote.json");
  const model = remote["/bg-remover/models/u.onnx"];
  assert.equal(model.size, BIG * 2);
  assert.equal(model.sha256, crypto.createHash("sha256").update("m".repeat(BIG * 2)).digest("hex"));
  assert.equal(model.src, "/bg-remover/models/u.onnx");
  assert.ok(!has("/bg-remover/models/u.onnx"));
  const pdf = remote[aliases["/pdf-merge/lib/pdf.min.mjs"]];
  assert.ok(pdf, "a big shared file is on-demand at its shared path");
  assert.match(pdf.src, /^\/(json-studio|pdf-merge)\/lib\/pdf\.min\.mjs$/);

  const home = fs.readFileSync(path.join(out, "index.html"), "utf8");
  assert.ok(home.includes('src="/_app/home.js"') && home.includes('id="favs-row"') && !home.includes("hub-ad") && !home.includes("google-site"));
  assert.ok(fs.readFileSync(path.join(out, "ar", "index.html"), "utf8").includes("المفضلة"));
  assert.ok(has("/_app/home.js") && has("/_app/home.css"));
});

test("a hub page without the expected markers fails loudly", () => {
  assert.throws(() => makeHome("<html></html>"), /could not find/);
});
