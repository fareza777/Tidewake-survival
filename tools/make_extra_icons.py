"""Icons for the later recipes: dishes, potions, armour, weapons and furniture (16x16, shared kit in icon_kit.py)."""
from icon_kit import (
    BROWN, BROWN_D, CRYSTAL, CRYSTAL_D, CRYSTAL_L, FIBER, FIBER_D, FLAME, FLAME_D, FLAME_L, GOLD, IRON, IRON_D, IRON_L, PAPER, RED,
    ROPE, ROPE_D, STONE, STONE_D, STONE_L, WHITE, WOOD, WOOD_D, WOOD_L, canvas, handle, outlined,
)
from make_armor_icons import breastplate

GLASS = (170, 226, 214, 255)
CORK = (196, 150, 96, 255)
BOWL = (200, 170, 130, 255)
BOWL_D = (140, 104, 72, 255)
ORANGE = (230, 130, 50, 255)
GREEN = (96, 176, 96, 255)
GREEN_D = (56, 120, 70, 255)
PINK = (230, 100, 140, 255)
PURPLE = (150, 90, 200, 255)
YELLOW = (240, 214, 90, 255)
MEAT = (176, 80, 60, 255)
MEAT_D = (120, 48, 40, 255)


def bowl(fill, fill_l, dots=()):
    img, d = canvas()
    d.ellipse([2, 6, 14, 15], fill=BOWL)
    d.rectangle([2, 6, 14, 9], fill=BOWL)
    d.ellipse([3, 4, 13, 9], fill=fill)
    d.line([(4, 6), (11, 6)], fill=fill_l)
    for x, y, c in dots:
        d.point([x, y], fill=c)
    d.line([(4, 13), (12, 13)], fill=BOWL_D)
    return outlined(img)


def veggie_stew():
    return bowl(ORANGE, YELLOW, [(6, 5, GREEN), (9, 5, WHITE), (8, 7, GREEN)])


def fish_stew():
    return bowl((190, 150, 100, 255), YELLOW, [(6, 5, (110, 160, 190, 255)), (9, 6, WHITE)])


def jar(fill, light):
    img, d = canvas()
    d.rectangle([4, 5, 11, 14], fill=GLASS)
    d.rectangle([5, 3, 10, 5], fill=CORK)
    d.rectangle([5, 7, 10, 13], fill=fill)
    d.line([(5, 7), (10, 7)], fill=light)
    d.point([5, 6], fill=WHITE)
    return outlined(img)


def berry_jam():
    return jar(PURPLE, (190, 140, 230, 255))


def smoked_meat():
    img, d = canvas()
    d.ellipse([2, 4, 13, 13], fill=MEAT)
    d.ellipse([3, 5, 9, 9], fill=(210, 110, 90, 255))
    d.line([(4, 12), (11, 12)], fill=MEAT_D)
    d.rectangle([11, 2, 14, 6], fill=PAPER)
    d.line([(12, 6), (12, 13)], fill=WOOD_D)
    return outlined(img)


def roasted_turnip():
    img, d = canvas()
    d.ellipse([3, 6, 12, 14], fill=(200, 160, 120, 255))
    d.ellipse([3, 6, 12, 10], fill=(220, 120, 160, 255))
    d.line([(7, 6), (5, 2)], fill=GREEN, width=1)
    d.line([(8, 6), (10, 2)], fill=GREEN_D, width=1)
    d.point([6, 12], fill=BROWN_D)
    return outlined(img)


def pumpkin_pie():
    img, d = canvas()
    d.ellipse([1, 6, 14, 14], fill=(210, 150, 80, 255))
    d.ellipse([2, 5, 13, 11], fill=ORANGE)
    d.ellipse([5, 6, 10, 9], fill=(240, 170, 80, 255))
    d.line([(3, 9), (12, 9)], fill=(190, 110, 50, 255))
    d.point([8, 5], fill=GREEN_D)
    return outlined(img)


def sweet_drink():
    img, d = canvas()
    d.ellipse([2, 3, 13, 14], fill=(150, 100, 70, 255))
    d.ellipse([3, 4, 12, 9], fill=WHITE)
    d.line([(8, 1), (10, 6)], fill=RED, width=1)
    d.rectangle([5, 9, 10, 12], fill=(190, 140, 100, 255))
    return outlined(img)


def potion(liquid, light, big=False):
    img, d = canvas()
    d.ellipse([3, 5, 12, 14] if not big else [2, 4, 13, 14], fill=GLASS)
    d.rectangle([6, 2, 9, 6], fill=GLASS)
    d.rectangle([5, 1, 10, 2], fill=CORK)
    d.ellipse([4, 8, 11, 13] if not big else [3, 7, 12, 13], fill=liquid)
    d.line([(5, 9), (10, 9)], fill=light)
    d.point([5, 7], fill=WHITE)
    if big:
        d.point([13, 3], fill=GOLD)
        d.point([2, 3], fill=GOLD)
    return outlined(img)


def healing_potion():
    return potion(RED, (240, 140, 140, 255))


def great_healing_potion():
    return potion((230, 60, 110, 255), (255, 150, 190, 255), big=True)


def stamina_tonic():
    return potion(GREEN, (170, 230, 150, 255))


def armor_wood():
    img, d = breastplate(WOOD, WOOD_D, WOOD_L)
    d.line([(6, 8), (10, 8)], fill=ROPE)
    d.line([(6, 11), (10, 11)], fill=ROPE)
    return outlined(img)


