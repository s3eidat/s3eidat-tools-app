"use strict";
/* Render the kit's icon.svg to build/icon.png (512 px, transparent corners) for electron-builder.
   Draws the SVG onto a canvas inside a hidden page, so nothing has to be painted on screen. Run with: npm run icon */
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const SVG = path.join(__dirname, "..", "..", "S3eidat-Tools", "_kit", "icon.svg");
const OUT = path.join(__dirname, "..", "build", "icon.png");
const SIZE = 512;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false });
  await win.loadURL("data:text/html,<canvas></canvas>");
  const svg = "data:image/svg+xml;base64," + fs.readFileSync(SVG).toString("base64");
  const png = await win.webContents.executeJavaScript(`new Promise((ok, fail) => {
    const img = new Image(), c = document.querySelector("canvas");
    c.width = c.height = ${SIZE};
    img.onload = () => { c.getContext("2d").drawImage(img, 0, 0, ${SIZE}, ${SIZE}); ok(c.toDataURL("image/png")); };
    img.onerror = () => fail(new Error("svg did not load"));
    img.src = ${JSON.stringify(svg)};
  })`);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, Buffer.from(png.split(",")[1], "base64"));
  console.log("wrote", OUT);
  app.exit(0);
});
