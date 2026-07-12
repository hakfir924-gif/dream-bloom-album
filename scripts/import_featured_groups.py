from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
import shutil

from PIL import Image, ImageOps


SOURCE_ROOT = Path("C:/Users/ZhuanZ/Desktop/xinxin")
PUBLIC_ROOT = Path("public/universe-media").resolve()
GROUPS_ROOT = PUBLIC_ROOT / "groups"
MANIFEST_PATH = PUBLIC_ROOT / "manifest.json"
FEATURED_GROUPS = (
    {"id": "featured-xiaoxinxin", "folder": "小鑫鑫", "title": "小鑫鑫"},
    {"id": "featured-snacks", "folder": "零食", "title": "零食星"},
    {"id": "featured-daily", "folder": "日常", "title": "日常星"},
)
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def save_jpeg(source: Path, output: Path, thumbnail: bool) -> None:
    with Image.open(source) as opened:
        image = ImageOps.exif_transpose(opened).convert("RGB")
        if thumbnail:
            image.thumbnail((480, 640), Image.Resampling.LANCZOS)
        image.save(output, "JPEG", quality=82 if thumbnail else 91, optimize=True)


def main() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    imported = []

    for group in FEATURED_GROUPS:
        source_dir = SOURCE_ROOT / group["folder"]
        target_dir = (GROUPS_ROOT / group["id"]).resolve()
        if GROUPS_ROOT.resolve() not in target_dir.parents:
            raise RuntimeError(f"Unsafe target directory: {target_dir}")

        source_files = sorted(
            (
                file
                for file in source_dir.iterdir()
                if file.is_file() and file.suffix.lower() in IMAGE_EXTENSIONS
            ),
            key=lambda file: file.name,
        )

        shutil.rmtree(target_dir, ignore_errors=True)
        files_dir = target_dir / "files"
        thumbs_dir = target_dir / "thumbs"
        files_dir.mkdir(parents=True, exist_ok=True)
        thumbs_dir.mkdir(parents=True, exist_ok=True)

        items = []
        for index, source in enumerate(source_files, start=1):
            output_name = f"{index:03d}.jpg"
            save_jpeg(source, files_dir / output_name, thumbnail=False)
            save_jpeg(source, thumbs_dir / output_name, thumbnail=True)
            items.append(
                {
                    "id": f"{group['id']}-{index:03d}",
                    "type": "image",
                    "url": f"/universe-media/groups/{group['id']}/files/{output_name}",
                    "thumb": f"/universe-media/groups/{group['id']}/thumbs/{output_name}",
                    "originalName": source.name,
                }
            )

        imported.append(
            {
                "id": group["id"],
                "title": group["title"],
                "subtitle": f"{len(items)} Photos · 0 Videos",
                "cover": items[0]["thumb"] if items else None,
                "items": items,
            }
        )

    imported_ids = {group["id"] for group in imported}
    manifest["smallPlanets"] = imported + [
        group for group in manifest["smallPlanets"] if group["id"] not in imported_ids
    ]
    manifest["counts"]["smallGroups"] = len(manifest["smallPlanets"])
    manifest["generatedAt"] = datetime.now(timezone.utc).isoformat()
    MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    for group in imported:
        print(f"{group['title']}: {len(group['items'])}")


if __name__ == "__main__":
    main()
