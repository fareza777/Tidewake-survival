"""Copy the sprites this game uses from the read-only asset master and pack them into trimmed texture atlases.

Source: E:/Pixel Games Asset Master/Assets/Gif/Super_Retro_Collection/Resources (never modified).
Output: public/assets/pack/*.png + *.json (Phaser JSON-hash atlases) and single images/tilesets.

Frame naming: "<prefix>/<anim>/<dir>/<index>" e.g. "hero1/walk/down/0".
Sheets that use the RPG-Maker layout (3 columns x 4 rows) have rows ordered down, left, right, up.
"""
import json
import shutil
from pathlib import Path
from PIL import Image

SRC = Path("E:/Pixel Games Asset Master/Assets/Gif/Super_Retro_Collection/Resources")
OUT = Path(__file__).resolve().parent.parent / "public" / "assets" / "pack"
DIRS4 = ["down", "left", "right", "up"]
DIR_FILE = {"down": "DOWN", "left": "LEFT", "right": "RIGHT", "up": "UP"}
MAX_W = 2048


class Atlas:
    def __init__(self, name):
        self.name = name
        self.frames = []  # (name, image)

    def add(self, name, img):
        self.frames.append((name, img))

    def add_strip(self, prefix, path, fw, fh, count=None):
        im = Image.open(path).convert("RGBA")
        n = count if count is not None else im.width // fw
        for i in range(n):
            self.add(f"{prefix}/{i}", im.crop((i * fw, 0, (i + 1) * fw, fh)))

    def add_grid_dirs(self, prefix, path, fw, fh, cols=3, ox=0, oy=0):
        """3x4 RPG-Maker block: rows = down, left, right, up."""
        im = Image.open(path).convert("RGBA")
        for r, d in enumerate(DIRS4):
            for c in range(cols):
                x, y = ox + c * fw, oy + r * fh
                self.add(f"{prefix}/{d}/{c}", im.crop((x, y, x + fw, y + fh)))

    def add_image(self, name, path):
        self.add(name, Image.open(path).convert("RGBA"))

    def save(self):
        packed = []
        for name, img in self.frames:
            bbox = img.getbbox()
            if bbox is None:
                bbox = (0, 0, 1, 1)
            trimmed = img.crop(bbox)
            packed.append((name, img, trimmed, bbox))
        packed.sort(key=lambda p: (-p[2].height, -p[2].width))
        x = y = 0
        shelf_h = 0
        places = {}
        for name, _img, t, _bb in packed:
            if x + t.width + 2 > MAX_W:
                x = 0
                y += shelf_h + 2
                shelf_h = 0
            places[name] = (x + 1, y + 1)
            x += t.width + 2
            shelf_h = max(shelf_h, t.height)
        height = y + shelf_h + 2
        h = 64
        while h < height:
            h *= 2
        width = MAX_W
        if height <= 64 and x < 1024:
            width = 1024
        sheet = Image.new("RGBA", (width, h), (0, 0, 0, 0))
        frames = {}
        for name, img, t, bb in packed:
            px, py = places[name]
            sheet.paste(t, (px, py))
            frames[name] = {
                "frame": {"x": px, "y": py, "w": t.width, "h": t.height},
                "rotated": False,
                "trimmed": True,
                "spriteSourceSize": {"x": bb[0], "y": bb[1], "w": t.width, "h": t.height},
                "sourceSize": {"w": img.width, "h": img.height},
            }
        OUT.mkdir(parents=True, exist_ok=True)
        sheet.save(OUT / f"{self.name}.png", optimize=True)
        meta = {"image": f"{self.name}.png", "size": {"w": width, "h": h}, "scale": "1"}
        (OUT / f"{self.name}.json").write_text(json.dumps({"frames": frames, "meta": meta}), encoding="utf-8")
        print(f"atlas {self.name}: {len(frames)} frames -> {width}x{h}")


HERO_ANIMS = {
    # anim: (frame w, frame h, directional)
    "idle": (32, 32, True), "breath_idle": (32, 32, True), "walk": (32, 32, True), "run": (32, 32, True),
    "attack": (64, 64, True), "bow": (32, 32, True), "throw": (32, 32, True), "hit": (32, 32, True),
    "shield_walk": (32, 32, True), "shield_block": (32, 32, True), "lift": (32, 32, True),
    "carry_idle": (32, 32, True), "carry_run": (32, 32, True),
    "spin": (32, 32, False), "death": (32, 32, False), "dead": (32, 32, False),
}
PLAYABLE_ARPG = [1, 6, 17, 11]  # Sera, Kaito, Elio, spare
ARPG_ATTACKS = ["sword01", "sword02", "sword03", "spear01", "spear02", "staff01", "staff02", "staff03",
                "staff04", "staff05", "staff06", "slash01"]


