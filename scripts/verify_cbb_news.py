#!/usr/bin/env python3
"""Check the national wire's freshness and its delivery to both front pages."""

import argparse
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
FEED = "data/cbb-national-news.json"
RENDERER = "cbb-front-news.js"


def verify(data, max_age):
    updated = datetime.fromisoformat(data["updated_at"].replace("Z", "+00:00"))
    age = (datetime.now(timezone.utc) - updated).total_seconds() / 60
    if not -5 <= age <= max_age:
        raise ValueError(f"National wire update is {age:.0f} minutes old (limit {max_age})")
    counts = {}
    for gender in ("men", "women"):
        counts[gender] = sum(
            article.get("gender") == gender
            and bool(article.get("title") and article.get("source"))
            and urlsplit(article.get("url", "")).scheme in ("http", "https")
            for article in data["articles"]
        )
        if not counts[gender]:
            raise ValueError(f"No attributed {gender}'s headlines in the national wire")
    return f"{counts['men']} men's and {counts['women']} women's headlines, refreshed {age:.0f} minutes ago"


def verify_public(site, local, max_age):
    version = re.search(r'src="(cbb-front-news\.js\?v=[^"]+)"', (ROOT / "ncaam.html").read_text())
    if not version:
        raise ValueError("No versioned news renderer on the basketball front page")
    script = version.group(1)

    def fetch(path, query=""):
        separator = "&" if "?" in path else "?"
        url = site.rstrip("/") + "/" + path
        if query:
            url += separator + query
        request = Request(url, headers={"Cache-Control": "no-cache"})
        with urlopen(request, timeout=15) as response:
            return response.read()

    for attempt in range(6):
        try:
            cache_key = f"verify_news={time.time_ns()}"
            public = json.loads(fetch(FEED, cache_key))
            if public != local:
                raise ValueError("Public wire differs from the deployed edition")
            for page in ("ncaam.html", "ncaam.html?gender=women"):
                html = fetch(page, cache_key).decode()
                if script not in html or 'id="cbb-front-news"' not in html:
                    raise ValueError(f"Public {page} does not load the current news renderer")
            if fetch(script) != (ROOT / RENDERER).read_bytes():
                raise ValueError("Public news renderer differs from the deployed edition")
            return verify(public, max_age)
        except (ValueError, KeyError, URLError, TimeoutError) as error:
            if attempt == 5:
                raise
            print(f"Public news verification {attempt + 1}/6: {error}", flush=True)
            time.sleep(8)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--public", help="Compare against this GitHub Pages site")
    parser.add_argument("--max-age", type=int, default=30)
    args = parser.parse_args()
    try:
        local = json.loads((ROOT / FEED).read_text())
        result = verify_public(args.public, local, args.max_age) if args.public else verify(local, args.max_age)
    except (OSError, ValueError, KeyError, TypeError) as error:
        raise SystemExit(f"CBB news verification failed: {error}") from error
    print(f"PASS {'public ' if args.public else ''}CBB wire: {result}")


if __name__ == "__main__":
    main()
