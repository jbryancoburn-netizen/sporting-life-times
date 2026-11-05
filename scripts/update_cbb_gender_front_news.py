#!/usr/bin/env python3
"""Publish an independent sourced college-basketball news wire per gender."""
import argparse
import datetime as dt
import email.utils
import json
import pathlib
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

QUERIES = {
    "men": ['"men\'s college basketball"', '"NCAA men\'s basketball"'],
    "women": ['"women\'s college basketball"', '"NCAA women\'s basketball"'],
}
PAT_WOMEN = re.compile(r"\b(women(?:'s|’s)?|ncaaw|wbb|lady|ladies)\b", re.I)
PAT_MEN = re.compile(r"\b(men(?:'s|’s)?|ncaa men|mbb)\b", re.I)
PAT_BASKET = re.compile(r"\b(basketball|hoops|ncaaw|wbb|mbb)\b", re.I)

def read_feed(query):
    url = "https://news.google.com/rss/search?" + urllib.parse.urlencode({
        "q": query + " when:7d", "hl": "en-US", "gl": "US", "ceid": "US:en"})
    req = urllib.request.Request(url, headers={"User-Agent": "SportingLifeTimesNews/1.0 (RSS)"})
    with urllib.request.urlopen(req, timeout=25) as response:
        root = ET.fromstring(response.read())
    for item in root.findall("./channel/item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        source = item.find("source")
        publisher = source.text.strip() if source is not None and source.text else "Google News"
        date = item.findtext("pubDate") or ""
        try:
            published = email.utils.parsedate_to_datetime(date).astimezone(dt.timezone.utc).isoformat()
        except (TypeError, ValueError):
            continue
        if title and link.startswith("https://"):
            yield {"title": title, "url": link, "source": publisher,
                   "published_at": published, "summary": ""}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--gender", required=True, choices=("men", "women"))
    args = parser.parse_args()
    news = {}
    for query in QUERIES[args.gender]:
        for a in read_feed(query):
            title = a["title"]
            if not PAT_BASKET.search(title):
                continue
            if args.gender == "women" and (PAT_MEN.search(title) and not PAT_WOMEN.search(title)):
                continue
            if args.gender == "men" and PAT_WOMEN.search(title) and not PAT_MEN.search(title):
                continue
            a["gender"] = args.gender
            a["category"] = "WBB" if args.gender == "women" else "MBB"
            news.setdefault(re.sub(r"\W+", "", title.casefold()), a)
    if len(news) < 3:
        raise RuntimeError("Insufficient new sourced stories: refusing to overwrite existing feed")
    items = sorted(news.values(), key=lambda a: a["published_at"], reverse=True)[:60]
    path = pathlib.Path("data/cbb-" + args.gender + "-front-news.json")
    path.parent.mkdir(parents=True, exist_ok=True)
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    path.write_text(json.dumps({"edition": args.gender, "updated_at": now,
                                "articles": items}, ensure_ascii=False, indent=2) + "\n")
    print(f"Published {len(items)} {args.gender} articles to {path}")

if __name__ == "__main__":
    main()
