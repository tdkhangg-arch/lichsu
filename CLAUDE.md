# StickDad History: YouTube history channel (project "Lịch Sử Các Nước")

English-language animated history videos for viewers in the US, UK, Canada and Australia.
The owner writes in Vietnamese; reply in Vietnamese, but write all video scripts, titles and
descriptions in English.

Channel name: **StickDad History** (handle @StickDadHistory if available). Channel art in
`channel/`: `stickdad-banner.png` (2560×1440), `stickdad-logo.png` / `stickdad-logo-800.png`.
From episode 2 on, the father can mention the channel name in the outro.

## Style
- Stick-figure characters: big round white head with a lavender crescent shadow, thick black
  ink outlines, stick arms and legs, black dot hands, white oval feet, detailed period costumes.
- Characters and backgrounds are drawn by code in `index.html` (Xưởng Nhân Vật Sử). New scenes
  go in its `SCENES` table; new parts in `HAIR`, `HATS`, `OUTFITS`, `PROPS`.
- Narration voice: calm documentary narrator, light dry humor, serious at sad moments.
- Framing (since episode 1 revision): a modern-day father tells the story to his 16-year-old
  son in their living room. Intro: son plays a samurai game on his phone, father asks if he
  knows about real samurai, invites him to sit and listen. Outro: back on the sofa, father asks
  if he wants the next story and tells viewers to like and subscribe. Dialogue shots have
  `id` ("intro-1"…), `speaker` ("father" = Charon, also the narrator; "son" = Puck) and use
  the `livingroom` scene, `tshirt`/`hoodie` outfits, `glasses`, `book`, `phone`, `sit` pose.
- YouTube safety: no graphic violence or crude words. Avoid "kill", "murder", "head" (as a
  trophy), "blood", "suicide" described graphically. Use "fell", "struck down", "was gone".
- Copyright: scripts are original; images are drawn by our code; music is synthesized by
  `tools/make-music.py`. Never add downloaded music, images or clips.

## Episodes
| # | Folder | Topic | Status |
|---|---|---|---|
| 1 | `episodes/01-47-ronin` | The 47 Ronin (1701–1703) | Final: Gemini voice (Charon/Puck), father/son intro and outro, 3 Shorts. Owner wants it kept as is; do not re-voice with ElevenLabs |
| 2 | `episodes/02-okehazama` | Battle of Okehazama (1560) | Script and frames done, with father/son intro and outro; render with ElevenLabs |
| 3 | (next) | Honnō-ji Incident (1582) | Teased at the end of episode 2 |

## Pipeline (run from the repo root)
1. Write `episodes/<NN-name>/shots.js` (narration, scene notes, characters, YouTube package,
   `music_moods`). Copy the structure of episode 2.
2. `node tools/build-episode.js episodes/<NN-name>/shots.js` → 1920×1080 frames + `episode.json` + `voiceover.txt`
3. `node tools/build-prompts.js episodes/<NN-name>` → `prompts.jsonl` (one AI prompt per shot)
4. `node tools/build-script.js episodes/<NN-name>` → `scripts/<NN-name>.md`
5. `python3 tools/make-video.py episodes/<NN-name> --model gemini-3.1-flash-tts-preview`
   → `<NN-name>.mp4` with Gemini voice (voice Charon). Dialogue shots use
   `--dialogue-model` (default gemini-3.8-flash-tts) to spread the free quota. Voices one request per section and splits
   at pauses, to fit the free tier; falls back to other TTS models on blocks or quota.
6. `python3 tools/make-music.py episodes/<NN-name>` → `<NN-name>-music.mp4` (final video).
   Music stays at one fixed level, 18 dB under the voice (owner asked for no ducking).
   Final loudness −14 LUFS.

7. Shorts: `python3 tools/make-short.py episodes/<NN-name> --shots ... --title ... --out ...`
   (vertical 1080×1920 cut from the finished video; see `episodes/01-47-ronin/shorts.md`).

Rendered videos and `build/` are git-ignored; send finished videos to the owner as files.

## Environment notes
- Voice engines:
  - **ElevenLabs connector (preferred from episode 2; owner has a paid plan).** Run in a session on
    the `lichsu` environment, which allows `elevenlabsusercontent.com` so generated audio can be
    downloaded. For every shot in episode.json: `creative_generate_speech` with model `eleven_v4`,
    voice = narrator/father "Marcus K - Calm Documentary Narrator" (3H55HGnNE1XjYxigHSAS) or
    son "Brayden - Conversational Older Teen" (3XOBzXhnDY98yeWQ3GdM); reuse one flow per episode;
    poll `creative_get_flow_run_status`; download the first take's `content_url` with curl to
    `episodes/<NN>/build/audio/<shot id>.mp3`. Then `python3 tools/make-video.py episodes/<NN> --engine files`.
    Costs about 1 credit per character per take (2 takes by default).
  - Direct ElevenLabs API (`--engine elevenlabs`, env var `ELEVENLABS_API_KEY`) also works if a key is added.
  - Gemini (free fallback, env var `KEY`): see step 5.
- Free tier: 10 TTS requests per day per model; resets at midnight Pacific time.
- Python needs `scipy` (`pip install scipy`); ffmpeg and Playwright are preinstalled.
- Work branch: `add-47-ronin-script` on github.com/tdkhangg-arch/lichsu.
