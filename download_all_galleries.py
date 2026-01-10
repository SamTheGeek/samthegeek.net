#!/usr/bin/env python3
"""
Script to download all gallery images from samthegeek.net
Usage: python3 download_all_galleries.py
"""

import os
import re
import sys
from urllib.request import urlopen, Request
from urllib.parse import urljoin
from pathlib import Path

BASE_DIR = "/Users/sam/Developer/samthegeek.net/public/images"
BASE_URL = "https://samthegeek.net"

# Gallery configurations
GALLERIES = [
    {"name": "Italy", "url": f"{BASE_URL}/italy", "dir": "italy"},
    {"name": "Los Angeles", "url": f"{BASE_URL}/los-angeles19", "dir": "los-angeles"},
    {"name": "France", "url": f"{BASE_URL}/france18", "dir": "france"},
    {"name": "Japan", "url": f"{BASE_URL}/japan18", "dir": "japan"},
    {"name": "Canada", "url": f"{BASE_URL}/canada17", "dir": "canada"},
    {"name": "Elsewhere", "url": f"{BASE_URL}/elsewhere", "dir": "elsewhere"},
]


def fetch_page(url):
    """Fetch HTML content from URL"""
    try:
        req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urlopen(req) as response:
            return response.read().decode('utf-8')
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None


def extract_image_urls(html, base_url):
    """Extract image URLs from HTML"""
    # Pattern 1: Full URLs in src attributes
    pattern1 = r'https://[^"\'>\s]+\.(?:jpg|jpeg|png|JPG|JPEG|PNG)'
    urls = re.findall(pattern1, html)

    # Pattern 2: Relative URLs in src attributes
    pattern2 = r'src=["\'](/[^"\']+\.(?:jpg|jpeg|png|JPG|JPEG|PNG))["\']'
    relative_urls = re.findall(pattern2, html)
    urls.extend([urljoin(base_url, url) for url in relative_urls])

    # Filter out icons and logos
    filtered_urls = [url for url in urls if 'icon' not in url.lower() and 'logo' not in url.lower()]

    # Remove duplicates while preserving order
    seen = set()
    unique_urls = []
    for url in filtered_urls:
        if url not in seen:
            seen.add(url)
            unique_urls.append(url)

    return unique_urls


def download_image(url, target_path):
    """Download a single image"""
    try:
        req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urlopen(req) as response:
            with open(target_path, 'wb') as f:
                f.write(response.read())
        return True
    except Exception as e:
        print(f"  Error downloading {url}: {e}")
        return False


def download_gallery(gallery):
    """Download all images from a gallery"""
    name = gallery["name"]
    url = gallery["url"]
    target_dir = os.path.join(BASE_DIR, gallery["dir"])

    print("=" * 60)
    print(f"Processing: {name}")
    print(f"URL: {url}")
    print(f"Target: {target_dir}")
    print("=" * 60)

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
        print(f"ERROR: No images found for {name}")
        return 0

    total_images = len(image_urls)
    print(f"Found {total_images} images")

    # Download each image
    downloaded = 0
    skipped = 0

    for i, img_url in enumerate(image_urls, 1):
        # Extract filename from URL
        filename = os.path.basename(img_url.split('?')[0])  # Remove query params
        target_path = os.path.join(target_dir, filename)

        # Check if file already exists
        if os.path.exists(target_path):
            print(f"[{i}/{total_images}] Skipping (exists): {filename}")
            skipped += 1
        else:
            print(f"[{i}/{total_images}] Downloading: {filename}")
            if download_image(img_url, target_path):
                downloaded += 1

        # Report progress every 20 images
        if i % 20 == 0:
            print(f"===== Progress: {i}/{total_images} images processed =====")

    # Final count for this gallery
    actual_count = len(os.listdir(target_dir))
    print(f"✓ Completed {name}: {actual_count} images in directory")
    print(f"  (Downloaded: {downloaded}, Skipped: {skipped})")
    print()

    return actual_count


def main():
    """Main function"""
    print("Starting gallery image download...")
    print()

    # Download all galleries
    results = {}
    for gallery in GALLERIES:
        count = download_gallery(gallery)
        results[gallery["name"]] = count

    # Final summary
    print("=" * 60)
    print("FINAL SUMMARY")
    print("=" * 60)
    for name, count in results.items():
        print(f"{name}: {count} images")
    print("=" * 60)

    total = sum(results.values())
    print(f"Total images downloaded across all galleries: {total}")


if __name__ == "__main__":
    main()
