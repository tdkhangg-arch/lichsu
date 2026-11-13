// Thumbnail for episode 3 (1280x720), drawn with the character code in index.html.
// Usage: node episodes/03-agincourt/thumbnail.js
// Idea: "OUTNUMBERED". Henry V (crown on helmet, scar, confident smirk) and a few ragged English
// archers behind their stakes in the mud, facing a huge wall of shiny French knights under a
// sky full of arrows.
const fs = require("fs"), path = require("path"), vm = require("vm");
const { chromium } = require("playwright");
const root = path.join(__dirname, "../..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const script = html.split("<script>")[1].split("/* ---------- State + UI")[0];
const ctx = {}; vm.createContext(ctx);
vm.runInContext(script + ";this.character=character;this.SCENES=SCENES;this.FX=FX;this.MUDAT=MUDAT;", ctx);
// Thumbnail-only face: sharp, narrowed eyes under angry brows plus a one-sided confident smirk
vm.runInContext(`FACES.fierce={label:"Fierce smirk",d:()=>ln(68,56,85,64,INK,4.6)+ln(108,55,92,63,INK,4.6)
  +'<path d="M72,73 Q78,69 85,72 Q79,77 72,73Z" fill="'+INK+'"/><path d="M92,72 Q99,68 105,72 Q99,77 92,72Z" fill="'+INK+'"/>'
  +ln(71,70,86,72,INK,2.8)+ln(91,71,106,69,INK,2.8)
  +'<path d="M77,97 Q92,101 104,89" fill="none" stroke="'+INK+'" stroke-width="3.8" stroke-linecap="round"/>'
  +ln(103,88,106,92,INK,3)};`, ctx);

const base = { hair: "none", hat: "none", face: "neutral", outfit: "stick", color: "#3a3640", prop: "none", pose: "stand", flip: false };
const mk = o => ({ ...base, ...o });
const put = (cfg, x, ground, sc) => `<g transform="translate(${x - 100 * sc} ${ground - 272 * sc}) scale(${sc})">${ctx.character(mk(cfg))}</g>`;

let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 30 480 270" width="1280" height="720">`;
s += ctx.SCENES.field.d();
s += `<rect x="0" y="0" width="480" height="320" fill="#1d2233" opacity="0.38"/>`;
// a cold flash of light behind the French army, so the crowd stands out against the sky
s += `<defs><radialGradient id="flash" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#f4f1e6" stop-opacity="0.85"/><stop offset="1" stop-color="#dfe8ff" stop-opacity="0"/></radialGradient></defs>`;
s += `<ellipse cx="360" cy="150" rx="170" ry="100" fill="url(#flash)"/>`;
// the French: rows and rows of shiny blue knights, back rows smaller
s += ctx.FX.crowd({ side: "fr", x0: 225, x1: 486, rows: 6, gBack: 196, gFront: 286, scBack: 0.11, scFront: 0.36, perRow: 8, seed: 17, banners: 0.25 });
// arrows pouring onto them, with a shadow on the ground
s += ctx.FX.arrowstorm({ x0: 120, x1: 480, y0: 34, y1: 150, dir: 1, n: 170, seed: 8 });
// two ragged archers behind their stakes, ankle-deep in mud
s += put({ outfit: "archer", color: "#5b6b3a", hat: "hood", prop: "bowdraw", face: "angry", flip: true }, 196, 300, 0.62);
s += ctx.MUDAT(196, 300, 0.62, 0.2);
s += ctx.FX.stakes({ x0: 150, x1: 250, y: 304, dir: 1, step: 11 });
// Henry V, big, facing right: crown on the helmet, scar, confident smirk
s += put({ outfit: "knight_royal", hat: "royalhelm", prop: "sword", face: "fierce", scar: true, flip: true }, 104, 392, 1.1);
// text
const T = (x, y, size, fill, txt, sw = 9) =>
  `<text x="${x}" y="${y}" font-family="Inter" font-weight="900" font-size="${size}" text-anchor="middle" fill="${fill}" stroke="#1c1b22" stroke-width="${sw}" paint-order="stroke" stroke-linejoin="round">${txt}</text>`;
s += T(312, 80, 40, "#ffffff", "OUTNUMBERED", 8);
s += T(312, 106, 20, "#ffd75a", "AGINCOURT 1415", 6);
s += "</svg>";

(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.setContent(`<html><body style="margin:0">${s}</body></html>`);
  await p.screenshot({ path: path.join(__dirname, "thumbnail.png"), clip: { x: 0, y: 0, width: 1280, height: 720 } });
  await b.close();
})();
