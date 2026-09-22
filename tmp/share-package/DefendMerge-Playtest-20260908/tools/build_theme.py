from pathlib import Path
import colorsys
import shutil
from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
ART = Path(r"D:\wly\wly\wly\trunk\art\UI切图")
OUT = ROOT / "public/assets/ui/theme"
OUT.mkdir(parents=True, exist_ok=True)

FILES = {
    "button-blue.png": "通用/Hall_btn_jiugong.png",
    "button-gold.png": "通用/Hall_btn_jiugong2.png",
    "button-green.png": "通用/Hall_btn_jiugong3.png",
    "button-coral.png": "通用/Hall_btn_jiugong.png",
    "panel-paper.png": "通用/bg_2.png",
    "ribbon.png": "主界面/旧/bg_zhujuexinxi.png",
    "tile.png": "主界面/旧/bg_caowei1.png",
    "frame-gold.png": "主界面/旧/bg_16.png",
    "star.png": "通用/img_xingxing.png",
    "back.png": "通用/btn_common_fh.PNG",
    "close.png": "通用/btn_common_x.PNG",
    "buff-frost.png": "icon Buff/jiansu.png",
    "buff-thunder.png": "icon Buff/baofa.png",
    "buff-war-cry.png": "icon Buff/gongfangtisheng.png",
    "buff-rapid-fire.png": "icon Buff/gongsuyisu.png",
    "buff-crossfire.png": "icon Buff/zhuanzhu.png",
    "buff-execution.png": "icon Buff/pojia.png",
}
for name, source in FILES.items():
    shutil.copy2(ART / source, OUT / name)


def jade(image, strength=0.8):
    picture = image.convert("RGBA")
    pixels = []
    for red, green, blue, alpha in picture.getdata():
        hue, saturation, value = colorsys.rgb_to_hsv(red / 255, green / 255, blue / 255)
        if 0.035 < hue < 0.19 and saturation > 0.12:
            target = colorsys.hsv_to_rgb(0.40, saturation * 0.57, min(1, value * 1.05))
            pixels.append(tuple(round(channel * (1 - strength) + tint * 255 * strength) for channel, tint in zip((red, green, blue), target)) + (alpha,))
        else:
            pixels.append((red, green, blue, alpha))
    picture.putdata(pixels)
    return picture


foreground = jade(Image.open(ROOT / "public/assets/scene-1.png"), 0.72)
foreground.save(OUT / "lobby-cliffs.png")
battle = jade(Image.open(ROOT / "public/assets/battle-bg.png"), 0.8)
battle.save(OUT / "battle-jade.png", optimize=True)
tile = Image.open(OUT / "tile.png").convert("RGBA")
tile = jade(tile, 0.92)
tile = ImageEnhance.Brightness(tile).enhance(1.35)
tile.save(OUT / "tile-jade.png")
button = Image.open(OUT / "button-coral.png").convert("RGBA")
hue, saturation, value = button.convert("RGB").convert("HSV").split()
hue = hue.point(lambda channel: 5)
saturation = saturation.point(lambda channel: round(channel * 0.77))
coral = Image.merge("HSV", (hue, saturation, value)).convert("RGBA")
coral.putalpha(button.getchannel("A"))
coral.save(OUT / "button-coral.png")
print(f"Prepared {len(FILES) + 3} theme assets in {OUT}")
