#!/usr/bin/env python3
"""
Complete script to download all gallery images from samthegeek.net and update JSON files
Usage: python3 download_and_update_galleries.py
"""

import os
import re
import sys
import json
from urllib.request import urlopen, Request
from urllib.parse import urljoin
from pathlib import Path

BASE_DIR = "/Users/sam/Developer/samthegeek.net/public/images"
CONTENT_DIR = "/Users/sam/Developer/samthegeek.net/src/content/galleries"
BASE_URL = "https://samthegeek.net"

# Gallery configurations
GALLERIES = [
    {
        "name": "Italy",
        "url": f"{BASE_URL}/italy",
        "dir": "italy",
        "json_file": "italy.json",
        "location": "Italy"
    },
    {
        "name": "Los Angeles",
        "url": f"{BASE_URL}/los-angeles19",
        "dir": "los-angeles",
        "json_file": "los-angeles.json",
        "location": "Los Angeles, California"
    },
    {
        "name": "France",
        "url": f"{BASE_URL}/france18",
        "dir": "france",
        "json_file": "france.json",
        "location": "France"
    },
    {
        "name": "Japan",
        "url": f"{BASE_URL}/japan18",
        "dir": "japan",
        "json_file": "japan.json",
        "location": "Japan"
    },
    {
        "name": "Canada",
        "url": f"{BASE_URL}/canada17",
        "dir": "canada",
        "json_file": "canada.json",
        "location": "Canada"
    },
    {
        "name": "Elsewhere",
        "url": f"{BASE_URL}/elsewhere",
        "dir": "elsewhere",
        "json_file": "elsewhere.json",
        "location": "Various Locations"
    },
]


def fetch_page(url):
    """Fetch HTML content from URL"""
    try:
        req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urlopen(req, timeout=30) as response:
            return response.read().decode('utf-8')
    except Exception as e:
        print(f"  Error fetching {url}: {e}")
        return None


def extract_image_urls(html, base_url):
    """Extract image URLs from HTML"""
    image_urls = []

    # Pattern 1: Full URLs in src or data-src attributes
    patterns = [
        r'(?:src|data-src)=["\'](https://[^"\']+\.(?:jpg|jpeg|png|JPG|JPEG|PNG))["\']',
        r'(https://samthegeek\.net/[^"\'>\s]+\.(?:jpg|jpeg|png|JPG|JPEG|PNG))',
        r'(https://[^"\'>\s]+samthegeek[^"\'>\s]+\.(?:jpg|jpeg|png|JPG|JPEG|PNG))',
    ]

    for pattern in patterns:
        urls = re.findall(pattern, html, re.IGNORECASE)
        image_urls.extend(urls)

    # Pattern 2: Relative URLs in src attributes
    pattern_relative = r'(?:src|data-src)=["\'](/[^"\']+\.(?:jpg|jpeg|png|JPG|JPEG|PNG))["\']'
    relative_urls = re.findall(pattern_relative, html, re.IGNORECASE)
    image_urls.extend([urljoin(base_url, url) for url in relative_urls])

    # Filter out icons, logos, and common UI elements
    filtered_urls = [
        url for url in image_urls
        if not any(x in url.lower() for x in ['icon', 'logo', 'avatar', 'favicon', 'sprite'])
    ]

    # Remove duplicates while preserving order
    seen = set()
    unique_urls = []
    for url in filtered_urls:
        # Normalize URL by removing query params for deduplication
        url_base = url.split('?')[0]
        if url_base not in seen:
            seen.add(url_base)
            unique_urls.append(url)

    return unique_urls


def download_image(url, target_path):
    """Download a single image"""
    try:
        req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urlopen(req, timeout=30) as response:
            content = response.read()
            # Verify it's actually an image
            if len(content) > 1000:  # Images should be larger than 1KB
                with open(target_path, 'wb') as f:
                    f.write(content)
                return True
            else:
                print(f"    Skipped (too small, likely not an image): {url}")
                return False
    except Exception as e:
        print(f"    Error downloading {url}: {e}")
        return False


