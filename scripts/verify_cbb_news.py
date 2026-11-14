#!/usr/bin/env python3
"""Fail publication when either Hardwood Chronicle edition is stale or mislabeled."""
import argparse
import json
import re
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen
from urllib.parse import urlsplit

from refresh_cbb_national_news import classify, duplicate, link_type, valid_url, BASKET, SPORT_URL, MAX_AGE_HOURS, FRESH_HOURS

ROOT = Path(__file__).resolve().parents[1]
FEED = "data/cbb-national-news.json"
RENDERER = "cbb-front-news.js"


def verify(data, max_age):
    now = datetime.now(timezone.utc)
    updated = datetime.fromisoformat(data["updated_at"].replace("Z", "+00:00"))
    age = (now - updated).total_seconds() / 60
    if not -5 <= age <= max_age:
        raise ValueError(f"National wire update is {age:.0f} minutes old (limit {max_age})")
    counts, recent = {}, {}
    articles = data.get("articles")
    if not isinstance(articles, list):
        raise ValueError("News articles must be an array")
    for gender in ("men", "women"):
        selected = [article for article in articles if article.get("gender") == gender]
        counts[gender], recent[gender] = len(selected), 0
        if len(selected) < 3:
            raise ValueError(f"Only {len(selected)} attributed {gender}'s basketball headlines")
        for i, article in enumerate(selected):
            title = article.get("title", "")
            trusted = gender if article.get("gender_evidence") == "verified_basketball_feed" else None
            if (not article.get("source") or not valid_url(article.get("url", "")) or
                    not (BASKET.search(title) or SPORT_URL.search(urlsplit(article['url']).path)) or
                    classify(title, trusted_feed_gender=trusted) != gender):
                raise ValueError(f"Misclassified, off-topic or unattributed {gender}'s story: {title}")
            if article.get("gender_evidence") == "verified_basketball_feed" and article.get("origin") not in ("publisher RSS", "school"):
                raise ValueError(f"Unverified gender evidence on story: {title}")
            if article.get("link_type") != link_type(article["url"]):
                raise ValueError(f"Incorrect publisher/aggregator link label: {title}")
            date = datetime.fromisoformat(article["published_at"].replace("Z", "+00:00"))
            if not timedelta(minutes=-5) <= now - date <= timedelta(hours=MAX_AGE_HOURS):
                raise ValueError(f"Old/future article in {gender}'s wire: {title}")
            if now - date <= timedelta(hours=FRESH_HOURS):
                recent[gender] += 1
            if any(duplicate(article, previous) for previous in selected[:i]):
                raise ValueError(f"Duplicate {gender}'s wire story: {title}")
        if recent[gender] < 2:
            raise ValueError(f"Too few new {gender}'s articles within {FRESH_HOURS}h: {recent[gender]}")
    return (f"{counts['men']} men's and {counts['women']} women's basketball stories; "
            f"{recent['men']}/{recent['women']} published within {FRESH_HOURS}h; "
            f"feed refreshed {age:.0f} minutes ago")


def verify_public(site, local, max_age):
    version = re.search(r'src="(cbb-front-news\.js\?v=[^"]+)"', (ROOT / "ncaam.html").read_text())
    if not version:
        raise ValueError("No versioned news renderer on the basketball front page")
    script = version.group(1)

    def fetch(path, query=""):
        sep = "&" if "?" in path else "?"
        url = site.rstrip("/") + "/" + path + (sep + query if query else "")
        with urlopen(Request(url, headers={"Cache-Control": "no-cache"}), timeout=15) as res:
            return res.read()

    for attempt in range(6):
        try:
            key = f"verify_news={time.time_ns()}"
            public = json.loads(fetch(FEED, key))
            if public != local:
                raise ValueError("Public wire differs from the repository")
            for page in ("ncaam.html", "ncaam.html?gender=women"):
                html = fetch(page, key).decode()
                if script not in html or 'id="cbb-front-news"' not in html:
                    raise ValueError(f"Public {page} does not load the current news renderer")
            if fetch(script) != (ROOT / RENDERER).read_bytes():
                raise ValueError("Public news renderer differs from the repository")
            return verify(public, max_age)
        except (ValueError, KeyError, URLError, TimeoutError) as error:
            if attempt == 5:
                raise
            print(f"Public news verification {attempt + 1}/6: {error}", flush=True)
            time.sleep(8)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--public", help="Compare against this deployed GitHub Pages URL")
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