def build_heroes():
    a = Atlas("heroes")
    for c in range(1, 6):
        base = SRC / "Hero" / "hero" / f"color_{c}"
        for anim, (fw, fh, directional) in HERO_ANIMS.items():
            if directional:
                for d in DIRS4:
                    a.add_strip(f"hero{c}/{anim}/{d}", base / anim / f"hero_{anim}_{DIR_FILE[d]}.png", fw, fh)
            else:
                a.add_strip(f"hero{c}/{anim}", base / anim / f"hero_{anim}.png", fw, fh)
    for ch in PLAYABLE_ARPG:
        base = SRC / "ARPG" / f"character_{ch}"
        for atk in ARPG_ATTACKS:
            a.add_grid_dirs(f"arpg{ch}/{atk}", base / f"srw_arpg_{atk}_0.png", 32, 32)
    a.save()


def build_actors():
    a = Atlas("actors")
    atlas32 = SRC / "Characters" / "Characters" / "atlas_frame32x32.png"
    for i in range(32):
        a.add_grid_dirs(f"arpg{i}/walk", atlas32, 32, 32, ox=(i % 8) * 96, oy=(i // 8) * 128)
    for i in range(32):
        a.add_grid_dirs(f"npc{i}/walk", SRC / "Characters" / "Characters" / f"chara_{i}.png", 16, 20)
    animals = {
        "cat1": "cats/cat1_16x20.png", "cat2": "cats/cat2_16x20.png", "cat3": "cats/cat3_16x20.png",
        "cat4": "cats/cat4_16x20.png", "fox1": "foxes/fox1_16x20.png", "fox2": "foxes/fox2_16x20.png",
        "bird1": "birds/bird1_16x20.png", "bird2": "birds/bird2_16x20.png", "bird3": "birds/bird3_16x20.png",
        "bunny1": "rabbits/bunny1_16x20.png", "bunny2": "rabbits/bunny2_16x20.png",
        "mouse1": "mouses/mouse1_16x20.png",
    }
    for key, rel in animals.items():
        a.add_grid_dirs(f"{key}/walk", SRC / "Characters" / "Animals" / rel, 16, 20)
    for p in range(1, 4):
        for d in DIRS4:
            a.add_strip(f"pig{p}/move/{d}",
                        SRC / "Characters" / "Animals" / "pigs" / f"pig_0{p}" / "move" / f"pig_0{p}_move_{d}_32x32_4frames.png",
                        32, 32)
    for anim in ["idle", "idle_bounce", "hit", "shield_idle", "shield_block"]:
        for d in DIRS4:
            a.add_strip(f"dummy/{anim}/{d}", SRC / "Hero" / "dummy" / anim / f"dummy_{anim}_{DIR_FILE[d]}.png", 32, 32)
    for anim in ["idle", "shot", "stuck"]:
        for d in DIRS4:
            a.add_strip(f"arrow/{anim}/{d}", SRC / "Hero" / "arrow" / anim / f"arrow_{anim}_{DIR_FILE[d]}.png", 32, 32)
    farm = SRC / "Characters" / "Farm"
    a.add_grid_dirs("farmer/water", farm / "farm_watering_01_32x32.png", 32, 32)
    a.add_grid_dirs("farmer/hoe", farm / "farm_hoe_01_32x32.png", 32, 32)
    a.add_grid_dirs("farmer/walk", farm / "farm_walk_01_32x32.png", 32, 32)
    a.save()


def build_monsters():
    a = Atlas("monsters")
    mdir = SRC / "Characters" / "Monsters"
    for f in sorted(mdir.glob("*.png")):
        key = f.stem.replace("Additional_bonus_Monsters_front_anim_only", "bonus").replace("Monsters_", "m")
        a.add_grid_dirs(key, f, 48, 48)
    a.save()


def build_battlers():
    a = Atlas("battlers")
    for f in sorted((SRC / "Battlers").glob("*.png")):
        a.add_image(f"b/{f.stem}", f)
    a.save()


def build_props():
    a = Atlas("props")
    pre = SRC / "Prefabs"
    for cat in ["Barrels", "Books", "Columns", "Crates", "Houses", "Lamps", "Pots", "Potted plants", "Rocks",
                "Statues", "Torii", "Trees"]:
        for f in sorted((pre / cat / "Sprites").glob("*.png")):
            a.add_image(f"p/{f.stem.lower()}", f)
    for f in sorted((pre / "Torches" / "Sprites").glob("*.png")):
        a.add_strip(f"torch/{f.stem.lower()}", f, 16, 32)
    for f in sorted((pre / "Fires" / "Sprites").glob("*.png")):
        im = Image.open(f)
        if im.width >= 48 and im.height == 32:
            # Every fire sheet is a strip of 16x32 cells (the camp fires too: 3 frames, not one 48px picture).
            a.add_strip(f"fire/{f.stem.lower()}", f, 16, 32)
        else:
            a.add_image(f"p/{f.stem.lower()}", f)
    anim = SRC / "Animations"
    for f in sorted((anim / "Chest").glob("*.png")):
        a.add_strip(f"chest/{f.stem.split('_16')[0]}", f, 18, 32)
    for f in sorted((anim / "Cristal").glob("*.png")):
        a.add_strip(f"crystal/{f.stem.split('_16')[0]}", f, 16, 32)
    for f in sorted((anim / "Lamp").glob("*.png")):
        a.add_strip(f"lamp/{f.stem.split('_16')[0]}", f, 16, 32)
    for f in sorted((anim / "Trap").glob("*.png")):
        a.add_strip(f"trap/{f.stem.split('_16')[0]}", f, 16, 32 if "trap_1" in f.stem else 16)
    for f in sorted((anim / "Switch").glob("*.png")):
        a.add_grid_dirs(f"switch/{f.stem.split('_16')[0]}", f, 16, 16)
    for f in sorted((anim / "Lava").glob("*.png")):
        a.add_strip(f"lava/{f.stem.split('_16')[0]}", f, 16, 32 if "effect" in f.stem else 16)
    for f in sorted((anim / "Water").glob("*.png")):
        if "48x48" in f.stem:
            a.add_strip("water/big", f, 48, 48)
        else:
            a.add_strip(f"water/{f.stem.split('_16')[0]}", f, 16, 32 if "effect" in f.stem else 16)
    # campfire_16x32.png: rows = unlit logs, lighting, burning, smoke; 3 cells of 16x32 per row.
    im = Image.open(anim / "Fire" / "campfire_16x32.png").convert("RGBA")
    for row, name in enumerate(["campfire_unlit", "campfire_lighting", "campfire_burning", "campfire_smoke"]):
        for i in range(3):
            a.add(f"fire/{name}/{i}", im.crop((i * 16, row * 32, (i + 1) * 16, (row + 1) * 32)))
    for f in sorted((anim / "Door").glob("*.png")):
        im = Image.open(f).convert("RGBA")
        stem = f.stem.replace(" 1", "_v").split("_16")[0]
        if im.width == 16:
            for i in range(4):
                a.add(f"door/{stem}/{i}", im.crop((0, i * 16, 16, (i + 1) * 16)))
        else:
            for i in range(4):
                a.add(f"door/{stem}_h/{i}", im.crop((i * 16, 0, (i + 1) * 16, 16)))
    for idx in (1, 2):
        im = Image.open(anim / "Farm" / f"farm_icons_{idx}_16x16.png").convert("RGBA")
        n = 0
        for r in range(im.height // 16):
            for c in range(im.width // 16):
                tile = im.crop((c * 16, r * 16, (c + 1) * 16, (r + 1) * 16))
                if tile.getbbox():
                    a.add(f"farmicon{idx}/{n}", tile)
                n += 1
    for i in range(0, 21):
        f = anim / "Farm" / f"farm_plant_{i:02d}_18x32.png"
        if f.exists():
            a.add_strip(f"plant/{i}", f, 18, 32)
    tg = SRC / "Prefabs_with_behavior" / "tall_grass_react_on_contact" / "Sprites"
    a.add_strip("tallgrass/back", tg / "tallgrass_01_back.png", 16, 16)
    a.add_strip("tallgrass/front", tg / "tallgrass_01_front.png", 16, 16)
    a.save()


def copy_singles():
    (OUT / "bg").mkdir(parents=True, exist_ok=True)
    for f in sorted((SRC / "Backgrounds").glob("*.png")):
        shutil.copy(f, OUT / "bg" / f.name)
    env = SRC / "Environments"
    # Tiles are packed by tools/pack_tiles.py (only the ones the game uses); the full tilesets are not shipped.
    print("copied backgrounds")


if __name__ == "__main__":
    build_heroes()
    build_actors()
    build_props()
