import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import remote from "../electron/remote.js";

const { getRemote, SITE } = remote;
const body = Buffer.from("model bytes");
const entry = { sha256: crypto.createHash("sha256").update(body).digest("hex"), size: body.length, src: "/bg-remover/models/u.onnx" };
const fakeFetch = (buf, status = 200) => {
  const calls = [];
  const f = async (url) => { calls.push(url); return { ok: status === 200, status, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length) }; };
  f.calls = calls;
  return f;
};
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "s3remote-"));

test("downloads from the official site, verifies, caches", async () => {
  const cacheDir = tmp(), fetch = fakeFetch(body);
  assert.deepEqual(await getRemote(entry, { cacheDir, fetch }), body);
  assert.deepEqual(fetch.calls, [SITE + entry.src]);
  assert.ok(fs.existsSync(path.join(cacheDir, entry.sha256)));
});

test("a cached copy is served without the network", async () => {
  const cacheDir = tmp();
  fs.writeFileSync(path.join(cacheDir, entry.sha256), body);
  const fetch = fakeFetch(body);
  assert.deepEqual(await getRemote(entry, { cacheDir, fetch }), body);
  assert.equal(fetch.calls.length, 0);
});

test("a wrong hash is rejected and nothing is stored", async () => {
  const cacheDir = tmp(), bad = Buffer.from("model bytez");
  await assert.rejects(getRemote(entry, { cacheDir, fetch: fakeFetch(bad) }), /did not match/);
  assert.deepEqual(fs.readdirSync(cacheDir), []);
});

test("a wrong size is rejected", async () => {
  await assert.rejects(getRemote(entry, { cacheDir: tmp(), fetch: fakeFetch(Buffer.from("short")) }), /did not match/);
});

test("an HTTP error is reported", async () => {
  await assert.rejects(getRemote(entry, { cacheDir: tmp(), fetch: fakeFetch(body, 404) }), /404/);
});

test("a corrupt cached copy is replaced", async () => {
  const cacheDir = tmp();
  fs.writeFileSync(path.join(cacheDir, entry.sha256), "junk");
  assert.deepEqual(await getRemote(entry, { cacheDir, fetch: fakeFetch(body) }), body);
});
