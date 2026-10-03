"""Draw the 16x16 item and structure icons the Unity pack does not have, and write them as an atlas.

The pack only ships farm and food icons, so materials, tools, seed packets and buildable structures are drawn here
with plain shapes plus an automatic dark outline, in the same 16x16 pixel style. Roasted and baked foods are tinted
copies of the pack's own food icons (read from the props atlas that pack_assets.py wrote).

Run after pack_assets.py:  python tools/make_icons.py
Output: public/assets/pack/icons.png and icons.json (a Phaser JSON-hash atlas).
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
PACK = ROOT / "public" / "assets" / "pack"
S = 16

OUT = (44, 32, 38, 255)  # outline
WOOD = (150, 98, 52, 255)
WOOD_L = (200, 146, 84, 255)
WOOD_D = (104, 64, 36, 255)
STONE = (146, 148, 160, 255)
STONE_L = (196, 198, 208, 255)
STONE_D = (96, 98, 112, 255)
FIBER = (190, 200, 110, 255)
FIBER_L = (230, 232, 150, 255)
FIBER_D = (120, 146, 70, 255)
ROPE = (206, 170, 118, 255)
ROPE_D = (150, 112, 74, 255)
IRON = (176, 190, 206, 255)
IRON_L = (226, 234, 242, 255)
IRON_D = (110, 122, 142, 255)
RUST = (214, 118, 56, 255)
CRYSTAL = (96, 196, 240, 255)
CRYSTAL_L = (180, 236, 255, 255)
CRYSTAL_D = (52, 120, 190, 255)
BROWN = (120, 78, 48, 255)
BROWN_D = (78, 48, 32, 255)
PAPER = (238, 226, 190, 255)
FLAME = (255, 168, 48, 255)
FLAME_L = (255, 232, 110, 255)
FLAME_D = (226, 84, 40, 255)
WHITE = (246, 244, 236, 255)
RED = (200, 70, 70, 255)
GOLD = (240, 196, 72, 255)
BLUE = (96, 140, 200, 255)
BLUE_D = (60, 92, 150, 255)
DARK = (30, 24, 30, 255)

TIER_HEAD = {1: (WOOD_L, WOOD_D), 2: (STONE_L, STONE_D), 3: (IRON_L, IRON_D)}


def canvas():
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def outlined(img):
    """Add a 1px dark outline around every non-transparent pixel."""
    src = img.load()
    out = img.copy()
    o = out.load()
    for y in range(S):
        for x in range(S):
            if src[x, y][3] > 0:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < S and 0 <= ny < S and src[nx, ny][3] > 0:
                    o[x, y] = OUT
                    break
    return out


def wood():
    img, d = canvas()
    d.rectangle([4, 8, 13, 12], fill=WOOD)
    d.rectangle([4, 8, 13, 9], fill=WOOD_L)
    d.rectangle([4, 12, 13, 12], fill=WOOD_D)
    d.ellipse([2, 7, 6, 13], fill=WOOD_L)
    d.ellipse([3, 9, 5, 11], outline=WOOD_D)
    d.rectangle([5, 3, 12, 6], fill=WOOD)
    d.rectangle([5, 3, 12, 3], fill=WOOD_L)
    d.rectangle([5, 6, 12, 6], fill=WOOD_D)
    d.ellipse([3, 2, 7, 7], fill=WOOD_L)
    d.point([5, 4], fill=WOOD_D)
    return outlined(img)


def stone():
    img, d = canvas()
    d.polygon([(3, 11), (4, 6), (8, 3), (12, 5), (13, 10), (10, 13), (5, 13)], fill=STONE)
    d.polygon([(4, 7), (8, 4), (10, 5), (6, 8)], fill=STONE_L)
    d.polygon([(8, 13), (13, 10), (12, 12), (10, 13)], fill=STONE_D)
    d.line([(6, 10), (8, 11)], fill=STONE_D)
    return outlined(img)


def fiber():
    img, d = canvas()
    for (x0, y0, x1, y1, c) in [(4, 13, 3, 3, FIBER_D), (6, 13, 6, 2, FIBER), (8, 13, 9, 2, FIBER_L), (10, 13, 12, 3, FIBER), (12, 13, 13, 5, FIBER_D)]:
        d.line([(x0, y0), (x1, y1)], fill=c, width=2)
    d.rectangle([3, 9, 13, 10], fill=ROPE)
    d.line([(3, 10), (13, 10)], fill=ROPE_D)
    return outlined(img)


def plank():
    img, d = canvas()
    d.rectangle([2, 3, 13, 7], fill=WOOD_L)
    d.line([(2, 7), (13, 7)], fill=WOOD)
    d.line([(4, 5), (9, 5)], fill=WOOD)
    d.point([3, 4], fill=WOOD_D)
    d.point([12, 6], fill=WOOD_D)
    d.rectangle([3, 8, 14, 12], fill=WOOD_L)
    d.line([(3, 12), (14, 12)], fill=WOOD)
    d.line([(6, 10), (12, 10)], fill=WOOD)
    d.point([4, 9], fill=WOOD_D)
    d.point([13, 11], fill=WOOD_D)
    return outlined(img)


def rope():
    img, d = canvas()
    d.ellipse([2, 3, 13, 13], fill=ROPE)
    d.ellipse([5, 6, 10, 10], fill=(0, 0, 0, 0))
    d.ellipse([2, 3, 13, 13], outline=ROPE_D)
    d.ellipse([4, 5, 11, 11], outline=ROPE_D)
    for p in [(4, 4), (11, 5), (12, 9), (8, 12), (3, 9)]:
        d.point(p, fill=ROPE_D)
    d.line([(10, 12), (14, 14)], fill=ROPE, width=1)
    return outlined(img)


def iron_ore():
    img = stone()
    d = ImageDraw.Draw(img)
    for p in [(6, 6), (9, 5), (8, 9), (11, 8), (5, 10), (10, 11)]:
        d.rectangle([p[0], p[1], p[0] + 1, p[1] + 1], fill=RUST)
    return img


def iron_ingot():
    img, d = canvas()
    d.polygon([(2, 10), (5, 5), (14, 5), (11, 10)], fill=IRON)
    d.polygon([(5, 5), (14, 5), (13, 6), (5, 6)], fill=IRON_L)
    d.rectangle([2, 10, 11, 12], fill=IRON_D)
    d.line([(11, 10), (14, 5)], fill=IRON_D)
    d.line([(11, 11), (14, 6)], fill=IRON_D)
    return outlined(img)


def crystal():
    img, d = canvas()
    d.polygon([(8, 1), (12, 5), (11, 12), (8, 14), (5, 12), (4, 5)], fill=CRYSTAL)
    d.polygon([(8, 1), (4, 5), (6, 6), (8, 3)], fill=CRYSTAL_L)
    d.polygon([(8, 14), (11, 12), (12, 5), (9, 8)], fill=CRYSTAL_D)
    d.line([(8, 3), (8, 12)], fill=CRYSTAL_L)
    return outlined(img)


def coconut():
    img, d = canvas()
    d.ellipse([2, 3, 13, 14], fill=BROWN)
    d.ellipse([3, 4, 8, 8], fill=(160, 108, 70, 255))
    d.ellipse([2, 3, 13, 14], outline=BROWN_D)
    for p in [(6, 8), (9, 8), (7, 11)]:
        d.rectangle([p[0], p[1], p[0] + 1, p[1] + 1], fill=BROWN_D)
    return outlined(img)


def seed_packet(color, seed_color):
    img, d = canvas()
    d.rectangle([3, 2, 12, 14], fill=PAPER)
    d.rectangle([3, 2, 12, 5], fill=color)
    d.line([(3, 6), (12, 6)], fill=WOOD_D)
    d.line([(3, 14), (12, 14)], fill=(200, 188, 150, 255))
    for p in [(6, 9), (9, 8), (7, 11), (10, 11)]:
        d.rectangle([p[0], p[1], p[0] + 1, p[1] + 1], fill=seed_color)
    return outlined(img)


def handle(d, x0, y0, x1, y1):
    d.line([(x0, y0), (x1, y1)], fill=WOOD, width=2)
    d.line([(x0 + 1, y0), (x1 + 1, y1)], fill=WOOD_D)


def axe(tier):
    light, dark = TIER_HEAD[tier]
    img, d = canvas()
    handle(d, 3, 14, 10, 5)
    d.polygon([(7, 2), (13, 2), (14, 8), (11, 8), (9, 6)], fill=light)
    d.polygon([(11, 8), (14, 8), (14, 6), (12, 5)], fill=dark)
    d.line([(8, 3), (12, 3)], fill=(255, 255, 255, 255) if tier == 3 else light)
    return outlined(img)


def pickaxe(tier):
    light, dark = TIER_HEAD[tier]
    img, d = canvas()
    handle(d, 4, 14, 9, 5)
    d.polygon([(1, 5), (5, 2), (9, 2), (13, 4), (14, 7), (11, 5), (8, 4), (5, 5), (3, 7)], fill=light)
    d.polygon([(11, 5), (14, 7), (13, 4)], fill=dark)
    d.point([6, 3], fill=(255, 255, 255, 255) if tier == 3 else light)
    return outlined(img)


def hoe():
    img, d = canvas()
    handle(d, 4, 14, 10, 4)
    d.polygon([(8, 2), (14, 3), (13, 7), (9, 5)], fill=STONE)
    d.polygon([(9, 5), (13, 7), (13, 5)], fill=STONE_D)
    d.line([(9, 3), (13, 4)], fill=STONE_L)
    return outlined(img)


def watering_can():
    img, d = canvas()
    d.rectangle([3, 6, 10, 13], fill=BLUE)
    d.rectangle([3, 6, 10, 7], fill=(150, 190, 240, 255))
    d.rectangle([3, 12, 10, 13], fill=BLUE_D)
    d.line([(10, 9), (14, 4)], fill=BLUE_D, width=2)
    d.rectangle([13, 2, 14, 4], fill=BLUE)
    d.arc([0, 5, 6, 12], 90, 270, fill=BLUE_D, width=2)
    d.line([(4, 5), (9, 5)], fill=BLUE_D)
    return outlined(img)


def s_campfire():
    img, d = canvas()
    d.line([(2, 14), (13, 10)], fill=WOOD, width=3)
    d.line([(2, 10), (13, 14)], fill=WOOD_D, width=3)
    d.polygon([(8, 1), (12, 8), (10, 11), (6, 11), (4, 8)], fill=FLAME)
    d.polygon([(8, 4), (10, 8), (9, 10), (7, 10), (6, 8)], fill=FLAME_L)
    d.polygon([(5, 8), (4, 8), (6, 11)], fill=FLAME_D)
    return outlined(img)


def s_workbench():
    img, d = canvas()
    d.rectangle([1, 5, 14, 8], fill=WOOD_L)
    d.rectangle([1, 8, 14, 9], fill=WOOD_D)
    d.rectangle([2, 9, 4, 14], fill=WOOD)
    d.rectangle([11, 9, 13, 14], fill=WOOD)
    d.line([(1, 6), (14, 6)], fill=WOOD)
    d.rectangle([9, 2, 12, 5], fill=IRON_D)
    d.rectangle([9, 2, 12, 3], fill=IRON)
    d.rectangle([3, 3, 6, 5], fill=BROWN_D)
    return outlined(img)


def s_furnace():
    img, d = canvas()
    d.rectangle([2, 4, 13, 14], fill=STONE)
    d.rectangle([2, 4, 13, 5], fill=STONE_L)
    d.rectangle([2, 13, 13, 14], fill=STONE_D)
    d.rectangle([9, 1, 12, 4], fill=STONE_D)
    d.rectangle([5, 8, 10, 13], fill=DARK)
    d.rectangle([6, 10, 9, 13], fill=FLAME_D)
    d.rectangle([7, 11, 8, 13], fill=FLAME_L)
    for p in [(3, 6), (12, 7), (3, 11), (12, 11)]:
        d.point(p, fill=STONE_D)
    return outlined(img)


def s_bed():
    img, d = canvas()
    d.rectangle([2, 2, 13, 14], fill=WOOD)
    d.rectangle([3, 3, 12, 13], fill=WHITE)
    d.rectangle([3, 3, 12, 5], fill=(226, 232, 244, 255))
    d.rectangle([3, 7, 12, 13], fill=RED)
    d.line([(3, 7), (12, 7)], fill=(150, 44, 52, 255))
    d.line([(3, 13), (12, 13)], fill=(150, 44, 52, 255))
    return outlined(img)


def s_chest():
    img, d = canvas()
    d.rectangle([2, 7, 13, 14], fill=WOOD)
    d.rectangle([2, 3, 13, 7], fill=WOOD_L)
    d.rectangle([2, 7, 13, 8], fill=WOOD_D)
    d.rectangle([2, 10, 13, 10], fill=WOOD_D)
    d.rectangle([2, 3, 3, 14], fill=IRON_D)
    d.rectangle([12, 3, 13, 14], fill=IRON_D)
    d.rectangle([7, 7, 8, 10], fill=GOLD)
    return outlined(img)


def s_torch():
    img, d = canvas()
    d.rectangle([7, 7, 8, 14], fill=WOOD)
    d.line([(8, 7), (8, 14)], fill=WOOD_D)
    d.polygon([(7, 1), (10, 5), (9, 8), (6, 8), (5, 5)], fill=FLAME)
    d.polygon([(7, 3), (9, 6), (8, 8), (7, 8), (6, 6)], fill=FLAME_L)
    return outlined(img)


def s_fence():
    img, d = canvas()
    d.rectangle([2, 4, 4, 14], fill=WOOD)
    d.rectangle([11, 4, 13, 14], fill=WOOD)
    d.rectangle([2, 4, 4, 5], fill=WOOD_L)
    d.rectangle([11, 4, 13, 5], fill=WOOD_L)
    d.rectangle([4, 6, 11, 7], fill=WOOD_L)
    d.rectangle([4, 10, 11, 11], fill=WOOD_L)
    d.line([(4, 8), (11, 8)], fill=WOOD_D)
    d.line([(4, 12), (11, 12)], fill=WOOD_D)
    return outlined(img)


def ui_heart():
    img, d = canvas()
    d.ellipse([2, 3, 8, 9], fill=RED)
    d.ellipse([7, 3, 13, 9], fill=RED)
    d.polygon([(2, 7), (13, 7), (8, 14)], fill=RED)
    d.polygon([(4, 4), (6, 4), (4, 6)], fill=(255, 170, 170, 255))
    return outlined(img)


def ui_food():
    img, d = canvas()
    d.ellipse([2, 3, 10, 11], fill=(214, 120, 70, 255))
    d.ellipse([3, 4, 6, 7], fill=(240, 170, 110, 255))
    d.line([(9, 9), (13, 13)], fill=PAPER, width=2)
    d.ellipse([11, 11, 14, 14], fill=PAPER)
    return outlined(img)


def ui_drop():
    img, d = canvas()
    d.polygon([(8, 1), (12, 8), (12, 11), (10, 14), (6, 14), (4, 11), (4, 8)], fill=CRYSTAL)
    d.polygon([(8, 1), (4, 8), (4, 11), (6, 9), (7, 4)], fill=CRYSTAL_L)
    d.polygon([(12, 8), (12, 11), (10, 14), (9, 13)], fill=CRYSTAL_D)
    return outlined(img)


def ui_bolt():
    img, d = canvas()
    d.polygon([(9, 1), (3, 9), (7, 9), (6, 15), (13, 6), (9, 6)], fill=GOLD)
    d.polygon([(9, 1), (3, 9), (5, 9), (9, 3)], fill=FLAME_L)
    return outlined(img)


def tinted(frame, mul):
    """A copy of a food icon from the props atlas, darkened and warmed to look cooked."""
    atlas = json.loads((PACK / "props.json").read_text(encoding="utf-8"))["frames"]
    sheet = Image.open(PACK / "props.png").convert("RGBA")
    f = atlas[frame]["frame"]
    tile = sheet.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"]))
    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    out.paste(tile, ((S - tile.width) // 2, (S - tile.height) // 2))
    px = out.load()
    for y in range(S):
        for x in range(S):
            r, g, b, a = px[x, y]
            if a:
                px[x, y] = (int(r * mul[0]), int(g * mul[1]), int(b * mul[2]), a)
    return out


def build():
    icons = {
        "wood": wood(), "stone": stone(), "fiber": fiber(), "plank": plank(), "rope": rope(), "iron_ore": iron_ore(),
        "iron_ingot": iron_ingot(), "crystal": crystal(), "coconut": coconut(),
        "carrot_seed": seed_packet((232, 128, 40, 255), (232, 128, 40, 255)),
        "turnip_seed": seed_packet((178, 96, 170, 255), (140, 70, 130, 255)),
        "pumpkin_seed": seed_packet((236, 160, 40, 255), (200, 120, 30, 255)),
        "corn_seed": seed_packet((236, 210, 70, 255), (200, 170, 40, 255)),
        "axe_wood": axe(1), "axe_stone": axe(2), "axe_iron": axe(3),
        "pickaxe_wood": pickaxe(1), "pickaxe_stone": pickaxe(2), "pickaxe_iron": pickaxe(3),
        "hoe": hoe(), "watering_can": watering_can(),
        "struct_campfire": s_campfire(), "struct_workbench": s_workbench(), "struct_furnace": s_furnace(),
        "struct_bed": s_bed(), "struct_chest": s_chest(), "struct_torch": s_torch(), "struct_fence": s_fence(),
        "ui_heart": ui_heart(), "ui_food": ui_food(), "ui_drop": ui_drop(), "ui_bolt": ui_bolt(),
        "roasted_carrot": tinted("farmicon1/4", (0.86, 0.66, 0.42)),
        "roasted_corn": tinted("farmicon1/58", (0.92, 0.72, 0.4)),
        "baked_pumpkin": tinted("farmicon1/50", (0.82, 0.58, 0.36)),
    }
    return icons


def main():
    icons = build()
    cols = 8
    rows = (len(icons) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * S, rows * S), (0, 0, 0, 0))
    frames = {}
    for n, (name, img) in enumerate(icons.items()):
        x, y = (n % cols) * S, (n // cols) * S
        sheet.paste(img, (x, y))
        frames[name] = {
            "frame": {"x": x, "y": y, "w": S, "h": S}, "rotated": False, "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": S, "h": S}, "sourceSize": {"w": S, "h": S},
        }
    PACK.mkdir(parents=True, exist_ok=True)
    sheet.save(PACK / "icons.png", optimize=True)
    meta = {"image": "icons.png", "size": {"w": sheet.width, "h": sheet.height}, "scale": "1"}
    (PACK / "icons.json").write_text(json.dumps({"frames": frames, "meta": meta}), encoding="utf-8")
    print(f"icons: {len(frames)} frames -> {sheet.width}x{sheet.height}")


if __name__ == "__main__":
    main()
