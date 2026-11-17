// Thumbnail for episode 2 (1280x720), drawn with the character code in index.html.
// Usage: node episodes/02-okehazama/thumbnail.js
const fs = require("fs"), path = require("path"), vm = require("vm");
const { chromium } = require("playwright");
const root = path.join(__dirname, "../..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const script = html.split("<script>")[1].split("/* ---------- State + UI")[0];
const ctx = {}; vm.createContext(ctx);
vm.runInContext(script + ";this.character=character;this.SCENES=SCENES;", ctx);
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
s += ctx.SCENES.valley.d();
s += `<rect x="0" y="0" width="480" height="320" fill="#1d2233" opacity="0.45"/>`;
// lightning behind the army: glow, sky flash, bolt with branches
const bolt = "M268,24 L256,72 L274,76 L262,118 L284,122 L270,176 L292,214";
const branch1 = "M262,118 L236,140 L230,160", branch2 = "M284,122 L318,136 L326,158", branch3 = "M274,76 L300,60";
s += `<defs><radialGradient id="flash" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fbf7e8" stop-opacity="0.95"/><stop offset="0.55" stop-color="#dfe8ff" stop-opacity="0.45"/><stop offset="1" stop-color="#dfe8ff" stop-opacity="0"/></radialGradient>
  <filter id="glow" filterUnits="userSpaceOnUse" x="0" y="0" width="480" height="320"><feGaussianBlur stdDeviation="7"/></filter></defs>`;
s += `<ellipse cx="300" cy="130" rx="150" ry="95" fill="url(#flash)"/>`;
// the bolt itself is drawn between the back and front rows of the army (see below)
const drawBolt = () => {
  let o = "";
  for (const [w, c, op, f] of [[24, "#bcd4ff", 0.95, ' filter="url(#glow)"'], [10, "#1c1b22", 1, ""], [6.5, "#fff3a8", 1, ""], [3, "#ffffff", 1, ""]]) {
    for (const d of [bolt, branch1, branch2, branch3]) {
      const ww = d === bolt ? w : w * 0.55;
      o += `<path d="${d}" fill="none" stroke="${c}" stroke-width="${ww}" stroke-linejoin="round" stroke-linecap="round" opacity="${op}"${f}/>`;
    }
  }
  return o;
};
// Imagawa crowd (many small soldiers, facing left), back rows first; jitter, mixed faces,
// sashimono banners and spears at odd angles so it reads as a big, messy army
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const imaColors = ["#8e62a8", "#a77bc0", "#7552a0", "#9a6fb5"];
const faces = ["neutral", "surprised", "angry", "smug", "determined", "surprised", "neutral", "gentle"];
const flagColors = [["#f4efe4", "#1c1b22"], ["#c9a6e0", "#1c1b22"], ["#f4efe4", "#6b2f8a"]];
const rows = [[0.14,176,16],[0.17,187,14],[0.21,200,12],[0.26,213,10],[0.32,236,8],[0.40,265,7]];
rows.forEach(([sc0, g0, n], row) => {
  if (row === 3) s += drawBolt();
  for (let i = 0; i < n; i++) {
    const sc = sc0 * (0.92 + rnd() * 0.16), g = g0 + (rnd() - 0.5) * 6;
    const x = 262 + (i + (row % 2) * 0.5) * (230 / n) + (rnd() - 0.5) * 8;
    let extra = "";
    if (rnd() < 0.5) {  // sashimono: pole on the back with a tall banner (Imagawa two-bar crest)
      const [bg, mark] = flagColors[Math.floor(rnd() * 3)], tilt = (rnd() - 0.5) * 16;
      extra += `<g transform="rotate(${tilt.toFixed(1)} 128 170)"><line x1="128" y1="170" x2="128" y2="-30" stroke="#1c1b22" stroke-width="5"/>
        <rect x="128" y="-28" width="46" height="78" fill="${bg}" stroke="#1c1b22" stroke-width="5"/>
        <rect x="136" y="-4" width="30" height="8" fill="${mark}"/><rect x="136" y="16" width="30" height="8" fill="${mark}"/></g>`;
    }
    if (rnd() < 0.45) {  // extra spear leaning at an angle
      const a = (rnd() - 0.5) * 40;
      extra += `<g transform="rotate(${a.toFixed(1)} 100 200)"><line x1="100" y1="230" x2="100" y2="-40" stroke="#7a5a2e" stroke-width="5"/>
        <path d="M100,-70 L92,-38 L108,-38Z" fill="#d9dde6" stroke="#1c1b22" stroke-width="4"/></g>`;
    }
    const cfg = mk({ hair: "topknot", outfit: "armor", color: imaColors[Math.floor(rnd() * 4)], prop: "spear",
      face: faces[Math.floor(rnd() * faces.length)], flip: rnd() < 0.12 });
    s += `<g transform="translate(${(x - 100 * sc).toFixed(1)} ${(g - 272 * sc).toFixed(1)}) scale(${sc.toFixed(3)})">${extra}${ctx.character(cfg)}</g>`;
  }
});
// rain
for (let i = 0; i < 200; i++) {
  const x = rnd() * 560 - 40, y = rnd() * 300 + 20, l = 10 + rnd() * 14;
  s += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x - l * 0.35).toFixed(1)}" y2="${(y + l).toFixed(1)}" stroke="#dfe7f2" stroke-width="1.2" opacity="0.55"/>`;
}
// Nobunaga, big, facing right
s += put({ outfit: "armor", color: "#c0392b", hat: "kabuto", prop: "katana", face: "fierce", flip: true }, 112, 392, 1.12);
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
