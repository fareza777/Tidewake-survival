"""Item icons for weapons, ammunition, meat and loot (16x16, drawn with the shared kit in icon_kit.py)."""
from PIL import ImageDraw

from icon_kit import FIBER_L, GOLD, RED, STONE_L, TIER_HEAD, WHITE, WOOD, WOOD_D, WOOD_L, canvas, handle, outlined

BONE = (232, 224, 200, 255)
BONE_D = (176, 164, 138, 255)
RAW = (214, 96, 104, 255)
RAW_L = (240, 150, 150, 255)
RAW_D = (160, 60, 72, 255)
COOKED = (156, 92, 52, 255)
COOKED_L = (206, 134, 78, 255)
COOKED_D = (104, 58, 36, 255)
HONEY = (240, 176, 48, 255)
HONEY_L = (255, 222, 110, 255)
HONEY_D = (196, 120, 32, 255)
GEL = (104, 206, 118, 255)
GEL_L = (190, 246, 190, 255)
GEL_D = (58, 140, 82, 255)


def sword(tier):
    light, dark = TIER_HEAD[tier]
    img, d = canvas()
    d.line([(5, 10), (12, 3)], fill=light, width=3)
    d.line([(6, 11), (13, 4)], fill=dark)
    d.polygon([(12, 2), (14, 1), (15, 2), (14, 4)], fill=light)
    if tier == 3:
        d.line([(6, 9), (12, 3)], fill=(255, 255, 255, 255))
    d.line([(4, 8), (8, 12)], fill=GOLD, width=2)
    handle(d, 5, 11, 2, 14)
    return outlined(img)


def spear_bone():
    img, d = canvas()
    handle(d, 2, 14, 10, 6)
    d.polygon([(9, 7), (11, 3), (14, 1), (15, 2), (13, 5), (10, 8)], fill=BONE)
    d.line([(10, 6), (14, 2)], fill=WHITE)
    d.polygon([(10, 8), (13, 5), (12, 7)], fill=BONE_D)
    d.line([(8, 8), (10, 10)], fill=FIBER_L)
    return outlined(img)


def bow():
    img, d = canvas()
    d.arc([2, 1, 14, 15], 100, 260, fill=WOOD, width=2)
    d.arc([3, 1, 15, 15], 100, 260, fill=WOOD_D)
    d.line([(7, 2), (7, 14)], fill=FIBER_L)
    d.point([4, 8], fill=WOOD_L)
    return outlined(img)


def arrow():
    img, d = canvas()
    d.line([(3, 13), (11, 5)], fill=WOOD, width=2)
    d.polygon([(11, 3), (15, 1), (13, 6)], fill=STONE_L)
    d.polygon([(2, 12), (1, 8), (4, 11)], fill=RED)
    d.polygon([(4, 14), (8, 15), (5, 11)], fill=RED)
    return outlined(img)


def meat(body, light, dark):
    img, d = canvas()
    d.ellipse([4, 4, 14, 12], fill=body)
    d.ellipse([5, 5, 10, 8], fill=light)
    d.arc([5, 6, 13, 12], 20, 160, fill=dark)
    d.line([(4, 10), (1, 14)], fill=BONE, width=2)
    d.point([1, 14], fill=BONE_D)
    return outlined(img)


def raw_meat():
    return meat(RAW, RAW_L, RAW_D)


def cooked_meat():
    img = meat(COOKED, COOKED_L, COOKED_D)
    d = ImageDraw.Draw(img)
    d.line([(7, 8), (11, 6)], fill=COOKED_D)
    d.line([(8, 10), (12, 8)], fill=COOKED_D)
    return img


def honey():
    img, d = canvas()
    d.rectangle([4, 6, 12, 14], fill=HONEY)
    d.rectangle([4, 6, 6, 14], fill=HONEY_L)
    d.rectangle([4, 13, 12, 14], fill=HONEY_D)
    d.rectangle([3, 3, 13, 6], fill=WOOD)
    d.rectangle([3, 3, 13, 4], fill=WOOD_L)
    d.line([(9, 7), (9, 10)], fill=HONEY_L)
    return outlined(img)


def bandage():
    img, d = canvas()
    d.ellipse([2, 4, 14, 13], fill=WHITE)
    d.ellipse([2, 4, 14, 13], outline=BONE_D)
    d.rectangle([7, 6, 9, 11], fill=RED)
    d.rectangle([5, 8, 11, 9], fill=RED)
    return outlined(img)


def gel():
    img, d = canvas()
    d.polygon([(2, 13), (3, 8), (6, 4), (10, 4), (13, 8), (14, 13)], fill=GEL)
    d.polygon([(3, 12), (4, 9), (7, 5), (9, 5)], fill=GEL_L)
    d.line([(3, 13), (14, 13)], fill=GEL_D)
    d.point([10, 8], fill=GEL_D)
    d.point([6, 9], fill=GEL_D)
    return outlined(img)


def bone():
    img, d = canvas()
    d.line([(4, 12), (12, 4)], fill=BONE, width=3)
    for cx, cy in ((3, 11), (5, 13), (11, 3), (13, 5)):
        d.ellipse([cx - 1, cy - 1, cx + 1, cy + 1], fill=BONE)
    d.line([(5, 12), (12, 5)], fill=BONE_D)
    return outlined(img)


def combat_icons():
    return {
        "sword_wood": sword(1), "sword_stone": sword(2), "sword_iron": sword(3), "spear_bone": spear_bone(),
        "bow": bow(), "arrow": arrow(), "raw_meat": raw_meat(), "cooked_meat": cooked_meat(), "honey": honey(),
        "bandage": bandage(), "gel": gel(), "bone": bone(),
    }
