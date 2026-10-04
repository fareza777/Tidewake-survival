"""Item icons for the five armour pieces (16x16, drawn with the shared kit in icon_kit.py)."""
from icon_kit import FIBER_L, GOLD, IRON_D, IRON_L, canvas, outlined

BONE = (232, 224, 200, 255)
BONE_D = (176, 164, 138, 255)
MOSS = (104, 156, 84, 255)
MOSS_D = (62, 106, 54, 255)
MOSS_L = (160, 206, 120, 255)
DARK = (74, 74, 94, 255)
DARK_D = (46, 46, 62, 255)
MIRE = (62, 176, 152, 255)
MIRE_D = (34, 112, 112, 255)
MIRE_L = (150, 236, 206, 255)


def breastplate(body, dark, light):
    """A chest piece: shoulders, a torso with a neck opening, and a lighter strip down the left side."""
    img, d = canvas()
    d.polygon([(1, 5), (4, 2), (12, 2), (15, 5), (13, 9), (11, 8), (11, 14), (5, 14), (5, 8), (3, 9)], fill=body)
    d.polygon([(5, 2), (8, 6), (11, 2)], fill=dark)
    d.line([(5, 9), (5, 13)], fill=light)
    d.line([(3, 5), (5, 3)], fill=light)
    d.line([(11, 9), (11, 13)], fill=dark)
    d.line([(13, 6), (12, 8)], fill=dark)
    return img, d


def armor_bone():
    img, d = breastplate(BONE, BONE_D, (255, 252, 240, 255))
    for y in (8, 10, 12):
        d.line([(6, y), (10, y)], fill=BONE_D)
    return outlined(img)


def armor_iron():
    img, d = breastplate(IRON_L, IRON_D, (255, 255, 255, 255))
    d.rectangle([7, 8, 9, 11], fill=IRON_D)
    return outlined(img)


def armor_moss():
    img, d = breastplate(MOSS, MOSS_D, MOSS_L)
    d.polygon([(7, 9), (9, 9), (10, 11), (8, 13), (6, 11)], fill=MOSS_L)
    d.point([8, 11], fill=MOSS_D)
    return outlined(img)


def armor_ironbones():
    img, d = breastplate(DARK, DARK_D, IRON_L)
    d.rectangle([6, 8, 10, 11], fill=BONE)
    d.point([7, 9], fill=DARK_D)
    d.point([9, 9], fill=DARK_D)
    d.line([(7, 11), (9, 11)], fill=DARK_D)
    d.point([2, 4], fill=GOLD)
    d.point([14, 4], fill=GOLD)
    return outlined(img)


def armor_mire():
    img, d = breastplate(MIRE, MIRE_D, MIRE_L)
    for y in (8, 10, 12):
        for x in (6, 8):
            d.arc([x, y - 1, x + 2, y + 1], 0, 180, fill=MIRE_L)
    d.point([8, 5], fill=FIBER_L)
    return outlined(img)


def armor_icons():
    return {
        "armor_bone": armor_bone(), "armor_iron": armor_iron(), "armor_moss": armor_moss(), "armor_ironbones": armor_ironbones(),
        "armor_mire": armor_mire(),
    }
