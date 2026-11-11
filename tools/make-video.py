#!/usr/bin/env python3
"""Render a finished MP4 from an episode pack (episode.json + images/).

Voiceover comes from Google AI Studio (Gemini TTS, default) or Google Cloud
Text-to-Speech. For Gemini the key is read from the GEMINI_API_KEY or KEY environment
variable; if neither is set, the session's network proxy is expected to add it.

Usage:
  python3 tools/make-video.py episodes/01-47-ronin                 # with voiceover
  python3 tools/make-video.py episodes/01-47-ronin --silent        # draft, no voice
  python3 tools/make-video.py episodes/01-47-ronin --voice Charon            # Gemini voice name
  python3 tools/make-video.py episodes/01-47-ronin --engine cloud --voice en-US-Neural2-J
"""
import argparse, base64, json, os, re, subprocess, sys, time
from pathlib import Path

FPS = 30
W, H = 1920, 1080
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
TAIL = 0.5          # silence after each shot's narration
END_HOLD = 3.0      # extra hold on the last shot


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"Command failed: {' '.join(cmd[:6])}...\n{r.stderr[-1500:]}")
    return r.stdout


def duration(path):
    return float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)]).strip())


def tts(text, out, voice, rate):
    lang = "-".join(voice.split("-")[:2])
    body = json.dumps({
        "input": {"text": text},
        "voice": {"languageCode": lang, "name": voice},
        "audioConfig": {"audioEncoding": "MP3", "speakingRate": rate, "sampleRateHertz": 44100},
    })
    res = run(["curl", "-sS", "--fail-with-body", "-X", "POST",
               "https://texttospeech.googleapis.com/v1/text:synthesize",
               "-H", "Content-Type: application/json", "--data-binary", body])
    data = json.loads(res)
    if "audioContent" not in data:
        sys.exit(f"Google TTS error: {res[:500]}")
    out.write_bytes(base64.b64decode(data["audioContent"]))


# Gemini reads any instruction text aloud, so only the narration is sent.
STYLE = ""


def gemini_tts(text, out, voice, model):
    body = json.dumps({
        "contents": [{"parts": [{"text": STYLE + text}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}},
        },
    })
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("KEY")
    auth = ["-H", f"x-goog-api-key: {key}"] if key else []  # otherwise the proxy adds it
    for attempt in range(30):
        res = run(["curl", "-sS", "-X", "POST",
                   f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                   "-H", "Content-Type: application/json", *auth, "--data-binary", body])
        data = json.loads(res)
        err = data.get("error", {})
        if err.get("code") not in (429, 500, 503):
            break
        m = re.search(r'"retryDelay":\s*"(\d+)', res)
        wait = int(m.group(1)) + 2 if m else 30
        print(f"  quota/busy ({err.get('code')}), waiting {wait}s", flush=True)
        time.sleep(wait)
    try:
        pcm = base64.b64decode(data["candidates"][0]["content"]["parts"][0]["inlineData"]["data"])
    except (KeyError, IndexError):
        sys.exit(f"Gemini TTS error: {res[:500]}")
    raw = out.with_suffix(".pcm")
    raw.write_bytes(pcm)
    run(["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", str(raw),
         "-ar", "44100", "-b:a", "192k", str(out)])
    raw.unlink()


def silences(path):
    log = subprocess.run(["ffmpeg", "-i", str(path), "-af", "silencedetect=n=-38dB:d=0.25", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", log)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", log)]
    return list(zip(starts, ends))


def batch_voice(shots, build, voice, model):
    """One Gemini request per section; split the audio into shots at the pauses nearest
    to where each shot should end (by word count). Returns {shot id: mp3 path}."""
    out, sections = {}, []
    for s in shots:
        if not sections or sections[-1][0] != s["section"]:
            sections.append((s["section"], []))
        sections[-1][1].append(s)
    for n, (name, group) in enumerate(sections, 1):
        paths = [build / "audio" / f"{s['id']}-{voice}-{model}.mp3" for s in group]
        if all(p.exists() for p in paths):
            out.update({s["id"]: p for s, p in zip(group, paths)})
            continue
        whole = build / "audio" / f"section-{n:02d}-{voice}-{model}.mp3"
        if not whole.exists():
            print(f"voice section {n}: {name} ({len(group)} shots)", flush=True)
            gemini_tts("\n\n".join(s["narration"] for s in group), whole, voice, model)
        total = duration(whole)
        words = [len(s["narration"].split()) for s in group]
        gaps = silences(whole)
        cuts, used, acc = [0.0], set(), 0
        for w in words[:-1]:
            acc += w
            target = total * acc / sum(words)
            cands = [(abs((a + b) / 2 - target) - 0.6 * (b - a), i) for i, (a, b) in enumerate(gaps)
                     if i not in used and (a + b) / 2 > cuts[-1] + 0.5]
            if not cands:
                sys.exit(f"Could not find a pause to split section {n}")
            _, i = min(cands)
            used.add(i)
            cuts.append((gaps[i][0] + gaps[i][1]) / 2)
        cuts.append(total)
        for s, p, a0, a1 in zip(group, paths, cuts, cuts[1:]):
            run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(whole), "-ss", f"{a0:.3f}", "-to", f"{a1:.3f}",
                 "-af", "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse",
                 "-b:a", "192k", str(p)])
            print(f"  {s['id']}: {a1 - a0:.1f}s for {len(s['narration'].split())} words", flush=True)
        out.update({s["id"]: p for s, p in zip(group, paths)})
    return out


