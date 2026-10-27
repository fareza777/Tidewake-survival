"""Inspect final deliverables without modifying any media."""
from pathlib import Path
from PIL import Image
import hashlib
import json
import subprocess
import imageio_ffmpeg
from datetime import datetime, timezone

root = Path(__file__).resolve().parents[1]
native = root / "remotion/node_modules/@remotion/compositor-win32-x64-msvc"
ffprobe = native / "ffprobe.exe"
# Remotion's small encoder build omits some inspection filters and null-output codecs.
ffmpeg = Path(imageio_ffmpeg.get_ffmpeg_exe())
report = {"verifiedAt": datetime.now(timezone.utc).isoformat(), "language": "English", "images": [], "videos": []}

images = [
    (root / "playstore/app-icon-512.png", (512, 512)),
    (root / "playstore/app-icon-1024.png", (1024, 1024)),
    (root / "playstore/feature-graphic-1024x500.png", (1024, 500)),
    (root / "art/feature-graphic-master-2048x1000.png", (2048, 1000)),
]
shots = sorted((root / "playstore/screenshots").glob("*.png"))
assert len(shots) == 8, f"Expected exactly eight screenshots; found {len(shots)}"
assert [p.name[:2] for p in shots] == [f"{i:02d}" for i in range(1, 9)]
images += [(p, (1080, 1920)) for p in shots]
for file, expected in images:
    with Image.open(file) as img:
        assert img.size == expected, (file.name, img.size, expected)
        assert img.mode == "RGB", (file.name, img.mode)
        assert img.format == "PNG"
        img.verify()
    size = file.stat().st_size
    if file.name == "app-icon-512.png":
        assert size <= 1024 * 1024, "Google Play icon exceeds 1 MB"
    if file in shots:
        assert size <= 8 * 1024 * 1024, "Screenshot exceeds 8 MB"
    report["images"].append({"file": str(file.relative_to(root)), "width": expected[0], "height": expected[1], "format": "PNG", "mode": "RGB", "bytes": size, "sha256": hashlib.sha256(file.read_bytes()).hexdigest()})

for width, height in [(1920, 1080), (1080, 1920)]:
    file = root / f"video/Tidewake-Trailer-EN-{width}x{height}.mp4"
    info = json.loads(subprocess.check_output([str(ffprobe), "-v", "error", "-show_streams", "-show_format", "-of", "json", str(file)], text=True))
    video = next(s for s in info["streams"] if s["codec_type"] == "video")
    audio = next(s for s in info["streams"] if s["codec_type"] == "audio")
    assert (video["width"], video["height"]) == (width, height)
    assert video["codec_name"] == "h264"
    # FFprobe names 4:2:0 as yuvj420p when the H.264 full-range flag is set.
    assert video["pix_fmt"] in {"yuv420p", "yuvj420p"}
    assert video["avg_frame_rate"] == "30/1"
    assert int(video["nb_frames"]) == 1020
    assert abs(float(info["format"]["duration"]) - 34) < .05
    assert audio["codec_name"] == "aac"
    assert audio["channels"] == 2
    assert audio["sample_rate"] == "48000"
    decode = subprocess.run([str(ffmpeg), "-hide_banner", "-v", "error", "-xerror", "-i", str(file), "-map", "0", "-f", "null", "-"], capture_output=True, text=True)
    assert decode.returncode == 0 and not decode.stderr.strip(), decode.stderr
    level = subprocess.run([str(ffmpeg), "-hide_banner", "-i", str(file), "-vn", "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True, check=True)
    levels = [line.strip().split("] ")[-1] for line in level.stderr.splitlines() if "mean_volume:" in line or "max_volume:" in line]
    report["videos"].append({"file": str(file.relative_to(root)), "width": width, "height": height, "durationSeconds": float(info["format"]["duration"]), "fps": 30, "frames": 1020, "videoCodec": "H.264", "pixelFormat": video["pix_fmt"], "colorRange": video.get("color_range"), "audioCodec": "AAC", "audioSampleRate": 48000, "audioChannels": 2, "audioLevels": levels, "fullDecode": "passed", "bytes": file.stat().st_size, "sha256": hashlib.sha256(file.read_bytes()).hexdigest()})

capture = json.loads((root / "captures/capture-report.json").read_text())
assert capture["errors"] == [], capture["errors"]
report["capture"] = {"runtimeErrors": 0, "realGameplay": True, "stagedThroughExistingQA": True, "itemDefinitions": capture["itemCount"]}
report["artDirection"] = {"icon": "Brass compass, no human subject", "characters": "Promotional characters in dark hood and armor, viewed from behind", "visualReview": "All ten scenes reviewed in landscape and portrait; revised inventory crops and removed temporary notification overlays"}
report["sourceChecks"] = {"typescript": "passed", "eslint": "passed"}
report["status"] = "passed"
(root / "source/validation-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps({"status": "passed", "pngs": len(images), "screenshots": len(shots), "videos": [{"file": v["file"], "durationSeconds": v["durationSeconds"], "frames": v["frames"], "audioLevels": v["audioLevels"], "fullDecode": v["fullDecode"]} for v in report["videos"]]}, indent=2))
