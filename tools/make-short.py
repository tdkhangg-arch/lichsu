#!/usr/bin/env python3
"""Cut a vertical YouTube Short (1080x1920) from a finished episode.

Takes chosen shots from <name>-music.mp4 (voice and music already mixed), stacks them in
order, places the 16:9 picture in the middle of a vertical frame, adds a title on top,
burned-in subtitles below, and an end card.

Usage:
  python3 tools/make-short.py episodes/01-47-ronin --shots 13,15,25,27,33,36 \
      --title "They waited 2 years|for revenge" --end "What happened next?|Full story on our channel" --out short-1
"""
import argparse, json, re, subprocess, sys
from pathlib import Path

W, H = 1080, 1920
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
BG = "0x16151c"
TAIL = 0.5   # silence that make-video.py leaves after each shot's narration


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        sys.exit(r.stderr[-1500:])


def esc(t):
    return t.replace("\\", "\\\\").replace(":", "\\:").replace("'", "’").replace("%", "\\%").replace(",", "\\,")


def chunks(text, size=4):
    """Split narration into short subtitle lines, keeping sentence ends as breaks."""
    out = []
    for sent in re.split(r"(?<=[.?!])\s+", text.strip()):
        words = sent.split()
        n = max(1, round(len(words) / size))
        step = len(words) / n
        out += [" ".join(words[round(i * step): round((i + 1) * step)]) for i in range(n)]
    return [c for c in out if c]


def text_lines(lines, y0, size, step, color="white", box=None, enable=None):
    f = ""
    for i, line in enumerate(lines):
        f += (f",drawtext=fontfile={FONT}:text='{esc(line)}':fontsize={size}:fontcolor={color}"
              f":x=(w-text_w)/2:y={y0 + i * step}:borderw=6:bordercolor=black@0.85")
        if box:
            f += f":box=1:boxcolor={box}:boxborderw=18"
        if enable:
            f += f":enable='{enable}'"
    return f


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode_dir")
    ap.add_argument("--shots", required=True, help="comma-separated shot numbers, 1-based")
    ap.add_argument("--title", required=True, help="use | for a line break")
    ap.add_argument("--end", default="Full story on our channel", help="end card text, | for line breaks")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    ep_dir = Path(a.episode_dir).resolve()
    ep = json.loads((ep_dir / "episode.timed.json").read_text())
    name = "47-ronin" if "ronin" in ep_dir.name else ep_dir.name
    src = ep_dir / f"{name}-music.mp4"
    build = ep_dir / "build" / "shorts"
    build.mkdir(parents=True, exist_ok=True)

    picks = [ep["shots"][int(n) - 1] for n in a.shots.split(",")]
    parts = []
    for k, s in enumerate(picks):
        part = build / f"{a.out}-{k:02d}.mp4"
        d = s["duration"]
        run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{s['start']:.3f}", "-t", f"{d:.3f}", "-i", str(src),
             "-vf", "fps=30", "-af", f"afade=t=in:d=0.05,afade=t=out:st={d - 0.08:.3f}:d=0.08",
             "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-c:a", "aac", "-b:a", "192k", str(part)])
        parts.append((part, s))

    # subtitle schedule over the joined clip
    subs, t = [], 0.0
    for part, s in parts:
        lines = chunks(s["narration"])
        words = [len(c.split()) for c in lines]
        speak = max(s["duration"] - TAIL, 0.5)
        u = t
        for line, w in zip(lines, words):
            dt = speak * w / sum(words)
            subs.append((u, u + dt, line))
            u += dt
        t += s["duration"]
    END = 2.5
    total = t + END

    lst = build / f"{a.out}.txt"
    lst.write_text("".join(f"file '{p.name}'\n" for p, _ in parts))
    joined = build / f"{a.out}-joined.mp4"
    run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst),
         "-c", "copy", str(joined)])

    pic_h = 900          # picture enlarged; about two thirds of its width stays visible
    vf = (f"[0:v]tpad=stop_mode=clone:stop_duration={END},scale=-2:{int(pic_h)},crop={W}:{int(pic_h)},"
          f"pad={W}:{H}:0:(oh-ih)/2:color={BG}")
    vf += text_lines(a.title.split("|"), 210, 58, 84, color="white", box="0xa8342c@0.95")
    for a0, a1, line in subs:
        vf += (f",drawtext=fontfile={FONT}:text='{esc(line)}':fontsize=60:fontcolor=white:borderw=7"
               f":bordercolor=black:x=(w-text_w)/2:y=1530:enable='between(t,{a0:.2f},{a1:.2f})'")
    vf += text_lines(a.end.split("|"), 1500, 58, 84, color="0xffd75a", enable=f"gte(t,{t:.2f})")
    vf += f",fade=t=out:st={total - 0.6:.2f}:d=0.6[v]"
    out = ep_dir / f"{a.out}.mp4"
    run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(joined), "-filter_complex",
         vf + f";[0:a]apad=pad_dur={END},afade=t=out:st={total - 1.2:.2f}:d=1.2[a]",
         "-map", "[v]", "-map", "[a]", "-t", f"{total:.2f}",
         "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(out)])
    print(f"done: {out.name} {total:.1f}s")


if __name__ == "__main__":
    main()
