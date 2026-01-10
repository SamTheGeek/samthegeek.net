#!/bin/bash

# Quick status check for gallery images

echo "=========================================="
echo "Gallery Image Status"
echo "=========================================="
echo ""

BASE_DIR="/Users/sam/Developer/samthegeek.net/public/images"

check_gallery() {
    local name=$1
    local dir=$2

    if [ -d "$BASE_DIR/$dir" ]; then
        count=$(find "$BASE_DIR/$dir" -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" -o -name "*.JPG" -o -name "*.JPEG" -o -name "*.PNG" \) | wc -l | tr -d ' ')
        echo "$name: $count images"
    else
        echo "$name: Directory not found"
    fi
}

check_gallery "Copenhagen    " "copenhagen"
check_gallery "Italy         " "italy"
check_gallery "Los Angeles   " "los-angeles"
check_gallery "France        " "france"
check_gallery "Japan         " "japan"
check_gallery "Canada        " "canada"
check_gallery "Elsewhere     " "elsewhere"

echo ""
echo "=========================================="
