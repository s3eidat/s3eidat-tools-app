import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import resolve from "../electron/resolve.js";
import mime from "../electron/mime.js";

const { resolvePath } = resolve;
const root = fs.mkdtempSync(path.join(os.tmpdir(), "s3app-"));
const put = (p, s = "x") => { fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true }); fs.writeFileSync(path.join(root, p), s); };
put("index.html");
put("json-studio/index.html");
put("_shared/abc/kit.css");
const opts = {
  root,
  aliases: { "/json-studio/kit/kit.css": "/_shared/abc/kit.css" },
  remote: { "/transcribe/models/m.onnx": { sha256: "aa", size: 1, src: "/transcribe/models/m.onnx" } }
};

test("root and directories serve index.html", () => {
  assert.equal(resolvePath("/", opts).file, path.join(root, "index.html"));
  assert.equal(resolvePath("/json-studio/", opts).file, path.join(root, "json-studio", "index.html"));
  assert.equal(resolvePath("/json-studio/?x=1#y", opts).kind, "file");
});

test("a directory without a slash redirects so relative paths work", () => {
  assert.deepEqual(resolvePath("/json-studio", opts), { kind: "redirect", location: "/json-studio/" });
});

test("traversal and odd paths are refused", () => {
  for (const p of ["/../x", "/a/%2e%2e/b", "/a\\b", "/%00", "/%E0%A4%A", "x"]) {
    assert.equal(resolvePath(p, opts).kind, "notfound", p);
  }
});

test("aliased files serve the shared copy", () => {
  assert.equal(resolvePath("/json-studio/kit/kit.css", opts).file, path.join(root, "_shared", "abc", "kit.css"));
});

test("on-demand files resolve to remote entries", () => {
  const r = resolvePath("/transcribe/models/m.onnx", opts);
  assert.equal(r.kind, "remote");
  assert.equal(r.entry.sha256, "aa");
});

test("missing files are notfound", () => {
  assert.equal(resolvePath("/nope/", opts).kind, "notfound");
});

test("mime types cover what tools load", () => {
  assert.equal(mime.mimeFor("a/b.mjs"), "text/javascript; charset=utf-8");
  assert.equal(mime.mimeFor("x.wasm"), "application/wasm");
  assert.equal(mime.mimeFor("X.HTML"), "text/html; charset=utf-8");
  assert.equal(mime.mimeFor("noext"), "application/octet-stream");
});
