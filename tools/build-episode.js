// Builds a video production pack (JSON + 1920x1080 PNG frames + voiceover text)
// from an episode definition, reusing the drawing code in index.html.
// Usage: node tools/build-episode.js episodes/01-47-ronin/shots.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { chromium } = require("playwright");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const script = html.split("<script>")[1].split("/* ---------- State + UI")[0];
const ctx = {};
vm.createContext(ctx);
vm.runInContext(script + ";this.character=character;this.SCENES=SCENES;", ctx);

const defPath = path.resolve(process.argv[2]);
const def = require(defPath);
const outDir = path.dirname(defPath);
const imgDir = path.join(outDir, "images");
fs.mkdirSync(imgDir, { recursive: true });

const WPM = 145;
const GROUND = 292; // feet line in a 480x270 frame (viewBox y 30..300)

function frameSVG(shot) {
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 30 480 270" width="1920" height="1080">`;
  s += ctx.SCENES[shot.background].d();
  if (shot.tint) s += `<rect x="0" y="0" width="480" height="320" fill="${shot.tint.color}" opacity="${shot.tint.opacity}"/>`;
  for (const ch of shot.characters || []) {
    const sc = ch.scale || 0.75;
    const y = (ch.ground || GROUND) - 272 * sc;
    // character art spans x 0..200; flipped art is mirrored inside the same box
    s += `<g transform="translate(${ch.x - 100 * sc} ${y}) scale(${sc})">${ctx.character(ch.cfg)}</g>`;
  }
  return s + "</svg>";
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  let t = 0;
  const shots = [];
  for (const [i, shot] of def.shots.entries()) {
    const id = String(i + 1).padStart(2, "0");
    const file = `images/shot-${id}.png`;
    await page.setContent(`<html><body style="margin:0">${frameSVG(shot)}</body></html>`);
    await page.screenshot({ path: path.join(outDir, file), clip: { x: 0, y: 0, width: 1920, height: 1080 } });
    const words = shot.narration.split(/\s+/).filter(Boolean).length;
    const duration = Math.round((words / WPM) * 60 + (shot.pause ?? 0.8));
    shots.push({
      id: `shot-${id}`,
      section: shot.section,
      start: t,
      duration,
      image: file,
      background: shot.background,
      camera: shot.camera || "static",
      characters: (shot.characters || []).map(c => ({ name: c.name, expression: c.cfg.face, pose: c.cfg.pose })),
      on_screen_text: shot.text || null,
      narration: shot.narration,
      word_count: words,
    });
    t += duration;
  }
  await browser.close();

  const episode = {
    title: def.title,
    language: "en",
    resolution: { width: 1920, height: 1080 },
    fps: 30,
    total_duration: t,
    voiceover: { words_per_minute: WPM, file: "voiceover.txt" },
    shots,
  };
  fs.writeFileSync(path.join(outDir, "episode.json"), JSON.stringify(episode, null, 2) + "\n");
  fs.writeFileSync(path.join(outDir, "voiceover.txt"), shots.map(s => s.narration).join("\n\n") + "\n");
  const m = Math.floor(t / 60), sec = t % 60;
  console.log(`${shots.length} shots, ${m}:${String(sec).padStart(2, "0")} total`);
})();
