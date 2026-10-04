"""Draw the game's branding from the packed sprites: app icon (plain and adaptive), splash, Play feature graphic, favicons.

A night beach: stars, a moon, a campfire, the hero and two palms, under the TIDEWAKE title set in the game's own bitmap
font. Run after pack_assets.py and the fonts exist:  python tools/make_branding.py
Output: branding/*.png (for the store and the Android project) and public/favicon.png, icon-192.png, icon-512.png.
"""
import json
import random
import re
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
PACK = ROOT / "public" / "assets" / "pack"
FONTS = ROOT / "public" / "assets" / "fonts"
OUT = ROOT / "branding"

SKY_TOP = (13, 30, 58)
SKY_BOTTOM = (13, 58, 92)
SAND = (185, 154, 90)
SAND_L = (216, 187, 120)
GOLD = (240, 190, 70)
INK = (8, 12, 24)


def atlas(name):
    data = json.loads((PACK / f"{name}.json").read_text(encoding="utf-8"))
    return data["frames"], Image.open(PACK / f"{name}.png").convert("RGBA")


PROPS = atlas("props")
HEROES = atlas("heroes")


def sprite(source, frame, scale):
    frames, sheet = source
    f = frames[frame]["frame"]
    img = sheet.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"]))
    return img.resize((img.width * scale, img.height * scale), Image.NEAREST)


def paste_feet(canvas, img, cx, feet_y):
    canvas.alpha_composite(img, (round(cx - img.width / 2), round(feet_y - img.height)))


