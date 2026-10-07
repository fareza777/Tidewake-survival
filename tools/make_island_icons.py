"""Icons for the far islands: the four sigils, the four island armours and the boat (16x16)."""
from icon_kit import CRYSTAL_L, FLAME, FLAME_L, RED, WHITE, WOOD, WOOD_D, WOOD_L, canvas, outlined
from make_armor_icons import breastplate

FROST = (150, 214, 255, 255)
FROST_D = (84, 150, 214, 255)
EMBER = (232, 96, 44, 255)
EMBER_D = (150, 50, 34, 255)
TIDE = (80, 200, 170, 255)
TIDE_D = (36, 120, 112, 255)
TIDE_L = (190, 250, 230, 255)
SKY = (196, 170, 255, 255)
SKY_D = (112, 88, 190, 255)
SKY_L = (236, 226, 255, 255)
SKY_GOLD = (255, 224, 120, 255)


def disc(body, dark, light):
    img, d = canvas()
    d.ellipse([2, 2, 13, 13], fill=dark)
    d.ellipse([3, 3, 12, 12], fill=body)
    d.ellipse([4, 4, 8, 8], fill=light)
    return img, d


def frost_sigil():
    img, d = disc(FROST, FROST_D, WHITE)
    d.line([(8, 3), (8, 12)], fill=FROST_D)
    d.line([(4, 5), (12, 10)], fill=FROST_D)
    d.line([(12, 5), (4, 10)], fill=FROST_D)
    return outlined(img)


def ember_sigil():
    img, d = disc(EMBER, EMBER_D, FLAME_L)
    d.polygon([(8, 4), (11, 9), (8, 12), (5, 9)], fill=FLAME)
    d.polygon([(8, 7), (9, 10), (7, 10)], fill=FLAME_L)
    return outlined(img)


def tide_sigil():
    img, d = disc(TIDE, TIDE_D, TIDE_L)
    d.arc([3, 4, 8, 9], 180, 360, fill=TIDE_D)
    d.arc([8, 4, 13, 9], 180, 360, fill=TIDE_D)
    d.arc([3, 8, 8, 13], 180, 360, fill=TIDE_D)
    d.arc([8, 8, 13, 13], 180, 360, fill=TIDE_D)
    return outlined(img)


def sky_sigil():
    img, d = disc(SKY, SKY_D, SKY_L)
    d.polygon([(9, 3), (6, 9), (8, 9), (7, 13), (11, 7), (9, 7)], fill=SKY_GOLD)
    return outlined(img)


def boat():
    img, d = canvas()
    d.polygon([(1, 10), (15, 10), (12, 14), (4, 14)], fill=WOOD)
    d.line([(1, 10), (15, 10)], fill=WOOD_L)
    d.line([(4, 14), (12, 14)], fill=WOOD_D)
    d.line([(8, 1), (8, 10)], fill=WOOD_D)
    d.polygon([(9, 2), (14, 8), (9, 8)], fill=WHITE)
    d.polygon([(7, 3), (3, 8), (7, 8)], fill=(222, 218, 200, 255))
    d.point([8, 0], fill=RED)
    return outlined(img)


def island_icons():
    def piece(body, dark, light, mark):
        img, d = breastplate(body, dark, light)
        d.ellipse([6, 7, 10, 11], outline=dark)
        d.point([8, 9], fill=mark)
        return outlined(img)

    return {
        "frost_sigil": frost_sigil(), "ember_sigil": ember_sigil(), "tide_sigil": tide_sigil(), "sky_sigil": sky_sigil(),
        "armor_frost": piece(FROST, FROST_D, WHITE, CRYSTAL_L),
        "armor_ember": piece(EMBER, EMBER_D, FLAME_L, FLAME_L),
        "armor_tide": piece(TIDE, TIDE_D, TIDE_L, WHITE),
        "armor_sky": piece(SKY, SKY_D, SKY_L, SKY_GOLD),
        "struct_boat": boat(),
    }
