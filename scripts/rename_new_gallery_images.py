#!/usr/bin/env python3
"""Rename and import a new batch of gallery images.

Prompts for a source folder and whether to use an existing gallery or create a new one.
Creates/updates gallery JSON metadata, renames files using EXIF data,
and extracts EXIF metadata into the gallery JSON.

Requires: pip install exifread
Environment: PUBLIC_GOOGLE_MAPS_EMBED_API_KEY (preferred) or GOOGLE_MAPS_API_KEY
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple
from urllib.parse import urlencode
from urllib.request import Request, urlopen

def load_dotenv() -> None:
    root = Path(__file__).resolve().parents[1]
    env_path = root / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def ensure_exifread() -> "module":
    try:
        import exifread  # type: ignore

        return exifread
    except ImportError:
        pass

    if sys.prefix != sys.base_prefix:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "exifread"])
        import exifread  # type: ignore

        return exifread

    if os.environ.get("STG_BOOTSTRAPPED") == "1":
        print("Missing dependency: exifread. Install with `python -m pip install exifread`.")
        sys.exit(1)

    root = Path(__file__).resolve().parents[1]
    venv_dir = root / ".venv"
    python_bin = venv_dir / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    if not venv_dir.exists():
        subprocess.check_call([sys.executable, "-m", "venv", str(venv_dir)])
    subprocess.check_call([str(python_bin), "-m", "pip", "install", "exifread"])
    env = os.environ.copy()
    env["STG_BOOTSTRAPPED"] = "1"
    os.execvpe(str(python_bin), [str(python_bin), __file__] + sys.argv[1:], env)
    raise SystemExit(0)


load_dotenv()
exifread = ensure_exifread()

from extract_gallery_exif import extract_gallery_exif

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG"}
DEFAULT_IMAGES_DIR = Path("public/images")
DEFAULT_GALLERIES_DIR = Path("src/content/galleries")
CITY_TYPES = ("locality", "postal_town", "administrative_area_level_3", "administrative_area_level_2")


@dataclass
class ImageInfo:
    path: Path
    taken_at: Optional[datetime]
    date_str: Optional[str]
    city: Optional[str]
    sort_key: Tuple[int, str]


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9\\s-]", "", value)
    value = re.sub(r"\\s+", "-", value)
    value = re.sub(r"-{2,}", "-", value)
    return value.strip("-")


def parse_exif_datetime(tags: Dict[str, object]) -> Optional[datetime]:
    for key in ("EXIF DateTimeOriginal", "EXIF DateTimeDigitized", "Image DateTime"):
        raw = tags.get(key)
        if raw:
            try:
                return datetime.strptime(str(raw), "%Y:%m:%d %H:%M:%S")
            except ValueError:
                continue
    return None


def ratio_to_float(value) -> float:
    try:
        return float(value.num) / float(value.den)
    except AttributeError:
        return float(value)


def parse_gps(tags: Dict[str, object]) -> Optional[Tuple[float, float]]:
    lat = tags.get("GPS GPSLatitude")
    lat_ref = tags.get("GPS GPSLatitudeRef")
    lon = tags.get("GPS GPSLongitude")
    lon_ref = tags.get("GPS GPSLongitudeRef")
    if not (lat and lat_ref and lon and lon_ref):
        return None

    lat_values = [ratio_to_float(v) for v in lat.values]
    lon_values = [ratio_to_float(v) for v in lon.values]
    lat_deg = lat_values[0] + lat_values[1] / 60 + lat_values[2] / 3600
    lon_deg = lon_values[0] + lon_values[1] / 60 + lon_values[2] / 3600
    if str(lat_ref).upper().startswith("S"):
        lat_deg *= -1
    if str(lon_ref).upper().startswith("W"):
        lon_deg *= -1
    return (lat_deg, lon_deg)


def reverse_geocode_city(lat: float, lon: float, api_key: str, cache: Dict[Tuple[float, float], Optional[str]]) -> Optional[str]:
    cache_key = (round(lat, 5), round(lon, 5))
    if cache_key in cache:
        return cache[cache_key]
    params = urlencode({"latlng": f"{lat},{lon}", "key": api_key})
    url = f"https://maps.googleapis.com/maps/api/geocode/json?{params}"
    req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(req, timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8"))
    city = None
    if payload.get("status") == "OK":
        for result in payload.get("results", []):
            for component in result.get("address_components", []):
                if any(t in component.get("types", []) for t in CITY_TYPES):
                    city = component.get("long_name")
                    break
            if city:
                break
    cache[cache_key] = city
    return city


def iter_image_files(folder: Path) -> Iterable[Path]:
    for path in folder.iterdir():
        if path.is_file() and path.suffix in IMAGE_EXTENSIONS:
            yield path


def collect_image_info(
    files: Iterable[Path],
    gallery_name: str,
    api_key: Optional[str],
    placeholder_city: Optional[str],
    ask_placeholder: callable,
) -> List[ImageInfo]:
    geocode_cache: Dict[Tuple[float, float], Optional[str]] = {}
    results: List[ImageInfo] = []

    for file_path in files:
        with file_path.open("rb") as handle:
            tags = exifread.process_file(handle, details=False)
        taken_at = parse_exif_datetime(tags)
        date_str = taken_at.strftime("%d%m%Y") if taken_at else None
        gps = parse_gps(tags)
        city = None
        if gps and api_key:
            city = reverse_geocode_city(gps[0], gps[1], api_key, geocode_cache)
        if not city:
            if gps is None or api_key is None:
                if placeholder_city is None:
                    placeholder_city = ask_placeholder()
                city = placeholder_city
        city_slug = slugify(city) if city else None
        timestamp = int(taken_at.timestamp()) if taken_at else int(file_path.stat().st_mtime)
        sort_key = (timestamp, file_path.name)
        results.append(
            ImageInfo(
                path=file_path,
                taken_at=taken_at,
                date_str=date_str,
                city=city_slug,
                sort_key=sort_key,
            )
        )
    return results


def build_base_name(gallery: str, city: Optional[str], date_str: Optional[str]) -> str:
    parts = [slugify(gallery)]
    if city:
        parts.append(city)
    if date_str:
        parts.append(date_str)
    return "_".join(filter(None, parts))


def build_rename_plan(images: List[ImageInfo], gallery: str) -> Dict[Path, str]:
    grouped: Dict[str, List[ImageInfo]] = {}
    for info in images:
        base = build_base_name(gallery, info.city, info.date_str)
        grouped.setdefault(base, []).append(info)

    plan: Dict[Path, str] = {}
    for base, items in grouped.items():
        items_sorted = sorted(items, key=lambda item: item.sort_key)
        needs_sequence = len(items_sorted) > 1
        width = len(str(len(items_sorted)))
        for index, info in enumerate(items_sorted, start=1):
            suffix = info.path.suffix
            if needs_sequence:
                seq = f"{index:0{width}d}"
                target = f"{base}_{seq}{suffix}"
            else:
                target = f"{base}{suffix}"
            plan[info.path] = target
    return plan


def apply_rename_plan(plan: Dict[Path, str]) -> None:
    temp_paths: Dict[Path, Path] = {}
    for src in plan:
        temp_name = f".renaming-{uuid.uuid4().hex}{src.suffix}"
        temp_path = src.with_name(temp_name)
        src.rename(temp_path)
        temp_paths[temp_path] = src

    for temp_path, original_path in temp_paths.items():
        final_name = plan[original_path]
        final_path = original_path.with_name(final_name)
        temp_path.rename(final_path)


def update_gallery_json(gallery_name: str, gallery_dir: Path, galleries_dir: Path, title: Optional[str] = None) -> None:
    json_path = galleries_dir / f"{gallery_name}.json"
    if json_path.exists():
        data = json.loads(json_path.read_text())
    else:
        data = {
            "title": title or gallery_name,
            "location": title or gallery_name,
            "publishedDate": datetime.now().strftime("%Y-%m-%d"),
            "description": "",
            "images": [],
        }

    title_value = data.get("title", gallery_name)
    images = sorted([p.name for p in iter_image_files(gallery_dir)])
    data["images"] = [
        {"src": f"/images/{gallery_name}/{filename}", "alt": f"{title_value} photo"}
        for filename in images
    ]
    json_path.write_text(json.dumps(data, indent=2))
    print(f"Updated JSON: {json_path}")

def get_maps_api_key() -> Optional[str]:
    return os.environ.get("PUBLIC_GOOGLE_MAPS_EMBED_API_KEY") or os.environ.get("GOOGLE_MAPS_API_KEY")


def choose_gallery(images_dir: Path) -> Tuple[str, bool]:
    existing = sorted([p.name for p in images_dir.iterdir() if p.is_dir()])
    choice = input("Use an existing gallery? [y/N]: ").strip().lower()
    if choice == "y":
        if not existing:
            print("No existing galleries found. Creating a new one.")
        else:
            print("Available galleries:")
            for idx, name in enumerate(existing, start=1):
                print(f"  {idx}. {name}")
            selection = input("Select a gallery number: ").strip()
            if selection.isdigit():
                index = int(selection)
                if 1 <= index <= len(existing):
                    return existing[index - 1], False
    name = input("Enter new gallery name: ").strip()
    return slugify(name), True


def main() -> int:
    images_dir = DEFAULT_IMAGES_DIR
    galleries_dir = DEFAULT_GALLERIES_DIR

    source_input = input("Path to folder with new images: ").strip()
    if not source_input:
        print("No source folder provided.")
        return 1
    source_dir = Path(source_input).expanduser()
    if not source_dir.exists() or not source_dir.is_dir():
        print(f"Source folder not found: {source_dir}")
        return 1

    gallery_name, is_new = choose_gallery(images_dir)
    gallery_dir = images_dir / gallery_name
    gallery_dir.mkdir(parents=True, exist_ok=True)

    title = None
    if is_new:
        title = input("Enter display title for new gallery (leave blank to use name): ").strip()
        if not title:
            title = gallery_name

    # Move images into the gallery folder
    for image_path in iter_image_files(source_dir):
        target_path = gallery_dir / image_path.name
        if target_path.exists():
            print(f"Skipping existing file: {target_path.name}")
            continue
        shutil.move(str(image_path), str(target_path))

    api_key = get_maps_api_key()
    placeholder_city: Optional[str] = None
    placeholder_prompted = False

    def ask_placeholder() -> Optional[str]:
        nonlocal placeholder_city, placeholder_prompted
        if placeholder_prompted:
            return placeholder_city
        placeholder_prompted = True
        value = input(
            "GPS missing or geocode unavailable. Enter placeholder city (leave blank to skip): "
        ).strip()
        placeholder_city = value or None
        return placeholder_city

    files = list(iter_image_files(gallery_dir))
    if not files:
        print("No images found in target gallery.")
        return 1

    infos = collect_image_info(files, gallery_name, api_key, placeholder_city, ask_placeholder)
    plan = build_rename_plan(infos, gallery_name)
    if len(set(plan.values())) != len(plan.values()):
        print("Error: duplicate target filenames detected.")
        return 1
    apply_rename_plan(plan)
    update_gallery_json(gallery_name, gallery_dir, galleries_dir, title=title)
    extract_gallery_exif(gallery_name, images_dir, galleries_dir)

    return 0


if __name__ == "__main__":
    sys.exit(main())
