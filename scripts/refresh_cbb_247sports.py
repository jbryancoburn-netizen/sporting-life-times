#!/usr/bin/env python3
"""Collect public 247Sports school headlines and link to their original articles."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import re
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / "data/cbb-247sports-team-sites.json"
OUTPUT = ROOT / "data/cbb-247sports-headlines.json"
ARTICLE = re.compile(r"/college/([a-z0-9-]+)/(?:article|longformarticle)/[^/]+/", re.I)
WOMEN = re.compile(r"\bwomen(?:['’]s)?\b|\bWBB\b|\bNCAA W(?:BK|B)\b", re.I)
OTHER_SPORT = re.compile(r"\bfootball\b|\bNFL\b|\bquarterback\b", re.I)


def headlines(html, schools, now, expected_school=None):
    decoder = json.JSONDecoder()
    stories = {}
    for match in re.finditer(r'\{"key":\d+,"author":', html):
        try:
            item, _ = decoder.raw_decode(html, match.start())
            url = urlsplit(item.get("urlSlug") or "")
            published = datetime.fromisoformat(item["postTime"].replace("Z", "+00:00"))
            if not now - timedelta(days=5) <= published <= now + timedelta(minutes=5):
                continue
        except (ValueError, TypeError, KeyError):
            continue
        path = ARTICLE.fullmatch(url.path)
        if (url.scheme != "https" or url.netloc not in ("247sports.com", "www.247sports.com")
                or not path or item.get("isExternal") or item.get("sport") != "Basketball"):
            continue
        slug = path.group(1).lower()
        title = " ".join((item.get("title") or "").split())
        if slug not in schools or (expected_school and slug != expected_school) or not title or OTHER_SPORT.search(title):
            continue
        evidence = " ".join([title, item.get("label") or "", item.get("summary") or ""])
        edition = "women" if WOMEN.search(evidence) else "men" if item.get("label") == "NCAA BK" else None
        if not edition:
            continue
        stories[item["key"]] = {
            "id": item["key"], "school": schools[slug], "slug": slug,
            "title": title, "url": "https://247sports.com" + url.path,
            "published_at": published.isoformat(), "gender": edition, "vip": item.get("vip") is True,
        }
    return list(stories.values())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--schools", type=int, default=42)
    args = parser.parse_args()
    now = datetime.now(timezone.utc)
    prior = json.loads(OUTPUT.read_text()) if OUTPUT.exists() else {}
    checked = prior.get("checked", {})
    schools = dict(json.loads(DIRECTORY.read_text()))
    # Start with a national feed, then rotate through the publisher's school sites.
    # Prefer the earliest unchecked sites, including sites with sparse coverage.
    rotation = sorted(schools, key=lambda slug: (checked.get(slug, {}).get("at", ""), slug))
    if not checked:
        first = ["indiana", "duke", "connecticut", "kansas", "kentucky", "north-carolina",
                 "purdue", "michigan-state", "michigan", "florida", "arizona",
                 "gonzaga", "arkansas", "tennessee", "south-carolina", "iowa",
                 "lsu", "ucla", "wright-state", "creighton", "villanova"]
        rotation = list(dict.fromkeys([slug for slug in first if slug in schools] + rotation))

    def collect(slug):
        path = f"/college/{slug}/news/?sport=basketball" if slug else "/news/?sport=basketball"
        try:
            request = Request("https://247sports.com" + path, headers={"User-Agent": "Mozilla/5.0"})
            with urlopen(request, timeout=12) as response:
                html = response.read(3_000_000).decode("utf-8", errors="replace")
            if "247sports.com" not in html:
                return slug, None
            return slug, headlines(html, schools, now, slug)
        except OSError:
            return slug, None

    articles = {item["id"]: item for item in prior.get("articles", [])
                if now - datetime.fromisoformat(item["published_at"]) <= timedelta(days=5)}
    successful = 0
    with ThreadPoolExecutor(max_workers=10) as pool:
        for slug, stories in pool.map(collect, [None, *rotation[:args.schools]]):
            if slug:
                checked[slug] = {"at": now.isoformat(), "available": stories is not None}
            if stories is None:
                continue
            successful += 1
            articles.update((story["id"], story) for story in stories)
    if not successful:
        print("247Sports sources unavailable. Retained the last published wire.")
        return
    ordered = sorted(articles.values(), key=lambda item: item["published_at"], reverse=True)
    OUTPUT.write_text(json.dumps({"updated_at": now.isoformat(), "checked": checked,
                                  "articles": ordered}, ensure_ascii=False, indent=2) + "\n")
    print(f"247Sports wire: {len(ordered)} headlines from {len({a['slug'] for a in ordered})} schools")


if __name__ == "__main__":
    main()
