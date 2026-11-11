#!/usr/bin/env python3
"""Compose an original background score for an episode, then mix it under the voiceover.

Everything is synthesized here (koto plucks, shakuhachi-style flute, taiko, drones) from a
seeded random melody on the Japanese miyako-bushi scale, so the music is original and
free of third-party copyright.

Usage: python3 tools/make-music.py episodes/01-47-ronin
Needs episode.timed.json and the rendered <name>.mp4 from make-video.py.
Writes build/music.wav and <name>-music.mp4. The music is mixed at one fixed level
(no ducking or automatic leveling), VOICE_TO_MUSIC_DB under the voice.
"""
import json, subprocess, sys
from pathlib import Path
import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt
from scipy.io import wavfile

SR = 44100
# D miyako-bushi: D Eb G A Bb, over several octaves
STEPS = [0, 1, 5, 7, 8]
def scale_freq(i, base=146.83):  # i = scale degree index, 0 = D3
    octave, deg = divmod(i, len(STEPS))
    return base * 2 ** (octave + STEPS[deg] / 12)

# Mood for each section title (falls back to "light")
MOODS = {
    "Hook": "tense",
    "Samurai without wars": "light",
    "The sword in the castle": "court",
    "Masters become ronin": "sad",
    "The long wait": "mystery",
    "The night raid": "raid",
    "The walk to Sengaku-ji": "solemn",
    "The verdict": "quiet",
    "Heroes or outlaws?": "reflect",
}


def env_ad(n, attack, decay_rate):
    t = np.arange(n) / SR
    a = np.minimum(t / max(attack, 1e-4), 1.0)
    return a * np.exp(-t * decay_rate)


