// Writes the readable script (scripts/<episode>.md) from an episode's shots.js and episode.json.
// Usage: node tools/build-script.js episodes/02-okehazama
const fs = require("fs");
const path = require("path");

const dir = path.resolve(process.argv[2]);
const def = require(path.join(dir, "shots.js"));
const ep = JSON.parse(fs.readFileSync(path.join(dir, "episode.json"), "utf8"));
const yt = def.youtube || {};
const mmss = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

const words = def.shots.reduce((n, s) => n + s.narration.split(/\s+/).length, 0);
let md = `# ${def.title}\n\n`;
md += `**Target length:** about ${Math.round(ep.total_duration / 60)} minutes (${words} spoken words at 145 words per minute)\n`;
md += `**Audience:** US, UK, Canada, Australia\n\n---\n\n## YouTube package\n\n`;
md += `**Title options**\n${(yt.titles || [def.title]).map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\n`;
if (yt.thumbnail) md += `**Thumbnail:** ${yt.thumbnail}\n\n`;

const chapters = [];
for (const s of ep.shots) if (!chapters.length || chapters[chapters.length - 1].name !== s.section) chapters.push({ name: s.section, start: s.start });
md += `**Description**\n> ${yt.description || ""}\n>\n${chapters.map(c => `> ${mmss(c.start)} ${c.name}`).join("\n")}\n\n`;
md += `Chapter times are estimates; update them from episode.timed.json after the voiceover is recorded.\n\n`;
if (yt.tags) md += `**Tags:** ${yt.tags}\n\n`;
if (yt.pinned) md += `**Pinned comment:** ${yt.pinned}\n\n`;
md += `---\n\n## Script\n\nScene notes in [brackets]. Characters and backgrounds come from Xưởng Nhân Vật Sử.\n`;

let current = null;
def.shots.forEach((s, i) => {
  if (s.section !== current) {
    current = s.section;
    md += `\n### ${mmss(ep.shots[i].start)} – ${s.section}\n`;
  }
  const who = s.speaker ? `${s.speaker.toUpperCase()}: ` : "";
  md += `\n[SCENE ${i + 1}: ${s.note || s.background}${s.text ? ` On screen: ${s.text}` : ""}]\n\n${who}${s.narration}\n`;
});

const out = path.join(__dirname, "..", "scripts", `${path.basename(dir)}.md`);
fs.writeFileSync(out, md);
console.log(`wrote ${path.relative(process.cwd(), out)} (${words} words)`);
