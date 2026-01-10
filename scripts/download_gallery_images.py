#!/usr/bin/env python3
"""Download gallery images listed in ALL_GALLERY_URLS.txt.

Usage:
  python3 scripts/download_gallery_images.py
  python3 scripts/download_gallery_images.py --urls-file ALL_GALLERY_URLS.txt --images-dir public/images
"""

from __future__ import annotations

import argparse
import hashlib
import sys
from pathlib import Path
from typing import Dict, Iterable, List, Tuple
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

DEFAULT_URLS_FILE = Path("ALL_GALLERY_URLS.txt")
DEFAULT_IMAGES_DIR = Path("public/images")

GALLERY_DIR_MAP: Dict[str, str] = {
    "italy": "italy",
    "los-angeles": "los-angeles",
    "los angeles": "los-angeles",
    "france": "france",
    "japan": "japan",
    "canada": "canada",
    "elsewhere": "elsewhere",
}


def parse_gallery_urls(urls_file: Path) -> List[Tuple[str, str]]:
    entries: List[Tuple[str, str]] = []
    for line_no, raw_line in enumerate(urls_file.read_text().splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "|" not in line:
            print(f"Skipping malformed line {line_no}: {raw_line}")
            continue
        gallery_raw, url = line.split("|", 1)
        gallery = gallery_raw.strip().lower()
        url = url.strip()
        if not gallery or not url:
            print(f"Skipping malformed line {line_no}: {raw_line}")
            continue
        entries.append((gallery, url))
    return entries


def normalize_gallery_dir(gallery: str) -> str:
    gallery_key = gallery.strip().lower()
    if gallery_key in GALLERY_DIR_MAP:
        return GALLERY_DIR_MAP[gallery_key]
    return gallery_key.replace(" ", "-")


def filename_from_url(url: str) -> str:
    path = urlsplit(url).path
    name = Path(path).name
    if name:
        return name
    digest = hashlib.sha1(url.encode("utf-8")).hexdigest()
    return f"image-{digest}.jpg"


def download_image(url: str, target_path: Path) -> bool:
    try:
        req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urlopen(req, timeout=60) as response:
            content = response.read()
        if not content:
            print(f"  Skipped (empty response): {url}")
            return False
        target_path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = target_path.with_suffix(target_path.suffix + ".part")
        temp_path.write_bytes(content)
        temp_path.replace(target_path)
        return True
    except Exception as exc:
        print(f"  Error downloading {url}: {exc}")
        return False


def group_by_gallery(entries: Iterable[Tuple[str, str]]) -> Dict[str, List[str]]:
    grouped: Dict[str, List[str]] = {}
    for gallery, url in entries:
        grouped.setdefault(gallery, []).append(url)
    return grouped


def download_galleries(entries: List[Tuple[str, str]], images_dir: Path) -> None:
    grouped = group_by_gallery(entries)
    total_downloaded = 0
    total_skipped = 0

    for gallery, urls in grouped.items():
        gallery_dir = normalize_gallery_dir(gallery)
        target_dir = images_dir / gallery_dir
        print("=" * 70)
        print(f"Gallery: {gallery}")
        print(f"Target: {target_dir}")
        print(f"Images: {len(urls)}")
        print("=" * 70)

        downloaded = 0
        skipped = 0
        seen = set()

        for index, url in enumerate(urls, start=1):
            if url in seen:
                skipped += 1
                continue
            seen.add(url)
            filename = filename_from_url(url)
            target_path = target_dir / filename
            if target_path.exists() and target_path.stat().st_size > 0:
                print(f"[{index}/{len(urls)}] Skipping (exists): {filename}")
                skipped += 1
                continue
            print(f"[{index}/{len(urls)}] Downloading: {filename}")
            if download_image(url, target_path):
                downloaded += 1

        total_downloaded += downloaded
        total_skipped += skipped
        print(f"✓ Completed {gallery_dir}: downloaded {downloaded}, skipped {skipped}")
        print()

    print("=" * 70)
    print("FINAL SUMMARY")
    print("=" * 70)
    print(f"Downloaded: {total_downloaded}")
    print(f"Skipped:    {total_skipped}")
    print("=" * 70)


def main() -> int:
    parser = argparse.ArgumentParser(description="Download gallery images from URL list.")
    parser.add_argument(
        "--urls-file",
        type=Path,
        default=DEFAULT_URLS_FILE,
        help="Path to ALL_GALLERY_URLS.txt",
    )
    parser.add_argument(
        "--images-dir",
        type=Path,
        default=DEFAULT_IMAGES_DIR,
        help="Directory to write gallery images (default: public/images)",
    )
    args = parser.parse_args()

    urls_file = args.urls_file
    if not urls_file.exists():
        print(f"URLs file not found: {urls_file}")
        return 1

    entries = parse_gallery_urls(urls_file)
    if not entries:
        print("No gallery URLs found.")
        return 1

    images_dir = args.images_dir
    if not images_dir.exists():
        images_dir.mkdir(parents=True, exist_ok=True)

    download_galleries(entries, images_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