def armor_crystal():
    img, d = breastplate(CRYSTAL, CRYSTAL_D, CRYSTAL_L)
    d.polygon([(8, 7), (10, 9), (8, 12), (6, 9)], fill=CRYSTAL_L)
    return outlined(img)


def spear(head, head_l, length=1):
    img, d = canvas()
    d.line([(2, 14), (11, 5)], fill=WOOD, width=2)
    d.line([(3, 14), (12, 5)], fill=WOOD_D)
    d.polygon([(10, 7), (14, 1), (15, 5)], fill=head)
    d.line([(11, 6), (14, 2)], fill=head_l)
    return outlined(img)


def spear_wood():
    return spear(WOOD_L, (240, 200, 140, 255))


def spear_iron():
    return spear(IRON, IRON_L)


def bow_long():
    img, d = canvas()
    d.arc([2, 0, 14, 15], 270, 90, fill=WOOD, width=2)
    d.arc([3, 0, 15, 15], 270, 90, fill=WOOD_L, width=1)
    d.line([(8, 1), (8, 14)], fill=WHITE)
    d.line([(3, 8), (13, 8)], fill=ROPE)
    d.polygon([(13, 8), (11, 6), (11, 10)], fill=IRON)
    return outlined(img)


def sword_crystal():
    img, d = canvas()
    d.polygon([(13, 1), (14, 3), (6, 11), (4, 9)], fill=CRYSTAL)
    d.polygon([(13, 1), (14, 3), (11, 6), (10, 4)], fill=CRYSTAL_L)
    d.line([(6, 11), (4, 9)], fill=CRYSTAL_D)
    d.rectangle([2, 9, 7, 10], fill=GOLD)
    d.line([(4, 11), (2, 14)], fill=WOOD, width=2)
    return outlined(img)


def sign():
    img, d = canvas()
    d.rectangle([7, 8, 8, 15], fill=WOOD_D)
    d.rectangle([2, 2, 13, 8], fill=WOOD_L)
    d.rectangle([2, 8, 13, 8], fill=WOOD)
    d.line([(4, 4), (11, 4)], fill=WOOD_D)
    d.line([(4, 6), (9, 6)], fill=WOOD_D)
    return outlined(img)


def table():
    img, d = canvas()
    d.rectangle([1, 5, 14, 8], fill=WOOD_L)
    d.rectangle([1, 8, 14, 9], fill=WOOD_D)
    d.rectangle([2, 9, 3, 14], fill=WOOD)
    d.rectangle([12, 9, 13, 14], fill=WOOD)
    d.rectangle([6, 3, 9, 5], fill=PAPER)
    return outlined(img)


def stool():
    img, d = canvas()
    d.rectangle([3, 6, 12, 8], fill=WOOD_L)
    d.rectangle([3, 8, 12, 8], fill=WOOD_D)
    d.rectangle([4, 9, 5, 14], fill=WOOD)
    d.rectangle([10, 9, 11, 14], fill=WOOD)
    return outlined(img)


def lamp_post():
    img, d = canvas()
    d.rectangle([7, 6, 8, 15], fill=IRON_D)
    d.rectangle([5, 14, 10, 15], fill=IRON)
    d.rectangle([5, 2, 10, 7], fill=GLASS)
    d.rectangle([6, 3, 9, 6], fill=FLAME_L)
    d.rectangle([7, 4, 8, 5], fill=FLAME)
    d.rectangle([4, 1, 11, 2], fill=IRON)
    return outlined(img)


def barrel():
    img, d = canvas()
    d.ellipse([2, 2, 13, 14], fill=WOOD)
    d.rectangle([2, 5, 13, 11], fill=WOOD)
    d.line([(2, 5), (13, 5)], fill=IRON_D)
    d.line([(2, 11), (13, 11)], fill=IRON_D)
    d.line([(6, 3), (6, 13)], fill=WOOD_D)
    d.line([(10, 3), (10, 13)], fill=WOOD_D)
    d.ellipse([4, 2, 11, 5], fill=WOOD_L)
    return outlined(img)


def s_alchemy():
    img, d = canvas()
    d.rectangle([1, 8, 14, 10], fill=WOOD_L)
    d.rectangle([1, 10, 14, 11], fill=WOOD_D)
    d.rectangle([2, 11, 3, 15], fill=WOOD)
    d.rectangle([12, 11, 13, 15], fill=WOOD)
    d.ellipse([3, 3, 8, 9], fill=GLASS)
    d.rectangle([5, 1, 6, 4], fill=GLASS)
    d.ellipse([4, 5, 7, 8], fill=GREEN)
    d.ellipse([9, 5, 12, 9], fill=RED)
    d.point([6, 1], fill=WHITE)
    return outlined(img)


def salve():
    return jar(GREEN, (170, 230, 150, 255))


def extra_icons():
    return {
        "salve": salve(),
        "veggie_stew": veggie_stew(), "fish_stew": fish_stew(), "berry_jam": berry_jam(), "smoked_meat": smoked_meat(),
        "roasted_turnip": roasted_turnip(), "pumpkin_pie": pumpkin_pie(), "sweet_drink": sweet_drink(),
        "healing_potion": healing_potion(), "great_healing_potion": great_healing_potion(), "stamina_tonic": stamina_tonic(),
        "armor_wood": armor_wood(), "armor_crystal": armor_crystal(),
        "spear_wood": spear_wood(), "spear_iron": spear_iron(), "bow_long": bow_long(), "sword_crystal": sword_crystal(),
        "struct_sign": sign(), "struct_table": table(), "struct_stool": stool(), "struct_lamp_post": lamp_post(),
        "struct_barrel": barrel(), "struct_alchemy": s_alchemy(),
    }
