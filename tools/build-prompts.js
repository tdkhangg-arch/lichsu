// Writes prompts.jsonl (one JSON object per line, one line per shot) for AI image/video tools.
// Usage: node tools/build-prompts.js episodes/01-47-ronin
const fs = require("fs");
const path = require("path");

const dir = path.resolve(process.argv[2]);
const def = require(path.join(dir, "shots.js"));
const episode = JSON.parse(fs.readFileSync(path.join(dir, "episode.json"), "utf8"));

const STYLE =
  "2D cartoon illustration, educational history YouTube style, clean thick black ink outlines, flat muted colors with soft cel shading, " +
  "stick-figure characters with large round plain white heads with a pale lavender crescent shadow on one side, simple dot eyes, expressive eyebrows, " +
  "thin black stick arms and legs, solid black round hands, small white oval feet, detailed period costumes, 16:9";
const NEGATIVE =
  "realistic, photo, 3D render, anime, detailed faces, noses, skin color on heads, gore, blood, text, watermark, logo, extra limbs";

const BACKGROUNDS = {
  paper: "plain light lavender-grey background with a faint ground line",
  night: "hilltop at night overlooking a river valley, dark purple sky with clouds",
  village: "dirt street of a traditional Japanese Edo-period town, wooden houses with tiled and thatched roofs, green mountains, temple in the distance, sunny blue sky",
  snow: "snowy open field with frozen puddles and small snow-covered wooden houses on the horizon, overcast sky",
  palace: "interior of a Japanese castle hall, tatami floor, golden folding screen, shoji paper sliding doors, wooden posts, warm light beam",
  valley: "narrow green valley between wooded hills, dirt path, Sengoku-era Japan",
  shrine: "Japanese Shinto shrine with a red torii gate, stone path and small shrine hall",
  livingroom: "modern cozy living room, a blue sofa and an orange sofa facing each other, window, floor lamp, wooden floor, rug",
  ruins: "devastated rice fields under a grey sky, distant Japanese castle burning with smoke, dead trees",
  field: "freshly ploughed muddy field in northern France between two dark woods, puddles, overcast grey sky, 1415",
  hall: "medieval stone castle hall, gothic arched window, blue banner with gold fleurs-de-lis and red banner with gold lions, torches, red carpet",
  siege: "medieval town walls and towers of Harfleur with a breach, smoke, English tents with red crosses and a bronze cannon in front",
  river: "autumn riverbank of the River Somme, broken stone bridge, orange and brown trees, grey sky",
  parchment: "aged parchment paper with a faint old map of the English Channel coast, compass rose and border",
  camp: "medieval French army camp at night, blue and white tents with gold pennants, campfire, stars and moon",
};
const OUTFITS = {
  stick: "no clothes, plain stick body",
  tshirt: "modern T-shirt and blue jeans",
  hoodie: "modern hoodie and dark jeans",
  armor: "lamellar samurai armor with shoulder plates and plated skirt",
  kimono: "kimono with white obi sash and wave pattern",
  robe: "long flowing layered court robe",
  soldier: "military uniform with cross straps and belt",
  peasant: "simple loose work shirt and dark trousers",
  roman: "Roman legionary segmented armor and tunic",
  mandarin: "long official court robe with square badge",
  suit: "modern dark suit and tie",
  knight: "chainmail and surcoat",
  knight_en: "English man-at-arms in chainmail and plate shoulders with a white surcoat bearing the red cross of St George",
  knight_fr: "French knight in shiny polished armor with a long royal blue surcoat covered in gold fleurs-de-lis",
  knight_royal: "King Henry V in armor with a surcoat of the quartered English royal arms (blue with gold fleurs-de-lis, red with gold lions)",
  archer: "ragged, torn and muddy English longbowman's padded jacket with patches and a small red St George cross badge, arrows tucked in the belt",
};
const HAIR = { none: "bald", short: "short black hair", topknot: "samurai chonmage topknot with shaved crown", bun: "black hair in a bun", long: "very long straight black hair" };
const HAT = { none: "", glasses: "round glasses", nonla: "conical straw hat", kabuto: "samurai kabuto helmet with gold crest", cap: "military field cap", helmet: "steel helmet", mandarin: "black official hat with side wings", crown: "gold crown", roman: "Roman helmet with red crest", tophat: "black top hat", bascinet: "steel bascinet helmet with mail neck guard", royalhelm: "steel bascinet helmet with a gold crown around it", kettle: "wide-brimmed steel kettle hat", hood: "brown cloth hood" };
const FACE = { neutral: "calm", angry: "angry frowning", smug: "smug half-lidded smirk", gentle: "gentle shy smile", determined: "determined", surprised: "shocked wide-eyed", closed: "eyes closed, solemn" };
const PROP = { none: "", book: "an open book", phone: "a smartphone playing a samurai game", katana: "katana and short sword at the hip", sword: "straight sword", rifle: "rifle with bayonet", spear: "spear", fan: "folding paper fan", scroll: "paper scroll", longbow: "a yew longbow taller than a man", bowdraw: "a longbow, drawing an arrow", stake: "a long sharpened wooden stake", mallet: "a wooden mallet", stgeorge: "a white banner with the red cross of St George", fleur: "a royal blue banner with gold fleurs-de-lis" };
const POSE = { stand: "standing", walk: "walking", bow: "bowing deeply", sit: "sitting on the sofa" };
const COLOR = { "#3a3640": "black", "#8a6a4a": "brown", "#9a7f55": "khaki", "#2f4f7f": "indigo blue", "#a8342c": "vermilion red", "#5b6b3a": "olive green", "#c2a77a": "beige silk", "#6b4a7a": "purple", "#2f4f9f": "royal blue", "#c0392b": "red" };

