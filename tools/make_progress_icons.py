"""Icons for the progression items: coal, hides, steel and mithril, the anvil, helmets, boots and charms (16x16).

Steel and mithril tools, weapons and armour are the iron icons with the metal recoloured, so a set always matches.
"""
from PIL import Image

from icon_kit import (
    BROWN, BROWN_D, CRYSTAL, CRYSTAL_D, CRYSTAL_L, GOLD, IRON, IRON_D, IRON_L, RED, WHITE, WOOD, WOOD_D, WOOD_L, canvas, outlined,
)

STEEL = (150, 168, 198, 255)
STEEL_L = (214, 228, 248, 255)
STEEL_D = (86, 102, 134, 255)
MITHRIL = (74, 206, 196, 255)
MITHRIL_L = (176, 255, 240, 255)
MITHRIL_D = (34, 124, 138, 255)
LEATHER = (166, 114, 70, 255)
LEATHER_L = (210, 160, 104, 255)
LEATHER_D = (104, 68, 40, 255)
COAL = (52, 52, 64, 255)
COAL_L = (116, 116, 134, 255)
COAL_D = (28, 28, 38, 255)
PURE_WHITE = (255, 255, 255, 255)

STEEL_MAP = {IRON: STEEL, IRON_L: STEEL_L, IRON_D: STEEL_D, PURE_WHITE: (240, 248, 255, 255)}
MITHRIL_MAP = {IRON: MITHRIL, IRON_L: MITHRIL_L, IRON_D: MITHRIL_D, PURE_WHITE: (230, 255, 250, 255)}


def recolor(img, mapping):
    out = img.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            if px[x, y] in mapping:
                px[x, y] = mapping[px[x, y]]
    return out


def coal():
    img, d = canvas()
    d.polygon([(3, 11), (4, 7), (7, 5), (10, 7), (11, 11), (8, 13)], fill=COAL)
    d.polygon([(8, 9), (11, 8), (13, 11), (11, 13), (9, 13)], fill=COAL_D)
    d.line([(5, 7), (7, 6)], fill=COAL_L)
    d.point([9, 8], fill=COAL_L)
    d.point([12, 10], fill=COAL_L)
    return outlined(img)


def hide():
    img, d = canvas()
    d.polygon([(3, 5), (7, 3), (10, 4), (13, 3), (13, 8), (12, 12), (8, 13), (4, 12), (2, 8)], fill=LEATHER)
    d.polygon([(10, 4), (13, 3), (13, 8), (12, 12), (9, 10)], fill=LEATHER_D)
    d.line([(4, 5), (7, 4)], fill=LEATHER_L)
    for p in [(5, 8), (7, 9), (6, 11)]:
        d.point(p, fill=LEATHER_D)
    return outlined(img)


def mithril_ore():
    img, d = canvas()
    d.polygon([(3, 11), (4, 6), (8, 3), (12, 5), (13, 10), (10, 13), (5, 13)], fill=(116, 124, 150, 255))
    d.polygon([(8, 13), (13, 10), (12, 12), (10, 13)], fill=(70, 78, 100, 255))
    for p in [(6, 6), (9, 5), (8, 9), (11, 8), (5, 10), (10, 11)]:
        d.rectangle([p[0], p[1], p[0] + 1, p[1] + 1], fill=MITHRIL)
    d.point([6, 6], fill=MITHRIL_L)
    d.point([9, 5], fill=MITHRIL_L)
    return outlined(img)


def anvil():
    img, d = canvas()
    d.polygon([(1, 5), (14, 5), (13, 8), (9, 8), (10, 10), (11, 13), (5, 13), (6, 10), (7, 8), (3, 7)], fill=IRON_D)
    d.polygon([(1, 5), (14, 5), (13, 7), (3, 7)], fill=IRON)
    d.line([(2, 5), (13, 5)], fill=IRON_L)
    d.rectangle([5, 12, 11, 13], fill=(70, 78, 100, 255))
    return outlined(img)


