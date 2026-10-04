"""Pack the ground tiles Tidewake draws into one small sheet and write src/data/tileIndex.ts.

Raw tiles come from the read-only Unity pack (Super Retro Collection). The pack has no seamless sand/desert/dirt/swamp
ground, so those are recoloured copies of its speckled grass tiles. Nothing in the asset master is modified.
Run: python tools/pack_tiles.py
"""
import random
from collections import Counter
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ENV = Path("E:/Pixel Games Asset Master/Assets/Gif/Super_Retro_Collection/Resources/Environments")
TILE = 16
COLS = 8

# name -> (base colour, speckle colour)
PALETTES = {
    "sand": ((240, 214, 160), (222, 192, 134)),
    "desert": ((232, 176, 104), (208, 150, 82)),
    "dirt": ((150, 110, 78), (128, 92, 62)),
    "swamp": ((70, 104, 52), (52, 82, 40)),
}


def crop(sheet: Image.Image, col: int, row: int) -> Image.Image:
    return sheet.crop((col * TILE, row * TILE, (col + 1) * TILE, (row + 1) * TILE))


def recolor(tile: Image.Image, base_to, speck_to) -> Image.Image:
    """Swap the most common colour for base_to and every other opaque colour for speck_to."""
    px = tile.load()
    counts = Counter(px[x, y] for y in range(TILE) for x in range(TILE) if px[x, y][3] > 0)
    base = counts.most_common(1)[0][0]
    out = tile.copy()
    o = out.load()
    for y in range(TILE):
        for x in range(TILE):
            if px[x, y][3] == 0:
                continue
            o[x, y] = (*(base_to if px[x, y] == base else speck_to), 255)
    return out


def tint(tile: Image.Image, mul) -> Image.Image:
    out = tile.copy()
    o = out.load()
    for y in range(TILE):
        for x in range(TILE):
            r, g, b, a = o[x, y]
            o[x, y] = (int(r * mul[0]), int(g * mul[1]), int(b * mul[2]), a)
    return out


# Dungeon looks: (floor, mortar, brick, brick shadow, wall top, accent). The pack has no dungeon floor or wall at this
# size, so the flagstones and brick are drawn here, a few pixels at a time.
THEMES = {
    "moss": ((78, 96, 74), (54, 70, 56), (104, 118, 98), (72, 88, 72), (30, 38, 34), (92, 150, 70)),
    "mine": ((108, 94, 86), (76, 64, 58), (134, 108, 90), (96, 74, 62), (40, 33, 31), (150, 120, 84)),
    "ruin": ((216, 190, 140), (178, 152, 106), (226, 200, 152), (186, 158, 110), (88, 68, 48), (198, 150, 80)),
}


def shade(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c) + (255,)


def floor_tile(theme, variant):
    """Flagstones: 2 x 2 stones divided by mortar lines, a little different in each variant."""
    floor, mortar, _brick, _shadow, _top, accent = THEMES[theme]
    rng = random.Random(f"{theme}:{variant}")
    img = Image.new("RGBA", (TILE, TILE), shade(floor, 1.0))
    px = img.load()
    cut = 7 + (variant % 2)
    for i in range(TILE):
        for j in (0, cut):
            px[i, j] = shade(mortar, 1.0)
            px[j, i] = shade(mortar, 1.0)
    for _ in range(8 + variant * 2):
        x, y = rng.randrange(TILE), rng.randrange(TILE)
        px[x, y] = shade(floor, rng.choice([0.88, 1.1]))
    if variant == 3:
        for _ in range(3):
            px[rng.randrange(TILE), rng.randrange(TILE)] = shade(accent, 0.9)
    return img


