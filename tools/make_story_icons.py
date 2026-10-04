"""Icons for the story: the shovel and fishing rod, fish, sailcloth, antidote, the lost pickaxe, the beacon core, the
Hollow Keeper's armour, the raft, and the three things lying about the island (a bottle, a tablet, a dig mark).

Same 16x16 style as the other icon scripts (shared kit in icon_kit.py)."""
from icon_kit import (
    BROWN, BROWN_D, CRYSTAL, CRYSTAL_D, CRYSTAL_L, FIBER, FIBER_D, FLAME, FLAME_D, FLAME_L, GOLD, IRON, IRON_D, IRON_L, PAPER, RED,
    ROPE, ROPE_D, RUST, STONE, STONE_D, STONE_L, WHITE, WOOD, WOOD_D, WOOD_L, canvas, handle, outlined,
)
from make_armor_icons import breastplate

FISH = (110, 160, 190, 255)
FISH_L = (176, 214, 232, 255)
FISH_D = (64, 100, 140, 255)
COOKED = (214, 130, 60, 255)
COOKED_L = (240, 176, 96, 255)
COOKED_D = (150, 80, 40, 255)
GLASS = (170, 226, 214, 255)
GLASS_D = (96, 168, 160, 255)
HERB = (96, 176, 96, 255)
HERB_D = (56, 120, 70, 255)
CORK = (196, 150, 96, 255)
HOLLOW = (96, 70, 140, 255)
HOLLOW_D = (56, 40, 92, 255)
HOLLOW_L = (156, 126, 206, 255)
SAND = (232, 214, 150, 255)
SAND_D = (190, 168, 104, 255)


def shovel():
    img, d = canvas()
    handle(d, 4, 13, 11, 5)
    d.line([(10, 3), (13, 6)], fill=WOOD_L, width=2)
    d.polygon([(2, 14), (3, 10), (6, 10), (7, 14), (4, 15)], fill=IRON)
    d.polygon([(3, 10), (6, 10), (5, 12), (4, 12)], fill=IRON_L)
    d.line([(4, 12), (4, 14)], fill=IRON_D)
    return outlined(img)


def fishing_rod():
    img, d = canvas()
    d.line([(2, 14), (12, 2)], fill=WOOD, width=2)
    d.line([(3, 14), (13, 2)], fill=WOOD_D)
    d.line([(13, 2), (14, 11)], fill=WHITE)
    d.ellipse([13, 11, 15, 13], fill=RED)
    d.point([14, 12], fill=WHITE)
    d.rectangle([4, 10, 5, 11], fill=IRON)
    return outlined(img)


def fish(body, light, dark, big=False):
    img, d = canvas()
    y0, y1 = (4, 12) if big else (6, 11)
    d.ellipse([1, y0, 12, y1], fill=body)
    d.polygon([(11, 8), (15, y0 - 1), (15, y1 + 1)], fill=dark)
    d.line([(3, y0 + 1), (9, y0 + 1)], fill=light)
    d.point([3, y0 + 2], fill=(255, 255, 255, 255))
    d.line([(7, y0 + 1), (7, y1 - 1)], fill=dark)
    if big:
        d.polygon([(5, y0), (8, y0 - 2), (9, y0)], fill=dark)
        d.line([(3, y1 - 1), (9, y1 - 1)], fill=GOLD)
    return outlined(img)


def raw_fish():
    return fish(FISH, FISH_L, FISH_D)


def cooked_fish():
    return fish(COOKED, COOKED_L, COOKED_D)


def big_fish():
    return fish(FISH, FISH_L, FISH_D, big=True)


def sailcloth():
    img, d = canvas()
    d.polygon([(2, 3), (13, 2), (14, 12), (3, 13)], fill=WHITE)
    d.polygon([(2, 3), (13, 2), (13, 4), (2, 5)], fill=(220, 216, 200, 255))
    d.line([(3, 13), (14, 12)], fill=(200, 196, 180, 255))
    d.line([(4, 7), (12, 6)], fill=ROPE, width=1)
    d.line([(4, 10), (12, 9)], fill=ROPE_D, width=1)
    d.point([2, 3], fill=ROPE_D)
    return outlined(img)


