"""Palette and drawing helpers shared by the icon scripts (make_icons.py and make_combat_icons.py)."""
from PIL import Image, ImageDraw

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


def handle(d, x0, y0, x1, y1):
    d.line([(x0, y0), (x1, y1)], fill=WOOD, width=2)
    d.line([(x0 + 1, y0), (x1 + 1, y1)], fill=WOOD_D)
