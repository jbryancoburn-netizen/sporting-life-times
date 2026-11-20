#!/usr/bin/env python3
"""Collect public headline metadata from On3/Rivals school basketball desks."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import re
from urllib.request import Request, urlopen

DATA = Path(__file__).resolve().parents[1] / "data"
OUTPUT = DATA / "cbb-on3-rivals-headlines.json"
ORIGIN = "https://www.on3.com"
SITE = re.compile(r"/(?:teams|sites)/[a-z0-9-]+")
NEXT_DATA = re.compile(r'<script[^>]+id="__NEXT_DATA__"[^>]*>(.*?)</script>', re.S)


def collect(job):
    edition, school, publisher, source = job
    site = source.removeprefix(ORIGIN).removesuffix("/news/")
    if not SITE.fullmatch(site):
        return source, edition, None
    category = "/womens-basketball" if edition == "women" else "/basketball"
    url = f"{ORIGIN}{site}/category{category}/news/"
    try:
        with urlopen(Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=9) as response:
            match = NEXT_DATA.search(response.read(6_000_000).decode("utf-8"))
        page = json.loads(match.group(1))["props"]["pageProps"]
        if page["category"]["url"] != category:
            return source, edition, None
        articles = []
        seen = set()
        for item in page["articles"]["list"]:
            path = item.get("fullUrl") or ""
            title = " ".join((item.get("title") or "").split())
            if (not title or item.get("status") != "publish" or path in seen
                    or not re.fullmatch(re.escape(site) + r"/news/[a-z0-9-]+/?", path)
                    or item.get("site", {}).get("url") != site):
                continue
            published = datetime.fromisoformat(item["postDateGMT"]).replace(tzinfo=timezone.utc)
            if not NOW - timedelta(days=14) <= published <= NOW + timedelta(minutes=5):
                continue
            seen.add(path)
            articles.append({"title": title, "url": ORIGIN + path, "published_at": published.isoformat(),
                             "premium": item.get("isPremium") is True})
        articles.sort(key=lambda item: item["published_at"], reverse=True)
        return source, edition, {"url": url, "articles": articles[:6]}
    except (OSError, AttributeError, KeyError, ValueError, TypeError) as exc:
        print(f"Source unavailable for {school} ({publisher}, {edition}): {exc}")
        return source, edition, None


NOW = datetime.now(timezone.utc)
if __name__ == "__main__":
    previous = json.loads(OUTPUT.read_text()) if OUTPUT.exists() else {}
    if previous and NOW - datetime.fromisoformat(previous["updated_at"]) < timedelta(minutes=20):
        raise SystemExit(0)
    directory = json.loads((DATA / "cbb-on3-rivals-team-sites.json").read_text())
    jobs = [(edition, *row) for edition, rows in directory.items() for row in rows]
    feeds = {edition: {} for edition in directory}
    checks = 0
    with ThreadPoolExecutor(max_workers=16) as pool:
        for source, edition, result in pool.map(collect, jobs):
            if result is not None:
                checks += 1
            else:
                result = previous.get("feeds", {}).get(edition, {}).get(source)
            if result is not None:
                feeds[edition][source] = result
    if checks:
        OUTPUT.write_text(json.dumps({"updated_at": NOW.isoformat(), "feeds": feeds}, ensure_ascii=False) + "\n")
    print(f"On3/Rivals checked {checks}/{len(jobs)} basketball desks")
