#!/usr/bin/env python3
"""Import blog posts and About page content from the live site.

This script fetches Squarespace JSON endpoints and writes:
- src/content/blog/<slug>.md
- src/content/about.html
- scripts/redirects.json (blog post redirects)

Requires network access.
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.request import Request, urlopen

BLOG_JSON_URL = "https://samthegeek.net/blog?format=json"
ABOUT_JSON_URL = "https://samthegeek.net/about?format=json"
BASE_URL = "https://samthegeek.net"

BLOG_DIR = Path("src/content/blog")
ABOUT_HTML_PATH = Path("src/content/about.html")
REDIRECTS_PATH = Path("scripts/redirects.json")


def fetch_json(url: str) -> Dict:
    req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(req, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9\s-]", "", value)
    value = re.sub(r"\s+", "-", value)
    value = re.sub(r"-{2,}", "-", value)
    return value.strip("-")


def strip_html(html: str) -> str:
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def build_description(html: str, max_len: int = 220) -> str:
    text = strip_html(html)
    if len(text) <= max_len:
        return text
    cut = text[:max_len].rsplit(" ", 1)[0]
    return f"{cut}…"


def fetch_post_detail(url: str) -> Dict:
    if url.startswith("/"):
        url = f"{BASE_URL}{url}"
    detail_url = f"{url}?format=json"
    payload = fetch_json(detail_url)
    return payload.get("item", {})


def build_slug_path(title: str, url_id: Optional[str]) -> Tuple[str, str]:
    cleaned_url_id = (url_id or "").strip("/")
    if cleaned_url_id:
        return cleaned_url_id, f"/blog/{cleaned_url_id}"

    fallback_slug = slugify(title)
    return fallback_slug, f"/blog/{fallback_slug}"


def clear_existing_blog_posts() -> None:
    if not BLOG_DIR.exists():
        return
    for path in BLOG_DIR.rglob("*.md"):
        path.unlink()


def write_blog_posts(items: List[Dict]) -> List[Dict]:
    BLOG_DIR.mkdir(parents=True, exist_ok=True)
    clear_existing_blog_posts()
    redirects: List[Dict] = []
    for item in items:
        title = item.get("title") or "Untitled"
        url_id = item.get("urlId")
        slug_path, new_path = build_slug_path(title, url_id)

        body_html = item.get("body") or ""
        excerpt_html = item.get("excerpt") or ""
        description = build_description(body_html)
        added_on = item.get("addedOn") or item.get("publishOn") or 0
        pub_date = datetime.fromtimestamp(added_on / 1000, tz=timezone.utc).strftime("%Y-%m-%d")

        detail = fetch_post_detail(item.get("fullUrl") or new_path)
        categories = detail.get("categories") or []
        tags = detail.get("tags") or []
        like_count = detail.get("likeCount")
        comment_count = detail.get("publicCommentCount")
        updated_on = detail.get("updatedOn")
        updated_date = None
        if updated_on:
            updated_date = datetime.fromtimestamp(updated_on / 1000, tz=timezone.utc).strftime("%Y-%m-%d")

        content = [
            "---",
            f'title: "{title.replace("\"", "\\\"")}"',
            f'description: "{description.replace("\"", "\\\"")}"',
            f"pubDate: {pub_date}",
            f'urlId: "{(url_id or "").strip("/")}"' if url_id else "urlId: \"\"",
        ]
        if updated_date:
            content.append(f"updatedDate: {updated_date}")
        if categories:
            content.append(f"categories: {categories}")
        if tags:
            content.append(f"tags: {tags}")
        if like_count is not None:
            content.append(f"likeCount: {like_count}")
        if comment_count is not None:
            content.append(f"commentCount: {comment_count}")
        if excerpt_html:
            content.append(f'excerptHtml: "{excerpt_html.replace("\"", "\\\"")}"')
        content.extend([
            "---",
            "",
            body_html,
            "",
        ])
        post_path = BLOG_DIR / f"{slug_path}.md"
        post_path.parent.mkdir(parents=True, exist_ok=True)
        post_path.write_text("\n".join(content))

        legacy_slug = slugify(title)
        legacy_path = f"/blog/{legacy_slug}"
        if legacy_path != new_path:
            redirects.append({"from": legacy_path, "to": new_path, "status": 301})

        compact_slug = legacy_slug.replace("-", "")
        compact_path = f"/blog/{compact_slug}"
        if compact_path != new_path and compact_path != legacy_path:
            redirects.append({"from": compact_path, "to": new_path, "status": 301})
    return redirects


def write_about_page(data: Dict) -> None:
    main_content = data.get("mainContent") or ""
    ABOUT_HTML_PATH.parent.mkdir(parents=True, exist_ok=True)
    ABOUT_HTML_PATH.write_text(main_content)


def merge_redirects(new_redirects: List[Dict]) -> None:
    existing: List[Dict] = []
    if REDIRECTS_PATH.exists():
        existing = json.loads(REDIRECTS_PATH.read_text())

    non_blog_redirects = [
        entry for entry in existing if not str(entry.get("from", "")).startswith("/blog/")
    ]
    merged = non_blog_redirects + new_redirects
    REDIRECTS_PATH.write_text(json.dumps(merged, indent=2))


def main() -> int:
    blog_data = fetch_json(BLOG_JSON_URL)
    items = blog_data.get("items", [])
    redirects = write_blog_posts(items)

    about_data = fetch_json(ABOUT_JSON_URL)
    write_about_page(about_data)

    merge_redirects(redirects)
    print(f"Imported {len(items)} blog posts.")
    print("Wrote src/content/about.html and scripts/redirects.json.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
