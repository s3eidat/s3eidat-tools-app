"use strict";
/* Content types for the files the tools ship. Module scripts and wasm refuse to load without the right one. */
const path = require("node:path");

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8", ".md": "text/plain; charset=utf-8", ".xml": "application/xml",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".webp": "image/webp", ".ico": "image/x-icon", ".avif": "image/avif",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".otf": "font/otf",
  ".mp4": "video/mp4", ".webm": "video/webm", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg",
  ".wasm": "application/wasm", ".pdf": "application/pdf", ".onnx": "application/octet-stream", ".gz": "application/gzip"
};

function mimeFor(file) {
  return TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
}

module.exports = { mimeFor };