def camera_filter(cam, frames):
    d = max(frames - 1, 1)
    cx, cy = "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"
    if cam == "slow zoom in":
        z, x, y = f"1+0.12*on/{d}", cx, cy
    elif cam == "slow zoom out":
        z, x, y = f"1.12-0.12*on/{d}", cx, cy
    elif cam == "quick push in":
        z, x, y = f"1+0.18*min(on/({d}*0.25),1)", cx, cy
    elif cam in ("track left", "slow pan left"):
        z, x, y = "1.12", f"(iw-iw/zoom)*(1-on/{d})", cy
    elif cam in ("slow pan right",):
        z, x, y = "1.12", f"(iw-iw/zoom)*on/{d}", cy
    elif cam == "shake":
        z, x, y = "1.08", f"{cx}+18*sin(on*1.7)", f"{cy}+12*cos(on*2.3)"
    else:
        z, x, y = "1.0001", cx, cy
    return (f"scale=2880:1620,zoompan=z='{z}':x='{x}':y='{y}':d={frames}:s={W}x{H}:fps={FPS}")


def caption_filter(text):
    if not text:
        return ""
    safe = text.replace("\\", "\\\\").replace(":", "\\:").replace("'", "’").replace("%", "\\%")
    return (f",drawtext=fontfile={FONT}:text='{safe}':fontsize=60:fontcolor=0x1c1b22"
            f":box=1:boxcolor=white@0.92:boxborderw=24:x=80:y=80"
            f":alpha='if(lt(t,0.4),t/0.4,1)'")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode_dir")
    ap.add_argument("--engine", choices=["gemini", "cloud"], default="gemini")
    ap.add_argument("--model", default="gemini-3.8-flash-tts")
    ap.add_argument("--voice", help="Gemini: Charon, Orus, Puck... Cloud: en-US-Neural2-J...")
    ap.add_argument("--rate", type=float, default=0.95)
    ap.add_argument("--silent", action="store_true")
    ap.add_argument("--per-shot", action="store_true", help="one TTS request per shot (needs a paid quota)")
    ap.add_argument("--only", type=int, help="render only the first N shots (preview)")
    a = ap.parse_args()

    a.voice = a.voice or ("Charon" if a.engine == "gemini" else "en-US-Neural2-J")
    ep_dir = Path(a.episode_dir).resolve()
    ep = json.loads((ep_dir / "episode.json").read_text())
    shots = ep["shots"][: a.only] if a.only else ep["shots"]
    build = ep_dir / "build"
    (build / "audio").mkdir(parents=True, exist_ok=True)
    (build / "video").mkdir(parents=True, exist_ok=True)

    batched = {}
    if not a.silent and a.engine == "gemini" and not a.per_shot:
        batched = batch_voice(shots, build, a.voice, a.model)
    timed, t = [], 0.0
    for i, s in enumerate(shots):
        last = i == len(shots) - 1
        audio = None
        if a.silent:
            dur = float(s["duration"])
        else:
            audio = batched.get(s["id"]) or build / "audio" / f"{s['id']}-{a.voice}-{a.model}.mp3"
            if not audio.exists():
                print(f"voice {s['id']}", flush=True)
                if a.engine == "gemini":
                    words = len(s["narration"].split())
                    for attempt in range(3):
                        gemini_tts(s["narration"], audio, a.voice, a.model)
                        if duration(audio) <= words * 0.6 + 3:  # longer means extra or garbled speech
                            break
                        print(f"  {s['id']} too long ({duration(audio):.1f}s for {words} words), retrying", flush=True)
                else:
                    tts(s["narration"], audio, a.voice, a.rate)
            dur = duration(audio) + TAIL
        if last:
            dur += END_HOLD
        dur = round(dur, 2)
        frames = round(dur * FPS)
        seg = build / "video" / f"{s['id']}.mp4"
        print(f"render {s['id']} {dur:.1f}s {s['camera']}", flush=True)
        vf = camera_filter(s["camera"], frames) + caption_filter(s.get("on_screen_text"))
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-i", str(ep_dir / s["image"])]
        if audio:
            cmd += ["-i", str(audio), "-af", f"apad,atrim=0:{dur}"]
        else:
            cmd += ["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"]
        cmd += ["-vf", vf, "-frames:v", str(frames), "-t", str(dur),
                "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2", str(seg)]
        run(cmd)
        timed.append({**s, "start": round(t, 2), "duration": dur})
        t += dur

    lst = build / "segments.txt"
    lst.write_text("".join(f"file 'video/{s['id']}.mp4'\n" for s in shots))
    name = "47-ronin" if "ronin" in ep_dir.name else ep_dir.name
    out = ep_dir / f"{name}{'-draft' if a.silent else ''}.mp4"
    total = t
    run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst),
         "-vf", f"fade=t=in:st=0:d=0.8,fade=t=out:st={total-1.2:.2f}:d=1.2",
         "-af", f"afade=t=out:st={total-1.2:.2f}:d=1.2",
         "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(out)])
    (ep_dir / ("episode.timed.json" if not a.silent else "episode.draft-timed.json")).write_text(
        json.dumps({**ep, "total_duration": round(total, 2), "shots": timed}, indent=2, ensure_ascii=False) + "\n")
    m, sec = divmod(round(total), 60)
    print(f"done: {out.name} {m}:{sec:02d}")


if __name__ == "__main__":
    main()
