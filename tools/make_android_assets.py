"""Write the Android launcher icons and splash images from the branding pictures (run tools/make_branding.py first).

    python tools/make_android_assets.py

Needs the Capacitor Android project (npx cap add android). Output goes into android/app/src/main/res.
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / "branding"
RES = ROOT / "android" / "app" / "src" / "main" / "res"

# launcher icon size in px per density (48 dp), adaptive layer size (108 dp)
DENSITIES = {"mdpi": (48, 108), "hdpi": (72, 162), "xhdpi": (96, 216), "xxhdpi": (144, 324), "xxxhdpi": (192, 432)}
# splash (portrait) size per density
SPLASH = {"mdpi": (320, 480), "hdpi": (480, 800), "xhdpi": (720, 1280), "xxhdpi": (960, 1600), "xxxhdpi": (1280, 1920)}
BACKGROUND = "#0D3A5C"


def rounded(img, radius_ratio):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.width - 1, img.height - 1], radius=round(img.width * radius_ratio), fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def circle(img):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).ellipse([0, 0, img.width - 1, img.height - 1], fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def cover(img, size):
    """Scale to fill `size`, cropping the overflow from the middle."""
    k = max(size[0] / img.width, size[1] / img.height)
    big = img.resize((round(img.width * k), round(img.height * k)), Image.LANCZOS)
    left, top = (big.width - size[0]) // 2, (big.height - size[1]) // 2
    return big.crop((left, top, left + size[0], top + size[1]))


def main():
    icon = Image.open(BRAND / "icon-1024.png").convert("RGBA")
    foreground = Image.open(BRAND / "icon-adaptive-foreground.png").convert("RGBA")
    splash = Image.open(BRAND / "splash-1080x1920.png").convert("RGB")
    for name, (px, layer) in DENSITIES.items():
        folder = RES / f"mipmap-{name}"
        small = icon.resize((px, px), Image.LANCZOS)
        rounded(small, 0.18).save(folder / "ic_launcher.png")
        circle(small).save(folder / "ic_launcher_round.png")
        foreground.resize((layer, layer), Image.LANCZOS).save(folder / "ic_launcher_foreground.png")
    (RES / "values" / "ic_launcher_background.xml").write_text(
        f'<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">{BACKGROUND}</color>\n</resources>\n', encoding="utf-8")
    for name, (w, h) in SPLASH.items():
        cover(splash, (w, h)).save(RES / f"drawable-port-{name}" / "splash.png")
        cover(splash, (h, w)).save(RES / f"drawable-land-{name}" / "splash.png")
    cover(splash, (720, 1280)).save(RES / "drawable" / "splash.png")
    print("android icons and splash written")


if __name__ == "__main__":
    main()