def update_json_file(gallery, image_files):
    """Update the gallery JSON file with downloaded images"""
    json_path = os.path.join(CONTENT_DIR, gallery["json_file"])

    # Read existing JSON
    with open(json_path, 'r') as f:
        data = json.load(f)

    # Update images array
    data["images"] = []
    for img_file in sorted(image_files):
        data["images"].append({
            "src": f"/images/{gallery['dir']}/{img_file}",
            "alt": f"{gallery['name']} photo"
        })

    # Write updated JSON
    with open(json_path, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"  Updated {gallery['json_file']} with {len(image_files)} images")


def download_gallery(gallery):
    """Download all images from a gallery and update its JSON file"""
    name = gallery["name"]
    url = gallery["url"]
    target_dir = os.path.join(BASE_DIR, gallery["dir"])

    print("=" * 70)
    print(f"Processing: {name}")
    print(f"URL: {url}")
    print(f"Target: {target_dir}")
    print("=" * 70)

    # Create directory if it doesn't exist
    Path(target_dir).mkdir(parents=True, exist_ok=True)

    # Fetch page
    print("Fetching page and extracting image URLs...")
    html = fetch_page(url)

    if not html:
        print(f"ERROR: Could not fetch page for {name}")
        return 0

    # Extract image URLs
    image_urls = extract_image_urls(html, BASE_URL)

    if not image_urls:
        print(f"WARNING: No images found for {name}")
        print("This might be due to JavaScript-loaded content or different page structure.")
        print(f"You may need to manually check {url}")
        return 0

    total_images = len(image_urls)
    print(f"Found {total_images} potential image URLs")

    # Download each image
    downloaded = 0
    skipped = 0
    downloaded_files = []

    for i, img_url in enumerate(image_urls, 1):
        # Extract filename from URL
        filename = os.path.basename(img_url.split('?')[0])  # Remove query params

        # Clean filename
        filename = re.sub(r'[^\w\.-]', '_', filename)

        target_path = os.path.join(target_dir, filename)

        # Check if file already exists
        if os.path.exists(target_path) and os.path.getsize(target_path) > 1000:
            print(f"[{i}/{total_images}] Skipping (exists): {filename}")
            skipped += 1
            downloaded_files.append(filename)
        else:
            print(f"[{i}/{total_images}] Downloading: {filename}")
            if download_image(img_url, target_path):
                downloaded += 1
                downloaded_files.append(filename)

        # Report progress every 20 images
        if i % 20 == 0:
            print(f"\n===== Progress: {i}/{total_images} images processed =====\n")

    # Update JSON file with downloaded images
    if downloaded_files:
        update_json_file(gallery, downloaded_files)

    # Final count for this gallery
    print(f"\n✓ Completed {name}:")
    print(f"  - Downloaded: {downloaded} new images")
    print(f"  - Skipped (already existed): {skipped}")
    print(f"  - Total in directory: {len(downloaded_files)}")
    print()

    return len(downloaded_files)


def main():
    """Main function"""
    print("\n" + "=" * 70)
    print("Gallery Image Download & JSON Update Tool")
    print("=" * 70)
    print()

    # Check if directories exist
    if not os.path.exists(BASE_DIR):
        print(f"ERROR: Base directory not found: {BASE_DIR}")
        sys.exit(1)

    if not os.path.exists(CONTENT_DIR):
        print(f"ERROR: Content directory not found: {CONTENT_DIR}")
        sys.exit(1)

    # Download all galleries
    results = {}
    for gallery in GALLERIES:
        count = download_gallery(gallery)
        results[gallery["name"]] = count

    # Final summary
    print("\n" + "=" * 70)
    print("FINAL SUMMARY")
    print("=" * 70)
    for name, count in results.items():
        print(f"{name:20s}: {count:3d} images")
    print("=" * 70)

    total = sum(results.values())
    print(f"{'Total':20s}: {total:3d} images across all galleries")
    print("=" * 70)
    print("\nDone! All gallery JSON files have been updated.")
    print()


if __name__ == "__main__":
    main()
