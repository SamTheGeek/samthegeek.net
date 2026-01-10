#!/bin/bash

# Script to download all gallery images from samthegeek.net
# Usage: ./download_all_galleries.sh

set -e

BASE_DIR="/Users/sam/Developer/samthegeek.net/public/images"
BASE_URL="https://samthegeek.net"

# Function to download images from a gallery page
download_gallery() {
    local gallery_name=$1
    local gallery_url=$2
    local target_dir=$3

    echo "=========================================="
    echo "Processing: $gallery_name"
    echo "URL: $gallery_url"
    echo "Target: $target_dir"
    echo "=========================================="

    # Create directory if it doesn't exist
    mkdir -p "$target_dir"

    # Fetch the page and extract image URLs
    # Look for full URLs in src attributes
    echo "Fetching page and extracting image URLs..."

    image_urls=$(curl -s "$gallery_url" | \
        grep -oE 'https://[^"]+\.(jpg|jpeg|png|JPG|JPEG|PNG)' | \
        grep -v 'icon' | \
        grep -v 'logo' | \
        sort -u)

    if [ -z "$image_urls" ]; then
        echo "No images found on $gallery_url"
        echo "Trying alternate pattern..."

        # Try to find relative URLs and convert them
        image_urls=$(curl -s "$gallery_url" | \
            grep -oE '/[^"]+\.(jpg|jpeg|png|JPG|JPEG|PNG)' | \
            grep -v 'icon' | \
            grep -v 'logo' | \
            sort -u | \
            sed "s|^|$BASE_URL|")
    fi

    if [ -z "$image_urls" ]; then
        echo "ERROR: Still no images found for $gallery_name"
        return 1
    fi

    # Count total images
    total_images=$(echo "$image_urls" | wc -l | tr -d ' ')
    echo "Found $total_images images"

    # Download each image
    count=0
    while IFS= read -r url; do
        count=$((count + 1))

        # Extract filename from URL
        filename=$(basename "$url")

        # Download the image
        if [ ! -f "$target_dir/$filename" ]; then
            echo "[$count/$total_images] Downloading: $filename"
            curl -s -o "$target_dir/$filename" "$url"
        else
            echo "[$count/$total_images] Skipping (exists): $filename"
        fi

        # Report progress every 20 images
        if [ $((count % 20)) -eq 0 ]; then
            echo "===== Progress: $count/$total_images images processed ====="
        fi
    done <<< "$image_urls"

    # Final count for this gallery
    actual_count=$(ls -1 "$target_dir" | wc -l | tr -d ' ')
    echo "✓ Completed $gallery_name: $actual_count images in directory"
    echo ""
}

# Download all galleries
download_gallery "Italy" "$BASE_URL/italy" "$BASE_DIR/italy"
download_gallery "Los Angeles" "$BASE_URL/los-angeles19" "$BASE_DIR/los-angeles"
download_gallery "France" "$BASE_URL/france18" "$BASE_DIR/france"
download_gallery "Japan" "$BASE_URL/japan18" "$BASE_DIR/japan"
download_gallery "Canada" "$BASE_URL/canada17" "$BASE_DIR/canada"
download_gallery "Elsewhere" "$BASE_URL/elsewhere" "$BASE_DIR/elsewhere"

# Final summary
echo "=========================================="
echo "FINAL SUMMARY"
echo "=========================================="
echo "Italy: $(ls -1 $BASE_DIR/italy | wc -l | tr -d ' ') images"
echo "Los Angeles: $(ls -1 $BASE_DIR/los-angeles | wc -l | tr -d ' ') images"
echo "France: $(ls -1 $BASE_DIR/france | wc -l | tr -d ' ') images"
echo "Japan: $(ls -1 $BASE_DIR/japan | wc -l | tr -d ' ') images"
echo "Canada: $(ls -1 $BASE_DIR/canada | wc -l | tr -d ' ') images"
echo "Elsewhere: $(ls -1 $BASE_DIR/elsewhere | wc -l | tr -d ' ') images"
echo "=========================================="
