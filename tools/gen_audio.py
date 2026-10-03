"""Build the game's audio offline: public/assets/audio/sfx.ogg + sfx.json (a Phaser audio sprite) and the music loops.

Everything is synthesized by tools/gen_sfx.py and tools/gen_music.py (no samples, no network, no API keys).
Encoding uses the ffmpeg binary that ships inside the imageio-ffmpeg Python package (or `ffmpeg` on PATH).
Run:  python tools/gen_audio.py
"""
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

import numpy as np

from audio_kit import SR, save_wav
from gen_music import TRACKS
from gen_sfx import CUES, LEVEL

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "assets" / "audio"
GAP = 0.15


def ffmpeg():
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        found = shutil.which("ffmpeg")
        if not found:
            raise SystemExit("ffmpeg not found: pip install imageio-ffmpeg or put ffmpeg on PATH")
        return found


def encode(wav, ogg, quality):
    subprocess.run([ffmpeg(), "-y", "-loglevel", "error", "-i", str(wav), "-c:a", "libvorbis", "-q:a", str(quality), str(ogg)], check=True)


def build_sprite(tmp):
    """All sound effects back to back with a gap between them, plus the map of where each one starts and ends."""
    pieces, spritemap, cursor = [], {}, 0.0
    gap = np.zeros(int(SR * GAP))
    for name, make in CUES.items():
        clip = make()
        peak = float(np.max(np.abs(clip)))
        clip = clip * (0.85 * LEVEL.get(name, 1.0) / peak) if peak > 0 else clip
        spritemap[name] = {"start": round(cursor, 3), "end": round(cursor + len(clip) / SR, 3), "loop": False}
        pieces += [clip, gap]
        cursor += len(clip) / SR + GAP
    wav = tmp / "sfx.wav"
    save_wav(wav, np.concatenate(pieces))
    return wav, spritemap


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as d:
        tmp = Path(d)
        wav, spritemap = build_sprite(tmp)
        encode(wav, OUT / "sfx.ogg", 3)
        (OUT / "sfx.json").write_text(json.dumps({"resources": ["sfx.ogg"], "spritemap": spritemap}, indent=1), encoding="utf-8")
        print(f"sfx: {len(spritemap)} cues, {(OUT / 'sfx.ogg').stat().st_size // 1024} KB")
        for name, make in TRACKS.items():
            wav = tmp / f"{name}.wav"
            track = make()
            save_wav(wav, track)
            encode(wav, OUT / f"{name}.ogg", 3)
            print(f"{name}: {len(track) / SR:.1f} s, {(OUT / f'{name}.ogg').stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