def wall_face(theme):
    """The lit front of a wall: brick courses with a bright top edge and a shadowed foot."""
    _floor, mortar, brick, shadow, _top, accent = THEMES[theme]
    img = Image.new("RGBA", (TILE, TILE), shade(brick, 1.0))
    px = img.load()
    for row in range(4):
        y = row * 4 + 3
        for x in range(TILE):
            px[x, y] = shade(mortar, 1.0)
        offset = 0 if row % 2 == 0 else 4
        for x in range(offset, TILE, 8):
            for yy in range(row * 4, row * 4 + 3):
                px[x, yy] = shade(mortar, 1.0)
    for x in range(TILE):
        px[x, 0] = shade(brick, 1.25)
        px[x, TILE - 1] = shade(shadow, 0.8)
    rng = random.Random(f"face:{theme}")
    for _ in range(5):
        px[rng.randrange(TILE), rng.randrange(1, TILE - 1)] = shade(accent, 0.8) if theme == "moss" else shade(shadow, 1.0)
    return img


def wall_top(theme):
    """The top of a wall seen from above: dark, with a faint grain."""
    top = THEMES[theme][4]
    rng = random.Random(f"top:{theme}")
    img = Image.new("RGBA", (TILE, TILE), shade(top, 1.0))
    px = img.load()
    for _ in range(14):
        px[rng.randrange(TILE), rng.randrange(TILE)] = shade(top, rng.choice([0.8, 1.25]))
    return img


def dungeon_tiles():
    tiles = []
    for theme in THEMES:
        for variant in range(4):
            tiles.append((f"floor.{theme}.{variant}", floor_tile(theme, variant)))
        tiles.append((f"wallface.{theme}", wall_face(theme)))
        tiles.append((f"walltop.{theme}", wall_top(theme)))
    return tiles


def build_tiles(main: Image.Image, legacy: Image.Image):
    flat_grass = crop(main, 18, 30)
    speck_sources = [crop(legacy, 8, 115), crop(legacy, 7, 114), crop(legacy, 8, 114)]
    tiles = [
        ("grass.0", flat_grass),
        ("grass.1", crop(legacy, 7, 114)),
        ("grass.2", crop(legacy, 8, 114)),
        ("grass.3", crop(legacy, 7, 115)),
        ("grass.4", crop(legacy, 8, 115)),
        ("water.shallow", crop(main, 11, 37)),
        ("water.deep", tint(crop(main, 11, 37), (0.62, 0.72, 0.9))),
        ("stone.0", crop(main, 2, 36)),
    ]
    for name, (base, speck) in PALETTES.items():
        tiles.append((f"{name}.0", recolor(flat_grass, base, speck)))
        for i, src in enumerate(speck_sources, start=1):
            tiles.append((f"{name}.{i}", recolor(src, base, speck)))
    # Tilled farm soil: darker brown, darker still when watered.
    tiles.append(("soil.dry", recolor(speck_sources[0], (112, 78, 54), (92, 62, 42))))
    tiles.append(("soil.wet", recolor(speck_sources[0], (78, 54, 40), (62, 42, 32))))
    return tiles + dungeon_tiles()


def main() -> None:
    main_sheet = Image.open(ENV / "original_atlas.png").convert("RGBA")
    legacy_sheet = Image.open(ENV / "legacy_atlas.png").convert("RGBA")
    tiles = build_tiles(main_sheet, legacy_sheet)
    rows = (len(tiles) + COLS - 1) // COLS
    out = Image.new("RGBA", (COLS * TILE, rows * TILE), (0, 0, 0, 0))
    lines = []
    for n, (name, img) in enumerate(tiles):
        out.paste(img, ((n % COLS) * TILE, (n // COLS) * TILE))
        lines.append(f"  '{name}': {n},")
    pack = ROOT / "public" / "assets" / "pack"
    pack.mkdir(parents=True, exist_ok=True)
    out.save(pack / "tiles.png", optimize=True)
    ts = [
        "// Generated by tools/pack_tiles.py - do not edit. Frame index of each ground tile in public/assets/pack/tiles.png.",
        "export const TILE_FRAMES = {",
        *lines,
        "} as const;",
        "export type TileName = keyof typeof TILE_FRAMES;",
        "",
    ]
    (ROOT / "src" / "data" / "tileIndex.ts").write_text("\n".join(ts), encoding="utf-8")
    print(f"packed {len(tiles)} tiles into {out.width}x{out.height}")


if __name__ == "__main__":
    main()
