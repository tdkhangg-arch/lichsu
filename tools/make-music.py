#!/usr/bin/env python3
"""Compose an original background score for an episode, then mix it under the voiceover.

Everything is synthesized here from seeded random melodies, so the music is original and
free of third-party copyright. Two palettes, picked by `music_palette` in shots.js:
  "japanese" (default): koto plucks, shakuhachi-style flute, taiko, drones, miyako-bushi scale.
  "medieval": lute, recorder, hurdy-gurdy drone, war drum and tabor, choir pad, church bell and
              horn calls, on the D Dorian mode (for European episodes).

Usage: python3 tools/make-music.py episodes/01-47-ronin
       python3 tools/make-music.py episodes/03-agincourt --music-only   (score only, no video needed;
       uses episode.timed.json if present, else the estimated timing in episode.json)
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
DORIAN = [0, 2, 3, 5, 7, 9, 10]   # D E F G A B C
def scale_freq(i, base=146.83, steps=STEPS):  # i = scale degree index, 0 = D3
    octave, deg = divmod(int(i), len(steps))
    return base * 2 ** (octave + steps[deg] / 12)

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


# ---------- Medieval European instruments ----------
def lute(f, dur=1.8, vel=1.0):
    """Plucked double-course lute: two slightly detuned strings, bright attack, quick decay."""
    n = int(dur * SR); t = np.arange(n) / SR
    out = np.zeros(n)
    for det in (1.0, 1.0025):
        for h in range(1, 10):
            fh = f * det * h
            if fh > SR / 2.2:
                break
            out += np.sin(2 * np.pi * fh * t + h) * (1 / h ** 1.3) * np.exp(-t * (3.0 + 1.8 * h))
    out *= np.minimum(t / 0.002, 1)
    out += np.random.randn(n) * np.exp(-t * 200) * 0.06
    return out * vel * 0.2


def recorder(f, dur, vel=1.0):
    """Wooden recorder: purer than the shakuhachi-style flute, gentle vibrato."""
    n = int(dur * SR); t = np.arange(n) / SR
    vib = 1 + 0.003 * np.sin(2 * np.pi * 5.5 * t) * np.minimum(t / 0.8, 1)
    phase = 2 * np.pi * np.cumsum(f * vib) / SR
    tone = np.sin(phase) + 0.08 * np.sin(2 * phase) + 0.12 * np.sin(3 * phase)
    breath = sosfilt(butter(2, [f * 1.5, f * 5], btype="band", fs=SR, output="sos"), np.random.randn(n)) * 0.08
    att = np.minimum(t / 0.06, 1); rel = np.minimum((dur - t) / 0.12, 1).clip(0)
    return (tone + breath) * att * rel * vel * 0.2


def gurdy(f, dur, vel=1.0):
    """Hurdy-gurdy style drone: buzzy bowed tone, slow swell."""
    n = int(dur * SR); t = np.arange(n) / SR
    ph = 2 * np.pi * f * t
    saw = sum(np.sin(k * ph + 0.3 * np.sin(2 * np.pi * 0.21 * t)) / k for k in range(1, 14))
    saw = sosfilt(butter(2, 1400, fs=SR, output="sos"), saw)
    env = np.minimum(t / 1.2, 1) * np.minimum((dur - t) / 1.2, 1).clip(0)
    lfo = 0.85 + 0.15 * np.sin(2 * np.pi * 0.3 * t)
    return saw * env * lfo * vel * 0.035


def drum(vel=1.0, kind="war"):
    """war = big low field drum, tabor = small snappy drum."""
    f0, f1, dec, noise, dur, amp = {"war": (95, 52, 4.5, 0.35, 1.0, 0.6), "tabor": (300, 210, 22, 0.7, 0.3, 0.3)}[kind]
    n = int(dur * SR); t = np.arange(n) / SR
    phase = 2 * np.pi * np.cumsum(f1 + (f0 - f1) * np.exp(-t * 20)) / SR
    body = np.sin(phase) * np.exp(-t * dec)
    hit = sosfilt(butter(2, 3000 if kind == "tabor" else 900, fs=SR, output="sos"), np.random.randn(n)) * np.exp(-t * (40 if kind == "tabor" else 25)) * noise
    if kind == "tabor":   # snare buzz
        hit += np.random.randn(n) * np.exp(-t * 14) * 0.12
    return (body + hit) * vel * amp


def choir(freqs, dur, vel=1.0):
    """Wordless 'ah' choir pad: detuned voices through vowel formants, slow attack."""
    n = int(dur * SR); t = np.arange(n) / SR
    out = np.zeros(n)
    for f in freqs:
        for det in (0.996, 1.0, 1.004):
            ph = 2 * np.pi * f * det * t + 0.004 * np.sin(2 * np.pi * 4.8 * t) * f
            out += sum(np.sin(k * ph) / k for k in range(1, 9))
    form = sosfilt(butter(2, [550, 1300], btype="band", fs=SR, output="sos"), out) + 0.35 * sosfilt(butter(2, 400, fs=SR, output="sos"), out)
    env = np.minimum(t / 1.4, 1) * np.minimum((dur - t) / 1.6, 1).clip(0)
    return form * env * vel * 0.02 / max(1, len(freqs) ** 0.5)


def bell(f, dur=6.0, vel=1.0):
    """Church bell: inharmonic partials with a long ring."""
    n = int(dur * SR); t = np.arange(n) / SR
    out = np.zeros(n)
    for ratio, amp, dec in ((0.5, 0.6, 0.6), (1, 1, 0.9), (1.19, 0.5, 1.2), (1.56, 0.4, 1.5), (2, 0.35, 1.8), (2.51, 0.25, 2.4), (3.01, 0.15, 3)):
        out += np.sin(2 * np.pi * f * ratio * t) * amp * np.exp(-t * dec)
    out *= np.minimum(t / 0.004, 1)
    return out * vel * 0.12


def horn(f, dur, vel=1.0):
    """Natural horn call: brassy tone that brightens as it swells."""
    n = int(dur * SR); t = np.arange(n) / SR
    env = np.minimum(t / 0.08, 1) * np.minimum((dur - t) / 0.25, 1).clip(0)
    bright = 0.4 + 0.6 * np.minimum(t / 0.3, 1)
    out = sum(np.sin(2 * np.pi * f * k * t) * (bright ** (k - 1)) / k for k in range(1, 9))
    return out * env * vel * 0.12


def compose_medieval(mood, dur, rng):
    buf = np.zeros((2, int(dur * SR)))
    S = lambda i: scale_freq(i, base=146.83, steps=DORIAN)     # 0 = D3, 7 = D4
    D2, A2 = 73.42, 110.0
    if mood in ("tense", "mystery", "raid", "solemn", "quiet", "sad", "reflect"):
        level = {"quiet": 0.7, "sad": 0.8, "raid": 1.0, "reflect": 0.7}.get(mood, 0.9)
        place(buf, gurdy(D2, dur, level), 0, -0.25)
        place(buf, gurdy(A2, dur, level * 0.55), 0, 0.25)

    if mood == "tense":
        t, pos = 0.8, 4
        while t < dur - 1:
            place(buf, drum(0.8), t); place(buf, drum(0.5), t + 0.34)       # heartbeat on the war drum
            t += 2.4
        t = 1.6
        while t < dur - 2:
            pos = walk(rng, pos, 0, 9)
            place(buf, lute(S(pos), 2.2, 0.7), t, rng.uniform(-0.5, 0.5))
            t += rng.choice([1.2, 1.6, 2.4])

    elif mood == "light":                     # galliard-like dance in 6/8
        beat = 60 / 108
        pos, t, k = 9, 0.0, 0
        while t < dur - 1:
            if rng.random() > 0.1:
                pos = walk(rng, pos, 6, 14)
                place(buf, lute(S(pos), 1.4, 0.75 if k % 3 == 0 else 0.55), t, rng.uniform(-0.3, 0.3))
            if k % 6 == 0:
                place(buf, lute(S([0, 3, 4, 0][(k // 6) % 4]), 2.2, 0.6), t, -0.3)   # bass: D G A D
                place(buf, drum(0.5, "tabor"), t, 0.25)
            if k % 6 == 3:
                place(buf, drum(0.3, "tabor"), t, 0.25)
            t += beat / 2; k += 1
        t = 4 * beat
        while t < dur - 4:
            if rng.random() < 0.55:
                L = rng.choice([1.5, 2, 3]) * beat
                place(buf, recorder(S(rng.integers(11, 16)), L, 0.6), t, 0.15)
            t += 3 * beat

    elif mood == "court":                     # stately pavane: lute chords and a recorder line
        beat = 60 / 72
        chords = [(0, 2, 4), (6, 8, 10), (3, 5, 7), (4, 6, 8)]   # Dm  C  G  Am in D Dorian
        t, k, pos = 0.0, 0, 11
        while t < dur - 2:
            c = chords[(k // 4) % 4]
            place(buf, lute(S(c[k % 3] + (7 if k % 4 == 3 else 0)), 2.0, 0.55), t, -0.25)
            if k % 4 == 0:
                place(buf, lute(S(c[0] - 7 if c[0] >= 7 else c[0]), 3, 0.5), t, -0.35)
                place(buf, drum(0.35, "tabor"), t, 0.3)
                pos = walk(rng, pos, 9, 14)
                place(buf, recorder(S(pos), beat * 3.6, 0.55), t + beat * 0.2, 0.2)
            t += beat; k += 1

    elif mood == "mystery":
        beat = 60 / 80
        t, k = 0.0, 0
        ost = [0, 2, 1, 2, 0, 3, 1, 2]           # D F E F D G E F
        while t < dur - 1:
            place(buf, lute(S(ost[k % 8]), 0.7, 0.5), t, -0.2)
            if k % 12 == 6 and rng.random() < 0.6:
                place(buf, bell(S(rng.integers(14, 18)), 5, 0.35), t, 0.5)
            t += beat / 2; k += 1

    elif mood == "raid":                      # battle: war drums, tabor rolls, horn calls
        beat = 60 / 120
        t, k = 0.0, 0
        while t < dur - 1:
            if k % 8 in (0, 3, 6):
                place(buf, drum(1.0 if k % 8 == 0 else 0.7), t, -0.1)
            if k % 2 == 1:
                place(buf, drum(0.45, "tabor"), t, 0.3)
            place(buf, lute(S([0, 0, 2, 0, 1, 0, 3, 2][k % 8]), 0.45, 0.45), t, -0.3)
            if k % 32 == 8 and rng.random() < 0.9:     # horn call: D A D (natural horn notes)
                for j, (deg, L) in enumerate(((7, 1.0), (11, 0.6), (14, 2.0))):
                    place(buf, horn(S(deg), beat * L * 1.6, 0.7), t + beat * [0, 1.6, 2.6][j], 0.15)
            t += beat / 2; k += 1

    elif mood == "solemn":
        beat = 60 / 60
        chords = [(0, 2, 4), (5, 7, 9), (3, 5, 7), (4, 6, 8)]   # Dm  Bdim->G-ish  Gm  Am colours
        t, k, pos = 0.5, 0, 9
        while t < dur - 3:
            c = chords[k % 4]
            place(buf, choir([S(c[0]), S(c[1]), S(c[2])], min(4.4 * beat, dur - t), 0.9), t, 0)
            if k % 2 == 0:
                place(buf, bell(S(0) / 2, 6, 0.6), t, -0.4)
            pos = walk(rng, pos, 7, 12)
            place(buf, recorder(S(pos), 3.4 * beat, 0.45), t + 0.3, 0.2)
            t += 4 * beat; k += 1

    elif mood == "quiet":
        t = 1.0
        place(buf, choir([S(0), S(4)], dur, 0.5), 0, 0)
        while t < dur - 3:
            place(buf, lute(S(rng.integers(7, 12)), 3, 0.35), t, rng.uniform(-0.5, 0.5))
            t += rng.choice([3.0, 4.0, 5.0])

    elif mood == "sad":
        t, pos = 1.0, 10
        place(buf, choir([S(0), S(2), S(4)], dur, 0.55), 0, 0)
        while t < dur - 2:
            pos = walk(rng, pos, 7, 13)
            L = rng.choice([2.5, 3.5, 4.5])
            place(buf, recorder(S(pos), min(L, dur - t), 0.75), t, 0.1)
            t += L + rng.choice([0.3, 0.8])

    elif mood == "reflect":
        beat = 60 / 72
        arp = [0, 2, 4, 7, 4, 2]
        t, k, pos = 0.0, 0, 10
        chords = [(0, 2, 4), (6, 8, 10), (3, 5, 7), (0, 2, 4)]
        while t < dur - 6:
            c = chords[(k // 12) % 4]
            place(buf, lute(S(c[0] + arp[k % 6]), 2.2, 0.45), t, -0.2)
            if k % 12 == 0:
                place(buf, choir([S(c[0]), S(c[1]), S(c[2])], min(12 * beat / 2 + 1, dur - t), 0.55), t, 0.1)
                pos = walk(rng, pos, 9, 14)
                place(buf, recorder(S(pos), beat * 3.5, 0.5), t + beat, 0.2)
            t += beat / 2; k += 1
        place(buf, lute(S(0), 6, 0.7), dur - 6, -0.2)                          # final D
        place(buf, lute(S(4), 6, 0.55), dur - 5.95, 0.2)
        place(buf, choir([S(0), S(4), S(7)], 5.5, 0.6), dur - 6, 0)
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
    music_only = "--music-only" in sys.argv
    timed = ep_dir / "episode.timed.json"
    if not timed.exists() and not music_only:
        sys.exit("episode.timed.json not found: run make-video.py first (or use --music-only)")
    ep = json.loads((timed if timed.exists() else ep_dir / "episode.json").read_text())
    palette = ep.get("music_palette") or "japanese"
    compose_fn = compose_medieval if palette == "medieval" else compose
    print(f"palette: {palette}", flush=True)
    total = ep["total_duration"]
    sections = []
    for s in ep["shots"]:
        if not sections or sections[-1][0] != s["section"]:
            sections.append([s["section"], s["start"]])
    bounds = [(name, start, (sections[i + 1][1] if i + 1 < len(sections) else total)) for i, (name, start) in enumerate(sections)]

    XF = 2.0  # crossfade seconds between moods
    mix = np.zeros((2, int((total + 1) * SR)))
    for i, (name, a, b) in enumerate(bounds):
        mood = (ep.get("music_moods") or {}).get(name) or MOODS.get(name, "light")
        rng = np.random.default_rng(1703 + i)
        np.random.seed(1703 + i)
        dur = (b - a) + (XF if i + 1 < len(bounds) else 0)
        seg = reverb(compose_fn(mood, dur, rng), seconds=2.8 if palette == "medieval" else 2.2, rng=rng)
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
    if music_only:
        mp3 = build / "music-preview.mp3"
        ff(["-i", str(wav), "-af", f"loudnorm=I=-16:TP=-1.5,afade=t=out:st={total - 2:.2f}:d=2", "-b:a", "192k", str(mp3)])
        print(f"done: {mp3}")
        return

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