def antidote():
    img, d = canvas()
    d.ellipse([3, 6, 12, 14], fill=GLASS)
    d.rectangle([6, 3, 9, 7], fill=GLASS)
    d.rectangle([5, 2, 10, 3], fill=CORK)
    d.ellipse([4, 9, 11, 14], fill=HERB)
    d.line([(5, 10), (10, 10)], fill=HERB_D)
    d.point([5, 8], fill=(255, 255, 255, 255))
    return outlined(img)


def lost_pickaxe():
    img, d = canvas()
    handle(d, 3, 14, 11, 5)
    d.arc([2, 1, 14, 9], 200, 340, fill=RUST, width=3)
    d.line([(3, 4), (4, 6)], fill=RUST, width=2)
    d.line([(12, 4), (13, 6)], fill=RUST, width=2)
    d.point([7, 3], fill=IRON)
    return outlined(img)


def beacon_core():
    img, d = canvas()
    d.ellipse([2, 2, 13, 13], fill=FLAME_D)
    d.ellipse([3, 3, 12, 12], fill=FLAME)
    d.ellipse([5, 5, 10, 10], fill=FLAME_L)
    d.ellipse([6, 6, 8, 8], fill=(255, 255, 255, 255))
    d.rectangle([5, 13, 10, 14], fill=GOLD)
    d.point([3, 7], fill=GOLD)
    d.point([12, 7], fill=GOLD)
    return outlined(img)


def armor_hollow():
    img, d = breastplate(HOLLOW, HOLLOW_D, HOLLOW_L)
    d.ellipse([6, 7, 10, 11], outline=HOLLOW_D)
    d.point([8, 9], fill=FLAME_L)
    d.point([2, 4], fill=CRYSTAL_L)
    d.point([14, 4], fill=CRYSTAL_L)
    return outlined(img)


def struct_raft():
    img, d = canvas()
    for i, y in enumerate((9, 11, 13)):
        d.rectangle([1, y, 14, y + 1], fill=WOOD_L if i % 2 == 0 else WOOD)
        d.line([(1, y + 1), (14, y + 1)], fill=WOOD_D)
    d.line([(8, 2), (8, 10)], fill=WOOD_D, width=1)
    d.polygon([(9, 2), (14, 8), (9, 8)], fill=WHITE)
    d.line([(9, 8), (14, 8)], fill=(200, 196, 180, 255))
    d.point([8, 1], fill=RED)
    return outlined(img)


def bottle():
    img, d = canvas()
    d.ellipse([4, 6, 11, 14], fill=GLASS)
    d.rectangle([6, 2, 9, 7], fill=GLASS)
    d.rectangle([6, 1, 9, 2], fill=CORK)
    d.rectangle([6, 8, 9, 12], fill=PAPER)
    d.line([(7, 9), (8, 9)], fill=BROWN_D)
    d.line([(7, 11), (8, 11)], fill=BROWN_D)
    d.point([5, 8], fill=(255, 255, 255, 255))
    d.line([(4, 12), (11, 12)], fill=GLASS_D)
    return outlined(img)


def tablet():
    img, d = canvas()
    d.polygon([(3, 14), (3, 5), (5, 2), (11, 2), (13, 5), (13, 14)], fill=STONE)
    d.polygon([(4, 5), (5, 3), (10, 3), (11, 5)], fill=STONE_L)
    d.line([(3, 14), (13, 14)], fill=STONE_D)
    for x, y in ((6, 6), (9, 6), (6, 9), (8, 9), (10, 9), (7, 12)):
        d.rectangle([x, y, x + 1, y], fill=STONE_D)
    return outlined(img)


def dig_mark():
    img, d = canvas()
    d.ellipse([2, 8, 14, 14], fill=SAND)
    d.arc([2, 8, 14, 14], 0, 180, fill=SAND_D)
    d.line([(4, 3), (11, 11)], fill=RED, width=2)
    d.line([(11, 3), (4, 11)], fill=RED, width=2)
    return outlined(img)


def story_icons():
    return {
        "shovel": shovel(), "fishing_rod": fishing_rod(), "raw_fish": raw_fish(), "cooked_fish": cooked_fish(), "big_fish": big_fish(),
        "sailcloth": sailcloth(), "antidote": antidote(), "lost_pickaxe": lost_pickaxe(), "beacon_core": beacon_core(),
        "armor_hollow": armor_hollow(), "struct_raft": struct_raft(), "spot_bottle": bottle(), "spot_tablet": tablet(), "spot_dig": dig_mark(),
    }
