// Thumbnail for episode 5 (1280x720), drawn with the character code in index.html.
// Usage: node episodes/05-gaugamela/thumbnail.js
// Idea (owner's wording): "47,000 vs 100,000 / A Tactical Masterpiece / Alexander the Great's Glorious Victory": Alexander charging on Bucephalus, a sea of panicking Persians, Darius's golden chariot turning to flee.
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
s += ctx.SCENES.plain.d();
s += `<rect x="0" y="0" width="480" height="320" fill="#c0603a" opacity="0.25"/>`;
s += `<defs><radialGradient id="flash" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff4d6" stop-opacity="0.9"/><stop offset="1" stop-color="#ffe8b0" stop-opacity="0"/></radialGradient></defs>`;
s += `<ellipse cx="350" cy="170" rx="180" ry="100" fill="url(#flash)"/>`;
s += ctx.FX.crowd({ side: "per", x0: 250, x1: 486, rows: 6, gBack: 196, gFront: 284, scBack: 0.1, scFront: 0.3, perRow: 9, seed: 21, faces: ["panic", "panic", "surprised"], flee: 0.55, tilt: 18 });
s += ctx.FX.chariot({ x: 400, g: 300, sc: 0.4, royal: true, blades: false, flip: true, driver: mk({ hair: "persian", hat: "persiancap", outfit: "persian", color: "#2a6a6a", face: "panic" }), passenger: mk({ hair: "persian", hat: "tiara", outfit: "darius", color: "#5a3a7a", face: "panic", flip: true }) });
s += ctx.FX.dust({ x: 120, y: 300, w: 260, h: 70, opacity: 0.6, seed: 3 });
s += ctx.FX.horse({ x: 150, g: 352, sc: 0.78, color: "#2e2b33", star: true, gallop: true, flip: true, rider: mk({ hair: "short", hat: "alexhelm", outfit: "alexander", color: "#a8342c", prop: "lance", face: "fierce" }) });
// text
const T = (x, y, size, fill, txt, sw = 9) =>
  `<text x="${x}" y="${y}" font-family="Inter" font-weight="900" font-size="${size}" text-anchor="middle" fill="${fill}" stroke="#1c1b22" stroke-width="${sw}" paint-order="stroke" stroke-linejoin="round">${txt}</text>`;
s += `<rect x="40" y="40" width="400" height="88" fill="#1c1b22" opacity="0.35" rx="8"/>`;
s += T(240, 70, 30, "#ffffff", "47,000 vs 100,000", 7);
s += T(240, 98, 21, "#ffd75a", "A TACTICAL MASTERPIECE", 6);
s += T(240, 121, 15, "#ffffff", "ALEXANDER THE GREAT'S GLORIOUS VICTORY", 5);
s += "</svg>";

(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.setContent(`<html><body style="margin:0">${s}</body></html>`);
  await p.screenshot({ path: path.join(__dirname, "thumbnail.png"), clip: { x: 0, y: 0, width: 1280, height: 720 } });
  await b.close();
})();