def koto(f, dur=2.5, vel=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    out = np.zeros(n)
    for h in range(1, 9):
        fh = f * h * (1 + 0.0008 * h * h)            # slight string inharmonicity
        out += np.sin(2 * np.pi * fh * t) * (1 / h ** 1.1) * np.exp(-t * (2.2 + 1.3 * h))
    bend = 1 - 0.01 * np.exp(-t * 30)                # tiny pitch drop at the pluck
    out *= np.minimum(t / 0.003, 1)
    out += np.random.randn(n) * np.exp(-t * 120) * 0.15
    return out * vel * 0.35 * bend


def flute(f, dur, vel=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    vib = 1 + 0.006 * np.sin(2 * np.pi * 5.2 * t) * np.minimum(t / 0.6, 1)
    phase = 2 * np.pi * np.cumsum(f * vib) / SR
    tone = np.sin(phase) + 0.18 * np.sin(2 * phase) + 0.05 * np.sin(3 * phase)
    breath = sosfilt(butter(2, [f * 0.8, f * 4], btype="band", fs=SR, output="sos"), np.random.randn(n)) * 0.25
    att = np.minimum(t / 0.18, 1); rel = np.minimum((dur - t) / 0.35, 1).clip(0)
    swell = 0.85 + 0.15 * np.sin(np.pi * t / dur)
    return (tone + breath) * att * rel * swell * vel * 0.22


def drone(f, dur, vel=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * f * d * t) for d in (1, 1.003, 0.997)) + 0.5 * np.sin(2 * np.pi * f * 1.5 * t)
    lfo = 0.75 + 0.25 * np.sin(2 * np.pi * 0.07 * t)
    return s * lfo * vel * 0.05


def taiko(vel=1.0, big=True):
    dur = 0.9 if big else 0.25
    n = int(dur * SR); t = np.arange(n) / SR
    f0, f1 = (110, 55) if big else (420, 300)
    phase = 2 * np.pi * np.cumsum(f1 + (f0 - f1) * np.exp(-t * 18)) / SR
    body = np.sin(phase) * np.exp(-t * (5 if big else 30))
    hit = np.random.randn(n) * np.exp(-t * (60 if big else 90)) * (0.4 if big else 0.6)
    return (body + hit) * vel * (0.55 if big else 0.25)


def place(buf, sig, at, pan=0.0):
    i = int(at * SR)
    if i >= buf.shape[1]:
        return
    sig = sig[: buf.shape[1] - i]
    buf[0, i:i + len(sig)] += sig * (1 - pan) * 0.5 * 2 ** 0.5
    buf[1, i:i + len(sig)] += sig * (1 + pan) * 0.5 * 2 ** 0.5


def walk(rng, pos, lo, hi):
    pos += rng.choice([-2, -1, -1, 1, 1, 2, 0])
    return int(min(max(pos, lo), hi))


def compose(mood, dur, rng):
    buf = np.zeros((2, int(dur * SR)))
    D2, A2 = 73.42, 110.0
    if mood in ("tense", "sad", "mystery", "raid", "solemn", "quiet", "reflect", "court"):
        level = {"quiet": 1.2, "sad": 1.0, "raid": 0.8}.get(mood, 0.9)
        place(buf, drone(D2, dur, level), 0, -0.2)
        place(buf, drone(A2, dur, level * 0.6), 0, 0.2)

    if mood == "tense":
        t, pos = 0.8, 3
        while t < dur - 1:
            place(buf, taiko(0.7), t); place(buf, taiko(0.45), t + 0.32)    # heartbeat
            t += 2.4
        t = 1.5
        while t < dur - 2:
            pos = walk(rng, pos, 0, 7)
            place(buf, koto(scale_freq(pos), 3, 0.6), t, rng.uniform(-0.5, 0.5))
            t += rng.choice([1.2, 1.6, 2.4])

    elif mood in ("light", "court"):
        beat = 60 / (96 if mood == "light" else 84)
        pos, t, k = 5, 0.0, 0
        while t < dur - 1:
            if rng.random() > 0.12:
                pos = walk(rng, pos, 3, 11)
                place(buf, koto(scale_freq(pos), 2, 0.55 if k % 4 else 0.8), t, rng.uniform(-0.4, 0.4))
            if k % 8 == 0:
                place(buf, koto(scale_freq(0), 3, 0.5), t, -0.3)             # bass note each bar
            t += beat / 2; k += 1
        t = 4.0
        while t < dur - 4 and mood == "light":
            if rng.random() < 0.5:
                L = rng.choice([1.5, 2, 3]) * beat
                place(buf, flute(scale_freq(rng.integers(8, 12)), L, 0.6), t, 0.15)
            t += 4 * beat

    elif mood == "sad":
        t, pos = 1.0, 8
        while t < dur - 2:
            pos = walk(rng, pos, 5, 11)
            L = rng.choice([2.5, 3.5, 4.5])
            place(buf, flute(scale_freq(pos), min(L, dur - t), 0.8), t, 0.1)
            if rng.random() < 0.5:
                place(buf, koto(scale_freq(pos - 5), 3, 0.35), t, -0.3)
            t += L + rng.choice([0.3, 0.8])

    elif mood == "mystery":
        beat = 60 / 80
        t, k = 0.0, 0
        ost = [0, 2, 1, 2, 0, 3, 1, 2]
        while t < dur - 1:
            place(buf, koto(scale_freq(ost[k % 8]), 0.5, 0.45), t, -0.2)
            if k % 6 == 3 and rng.random() < 0.7:
                place(buf, koto(scale_freq(rng.integers(12, 16)), 2.5, 0.3), t, 0.5)
            t += beat / 2; k += 1

    elif mood == "raid":
        beat = 60 / 120
        t, k = 0.0, 0
        while t < dur - 1:
            if k % 8 in (0, 3, 6):
                place(buf, taiko(0.9 if k % 8 == 0 else 0.6), t)
            if k % 2 == 1:
                place(buf, taiko(0.5, big=False), t, 0.3)
            place(buf, koto(scale_freq([0, 0, 2, 0, 1, 0, 3, 2][k % 8]), 0.35, 0.4), t, -0.3)
            if k % 16 == 0 and rng.random() < 0.8:
                place(buf, flute(scale_freq(rng.integers(9, 12)), beat * 3, 0.55), t + beat * 4, 0.2)
            t += beat / 2; k += 1

    elif mood == "solemn":
        beat = 60 / 60
        t, pos = 0.5, 7
        while t < dur - 3:
            pos = walk(rng, pos, 5, 10)
            place(buf, flute(scale_freq(pos), 3.6 * beat, 0.7), t, 0.1)
            for j, d in enumerate((0, 2, 4)):
                place(buf, koto(scale_freq(d), 4, 0.35), t + j * 0.06, -0.3)
            t += 4 * beat

    elif mood == "quiet":
        t = 2.0
        while t < dur - 3:
            place(buf, koto(scale_freq(rng.integers(5, 10)), 4, 0.3), t, rng.uniform(-0.5, 0.5))
            t += rng.choice([3.0, 4.0, 5.0])

    elif mood == "reflect":
        beat = 60 / 72
        t, k, pos = 0.0, 0, 8
        while t < dur - 6:
            place(buf, koto(scale_freq([0, 2, 4, 5, 7, 5, 4, 2][k % 8]), 2.5, 0.4), t, -0.2)
            if k % 8 == 0:
                pos = walk(rng, pos, 6, 11)
                place(buf, flute(scale_freq(pos), beat * 3.5, 0.6), t + beat, 0.2)
            t += beat / 2; k += 1
        place(buf, koto(scale_freq(0), 6, 0.6), dur - 6, -0.2)                # final D
        place(buf, koto(scale_freq(5), 6, 0.5), dur - 5.95, 0.2)
    return buf


def reverb(buf, seconds=2.2, wet=0.28, rng=None):
    n = int(seconds * SR); t = np.arange(n) / SR
    out = np.empty_like(buf)
    for c in range(2):
        ir = rng.standard_normal(n) * np.exp(-t * 6.9 / seconds)
        ir = sosfilt(butter(1, 5000, fs=SR, output="sos"), ir)
        ir /= np.sqrt(np.sum(ir ** 2))
        out[c] = (1 - wet) * buf[c] + wet * fftconvolve(buf[c], ir)[: buf.shape[1]]
    return out


VOICE_TO_MUSIC_DB = 18   # music this many dB under the voice, all the time
TARGET_LUFS = -14        # YouTube loudness


def ff(args):
    r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args], capture_output=True, text=True)
    if r.returncode:
        sys.exit(r.stderr[-1500:])


