"""Tiny software synthesizer used by gen_sfx.py and gen_music.py (numpy only, no samples, no network).

Everything is mono float32 in [-1, 1]. Frequencies may be a number or an array (one value per sample) for sweeps.
"""
import wave

import numpy as np
from scipy import signal

SR = 32000


def samples(dur):
    return int(round(SR * dur))


def _freq_array(freq, n):
    return np.full(n, float(freq)) if np.isscalar(freq) else np.asarray(freq, dtype=float)


def sweep(f0, f1, dur, curve=2.0):
    """Frequencies that glide from f0 to f1 (curve > 1 moves fast at first, like a drop in pitch)."""
    n = samples(dur)
    k = (np.arange(n) / max(1, n - 1)) ** curve
    return f0 + (f1 - f0) * k


def osc(kind, freq, dur, duty=0.5):
    n = samples(dur)
    phase = np.cumsum(_freq_array(freq, n)) / SR
    frac = phase % 1.0
    if kind == "sine":
        return np.sin(2 * np.pi * phase)
    if kind == "square":
        return np.where(frac < duty, 1.0, -1.0)
    if kind == "tri":
        return 4 * np.abs(frac - 0.5) - 1
    if kind == "saw":
        return 2 * frac - 1
    raise ValueError(kind)


def noise(dur, seed=1):
    return np.random.default_rng(seed).uniform(-1, 1, samples(dur))


def lowpass(x, cutoff, order=2):
    b, a = signal.butter(order, cutoff / (SR / 2), "low")
    return signal.lfilter(b, a, x)


def highpass(x, cutoff, order=2):
    b, a = signal.butter(order, cutoff / (SR / 2), "high")
    return signal.lfilter(b, a, x)


def decay(n, rate=6.0, attack=0.004):
    """Fast attack, exponential fall: the shape of most plucks, knocks and hits."""
    t = np.arange(n) / SR
    env = np.exp(-rate * t / max(1e-3, n / SR))
    a = max(1, int(attack * SR))
    env[:a] *= np.linspace(0, 1, a)
    return env


def swell(n, attack=0.3, release=0.3):
    """Slow fade in and out for pads."""
    a = max(1, int(attack * n))
    r = max(1, int(release * n))
    env = np.ones(n)
    env[:a] = np.linspace(0, 1, a)
    env[-r:] = np.linspace(1, 0, r)
    return env


def shaped(x, rate=6.0, attack=0.004):
    return x * decay(len(x), rate, attack)


def place(sig, clips):
    """Mix clips into one buffer: clips is a list of (start_seconds, samples)."""
    end = max(int(round(s * SR)) + len(c) for s, c in clips)
    out = np.zeros(max(end, len(sig)))
    out[: len(sig)] += sig
    for start, clip in clips:
        i = int(round(start * SR))
        out[i : i + len(clip)] += clip
    return out


def mix(clips):
    return place(np.zeros(0), clips)


def delay(x, seconds, feedback=0.35, taps=4):
    """A simple echo: copies of the sound, each quieter, appended after it."""
    out = np.concatenate([x, np.zeros(int(SR * seconds * taps))])
    gain = 1.0
    for i in range(1, taps + 1):
        gain *= feedback
        shift = int(SR * seconds * i)
        out[shift : shift + len(x)] += x * gain
    return out


def limit(x, peak=0.85):
    """Gentle saturation, then scale so the loudest sample is exactly `peak`."""
    y = np.tanh(1.4 * x)
    return y * (peak / max(1e-9, np.max(np.abs(y))))


def save_wav(path, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
