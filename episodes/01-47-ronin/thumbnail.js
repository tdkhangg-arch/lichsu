// Thumbnail for The 47 Ronin (1280x720), drawn with the character code in index.html.
// Same visual language as episodes/02-okehazama/thumbnail.js.
// Usage: node episodes/01-47-ronin/thumbnail.js
const fs = require("fs"), path = require("path"), vm = require("vm");
const { chromium } = require("playwright");
const root = path.join(__dirname, "../..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const script = html.split("<script>")[1].split("/* ---------- State + UI")[0];
const ctx = {}; vm.createContext(ctx);
vm.runInContext(script + ";this.character=character;this.SCENES=SCENES;", ctx);
// Thumbnail-only face: narrowed eyes under hard brows, set jaw
vm.runInContext(`FACES.grim={label:"Grim",d:()=>ln(68,55,86,64,INK,5)+ln(108,54,92,63,INK,5)
  +'<path d="M72,73 Q78,69 85,72 Q79,77 72,73Z" fill="'+INK+'"/><path d="M92,72 Q99,68 105,72 Q99,77 92,72Z" fill="'+INK+'"/>'
  +ln(71,70,86,72,INK,2.8)+ln(91,71,106,69,INK,2.8)+ln(80,99,98,97,INK,4)};`, ctx);

const base = { hair: "none", hat: "none", face: "neutral", outfit: "stick", color: "#3a3640", prop: "none", pose: "stand", flip: false };
const mk = o => ({ ...base, ...o });
const put = (cfg, x, ground, sc) => `<g transform="translate(${x - 100 * sc} ${ground - 272 * sc}) scale(${sc})">${ctx.character(mk(cfg))}</g>`;
let seed = 47; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 30 480 270" width="1280" height="720">`;
s += `<defs><radialGradient id="moon" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff8dc" stop-opacity="0.9"/><stop offset="1" stop-color="#fff8dc" stop-opacity="0"/></radialGradient>
  <radialGradient id="lamp" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffb347" stop-opacity="0.85"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient></defs>`;
s += ctx.SCENES.snow.d();
s += `<rect x="0" y="0" width="480" height="320" fill="#141a33" opacity="0.55"/>`;
// moon glow and the mansion gate in the distance
s += `<circle cx="300" cy="70" r="70" fill="url(#moon)"/><circle cx="300" cy="70" r="16" fill="#fff6d6" stroke="#1c1b22" stroke-width="2.5"/>`;
s += `<path d="M330,196 L330,150 L470,150 L470,196 Z" fill="#2b2a36" stroke="#1c1b22" stroke-width="2.5"/>
  <path d="M320,152 L400,124 L480,152 Z" fill="#3a3846" stroke="#1c1b22" stroke-width="2.5"/>
  <path d="M320,152 L400,124 L480,152 Q400,138 320,152Z" fill="#e8eef4" stroke="#1c1b22" stroke-width="2"/>
  <rect x="384" y="160" width="32" height="36" fill="#1c1b22"/>`;
s += `<circle cx="372" cy="170" r="22" fill="url(#lamp)"/><rect x="367" y="162" width="10" height="14" rx="3" fill="#ffcf6a" stroke="#1c1b22" stroke-width="1.5"/>`;
// the 47: rows of black-armoured ronin advancing toward the gate, back rows first
const rows = [[0.16,200,14],[0.19,210,12],[0.23,222,10],[0.28,238,8],[0.34,258,6]];
const props = ["spear", "katana", "spear", "sword"];
const faces = ["determined", "angry", "determined", "grim", "neutral"];
rows.forEach(([sc0, g0, n], row) => {
  for (let i = 0; i < n; i++) {
    const sc = sc0 * (0.92 + rnd() * 0.16), g = g0 + (rnd() - 0.5) * 5;
    const x = 210 + (i + (row % 2) * 0.5) * (270 / n) + (rnd() - 0.5) * 8;
    s += put({ hair: rnd() < 0.8 ? "topknot" : "short", outfit: "armor", color: rnd() < 0.5 ? "#2c2a33" : "#3a3640",
      prop: props[Math.floor(rnd() * props.length)], face: faces[Math.floor(rnd() * faces.length)], flip: true }, x, g, sc);
  }
});
// falling snow
for (let i = 0; i < 160; i++) {
  const x = rnd() * 480, y = 30 + rnd() * 270, r = 0.6 + rnd() * 1.6;
  s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="#ffffff" opacity="${(0.5 + rnd() * 0.5).toFixed(2)}"/>`;
}
// Oishi, big, in front, facing right toward the gate
s += put({ hair: "short", outfit: "armor", color: "#2c2a33", prop: "katana", face: "grim", flip: true }, 104, 392, 1.12);
// text
const T = (x, y, size, fill, txt, anchor = "middle", sw = 9) =>
  `<text x="${x}" y="${y}" font-family="Inter" font-weight="900" font-size="${size}" text-anchor="${anchor}" fill="${fill}" stroke="#1c1b22" stroke-width="${sw}" paint-order="stroke" stroke-linejoin="round">${txt}</text>`;
s += T(340, 88, 50, "#ffffff", "WAITED");
s += T(340, 140, 50, "#ffe14d", "2 YEARS");
s += T(340, 172, 24, "#ff3b2f", "FOR REVENGE", "middle", 7);
s += "</svg>";

(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.setContent(`<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@900&display=block"></head><body style="margin:0">${s}</body></html>`);
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(__dirname, "thumbnail.png"), clip: { x: 0, y: 0, width: 1280, height: 720 } });
  await b.close();
})();
