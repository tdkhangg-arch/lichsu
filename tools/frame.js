// Shared frame renderer: loads the drawing code from index.html and turns one shot into an SVG.
// Used by build-episode.js (one still per shot) and build-anim.js (animated frames).
//
// Animation: a shot may define anim(t, sec) returning overrides (fx, characters, tint, rain, ...) for
// progress t (0..1 over the shot) and sec (seconds into the shot). While animating, the global ANIM
// ({t, sec}) is visible to the drawing code, so waves drift, flames flicker, ships bob and rain falls,
// and characters breathe (a small vertical bob).
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const GROUND = 292; // feet line in a 480x270 frame (viewBox y 30..300)

function loadCtx() {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const script = html.split("<script>")[1].split("/* ---------- State + UI")[0];
  const ctx = { ANIM: null };
  vm.createContext(ctx);
  vm.runInContext(script + ";this.character=character;this.SCENES=SCENES;this.FX=FX;this.MUDAT=MUDAT;this.SHIVER=SHIVER;", ctx);
  return ctx;
}

// apply a shot's anim(t, sec) overrides; without anim the shot is returned unchanged
function at(shot, t, sec) {
  return shot.anim ? { ...shot, ...shot.anim(t, sec) } : shot;
}

function frameSVG(ctx, shot0, { t = null, sec = 0, width = 1920, height = 1080 } = {}) {
  const animating = t !== null;
  const shot = animating ? at(shot0, t, sec) : shot0.anim ? at(shot0, shot0.stillAt ?? 0.6, 0) : shot0;
  vm.runInContext(`ANIM = ${animating ? JSON.stringify({ t, sec }) : "null"};`, ctx);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 30 480 270" width="${width}" height="${height}">`;
  s += ctx.SCENES[shot.background].d();
  if (shot.tint) s += `<rect x="0" y="0" width="480" height="320" fill="${shot.tint.color}" opacity="${shot.tint.opacity}"/>`;
  const fx = (front) => (shot.fx || []).filter(f => f && !!f.front === front).map(f => ctx.FX[f.type](f)).join("");
  s += fx(false);
  (shot.characters || []).forEach((ch, i) => {
    const sc = ch.scale || 0.75;
    const g = ch.ground || GROUND;
    // breathing: a gentle bob, out of step between characters (only while animating)
    const bob = animating && !ch.still ? 1.4 * Math.sin(2 * Math.PI * (sec * 0.55 + i * 0.37)) * sc : 0;
    const y = g - 272 * sc + bob;
    const rot = ch.rot ? ` rotate(${ch.rot} 100 268)` : "";
    s += `<g transform="translate(${ch.x - 100 * sc} ${y}) scale(${sc})${rot}">${ctx.character(ch.cfg)}</g>`;
    if (ch.mud) s += ch.rot ? ctx.MUDAT(ch.x + Math.sign(ch.rot) * 190 * sc, g, sc * 0.7, ch.mud) : ctx.MUDAT(ch.x, g, sc, ch.mud);
    if (ch.shiver) s += ctx.SHIVER(ch.x, g, sc);
  });
  s += fx(true);
  if (shot.rain) {
    // heavy diagonal rain; the pattern changes every frame while animating
    let seed = 7 + (animating ? Math.floor(sec * 12) : 0);
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    s += `<rect x="0" y="0" width="480" height="320" fill="#2b3442" opacity="0.35"/>`;
    for (let i = 0; i < 260; i++) {
      const x = rnd() * 560 - 40, y = rnd() * 300 + 20, l = 10 + rnd() * 14;
      s += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x - l * 0.35).toFixed(1)}" y2="${(y + l).toFixed(1)}" stroke="#dfe7f2" stroke-width="1.3" opacity="0.7"/>`;
    }
  }
  return s + "</svg>";
}

module.exports = { loadCtx, frameSVG, at, GROUND };
