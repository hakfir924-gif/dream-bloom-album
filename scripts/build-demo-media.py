from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "demo-media"
MANIFEST = ROOT / "public" / "universe-media" / "manifest.json"

SHEETS = [
    {
        "id": "photos",
        "folder": "sea",
        "title": "海风来信",
        "subtitle": "SUMMER LETTERS",
        "theme": "cyan",
        "date": "2025.08.16",
        "location": "海边",
        "note": "风从海面吹来，那天的每一束光都很温柔。",
        "source": Path(r"C:\Users\ZhuanZ\.codex\generated_images\019f3865-85cf-7ab2-947b-f04c37745c82\exec-efd02a75-757f-406e-b2d0-56c76b6ae57b.png"),
    },
    {
        "id": "motion",
        "folder": "night",
        "title": "长夜微光",
        "subtitle": "CITY AFTERGLOW",
        "theme": "pink",
        "date": "2025.10.03",
        "location": "城市夜晚",
        "note": "我们沿着灯火慢慢走，整座城市像一场未醒的梦。",
        "source": Path(r"C:\Users\ZhuanZ\.codex\generated_images\019f3865-85cf-7ab2-947b-f04c37745c82\exec-97de05df-3de3-4936-9e88-20d71f979dd4.png"),
    },
    {
        "id": "best",
        "folder": "birthday",
        "title": "花与愿望",
        "subtitle": "A WISH IN BLOOM",
        "theme": "gold",
        "date": "2026.02.14",
        "location": "温暖房间",
        "note": "烛光亮起的时候，所有平凡瞬间都有了名字。",
        "source": Path(r"C:\Users\ZhuanZ\.codex\generated_images\019f3865-85cf-7ab2-947b-f04c37745c82\exec-3846aa49-fa45-4c71-ba0b-4a61223eee49.png"),
    },
]


def crop_sheet(sheet: dict[str, object]) -> list[dict[str, object]]:
    source = Path(sheet["source"])
    folder = str(sheet["folder"])
    target = OUTPUT / folder
    files = target / "files"
    thumbs = target / "thumbs"
    files.mkdir(parents=True, exist_ok=True)
    thumbs.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target / "contact-sheet.png")

    image = Image.open(source).convert("RGB")
    width, height = image.size
    items: list[dict[str, object]] = []
    for row in range(4):
        for column in range(3):
            index = row * 3 + column + 1
            left = round(column * width / 3) + 4
            top = round(row * height / 4) + 4
            right = round((column + 1) * width / 3) - 4
            bottom = round((row + 1) * height / 4) - 4
            panel = image.crop((left, top, right, bottom))
            full = ImageOps.fit(panel, (720, 960), method=Image.Resampling.LANCZOS)
            thumb = ImageOps.fit(panel, (360, 480), method=Image.Resampling.LANCZOS)
            filename = f"{index:02d}.jpg"
            full.save(files / filename, "JPEG", quality=88, optimize=True, progressive=True)
            thumb.save(thumbs / filename, "JPEG", quality=78, optimize=True, progressive=True)
            items.append(
                {
                    "id": f"demo-{folder}-{index:02d}",
                    "type": "image",
                    "url": f"/demo-media/{folder}/files/{filename}",
                    "thumb": f"/demo-media/{folder}/thumbs/{filename}",
                    "originalName": filename,
                    "date": sheet["date"],
                    "location": sheet["location"],
                    "note": sheet["note"],
                }
            )
    return items


def make_small_planet(identifier: str, title: str, subtitle: str, items: list[dict[str, object]]) -> dict[str, object]:
    return {
        "id": identifier,
        "title": title,
        "subtitle": subtitle,
        "cover": items[0]["thumb"],
        "items": items,
    }


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    big_planets = []
    groups: dict[str, list[dict[str, object]]] = {}
    for sheet in SHEETS:
        items = crop_sheet(sheet)
        folder = str(sheet["folder"])
        groups[folder] = items
        big_planets.append(
            {
                "id": sheet["id"],
                "title": sheet["title"],
                "subtitle": f"{sheet['subtitle']} · 12 Photos",
                "theme": sheet["theme"],
                "cover": items[0]["thumb"],
                "items": items,
            }
        )

    small_planets = [
        make_small_planet("demo-first-breeze", "初见海风", "4 Photos", groups["sea"][0:4]),
        make_small_planet("demo-pink-sunset", "粉色落日", "4 Photos", groups["sea"][8:12]),
        make_small_planet("demo-city-walk", "灯下漫步", "4 Photos", groups["night"][0:4]),
        make_small_planet("demo-fireworks", "烟火入夜", "4 Photos", groups["night"][6:10]),
        make_small_planet("demo-birthday", "生日愿望", "4 Photos", groups["birthday"][0:4]),
        make_small_planet("demo-warm-room", "房间微光", "4 Photos", groups["birthday"][8:12]),
    ]
    manifest = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "counts": {"total": 36, "images": 36, "videos": 0, "smallGroups": len(small_planets)},
        "smallPlanets": small_planets,
        "bigPlanets": big_planets,
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
