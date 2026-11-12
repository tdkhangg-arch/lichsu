// Channel art: YouTube banner (2560x1440, text kept inside the 1546x423 safe area) and a
// profile picture (800x800), drawn with the characters from index.html.
// Usage: node tools/make-banner.js "History With Dad" "Pause the game. Dad's got a story." out-dir
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { chromium } = require("playwright");

const [title = "History With Dad", tagline = "Pause the game. Dad's got a story.", outDir = "channel"] = process.argv.slice(2);
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const ctx = {};
vm.createContext(ctx);
vm.runInContext(html.split("<script>")[1].split("/* ---------- State + UI")[0] + ";this.character=character;this.dk=dk;", ctx);

const INK = "#1c1b22";
const base = { hair: "none", hat: "none", face: "neutral", outfit: "stick", color: "#3a3640", prop: "none", pose: "stand", flip: false };
const mk = o => ({ ...base, ...o });
const DAD = mk({ hair: "short", hat: "glasses", outfit: "tshirt", color: "#5b6b3a", face: "smug" });
const SON = mk({ hair: "short", outfit: "hoodie", color: "#a8342c", face: "gentle", prop: "phone" });

// place a character so its feet (or seat, when sitting) land on y, at horizontal centre x
function put(cfg, x, y, s) {
  const footY = cfg.pose === "sit" ? 195 : 272;
  return `<g transform="translate(${x - 100 * s} ${y - footY * s}) scale(${s})">${ctx.character(cfg)}</g>`;
}
const st = `stroke="${INK}" stroke-width="7" stroke-linejoin="round"`;

function banner() {
  const W = 2560, H = 1440, FLOOR = 915;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`;
  s += `<rect width="${W}" height="${H}" fill="#e9dcc8"/>`;
  // wall details (visible on TV, outside the desktop strip)
  for (let x = 0; x < W; x += 160) s += `<line x1="${x}" y1="0" x2="${x}" y2="${FLOOR}" stroke="#dccdb5" stroke-width="3"/>`;
  s += `<rect x="1080" y="140" width="400" height="300" fill="#a9d8f0" ${st}/><path d="M1280,140 L1280,440 M1080,290 L1480,290" ${st}/>`;
  s += `<rect y="${FLOOR}" width="${W}" height="${H - FLOOR}" fill="#b98d63"/><path d="M0,${FLOOR} L${W},${FLOOR}" ${st}/>`;
  for (let x = 80; x < W; x += 220) s += `<line x1="${x}" y1="${FLOOR}" x2="${x - 40}" y2="${H}" stroke="${INK}" stroke-width="3" opacity=".3"/>`;
  // sofa with father and son (left side of the safe area)
  const sofa = (x, w, col) => `<rect x="${x}" y="${FLOOR - 190}" width="${w}" height="150" rx="26" fill="${col}" ${st}/>` +
    `<rect x="${x - 20}" y="${FLOOR - 95}" width="${w + 40}" height="80" rx="22" fill="${ctx.dk(col)}" ${st}/>` +
    `<rect x="${x - 40}" y="${FLOOR - 130}" width="60" height="120" rx="20" fill="${col}" ${st}/><rect x="${x + w - 20}" y="${FLOOR - 130}" width="60" height="120" rx="20" fill="${col}" ${st}/>`;
  s += sofa(560, 420, "#6d8fa8");
  s += put({ ...DAD, pose: "sit", flip: true }, 690, FLOOR - 88, 1.15);
  s += put({ ...SON, pose: "sit" }, 860, FLOOR - 88, 0.98);
  // title in the safe area
  s += `<text x="1500" y="700" text-anchor="middle" font-family="'Patrick Hand', 'Comic Sans MS', cursive" font-size="150" fill="${INK}">${title}</text>`;
  s += `<rect x="1130" y="742" width="740" height="10" rx="5" fill="#a8342c"/>`;
  s += `<text x="1500" y="840" text-anchor="middle" font-family="'Patrick Hand', 'Comic Sans MS', cursive" font-size="64" fill="#4a4652">${tagline}</text>`;
  // history characters on the sides (desktop and TV only)
  const sideL = [
    put(mk({ hair: "topknot", outfit: "armor", color: "#3a3640", prop: "katana", face: "determined", flip: true }), 150, FLOOR, 1.05),
    put(mk({ hat: "roman", outfit: "roman", color: "#a8342c", prop: "spear", face: "smug", flip: true }), 380, FLOOR, 1.0),
  ];
  const sideR = [
    put(mk({ hat: "nonla", hair: "bun", outfit: "peasant", color: "#8a6a4a", prop: "spear", face: "determined" }), 2180, FLOOR, 1.0),
    put(mk({ hair: "short", outfit: "knight", color: "#2f4f7f", prop: "sword", face: "angry" }), 2420, FLOOR, 1.05),
  ];
  s += sideL.join("") + sideR.join("");
  return s + "</svg>";
}

function avatar() {
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">`;
  s += `<rect width="800" height="800" fill="#6d8fa8"/><circle cx="400" cy="400" r="360" fill="#e9dcc8"/>`;
  s += put({ ...DAD, flip: true, face: "smug" }, 300, 900, 2.6);
  s += put({ ...SON, prop: "none", face: "gentle" }, 560, 905, 2.15);
  return s + "</svg>";
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const fontLink = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Patrick+Hand&display=block">`;
  for (const [name, svg, w, h] of [["banner.png", banner(), 2560, 1440], ["avatar.png", avatar(), 800, 800]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<html><head>${fontLink}</head><body style="margin:0">${svg}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, name), clip: { x: 0, y: 0, width: w, height: h } });
    console.log(`wrote ${path.join(outDir, name)}`);
  }
  await browser.close();
})();
