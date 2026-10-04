"""Item icons for dungeon keys and the three story items (16x16, drawn with the shared kit in icon_kit.py)."""
from icon_kit import GOLD, IRON_D, IRON_L, RED, ROPE, ROPE_D, WOOD, WOOD_D, WOOD_L, canvas, outlined

GOLD_D = (190, 140, 40, 255)
BRASS = (214, 170, 80, 255)
BRASS_D = (150, 110, 50, 255)
GLASS = (190, 236, 250, 255)


def key(head, head_d, long_teeth=1):
    img, d = canvas()
    d.ellipse([1, 2, 7, 8], fill=head)
    d.ellipse([3, 4, 5, 6], fill=(0, 0, 0, 0))
    d.line([(7, 7), (14, 14)], fill=head, width=2)
    d.line([(8, 8), (14, 14)], fill=head_d)
    for i in range(long_teeth):
        d.rectangle([11 + i * 2 - 1, 12 - i, 12 + i * 2 - 1, 13 - i], fill=head_d)
    d.point([3, 3], fill=(255, 255, 255, 255))
    return outlined(img)


def small_key():
    return key(GOLD, GOLD_D, 1)


def boss_key():
    img = key(RED, (120, 30, 40, 255), 2)
    return img


def compass():
    img, d = canvas()
    d.ellipse([2, 2, 14, 14], fill=BRASS)
    d.ellipse([4, 4, 12, 12], fill=GLASS)
    d.polygon([(8, 4), (9, 8), (7, 8)], fill=RED)
    d.polygon([(8, 12), (9, 8), (7, 8)], fill=IRON_D)
    d.point([8, 8], fill=BRASS_D)
    d.arc([2, 2, 14, 14], 200, 340, fill=GOLD)
    return outlined(img)


def hull_planks():
    img, d = canvas()
    for i, y in enumerate((3, 6, 9)):
        d.rectangle([2, y, 13, y + 2], fill=WOOD_L if i % 2 == 0 else WOOD)
        d.line([(2, y + 2), (13, y + 2)], fill=WOOD_D)
    d.line([(5, 2), (5, 12)], fill=ROPE, width=1)
    d.line([(10, 2), (10, 12)], fill=ROPE_D, width=1)
    d.polygon([(2, 12), (13, 12), (11, 14), (4, 14)], fill=WOOD_D)
    return outlined(img)


def lighthouse_key():
    img, d = canvas()
    d.polygon([(8, 1), (13, 5), (11, 9), (5, 9), (3, 5)], fill=IRON_L)
    d.polygon([(8, 3), (11, 5), (10, 7), (6, 7), (5, 5)], fill=GLASS)
    d.line([(8, 9), (8, 14)], fill=IRON_L, width=2)
    d.rectangle([8, 12, 11, 13], fill=IRON_D)
    d.rectangle([8, 14, 10, 14], fill=IRON_D)
    d.point([8, 5], fill=GOLD)
    return outlined(img)


def dungeon_icons():
    return {
        "small_key": small_key(), "boss_key": boss_key(), "compass": compass(), "hull_planks": hull_planks(),
        "lighthouse_key": lighthouse_key(),
    }
