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
from typing import Dict, List
from urllib.request import Request, urlopen

BLOG_JSON_URL = "https://samthegeek.net/blog?format=json"
ABOUT_JSON_URL = "https://samthegeek.net/about?format=json"

BLOG_DIR = Path("src/content/blog")
ABOUT_HTML_PATH = Path("src/content/about.html")
REDIRECTS_PATH = Path("scripts/redirects.json")


def fetch_json(url: str) -> Dict:
    req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(req, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9\\s-]", "", value)
    value = re.sub(r"\\s+", "-", value)
    value = re.sub(r"-{2,}", "-", value)
    return value.strip("-")


def strip_html(html: str) -> str:
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\\s+", " ", text)
    return text.strip()


def build_description(html: str, max_len: int = 220) -> str:
    text = strip_html(html)
    if len(text) <= max_len:
        return text
    cut = text[:max_len].rsplit(" ", 1)[0]
    return f"{cut}…"


def write_blog_posts(items: List[Dict]) -> List[Dict]:
    BLOG_DIR.mkdir(parents=True, exist_ok=True)
    redirects: List[Dict] = []
    for item in items:
        title = item.get("title") or "Untitled"
        slug = slugify(title)
        url_id = item.get("urlId", "").strip("/")
        old_path = f"/blog/{url_id}" if url_id else item.get("fullUrl")
        new_path = f"/blog/{slug}"

        body_html = item.get("body") or ""
        description = build_description(body_html)
        added_on = item.get("addedOn") or item.get("publishOn") or 0
        pub_date = datetime.fromtimestamp(added_on / 1000, tz=timezone.utc).strftime("%Y-%m-%d")

        content = [
            "---",
            f'title: "{title.replace("\"", "\\\"")}"',
            f'description: "{description.replace("\"", "\\\"")}"',
            f"pubDate: {pub_date}",
            "---",
            "",
            body_html,
            "",
        ]
        (BLOG_DIR / f"{slug}.md").write_text("\n".join(content))

        if old_path and old_path != new_path:
            redirects.append({"from": old_path, "to": new_path, "status": 301})
    return redirects


def write_about_page(data: Dict) -> None:
    main_content = data.get("mainContent") or ""
    ABOUT_HTML_PATH.parent.mkdir(parents=True, exist_ok=True)
    ABOUT_HTML_PATH.write_text(main_content)


def merge_redirects(new_redirects: List[Dict]) -> None:
    existing: List[Dict] = []
    if REDIRECTS_PATH.exists():
        existing = json.loads(REDIRECTS_PATH.read_text())

    merged = {(entry["from"], entry["to"]): entry for entry in existing}
    for entry in new_redirects:
        merged[(entry["from"], entry["to"])] = entry

    REDIRECTS_PATH.write_text(json.dumps(list(merged.values()), indent=2))


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
