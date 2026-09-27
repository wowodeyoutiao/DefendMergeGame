"""生成装备图标品质对照图，便于策划检查 6 部位 x 7 品质 x 职业 的图标是否齐全、品质是否可辨。

用法：
    python tools/build_equipment_sheet.py

输入：public/assets/equipment/*.png（由 tools/import-equipment-icons.mjs 生成）
输出：asset-contact-sheets/equipment-qualities.jpg
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ICON_DIR = ROOT / "public" / "assets" / "equipment"
OUT_PATH = ROOT / "asset-contact-sheets" / "equipment-qualities.jpg"

QUALITY_HEADERS = ["1 白 粗制", "2 绿 精良", "3 蓝 秘银", "4 紫 星辉", "5 橙 龙魂", "6 红 神威", "7 金 天命"]
QUALITY_DOTS = ["#d8dedc", "#70bd78", "#69a9df", "#aa7bd0", "#e49a4a", "#dc5c63", "#e8c45d"]

GROUPS = [
    ("武器 · 按职业区分", [("男战士", "weapon-warrior"), ("男法师", "weapon-mage"), ("女祭司", "weapon-priest")]),
    ("衣服 · 按职业区分", [("男战士", "armor-warrior"), ("男法师", "armor-mage"), ("女祭司", "armor-priest")]),
    ("通用部位 · 全职业共用", [("头盔", "helmet"), ("项链", "necklace"), ("戒指", "ring"), ("靴子", "boots")]),
]

BG = "#f7f2e6"
PANEL = "#fffdf7"
INK = "#3d2b1f"
MUTED = "#8a7a68"
BORDER = "#e2d6c0"

CELL_W, CELL_H = 158, 174
ICON = 132
LABEL_W = 150
HEADER_H = 54
TITLE_H = 104
GROUP_GAP = 40
GROUP_TITLE_H = 40


def load_font(size, bold=False):
    candidates = [
        "C:/Windows/Fonts/msyhbd.ttc" if bold else "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/simhei.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def main():
    rows = [(title, label, prefix) for title, entries in GROUPS for label, prefix in entries]
    width = LABEL_W + CELL_W * len(QUALITY_HEADERS)
    height = TITLE_H + HEADER_H + len(rows) * CELL_H + len(GROUPS) * (GROUP_TITLE_H + GROUP_GAP)

    canvas = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(canvas)

    f_title = load_font(36, bold=True)
    f_sub = load_font(20)
    f_group = load_font(24, bold=True)
    f_head = load_font(19)
    f_label = load_font(22)
    f_cell = load_font(17)

    draw.text((LABEL_W, 30), "合战守格 · 装备图标总览", font=f_title, fill=INK)
    draw.text((LABEL_W, 72), f"6 部位 x 7 品质，武器与衣服再分 3 职业，共 {len(rows) * 7} 张（源：art/Icon）", font=f_sub, fill=MUTED)

    missing = []
    y = TITLE_H

    for title, entries in GROUPS:
        draw.text((LABEL_W, y + 6), title, font=f_group, fill=INK)
        y += GROUP_TITLE_H

        head_y = y
        x = LABEL_W
        for index, header in enumerate(QUALITY_HEADERS):
            draw.rounded_rectangle([x + 6, head_y + 6, x + CELL_W - 6, head_y + HEADER_H - 4], radius=8, fill=PANEL, outline=BORDER)
            draw.ellipse([x + 16, head_y + 22, x + 32, head_y + 38], fill=QUALITY_DOTS[index], outline=BORDER)
            draw.text((x + 40, head_y + 19), header, font=f_head, fill=INK)
            x += CELL_W
        y += HEADER_H

        for label, prefix in entries:
            draw.rounded_rectangle([6, y + 12, LABEL_W - 12, y + CELL_H - 14], radius=10, fill=PANEL, outline=BORDER)
            box = draw.textbbox((0, 0), label, font=f_label)
            draw.text(
                ((LABEL_W - 18 - (box[2] - box[0])) / 2 + 6, y + CELL_H / 2 - (box[3] - box[1]) / 2 - box[1]),
                label,
                font=f_label,
                fill=INK,
            )

            for index in range(len(QUALITY_HEADERS)):
                cell_x = LABEL_W + index * CELL_W
                draw.rounded_rectangle(
                    [cell_x + 6, y + 6, cell_x + CELL_W - 6, y + CELL_H - 6],
                    radius=10,
                    fill=PANEL,
                    outline=BORDER,
                )
                name = f"{prefix}-{index + 1}.png"
                path = ICON_DIR / name
                if not path.exists():
                    missing.append(name)
                    draw.text((cell_x + 30, y + CELL_H / 2), "缺失", font=f_cell, fill="#c0392b")
                    continue
                icon = Image.open(path).convert("RGBA").resize((ICON, ICON), Image.LANCZOS)
                canvas.paste(icon, (cell_x + (CELL_W - ICON) // 2, y + 12), icon)
                tag = name[:-4]
                box = draw.textbbox((0, 0), tag, font=f_cell)
                draw.text(
                    (cell_x + (CELL_W - (box[2] - box[0])) / 2, y + CELL_H - 32),
                    tag,
                    font=f_cell,
                    fill=MUTED,
                )
            y += CELL_H
        y += GROUP_GAP

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT_PATH, quality=88, optimize=True)

    print(f"输出：{OUT_PATH.relative_to(ROOT)}")
    print(f"尺寸：{canvas.width} x {canvas.height}")
    print(f"图标格：{len(rows) * 7} 个，缺失 {len(missing)} 个")
    if missing:
        print("缺失清单：" + "、".join(missing))


if __name__ == "__main__":
    main()
