#!/usr/bin/env python3
"""Fail publication on broken local HTML href/src targets.

Generated build assets are checked after the collectors run, too.
"""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
    def handle_starttag(self, tag, attrs):
        data = dict(attrs)
        for key in ("href", "src"):
            if key in data:
                self.links.append(data[key])

def main():
    broken = []
    checked = 0
    for page in sorted(ROOT.glob("*.html")):
        parser = Links()
        parser.feed(page.read_text(encoding="utf-8"))
        for url in parser.links:
            parts = urlsplit(url)
            if parts.scheme or parts.netloc or not parts.path or parts.path.startswith("//"):
                continue
            target = unquote(parts.path)
            if target.startswith("/"):
                # GitHub Pages site-root absolute paths are not repository-relative.
                continue
            resolved = (page.parent / target).resolve()
            checked += 1
            if not resolved.is_relative_to(ROOT.resolve()) or not resolved.is_file():
                broken.append(f"{page.name}: {url}")
    print(f"Audited {checked} local links/assets across {len(list(ROOT.glob('*.html')))} pages.")
    if broken:
        raise SystemExit("Broken references:\n" + "\n".join(broken))
    print("All local HTML links and assets resolve.")

if __name__ == "__main__":
    main()
