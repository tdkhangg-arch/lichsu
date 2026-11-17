// Renders animated frames for an episode: build/anim/<shot id>/00001.jpg ...
// Each shot is drawn frame by frame with its anim(t, sec) (see tools/frame.js), plus ambient motion
// (waves, flickering flames, bobbing ships, breathing characters). make-video.py uses these frames
// instead of the still image when they exist.
// Durations come from episode.timed.json (real voice timing; run make-video.py once first), else
// from the estimate in episode.json.
// Usage: node tools/build-anim.js episodes/06-tyre [--fps 15] [--only shot-08,shot-12] [--anim-only]
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { loadCtx, frameSVG } = require("./frame");

const args = process.argv.slice(2);
const epDir = path.resolve(args[0]);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const FPS = Number(opt("--fps", 15));
const only = opt("--only", "") ? opt("--only", "").split(",") : null;
const animOnly = args.includes("--anim-only");   // skip shots without anim() (no ambient-only motion)

const def = require(path.join(epDir, "shots.js"));
const timedPath = fs.existsSync(path.join(epDir, "episode.timed.json")) ? "episode.timed.json" : "episode.json";
const timed = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(epDir, timedPath), "utf8")).shots.map(s => [s.id, s.duration]));
// Prefer the real length of each voice file (same rule as make-video.py: lead + voice + 0.5 s tail,
// plus the end hold on the last shot), so new shots don't need a make-video run first.
const { execFileSync } = require("child_process");
const END_HOLD = 3.0;   // keep in step with make-video.py
const epShots = JSON.parse(fs.readFileSync(path.join(epDir, "episode.json"), "utf8")).shots;
epShots.forEach((s, i) => {
  const mp3 = path.join(epDir, "build", "audio", `${s.id}.mp3`);
  if (!fs.existsSync(mp3)) return;
  const d = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3]).toString());
  timed[s.id] = Math.round(((s.lead || 0) + d + 0.5 + (i === epShots.length - 1 ? END_HOLD : 0)) * 100) / 100;
});
const ctx = loadCtx();

let n = 0;
const jobs = [];
for (const shot of def.shots) {
  const id = shot.id || `shot-${String(++n).padStart(2, "0")}`;
  if (only && !only.includes(id)) continue;
  if (animOnly && !shot.anim) continue;
  const dur = timed[id];
  const frames = Math.ceil(dur * FPS);
  for (let f = 0; f < frames; f++) jobs.push({ id, shot, f, frames, dur });
}

(async () => {
  console.log(`${jobs.length} frames at ${FPS} fps (timing from ${timedPath})`);
  for (const id of new Set(jobs.map(j => j.id))) {
    const dir = path.join(epDir, "build", "anim", id);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
  const browser = await chromium.launch();
  const WORKERS = 4;
  let next = 0, done = 0;
  const t0 = Date.now();
  await Promise.all(Array.from({ length: WORKERS }, async () => {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    while (next < jobs.length) {
      const j = jobs[next++];
      const t = j.frames > 1 ? j.f / (j.frames - 1) : 0;
      await page.setContent(`<html><body style="margin:0">${frameSVG(ctx, j.shot, { t, sec: j.f / FPS })}</body></html>`);
      await page.screenshot({ path: path.join(epDir, "build", "anim", j.id, `${String(j.f + 1).padStart(5, "0")}.jpg`), type: "jpeg", quality: 90, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
      if (++done % 500 === 0) console.log(`  ${done}/${jobs.length} frames, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
  }));
  await browser.close();
  fs.writeFileSync(path.join(epDir, "build", "anim", "fps.txt"), String(FPS));
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
})();