def lufs(path):
    log = subprocess.run(["ffmpeg", "-i", str(path), "-af", "ebur128", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    import re
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", log)[-1])


def main():
    ep_dir = Path(sys.argv[1]).resolve()
    ep = json.loads((ep_dir / "episode.timed.json").read_text())
    total = ep["total_duration"]
    sections = []
    for s in ep["shots"]:
        if not sections or sections[-1][0] != s["section"]:
            sections.append([s["section"], s["start"]])
    bounds = [(name, start, (sections[i + 1][1] if i + 1 < len(sections) else total)) for i, (name, start) in enumerate(sections)]

    XF = 2.0  # crossfade seconds between moods
    mix = np.zeros((2, int((total + 1) * SR)))
    for i, (name, a, b) in enumerate(bounds):
        mood = MOODS.get(name, "light")
        rng = np.random.default_rng(1703 + i)
        np.random.seed(1703 + i)
        dur = (b - a) + (XF if i + 1 < len(bounds) else 0)
        seg = reverb(compose(mood, dur, rng), rng=rng)
        seg *= 0.05 / (np.sqrt(np.mean(seg ** 2)) + 1e-9)   # same average level in every section
        n = seg.shape[1]; fade = np.ones(n); k = int(XF * SR)
        if i > 0: fade[:k] = np.linspace(0, 1, k)
        if i + 1 < len(bounds): fade[-k:] = np.linspace(1, 0, k)
        seg *= fade
        j = int(a * SR)
        mix[:, j:j + n] += seg[:, : mix.shape[1] - j]
        print(f"{a:6.1f}s  {mood:8s} {name}", flush=True)

    mix /= np.max(np.abs(mix)) + 1e-9
    mix *= 0.9
    build = ep_dir / "build"; build.mkdir(exist_ok=True)
    wav = build / "music.wav"
    wavfile.write(wav, SR, (mix.T * 32767).astype(np.int16))

    name = "47-ronin" if "ronin" in ep_dir.name else ep_dir.name
    src, out = ep_dir / f"{name}.mp4", ep_dir / f"{name}-music.mp4"
    voice_wav = build / "voice.wav"
    ff(["-i", str(src), "-vn", "-ac", "2", "-ar", str(SR), str(voice_wav)])
    # Fixed gains only (no ducking, no automatic leveling), so the music stays at one
    # steady level whether or not someone is talking.
    music_gain = (lufs(voice_wav) - VOICE_TO_MUSIC_DB) - lufs(wav)
    mixed = build / "mixed.wav"
    ff(["-i", str(voice_wav), "-i", str(wav), "-filter_complex",
        f"[1:a]volume={music_gain:.2f}dB[m];[0:a][m]amix=inputs=2:normalize=0:duration=first[a]",
        "-map", "[a]", str(mixed)])
    final_gain = TARGET_LUFS - lufs(mixed)
    ff(["-i", str(src), "-i", str(mixed), "-filter_complex",
        f"[1:a]volume={final_gain:.2f}dB,alimiter=limit=0.89:level=false,afade=t=out:st={total-2:.2f}:d=2[a]",
        "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart", str(out)])
    print(f"done: {out.name}")


if __name__ == "__main__":
    main()
