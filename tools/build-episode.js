// Builds a video production pack (JSON + 1920x1080 PNG frames + voiceover text)
// from an episode definition, reusing the drawing code in index.html.
// Usage: node tools/build-episode.js episodes/01-47-ronin/shots.js
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const { loadCtx, frameSVG } = require("./frame");
const ctx = loadCtx();
const defPath = path.resolve(process.argv[2]);
const def = require(defPath);
const outDir = path.dirname(defPath);
const imgDir = path.join(outDir, "images");
fs.mkdirSync(imgDir, { recursive: true });

const WPM = 145;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  let t = 0;
  const shots = [];
  let n = 0;
  for (const shot of def.shots) {
    // shots may carry their own id (e.g. "intro-1") so inserting them does not renumber the rest
    const id = shot.id || `shot-${String(++n).padStart(2, "0")}`;
    const file = `images/${id}.png`;
    await page.setContent(`<html><body style="margin:0">${frameSVG(ctx, shot)}</body></html>`);
    await page.screenshot({ path: path.join(outDir, file), clip: { x: 0, y: 0, width: 1920, height: 1080 } });
    const words = shot.narration.split(/\s+/).filter(Boolean).length;
    const duration = shot.duration || Math.round((words / WPM) * 60 + (shot.pause ?? 0.8) + (shot.lead || 0));
    shots.push({
      id,
      speaker: shot.speaker || null,
      ...(shot.lead ? { lead: shot.lead } : {}),
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
    music_moods: def.music_moods || null,
    music_palette: def.music_palette || null,
    shots,
  };
  fs.writeFileSync(path.join(outDir, "episode.json"), JSON.stringify(episode, null, 2) + "\n");
  fs.writeFileSync(path.join(outDir, "voiceover.txt"), shots.map(s => (s.speaker ? `${s.speaker.toUpperCase()}: ` : "") + s.narration).join("\n\n") + "\n");
  const m = Math.floor(t / 60), sec = t % 60;
  console.log(`${shots.length} shots, ${m}:${String(sec).padStart(2, "0")} total`);
})();
