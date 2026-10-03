"""Three looping music tracks (day, night, battle), composed by code: chords, a seeded melody and a small drum kit."""
import random

import numpy as np

from audio_kit import SR, delay, highpass, limit, mix, noise, osc, samples, shaped, sweep, swell


def freq(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def lead(m, secs, wave="square", duty=0.25, vol=0.5):
    vib = 1 + 0.006 * np.sin(2 * np.pi * 5.5 * np.arange(samples(secs)) / SR)
    return vol * shaped(osc(wave, freq(m) * vib, secs, duty), 3.0, 0.006)


def bass(m, secs, wave="tri", vol=0.7):
    return vol * shaped(osc(wave, freq(m), secs), 2.2, 0.006)


def pad(chord, secs, vol=0.14):
    x = sum(osc("sine", freq(m), secs) + 0.4 * osc("tri", freq(m) * 2, secs) for m in chord) / len(chord)
    return vol * x * swell(len(x), 0.3, 0.45)


def kick():
    return 0.9 * shaped(osc("sine", sweep(130, 42, 0.2, 3.0), 0.2), 6.0, 0.001)


def snare():
    return mix([(0, 0.5 * shaped(highpass(noise(0.16, 31), 1200), 6.0, 0.001)), (0, 0.3 * shaped(osc("tri", 190, 0.12), 8.0, 0.001))])


def hat(vol=0.18):
    return vol * shaped(highpass(noise(0.05, 37), 6000), 8.0, 0.001)


def melody(rng, scale, chord_tones, bars, per_bar=8, rest=0.35):
    """A seeded random walk over `scale`: returns (eighth_index, length_in_eighths, midi) tuples."""
    out = []
    pos = min(range(len(scale)), key=lambda i: abs(scale[i] - chord_tones[0]))
    i = 0
    total = bars * per_bar
    while i < total:
        length = rng.choice([1, 1, 2, 2, 3])
        length = min(length, total - i)
        if rng.random() > rest or i % per_bar == 0:
            pos = max(0, min(len(scale) - 1, pos + rng.choice([-2, -1, -1, 0, 1, 1, 2])))
            out.append((i, length, scale[pos]))
        i += length
    return out


def render(clips, loop_secs, peak=0.8):
    """Mix the clips and fold anything that rings past the end back onto the start, so the loop has no seam."""
    buf = mix(clips)
    n = samples(loop_secs)
    body = np.zeros(n)
    body += buf[:n] if len(buf) >= n else np.pad(buf, (0, n - len(buf)))
    tail = buf[n:]
    body[: len(tail)] += tail[:n]
    return limit(body, peak)


def day():
    rng = random.Random(7)
    bpm, bars = 92, 16
    spb = 60 / bpm
    chords = [(48, (60, 64, 67)), (45, (57, 60, 64)), (41, (53, 57, 60)), (43, (55, 59, 62))]
    scale = [60, 62, 64, 67, 69, 72, 74, 76, 79]
    clips = []
    for bar in range(bars):
        root, tones = chords[bar % 4]
        t0 = bar * 4 * spb
        clips.append((t0, pad(tones, 4 * spb)))
        for beat, step in ((0, 0), (2, 0), (3, 7)):
            clips.append((t0 + beat * spb, bass(root + step, 1.6 * spb)))
        for e in range(8):
            if e % 2 == 1:
                clips.append((t0 + e * spb / 2, hat(0.1)))
    phrase_a = melody(rng, scale, (64,), 4)
    phrase_b = melody(rng, scale, (67,), 4)
    for cycle in range(4):
        phrase = phrase_a if cycle % 2 == 0 else phrase_b
        for eighth, length, m in phrase:
            start = (cycle * 16 + eighth) * spb / 2
            clips.append((start, lead(m, length * spb / 2 * 0.92)))
    return render(clips, bars * 4 * spb)


def night():
    rng = random.Random(11)
    bpm, bars = 62, 12
    spb = 60 / bpm
    chords = [(45, (57, 60, 64)), (41, (53, 57, 60)), (36, (55, 60, 64)), (43, (55, 59, 62))]
    scale = [69, 72, 74, 76, 79, 81, 84]
    clips = []
    for bar in range(bars):
        root, tones = chords[bar % 4]
        t0 = bar * 4 * spb
        clips.append((t0, pad(tones, 4 * spb, 0.2)))
        clips.append((t0, bass(root - 12, 3.8 * spb, "sine", 0.55)))
    bells = []
    for beat in range(bars * 4):
        if rng.random() < 0.55:
            m = rng.choice(scale)
            bell = 0.3 * shaped(osc("sine", freq(m), 1.4), 3.0, 0.004) + 0.12 * shaped(osc("sine", freq(m) * 2.01, 1.4), 5.0, 0.004)
            bells.append((beat * spb, delay(bell, spb * 1.5, 0.45, 3)))
    clips += bells
    return render(clips, bars * 4 * spb, 0.7)


def battle():
    rng = random.Random(23)
    bpm, bars = 150, 16
    spb = 60 / bpm
    chords = [(40, (64, 67, 71)), (36, (60, 64, 67)), (38, (62, 66, 69)), (35, (59, 62, 66))]
    scale = [64, 67, 69, 71, 74, 76, 79]
    clips = []
    for bar in range(bars):
        root, _ = chords[bar % 4]
        t0 = bar * 4 * spb
        for e in range(8):
            step = 7 if e in (3, 7) else 0
            clips.append((t0 + e * spb / 2, bass(root + step, 0.45 * spb, "square", 0.32)))
        for beat in range(4):
            clips.append((t0 + beat * spb, kick()))
            if beat % 2 == 1:
                clips.append((t0 + beat * spb, snare()))
            clips.append((t0 + (beat + 0.5) * spb, hat(0.16)))
    motif = melody(rng, scale, (71,), 2, 8, 0.2)
    for rep in range(bars // 2):
        for eighth, length, m in motif:
            clips.append(((rep * 8 + eighth) * spb / 2, lead(m + (12 if rep % 4 == 3 else 0), length * spb / 2 * 0.85, "saw", 0.5, 0.32)))
    return render(clips, bars * 4 * spb, 0.8)


TRACKS = {"music_day": day, "music_night": night, "music_battle": battle}
