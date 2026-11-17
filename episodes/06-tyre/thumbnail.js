// Thumbnail for the special episode (1280x720), drawn with the character code in index.html.
// Usage: node episodes/06-tyre/thumbnail.js
// Idea: "HE FILLED IN THE SEA": Alexander on the beach pointing at the island city, the causeway
// reaching across the water, shocked Tyrians on the walls.
const fs = require("fs"), path = require("path"), vm = require("vm");
const { chromium } = require("playwright");
const root = path.join(__dirname, "../..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const script = html.split("<script>")[1].split("/* ---------- State + UI")[0];
const ctx = {}; vm.createContext(ctx);
vm.runInContext(script + ";this.character=character;this.SCENES=SCENES;this.FX=FX;this.MUDAT=MUDAT;this.LYS=LYS;", ctx);
// Thumbnail-only face: sharp, narrowed eyes under angry brows plus a one-sided confident smirk
vm.runInContext(`FACES.fierce={label:"Fierce smirk",d:()=>ln(68,56,85,64,INK,4.6)+ln(108,55,92,63,INK,4.6)
  +'<path d="M72,73 Q78,69 85,72 Q79,77 72,73Z" fill="'+INK+'"/><path d="M92,72 Q99,68 105,72 Q99,77 92,72Z" fill="'+INK+'"/>'
  +ln(71,70,86,72,INK,2.8)+ln(91,71,106,69,INK,2.8)
  +'<path d="M77,97 Q92,101 104,89" fill="none" stroke="'+INK+'" stroke-width="3.8" stroke-linecap="round"/>'
  +ln(103,88,106,92,INK,3)};
// Thumbnail-only face for the French: wide eyes, worried brows, screaming mouth, sweat drops
FACES.panic={label:"Panic",d:()=>'<path d="M68,60 Q76,52 85,52" fill="none" stroke="'+INK+'" stroke-width="3.8" stroke-linecap="round"/><path d="M92,52 Q100,52 108,59" fill="none" stroke="'+INK+'" stroke-width="3.8" stroke-linecap="round"/>'
  +'<ellipse cx="78" cy="72" rx="7" ry="8" fill="#fff" stroke="'+INK+'" stroke-width="2.6"/><circle cx="77" cy="73" r="2.4" fill="'+INK+'"/>'
  +'<ellipse cx="98" cy="71" rx="7.5" ry="8.5" fill="#fff" stroke="'+INK+'" stroke-width="2.6"/><circle cx="97" cy="72" r="2.4" fill="'+INK+'"/>'
  +'<path d="M78,92 Q90,86 102,92 Q100,108 90,108 Q80,108 78,92Z" fill="'+INK+'"/><path d="M83,103 Q90,99 97,103" fill="none" stroke="#e36a6a" stroke-width="3"/>'
  +'<path d="M112,54 q-5,9 0,13 q5,-4 0,-13Z M60,62 q-4,7 0,10 q4,-3 0,-10Z" fill="#9fd3f2" stroke="'+INK+'" stroke-width="1.5"/>'};`, ctx);

const base = { hair: "none", hat: "none", face: "neutral", outfit: "stick", color: "#3a3640", prop: "none", pose: "stand", flip: false };
const mk = o => ({ ...base, ...o });
const put = (cfg, x, ground, sc) => `<g transform="translate(${x - 100 * sc} ${ground - 272 * sc}) scale(${sc})">${ctx.character(mk(cfg))}</g>`;

let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 30 480 270" width="1280" height="720">`;
s += ctx.SCENES.tyresea.d();
s += ctx.FX.mole({ p: 0.85, wide: true }) + ctx.FX.tower({ x: 248, g: 202, sc: 0.32 });
s += ctx.FX.crowd({ side: "tyr", x0: 300, x1: 466, rows: 1, gBack: 120, gFront: 120, scBack: 0.1, scFront: 0.1, perRow: 8, seed: 6, faces: ["panic"] });
s += ctx.FX.arrow({ pts: [[150, 236], [230, 226], [292, 214]], color: "#ffd75a", glow: true, w: 6 });
s += put({ hair: "short", hat: "alexhelm", outfit: "alexander", color: "#a8342c", prop: "none", face: "fierce", flip: true }, 82, 372, 0.95);
// text
const T = (x, y, size, fill, txt, sw = 9) =>
  `<text x="${x}" y="${y}" font-family="Inter" font-weight="900" font-size="${size}" text-anchor="middle" fill="${fill}" stroke="#1c1b22" stroke-width="${sw}" paint-order="stroke" stroke-linejoin="round">${txt}</text>`;
s += T(320, 262, 32, "#ffffff", "HE FILLED IN", 7);
s += T(320, 296, 32, "#ffd75a", "THE SEA", 7);
s += "</svg>";

(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.setContent(`<html><body style="margin:0">${s}</body></html>`);
  await p.screenshot({ path: path.join(__dirname, "thumbnail.png"), clip: { x: 0, y: 0, width: 1280, height: 720 } });
  await b.close();
})();
