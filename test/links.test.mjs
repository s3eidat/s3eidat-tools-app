import { test } from "node:test";
import assert from "node:assert/strict";
import links from "../electron/links.js";

const { classify } = links;
const has = (p) => ["/", "/pdf-merge/", "/coffee/", "/pdf-merge/index.html"].includes(p);

test("app pages that exist stay in the app", () => {
  assert.deepEqual(classify("app://tools/pdf-merge/", has), { action: "internal", url: "app://tools/pdf-merge/" });
});

test("links to the website open the bundled copy", () => {
  assert.deepEqual(classify("https://s3eidat.github.io/pdf-merge/?a=1#b", has), { action: "internal", url: "app://tools/pdf-merge/?a=1#b" });
});

test("app paths the app doesn't have open on the website", () => {
  assert.deepEqual(classify("app://tools/s3eidat-tools-mcp/", has), { action: "external", url: "https://s3eidat.github.io/s3eidat-tools-mcp/" });
  assert.deepEqual(classify("https://s3eidat.github.io/guides/x/", has), { action: "external", url: "https://s3eidat.github.io/guides/x/" });
});

test("other websites and mail open outside", () => {
  assert.equal(classify("https://ai.s3eidat.com/?ref=s3tools", has).action, "external");
  assert.equal(classify("https://donate.stripe.com/abc", has).action, "external");
  assert.equal(classify("mailto:a@b.c", has).action, "external");
});

test("same-app blob windows are allowed, everything else is blocked", () => {
  assert.equal(classify("blob:app://tools/1234-5678", has).action, "internal");
  for (const u of ["file:///C:/x", "javascript:alert(1)", "data:text/html,hi", "app://evil/x", "chrome://gpu", "not a url"]) {
    assert.equal(classify(u, has).action, "block", u);
  }
});
