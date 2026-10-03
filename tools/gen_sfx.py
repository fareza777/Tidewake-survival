"""The game's sound effects, synthesized from scratch. Each function returns one mono clip; CUES maps names to clips."""
import numpy as np

from audio_kit import SR, decay, highpass, lowpass, mix, noise, osc, shaped, sweep, swell


def note(kind, freq, dur, rate=6.0, duty=0.5, vol=1.0):
    return vol * shaped(osc(kind, freq, dur, duty), rate)


def swing():
    n = highpass(noise(0.16, 3), 900)
    t = np.arange(len(n)) / SR
    return 0.7 * n * np.sin(np.pi * np.minimum(1, t / 0.16)) ** 1.5


def hit():
    thump = note("sine", sweep(190, 55, 0.14), 0.14, 5.0)
    click = shaped(lowpass(noise(0.05, 5), 3200), 7.0, 0.001)
    return mix([(0, 0.9 * thump), (0, 0.6 * click)])


def kill():
    notes = [(i * 0.07, note("square", f, 0.12, 5.0, 0.25, 0.5)) for i, f in enumerate([660, 523, 392, 262])]
    puff = shaped(lowpass(noise(0.25, 9), 1800), 5.0)
    return mix(notes + [(0.02, 0.5 * puff)])


def hurt():
    return note("saw", sweep(340, 90, 0.26, 1.6) * (1 + 0.04 * np.sin(np.arange(int(SR * 0.26)) / 90)), 0.26, 3.5, vol=0.7)


def shoot():
    whoosh = shaped(highpass(lowpass(noise(0.2, 11), 5000), 700), 3.0, 0.02)
    twang = note("sine", sweep(1100, 420, 0.14), 0.14, 6.0, vol=0.6)
    return mix([(0, 0.6 * whoosh), (0, twang)])


def pickup():
    return mix([(0, note("square", 988, 0.07, 6.0, 0.25, 0.5)), (0.06, note("square", 1319, 0.12, 6.0, 0.25, 0.5))])


def chop():
    thunk = note("sine", sweep(210, 80, 0.12), 0.12, 6.0)
    crack = shaped(lowpass(noise(0.04, 13), 4000), 8.0, 0.001)
    return mix([(0, thunk), (0, 0.5 * crack)])


def mine():
    ring = note("sine", 2100, 0.2, 7.0, vol=0.45) + note("sine", 3170, 0.2, 9.0, vol=0.25)
    thunk = note("sine", sweep(160, 70, 0.1), 0.1, 6.0)
    return mix([(0, ring), (0, 0.8 * thunk)])


def eat():
    bites = [(i * 0.09, shaped(lowpass(noise(0.06, 20 + i), 2200), 9.0, 0.002) * 0.9) for i in range(3)]
    return mix(bites)


def drink():
    drops = [(i * 0.08, note("sine", sweep(480 + 80 * i, 900 + 80 * i, 0.06, 1.0), 0.06, 4.0, vol=0.6)) for i in range(3)]
    return mix(drops)


def craft():
    return mix([(0, note("tri", 523, 0.1, 6.0)), (0.09, note("tri", 784, 0.22, 4.5)), (0.09, note("sine", 1568, 0.2, 7.0, vol=0.25))])


def place():
    return mix([(0, note("sine", sweep(150, 85, 0.13), 0.13, 6.0)), (0, 0.4 * shaped(lowpass(noise(0.03, 7), 2500), 8.0, 0.001))])


def break_():
    crack = shaped(lowpass(noise(0.22, 17), 3500), 4.5, 0.001)
    fall = note("square", sweep(420, 110, 0.22), 0.22, 5.0, 0.5, 0.35)
    return mix([(0, 0.8 * crack), (0, fall)])


def sleep():
    chord = sum(osc("sine", f, 0.9) for f in (262, 330, 392)) / 3
    return 0.8 * chord * swell(len(chord), 0.35, 0.5)


def ui_click():
    return note("square", 1250, 0.035, 8.0, 0.5, 0.45)


def death():
    steps = [(i * 0.2, note("tri", f, 0.34, 3.5)) for i, f in enumerate([440, 415, 349, 262])]
    return mix(steps)


CUES = {
    "swing": swing, "hit": hit, "kill": kill, "hurt": hurt, "shoot": shoot, "pickup": pickup, "chop": chop, "mine": mine,
    "eat": eat, "drink": drink, "craft": craft, "place": place, "break": break_, "sleep": sleep, "ui_click": ui_click,
    "death": death,
}

# Loudness of each cue relative to the loudest (1.0); every clip is first scaled to the same peak.
LEVEL = {
    "ui_click": 0.45, "eat": 0.6, "drink": 0.55, "pickup": 0.7, "swing": 0.65, "sleep": 0.55, "place": 0.8, "chop": 0.85, "craft": 0.8,
    "kill": 0.85, "shoot": 0.75,
}