def helm(body, dark, light, nasal=True):
    img, d = canvas()
    d.polygon([(3, 11), (3, 7), (5, 4), (8, 3), (11, 4), (13, 7), (13, 11)], fill=body)
    d.rectangle([3, 9, 12, 10], fill=dark)
    if nasal:
        d.rectangle([7, 9, 8, 13], fill=dark)
    d.line([(5, 5), (7, 4)], fill=light)
    d.line([(4, 7), (5, 6)], fill=light)
    d.point([11, 6], fill=dark)
    return outlined(img)


def boots(body, dark, light):
    img, d = canvas()
    for x0 in (1, 9):
        d.rectangle([x0, 3, x0 + 4, 10], fill=body)
        d.rectangle([x0, 10, x0 + 6, 12], fill=body)
        d.rectangle([x0, 12, x0 + 6, 13], fill=dark)
        d.line([(x0 + 1, 3), (x0 + 1, 9)], fill=light)
        d.line([(x0, 5), (x0 + 4, 5)], fill=dark)
    return outlined(img)


def ring(gem, band=GOLD):
    img, d = canvas()
    d.ellipse([3, 5, 12, 14], outline=band, width=2)
    d.polygon([(8, 1), (11, 4), (8, 7), (5, 4)], fill=gem)
    d.line([(8, 2), (6, 4)], fill=WHITE)
    return outlined(img)


def amulet(gem, chain=GOLD):
    img, d = canvas()
    d.line([(3, 1), (8, 8)], fill=chain)
    d.line([(13, 1), (8, 8)], fill=chain)
    d.polygon([(8, 7), (12, 10), (8, 15), (4, 10)], fill=gem)
    d.line([(8, 8), (6, 10)], fill=WHITE)
    return outlined(img)


def progress_icons(base):
    out = {
        "coal": coal(), "hide": hide(), "mithril_ore": mithril_ore(), "struct_anvil": anvil(),
        "steel_ingot": recolor(base["iron_ingot"], STEEL_MAP), "mithril_ingot": recolor(base["iron_ingot"], MITHRIL_MAP),
        "axe_steel": recolor(base["axe_iron"], STEEL_MAP), "axe_mithril": recolor(base["axe_iron"], MITHRIL_MAP),
        "pickaxe_steel": recolor(base["pickaxe_iron"], STEEL_MAP), "pickaxe_mithril": recolor(base["pickaxe_iron"], MITHRIL_MAP),
        "sword_steel": recolor(base["sword_iron"], STEEL_MAP), "sword_mithril": recolor(base["sword_iron"], MITHRIL_MAP),
        "spear_steel": recolor(base["spear_iron"], STEEL_MAP),
        "armor_steel": recolor(base["armor_iron"], STEEL_MAP), "armor_mithril": recolor(base["armor_iron"], MITHRIL_MAP),
        "armor_leather": recolor(base["armor_iron"], {IRON_L: LEATHER, IRON_D: LEATHER_D, PURE_WHITE: LEATHER_L}),
        "cap_leather": helm(LEATHER, LEATHER_D, LEATHER_L, nasal=False),
        "helm_iron": helm(IRON_L, IRON_D, PURE_WHITE),
        "helm_steel": helm(STEEL_L, STEEL_D, PURE_WHITE),
        "helm_crystal": helm(CRYSTAL, CRYSTAL_D, CRYSTAL_L),
        "helm_mithril": helm(MITHRIL_L, MITHRIL_D, PURE_WHITE),
        "boots_leather": boots(LEATHER, LEATHER_D, LEATHER_L),
        "boots_iron": boots(IRON_L, IRON_D, PURE_WHITE),
        "boots_steel": boots(STEEL_L, STEEL_D, PURE_WHITE),
        "boots_mithril": boots(MITHRIL_L, MITHRIL_D, PURE_WHITE),
        "ring_might": ring(RED),
        "ring_swift": ring(CRYSTAL_L),
        "amulet_vigor": amulet((120, 220, 120, 255)),
        "amulet_fortune": amulet(GOLD, (200, 200, 220, 255)),
        "amulet_warmth": amulet((255, 150, 60, 255)),
    }
    return out
