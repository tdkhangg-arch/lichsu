// Thumbnail for episode 2 (1280x720), drawn with the character code in index.html.
// Usage: node episodes/02-okehazama/thumbnail.js
const fs = require("fs"), path = require("path"), vm = require("vm");
const { chromium } = require("playwright");
const root = path.join(__dirname, "../..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const script = html.split("<script>")[1].split("/* ---------- State + UI")[0];
const ctx = {}; vm.createContext(ctx);
vm.runInContext(script + ";this.character=character;this.SCENES=SCENES;", ctx);

const base = { hair: "none", hat: "none", face: "neutral", outfit: "stick", color: "#3a3640", prop: "none", pose: "stand", flip: false };
const mk = o => ({ ...base, ...o });
const put = (cfg, x, ground, sc) => `<g transform="translate(${x - 100 * sc} ${ground - 272 * sc}) scale(${sc})">${ctx.character(mk(cfg))}</g>`;

let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 30 480 270" width="1280" height="720">`;
s += ctx.SCENES.valley.d();
s += `<rect x="0" y="0" width="480" height="320" fill="#1d2233" opacity="0.45"/>`;
// lightning
s += `<path d="M262,96 L250,128 L260,128 L246,162 L272,122 L261,122 L272,96Z" fill="#fff6c8" stroke="#1c1b22" stroke-width="2" stroke-linejoin="round"/>`;
// Imagawa crowd (many small soldiers, facing left), back rows first
const imaColors = ["#6b4a7a", "#7a5a8a", "#5e4170"];
const rows = [[0.14,168,16],[0.17,180,14],[0.21,195,12],[0.26,213,10],[0.32,236,8],[0.40,265,7]];
rows.forEach(([sc, g, n], row) => {
  for (let i = 0; i < n; i++) {
    const x = 262 + (i + (row % 2) * 0.5) * (230 / n);
    s += put({ hair: "topknot", outfit: "armor", color: imaColors[(i + row) % 3], prop: "spear", face: row >= 4 ? "surprised" : "neutral" }, x, g, sc);
  }
});
// rain
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
for (let i = 0; i < 200; i++) {
  const x = rnd() * 560 - 40, y = rnd() * 300 + 20, l = 10 + rnd() * 14;
  s += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x - l * 0.35).toFixed(1)}" y2="${(y + l).toFixed(1)}" stroke="#dfe7f2" stroke-width="1.2" opacity="0.55"/>`;
}
// Nobunaga, big, facing right
s += ``;
s += put({ outfit: "armor", color: "#c0392b", hat: "kabuto", prop: "katana", face: "angry", flip: true }, 112, 392, 1.12);
// text
const T = (x, y, size, fill, txt, anchor = "middle", sw = 9) =>
  `<text x="${x}" y="${y}" font-family="Inter" font-weight="900" font-size="${size}" text-anchor="${anchor}" fill="${fill}" stroke="#1c1b22" stroke-width="${sw}" paint-order="stroke" stroke-linejoin="round">${txt}</text>`;
s += T(112, 84, 54, "#ff3b2f", "2,000");
s += T(238, 118, 30, "#ffe14d", "VS", "middle", 7);
s += T(366, 84, 54, "#ffffff", "25,000");
s += "</svg>";

(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.setContent(`<html><body style="margin:0">${s}</body></html>`);
  await p.screenshot({ path: path.join(__dirname, "thumbnail.png"), clip: { x: 0, y: 0, width: 1280, height: 720 } });
  await b.close();
})();
