"""Pack the approved image_gen sprites into small, transparent Phaser atlases.

Original generated PNGs stay in output/imagegen/full-v1. This only prepares
runtime textures: alpha-aware bounds, nearest-neighbour scaling and packing.
Run: python tools/pack_item_art.py
"""
import hashlib
import json
import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "output" / "imagegen" / "full-v1"
PACK = ROOT / "public" / "assets" / "pack"
READY = SOURCE / "ready"


def runtime_sprite(source, cell):
    with Image.open(source) as original:
        image = original.convert("RGBA")
    alpha = image.getchannel("A")
    if alpha.getextrema() != (0, 255):
        raise ValueError(f"{source.name}: expected a visible sprite and transparent background")
    # Very faint stray alpha must not force the actual item into a tiny corner.
    bounds = alpha.point(lambda value: 255 if value >= 32 else 0).getbbox()
    if bounds is None:
        raise ValueError(f"{source.name}: no visible sprite")
    image = image.crop(bounds)
    margin = cell // 16
    ratio = (cell - margin * 2) / max(image.size)
    size = tuple(max(1, round(edge * ratio)) for edge in image.size)
    image = image.resize(size, Image.Resampling.NEAREST)
    result = Image.new("RGBA", (cell, cell))
    result.paste(image, ((cell - size[0]) // 2, (cell - size[1]) // 2))
    return result


def pack_atlas(name, assets, cell, columns):
    stride = cell + 4
    width = columns * stride
    height = math.ceil(len(assets) / columns) * stride
    atlas = Image.new("RGBA", (width, height))
    frames = {}
    records = []
    for index, asset in enumerate(assets):
        source = SOURCE / asset["file"]
        sprite = runtime_sprite(source, cell)
        x, y = (index % columns) * stride + 2, (index // columns) * stride + 2
        atlas.paste(sprite, (x, y))
        frame = asset.get("dungeon", asset["id"])
        frames[frame] = {
            "frame": {"x": x, "y": y, "w": cell, "h": cell},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": cell, "h": cell},
            "sourceSize": {"w": cell, "h": cell},
        }
        destination = READY / asset["file"]
        destination.parent.mkdir(parents=True, exist_ok=True)
        sprite.save(destination, optimize=True)
        records.append({"id": asset["id"], "frame": frame,
                        "sha256": hashlib.sha256(source.read_bytes()).hexdigest()})
    metadata = {"image": f"{name}.png", "size": {"w": width, "h": height},
                "scale": "1", "generator": "image_gen", "cellSize": cell}
    PACK.mkdir(parents=True, exist_ok=True)
    atlas.save(PACK / f"{name}.png", optimize=True)
    (PACK / f"{name}.json").write_text(
        json.dumps({"frames": frames, "meta": metadata}, separators=(",", ":")),
        encoding="utf-8")
    print(f"{name}: {len(frames)} sprites, {width}x{height}, "
          f"{(PACK / f'{name}.png').stat().st_size:,} bytes")
    return records


def main():
    manifest = json.loads((SOURCE / "manifest.json").read_text(encoding="utf-8"))
    assets = manifest["assets"]
    missing = [asset["file"] for asset in assets if not (SOURCE / asset["file"]).is_file()]
    if missing:
        raise SystemExit(f"Art is not complete: {len(missing)} missing PNGs; " + ", ".join(missing[:8]))
    items = [asset for asset in assets if asset["kind"] == "item"]
    entrances = [asset for asset in assets if asset["kind"] == "entrance"]
    if len(items) != manifest["itemCount"] or len(entrances) != manifest["entranceCount"]:
        raise SystemExit("Manifest counts do not match its asset list")
    # Validate everything before replacing any runtime atlas.
    for asset in assets:
        runtime_sprite(SOURCE / asset["file"], 64 if asset["kind"] == "item" else 128)
    records = pack_atlas("itemArt", items, 64, 16)
    records += pack_atlas("entrances", entrances, 128, 4)
    report = {"items": len(items), "entrances": len(entrances), "generator": "image_gen",
              "sourceManifest": "manifest.json", "assets": records}
    (SOURCE / "packed-art-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
