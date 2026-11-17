// Thumbnail for episode 3 (1280x720), drawn with the character code in index.html.
// Usage: node episodes/03-agincourt/thumbnail.js
// Idea: "Can the few beat the many? 1 vs 4" (owner's wording; a ratio instead of disputed head counts). Henry V (crown on helmet, scar, confident smirk) and a few ragged English
// archers behind their stakes in the mud, facing a huge crowd of shiny French knights who
// panic and scatter under a sky full of arrows.
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
s += ctx.SCENES.field.d();
s += `<rect x="0" y="0" width="480" height="320" fill="#1d2233" opacity="0.38"/>`;
// a cold flash of light behind the French army, so the crowd stands out against the sky
s += `<defs><radialGradient id="flash" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#f4f1e6" stop-opacity="0.85"/><stop offset="1" stop-color="#dfe8ff" stop-opacity="0"/></radialGradient></defs>`;
s += `<ellipse cx="360" cy="150" rx="170" ry="100" fill="url(#flash)"/>`;
// the French: rows and rows of shiny blue knights, back rows smaller
s += ctx.FX.crowd({ side: "fr", x0: 292, x1: 486, rows: 6, gBack: 196, gFront: 286, scBack: 0.11, scFront: 0.36, perRow: 8, seed: 17, banners: 0.25,
  faces: ["panic", "panic", "panic", "surprised"], flee: 0.6, tilt: 22, fall: 0.08 });
// front of the rout: a knight fallen face down in the mud, a dropped banner, mud splashing
const putRot = (cfg, x, ground, sc, a) => `<g transform="translate(${x - 100 * sc} ${ground - 272 * sc}) scale(${sc}) rotate(${a} 100 268)">${ctx.character(mk(cfg))}</g>`;
s += `<g transform="rotate(-62 300 292)"><line x1="300" y1="292" x2="300" y2="214" stroke="#1c1b22" stroke-width="4.5"/><line x1="300" y1="292" x2="300" y2="214" stroke="#8a6a3a" stroke-width="2.5"/>`
   + `<rect x="300" y="214" width="26" height="22" fill="#2f4f9f" stroke="#1c1b22" stroke-width="2"/>${ctx.LYS(313, 229, 0.6)}</g>`;
s += putRot({ outfit: "knight_fr", hat: "bascinet", face: "panic", prop: "none" }, 372, 284, 0.4, -82);
s += ctx.MUDAT(296, 284, 0.4 * 0.7, 0.3);
s += ctx.FX.splash({ x: 290, y: 280, k: 0.9 }) + ctx.FX.splash({ x: 410, y: 292, k: 0.7 }) + ctx.FX.splash({ x: 350, y: 298, k: 0.6 });
// arrows pouring onto them, with a shadow on the ground
s += ctx.FX.arrowstorm({ x0: 120, x1: 480, y0: 34, y1: 150, dir: 1, n: 170, seed: 8 });
// three archers in a line, same kit, all loosing high into the sky (drawn right to left so each
// arrow stays in front of the next man's head)
s += ctx.FX.stakes({ x0: 160, x1: 300, y: 306, dir: 1, step: 11 });
for (const x of [266, 222, 178]) {
  s += put({ outfit: "archer", color: "#8a6a4a", hat: "kettle", prop: "bowup", face: "determined", flip: true }, x, 300, 0.52);
  s += ctx.MUDAT(x, 300, 0.52, 0.15);
}
// Henry V, big, facing right: crown on the helmet, scar, confident smirk
s += put({ outfit: "knight_royal", hat: "royalhelm", prop: "sword", face: "fierce", scar: true, flip: true }, 88, 384, 1.0);
// text
const T = (x, y, size, fill, txt, sw = 9) =>
  `<text x="${x}" y="${y}" font-family="Inter" font-weight="900" font-size="${size}" text-anchor="middle" fill="${fill}" stroke="#1c1b22" stroke-width="${sw}" paint-order="stroke" stroke-linejoin="round">${txt}</text>`;
s += T(316, 70, 30, "#ffffff", "CAN THE FEW", 7);
s += T(316, 102, 30, "#ffffff", "BEAT THE MANY?", 7);
s += T(316, 140, 36, "#ffd75a", "1 vs 4", 8);
s += "</svg>";

(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.setContent(`<html><body style="margin:0">${s}</body></html>`);
  await p.screenshot({ path: path.join(__dirname, "thumbnail.png"), clip: { x: 0, y: 0, width: 1280, height: 720 } });
  await b.close();
})();
