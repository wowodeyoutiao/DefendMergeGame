import argparse
import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageSequence


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public" / "assets" / "warriors"
SOURCE_ROOT = ASSETS / "sources"
OUTPUT_ROOT = ASSETS / "quality"
QUALITIES = ["\u767d\u8272", "\u7eff\u8272", "\u84dd\u8272", "\u7d2b\u8272", "\u6a59\u8272", "\u7ea2\u8272"]
ROLES = {"warrior": "\u7537\u6218\u58eb", "mage": "\u7537\u6cd5\u5e08", "priest": "\u5973\u796d"}
CANVAS = (320, 320)


def import_sources(source):
    for quality, prefix in enumerate(QUALITIES, 1):
        for role, token in ROLES.items():
            folders = [folder for folder in source.iterdir() if folder.is_dir() and folder.name.startswith(prefix) and token in folder.name]
            if len(folders) != 1:
                raise ValueError(f"Expected one folder for {quality}/{role}: {folders}")
            folder = folders[0]
            target = SOURCE_ROOT / role / str(quality)
            target.mkdir(parents=True, exist_ok=True)
            sources = {}
            for action, suffix in [("idle", "stand"), ("attack", "attack")]:
                matches = list((folder / "GIF").glob(f"*_{suffix}.gif"))
                if len(matches) != 1:
                    raise ValueError(f"Missing or ambiguous {action}: {folder}")
                shutil.copy2(matches[0], target / f"{action}.gif")
                sources[action] = matches[0].relative_to(source).as_posix()
            for original in folder.glob("*.spine"):
                shutil.copy2(original, target / original.name)
            for subfolder in ["images", "\u4e8c\u8fdb\u5236"]:
                shutil.copytree(folder / subfolder, target / ("images" if subfolder == "images" else "spine-export"), dirs_exist_ok=True)
            (target / "source.json").write_text(json.dumps(sources, indent=2, ensure_ascii=False), encoding="utf-8")


def remove_background(frame):
    pixels = np.asarray(frame.convert("RGB")).astype(np.int16)
    border = np.concatenate([pixels[0], pixels[-1], pixels[:, 0], pixels[:, -1]])
    background = np.median(border, axis=0)
    difference = np.max(np.abs(pixels - background), axis=2)
    candidates = Image.fromarray(np.uint8(difference <= 15) * 255)
    padded = ImageOps.expand(candidates, border=1, fill=255)
    ImageDraw.floodfill(padded, (0, 0), 128)
    cleared = np.asarray(padded)[1:-1, 1:-1] == 128
    alpha = np.where(cleared, 0, 255).astype(np.uint8)
    result = frame.convert("RGBA")
    result.putalpha(Image.fromarray(alpha))
    return result


def read_action(path):
    frames = []
    durations = []
    with Image.open(path) as source:
        for frame in ImageSequence.Iterator(source):
            frames.append(remove_background(frame))
            durations.append(frame.info.get("duration", 40))
    first_box = frames[0].getbbox()
    anchor = ((first_box[0] + first_box[2]) / 2, first_box[3])
    return {"frames": frames, "durations": durations, "anchor": anchor}


def build_model(role, quality):
    source = SOURCE_ROOT / role / str(quality)
    target = OUTPUT_ROOT / role / str(quality)
    target.mkdir(parents=True, exist_ok=True)
    actions = {action: read_action(source / f"{action}.gif") for action in ["idle", "attack"]}
    bounds = []
    for action in actions.values():
        anchor_x, anchor_y = action["anchor"]
        for frame in action["frames"]:
            left, top, right, bottom = frame.getbbox()
            bounds.append((left - anchor_x, top - anchor_y, right - anchor_x, bottom - anchor_y))
    extent = (min(box[0] for box in bounds), min(box[1] for box in bounds), max(box[2] for box in bounds), max(box[3] for box in bounds))
    scale = min((CANVAS[0] - 16) / (extent[2] - extent[0]), (CANVAS[1] - 16) / (extent[3] - extent[1]))
    origin = (CANVAS[0] / 2 - (extent[0] + extent[2]) * scale / 2, CANVAS[1] - 8 - extent[3] * scale)
    metadata = {}
    poster = None
    for name, action in actions.items():
        frames = []
        durations = []
        for index in range(0, len(action["frames"]), 2):
            frame = action["frames"][index]
            resized = frame.resize((round(frame.width * scale), round(frame.height * scale)), Image.Resampling.LANCZOS)
            output = Image.new("RGBA", CANVAS)
            position = (round(origin[0] - action["anchor"][0] * scale), round(origin[1] - action["anchor"][1] * scale))
            output.alpha_composite(resized, position)
            frames.append(output)
            durations.append(sum(action["durations"][index:index + 2]))
        if name == "attack":
            total = sum(durations)
            durations = [max(10, round(duration / total * 450)) for duration in durations]
        frames[0].save(target / f"{name}.webp", save_all=True, append_images=frames[1:], duration=durations, loop=0, quality=88, method=4)
        metadata[name] = {"frames": len(frames), "durationMs": sum(durations)}
        if name == "idle":
            poster = frames[0]
            poster.save(target / "portrait.png")
            preview_box = (min(frame.getbbox()[0] for frame in frames), min(frame.getbbox()[1] for frame in frames), max(frame.getbbox()[2] for frame in frames), max(frame.getbbox()[3] for frame in frames))
            preview_frames = [ImageOps.expand(frame.crop(preview_box), border=4) for frame in frames]
            preview_frames[0].save(target / "preview.webp", save_all=True, append_images=preview_frames[1:], duration=durations, loop=0, quality=88, method=4)
            metadata["idle"]["bounds"] = preview_box
    metadata["source"] = json.loads((source / "source.json").read_text(encoding="utf-8"))
    return metadata, poster


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path)
    args = parser.parse_args()
    if args.source:
        import_sources(args.source)
    sheet = Image.new("RGB", (6 * 190, 3 * 218), "#daeee6")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 15)
    manifest = {}
    for row, role in enumerate(ROLES):
        manifest[role] = {}
        for quality in range(1, 7):
            metadata, poster = build_model(role, quality)
            manifest[role][str(quality)] = metadata
            thumbnail = poster.resize((190, 190), Image.Resampling.LANCZOS)
            sheet.paste(thumbnail, ((quality - 1) * 190, row * 218 + 24), thumbnail)
            draw.text(((quality - 1) * 190 + 8, row * 218 + 5), f"{role} / quality {quality}", font=font, fill="#264b3c")
            print(f"Built {role}/{quality}", flush=True)
    (OUTPUT_ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    (ROOT / "asset-contact-sheets").mkdir(exist_ok=True)
    sheet.save(ROOT / "asset-contact-sheets" / "warrior-qualities.jpg", quality=92)


if __name__ == "__main__":
    main()