def gradient(w, h, top, bottom):
    img = Image.new("RGBA", (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        k = y / max(1, h - 1)
        d.line([(0, y), (w, y)], fill=tuple(round(a + (b - a) * k) for a, b in zip(top, bottom)) + (255,))
    return img


class BitmapFont:
    """Just enough of the BMFont text format to set a line of the game's own title font."""

    def __init__(self, name):
        text = (FONTS / f"{name}@4x.fnt").read_text(encoding="utf-8")
        self.sheet = Image.open(FONTS / f"{name}@4x.png").convert("RGBA")
        self.chars = {}
        for m in re.finditer(r'<char id="(\d+)" x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" xoffset="(-?\d+)" yoffset="(-?\d+)" xadvance="(-?\d+)"', text):
            i, x, y, w, h, xo, yo, xa = map(int, m.groups())
            self.chars[i] = (x, y, w, h, xo, yo, xa)

    def render(self, text, tint, scale=1):
        glyphs = [self.chars[ord(c)] for c in text if ord(c) in self.chars]
        width = sum(g[6] for g in glyphs)
        height = max(g[5] + g[3] for g in glyphs)
        img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        x = 0
        for gx, gy, gw, gh, xo, yo, xa in glyphs:
            cell = self.sheet.crop((gx, gy, gx + gw, gy + gh))
            img.alpha_composite(cell, (x + xo, yo))
            x += xa
        tinted = Image.new("RGBA", img.size, tint + (255,))
        tinted.putalpha(img.getchannel("A"))
        img = tinted
        return img.resize((round(img.width * scale), round(img.height * scale)), Image.NEAREST)


def beach_scene(w, h, unit, with_title=True, seed=7):
    """The picture: `unit` is the pixel scale of the sprites (a 16 px tile is `unit` px wide)."""
    rng = random.Random(seed)
    img = gradient(w, h, SKY_TOP, SKY_BOTTOM)
    d = ImageDraw.Draw(img)
    for _ in range(int(w * h / 26000)):
        x, y = rng.randrange(w), rng.randrange(int(h * 0.55))
        s = max(1, unit // 9) * (2 if rng.random() < 0.12 else 1)
        a = rng.randrange(110, 255)
        d.rectangle([x, y, x + s, y + s], fill=(255, 255, 255, a))
    moon_r = round(unit * 2.2)
    mx, my = round(w * 0.8), round(h * 0.16)
    d.ellipse([mx - moon_r, my - moon_r, mx + moon_r, my + moon_r], fill=(244, 240, 208, 255))
    d.ellipse([mx - moon_r + unit, my - moon_r - unit // 2, mx + moon_r + unit, my + moon_r - unit // 2], fill=(13, 46, 80, 255))
    ground = round(h * 0.80)
    d.rectangle([0, ground, w, h], fill=SAND + (255,))
    d.rectangle([0, ground, w, ground + max(2, unit // 3)], fill=SAND_L + (255,))
    sea_top = ground - round(unit * 3.6)
    d.rectangle([0, sea_top, w, ground], fill=(10, 52, 86, 255))
    for i in range(5):
        y = sea_top + round(unit * (0.5 + i * 0.6))
        x = rng.randrange(0, w - unit * 6)
        d.rectangle([x, y, x + unit * 3, y + max(2, unit // 6)], fill=(150, 205, 240, 150 - i * 20))
    k = max(1, round(unit / 7))
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gx, gy = w // 2, ground
    for r, a in ((unit * 9, 18), (unit * 6, 28), (unit * 4, 44)):
        gd.ellipse([gx - r, gy - r, gx + r, gy + r], fill=(255, 160, 50, a))
    img.alpha_composite(glow)
    paste_feet(img, sprite(PROPS, "p/tree_06", k), w * 0.17, ground + unit * 0.6)
    paste_feet(img, sprite(PROPS, "p/tree_07", k), w * 0.85, ground + unit * 0.9)
    paste_feet(img, sprite(PROPS, "fire/campfire_burning/0", k), w / 2, ground + unit * 0.4)
    paste_feet(img, sprite(HEROES, "hero1/idle/right/0", k), w / 2 - unit * 3.3, ground + unit * 0.5)
    if with_title:
        font = BitmapFont("title")
        natural = font.render("TIDEWAKE", GOLD)
        scale = 0.8 * w / natural.width
        title = font.render("TIDEWAKE", GOLD, scale=scale)
        shadow = font.render("TIDEWAKE", INK, scale=scale)
        tx, ty = round((w - title.width) / 2), round(h * (0.1 if w > h * 1.5 else 0.2))
        img.alpha_composite(shadow, (tx + unit // 3, ty + unit // 3))
        img.alpha_composite(title, (tx, ty))
        head = BitmapFont("head")
        sub_natural = head.render("ISLAND SURVIVAL", (191, 230, 255))
        sub = head.render("ISLAND SURVIVAL", (191, 230, 255), scale=0.42 * w / sub_natural.width)
        img.alpha_composite(sub, (round((w - sub.width) / 2), ty + title.height + unit // 2))
    return img


def rounded(img, radius):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.width - 1, img.height - 1], radius=radius, fill=255)
    out = img.copy()
    out.putalpha(mask)
    return out


def icon_art(size):
    """Square art for the icon: the campfire, the hero and a palm, without the long title."""
    img = beach_scene(size, size, size // 12, with_title=False, seed=3)
    d = ImageDraw.Draw(img)
    return img


def main():
    OUT.mkdir(exist_ok=True)
    icon = icon_art(1024)
    icon.convert("RGB").save(OUT / "icon-1024.png")
    # Adaptive icon: the art sits in the central two thirds, the rest is background.
    background = gradient(1024, 1024, SKY_TOP, SKY_BOTTOM)
    background.convert("RGB").save(OUT / "icon-adaptive-background.png")
    fg = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    inner = icon_art(676)
    fg.alpha_composite(rounded(inner, 120), (174, 174))
    fg.save(OUT / "icon-adaptive-foreground.png")
    beach_scene(1080, 1920, 100).convert("RGB").save(OUT / "splash-1080x1920.png")
    beach_scene(1024, 500, 26).convert("RGB").save(OUT / "feature-graphic-1024x500.png")
    pub = ROOT / "public"
    icon.resize((512, 512), Image.NEAREST).convert("RGB").save(pub / "icon-512.png")
    icon.resize((192, 192), Image.NEAREST).convert("RGB").save(pub / "icon-192.png")
    icon.resize((64, 64), Image.NEAREST).convert("RGB").save(pub / "favicon.png")
    print("branding written to", OUT)


if __name__ == "__main__":
    main()
