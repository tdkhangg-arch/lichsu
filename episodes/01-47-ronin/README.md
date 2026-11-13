# Episode 1 production pack: The 47 Ronin

- `episode.json`: shot list for the video editor (GOHA or any other tool)
- `images/shot-XX.png`: one 1920×1080 frame per shot
- `prompts.jsonl`: one JSON object per line, one line per shot, with an AI image/video prompt, negative prompt, timing, camera, caption, narration and reference frame. Rebuild with `node tools/build-prompts.js episodes/01-47-ronin`
- `voiceover.txt`: full English narration, one paragraph per shot, for AI voice or recording
- `shots.js`: source definitions; rebuild with `node tools/build-episode.js episodes/01-47-ronin/shots.js`

## episode.json fields

| Field | Meaning |
|---|---|
| `title`, `language`, `resolution`, `fps` | Video settings |
| `total_duration` | Estimated length in seconds |
| `shots[].id` | `shot-01` … `shot-45` |
| `shots[].section` | Chapter name (matches the YouTube chapters in the script) |
| `shots[].start`, `duration` | Seconds, estimated at 145 words per minute plus a short pause |
| `shots[].image` | Frame to show, relative to this folder |
| `shots[].camera` | Suggested motion: `static`, `slow zoom in`, `track left`, `shake`… |
| `shots[].characters` | Who is on screen, with expression and pose |
| `shots[].on_screen_text` | Caption to overlay, or `null` |
| `shots[].narration` | Words spoken during this shot |

After recording the voiceover, set each shot's `duration` to the real length of its narration.