function who(c) {
  const k = c.cfg;
  const parts = [POSE[k.pose], `${FACE[k.face]} expression`, HAIR[k.hair], HAT[k.hat], `${COLOR[k.color] || ""} ${OUTFITS[k.outfit]}`.trim(), PROP[k.prop] ? `holding ${PROP[k.prop]}` : "", k.flip ? "facing right" : "facing left"];
  return `${c.name} (${parts.filter(Boolean).join(", ")})`;
}
function size(c) {
  const s = c.scale || 0.75;
  return s >= 1 ? "close-up" : s < 0.65 ? "small, in the background" : "";
}

const lines = def.shots.map((shot, i) => {
  const meta = episode.shots[i];
  const chars = shot.characters || [];
  const sorted = [...chars].sort((a, b) => a.x - b.x);
  const cast = sorted.map(c => [who(c), size(c)].filter(Boolean).join(", ")).join("; ");
  const mood = shot.tint ? (shot.tint.color === "#f29a3a" ? "warm dawn light" : "dark night atmosphere, cold blue moonlight") : "";
  const prompt = [
    STYLE,
    `Scene: ${BACKGROUNDS[shot.background]}${mood ? ", " + mood : ""}`,
    chars.length ? `Characters${sorted.length > 1 ? " from left to right" : ""}: ${cast}` : "",
    `Story moment: ${shot.narration.split(/(?<=[.?!])\s/)[0].replace(/[.?!"]+$/, "")}`,
  ].filter(Boolean).join(". ") + ".";
  return {
    id: meta.id,
    section: meta.section,
    start: meta.start,
    duration: meta.duration,
    prompt,
    negative_prompt: NEGATIVE,
    camera: meta.camera,
    on_screen_text: meta.on_screen_text,
    narration: meta.narration,
    reference_image: meta.image,
  };
});

fs.writeFileSync(path.join(dir, "prompts.jsonl"), lines.map(l => JSON.stringify(l)).join("\n") + "\n");
console.log(`${lines.length} lines written to prompts.jsonl`);
