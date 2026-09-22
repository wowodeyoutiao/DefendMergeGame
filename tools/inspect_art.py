from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ART = Path(r"D:\wly\wly\wly\trunk\art\UI切图")
OUT = ROOT / "tmp" / "art-review"
OUT.mkdir(parents=True, exist_ok=True)
font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 12)


def sheet(paths, name, width=170, height=150, columns=6):
    canvas = Image.new("RGB", (width * columns, height * ((len(paths) + columns - 1) // columns)), "#dde8e2")
    draw = ImageDraw.Draw(canvas)
    for index, path in enumerate(paths):
        picture = Image.open(path).convert("RGBA")
        picture.thumbnail((width - 12, height - 38))
        left = (index % columns) * width
        top = (index // columns) * height
        canvas.paste(picture, (left + (width - picture.width) // 2, top + 3), picture)
        draw.text((left + 4, top + height - 32), path.name, font=font, fill="#203e3c")
    canvas.save(OUT / name)


sheet(list((ART / "通用").glob("*.png")) + list((ART / "通用").glob("*.PNG")), "controls.jpg")
sheet(list((ART / "主界面" / "旧").glob("bg_*.png")), "lobby-art.jpg", 200, 250, 5)
sheet(list((ART / "主界面战斗地图拆分").glob("*.png")), "maps.jpg", 150, 280, 6)
sheet(list((ART / "icon Buff").glob("*.png")), "buffs.jpg", 130, 125, 6)
sheet(list((ART / "icon道具").glob("*.png"))[:120], "items.jpg", 120, 120, 8)
print(OUT)
